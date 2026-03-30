import React, { useRef, useState } from "react";
import { API_URL } from "../api";
import ToolLayout from "./ToolLayout";

const PdfMerger = ({ setActiveTab, onSuccess }) => {
  const [files, setFiles] = useState([]);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState("");

  // ✅ avoid multiple recent logs quickly
  const lastSuccessRef = useRef(0);

  const handleFileChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles((prevFiles) => [...prevFiles, ...selected]);
    setError("");
    e.target.value = null;
  };

  const mergePdfs = async () => {
    if (files.length < 2) {
      setError("Please select at least 2 PDF files");
      return;
    }

    setIsMerging(true);
    setError("");

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));

    try {
      const response = await fetch(`${API_URL}/convert/pdf-merge`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error("PDF merge failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "merged.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      // ✅ RECENT ACTIVITY: only after successful merge/download
      const now = Date.now();
      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("pdf-merge", "PDF Merger");
        lastSuccessRef.current = now;
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <ToolLayout
      title="PDF Merger"
      description="Merge multiple PDF files into one."
      onBack={() => setActiveTab("dashboard")}
    >
      {/* File Input */}
      <input
        type="file"
        accept="application/pdf"
        multiple
        onChange={handleFileChange}
        style={{ marginBottom: "20px", width: "100%" }}
      />

      {/* Merge Button */}
      <button
        onClick={mergePdfs}
        disabled={isMerging || files.length < 2}
        style={{
          padding: "10px 20px",
          backgroundColor: files.length >= 2 ? "#4a90e2" : "#9bbce0",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: files.length >= 2 ? "pointer" : "not-allowed",
          fontSize: "15px",
          width: "100%"
        }}
      >
        {isMerging ? "Merging PDFs..." : "Merge PDFs"}
      </button>

      {/* Error */}
      {error && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: "8px",
            fontSize: "14px"
          }}
        >
          {error}
        </div>
      )}

      {/* Selected Files Preview */}
      {files.length > 0 && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: "#fefce8",
            color: "#92400e",
            borderRadius: "8px",
            fontSize: "13px"
          }}
        >
          <strong>Selected Files:</strong>
          <ul style={{ marginTop: "10px" }}>
            {files.map((file, index) => (
              <li key={index}>{file.name}</li>
            ))}
          </ul>
        </div>
      )}
    </ToolLayout>
  );
};

export default PdfMerger;