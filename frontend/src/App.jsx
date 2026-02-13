import React, { useState, useEffect } from "react";

import DashboardFolders from "./components/DashboardFolders";
import ImageToPdf from "./components/ImageToPdf";
import ImageCompressor from "./components/ImageCompressor";
import WordToPdf from "./components/WordToPdf";
import PdfToWord from "./components/PdfToWord";
import SettingsPanel from "./components/SettingsPanel";
import SettingsHelp from "./components/SettingsHelp";
import PdfToText from "./components/PdfToText";
import PdfMerger from "./components/PdfMerger";
import ImageFormatConverter from "./components/ImageFormatConverter";
import ImageToText from "./components/ImageToText";
import PdfSplitter from "./components/PdfSplitter";
import PdfToImage from "./components/PdfToImage";
import QrCodeGenerator from "./components/QrCodeGenerator";
import PdfWatermark from "./components/Pdfwatermark";
import PdfPageNumber from "./components/PdfPageNumber";
import PdfLock from "./components/PdfLock";
import MeetingMom from "./components/MeetingMom";
import PptToExcel from "./components/PptToExcel";

import AuthModal from "./components/AuthModal";
import { getUser, clearAuth } from "./api/auth";

import BottomFooterNav from "./components/BottomFooterNav";
import FeedbackModal from "./components/FeedbackModal";

import {
  fetchUserDashboardState,
  bumpUsage,
  addRecent,
  toggleFavouriteApi,
  clearRecent as clearRecentApi,
  clearUsage as clearUsageApi
} from "./api/userData";

import "./index.css";

const TOOL_META = {
  dashboard: { name: "Dashboard" },
  "image-to-pdf": { name: "Image to PDF" },
  "image-compressor": { name: "Image Compressor" },
  "image-format-converter": { name: "Image Format Converter" },
  "image-to-text": { name: "Image to Text (OCR)" },
  "word-to-pdf": { name: "Word to PDF" },
  "pdf-to-text": { name: "PDF to Text" },
  "pdf-merge": { name: "PDF Merger" },
  "pdf-to-word": { name: "PDF to Word" },
  "pdf-to-image": { name: "PDF to Image" },
  "pdf-split": { name: "PDF Split" },
  "pdf-watermark": { name: "PDF Watermark" },
  "pdf-page-number": { name: "PDF Page Number" },
  "pdf-lock": { name: "PDF Lock" },
  "qr-generator": { name: "QR Code Generator" },
  "ppt-to-excel": { name: "PPT to Excel"},
  "meeting-mom": { name: "Meeting MOM Generator" },
  "tools-help": { name: "Tools Help" }
};

function App() {
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState(() => getUser());

  const logout = () => {
    clearAuth();
    setUser(null); // user change triggers reset
  };

  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const [feedbackContext, setFeedbackContext] = useState({
    tab: "dashboard",
    name: "Dashboard"
  });

  const [theme, setTheme] = useState(() => localStorage.getItem("appTheme") || "light");

  // ✅ DB driven state (per-user)
  const [toolState, setToolState] = useState({
    recent: [],
    usageCount: {},
    favourites: []
  });

  // Theme persist only
  useEffect(() => {
    localStorage.setItem("appTheme", theme);
    document.body.className = theme === "dark" ? "dark-theme" : "";
  }, [theme]);

  // Load user dashboard state from DB after login / on refresh
  useEffect(() => {
    const run = async () => {
      if (!user) {
        setToolState({ recent: [], usageCount: {}, favourites: [] });
        return;
      }
      try {
        const state = await fetchUserDashboardState();
        setToolState({
          recent: state.recent,
          usageCount: state.usageCount,
          favourites: state.favourites
        });
      } catch (e) {
        console.error("Failed to load user dashboard state:", e);
      }
    };
    run();
  }, [user]);

  // Increment usage in UI + DB
  const openTool = (tab, nameFromCaller) => {
    setActiveTab(tab);
    if (tab === "dashboard") return;

    // Optimistic UI update
    setToolState((prev) => ({
      ...prev,
      usageCount: { ...prev.usageCount, [tab]: (prev.usageCount?.[tab] || 0) + 1 }
    }));

    // Persist to DB (only when logged in)
    if (user) {
      bumpUsage(tab).catch((e) => console.error("bumpUsage failed:", e));
    }
  };

  // Recent activity UI + DB
  const logRecentActivity = (tab, nameFromCaller) => {
    if (!tab || tab === "dashboard") return;
    const toolName = nameFromCaller || TOOL_META?.[tab]?.name || tab;

    // Optimistic UI update
    setToolState((prev) => {
      const prevRecent = Array.isArray(prev.recent) ? prev.recent : [];
      const filtered = prevRecent.filter((item) => item.tab !== tab);
      const updatedRecent = [{ tab, name: toolName }, ...filtered].slice(0, 5);
      return { ...prev, recent: updatedRecent };
    });

    // Persist
    if (user) {
      addRecent(tab, toolName).catch((e) => console.error("addRecent failed:", e));
    }
  };

  // Toggle favourites UI + DB
  const toggleFavourite = (app) => {
    // Optimistic UI update
    setToolState((prev) => {
      const favs = Array.isArray(prev.favourites) ? prev.favourites : [];
      const exists = favs.some((x) => x.tab === app.tab);
      const nextFavs = exists ? favs.filter((x) => x.tab !== app.tab) : [...favs, app];
      return { ...prev, favourites: nextFavs };
    });

    if (!user) return;

    // Persist + sync from server response (source of truth)
    toggleFavouriteApi(app)
      .then((serverFavs) => {
        setToolState((prev) => ({ ...prev, favourites: serverFavs }));
      })
      .catch((e) => console.error("toggleFavouriteApi failed:", e));
  };

  const clearRecent = () => {
    setToolState((prev) => ({ ...prev, recent: [] }));
    if (user) clearRecentApi().catch((e) => console.error("clearRecent failed:", e));
  };

  const clearFrequentlyUsed = () => {
    setToolState((prev) => ({ ...prev, usageCount: {} }));
    if (user) clearUsageApi().catch((e) => console.error("clearUsage failed:", e));
  };

  return (
    <div className={`app-container ${theme === "dark" ? "dark-theme" : ""}`}>
      <main className={`main-content ${activeTab === "dashboard" ? "has-topbar" : ""} has-footer`}>
        {activeTab === "dashboard" && (
          <DashboardFolders
            setActiveTab={openTool}
            recent={toolState.recent}
            usageCount={toolState.usageCount}
            favourites={toolState.favourites}
            onToggleFavourite={toggleFavourite}
            onClearRecent={clearRecent}
            onClearFrequentlyUsed={clearFrequentlyUsed}
            onLoginClick={() => setAuthOpen(true)}
            user={user}
            onLogout={logout}
          />
        )}

        {activeTab === "image-to-pdf" && <ImageToPdf setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "image-compressor" && <ImageCompressor setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "word-to-pdf" && <WordToPdf setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "pdf-to-word" && <PdfToWord setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "pdf-to-text" && <PdfToText setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "pdf-merge" && <PdfMerger setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "image-to-text" && <ImageToText setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "image-format-converter" && (
          <ImageFormatConverter setActiveTab={openTool} onSuccess={logRecentActivity} />
        )}
        {activeTab === "pdf-to-image" && <PdfToImage setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "pdf-split" && <PdfSplitter setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "qr-generator" && <QrCodeGenerator setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "pdf-watermark" && <PdfWatermark setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "pdf-page-number" && <PdfPageNumber setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "pdf-lock" && <PdfLock setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "meeting-mom" && <MeetingMom setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "ppt-to-excel" && <PptToExcel setActiveTab={openTool} onSuccess={logRecentActivity} />}

        {activeTab === "tools-help" && <SettingsHelp onBack={() => openTool("dashboard")} />}
      </main>

      <BottomFooterNav
        activeTab={activeTab}
        setActiveTab={openTool}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onFeedbackClick={() => {
          setFeedbackContext({
            tab: activeTab,
            name: TOOL_META?.[activeTab]?.name || activeTab
          });
          setIsFeedbackOpen(true);
        }}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
      />

      <FeedbackModal
        open={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        tools={TOOL_META}
        defaultToolTab={feedbackContext.tab}
      />

      <SettingsPanel
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        setActiveTab={setActiveTab}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={(u) => setUser(u)}
      />
    </div>
  );
}

export default App;
