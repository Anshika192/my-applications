import React, { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import ToolLayout from "./ToolLayout";

const QrCodeGenerator = ({ setActiveTab, onSuccess }) => {
  const [type, setType] = useState("text");
  const [value, setValue] = useState("");
  const [size, setSize] = useState(220);
  const [color, setColor] = useState("#000000");
  const [history, setHistory] = useState([]);

  const qrRef = useRef(null);
  const lastSuccessRef = useRef(0);

  /* Load History */
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("qrHistory")) || [];
    setHistory(saved);
  }, []);

  /* Auto-save history (debounced) */
  useEffect(() => {
    if (!value) return;

    const t = setTimeout(() => {
      const updated = [{ type, value }, ...history]
        .filter(
          (v, i, a) =>
            a.findIndex(
              (x) => x.type === v.type && x.value === v.value
            ) === i
        )
        .slice(0, 8);

      setHistory(updated);
      localStorage.setItem("qrHistory", JSON.stringify(updated));
    }, 500);

    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [value, type]);

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
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;

    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "qr-code.png";
    a.click();

    const now = Date.now();
    if (now - lastSuccessRef.current > 800) {
      onSuccess?.("qr-generator", "QR Code Generator");
      lastSuccessRef.current = now;
    }
  };

  return (
    <ToolLayout
      title="QR Code Generator"
      description="Fast · Clean · Downloadable QR codes"
      onBack={() => setActiveTab("dashboard")}
      enableFileUpload={false}
    >
      {/* TYPE */}
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
        <option value="phone">Phone</option>
        <option value="email">Email</option>
        <option value="wifi">WiFi</option>
      </select>

      {/* INPUT */}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Enter ${type}`}
        style={inputStyle}
      />

      {/* SIZE */}
      <label>QR Size: {size}px</label>
      <input
        type="range"
        min="150"
        max="350"
        value={size}
        onChange={(e) => setSize(+e.target.value)}
        style={rangeStyle}
      />

      {/* COLOR */}
      <label>QR Color</label>
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        style={{ ...inputStyle, height: 45 }}
      />

      {/* QR OUTPUT */}
      {value && (
        <div ref={qrRef} style={{ textAlign: "center", marginTop: 20 }}>
          <QRCodeCanvas
            value={getQrValue()}
            size={size}
            fgColor={color}
          />

          <button onClick={downloadQR} style={btnStyle}>
            Download PNG
          </button>
        </div>
      )}

      {/* HISTORY */}
      {history.length > 0 && (
        <div style={historyBox}>
          <strong>Recent</strong>
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

/* STYLES */

const inputStyle = {
  width: "100%",
  padding: 12,
  borderRadius: 6,
  border: "1px solid #d1d5db",
  marginBottom: 14,
};

const rangeStyle = {
  width: "100%",
  marginBottom: 16,
};

const btnStyle = {
  width: "100%",
  padding: 12,
  marginTop: 14,
  background: "#2563eb",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  cursor: "pointer",
};

const historyBox = {
  marginTop: 22,
  padding: 14,
  background: "#f8fafc",
  borderRadius: 8,
  fontSize: 13,
};

export default QrCodeGenerator;