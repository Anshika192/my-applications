export default function InfoLayout({ title, subtitle, onBack, children }) {
  const isDark = document.body.classList.contains("dark-theme");

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={onBack}
          style={{
            padding: "6px 12px",
            borderRadius: 8,
            border: isDark ? "1px solid #374151" : "1px solid #d1d5db",
            background: isDark ? "#111827" : "#fff",
            color: isDark ? "#e5e7eb" : "#111827",
            cursor: "pointer"
          }}
        >
          ← Back to Dashboard
        </button>

        <h2 style={{ marginTop: 12, color: isDark ? "#f9fafb" : "#111827" }}>
          {title}
        </h2>

        {subtitle && (
          <p style={{ color: isDark ? "#9ca3af" : "#6b7280" }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Card */}
      <div
        style={{
          background: isDark ? "#111827" : "#ffffff",
          color: isDark ? "#e5e7eb" : "#111827",
          borderRadius: 16,
          padding: 24,
          border: isDark ? "1px solid #1f2937" : "1px solid #e5e7eb",
          boxShadow: isDark
            ? "0 10px 30px rgba(0,0,0,0.5)"
            : "0 10px 30px rgba(0,0,0,0.08)"
        }}
      >
        {children}
      </div>
    </div>
  );
}