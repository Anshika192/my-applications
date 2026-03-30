import React, { useEffect, useRef, useState } from "react";
import ToolLayout from "./ToolLayout";

const API_BASE = "http://127.0.0.1:8000"; // backend base

/**
 * PPT to Excel
 * - UI aligned with PdfWatermark component
 * - Local history (last 10) like Watermark
 * - onSuccess throttle for Recent Activity logging
 */
const PptToExcel = ({ setActiveTab, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(""); // success / error message (same as PdfWatermark)

  // ✅ NEW: local history (like watermark's history)
  const [history, setHistory] = useState([]);

  // ✅ throttle recent activity logging (like PdfWatermark)
  const lastSuccessRef = useRef(0);

  // ✅ prevent duplicate history spam within a short window
  const lastHistoryRef = useRef({ key: "", at: 0 });

  // ✅ Load history on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("pptToExcelHistory")) || [];
      setHistory(Array.isArray(saved) ? saved : []);
    } catch {
      setHistory([]);
    }
  }, []);

  // ✅ Save history (keep last 10)
  const saveHistory = (data) => {
    const updated = [data, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem("pptToExcelHistory", JSON.stringify(updated));
  };

  const handleFileChange = (e) => {
    setMsg("");
    const f = e.target.files?.[0];
    if (!f) return;

    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".ppt") && !lower.endsWith(".pptx")) {
      setMsg("Please upload a valid PPT or PPTX file ❌");
      return;
    }
    setFile(f);
  };

  const handleConvert = async () => {
    if (!file) {
      setMsg("Please select a PPT/PPTX file first ❌");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/convert/ppt-to-excel`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        // Try to parse error payload
        let detail = "Conversion failed";
        try {
          const data = await res.json();
          detail = data?.detail || data?.message || detail;
        } catch {}
        throw new Error(detail);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "ppt_content.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();

      // cleanup URL
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      setMsg("PPT converted to Excel successfully ✅");

      // ✅ HISTORY (same pattern as PdfWatermark)
      const now = Date.now();
      const key = `${file.name}`;

      if (key !== lastHistoryRef.current.key || now - lastHistoryRef.current.at > 1200) {
        saveHistory({
          fileName: file.name,
          output: "ppt_content.xlsx",
          time: new Date().toLocaleString(),
        });
        lastHistoryRef.current = { key, at: now };
      }

      // ✅ RECENT ACTIVITY (throttle like PdfWatermark)
      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("ppt-to-excel", "PPT to Excel");
        lastSuccessRef.current = now;
      }

      // Reset file after success
      setFile(null);
    } catch (err) {
      setMsg((err && err.message) || "Something went wrong ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolLayout
      title="PPT to Excel"
      description="Convert PowerPoint slides into an Excel sheet"
      onBack={() => setActiveTab("dashboard")}
    >
      {/* File input */}
      <input
        type="file"
        accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
        onChange={handleFileChange}
        style={{ width: "100%", marginBottom: 15 }}
      />

      {/* Action button */}
      <button
        onClick={handleConvert}
        disabled={loading}
        style={{
          width: "100%",
          padding: 12,
          background: "#4a90e2",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
        }}
      >
        {loading ? "Processing..." : "Convert to Excel"}
      </button>

      {/* Message area (same style token as PdfWatermark) */}
      {!!msg && (
        <div
          style={{
            marginTop: 15,
            fontSize: 14,
            color: msg.includes("✅") ? "#166534" : "#b91c1c",
          }}
        >
          {msg}
        </div>
      )}

      {/* ✅ NEW: History (same layout vibe as PdfWatermark) */}
      {history.length > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            background: "#f8fafc",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <strong>Recent PPT → Excel History</strong>
          <ul style={{ marginTop: 8 }}>
            {history.map((h, i) => (
              <li key={`${h.fileName}-${i}`} style={{ marginBottom: 6 }}>
                <div>
                  <b>{h.fileName}</b> → <span>{h.output}</span>
                </div>
                <div style={{ opacity: 0.7 }}>{h.time}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ToolLayout>
  );
};

export default PptToExcel;