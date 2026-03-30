import React, { useRef, useState } from "react";
import ToolLayout from "./ToolLayout";

const ImageFormatConverter = ({ setActiveTab, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [format, setFormat] = useState("png");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  // ✅ prevent multiple recent logs quickly
  const lastSuccessRef = useRef(0);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    // cleanup old preview to avoid memory leak
    if (preview) URL.revokeObjectURL(preview);

    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError("");
  };

  const convertImage = () => {
    if (!file) {
      setError("Please upload an image first");
      return;
    }

    const img = new Image();
    img.src = preview;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setError("Conversion failed. Please try again.");
            return;
          }

          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `converted.${format}`;

          document.body.appendChild(a);
          a.click();
          a.remove();

          URL.revokeObjectURL(url);

          // ✅ RECENT ACTIVITY: only after successful convert + download
          const now = Date.now();
          if (now - lastSuccessRef.current > 800) {
            onSuccess?.("image-format-converter", "Image Format Converter");
            lastSuccessRef.current = now;
          }
        },
        `image/${format}`,
        0.9
      );
    };

    img.onerror = () => {
      setError("Could not load image preview. Please re-upload the image.");
    };
  };

  return (
    <ToolLayout
      title="Image Format Converter"
      description="Convert an image to PNG/JPG/WEBP and download."
      onBack={() => setActiveTab("dashboard")}
    >
      <input
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ marginBottom: "15px", width: "100%" }}
      />

      {preview && (
        <img
          src={preview}
          alt="preview"
          style={{
            width: "100%",
            maxHeight: "220px",
            objectFit: "contain",
            marginBottom: "15px",
            borderRadius: "8px"
          }}
        />
      )}

      <select
        value={format}
        onChange={(e) => setFormat(e.target.value)}
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "15px",
          borderRadius: "6px"
        }}
      >
        <option value="png">PNG</option>
        <option value="jpeg">JPG</option>
        <option value="webp">WEBP</option>
      </select>

      <button
        onClick={convertImage}
        style={{
          width: "100%",
          padding: "12px",
          background: "#4a90e2",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          fontSize: "15px",
          cursor: "pointer"
        }}
      >
        Convert & Download
      </button>

      {error && (
        <div
          style={{
            marginTop: "15px",
            color: "#b91c1c",
            background: "#fee2e2",
            padding: "10px",
            borderRadius: "6px",
            fontSize: "14px"
          }}
        >
          {error}
        </div>
      )}
    </ToolLayout>
  );
};

export default ImageFormatConverter;