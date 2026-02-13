import React, { useEffect, useMemo, useState } from "react";

const FEEDBACK_KEY = "dashboard_feedback_hidden_v2";

export default function FeedbackModal({ open, onClose, tools = {}, defaultToolTab = "dashboard" }) {
  const [toolTab, setToolTab] = useState(defaultToolTab);
  const [category, setCategory] = useState("UI"); // UI | Bug | Feature | Performance | Other
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [msg, setMsg] = useState("");

  const toolOptions = useMemo(() => {
    const entries = Object.entries(tools || {})
      .filter(([tab]) => tab !== "dashboard") // dashboard optional
      .map(([tab, meta]) => ({ tab, name: meta?.name || tab }));
    // add dashboard/general
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

  const submit = (e) => {
    e.preventDefault();

    const fb = feedback.trim();
    if (!fb) {
      setMsg("Please write your feedback ✅");
      return;
    }

    const selected = toolOptions.find((t) => t.tab === toolTab);
    const payload = {
      id: Date.now(),
      toolTab,
      toolName: selected?.name || toolTab,
      category,
      rating,
      feedback: fb,
      createdAt: new Date().toISOString()
    };

    const old = JSON.parse(localStorage.getItem(FEEDBACK_KEY) || "[]");
    const updated = [payload, ...(Array.isArray(old) ? old : [])].slice(0, 80);
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(updated));

    setMsg("Thanks! Feedback saved ✅");
    setTimeout(() => onClose?.(), 700);
  };

  if (!open) return null;

  return (
    <>
      <div className="settings-overlay" onClick={onClose} />

      <div className="feedback-modal">
        <div className="feedback-modal-head">
          <h3 style={{ margin: 0 }}>📝 Feedback</h3>
          <button className="feedback-close" onClick={onClose} aria-label="Close">
            ✖
          </button>
        </div>

        <p className="feedback-sub">
          Tell us what’s wrong or what to improve. This is saved locally.
        </p>

        <form onSubmit={submit}>
          {/* ✅ Which tool */}
          <div style={{ marginBottom: 10 }}>
            <label className="fb-label">Which tool?</label>
            <select
              value={toolTab}
              onChange={(e) => setToolTab(e.target.value)}
              className="fb-input"
            >
              {toolOptions.map((t) => (
                <option key={t.tab} value={t.tab}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* ✅ Category */}
          <div style={{ marginBottom: 10 }}>
            <label className="fb-label">What type?</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="fb-input"
            >
              <option value="UI">UI / UX</option>
              <option value="Bug">Bug</option>
              <option value="Feature">Feature Request</option>
              <option value="Performance">Performance</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Rating */}
          <div style={{ marginBottom: 10 }}>
            <label className="fb-label">Rating</label>
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="fb-input"
            >
              <option value={5}>★★★★★ (5)</option>
              <option value={4}>★★★★☆ (4)</option>
              <option value={3}>★★★☆☆ (3)</option>
              <option value={2}>★★☆☆☆ (2)</option>
              <option value={1}>★☆☆☆☆ (1)</option>
            </select>
          </div>

          {/* Feedback text */}
          <div style={{ marginBottom: 12 }}>
            <label className="fb-label">Your feedback</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              placeholder="Explain what happened / what to improve…"
              className="fb-input"
              style={{ resize: "vertical" }}
            />
          </div>

          <button type="submit" className="fb-submit">
            Submit Feedback
          </button>

          {msg && <div className="fb-msg">{msg}</div>}
        </form>
      </div>
    </>
  );
}