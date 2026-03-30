import React, { useState, useRef } from "react";

const BottomFooterNav = ({
  activeTab,
  setActiveTab,
  onSettingsClick,
  onFeedbackClick,
  theme,
  onToggleTheme
}) => {
  const [adminClicks, setAdminClicks] = useState(0);
  const timerRef = useRef(null);

  const handleSecretClick = () => {
    setAdminClicks((prev) => {
      const next = prev + 1;
      if (next >= 5) {
        setActiveTab("admin-login");
        return 0;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setAdminClicks(0), 2000);
      return next;
    });
  };

  return (
    <footer className="bottom-footer-container">
      
      {/* MAIN NAV */}
      <div className="bottom-footer-main">
        <FooterButton
          active={activeTab === "dashboard"}
          onClick={() => setActiveTab("dashboard")}
          icon="🏠"
          label="Home"
        />

        <FooterButton
          onClick={onFeedbackClick}
          icon="📝"
          label="Feedback"
        />

        <FooterButton
          onClick={onToggleTheme}
          icon={theme === "dark" ? "🌙" : "☀️"}
          label={theme === "dark" ? "Dark" : "Light"}
        />

        <FooterButton
          onClick={onSettingsClick}
          icon="⚙️"
          label="Settings"
        />
      </div>

      {/* COPYRIGHT BAR */}
      <div
        className={`footer-copyright-bar ${
          theme === "dark" ? "dark" : ""
        }`}
        onClick={handleSecretClick}
        title="© Information"
      >
        © {new Date().getFullYear()} All rights reserved.
        <span className="footer-sep"> • </span>
        Developed for TTL
        <span className="footer-sep"> • </span>
        Built by <span className="anshika-name">Anshika Pandey</span>

        {adminClicks > 0 && (
          <span className="admin-indicator"> • </span>
        )}
      </div>
    </footer>
  );
};

/* ---------------- SMALL HELPER ---------------- */

const FooterButton = ({ icon, label, onClick, active }) => {
  return (
    <button
      type="button"
      className={`footer-btn ${active ? "active" : ""}`}
      onClick={onClick}
    >
      <span className="footer-icon">{icon}</span>
      <span className="footer-label">{label}</span>
    </button>
  );
};

export default BottomFooterNav;