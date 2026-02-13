import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchUserSuggestions,
  addUserSuggestion,
  clearUserSuggestions
} from "../api/userData";

const CATEGORIES = [
  {
    title: "PDF Tools",
    color: "#fde68a",
    apps: [
      { name: "PDF to Text", tab: "pdf-to-text", icon: "/icons/pdf-to-text.png" },
      { name: "PDF Merger", tab: "pdf-merge", icon: "/icons/pdf-merger.png" },
      { name: "PDF to Word", tab: "pdf-to-word", icon: "/icons/pdf-to-word.png" },
      { name: "PDF Split", tab: "pdf-split", icon: "/icons/pdf-split.jpg" },
      { name: "PDF Watermark", tab: "pdf-watermark", icon: "/icons/pdf-watermark.png" },
      { name: "PDF Page Number", tab: "pdf-page-number", icon: "/icons/pdf-page-number.png" }
    ]
  },
  {
    title: "Image Tools",
    color: "#bfdbfe",
    apps: [
      { name: "Image to PDF", tab: "image-to-pdf", icon: "/icons/image-to-pdf.png" },
      { name: "Image Compressor", tab: "image-compressor", icon: "/icons/image-compressor.png" },
      { name: "Image Format Converter", tab: "image-format-converter", icon: "/icons/image-Formater.png" },
      { name: "Image to Text (OCR)", tab: "image-to-text", icon: "/icons/image-to-text.png" },
      { name: "PDF to Image", tab: "pdf-to-image", icon: "/icons/pdf-to-image.jpg" }
    ]
  },
  {
    title: "Document Tools",
    color: "#bbf7d0",
    apps: [
      { name: "Word to PDF", tab: "word-to-pdf", icon: "/icons/word-to-pdf.png" },
      { name: "QR Code Generator", tab: "qr-generator", icon: "/icons/qr.webp" },
      { name: "PPT to Excel", tab: "ppt-to-excel", icon: "/icons/ppt-to-excel.png"}
    ]
  },
  {
    title: "AI Tools",
    color: "#e9d5ff",
    apps: [
      { name: "Meeting MOM Generator", tab: "meeting-mom", icon: "/icons/mom.png" }
    ]
  }
];

const DashboardFolders = ({
  setActiveTab,
  recent = [],
  usageCount = {},
  favourites = [],
  onToggleFavourite,
  onClearRecent,
  onClearFrequentlyUsed,
  onLoginClick,
  user,
  onLogout
}) => {
  const [openIndex, setOpenIndex] = useState(0);
  const [search, setSearch] = useState("");

  // topbar dropdown
  const [activeMenu, setActiveMenu] = useState(null);
  const navRef = useRef(null);

  // ✅ Suggestion box states (DB)
  const [toolIdea, setToolIdea] = useState("");
  const [note, setNote] = useState("");
  const [suggestions, setSuggestions] = useState([]);

  const [toast, setToast] = useState("");

  const allApps = useMemo(() => CATEGORIES.flatMap((c) => c.apps), []);
  const appByTab = useMemo(() => {
    const map = {};
    allApps.forEach((a) => (map[a.tab] = a));
    return map;
  }, [allApps]);

  const searchLower = search.trim().toLowerCase();
  const matchesSearch = (name) => !searchLower || name.toLowerCase().includes(searchLower);

  const recentApps = useMemo(() => {
    return (recent || [])
      .map((r) => {
        const base = appByTab[r.tab];
        if (!base) return null;
        return { ...base, name: r.name || base.name };
      })
      .filter(Boolean)
      .filter((a) => matchesSearch(a.name));
  }, [recent, appByTab, searchLower]);

  const frequentlyUsed = useMemo(() => {
    const entries = Object.entries(usageCount || {});
    entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
    return entries
      .slice(0, 5)
      .map(([tab]) => appByTab[tab])
      .filter(Boolean)
      .filter((a) => matchesSearch(a.name));
  }, [usageCount, appByTab, searchLower]);

  const filteredFavourites = useMemo(() => {
    return (favourites || []).filter((a) => matchesSearch(a.name));
  }, [favourites, searchLower]);

  // close dropdown on outside click + ESC
  useEffect(() => {
    const handleOutside = (e) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(e.target)) setActiveMenu(null);
    };
    const handleEsc = (e) => {
      if (e.key === "Escape") setActiveMenu(null);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const handleOpenTool = (tab, name) => {
    setActiveTab(tab, name);
    setActiveMenu(null);
  };

  const Pill = ({ label, onClick, bg = "rgba(255,255,255,0.06)" }) => (
    <div
      onClick={onClick}
      style={{
        padding: "8px 10px",
        background: bg,
        borderRadius: 10,
        cursor: "pointer",
        fontSize: 13,
        userSelect: "none",
        border: "1px solid rgba(255,255,255,0.10)",
        color: "#e5e7eb"
      }}
    >
      {label}
    </div>
  );

  // ✅ Load suggestions from DB when user changes
  useEffect(() => {
    const run = async () => {
      if (!user) {
        setSuggestions([]);
        return;
      }
      try {
        const list = await fetchUserSuggestions();
        setSuggestions(Array.isArray(list) ? list : []);
      } catch (e) {
        console.error("fetchUserSuggestions failed:", e);
      }
    };
    run();
  }, [user]);

  // ✅ Suggestion submit (DB)
  const handleSubmitSuggestion = async (e) => {
    e.preventDefault();

    const idea = toolIdea.trim();
    const n = note.trim();

    if (!user) {
      showToast("Please login first ✅");
      return;
    }

    if (!idea) {
      showToast("Please enter a tool idea ✅");
      return;
    }

    try {
      const updated = await addUserSuggestion(idea, n);
      setSuggestions(Array.isArray(updated) ? updated : []);
      setToolIdea("");
      setNote("");
      showToast("Suggestion saved ✅");
    } catch (e) {
      showToast(e?.message || "Failed");
    }
  };

  return (
    <div style={{ padding: 0 }}>
      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            right: 20,
            top: 20,
            background: "#111827",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 14,
            zIndex: 99999,
            boxShadow: "0 8px 20px rgba(0,0,0,0.25)"
          }}
        >
          {toast}
        </div>
      )}

      {/* ✅ TOPBAR */}
      <div className="dash-topbar" ref={navRef}>
        <div className="dash-topbar-brand">
          <span className="dash-dot a" />
          <span className="dash-dot b" />
          <span style={{ fontSize: 18, fontWeight: 900 }}>MYAPPS</span>
        </div>

        <div className="dash-topbar-menus">
          {/* Favourites */}
          <div className="dash-menu">
            <div
              className="dash-menu-btn"
              onClick={() => setActiveMenu(activeMenu === "favs" ? null : "favs")}
            >
              ⭐ Favourites <span style={{ opacity: 0.8 }}>{activeMenu === "favs" ? "▲" : "▼"}</span>
            </div>

            {activeMenu === "favs" && (
              <div className="dash-dd">
                <div className="dash-dd-head">
                  <div className="dash-dd-title">⭐ Favourites</div>
                </div>

                {filteredFavourites.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {filteredFavourites.map((app) => (
                      <Pill
                        key={app.tab}
                        label={app.name}
                        onClick={() => handleOpenTool(app.tab, app.name)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="dash-dd-empty">No favourites yet. Star any tool to see it here.</div>
                )}
              </div>
            )}
          </div>

          {/* Frequent */}
          <div className="dash-menu">
            <div
              className="dash-menu-btn"
              onClick={() => setActiveMenu(activeMenu === "freq" ? null : "freq")}
            >
              🔁 Frequently Used{" "}
              <span style={{ opacity: 0.8 }}>{activeMenu === "freq" ? "▲" : "▼"}</span>
            </div>

            {activeMenu === "freq" && (
              <div className="dash-dd">
                <div className="dash-dd-head">
                  <div className="dash-dd-title">🔁 Frequently Used</div>

                  <button
                    className="dash-dd-clear"
                    onClick={() => {
                      onClearFrequentlyUsed?.();
                      setActiveMenu(null);
                    }}
                  >
                    Clear
                  </button>
                </div>

                {frequentlyUsed.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {frequentlyUsed.map((app) => (
                      <Pill
                        key={app.tab}
                        label={`${app.name} (${usageCount?.[app.tab] || 0}×)`}
                        onClick={() => handleOpenTool(app.tab, app.name)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="dash-dd-empty">Use any tool once — it will appear here.</div>
                )}
              </div>
            )}
          </div>

          {/* Recent */}
          <div className="dash-menu">
            <div
              className="dash-menu-btn"
              onClick={() => setActiveMenu(activeMenu === "recent" ? null : "recent")}
            >
              🕒 Recent Activity{" "}
              <span style={{ opacity: 0.8 }}>{activeMenu === "recent" ? "▲" : "▼"}</span>
            </div>

            {activeMenu === "recent" && (
              <div className="dash-dd">
                <div className="dash-dd-head">
                  <div className="dash-dd-title">🕒 Recent Activity</div>
                  <button className="dash-dd-clear" onClick={onClearRecent}>
                    Clear
                  </button>
                </div>

                {recentApps.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {recentApps.map((app) => (
                      <Pill
                        key={app.tab}
                        label={app.name}
                        onClick={() => handleOpenTool(app.tab, app.name)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="dash-dd-empty">No recent activity yet.</div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="dash-topbar-right">
          <div className="dash-search-wrap">
            <input
              className="dash-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tools..."
            />
            <span className="dash-search-icon">🔍</span>
          </div>

          <div
            className="dash-login"
            onClick={() => {
              if (user) onLogout?.();
              else onLoginClick?.();
            }}
          >
            👤 <span>{user ? `Logout (${user.name})` : "Log In / Sign Up"}</span>
          </div>
        </div>
      </div>

      {/* ✅ CONTENT */}
      <div style={{ marginTop: 0 }}>
        <h3 className="dashboard-heading" style={{ marginTop: 10 }}>
          <span className="heading-icon">📂</span>
          My Applications
        </h3>

        <div className="dashboard-container-split" style={{ alignItems: "flex-start" }}>
          {/* LEFT */}
          <div className="dashboard-left">
            {CATEGORIES.map((cat, i) => {
              const isOpen = openIndex === i;
              const filteredApps = cat.apps.filter((a) => matchesSearch(a.name));
              if (searchLower && filteredApps.length === 0) return null;

              return (
                <div
                  key={i}
                  style={{
                    background: cat.color,
                    borderRadius: 16,
                    padding: 20,
                    marginBottom: 16
                  }}
                >
                  <div
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer"
                    }}
                  >
                    <h3 style={{ margin: 0 }}>
                      {cat.title} ({cat.apps.length})
                    </h3>
                    <span style={{ fontSize: 18 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>

                  {isOpen && (
                    <div
                      style={{
                        marginTop: 15,
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                        gap: 15
                      }}
                    >
                      {filteredApps.map((app) => {
                        const isFav = (favourites || []).some((f) => f.tab === app.tab);

                        return (
                          <div
                            key={app.tab}
                            className="tool-tile"
                            onClick={() => handleOpenTool(app.tab, app.name)}
                            style={{
                              background: "#fff",
                              borderRadius: 14,
                              padding: 15,
                              textAlign: "center",
                              cursor: "pointer",
                              boxShadow: "0 4px 10px rgba(0,0,0,0.12)",
                              position: "relative"
                            }}
                          >
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavourite(app);
                              }}
                              title={isFav ? "Remove from favourites" : "Add to favourites"}
                              style={{
                                position: "absolute",
                                top: 10,
                                right: 12,
                                fontSize: 18,
                                cursor: "pointer",
                                userSelect: "none"
                              }}
                            >
                              {isFav ? "⭐" : "☆"}
                            </span>

                            <img src={app.icon} alt={app.name} style={{ width: 42, marginBottom: 10 }} />
                            <div style={{ fontSize: 14, fontWeight: 600 }}>{app.name}</div>

                            {(usageCount?.[app.tab] || 0) > 0 && (
                              <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                                Used {usageCount[app.tab]}×
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* RIGHT - ✅ Suggestion Box (DB) */}
          <div className="dashboard-right">
            <div className="suggestion-card">
              <div className="suggestion-head">
                <div className="suggestion-title">
                  <span className="suggestion-emoji">💡</span>
                  <h4 style={{ margin: 0 }}>Suggestion Box</h4>
                </div>
                <span className="suggestion-chip">{user ? "Saved in DB" : "Login required"}</span>
              </div>

              <p className="suggestion-subtext">
                Suggest a new tool idea. Logged-in users ke liye ye DB me save hoga.
              </p>

              <form onSubmit={handleSubmitSuggestion} className="suggestion-form">
                <div className="suggestion-field">
                  <label className="suggestion-label">
                    Tool Idea <span className="req">*</span>
                  </label>
                  <input
                    value={toolIdea}
                    onChange={(e) => setToolIdea(e.target.value)}
                    placeholder="e.g., PDF to Excel, Background remover..."
                    className="suggestion-input"
                    disabled={!user}
                  />
                </div>

                <div className="suggestion-field">
                  <label className="suggestion-label">Note (optional)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Any details / use case…"
                    rows={3}
                    className="suggestion-input"
                    style={{ resize: "vertical" }}
                    disabled={!user}
                  />
                </div>

                <button type="submit" className="suggestion-submit" disabled={!user}>
                  Submit Suggestion
                </button>
              </form>

              {suggestions.length > 0 && (
                <div className="suggestion-list-wrap">
                  <div className="suggestion-list-head">
                    <div className="suggestion-list-title">Recent Suggestions</div>
                    <div className="suggestion-count">{suggestions.length}</div>
                  </div>

                  <div className="suggestion-list">
                    {suggestions.map((s) => (
                      <div key={s.id} className="suggestion-item">
                        <div className="suggestion-item-title">{s.tool_idea}</div>
                        {s.note && <div className="suggestion-item-note">{s.note}</div>}
                        <div className="suggestion-item-time">
                          {new Date(s.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={async () => {
                      if (!user) return;
                      await clearUserSuggestions();
                      setSuggestions([]);
                      showToast("Cleared ✅");
                    }}
                    className="suggestion-clear"
                    type="button"
                  >
                    Clear Suggestions
                  </button>
                </div>
              )}

              <div className="suggestion-footnote">
                ✅ Logged-in users: suggestions DB me save hote hain.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardFolders;