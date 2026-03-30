import React, { useState, useEffect } from "react";

// Existing Imports...
import AnalyticsPage from "./components/AnalyticsPage";
import DashboardFolders from "./components/DashboardFolders";
// ... (baaki saare tool imports same rahenge)

// NEW: Admin Portal Imports
import AdminLogin from "./admin_portal/pages/AdminLogin";
import AdminDashboard from "./admin_portal/pages/AdminDashboard";

import AuthModal from "./components/AuthModal";
import { getUser, clearAuth } from "./api/auth";
import BottomFooterNav from "./components/BottomFooterNav";
import FeedbackModal from "./components/FeedbackModal";
// App.jsx ke top par ye imports check karein:

import SettingsPanel from "./components/SettingsPanel"; // <--- Ye line missing hai
import ToolsHelp from "./components/ToolsHelp";
import AboutUs from "./components/AboutUs";
import FAQ from "./components/FAQ";

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

import {
  fetchUserDashboardState,
  bumpUsage,
  addRecent,
  toggleFavouriteApi,
  clearRecent as clearRecentApi,
  clearUsage as clearUsageApi
} from "./api/userData";

import "./index.css";

/* ----------------------------- Meta & Analytics ----------------------------- */

const TOOL_META = {
  dashboard: { name: "Dashboard" },
  // ... (aapke purane meta tags)
  "admin-login": { name: "Admin Login" },
  "admin-dashboard": { name: "Admin Control Center" }
};

/** Only treat these tabs as “tools” for usage & event logging. */
function isRealToolTab(tab) {
  if (!tab) return false;
  const exclude = new Set(["dashboard", "tools-help", "analytics", "admin-login", "admin-dashboard"]);
  return TOOL_META[tab] && !exclude.has(tab);
}

const ANALYTICS_EVENTS_KEY = "analytics_events_v1";

/** Write a light-weight “open” event to localStorage for trend charts (7/30D). */
function logAnalyticsEvent(tab) {
  try {
    const now = Date.now();
    const item = { tab, ts: now };
    const raw = localStorage.getItem(ANALYTICS_EVENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    list.unshift(item);
    localStorage.setItem(ANALYTICS_EVENTS_KEY, JSON.stringify(list.slice(0, 500))); // cap length
  } catch (_) {
    // ignore
  }
}

function App() {
  const [authOpen, setAuthOpen] = useState(false);
  const [user, setUser] = useState(() => getUser());

  // Logout function
  const logout = () => {
    clearAuth();
    setUser(null);
    // Agar admin logout kar raha hai toh dashboard par bhej de
    if(activeTab === "admin-dashboard") setActiveTab("dashboard");
  };

  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const [feedbackContext, setFeedbackContext] = useState({
    tab: "dashboard",
    name: "Dashboard"
  });

  const [theme, setTheme] = useState(() => localStorage.getItem("appTheme") || "light");

  const [toolState, setToolState] = useState({
    recent: [],
    usageCount: {},
    favourites: []
  });

  // Theme persist
  useEffect(() => {
    localStorage.setItem("appTheme", theme);
    document.body.className = theme === "dark" ? "dark-theme" : "";
  }, [theme]);

  // Load user dashboard state
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

  // Helpers
  const openTool = (tab, nameFromCaller) => {
    setTimeout(() => {
            setActiveTab(tab);
    if (!isRealToolTab(tab)) return;
    logAnalyticsEvent(tab);
    setToolState((prev) => ({
      ...prev,
      usageCount: { ...prev.usageCount, [tab]: (prev.usageCount?.[tab] || 0) + 1 }
    }));
    if (user) bumpUsage(tab).catch((e) => console.error("bumpUsage failed:", e));
    }) 
  };

  // --- Ye functions missing hain, inhe add karein ---

  const logRecentActivity = (tab, nameFromCaller) => {
    if (!tab || tab === "dashboard") return;
    const toolName = nameFromCaller || TOOL_META?.[tab]?.name || tab;

    setToolState((prev) => {
      const prevRecent = Array.isArray(prev.recent) ? prev.recent : [];
      const filtered = prevRecent.filter((item) => item.tab !== tab);
      const updatedRecent = [{ tab, name: toolName }, ...filtered].slice(0, 5);
      return { ...prev, recent: updatedRecent };
    });

    if (user) {
      addRecent(tab, toolName).catch((e) => console.error("addRecent failed:", e));
    }
  };

  const toggleFavourite = (app) => {
    setToolState((prev) => {
      const favs = Array.isArray(prev.favourites) ? prev.favourites : [];
      const exists = favs.some((x) => x.tab === app.tab);
      const nextFavs = exists ? favs.filter((x) => x.tab !== app.tab) : [...favs, app];
      return { ...prev, favourites: nextFavs };
    });

    if (!user) return;

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

  // --- Ab aapka return statement shuru hoga ---

  return (
    <div className={`app-container ${theme === "dark" ? "dark-theme" : ""}`}>
      {/* Hide Footer if Admin is logged in or on Login page for clean UI */}
      <main className={`main-content ${activeTab === "dashboard" ? "has-topbar" : ""} ${activeTab.includes('admin') ? "" : "has-footer"}`}>
        
        {/* User Facing Dashboard */}
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

        {/* --- ADMIN ROUTES --- */}
        {activeTab === "admin-login" && (
          <AdminLogin onLoginSuccess={() => setActiveTab("admin-dashboard")} />
        )}
        
        {activeTab === "admin-dashboard" && (
          <AdminDashboard onLogout={() => setActiveTab("dashboard")} />
        )}

        {/* --- EXISTING TOOLS --- */}
        {activeTab === "analytics" && (
          <AnalyticsPage
            usageCount={toolState.usageCount}
            recent={toolState.recent}
            favourites={toolState.favourites}
            onBack={() => setActiveTab("dashboard")}
            onOpenTool={(tab) => setActiveTab(tab)}
          />
        )}

        {/* --- EXISTING TOOLS --- */}
{activeTab === "image-to-pdf" && <ImageToPdf setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "image-compressor" && <ImageCompressor setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "word-to-pdf" && <WordToPdf setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "pdf-to-word" && <PdfToWord setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "pdf-to-text" && <PdfToText setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "pdf-merge" && <PdfMerger setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "image-to-text" && <ImageToText setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "image-format-converter" && <ImageFormatConverter setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "pdf-to-image" && <PdfToImage setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "pdf-split" && <PdfSplitter setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "qr-generator" && <QrCodeGenerator setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "pdf-watermark" && <PdfWatermark setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "pdf-page-number" && <PdfPageNumber setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "pdf-lock" && <PdfLock setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "meeting-mom" && <MeetingMom setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "ppt-to-excel" && <PptToExcel setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "pdf-toolkit" && ( <PDFToolkit setActiveTab={openTool} onSuccess={logRecentActivity} />)}      
{activeTab === "image-toolkit" && <ImageToolkit setActiveTab={openTool} onSuccess={logRecentActivity} />}      
{activeTab === "bg-remover" && (<BackgroundRemover setActiveTab={openTool} onSuccess={logRecentActivity} />)}    
{activeTab === "tools-help" && <ToolsHelp setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "about" && <AboutUs setActiveTab={openTool} onSuccess={logRecentActivity} />}
{activeTab === "faq" && <FAQ setActiveTab={openTool} onSuccess={logRecentActivity} />}
</main>
      {/* Footer hide karein jab Admin Dashboard khula ho */}
      {!activeTab.includes('admin') && (
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
      )}

      {/* Modals */}
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