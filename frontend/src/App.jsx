import React, { useState, useEffect } from "react";

/* -------------------- USER SIDE -------------------- */
import DashboardFolders from "./components/DashboardFolders";
import AnalyticsPage from "./components/AnalyticsPage";
import AuthModal from "./components/AuthModal";
import BottomFooterNav from "./components/BottomFooterNav";
import FeedbackModal from "./components/FeedbackModal";
import SettingsPanel from "./components/SettingsPanel";
import ToolsHelp from "./components/ToolsHelp";
import AboutUs from "./components/AboutUs";
import FAQ from "./components/FAQ";

/* -------------------- ADMIN SIDE -------------------- */
import AdminLogin from "./admin_portal/pages/AdminLogin";
import AdminDashboard from "./admin_portal/pages/AdminDashboard";

/* -------------------- TOOLS -------------------- */
import ImageToPdf from "./components/ImageToPdf";
import ImageCompressor from "./components/ImageCompressor";
import WordToPdf from "./components/WordToPdf";
import PdfToWord from "./components/PdfToWord";
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
import PDFToolkit from "./components/PDFToolkit";
import ImageToolkit from "./components/ImageToolkit";
import BackgroundRemover from "./components/BackgroundRemover";

/* -------------------- API -------------------- */
import { getUser, clearAuth } from "./api/auth";
import {
  fetchUserDashboardState,
  bumpUsage,
  addRecent,
  toggleFavouriteApi,
  clearRecent as clearRecentApi,
  clearUsage as clearUsageApi
} from "./api/userData";

import "./index.css";

/* -------------------- META -------------------- */
const TOOL_META = {
  dashboard: { name: "Dashboard" },
  analytics: { name: "Analytics" },
  "admin-login": { name: "Admin Login" },
  "admin-dashboard": { name: "Admin Dashboard" }
};

function isRealToolTab(tab) {
  const exclude = new Set([
    "dashboard",
    "analytics",
    "admin-login",
    "admin-dashboard",
    "tools-help",
    "about",
    "faq"
  ]);
  return tab && !exclude.has(tab);
}

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState(() => getUser());

  // ✅ READ ADMIN TOKEN SAFELY
  const adminToken = localStorage.getItem("admin_token");

  const logout = () => {
    clearAuth();
    localStorage.removeItem("admin_token");
    setUser(null);
    setActiveTab("dashboard");
  };

  const [theme, setTheme] = useState(
    () => localStorage.getItem("appTheme") || "light"
  );

  const [toolState, setToolState] = useState({
    recent: [],
    usageCount: {},
    favourites: []
  });

  /* -------------------- THEME -------------------- */
  useEffect(() => {
    localStorage.setItem("appTheme", theme);
    document.body.className = theme === "dark" ? "dark-theme" : "";
  }, [theme]);

  /* -------------------- USER DASHBOARD DATA -------------------- */
  useEffect(() => {
    const run = async () => {
      if (!user) {
        setToolState({ recent: [], usageCount: {}, favourites: [] });
        return;
      }
      try {
        const state = await fetchUserDashboardState();
        setToolState(state);
      } catch (e) {
        console.error("Dashboard load failed:", e);
      }
    };
    run();
  }, [user]);

  /* -------------------- TOOL HANDLERS -------------------- */
  const openTool = (tab) => {
    setActiveTab(tab);
    if (!isRealToolTab(tab) || !user) return;

    setToolState(prev => ({
      ...prev,
      usageCount: { ...prev.usageCount, [tab]: (prev.usageCount?.[tab] || 0) + 1 }
    }));

    bumpUsage(tab).catch(() => {});
  };

  const logRecentActivity = (tab, name) => {
    if (!tab || !user) return;
    addRecent(tab, name).catch(() => {});
  };

  const toggleFavourite = (app) => {
    if (!user) return;
    toggleFavouriteApi(app)
      .then(favs => setToolState(p => ({ ...p, favourites: favs })))
      .catch(() => {});
  };

  const clearRecent = () => {
    setToolState(p => ({ ...p, recent: [] }));
    clearRecentApi().catch(() => {});
  };

  const clearFrequentlyUsed = () => {
    setToolState(p => ({ ...p, usageCount: {} }));
    clearUsageApi().catch(() => {});
  };

  /* -------------------- RENDER -------------------- */
  return (
    <div className="app-container">
      <main className={`main-content ${activeTab === "dashboard" ? "has-topbar" : ""}`}>
        
        {/* ✅ USER DASHBOARD */}
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

        {/* ✅ ADMIN GUARDED ROUTES */}
        {activeTab === "admin-dashboard" && adminToken ? (
          <AdminDashboard onLogout={logout} />
        ) : activeTab === "admin-dashboard" ? (
          <AdminLogin onLoginSuccess={() => setActiveTab("admin-dashboard")} />
        ) : null}

        {/* ✅ ADMIN LOGIN */}
        {activeTab === "admin-login" && (
          <AdminLogin onLoginSuccess={() => setActiveTab("admin-dashboard")} />
        )}

        {/* ✅ ANALYTICS */}
        {activeTab === "analytics" && (
          <AnalyticsPage
            usageCount={toolState.usageCount}
            recent={toolState.recent}
            favourites={toolState.favourites}
            onBack={() => setActiveTab("dashboard")}
          />
        )}

        {/* ✅ TOOLS */}
        {activeTab === "image-to-pdf" && <ImageToPdf setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "pdf-to-text" && <PdfToText setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "pdf-merge" && <PdfMerger setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "pdf-to-word" && <PdfToWord setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "image-toolkit" && <ImageToolkit setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "bg-remover" && <BackgroundRemover setActiveTab={openTool} onSuccess={logRecentActivity} />}
        {activeTab === "tools-help" && <ToolsHelp />}
        {activeTab === "about" && <AboutUs />}
        {activeTab === "faq" && <FAQ />}
      </main>

      {/* ✅ FOOTER (HIDE FOR ADMIN) */}
      {!activeTab.includes("admin") && (
        <BottomFooterNav
          activeTab={activeTab}
          setActiveTab={openTool}
          theme={theme}
          onToggleTheme={() =>
            setTheme(t => (t === "dark" ? "light" : "dark"))
          }
        />
      )}

      {/* ✅ MODALS */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onAuthed={setUser} />
      <FeedbackModal />
      <SettingsPanel />
    </div>
  );
}

export default App;
