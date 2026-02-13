import React, { useRef, useState } from "react";
import { API_URL } from "../api";
import ToolLayout from "./ToolLayout";

const PdfToText = ({ setActiveTab, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState("");

  // ✅ prevent multiple recent logs quickly
  const lastSuccessRef = useRef(0);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setExtractedText("");
      setError("");
    }
  };

  const extractText = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setError("");
    setExtractedText("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_URL}/convert/pdf-to-text`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to extract text");
      }

      const data = await response.json();
      const text = data.text || "No text found in PDF";
      setExtractedText(text);

      // ✅ RECENT ACTIVITY: only after successful extraction
      const now = Date.now();
      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("pdf-to-text", "PDF to Text");
        lastSuccessRef.current = now;
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsExtracting(false);
    }
  };

  const downloadTxt = () => {
    if (!extractedText) return;

    const blob = new Blob([extractedText], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "extracted-text.txt";
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <ToolLayout
      title="PDF to Text"
      description="Extract selectable text from a PDF and download it as TXT."
      onBack={() => setActiveTab("dashboard")}
    >
      <input
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
        style={{ marginBottom: "20px", width: "100%" }}
      />

      <button
        onClick={extractText}
        disabled={!selectedFile || isExtracting}
        style={{
          padding: "10px",
          background: "#4a90e2",
          color: "#fff",
          border: "none",
          borderRadius: "6px",
          width: "100%",
        }}
      >
        {isExtracting ? "Extracting..." : "Extract Text"}
      </button>

      {extractedText && (
        <button
          onClick={downloadTxt}
          style={{
            marginTop: "15px",
            padding: "10px",
            background: "#16a34a",
            color: "white",
            border: "none",
            borderRadius: "6px",
            width: "100%",
            cursor: "pointer",
          }}
        >
          Download as TXT
        </button>
      )}

      {error && <div style={{ marginTop: "15px", color: "red" }}>{error}</div>}

      {extractedText && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: "#fefce8",
            borderRadius: "8px",
            maxHeight: "300px",
            overflowY: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {extractedText}
        </div>
      )}
    </ToolLayout>
  );
};

export default PdfToText;