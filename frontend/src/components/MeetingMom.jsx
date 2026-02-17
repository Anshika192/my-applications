import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import ToolLayout from "./ToolLayout";

const MeetingMom = ({ setActiveTab, onSuccess }) => {
  // Files (classic mode)
  const [video, setVideo] = useState(null);
  const [image, setImage] = useState(null);

  // Transcript (both modes)
  const [transcript, setTranscript] = useState("");

  // AI toggle
  const [useAI, setUseAI] = useState(true);

  // UI state
  const [fileKey, setFileKey] = useState(0); // force-remount file inputs
  const [loading, setLoading] = useState(false);
  const [mom, setMom] = useState("");
  const [msg, setMsg] = useState("");

  // History
  const [history, setHistory] = useState([]);
  const lastSuccessRef = useRef(0);
  const lastHistoryRef = useRef({ key: "", at: 0 });

  // refs for file inputs
  const videoInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // ---- Load history on mount (safe parse) ----
  useEffect(() => {
    try {
      const raw = localStorage.getItem("meetingMomHistory");
      const saved = raw ? JSON.parse(raw) : [];
      setHistory(Array.isArray(saved) ? saved : []);
    } catch {
      setHistory([]);
    }
  }, []);

  // ---- Save history (functional update to avoid stale state) ----
  const saveHistory = (data) => {
    setHistory((prev) => {
      const updated = [data, ...prev].slice(0, 10);
      localStorage.setItem("meetingMomHistory", JSON.stringify(updated));
      return updated;
    });
  };

  // ---- Clear only inputs (files, optionally transcript) ----
  const clearInputs = () => {
    setVideo(null);
    setImage(null);
    // setTranscript(""); // <- uncomment if you also want to clear text
    if (videoInputRef.current) videoInputRef.current.value = null;
    if (imageInputRef.current) imageInputRef.current.value = null;
    setFileKey((k) => k + 1); // remount file inputs
    setMsg("");
  };

  // ---- Clear only history ----
  const clearHistory = () => {
    localStorage.removeItem("meetingMomHistory");
    setHistory([]);
    setMsg("History cleared");
  };

  // ---- Copy MOM ----
  const copyMom = async () => {
    if (!mom) return;
    try {
      await navigator.clipboard.writeText(mom);
      setMsg("Copied to clipboard ✅");
    } catch {
      setMsg("Could not copy to clipboard");
    }
  };

  // ---- Download PDF ----
  const downloadPDF = () => {
    if (!mom) return;
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(mom, 180);
    doc.text(lines, 10, 10);
    doc.save(`meeting_mom_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  // ---- Generate MOM ----
  const handleGenerate = async () => {
    const API_URL = import.meta.env.VITE_API_URL;

    if (!API_URL) {
      setMsg("❌ Missing VITE_API_URL in environment.");
      return;
    }

    // Basic validation
    if (useAI) {
      if (!transcript.trim()) {
        setMsg("Please paste transcript for AI mode.");
        return;
      }
    } else {
      if (!video && !image && !transcript.trim()) {
        setMsg("Please upload video, image, or paste transcript");
        return;
      }
    }

    // Optional free-plan file size guards (uncomment if needed)
    // if (!useAI && video && video.size > 25 * 1024 * 1024) {
    //   setMsg("Video is too large (max ~25 MB on free plan).");
    //   return;
    // }
    // if (!useAI && image && image.size > 10 * 1024 * 1024) {
    //   setMsg("Image is too large (max ~10 MB).");
    //   return;
    // }

    setLoading(true);
    setMsg("");
    setMom("");

    try {
      let generated = "";

      if (useAI) {
        // ✅ AI route expects x-www-form-urlencoded with 'transcript'
        const data = new URLSearchParams();
        data.set("transcript", transcript.trim());

        const res = await axios.post(`${API_URL}/ai/mom-generator`, data, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 45000, // ms
        });

        generated = res?.data?.mom || "";
      } else {
        // Classic route supports files + transcript (multipart/form-data)
        const formData = new FormData();
        if (video) formData.append("video", video);
        if (image) formData.append("image", image);
        if (transcript.trim()) formData.append("transcript", transcript);

        const res = await axios.post(`${API_URL}/meeting-mom`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 90000, // might be longer for files
        });

        generated = res?.data?.mom || "";
      }

      setMom(generated);
      setMsg(generated ? "MOM generated successfully ✅" : "No content generated, try again.");

      // Clear file inputs after success (keep transcript for quick edits)
      clearInputs();

      // History snapshot
      const now = Date.now();
      const key = `${useAI ? "AI" : "Classic"}__${video?.name || ""}__${image?.name || ""}__${transcript
        .trim()
        .slice(0, 50)}`;

      if (key !== lastHistoryRef.current.key || now - lastHistoryRef.current.at > 1200) {
        saveHistory({
          time: new Date().toLocaleString(),
          mode: useAI ? "AI" : "Classic",
          videoName: video?.name || "—",
          imageName: image?.name || "—",
          transcriptPreview: transcript.trim()
            ? transcript.trim().slice(0, 70) + (transcript.trim().length > 70 ? "..." : "")
            : "—",
          momPreview: generated
            ? generated.slice(0, 90) + (generated.length > 90 ? "..." : "")
            : "—",
        });
        lastHistoryRef.current = { key, at: now };
      }

      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("meeting-mom", "Meeting MOM Generator");
        lastSuccessRef.current = now;
      }
    } catch (err) {
      console.error(err);
      const status = err?.response?.status;
      const body = err?.response?.data;
      const detail =
        body?.detail ||
        (typeof body === "string" ? body : "") ||
        err?.message ||
        "Failed to generate MOM";
      setMsg(`❌ ${status ? status + " • " : ""}${detail}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Meeting MOM Generator"
      description="Upload meeting video/screenshot or paste transcript to generate Minutes of Meeting"
      onBack={() => setActiveTab("dashboard")}
    >
      {/* AI Toggle */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <label style={{ fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={useAI}
            onChange={(e) => {
              setUseAI(e.target.checked);
              setMsg("");
              setMom("");
            }}
            style={{ marginRight: 8 }}
          />
          Use AI (Beta)
        </label>
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          {useAI
            ? "Uses /ai/mom-generator (transcript required)"
            : "Uses /meeting-mom (files or transcript allowed)"}
        </div>
      </div>

      {/* Upload Video (classic only) */}
      {!useAI && (
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
            Upload Meeting Video (optional)
          </label>
          <input
            key={`v-${fileKey}`}
            ref={videoInputRef}
            type="file"
            accept="video/*"
            onChange={(e) => {
              setVideo(e.target.files?.[0] || null);
              setMsg("");
            }}
            style={{ width: "100%" }}
          />
          {video?.name && (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              Selected: <b>{video.name}</b>
            </div>
          )}
        </div>
      )}

      {/* Upload Image (classic only) */}
      {!useAI && (
        <div style={{ marginBottom: 15 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
            Upload Screenshot (OCR)
          </label>
          <input
            key={`i-${fileKey}`}
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => {
              setImage(e.target.files?.[0] || null);
              setMsg("");
            }}
            style={{ width: "100%" }}
          />
          {image?.name && (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
              Selected: <b>{image.name}</b>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      {!useAI && (
        <div style={{ textAlign: "center", margin: "12px 0", opacity: 0.7, fontWeight: 700 }}>
          OR
        </div>
      )}

      {/* Transcript */}
      <div style={{ marginBottom: 15 }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
          Paste Meeting Transcript {useAI ? "(required for AI)" : ""}
        </label>
        <textarea
          rows={5}
          value={transcript}
          onChange={(e) => {
            setTranscript(e.target.value);
            setMsg("");
          }}
          placeholder={
            useAI
              ? "Paste transcript here (AI requires transcript)."
              : "Paste transcript here (or upload meeting video/screenshot)."
          }
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ccc",
            resize: "vertical",
          }}
        />
      </div>

      {/* Generate */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading}
        style={{
          width: "100%",
          padding: 12,
          background: "#4a90e2",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        {loading ? "Generating..." : "Generate MOM"}
      </button>

      {/* Message */}
      {msg && (
        <div
          style={{
            marginTop: 14,
            fontSize: 14,
            color: msg.includes("❌") ? "#b91c1c" : "#166534",
          }}
        >
          {msg}
        </div>
      )}

      {/* Output */}
      {mom && (
        <div style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 8 }}>Generated Minutes of Meeting</h3>
          <textarea
            rows={10}
            readOnly
            value={mom}
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 6,
              border: "1px solid #ccc",
              resize: "vertical",
            }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              type="button"
              onClick={downloadPDF}
              style={{
                flex: 1,
                padding: 12,
                background: "#16a34a",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={copyMom}
              style={{
                flex: 1,
                padding: 12,
                background: "#0ea5e9",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Copy MOM
            </button>
          </div>
        </div>
      )}

      {/* History */}
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
          <strong>Recent MOM History</strong>
          <ul style={{ marginTop: 8 }}>
            {history.map((h, i) => (
              <li key={i} style={{ marginBottom: 10 }}>
                <div style={{ marginBottom: 4 }}>
                  <span
                    style={{
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: h.mode === "AI" ? "#eef2ff" : "#ecfeff",
                      marginRight: 8,
                      fontSize: 12,
                    }}
                  >
                    {h.mode}
                  </span>
                  <b>Video:</b> {h.videoName} &nbsp; | &nbsp; <b>Image:</b> {h.imageName}
                </div>
                <div style={{ marginBottom: 4 }}>
                  <b>Transcript:</b> {h.transcriptPreview}
                </div>
                <div style={{ marginBottom: 4 }}>
                  <b>MOM:</b> {h.momPreview}
                </div>
                <div style={{ opacity: 0.7 }}>{h.time}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Clear buttons */}
      <button
        type="button"
        onClick={clearInputs}
        style={{ marginTop: 10, width: "100%", padding: 10 }}
      >
        Clear Inputs
      </button>

      <button
        type="button"
        onClick={clearHistory}
        style={{ marginTop: 8, width: "100%", padding: 10, background: "#f1f5f9" }}
      >
        Clear History
      </button>
    </ToolLayout>
  );
};

export default MeetingMom;