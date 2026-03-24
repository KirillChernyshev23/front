import React, { useState } from "react";

export default function LoginPage({ auth, onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await onLogin(username, password);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ec-auth">
      <form className="ec-auth__card" onSubmit={submit}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "#111827",
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              marginBottom: 12,
            }}
          >
            🎓
          </div>
          <h2 className="ec-auth__title" style={{ textAlign: "center" }}>
            Вход в систему
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "#6b7280",
            }}
          >
            HE Collection
          </p>
        </div>

        <label className="ec-label">
          Логин
          <input
            className="ec-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            style={{ marginTop: 6, width: "100%" }}
          />
        </label>

        <label className="ec-label">
          Пароль
          <input
            type="password"
            className="ec-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ marginTop: 6, width: "100%" }}
          />
        </label>

        {auth.error && <div className="ec-auth__error">{auth.error}</div>}

        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy || auth.loading}
            style={{ flex: 1, padding: "12px 16px" }}
          >
            {busy || auth.loading ? "Входим…" : "Войти"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => (window.location.hash = "/")}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}