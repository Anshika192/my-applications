import React, { useState, useRef, useEffect } from "react";

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
    setAdminClicks(prev => prev + 1);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setAdminClicks(0), 2000);
  };

  useEffect(() => {
    if (adminClicks >= 5) {
      setActiveTab("admin-login");
      setAdminClicks(0);
    }
  }, [adminClicks, setActiveTab]);

  return (
    <footer className="bottom-footer-container">
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

      <div
        className={`footer-copyright-bar ${theme === "dark" ? "dark" : ""}`}
        onClick={handleSecretClick}
      >
        © {new Date().getFullYear()} All rights reserved • Developed for TTL •
        Built by <span className="anshika-name">Anshika Pandey</span>
      </div>
    </footer>
  );
};

const FooterButton = ({ icon, label, onClick, active }) => (
  <button
    type="button"
    className={`footer-btn ${active ? "active" : ""}`}
    onClick={onClick}
  >
    <span className="footer-icon">{icon}</span>
    <span className="footer-label">{label}</span>
  </button>
);

export default BottomFooterNav;