// src/hooks/useAuth.js
import { useEffect, useState } from "react";
import { api } from "../api/client";

const TOKEN_KEY = "ec_jwt_token";

// Аккуратный разбор JWT с учётом base64url
function parseJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return {};
    const payload = parts[1];

    // base64url -> base64
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);

    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return {};
  }
}

function isTokenExpired(payload) {
  // exp обычно в секундах
  const exp = payload?.exp;
  if (!exp) return false; // если exp нет — считаем "не знаем", не выкидываем
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec >= exp;
}

const initialAuth = {
  token: "",
  user: "",
  isAdmin: false,
  loading: false,
  error: "",
};

export function useAuth() {
  const [auth, setAuth] = useState(initialAuth);

  // ✅ Восстановление сессии при старте
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY) || "";
    if (!token) return;

    const payload = parseJwt(token);

    // Если токен протух — чистим и не восстанавливаем
    if (isTokenExpired(payload)) {
      localStorage.removeItem(TOKEN_KEY);
      api.setToken("");
      return;
    }

    api.setToken(token);

    const isAdmin = payload.role === "admin";
    const user = payload.username || payload.sub || "user";

    setAuth((prev) => ({
      ...prev,
      token,
      user,
      isAdmin,
      error: "",
      loading: false,
    }));
  }, []);

  async function login(username, password) {
    setAuth((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      // api.login сам вызовет api.setToken(access_token)
      const data = await api.login(username, password);
      const token = data?.access_token;
      if (!token) {
        throw new Error("Бэк не вернул access_token");
      }

      localStorage.setItem(TOKEN_KEY, token);

      const payload = parseJwt(token);
      const isAdmin = payload.role === "admin";

      setAuth({
        token,
        user: payload.username || payload.sub || username,
        isAdmin,
        loading: false,
        error: "",
      });

      return true;
    } catch (err) {
      const message =
        err?.response?.data?.detail ||
        err?.message ||
        "Не удалось войти";

      setAuth((prev) => ({
        ...prev,
        loading: false,
        error: message,
      }));
      return false;
    }
  }

  function logout() {
    api.setToken("");
    localStorage.removeItem(TOKEN_KEY);
    setAuth(initialAuth);
    window.location.hash = "/login";
  }

  return { auth, login, logout };
}
