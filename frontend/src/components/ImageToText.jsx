import React, { useRef, useState } from "react";
import ToolLayout from "./ToolLayout";

const ImageToText = ({ setActiveTab, onSuccess }) => {
  const [image, setImage] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ prevent multiple recent logs quickly
  const lastSuccessRef = useRef(0);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      setError("Please upload a valid image");
      return;
    }
    setImage(file);
    setError("");
    setText("");
  };

  const extractText = async () => {
    if (!image) {
      setError("Please upload an image first");
      return;
    }

    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", image);

    try {
      const response = await fetch("http://127.0.0.1:8000/convert/image-to-text", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Server error");

      const data = await response.json();
      const extracted = data.text || "No text detected";
      setText(extracted);

      // ✅ RECENT ACTIVITY: only when OCR succeeds and text is set
      const now = Date.now();
      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("image-to-text", "Image to Text (OCR)");
        lastSuccessRef.current = now;
      }
    } catch (err) {
      setError("Backend not reachable (OCR runs on server due to system restrictions)");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Image To Text"
      description="Extract text from an image using OCR."
      onBack={() => setActiveTab("dashboard")}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ marginBottom: "20px", width: "100%" }}
      />

      <button
        onClick={extractText}
        disabled={!image || loading}
        style={{
          padding: "10px 20px",
          backgroundColor: image ? "#4a90e2" : "#9bbce0",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: image ? "pointer" : "not-allowed",
          fontSize: "15px",
          width: "100%",
        }}
      >
        {loading ? "Extracting text..." : "Extract Text"}
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

      {text && (
        <textarea
          value={text}
          readOnly
          rows={10}
          style={{
            width: "100%",
            marginTop: "20px",
            padding: "12px",
            borderRadius: "8px",
            fontSize: "14px",
            border: "1px solid #ccc",
            background: "#fff",
          }}
        />
      )}
    </ToolLayout>
  );
};

export default ImageToText;