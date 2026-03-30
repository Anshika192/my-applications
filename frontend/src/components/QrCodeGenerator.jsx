import React, { useState, useEffect, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import ToolLayout from "./ToolLayout";

const QrCodeGenerator = ({ setActiveTab, onSuccess }) => {
  const [type, setType] = useState("text");
  const [value, setValue] = useState("");
  const [size, setSize] = useState(220);
  const [color, setColor] = useState("#000000");
  const [logo, setLogo] = useState(null);
  const [history, setHistory] = useState([]);

  const qrRef = useRef(null);

  // ✅ prevent multiple recent logs quickly
  const lastSuccessRef = useRef(0);

  // Load history
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("qrHistory")) || [];
    setHistory(saved);
  }, []);

  // Save history
  const saveHistory = (data) => {
    const updated = [data, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem("qrHistory", JSON.stringify(updated));
  };

  const getQrValue = () => {
    switch (type) {
      case "url":
        return value.startsWith("http") ? value : `https://${value}`;
      case "phone":
        return `tel:${value}`;
      case "email":
        return `mailto:${value}`;
      case "wifi":
        return `WIFI:T:WPA;S:${value};P:password;;`;
      default:
        return value;
    }
  };

  const downloadQR = () => {
    if (!qrRef.current) return;

    const canvas = qrRef.current.querySelector("canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-code.png";

    document.body.appendChild(a);
    a.click();
    a.remove();

    // ✅ RECENT ACTIVITY: only after successful download click
    const now = Date.now();
    if (now - lastSuccessRef.current > 800) {
      onSuccess?.("qr-generator", "QR Code Generator");
      lastSuccessRef.current = now;
    }
  };

  const handleGenerate = () => {
    if (!value) return;
    saveHistory({ type, value });
  };

  return (
    <ToolLayout
      title="QR Code Generator"
      description="Text, URL, Phone, Email, WiFi + Download, Logo, Color, History"
      onBack={() => setActiveTab("dashboard")}
    >
      {/* Type */}
      <select
        value={type}
        onChange={(e) => {
          setType(e.target.value);
          setValue("");
        }}
        style={inputStyle}
      >
        <option value="text">Text</option>
        <option value="url">Website</option>
        <option value="phone">Phone Call</option>
        <option value="email">Email</option>
        <option value="wifi">WiFi</option>
      </select>

      {/* Input */}
      <input
        type="text"
        placeholder={`Enter ${type}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={inputStyle}
      />

      {/* Controls */}
      <label>QR Size: {size}px</label>
      <input
        type="range"
        min="150"
        max="350"
        value={size}
        onChange={(e) => setSize(Number(e.target.value))}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <label>QR Color</label>
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <label>Center Logo (optional)</label>
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setLogo(URL.createObjectURL(f));
        }}
        style={{ marginBottom: 20 }}
      />

      {/* Generate */}
      <button style={btnStyle} onClick={handleGenerate}>
        Generate QR
      </button>

      {/* QR */}
      {value && (
        <div ref={qrRef} style={{ textAlign: "center", marginTop: 20 }}>
          <QRCodeCanvas
            value={getQrValue()}
            size={size}
            fgColor={color}
            imageSettings={
              logo
                ? {
                    src: logo,
                    height: size * 0.25,
                    width: size * 0.25,
                    excavate: true,
                  }
                : undefined
            }
          />

          <button style={btnStyle} onClick={downloadQR}>
            Download PNG
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={historyBox}>
          <strong>Recent QR History</strong>
          <ul>
            {history.map((h, i) => (
              <li key={i}>
                {h.type}: {h.value}
              </li>
            ))}
          </ul>
        </div>
      )}
    </ToolLayout>
  );
};

const inputStyle = {
  width: "100%",
  padding: 12,
  marginBottom: 14,
  borderRadius: 6,
  border: "1px solid #ccc",
};

const btnStyle = {
  width: "100%",
  padding: 12,
  background: "#4a90e2",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
  marginTop: 10,
};

const historyBox = {
  marginTop: 25,
  padding: 15,
  background: "#f8fafc",
  borderRadius: 8,
  fontSize: 13,
};

export default QrCodeGenerator;