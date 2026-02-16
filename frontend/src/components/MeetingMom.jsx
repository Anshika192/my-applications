import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import ToolLayout from "../components/ToolLayout";

const MeetingMom = ({ setActiveTab, onSuccess }) => {
  const [video, setVideo] = useState(null);
  const [image, setImage] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [fileKey, setFileKey] = useState(0);

  const [loading, setLoading] = useState(false);
  const [mom, setMom] = useState("");
  const [msg, setMsg] = useState("");

  // ✅ NEW: History like PdfWatermark
  const [history, setHistory] = useState([]);

  // ✅ prevent multiple recent logs quickly
  const lastSuccessRef = useRef(0);

  // ✅ prevent duplicate history spam
  const lastHistoryRef = useRef({ key: "", at: 0 });

  
  // 👉 Add refs to reset <input type="file">
  const videoInputRef = useRef(null);
  const imageInputRef = useRef(null);


  // ✅ load history on mount
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("meetingMomHistory")) || [];
    setHistory(saved);
  }, []);

  // ✅ save history (keep last 10)
  const saveHistory = (data) => {
    const updated = [data, ...history].slice(0, 10);
    setHistory(updated);
    localStorage.setItem("meetingMomHistory", JSON.stringify(updated));
  };

  const handleGenerate = async () => {
    if (!video && !image && !transcript.trim()) {
      setMsg("Please upload video, image, or paste transcript");
      return;
    }

    setLoading(true);
    setMsg("");
    setMom("");

    try {
      const formData = new FormData();
      if (video) formData.append("video", video);
      if (image) formData.append("image", image);
      if (transcript.trim()) formData.append("transcript", transcript);

      
    const API_URL = import.meta.env.VITE_API_URL; // read from .env
    const res = await axios.post(`${API_URL}/meeting-mom`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
  });


      const generated = res?.data?.mom || "";
      setMom(generated);

      // ✅ success msg
      setMsg("MOM generated successfully ✅");

      
      // ✅ Clear inputs here (AFTER success)
     const clearInputs = () => {
  setVideo(null);
  setImage(null);
  // setTranscript(""); // uncomment if you want to clear text too
  if (videoInputRef.current) videoInputRef.current.value = null; // extra safety
  if (imageInputRef.current) imageInputRef.current.value = null;
  setFileKey(k => k + 1); 
  setMsg("");
     };

      if (!generated) setMsg("No content generated, try again or paste transcript.");

      // ✅ HISTORY: only after success (like PdfWatermark)
      const now = Date.now();
      const key = `${video?.name || ""}__${image?.name || ""}__${transcript.trim().slice(0, 50)}`;

      // avoid same entry spam within 1.2s
      if (
        key !== lastHistoryRef.current.key ||
        now - lastHistoryRef.current.at > 1200
      ) {
        saveHistory({
          time: new Date().toLocaleString(),
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

      // ✅ RECENT ACTIVITY throttle like PdfWatermark
      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("meeting-mom", "Meeting MOM Generator");
        lastSuccessRef.current = now;
      }
    } catch (err) {
      console.error(err);
      const detail = err?.response?.data?.detail || err?.message || "Failed to generate MOM ";
      setMsg (`❌ ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (!mom) return;

    const doc = new jsPDF();
    const lines = doc.splitTextToSize(mom, 180);
    doc.text(lines, 10, 10);
    doc.save(`meeting_mom_${new
      Date().toISOString().slice(0,10)}.pdf`); 
  };

  return (
    <ToolLayout
      title="Meeting MOM Generator"
      description="Upload meeting video/screenshot or paste transcript to generate Minutes of Meeting"
      onBack={() => setActiveTab("dashboard")}
    >
      {/* Upload Video */}
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

      {/* Upload Image */}
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

      <div style={{ textAlign: "center", margin: "12px 0", opacity: 0.7, fontWeight: 700 }}>
        OR
      </div>

      {/* Transcript */}
      <div style={{ marginBottom: 15 }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
          Paste Meeting Transcript
        </label>
        <textarea
          rows={5}
          value={transcript}
          onChange={(e) => {
            setTranscript(e.target.value);
            setMsg("");
          }}
          placeholder="Paste transcript here (or upload meeting vedio/screenshot)."
          style={{
            width: "100%",
            padding: 10,
            borderRadius: 6,
            border: "1px solid #ccc",
            resize: "vertical",
          }}
        />
      </div>

      {/* Generate Button */}
      <button
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

      {/* Msg */}
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

          <button
            onClick={downloadPDF}
            style={{
              width: "100%",
              marginTop: 12,
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
        </div>
      )}

      {/* ✅ History (same idea as PdfWatermark) */}
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
       <button
  type="button"        
  onClick={clearInputs}
  style={{ marginTop: 10, width: "100%", padding: 10 }}
>
  Clear Inputs
</button>
    </ToolLayout>
  );
};

export default MeetingMom;