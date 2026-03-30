// frontend/src/api/userData.js
import { API_URL } from "./pdfApi";
import { getToken } from "./auth";

/**
 * Low-level request helper for user-protected routes.
 * - Automatically attaches Bearer token from localStorage (myapps_token).
 * - Skips network call when token is missing (returns sensible defaults).
 * - Parses JSON safely. Surfaces real backend messages.
 */
async function request(path, { method = "GET", body } = {}) {
  const token = getToken(); // must return USER token (myapps_token)
  if (!token) {
    // Not logged in → behave gracefully per endpoint
    throw new Error("Not authenticated");
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Safe JSON parse (backend may send plain text on errors)
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  // Graceful 401 handling for nicer UX (optional redirect commented)
  if (res.status === 401) {
    throw new Error("Not authenticated");
  }

  if (!res.ok) {
    const msg = data?.detail || data?.message || res.statusText || "Request failed";
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return data;
}

/**
 * Helper: run a protected call only if token exists.
 * If token missing → returns provided fallback without hitting network.
 */
function runIfAuthed(fn, fallback) {
  const token = getToken();
  if (!token) return Promise.resolve(fallback);
  return fn();
}

/** ----------------------------------------------
 *  Dashboard aggregate (Recent, Usage, Favourites, Suggestions)
 *  ---------------------------------------------- */
export async function fetchUserDashboardState() {
  const token = getToken();
  if (!token) {
    return { recent: [], usageCount: {}, favourites: [], suggestions: [] };
  }

  const [recent, usage, favourites, suggestions] = await Promise.all([
    request("/user/recent").catch(() => []),
    request("/user/usage").catch(() => []),
    request("/user/favourites").catch(() => []),
    request("/user/suggestions").catch(() => []),
  ]);

  const usageCount = {};
  (usage || []).forEach((u) => {
    if (u && u.tab) usageCount[u.tab] = u.count || 0;
  });

  return {
    recent: recent || [],
    usageCount,
    favourites: favourites || [],
    suggestions: suggestions || [],
  };
}

/** ----------------------------------------------
 *  Recent
 *  ---------------------------------------------- */
export const addRecent = (tab, name) =>
  runIfAuthed(() => request("/user/recent", { method: "POST", body: { tab, name } }), []);

export const clearRecent = () =>
  runIfAuthed(() => request("/user/recent", { method: "DELETE" }), { ok: true });

/** ----------------------------------------------
 *  Usage
 *  ---------------------------------------------- */
export const bumpUsage = (tab) =>
  runIfAuthed(() => request("/user/usage", { method: "POST", body: { tab, name: tab } }), { ok: true });

export const clearUsage = () =>
  runIfAuthed(() => request("/user/usage", { method: "DELETE" }), { ok: true });

/** ----------------------------------------------
 *  Favourites (toggle)
 *  ---------------------------------------------- */
export const toggleFavouriteApi = (app) =>
  runIfAuthed(() => request("/user/favourites", { method: "POST", body: app }), []);

/** ----------------------------------------------
 *  Suggestions (My + Public)
 *  ---------------------------------------------- */

export const fetchUserSuggestions = () =>
  runIfAuthed(() => request("/user/suggestions"), []);

export const fetchAllSuggestions = () =>
  runIfAuthed(() => request("/user/suggestions/all"), []);

export const addUserSuggestion = (toolIdea, note) =>
  runIfAuthed(() =>
    request("/user/suggestions", {
      method: "POST",
      body: { toolIdea, note }
    })
  , []);

export const deleteSuggestion = (id) =>
  runIfAuthed(() =>
    request(`/user/suggestions/${id}`, {
      method: "DELETE"
    })
  , null);

export const toggleSuggestionLike = (id) =>
  runIfAuthed(() =>
    request(`/user/suggestions/${id}/like`, {
      method: "POST"
    })
  , null);

export const clearUserSuggestions = () =>
  runIfAuthed(() => request("/user/suggestions", { method: "DELETE" }), { ok: true });