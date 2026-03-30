// src/components/AnalyticsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { fetchUserSuggestions } from "../api/userData";

/**
 * Premium Analytics Page – Playful Canva-style Emojis (Option C)
 * Focus: Trend • Categories • Most Used • Avg Session • Top Liked
 * Favourites & Recent hidden by default (to avoid duplication with Dashboard).
 *
 * Props:
 *  - usageCount: { [tab: string]: number }
 *  - recent: [{ tab, name, created_at }]
 *  - favourites: [{ tab, name }]
 *  - onBack: () => void
 *  - onOpenTool: (tab: string) => void
 *  - showFavourites?: boolean  // default: false
 *  - showRecent?: boolean      // default: false
 */

const EVENTS_KEY = "analytics_events_v1";
const SESS_KEY = "analytics_sessions_v1";

export default function AnalyticsPage({
  usageCount = {},
  recent = [],
  favourites = [],
  onBack,
  onOpenTool,
  showFavourites = false,
  showRecent = false
}) {
  /* ------------------ Derived (KPI) ------------------ */
  const totalUses = useMemo(
    () => Object.values(usageCount || {}).reduce((a, b) => a + (b || 0), 0),
    [usageCount]
  );

  // Most Used (exclude non-tools)
  const topUsage = useMemo(() => {
    const entries = Object
      .entries(usageCount || {})
      .filter(([tab]) => !["dashboard", "tools-help", "analytics"].includes(tab));
    entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
    return entries.slice(0, 8);
  }, [usageCount]);

  const mostUsedTab = topUsage?.[0]?.[0] || "";
  const mostUsedName = mostUsedTab ? `${iconForTab(mostUsedTab)} ${formatTab(mostUsedTab)}` : "—";

  // Category distribution (exclude non-tools)
  const categoryData = useMemo(() => groupByCategory(usageCount), [usageCount]);

  /* ------------------ Trend & Sessions ------------------ */
  const [daysRange, setDaysRange] = useState(7); // 7 or 30
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    try {
      const rawE = localStorage.getItem(EVENTS_KEY);
      setEvents(rawE ? JSON.parse(rawE) : []);
    } catch { setEvents([]); }
    try {
      const rawS = localStorage.getItem(SESS_KEY);
      setSessions(rawS ? JSON.parse(rawS) : []);
    } catch { setSessions([]); }
  }, []);

  const trendData = useMemo(() => buildTrend(events, daysRange), [events, daysRange]);

  const avgSessionMs = useMemo(() => {
    if (!sessions?.length) return 0;
    const sum = sessions.reduce((acc, s) => acc + (s?.ms || 0), 0);
    return Math.round(sum / sessions.length);
  }, [sessions]);

  /* ------------------ My Suggestions (Top Liked) ------------------ */
  const [mySuggestions, setMySuggestions] = useState([]);
  const topLikedMySuggestions = useMemo(() => {
    const list = Array.isArray(mySuggestions) ? mySuggestions : [];
    return [...list].sort((a, b) => (b?.likes || 0) - (a?.likes || 0)).slice(0, 5);
  }, [mySuggestions]);

  useEffect(() => {
    (async () => {
      try {
        const list = await fetchUserSuggestions();
        const safe = (Array.isArray(list) ? list : []).map((s) => ({
          likes: 0,
          liked_by_me: false,
          ...s
        }));
        setMySuggestions(safe);
      } catch {
        setMySuggestions([]);
      }
    })();
  }, []);

  /* ------------------ Render ------------------ */
  return (
    <div className="ap-wrap">
      {/* Header */}
      <div className="ap-head">
        <button className="ap-back" type="button" onClick={onBack}>← Back</button>
        <div>
          <div className="ap-title">Analytics</div>
          <div className="ap-sub">📈 Usage · 🕒 Sessions · 🍩 Categories · 💡 Suggestions</div>
        </div>
      </div>

      {/* KPI row (5 cards incl. Avg Session) — with emojis */}
      <div className="ap-kpi-row ap-kpi-5">
        <KPI icon="📊" title="Total Tool Uses" value={totalUses} hint="All‑time (local)" />
        <KPI icon="🏆" title="Most Used Tool" value={mostUsedName} hint="Top by count" />
        <KPI icon="⭐" title="Your Favourites" value={favourites?.length || 0} hint="Starred tools" />
        <KPI icon="📝" title="Recent Activity" value={recent?.length || 0} hint="Last 5" />
        <KPI icon="⏱️" title="Avg Session Time" value={formatMs(avgSessionMs)} hint="Open → Mark Done" />
      </div>

      {/* Trend & Categories */}
      <div className="ap-grid">
        {/* Trend (Sparkline) */}
        <div className="ap-card">
          <div className="ap-card-head">
            <div className="ap-card-title">📈 Activity Trend</div>
            <div className="ap-card-sub">
              <span className="ap-toggle">
                <button
                  className={`ap-toggle-btn ${daysRange === 7 ? "on" : ""}`}
                  onClick={() => setDaysRange(7)}
                >
                  7D
                </button>
                <button
                  className={`ap-toggle-btn ${daysRange === 30 ? "on" : ""}`}
                  onClick={() => setDaysRange(30)}
                >
                  30D
                </button>
              </span>
            </div>
          </div>
          <Sparkline data={trendData} />
        </div>

        {/* Category Donut */}
        <CategoryCard categoryData={categoryData} />
      </div>

      {/* Most Used + (optional) Recent + (optional) Favourites + Suggestions */}
      <div className="ap-grid">
        {/* Most Used */}
        <div className="ap-card">
          <div className="ap-card-head">
            <div className="ap-card-title">🏷️ Most Used Tools</div>
            <div className="ap-card-sub">Top 8 by total usage</div>
          </div>
          {topUsage.length ? (
            <div className="ap-bars">
              {topUsage.map(([tab, val]) => {
                const label = `${iconForTab(tab)} ${formatTab(tab)}`;
                return (
                  <BarRow
                    key={tab}
                    label={label}
                    value={val || 0}
                    max={Math.max(1, topUsage[0][1] || 1)}
                    onClick={() => onOpenTool?.(tab)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="ap-empty">No usage yet. Try some tools!</div>
          )}
        </div>

        {/* Recent — hidden by default */}
        {showRecent && (
          <div className="ap-card">
            <div className="ap-card-head">
              <div className="ap-card-title">📝 Recent Activity</div>
              <div className="ap-card-sub">Last {recent?.length || 0}</div>
            </div>
            {recent?.length ? (
              <div className="ap-list">
                {recent.map((r, i) => (
                  <div key={`${r.tab}-${i}`} className="ap-list-row" onClick={() => onOpenTool?.(r.tab)}>
                    <div className="ap-list-title">{`${iconForTab(r.tab)} ${r.name || formatTab(r.tab)}`}</div>
                    <div className="ap-list-sub">{new Date(r.created_at).toLocaleString()}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ap-empty">No recent activity.</div>
            )}
          </div>
        )}

        {/* Favourites — hidden by default */}
        {showFavourites && (
          <div className="ap-card">
            <div className="ap-card-head">
              <div className="ap-card-title">⭐ Your Favourites</div>
              <div className="ap-card-sub">{favourites?.length || 0} starred</div>
            </div>
            {favourites?.length ? (
              <div className="ap-chip-grid">
                {favourites.map((f) => (
                  <button key={f.tab} className="ap-chip" onClick={() => onOpenTool?.(f.tab)}>
                    ⭐ {`${iconForTab(f.tab)} ${f.name || formatTab(f.tab)}`}
                  </button>
                ))}
              </div>
            ) : (
              <div className="ap-empty">No favourites yet.</div>
            )}
          </div>
        )}

        {/* Top Liked — My Suggestions */}
        <div className="ap-card">
          <div className="ap-card-head">
            <div className="ap-card-title">💡 Top Liked — My Suggestions</div>
            <div className="ap-card-sub">Per your Suggestion Box</div>
          </div>
          {topLikedMySuggestions?.length ? (
            <div className="ap-sug-list">
              {topLikedMySuggestions.map((s) => (
                <div key={s.id} className="ap-sug-item">
                  <div className="ap-sug-title">💡 {s.tool_idea}</div>
                  {!!s.note && <div className="ap-sug-note">{s.note}</div>}
                  <div className="ap-sug-meta">
                    <span className="ap-sug-like">❤️ {s.likes || 0}</span>
                    <span className="ap-sug-date">{new Date(s.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ap-empty">No suggestions or likes yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------ Pieces ------------------ */

function KPI({ icon, title, value, hint }) {
  return (
    <div className="ap-kpi">
      <div className="ap-kpi-head">
        <span className="ap-kpi-emoji" aria-hidden>{icon}</span>
        <span className="ap-kpi-title">{title}</span>
      </div>
      <div className="ap-kpi-value">{value}</div>
      <div className="ap-kpi-hint">{hint}</div>
    </div>
  );
}

function BarRow({ label, value, max, onClick }) {
  const pct = Math.round((value / Math.max(1, max)) * 100);
  return (
    <div className="ap-bar-row" onClick={onClick}>
      <div className="ap-bar-label" title={label}>{label}</div>
      <div className="ap-bar">
        <div className="ap-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="ap-bar-val">{value}</div>
    </div>
  );
}

function Sparkline({ data = [] }) {
  const W = 520, H = 110, P = 8;
  const max = Math.max(1, ...data.map(d => d.count || 0));
  const step = (W - 2*P) / Math.max(1, data.length - 1);
  const points = data.map((d, i) => {
    const x = P + i * step;
    const y = H - P - ((d.count || 0) / max) * (H - 2*P);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className="ap-spark">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <polyline fill="none" stroke="rgba(148,163,184,.35)" strokeWidth="2"
          points={`${P},${H-P} ${W-P},${H-P}`} />
        <polyline fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          points={points} />
        {data.map((d, i) => {
          const x = P + i * step;
          const y = H - P - ((d.count || 0) / max) * (H - 2*P);
          return <circle key={d.key} cx={x} cy={y} r="2.8" fill="#3b82f6" />;
        })}
      </svg>
      <div className="ap-spark-x">
        <span>{formatDateLabel(data[0]?.date)}</span>
        <span>{formatDateLabel(data[data.length-1]?.date)}</span>
      </div>
    </div>
  );
}

function CategoryCard({ categoryData }) {
  const total = Object.values(categoryData).reduce((a, b) => a + b, 0);
  const entries = Object.entries(categoryData).sort((a, b) => b[1] - a[1]);

  let acc = 0;
  const stops = entries.map(([k, v]) => {
    const start = (acc / Math.max(1, total)) * 360;
    acc += v;
    const end = (acc / Math.max(1, total)) * 360;
    const color = CAT_COLORS[k] || "#94a3b8";
    return `${color} ${start}deg ${end}deg`;
  });

  return (
    <div className="ap-card">
      <div className="ap-card-head">
        <div className="ap-card-title">🍩 Category Distribution</div>
        <div className="ap-card-sub">Based on total usage</div>
      </div>

      {total ? (
        <div className="ap-cat-wrap">
          <div className="ap-donut" style={{ background: `conic-gradient(${stops.join(",")})` }}>
            <div className="ap-donut-hole">
              <div className="ap-donut-text">📊 Usage</div>
            </div>
          </div>
          <div className="ap-cat-legend">
            {entries.map(([k, v]) => (
              <div key={k} className="ap-cat-row">
                <span className="ap-cat-dot" style={{ background: CAT_COLORS[k] || "#94a3b8" }} />
                <span className="ap-cat-name">{`${CAT_EMOJI[k] || "📦"} ${k}`}</span>
                <span className="ap-cat-val">
                  {v} ({Math.round((v / total) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="ap-empty">No data to show.</div>
      )}
    </div>
  );
}

/* ------------------ Helpers ------------------ */

function buildTrend(events = [], daysRange = 7) {
  const N = daysRange;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = [];
  const map = {};
  for (let i = N - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, date: d });
    map[key] = 0;
  }
  for (const ev of events) {
    if (!ev?.ts) continue;
    const d = new Date(ev.ts);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    if (key in map) map[key] += 1;
  }
  return days.map(({ key, date }) => ({ key, date, count: map[key] || 0 }));
}

function formatMs(ms) {
  if (!ms) return "—";
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
}
function formatTab(tab = "") {
  return tab
    .split("-")
    .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
    .join(" ");
}
function formatDateLabel(d) {
  if (!d) return "";
  const date = new Date(d);
  return `${date.getDate()}/${date.getMonth() + 1}`;
}

/* ---- Category mapping/colors (heuristic for your tabs) ---- */
const CAT_MAP = [
  { label: "PDF Tools", match: (t) => t.startsWith("pdf-") },
  { label: "Image Tools", match: (t) => t.startsWith("image-") },
  { label: "Document Tools", match: (t) => t.startsWith("word-") || t.startsWith("ppt-") },
  { label: "AI Tools", match: (t) => t.startsWith("meeting-") },
  { label: "QR Tools", match: (t) => t.startsWith("qr-") },
  { label: "Other", match: () => true }
];

const CAT_COLORS = {
  "PDF Tools": "#60a5fa",
  "Image Tools": "#34d399",
  "Document Tools": "#fbbf24",
  "AI Tools": "#a78bfa",
  "QR Tools": "#f43f5e",
  Other: "#94a3b8"
};

const CAT_EMOJI = {
  "PDF Tools": "🧾",
  "Image Tools": "🖼️",
  "Document Tools": "🗂️",
  "AI Tools": "🤖",
  "QR Tools": "🔳",
  Other: "📦"
};

function groupByCategory(usageCount = {}) {
  const buckets = {};
  for (const [tab, count] of Object.entries(usageCount || {})) {
    if (["dashboard", "tools-help", "analytics"].includes(tab)) continue; // exclude non-tools
    const cat = (CAT_MAP.find((c) => c.match(tab)) || CAT_MAP[CAT_MAP.length - 1]).label;
    buckets[cat] = (buckets[cat] || 0) + (count || 0);
  }
  return buckets;
}

/** Emoji mapping by tab/category for Most Used / Recent labels */
function iconForTab(tab = "") {
  // Specific overrides first
  if (tab === "pdf-lock") return "🔐";
  if (tab === "pdf-watermark") return "💧";
  if (tab === "pdf-page-number") return "📎";
  if (tab === "qr-generator") return "🔳";
  if (tab === "meeting-mom") return "🤖";

  // Category fallbacks
  if (tab.startsWith("pdf-")) return "📄";
  if (tab.startsWith("image-")) return "🖼️";
  if (tab.startsWith("word-") || tab.startsWith("ppt-")) return "📑";
  return "📦";
}