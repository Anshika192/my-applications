import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import jsPDF from "jspdf";
import ToolLayout from "./ToolLayout";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";

/**
 * FFmpeg WASM (0.11.x API)
 */

const ffmpeg = createFFmpeg({ log: false });
async function ensureFFmpegLoaded() {
  if (!ffmpeg.isLoaded()) {
    await ffmpeg.load();
  }
}

/**
 * Warm up Render free-tier backend with /health (CORS-friendly)
 */

async function warmUpServer(API_URL) {
  const deadline = Date.now() + 70_000; // ~70s
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const res = await axios.get(`${API_URL}/health`, { timeout: 10_000 });
      if (res?.data?.status === "ok") return true;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw lastErr || new Error("Warm-up timed out");
}

/**
 * Extract audio and split into ~2‑min WAV chunks (16kHz mono)
 * 120s chunks are more stable on free CPU (smaller uploads to /transcribe/local)
 */
async function extractAndChunkAudio(videoFile, onProgress) {
  await ensureFFmpegLoaded();

  const inputExt = (videoFile.name.split(".").pop() || "mp4").toLowerCase();
  const inputName = `input.${inputExt}`;
  ffmpeg.FS("writeFile", inputName, await fetchFile(videoFile));

  onProgress?.("Extracting audio (16 kHz mono) …");
  const wavName = "audio.wav";
  await ffmpeg.run("-i", inputName, "-vn", "-ac", "1", "-ar", "16000", "-f", "wav", wavName);

  onProgress?.("Splitting into 2‑minute chunks …");
  await ffmpeg.run("-i", wavName, "-f", "segment", "-segment_time", "30", "-c", "copy", "chunk%03d.wav");

  const entries = ffmpeg.FS("readdir", "/").filter((n) => /^chunk\d{3}\.wav$/.test(n)).sort();

  if (!entries.length) {
    // Fallback: ek hi chunk
    const data = ffmpeg.FS("readFile", wavName);
    try { ffmpeg.FS("unlink", wavName); } catch {}
    try { ffmpeg.FS("unlink", inputName); } catch {}
    return [{ name: "chunk000.wav", blob: new Blob([data.buffer], { type: "audio/wav" }), type: "audio/wav" }];
  }

  const chunks = [];
  for (const name of entries) {
    const data = ffmpeg.FS("readFile", name);
    chunks.push({ name, blob: new Blob([data.buffer], { type: "audio/wav" }), type: "audio/wav" });
    try { ffmpeg.FS("unlink", name); } catch {}
  }

  try { ffmpeg.FS("unlink", wavName); } catch {}
  try { ffmpeg.FS("unlink", inputName); } catch {}

  return chunks;
}

const MeetingMom = ({ setActiveTab, onSuccess }) => {
  // Files
  const [video, setVideo] = useState(null);
  const [image, setImage] = useState(null);

  // Transcript (both modes)
  const [transcript, setTranscript] = useState("");

  // AI toggle
  const [useAI, setUseAI] = useState(true);

  // UI state
  const [fileKey, setFileKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mom, setMom] = useState("");
  const [msg, setMsg] = useState("");

  // History
  const [history, setHistory] = useState([]);
  const lastSuccessRef = useRef(0);
  const lastHistoryRef = useRef({ key: "", at: 0 });

  // refs
  const videoInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Load history
  useEffect(() => {
    try {
      const raw = localStorage.getItem("meetingMomHistory");
      setHistory(raw ? (Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : []) : []);
    } catch {
      setHistory([]);
    }
  }, []);

  const saveHistory = (data) => {
    setHistory((prev) => {
      const updated = [data, ...prev].slice(0, 10);
      localStorage.setItem("meetingMomHistory", JSON.stringify(updated));
      return updated;
    });
  };

  const clearInputs = () => {
    setVideo(null);
    setImage(null);
    // setTranscript("");
    if (videoInputRef.current) videoInputRef.current.value = null;
    if (imageInputRef.current) imageInputRef.current.value = null;
    setFileKey((k) => k + 1);
    setMsg("");
  };

  const clearHistory = () => {
    localStorage.removeItem("meetingMomHistory");
    setHistory([]);
    setMsg("History cleared");
  };

  const copyMom = async () => {
    if (!mom) return;
    try {
      await navigator.clipboard.writeText(mom);
      setMsg("Copied to clipboard ✅");
    } catch {
      setMsg("Could not copy to clipboard");
    }
  };

  const downloadPDF = () => {
    if (!mom) return;
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(mom, 180);
    doc.text(lines, 10, 10);
    doc.save(`meeting_mom_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const handleGenerate = async () => {
    const API_URL = import.meta.env.VITE_API_URL;
    console.log("useAI =", useAI, "videoMB =", video ? (video.size / 1024 / 1024).toFixed(2) : 0);

    if (!API_URL) {
      setMsg("❌ Missing VITE_API_URL in environment.");
      return;
    }

    // Basic validation
    if (useAI) {
      if (!transcript.trim() && !video && !image) {
        setMsg("Provide transcript or upload video/image for AI mode.");
        return;
      }
    } else {
      if (!video && !image && !transcript.trim()) {
        setMsg("Please upload video, image, or paste transcript");
        return;
      }
    }

    // Size guards — ONLY for Classic mode (AI me local chunking hota hai)
    const maxVideoMB = 25, maxImageMB = 10;
    if (!useAI) {
      if (video && video.size && video.size > maxVideoMB * 1024 * 1024) {
        setMsg(`Video is too large (max ~${maxVideoMB} MB).`);
        return;
      }
      if (image && image.size && image.size > maxImageMB * 1024 * 1024) {
        setMsg(`Image is too large (max ~${maxImageMB} MB).`);
        return;
      }
    }

    setLoading(true);
    setMsg("");
    setMom("");

    try {
      let generated = "";

      if (useAI) {
        setMsg("Warming server (~30–60s on free plan)...");
        try { await warmUpServer(API_URL); } catch {}

        setMsg("Preparing media/transcript…");
        const hasVideo = Boolean(video);
        const hasImage = Boolean(image);
        const hasTranscript = Boolean(transcript.trim());

        let finalTranscript = "";
// handleGenerate function ke andar jahan "hasVideo" wala block hai:

if (hasVideo) {
  setMsg("Extracting audio... Please keep this tab active.");
  const chunks = await extractAndChunkAudio(video, (m) => setMsg(m));

  const parts = [];
  for (let i = 0; i < chunks.length; i++) {
    setMsg(`Transcribing chunk ${i + 1}/${chunks.length} …`);
    
    // FormData har baar loop ke andar naya banna chahiye
    const form = new FormData();
    form.append("file", new File([chunks[i].blob], chunks[i].name, { type: "audio/wav" }));

    let success = false;
    let retries = 3;

    while (!success && retries > 0) {
      try {
        const r = await axios.post(`${API_URL}/transcribe/local`, form, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 180000, // 3 minutes
        });
        
        if (r.data && r.data.text) {
          parts.push(r.data.text);
        }
        success = true;
        
        // Render server ko thoda "rest" dene ke liye 2 sec wait
        await new Promise((res) => setTimeout(res, 2000));
        
      } catch (err) {
        retries--;
        console.error(`Error in chunk ${i}, retries left: ${retries}`, err);
        
        if (retries > 0) {
          setMsg(`Chunk ${i + 1} failed. Retrying... (${retries} left)`);
          await new Promise((res) => setTimeout(res, 5000)); // 5 sec wait before retry
        } else {
          // Agar 3 baar fail ho gaya toh error throw karein
          throw new Error(`Chunk ${i + 1} transcription failed after 3 attempts.`);
        }
      }
    }
  }
  finalTranscript = parts.join("\n").trim();
}

        // 3) Generate MOM (image optional)
        setMsg("Generating MOM…");
        if (hasImage) {
          const form = new FormData();
          form.append("image", image);
          if (finalTranscript) form.append("transcript", finalTranscript);
          const res = await axios.post(`${API_URL}/ai/mom-generator`, form, {
            headers: { "Content-Type": "multipart/form-data" },
            timeout: 120_000,
          });
          generated = res?.data?.mom || "";
        } else {
          const data = new URLSearchParams();
          if (finalTranscript) data.set("transcript", finalTranscript);
          const res = await axios.post(`${API_URL}/ai/mom-generator`, data, {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 120_000,
          });
          generated = res?.data?.mom || "";
        }
      } else {
        // Classic mode
        setMsg("Generating MOM (classic) …");
        const formData = new FormData();
        if (video) formData.append("video", video);
        if (image) formData.append("image", image);
        if (transcript.trim()) formData.append("transcript", transcript);
        const res = await axios.post(`${API_URL}/meeting-mom`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 90_000,
        });
        generated = res?.data?.mom || "";
      }

      setMom(generated);
      setMsg(generated ? "MOM generated successfully ✅" : "No content generated, try again.");

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
          momPreview: generated ? generated.slice(0, 90) + (generated.length > 90 ? "..." : "") : "—",
        });
        lastHistoryRef.current = { key, at: now };
      }

      if (now - lastSuccessRef.current > 800) {
        onSuccess?.("meeting-mom", "Meeting MOM Generator");
        lastSuccessRef.current = now;
      }

      // Clear inputs after success (keep transcript for quick edits)
      clearInputs();
    } catch (err) {
      console.error(err);
      const status = err?.response?.status;
      const body = err?.response?.data;
      const detail =
        body?.detail || (typeof body === "string" ? body : "") || err?.message || "Failed to generate MOM";
      setMsg(`❌ ${status ? status + " • " : ""}${detail}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ToolLayout
      title="Meeting MOM Generator"
      description="Upload meeting video/screenshot or paste transcript to generate Minutes of Meeting"
      onBack={() => setActiveTab?.("dashboard")}
    >
      {/* Debug badges (remove later) */}
      <div style={{ fontSize: 12, opacity: 0.5, marginTop: 6 }}>
        API: {import.meta.env.VITE_API_URL || "(not set)"}
      </div>
      <div style={{ fontSize: 12, opacity: 0.5 }}>MODE: {useAI ? "AI" : "Classic"}</div>

      {/* Upload Video */}
      <div style={{ marginBottom: 15 }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>Upload Meeting Video (optional)</label>
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
        <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>Upload Screenshot (OCR) (optional)</label>
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

      {/* Divider */}
      <div style={{ textAlign: "center", margin: "12px 0", opacity: 0.7, fontWeight: 700 }}>OR</div>

      {/* Transcript */}
      <div style={{ marginBottom: 15 }}>
        <label style={{ display: "block", marginBottom: 6, fontSize: 14 }}>
          Paste Meeting Transcript {useAI ? "(optional with files)" : ""}
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
              ? "Paste transcript here (optional if you upload media)."
              : "Paste transcript here (or upload meeting video/screenshot)."
          }
          style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc", resize: "vertical" }}
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
        <div style={{ marginTop: 14, fontSize: 14, color: msg.includes("❌") ? "#b91c1c" : "#166534" }}>{msg}</div>
      )}

      {/* Output */}
      {mom && (
        <div style={{ marginTop: 18 }}>
          <h3 style={{ marginBottom: 8 }}>Generated Minutes of Meeting</h3>
          <textarea
            rows={10}
            readOnly
            value={mom}
            style={{ width: "100%", padding: 10, borderRadius: 6, border: "1px solid #ccc", resize: "vertical" }}
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
        <div style={{ marginTop: 20, padding: 12, background: "#f8fafc", borderRadius: 8, fontSize: 13 }}>
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
      <button type="button" onClick={clearInputs} style={{ marginTop: 10, width: "100%", padding: 10 }}>
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