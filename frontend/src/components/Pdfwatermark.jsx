import React, { useState, useEffect, useRef } from "react";
import { PDFDocument, rgb, degrees } from "pdf-lib";
import ToolLayout from "./ToolLayout";

const PdfWatermark = ({ setActiveTab, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // ✅ NEW: history like QR generator
  const [history, setHistory] = useState([]);

  // ✅ prevent multiple recent logs quickly (same as QR)
  const lastSuccessRef = useRef(0);

  // ✅ prevent duplicate history spam
  const lastHistoryRef = useRef({ key: "", at: 0 });

  // ✅ Load history on mount
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("pdfWatermarkHistory")) || [];
    setHistory(saved);
  }, []);

  // ✅ Save history (keep last 10)
  const saveHistory = (data) => {
    const updated = [data, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem("pdfWatermarkHistory", JSON.stringify(updated));
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMsg("");
  };

  const addWatermark = async () => {
    if (!file || !text) {
      setMsg("Please select PDF and enter watermark text");
      return;
    }

    setLoading(true);

    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const pages = pdfDoc.getPages();

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        page.drawText(text, {
          x: width / 4,
          y: height / 2,
          size: 40,
          rotate: degrees(-30),
          color: rgb(0.7, 0.7, 0.7),
          opacity: 0.3,
        });
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "watermarked.pdf";
      a.click();

      // ✅ cleanup
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setMsg("Watermark added successfully ✅");

      // ✅ HISTORY: only after success download click
      const now = Date.now();
      const key = `${file.name}__${text.trim()}`;

      // avoid same entry spam within 1.2s
      if (
        key !== lastHistoryRef.current.key ||
        now - lastHistoryRef.current.at > 1200
      ) {
        saveHistory({
          fileName: file.name,
          text: text.trim(),
          time: new Date().toLocaleString(),
        });
        lastHistoryRef.current = { key, at: now };
      }

      // ✅ RECENT ACTIVITY: throttle like QR generator
      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("pdf-watermark", "PDF Watermark");
        lastSuccessRef.current = now;
      }
    } catch (err) {
      console.error(err);
      setMsg("Something went wrong ❌");
    }

    setLoading(false);
  };

  return (
    <ToolLayout
      title="PDF Watermark"
      description="Add text watermark to all pages of a PDF"
      onBack={() => setActiveTab("dashboard")}
    >
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        style={{ width: "100%", marginBottom: 15 }}
      />

      <input
        type="text"
        placeholder="Enter watermark text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 15,
          borderRadius: 6,
          border: "1px solid #ccc",
        }}
      />

      <button
        onClick={addWatermark}
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
        {loading ? "Processing..." : "Add Watermark"}
      </button>

      {msg && (
        <div style={{ marginTop: 15, fontSize: 14, color: "#166534" }}>
          {msg}
        </div>
      )}

      {/* ✅ NEW: History (UI minimal, doesn't change existing controls) */}
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
          <strong>Recent Watermark History</strong>
          <ul style={{ marginTop: 8 }}>
            {history.map((h, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <div>
                  <b>{h.fileName}</b> — "{h.text}"
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

export default PdfWatermark;
