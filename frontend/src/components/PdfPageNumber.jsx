import React, { useEffect, useRef, useState } from "react";
import { PDFDocument, rgb } from "pdf-lib";
import ToolLayout from "./ToolLayout";

const PdfPageNumber = ({ setActiveTab, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // ✅ NEW: history like QR generator
  const [history, setHistory] = useState([]);

  // ✅ prevent multiple recent logs quickly
  const lastSuccessRef = useRef(0);

  // ✅ prevent duplicate history spam
  const lastHistoryRef = useRef({ key: "", at: 0 });

  // Load history
  useEffect(() => {
    const saved =
      JSON.parse(localStorage.getItem("pdfPageNumberHistory")) || [];
    setHistory(saved);
  }, []);

  // Save history (keep last 10)
  const saveHistory = (data) => {
    const updated = [data, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem("pdfPageNumberHistory", JSON.stringify(updated));
  };

  const addPageNumbers = async () => {
    if (!file) {
      setMsg("Please upload a PDF file");
      return;
    }

    setLoading(true);
    setMsg("");

    try {
      const bytes = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(bytes);
      const pages = pdfDoc.getPages();

      pages.forEach((page, index) => {
        const { width } = page.getSize();
        page.drawText(`Page ${index + 1}`, {
          x: width / 2 - 30,
          y: 20,
          size: 12,
          color: rgb(0.2, 0.2, 0.2),
        });
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "page-numbered.pdf";
      a.click();

      // ✅ cleanup (avoid memory leak)
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setMsg("Page numbers added successfully ✅");

      // ✅ HISTORY: only after success download click
      const now = Date.now();
      const key = `${file.name}__page-number`;

      // avoid same entry spam within 1.2s
      if (
        key !== lastHistoryRef.current.key ||
        now - lastHistoryRef.current.at > 1200
      ) {
        saveHistory({
          fileName: file.name,
          time: new Date().toLocaleString(),
        });
        lastHistoryRef.current = { key, at: now };
      }

      // ✅ RECENT ACTIVITY: throttle like QR generator
      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("pdf-page-number", "PDF Page Number");
        lastSuccessRef.current = now;
      }
    } catch (e) {
      console.error(e);
      setMsg("Something went wrong ❌");
    }

    setLoading(false);
  };

  return (
    <ToolLayout
      title="PDF Page Number"
      description="Add page numbers to all pages of a PDF"
      onBack={() => setActiveTab("dashboard")}
    >
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        style={{ width: "100%", marginBottom: 15 }}
      />

      <button
        onClick={addPageNumbers}
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
        {loading ? "Processing..." : "Add Page Numbers"}
      </button>

      {msg && (
        <div style={{ marginTop: 15, fontSize: 14, color: "#166534" }}>
          {msg}
        </div>
      )}

      {/* ✅ NEW: History (minimal UI addition) */}
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
          <strong>Recent Page Number History</strong>
          <ul style={{ marginTop: 8 }}>
            {history.map((h, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <div>
                  <b>{h.fileName}</b>
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

export default PdfPageNumber;