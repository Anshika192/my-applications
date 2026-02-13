// frontend/src/api/userData.js
import { API_URL } from "./pdfApi";
import { getToken } from "./auth";

async function request(path, { method = "GET", body } = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.detail || data?.message || "Request failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data;
}

/** Load all dashboard user state in one go */
export async function fetchUserDashboardState() {
  const [recent, usage, favourites, suggestions] = await Promise.all([
    request("/user/recent"),
    request("/user/usage"),
    request("/user/favourites"),
    request("/user/suggestions")
  ]);

  const usageCount = {};
  (usage || []).forEach((u) => {
    usageCount[u.tab] = u.count;
  });

  return {
    recent: recent || [],
    usageCount,
    favourites: favourites || [],
    suggestions: suggestions || []
  };
}

/** Recent */
export const addRecent = (tab, name) =>
  request("/user/recent", { method: "POST", body: { tab, name } });

export const clearRecent = () =>
  request("/user/recent", { method: "DELETE" });

/** Usage */
export const bumpUsage = (tab) =>
  request("/user/usage", { method: "POST", body: { tab, name: tab } });

export const clearUsage = () =>
  request("/user/usage", { method: "DELETE" });

/** Favourites (toggle) */
export const toggleFavouriteApi = (app) =>
  request("/user/favourites", { method: "POST", body: app });

/** Suggestions (Suggestion Box) */
export const fetchUserSuggestions = () =>
  request("/user/suggestions");

export const addUserSuggestion = (toolIdea, note) =>
  request("/user/suggestions", { method: "POST", body: { toolIdea, note } });

export const clearUserSuggestions = () =>
  request("/user/suggestions", { method: "DELETE" });