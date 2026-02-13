import React, { useState } from "react";

export default function LoginPage({ auth, onLogin }) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try { await onLogin(username, password); } finally { setBusy(false); }
  }

  return (
    <div className="ec-auth">
      <form className="ec-auth__card" onSubmit={submit}>
        <h2 className="ec-auth__title">Вход в систему</h2>
        <label className="ec-label">Логин
          <input className="ec-input" value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="ec-label">Пароль
          <input type="password" className="ec-input" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {auth.error && <div className="ec-auth__error">❗ {auth.error}</div>}
        <div className="ec-add__actions">
          <button type="submit" className="btn btn-primary" disabled={busy || auth.loading}>
            {busy || auth.loading ? "Входим…" : "Войти"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => (window.location.hash = "/")}>Отмена</button>
        </div>
        <p className="ec-hint">Тест: <b>admin / admin</b></p>
      </form>
    </div>
  );
}
