import React, { useRef, useState } from "react";
import { API_URL } from "../api";
import ToolLayout from "./ToolLayout";

const PdfToImage = ({ setActiveTab, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const lastSuccessRef = useRef(0);

  const convertPdf = async () => {
    if (!file) {
      setError("Please upload a PDF file");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_URL}/convert/pdf-to-image`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Conversion failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "pdf_images.zip";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      // ✅ RECENT ACTIVITY: only after successful zip download
      const now = Date.now();
      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("pdf-to-image", "PDF to Image");
        lastSuccessRef.current = now;
      }
    } catch {
      setError("Backend not reachable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolLayout
      title="PDF to Image"
      description="Convert each page of a PDF into images (ZIP)."
      onBack={() => setActiveTab("dashboard")}
    >
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files[0])}
        style={{ marginBottom: "20px", width: "100%" }}
      />

      <button
        onClick={convertPdf}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px",
          background: "#4a90e2",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Converting..." : "Convert to Images"}
      </button>

      {error && <div style={{ marginTop: "15px", color: "red" }}>{error}</div>}
    </ToolLayout>
  );
};

export default PdfToImage;