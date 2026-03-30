
import React, { useState } from "react";

const SettingsPanel = ({ isOpen, onClose, theme, setTheme, setActiveTab }) => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const goTo = (tab) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <>
      {isOpen && <div className="settings-overlay" onClick={onClose}></div>}

      <div className={`settings-panel ${isOpen ? "open" : ""}`}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-content">

          {/* About Us */}
          <div className="settings-item" onClick={() => goTo("about")}>
            <span>ℹ️ About Us</span>
          </div>

          <div className="settings-divider"></div>

          {/* Help */}
          <div
            className="settings-item dropdown"
            onClick={() => setIsHelpOpen(!isHelpOpen)}
          >
            <span>❓ Help</span>
          </div>

          {isHelpOpen && (
            <div className="settings-submenu">
              <div className="settings-subitem" onClick={() => goTo("faq")}>
                📘 FAQ
              </div>
              <div className="settings-subitem" onClick={() => goTo("tools-help")}>
                🛠 Tools
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SettingsPanel;
