import axios from "axios";

const API_BASE = "http://127.0.0.1:8000"; // Backend URL
export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");


// ✅ Common fetch wrapper (use everywhere)
export async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "Request failed");
  return data;
}


export const pdfToText = async (file) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await axios.post(`${API_BASE}/pdf/to-text`, formData, {
            headers: {
                "Content-Type": "multipart/form-data"
            }
        });
        return response.data; // { text: "...", id: ... }
    } catch (error) {
        console.error("Error uploading PDF:", error);
        throw error;
    }
};
