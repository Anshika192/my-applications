import React, { useState } from "react";
import { login, signup, saveAuth } from "../api/auth";

export default function AuthModal({ open, onClose, onAuthed }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const data =
        mode === "signup"
          ? await signup({ name, email, password })
          : await login({ email, password });

      saveAuth(data.access_token, data.user);
      onAuthed?.(data.user);
      onClose?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.head}>
          <h3 style={{ margin: 0 }}>{mode === "login" ? "Log In" : "Sign Up"}</h3>
          <button onClick={onClose} style={styles.x}>✕</button>
        </div>

        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          {mode === "signup" && (
            <input
              style={styles.input}
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}

          <input
            style={styles.input}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            style={styles.input}
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {err && <div style={styles.err}>{err}</div>}

          <button disabled={loading} style={styles.btn}>
            {loading ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>

        <div style={{ marginTop: 12, fontSize: 13 }}>
          {mode === "login" ? (
            <>New user? <span style={styles.link} onClick={() => setMode("signup")}>Sign up</span></>
          ) : (
            <>Already have account? <span style={styles.link} onClick={() => setMode("login")}>Log in</span></>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", zIndex: 999999 },
  card: { width: "min(420px, 92vw)", background: "#fff", borderRadius: 16, padding: 16, boxShadow: "0 12px 30px rgba(0,0,0,.25)" },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  x: { border: "none", background: "transparent", fontSize: 18, cursor: "pointer" },
  input: { padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", outline: "none" },
  btn: { padding: "10px 12px", borderRadius: 10, border: "none", background: "#111827", color: "#fff", cursor: "pointer", fontWeight: 700 },
  err: { color: "#b91c1c", fontSize: 13 },
  link: { color: "#2563eb", cursor: "pointer", fontWeight: 700 }
};
