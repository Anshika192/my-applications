import React from "react";

const BottomFooterNav = ({
  activeTab,
  setActiveTab,
  onSettingsClick,
  onFeedbackClick,
  theme,
  onToggleTheme
}) => {
  return (
    <footer className="bottom-footer">
      <button
        className={`footer-btn ${activeTab === "dashboard" ? "active" : ""}`}
        onClick={() => setActiveTab("dashboard")}
        title="Home"
      >
        🏠
        <span>Home</span>
      </button>

      <button className="footer-btn" onClick={onFeedbackClick} title="Feedback">
        📝
        <span>Feedback</span>
      </button>

      {/* ✅ Theme toggle moved here */}
      <button className="footer-btn" onClick={onToggleTheme} title="Toggle Theme">
        {theme === "dark" ? "🌙" : "☀️"}
        <span>{theme === "dark" ? "Dark" : "Light"}</span>
      </button>

      <button className="footer-btn" onClick={onSettingsClick} title="Settings">
        ⚙️
        <span>Settings</span>
      </button>
    </footer>
  );
};

export default BottomFooterNav;