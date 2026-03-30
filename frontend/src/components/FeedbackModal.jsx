import React, { useEffect, useMemo, useState } from "react";
import axios from "axios"; // ✅ Axios import kiya

export default function FeedbackModal({ open, onClose, tools = {}, defaultToolTab = "dashboard" }) {
  const [toolTab, setToolTab] = useState(defaultToolTab);
  const [category, setCategory] = useState("UI");
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [msg, setMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false); // ✅ Loading state

  const toolOptions = useMemo(() => {
    const entries = Object.entries(tools || {})
      .filter(([tab]) => tab !== "dashboard")
      .map(([tab, meta]) => ({ tab, name: meta?.name || tab }));
    return [{ tab: "dashboard", name: "Dashboard / General" }, ...entries];
  }, [tools]);

  useEffect(() => {
    if (open) {
      setToolTab(defaultToolTab || "dashboard");
      setCategory("UI");
      setRating(5);
      setFeedback("");
      setMsg("");
    }
  }, [open, defaultToolTab]);

  const submit = async (e) => { // ✅ Async banaya
    e.preventDefault();

    const fbText = feedback.trim();
    if (!fbText) {
      setMsg("Please write your feedback 📝");
      return;
    }

    setIsSubmitting(true);
    const selected = toolOptions.find((t) => t.tab === toolTab);

    // ✅ Backend ke liye exact payload jo main.py expect kar raha hai
    const payload = {
      tool_name: selected?.name || toolTab,
      category: category,
      rating: rating,
      message: fbText
    };

    try {
      // ✅ Backend API call
      const response = await axios.post("http://localhost:8000/api/user/feedback", payload);
      
      if (response.status === 200 || response.status === 201) {
        setMsg("Thanks! Feedback saved to database ✅");
        setFeedback(""); // Clear input
        setTimeout(() => onClose?.(), 1500);
      }
    } catch (err) {
      console.error("Submission Error:", err);
      setMsg("Failed to send to server. Is backend running? ❌");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="settings-overlay" onClick={onClose} />
      <div className="feedback-modal">
        <div className="feedback-modal-head">
          <h3 style={{ margin: 0 }}>📝 Feedback</h3>
          <button className="feedback-close" onClick={onClose}>✖</button>
        </div>

        <p className="feedback-sub">
          Tell us what’s wrong or what to improve. This goes to the Admin.
        </p>

        <form onSubmit={submit}>
          <div style={{ marginBottom: 10 }}>
            <label className="fb-label">Which tool?</label>
            <select value={toolTab} onChange={(e) => setToolTab(e.target.value)} className="fb-input">
              {toolOptions.map((t) => (
                <option key={t.tab} value={t.tab}>{t.name}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label className="fb-label">What type?</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="fb-input">
              <option value="UI">UI / UX</option>
              <option value="Bug">Bug</option>
              <option value="Feature">Feature Request</option>
              <option value="Performance">Performance</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label className="fb-label">Rating</label>
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="fb-input">
              <option value={5}>★★★★★ (5)</option>
              <option value={4}>★★★★☆ (4)</option>
              <option value={3}>★★★☆☆ (3)</option>
              <option value={2}>★★☆☆☆ (2)</option>
              <option value={1}>★☆☆☆☆ (1)</option>
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label className="fb-label">Your feedback</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              placeholder="Explain what happened…"
              className="fb-input"
              disabled={isSubmitting}
            />
          </div>

          <button type="submit" className="fb-submit" disabled={isSubmitting}>
            {isSubmitting ? "Sending..." : "Submit Feedback"}
          </button>

          {msg && <div className={`fb-msg ${msg.includes('❌') ? 'error' : ''}`}>{msg}</div>}
        </form>
      </div>
    </>
  );
}