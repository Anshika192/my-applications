import React, { useState } from "react";
import ToolLayout from "./ToolLayout";

export default function PDFToolkit({ setActiveTab }) {
  const [file, setFile] = useState(null);
  const [action, setAction] = useState("");
  const [pages, setPages] = useState("");
  const [password, setPassword] = useState("");
  const [rotate, setRotate] = useState("");
  const [downloadURL, setDownloadURL] = useState("");

  const run = async () => {
    if (!file || !action) {
      alert("Please upload a PDF and choose an action.");
      return;
    }

    const form = new FormData();
    form.append("file", file);
    form.append("action", action);
    if (pages) form.append("pages", pages);
    if (password) form.append("password", password);
    if (rotate) form.append("rotate", rotate);

    const res = await fetch("http://127.0.0.1:8000/pdf/toolkit", {
      method: "POST",
      body: form,
    });

    const data = await res.json();
    if (!data.pdf) {
      alert("Something went wrong.");
      return;
    }

    const bytes = new Uint8Array(data.pdf.match(/.{1,2}/g).map((x) => parseInt(x, 16)));
    const blob = new Blob([bytes], { type: "application/pdf" });
    setDownloadURL(URL.createObjectURL(blob));
  };

  return (
     <ToolLayout
  title="PDF to Text"
  description="Extract text from PDF"
  onBack={() => setActiveTab("dashboard")}
  acceptedTypes={["application/pdf", ".pdf"]}
  rejectMessage="❌ This tool accepts only PDF files."
>
      <div style={styles.wrapper}>
        <div style={styles.card}>

          {/* File Upload */}
          <label style={styles.label}>Upload PDF File</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files[0])}
            style={styles.input}
          />

          {/* Action Dropdown */}
          <label style={styles.label}>Choose Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            style={styles.select}
          >
            <option value="">Select Action</option>
            <option value="compress">Compress PDF</option>
            <option value="rotate">Rotate Pages</option>
            <option value="extract">Extract Pages</option>
            <option value="reorder">Reorder Pages</option>
            <option value="protect">Protect PDF (Password)</option>
            <option value="unlock">Unlock PDF</option>
            <option value="downscale">Reduce Resolution</option>
          </select>

          {/* Dynamic Inputs */}
          {action === "rotate" && (
            <>
              <label style={styles.label}>Rotation</label>
              <select style={styles.select} onChange={(e) => setRotate(e.target.value)}>
                <option value="">Choose rotation</option>
                <option value="90">90°</option>
                <option value="180">180°</option>
                <option value="270">270°</option>
              </select>
            </>
          )}

          {(action === "extract" || action === "reorder") && (
            <>
              <label style={styles.label}>Pages (comma separated)</label>
              <input
                placeholder="e.g., 1,3,5"
                style={styles.input}
                onChange={(e) => setPages(e.target.value)}
              />
            </>
          )}

          {(action === "protect" || action === "unlock") && (
            <>
              <label style={styles.label}>Password</label>
              <input
                placeholder="Enter password"
                style={styles.input}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}

          {/* RUN BUTTON */}
          <button style={styles.runBtn} onClick={run}>
            ⚙ Run Operation
          </button>

          {/* DOWNLOAD FILE */}
          {downloadURL && (
            <a href={downloadURL} download="output.pdf" style={styles.downloadBtn}>
              ⬇ Download Output PDF
            </a>
          )}
        </div>
      </div>
    </ToolLayout>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    justifyContent: "center",
    marginTop: "20px",
  },
  card: {
    background: "rgba(255,255,255,0.85)",
    backdropFilter: "blur(10px)",
    padding: "30px",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "600px",
    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
    transition: "0.2s",
  },
  label: {
    marginTop: "10px",
    fontWeight: "600",
    color: "#333",
    display: "block",
    marginBottom: "5px",
  },
  input: {
    width: "100%",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    marginBottom: "15px",
    background: "#fff",
  },
  select: {
    width: "100%",
    padding: "10px",
    borderRadius: "10px",
    border: "1px solid #d1d5db",
    marginBottom: "15px",
    background: "#f9fafb",
  },
  runBtn: {
    width: "100%",
    padding: "12px",
    background: "#2563eb",
    color: "white",
    fontWeight: "700",
    borderRadius: "10px",
    cursor: "pointer",
    border: "none",
    marginTop: "10px",
    transition: "0.2s",
  },
  downloadBtn: {
    marginTop: "20px",
    display: "block",
    textAlign: "center",
    padding: "12px",
    background: "#10b981",
    color: "white",
    borderRadius: "10px",
    fontWeight: "700",
    textDecoration: "none",
  },
};