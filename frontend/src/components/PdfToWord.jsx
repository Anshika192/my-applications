import React, { useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { saveAs } from "file-saver";
import ToolLayout from "./ToolLayout";
import { API_URL } from "../api";

// Set worker source
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const PdfToWord = ({ setActiveTab, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // ✅ prevent double recent logging if user clicks multiple times quickly
  const lastSuccessRef = useRef(0);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setStatusMessage("");
    }
  };

  const convertToWord = async () => {
    if (!selectedFile) return;

    setIsConverting(true);
    setStatusMessage("Uploading and converting...");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_URL}/convert/pdf-to-word`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Conversion failed");
      }

      const blob = await response.blob();
      saveAs(blob, selectedFile.name.replace(".pdf", ".docx"));

      setStatusMessage(`Converted ${selectedFile.name} successfully!`);

      // ✅ RECENT ACTIVITY: only on successful conversion
      const now = Date.now();
      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("pdf-to-word", "PDF to Word");
        lastSuccessRef.current = now;
      }
    } catch (error) {
      console.error("Error converting PDF to Word:", error);
      setStatusMessage("Error: " + error.message);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <ToolLayout
      title="PDF to Word"
      description="Convert PDF into a Word document."
      onBack={() => setActiveTab("dashboard")}
    >
      <input
        type="file"
        accept=".pdf"
        onChange={handleFileChange}
        style={{ marginBottom: "20px", width: "100%" }}
      />

      <button
        onClick={convertToWord}
        disabled={!selectedFile || isConverting}
        style={{
          padding: "10px 20px",
          backgroundColor: selectedFile ? "#4a90e2" : "#9bbce0",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: selectedFile ? "pointer" : "not-allowed",
          fontSize: "15px",
          width: "100%"
        }}
      >
        {isConverting ? "Converting..." : "Convert to Word"}
      </button>

      {statusMessage && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: statusMessage.startsWith("Error") ? "#fee2e2" : "#dcfce7",
            color: statusMessage.startsWith("Error") ? "#991b1b" : "#166534",
            borderRadius: "8px",
            fontSize: "14px"
          }}
        >
          {statusMessage}
        </div>
      )}
    </ToolLayout>
  );
};

export default PdfToWord;