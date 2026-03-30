import React, { useState } from "react";
import ToolLayout from "./ToolLayout";

export default function BackgroundRemover({ setActiveTab }) {
  const [file, setFile] = useState(null);
  const [downloadURL, setDownloadURL] = useState("");
  const [loading, setLoading] = useState(false); // ✅ ADD THIS

  const run = async () => {
    if (!file) return;

    setLoading(true); // ✅ START LOADING

    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("http://127.0.0.1:8000/image/bg-remove", {
        method: "POST",
        body: form
      });

      const result = await res.json();

      if (result.image) {
        const bytes = new Uint8Array(
          result.image.match(/.{1,2}/g).map((x) => parseInt(x, 16))
        );
        const blob = new Blob([bytes], { type: "image/png" });
        setDownloadURL(URL.createObjectURL(blob));
      }
    } finally {
      setLoading(false); // ✅ STOP LOADING
    }
  };

  return (
    <ToolLayout
      title="Background Remover"
      description="Remove image background and download transparent PNG"
      onBack={() => setActiveTab("dashboard")}
      onFileDrop={(f) => {
        setFile(f);
        setDownloadURL("");
      }}
    >
      <button
        className="tool-btn-accent"
        onClick={run}
        disabled={!file || loading}   // ✅ DISABLED STATE
      >
        {loading && <span className="btn-spinner" />}
        {loading ? "Removing..." : "Remove Background"}
      </button>

      {/* DOWNLOAD */}
      {downloadURL && (
        <div style={{ marginTop: 20 }}>
          <a href={downloadURL} download="background_removed.png">
            Download Image
          </a>
        </div>
      )}
    </ToolLayout>
  );
}
