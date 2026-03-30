import React, { useRef, useState } from "react";
import ToolLayout from "./ToolLayout";

const PdfSplitter = ({ setActiveTab, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lastSuccessRef = useRef(0);

  const splitPdf = async () => {
    if (!file || !pages) {
      setError("Please upload PDF and enter page numbers");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("pages", pages);

    try {
      const res = await fetch("http://127.0.0.1:8000/convert/pdf-split", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Split failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "split.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      // ✅ RECENT ACTIVITY: only after successful split/download
      const now = Date.now();
      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("pdf-split", "PDF Split");
        lastSuccessRef.current = now;
      }
    } catch (err) {
      setError("Backend not reachable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolLayout
      title="PDF Splitter"
      description="Split a PDF by page ranges (e.g. 1-3,5)."
      onBack={() => setActiveTab("dashboard")}
    >
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files[0])}
        style={{ marginBottom: "15px", width: "100%" }}
      />

      <input
        type="text"
        placeholder="Pages (e.g. 1-3,5)"
        value={pages}
        onChange={(e) => setPages(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "20px",
          borderRadius: "6px",
          border: "1px solid #ccc",
        }}
      />

      <button
        onClick={splitPdf}
        disabled={loading}
        style={{
          padding: "10px 20px",
          backgroundColor: loading ? "#9bbce0" : "#4a90e2",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: loading ? "not-allowed" : "pointer",
          fontSize: "15px",
          width: "100%",
        }}
      >
        {loading ? "Splitting PDF..." : "Split PDF"}
      </button>

      {error && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: "8px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {file && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: "#fefce8",
            color: "#92400e",
            borderRadius: "8px",
            fontSize: "13px",
          }}
        >
          <strong>Selected File:</strong>
          <p>{file.name}</p>
        </div>
      )}
    </ToolLayout>
  );
};

export default PdfSplitter;