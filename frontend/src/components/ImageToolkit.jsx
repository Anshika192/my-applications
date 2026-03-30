import React, { useEffect, useRef, useState } from "react";
import ToolLayout from "./ToolLayout";

export default function ImageToolkit({ setActiveTab }) {
  const [file, setFile] = useState(null);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);

  // resize
  const [resizeWidth, setResizeWidth] = useState("");
  const [resizeHeight, setResizeHeight] = useState("");

  // image + canvas
  const canvasRef = useRef(null);
  const [imgObj, setImgObj] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cropRect, setCropRect] = useState(null);

  const [downloadURL, setDownloadURL] = useState("");
  const [metaData, setMetaData] = useState(null);

  /* ---------------- LOAD IMAGE ---------------- */
  const loadImage = (file) => {
    const img = new Image();
    img.onload = () => setImgObj(img);
    img.src = URL.createObjectURL(file);
  };

  /* ---------------- DRAW IMAGE + CROP ---------------- */
  useEffect(() => {
    if (action !== "crop" || !imgObj || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = imgObj.width;
    canvas.height = imgObj.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgObj, 0, 0);

    if (cropRect) {
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);
    }
  }, [imgObj, cropRect, action]);

  /* ---------------- CROP HANDLERS ---------------- */
  const startCrop = (e) => {
    if (!canvasRef.current || !imgObj) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    setIsDragging(true);
    setCropRect({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      w: 0,
      h: 0
    });
  };

  const drawCrop = (e) => {
    if (!isDragging || !canvasRef.current || !imgObj) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    setCropRect((prev) => ({
      ...prev,
      w: Math.max(5, (e.clientX - rect.left) * scaleX - prev.x),
      h: Math.max(5, (e.clientY - rect.top) * scaleY - prev.y)
    }));
  };

  const endCrop = () => setIsDragging(false);

  /* ---------------- RUN TOOL ---------------- */
  const run = async () => {
    if (!file || !action) return;

    setLoading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("action", action);

      if (action === "resize") {
        if (resizeWidth) form.append("width", resizeWidth);
        if (resizeHeight) form.append("height", resizeHeight);
      }

      if (action === "crop") {
        if (!cropRect || cropRect.w < 5 || cropRect.h < 5) {
          alert("Please draw a valid crop area");
          return;
        }
        form.append("left", Math.round(cropRect.x));
        form.append("top", Math.round(cropRect.y));
        form.append("crop_width", Math.round(cropRect.w));
        form.append("crop_height", Math.round(cropRect.h));
      }

      const res = await fetch("http://127.0.0.1:8000/image/toolkit", {
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
        setMetaData(null);
      } else {
        setMetaData(result);
        setDownloadURL("");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Image Toolkit"
      description="Resize images, crop using phone‑style drag selection, or view metadata."
      onBack={() => setActiveTab("dashboard")}
      onFileDrop={(f) => {
        setFile(f);
        loadImage(f);
        setCropRect(null);
        setDownloadURL("");
        setMetaData(null);
      }}
    >
      {/* CONTROLS */}
      <div className="tool-controls">
        <select
          className="tool-select"
          value={action}
          onChange={(e) => setAction(e.target.value)}
        >
          <option value="">Select Action</option>
          <option value="resize">Resize Image</option>
          <option value="crop">Crop Image (Drag)</option>
          <option value="metadata">View Metadata</option>
        </select>

        <button
          className="tool-btn-primary"
          onClick={run}
          disabled={!file || !action || loading}
        >
          {loading && <span className="btn-spinner" />}
          {loading ? "Processing..." : "Run"}
        </button>
      </div>

      {/* RESIZE UI */}
      {action === "resize" && (
        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            type="number"
            placeholder="Width (px)"
            value={resizeWidth}
            onChange={(e) => setResizeWidth(e.target.value)}
          />
          <input
            type="number"
            placeholder="Height (optional)"
            value={resizeHeight}
            onChange={(e) => setResizeHeight(e.target.value)}
          />
          <p style={{ fontSize: 12, opacity: 0.7, width: "100%" }}>
            Leave one field empty to maintain aspect ratio.
          </p>
        </div>
      )}

      {/* CROP CANVAS */}
      {action === "crop" && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            Drag freely on the image to select crop area
          </p>
          <canvas
            ref={canvasRef}
            style={{
              width: "100%",
              maxWidth: "700px",
              border: "1px solid #ccc",
              borderRadius: 10,
              cursor: "crosshair"
            }}
            onMouseDown={startCrop}
            onMouseMove={drawCrop}
            onMouseUp={endCrop}
          />
        </div>
      )}

      {/* DOWNLOAD */}
{downloadURL && (
  <div style={{ marginTop: 20 }}>
    <a href={downloadURL} download="output.png">
      Download Image
    </a>
  </div>
)}

      {/* METADATA */}
      {metaData && (
        <pre style={{ marginTop: 20 }}>
          {JSON.stringify(metaData, null, 2)}
        </pre>
      )}
    </ToolLayout>
  );
}