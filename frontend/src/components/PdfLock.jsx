import React, { useEffect, useRef, useState } from "react";
import ToolLayout from "./ToolLayout";
import { API_URL } from "../api";

const PdfLock = ({ setActiveTab, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("lock");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // ✅ NEW: history like QR generator
  const [history, setHistory] = useState([]);

  // ✅ prevent multiple recent logs quickly
  const lastSuccessRef = useRef(0);

  // ✅ prevent duplicate history spam
  const lastHistoryRef = useRef({ key: "", at: 0 });

  // Load history
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("pdfLockHistory")) || [];
    setHistory(saved);
  }, []);

  // Save history (keep last 10)
  const saveHistory = (data) => {
    const updated = [data, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem("pdfLockHistory", JSON.stringify(updated));
  };

  // ✅ Clear status when switching mode
  useEffect(() => {
    setStatus("");
  }, [mode]);

  const handleSubmit = async () => {
    if (!file || !password) {
      setStatus("⚠️ Please select PDF and enter password");
      return;
    }

    setLoading(true);
    setStatus(mode === "lock" ? "Locking PDF..." : "Unlocking PDF...");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);

    try {
      const res = await fetch(`${API_URL}/convert/pdf-${mode}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Request failed");

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = mode === "lock" ? "locked.pdf" : "unlocked.pdf";
      a.click();

      // ✅ cleanup
      setTimeout(() => window.URL.revokeObjectURL(url), 1000);

      setStatus("✅ Done successfully");

      // ✅ HISTORY: only after success
      const now = Date.now();
      const key = `${file.name}__${mode}`;

      // avoid same entry spam within 1.2s
      if (
        key !== lastHistoryRef.current.key ||
        now - lastHistoryRef.current.at > 1200
      ) {
        saveHistory({
          fileName: file.name,
          mode,
          time: new Date().toLocaleString(),
        });
        lastHistoryRef.current = { key, at: now };
      }

      // ✅ RECENT ACTIVITY: throttle like QR generator
      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("pdf-lock", "PDF Lock / Unlock");
        lastSuccessRef.current = now;
      }
    } catch (err) {
      console.error(err);
      setStatus("❌ Failed. Wrong password or file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolLayout
      title="PDF Lock / Unlock"
      description="Secure or remove password from your PDF files"
      onBack={() => setActiveTab("dashboard")}
    >
      {/* MODE TABS */}
      <div
        style={{
          display: "flex",
          borderRadius: 8,
          overflow: "hidden",
          marginBottom: 20,
          border: "1px solid #e5e7eb",
        }}
      >
        {["lock", "unlock"].map((item) => (
          <button
            key={item}
            onClick={() => setMode(item)}
            style={{
              flex: 1,
              padding: 12,
              background: mode === item ? "#2563eb" : "#f9fafb",
              color: mode === item ? "#fff" : "#111",
              border: "none",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {item === "lock" ? "🔒 Lock PDF" : "🔓 Unlock PDF"}
          </button>
        ))}
      </div>

      {/* FILE INPUT */}
      <div style={{ marginBottom: 15 }}>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => {
            setFile(e.target.files?.[0] || null);
            setStatus("");
          }}
          style={{
            width: "100%",
            padding: 10,
            border: "1px solid #e5e7eb",
            borderRadius: 6,
          }}
        />
      </div>

      {/* PASSWORD */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="password"
          placeholder="Enter PDF password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 6,
            border: "1px solid #e5e7eb",
          }}
        />
      </div>

      {/* ACTION BUTTON */}
      <button
        onClick={handleSubmit}
        disabled={loading}
        style={{
          width: "100%",
          padding: 14,
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontWeight: 600,
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.85 : 1,
        }}
      >
        {loading
          ? mode === "lock"
            ? "Locking..."
            : "Unlocking..."
          : mode === "lock"
          ? "Lock PDF"
          : "Unlock PDF"}
      </button>

      {/* STATUS */}
      {status && (
        <div
          style={{
            marginTop: 15,
            textAlign: "center",
            fontSize: 14,
            color: status.includes("❌") ? "#dc2626" : "#16a34a",
          }}
        >
          {status}
        </div>
      )}

      {/* ✅ NEW: History (minimal, optional) */}
      {history.length > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: 12,
            background: "#f8fafc",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <strong>Recent Lock/Unlock History</strong>
          <ul style={{ marginTop: 8 }}>
            {history.map((h, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                <div>
                  <b>{h.fileName}</b> — {h.mode === "lock" ? "Locked" : "Unlocked"}
                </div>
                <div style={{ opacity: 0.7 }}>{h.time}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ToolLayout>
  );
};

export default PdfLock;
``