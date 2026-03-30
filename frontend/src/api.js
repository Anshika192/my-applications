export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");

export const fetchApplications = async () => {
    const response = await fetch(`${API_URL}/applications`);
    return response.json();
};

export const fetchSuggestions = async () => {
    const response = await fetch(`${API_URL}/suggestions`);
    return response.json();
};

export const createSuggestion = async (text) => {
    const response = await fetch(`${API_URL}/suggestions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
    });
    return response.json();
};

export const voteSuggestion = async (id, type, userId) => {
    const response = await fetch(`${API_URL}/suggestions/${id}/vote?vote_type=${type}&user_id=${userId}`, {
        method: "POST",
    });
    return response.json();
};


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

