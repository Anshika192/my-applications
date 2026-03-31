import React, { useState, useRef } from "react";

const ToolLayout = ({ 
  title, 
  description, 
  icon, 
  onBack, 
  children, 
  onSuccess, 
  toolKey, 
  onFileDrop,
  enableFileUpload = true
}) => {
   console.log("ToolLayout enableFileUpload:", enableFileUpload);

  const isDark = document.body.classList.contains("dark-theme");
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showToast, setShowToast] = useState(false);
  const [previewURL, setPreviewURL] = useState(null);
  const [previewType, setPreviewType] = useState("");   // 🔥 FIXED

  const fileInputRef = useRef(null);

  /* ------------------ Drag Events ------------------- */
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(e.type === "dragenter" || e.type === "dragover");
  };

  const handleDropEvent = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    handleFileSubmit(file);
  };

  /* ------------------ File Submit ------------------- */
  const handleFileSubmit = (file) => {
    if (!file) return;

    // 🔥 FIX — Detect file type directly
    setPreviewType(file.type);

    // Set preview
    const url = URL.createObjectURL(file);
    setPreviewURL(url);

    // Pass file to parent tool
    if (onFileDrop) onFileDrop(file);

    // Progress animation
    setProgress(5);
    let val = 5;
    const timer = setInterval(() => {
      val += 15;
      if (val >= 100) {
        val = 100;
        clearInterval(timer);
        setTimeout(() => setShowToast(true), 150);
        setTimeout(() => setShowToast(false), 1500);
      }
      setProgress(val);
    }, 150);
  };

  return (
    <div style={styles.container(isDark)}>
      
      {/* BACK BTN */}
      <button onClick={onBack} style={styles.backBtn(isDark)}>
        ← Back to Dashboard
      </button>

      {/* HEADER */}
      <div style={styles.headerRow}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {icon && (
            <img src={icon} alt="tool icon" style={styles.icon(isDark)} />
          )}

          <div>
            <h2 style={styles.title(isDark)}>{title}</h2>
            {description && <p style={styles.description(isDark)}>{description}</p>}
          </div>
        </div>

        {onSuccess && toolKey && (
          <button onClick={() => onSuccess(toolKey, title)} style={styles.doneBtn(isDark)}>
            ⭐ Mark Done
          </button>
        )}
      </div>

      {/* CARD */}
      <div style={styles.card(isDark)}>

        {/* 🔥 DRAG DROP ZONE */}
        {enableFileUpload && (
  <div
    onDragEnter={handleDrag}
    onDragLeave={handleDrag}
    onDragOver={handleDrag}
    onDrop={handleDropEvent}
    onClick={() => fileInputRef.current.click()}
    style={styles.dropzone(isDark, dragActive)}
  >
    <input
      type="file"
      hidden
      ref={fileInputRef}
      onChange={(e) => handleFileSubmit(e.target.files[0])}
    />

    <img
      src="/icons/upload.png"
      alt="Upload"
      style={{ width: 48, margin: "0 auto", display: "block", opacity: 0.85 }}
    />

    <p style={styles.dropText(isDark)}>
      <strong>Drag & Drop</strong> your file here
    </p>

    <p style={styles.subText(isDark)}>or click to browse</p>
  </div>
)}

        {/* 🔥 FIXED PREVIEW — Works for drag & drop + choose file */}
        {previewURL && (
          <div style={styles.previewBox}>
            {previewType === "application/pdf" ? (
              <iframe
                src={previewURL}
                title="PDF Preview"
                style={{ width: "100%", height: "350px", border: "none" }}
              ></iframe>
            ) : previewType.startsWith("image/") ? (
              <img
                src={previewURL}
                alt="preview"
                style={{ width: "100%", borderRadius: "12px" }}
              />
            ) : (
              <p>No preview available for this file type.</p>
            )}
          </div>
        )}

        {/* PROGRESS BAR */}
        {progress > 0 && progress < 100 && (
          <div style={styles.progressBarWrapper}>
            <div style={{ ...styles.progressBar, width: `${progress}%` }}></div>
          </div>
        )}

        {/* TOAST */}
        {showToast && <div style={styles.toast}>✅ File Loaded</div>}

        {/* TOOL CONTENT */}
        <div style={{ marginTop: 25 }}>{children}</div>
      </div>
    </div>
  );
};

/* ------------------ Styles ------------------ */
const styles = {
  container: (dark) => ({
    padding: "30px",
    maxWidth: "900px",
    margin: "0 auto",
    color: dark ? "#e5e7eb" : "#111827",
  }),

  backBtn: (dark) => ({
    marginBottom: "20px",
    padding: "10px 18px",
    borderRadius: "10px",
    background: dark
      ? "linear-gradient(135deg,#374151,#1f2937)"
      : "linear-gradient(135deg,#3b82f6,#60a5fa)",
    color: "#fff",
    border: "none",
    fontWeight: 600,
    cursor: "pointer",
  }),

  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  icon: (dark) => ({
    width: 40,
    height: 40,
    borderRadius: "10px",
    boxShadow: dark
      ? "0 2px 8px rgba(0,0,0,0.5)"
      : "0 2px 8px rgba(0,0,0,0.15)",
  }),

  title: (dark) => ({
    fontSize: "28px",
    fontWeight: "800",
    marginBottom: 6,
    color: dark ? "#f9fafb" : "#111827",
  }),

  description: (dark) => ({
    color: dark ? "#9ca3af" : "#4b5563",
    marginTop: 0,
    maxWidth: "600px",
  }),

  doneBtn: (dark) => ({
    padding: "10px 16px",
    background: dark
      ? "linear-gradient(135deg,#111827,#1f2937)"
      : "linear-gradient(135deg,#10b981,#34d399)",
    color: "#fff",
    borderRadius: "10px",
    border: "none",
    fontWeight: 700,
    cursor: "pointer",
  }),

  card: (dark) => ({
    background: dark ? "rgba(31,41,55,0.6)" : "rgba(255,255,255,0.9)",
    backdropFilter: "blur(12px)",
    borderRadius: "18px",
    padding: "30px",
    border: dark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e5e7eb",
    boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
  }),

  dropzone: (dark, active) => ({
    padding: "40px",
    borderRadius: "16px",
    border: active
      ? "2px dashed #3b82f6"
      : dark
      ? "2px dashed rgba(255,255,255,0.25)"
      : "2px dashed #cbd5e1",
    background: active
      ? "rgba(59,130,246,0.12)"
      : dark
      ? "rgba(255,255,255,0.05)"
      : "#f8fafc",
    textAlign: "center",
    cursor: "pointer",
    transition: "0.3s",
  }),

  dropText: (dark) => ({
    marginTop: 15,
    fontWeight: 700,
    color: dark ? "#f3f4f6" : "#1f2937",
  }),

  subText: (dark) => ({
    fontSize: "13px",
    color: dark ? "#9ca3af" : "#6b7280",
  }),

  previewBox: {
    marginTop: 20,
    padding: "10px",
    borderRadius: "12px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },

  progressBarWrapper: {
    marginTop: "20px",
    height: "8px",
    background: "#e5e7eb",
    borderRadius: "8px",
    overflow: "hidden",
  },

  progressBar: {
    height: "100%",
    background: "linear-gradient(90deg,#3b82f6,#6366f1)",
  },

  toast: {
    marginTop: "20px",
    padding: "12px",
    background: "#10b981",
    color: "white",
    textAlign: "center",
    borderRadius: "10px",
    fontWeight: 700,
  },
};

export default ToolLayout;
