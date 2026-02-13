import React from "react";

const ToolLayout = ({ title, description, onBack, children, onSuccess, toolKey }) => {
  return (
    <div style={{ padding: "20px", color: "#222" }}>
      <button
        onClick={onBack}
        style={{
          marginBottom: "20px",
          padding: "10px 16px",
          cursor: "pointer",
          borderRadius: "6px",
          border: "1px solid #999",
          background: "#72aef3ff",
          fontSize: "14px",
        }}
      >
        ← Back to Dashboard
      </button>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h2 style={{ marginBottom: "10px" }}>{title}</h2>
          {description && (
            <p style={{ color: "#555", marginBottom: "20px" }}>
              {description}
            </p>
          )}
        </div>

        {/* ✅ Only logs recent when user clicks DONE */}
        {onSuccess && toolKey && (
          <button
            onClick={() => onSuccess(toolKey, title)}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "none",
              background: "#111827",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 700,
              whiteSpace: "nowrap"
            }}
            title="After completing this tool, click to save in Recent Activity"
          >
            ✅ Mark Done
          </button>
        )}
      </div>

      {/* Card */}
      <div
        style={{
          background: "#f9fafb",
          padding: "30px",
          borderRadius: "14px",
          maxWidth: "600px",
          margin: "0 auto",
          boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
          border: "1px solid #e5e7eb",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default ToolLayout;