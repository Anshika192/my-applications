import { api } from "./pdfApi";

const TOKEN_KEY = "myapps_token";
const USER_KEY = "myapps_user";

export const saveAuth = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export const getUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
  catch { return null; }
};

export const signup = (payload) =>
  api("/auth/signup", { method: "POST", body: payload });

export const login = (payload) =>
  api("/auth/login", { method: "POST", body: payload });

export const me = () =>
  api("/auth/me", { token: getToken() });

export const authHeader = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};