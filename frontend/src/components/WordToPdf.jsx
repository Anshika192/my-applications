import React, { useRef, useState } from "react";
import { saveAs } from "file-saver";
import { API_URL } from "../api";
import ToolLayout from "./ToolLayout";

const WordToPdf = ({ setActiveTab, onSuccess }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // ✅ prevent multiple recent logs quickly
  const lastSuccessRef = useRef(0);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setStatusMessage("");
    }
  };

  const convertToPdf = async () => {
    if (!selectedFile) return;

    setIsConverting(true);
    setStatusMessage("Uploading and converting...");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_URL}/convert/word-to-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Conversion failed");
      }

      const blob = await response.blob();
      saveAs(blob, selectedFile.name.replace(".docx", ".pdf"));

      setStatusMessage(`Converted ${selectedFile.name} successfully!`);

      // ✅ RECENT ACTIVITY: only after successful conversion + download
      const now = Date.now();
      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("word-to-pdf", "Word to PDF");
        lastSuccessRef.current = now;
      }
    } catch (error) {
      console.error("Error converting Word to PDF:", error);
      setStatusMessage("Error: " + error.message);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <ToolLayout
      title="Word to PDF"
      description="Convert a Word (.docx) file into PDF."
      onBack={() => setActiveTab("dashboard")}
    >
      <input
        type="file"
        accept=".docx"
        onChange={handleFileChange}
        style={{ marginBottom: "20px", width: "100%" }}
      />

      <button
        onClick={convertToPdf}
        disabled={!selectedFile || isConverting}
        style={{
          padding: "10px 20px",
          backgroundColor: selectedFile ? "#4a90e2" : "#9bbce0",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: selectedFile ? "pointer" : "not-allowed",
          fontSize: "15px",
          width: "100%",
        }}
      >
        {isConverting ? "Converting..." : "Convert to PDF"}
      </button>

      {statusMessage && (
        <div
          style={{
            marginTop: "20px",
            padding: "15px",
            background: statusMessage.startsWith("Error") ? "#fee2e2" : "#dcfce7",
            color: statusMessage.startsWith("Error") ? "#991b1b" : "#166534",
            borderRadius: "8px",
            fontSize: "14px",
          }}
        >
          {statusMessage}
        </div>
      )}
    </ToolLayout>
  );
};

export default WordToPdf;
``