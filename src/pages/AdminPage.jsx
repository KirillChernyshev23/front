// src/pages/AdminPage.jsx
import React, { useEffect, useState } from "react";
import { api } from "../api/client";

export default function AdminPage({ auth }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info"); // "info" | "error"

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");

  const [sites, setSites] = useState([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [sitesError, setSitesError] = useState("");

  async function loadUsers() {
    try {
      if (!auth?.isAdmin) return;
      setUsersLoading(true);
      setUsersError("");
      const data = await api.listUsers();
      const usersArr = Array.isArray(data)
        ? data
        : Array.isArray(data.users)
        ? data.users
        : [];
      setUsers(usersArr);
    } catch (err) {
      setUsersError(err?.message || "Не удалось загрузить пользователей");
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadSites() {
    try {
      if (!auth?.isAdmin) return;
      setSitesLoading(true);
      setSitesError("");
      const data = await api.listSourceSites();
      const sitesArr = Array.isArray(data)
        ? data
        : Array.isArray(data.sites)
        ? data.sites
        : [];
      setSites(sitesArr);
    } catch (err) {
      setSitesError(err?.message || "Не удалось загрузить сайты-источники");
    } finally {
      setSitesLoading(false);
    }
  }

  useEffect(() => {
    if (!auth?.isAdmin) return;
    loadUsers().catch(() => {});
    loadSites().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth?.isAdmin]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const role = isAdmin ? "admin" : "user";
      await api.createUser({ username, email, password, role });
      setMessage(`Пользователь «${username}» создан (${role})`);
      setMessageType("info");
      setUsername("");
      setEmail("");
      setPassword("");
      setIsAdmin(false);
      await loadUsers();
    } catch (err) {
      setMessage(err?.message || String(err));
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteUser(user) {
    const id = user?.id ?? user?.user_id ?? user?.pk ?? null;
    if (!id) {
      alert("Не удалось определить ID пользователя для удаления.");
      return;
    }
    if (auth?.user && user.username === auth.user) {
      alert("Нельзя удалить самого себя.");
      return;
    }
    if (!window.confirm(`Удалить пользователя «${user.username}»?`)) return;
    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch (err) {
      alert(`Не удалось удалить: ${err?.message || err}`);
    }
  }

  if (!auth?.isAdmin) {
    return (
      <div style={{ padding: "32px 0", textAlign: "center" }}>
        <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 12 }}>🔒</div>
        <h2 style={{ margin: "0 0 8px" }}>Администрирование</h2>
        <p style={{ color: "#6b7280" }}>
          Доступ к этой странице есть только у администраторов.
        </p>
      </div>
    );
  }

  const cardStyle = {
    background: "rgba(255,255,255,0.75)",
    backdropFilter: "saturate(180%) blur(10px)",
    border: "1px solid rgba(255,255,255,0.55)",
    borderRadius: 16,
    boxShadow: "0 2px 8px rgba(2,6,23,0.06)",
    padding: "20px 24px",
  };

  const tableStyle = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 14,
  };

  const thStyle = {
    textAlign: "left",
    padding: "10px 12px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#6b7280",
    borderBottom: "2px solid rgba(15,23,42,0.06)",
  };

  const tdStyle = {
    padding: "10px 12px",
    borderBottom: "1px solid rgba(15,23,42,0.04)",
    color: "#1a1a2e",
  };

  const sectionTitle = {
    margin: "0 0 16px",
    fontSize: 18,
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    gap: 10,
  };

  return (
    <div style={{ padding: "8px 0", maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
          Администрирование
        </h2>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => (window.location.hash = "/")}
          style={{ fontSize: 13 }}
        >
          ← На главную
        </button>
      </div>

      {/* Top row: form + users table */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          gap: 16,
          alignItems: "start",
          marginBottom: 16,
        }}
      >
        {/* Create user form */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>Новый пользователь</h3>

          <form onSubmit={handleSubmit}>
            <label className="ec-label">
              Логин
              <input
                className="ec-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                style={{ marginTop: 4, width: "100%" }}
              />
            </label>

            <label className="ec-label">
              Email
              <input
                type="email"
                className="ec-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ marginTop: 4, width: "100%" }}
              />
            </label>

            <label className="ec-label">
              Пароль
              <input
                type="password"
                className="ec-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={{ marginTop: 4, width: "100%" }}
              />
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginTop: 12,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={isAdmin}
                onChange={(e) => setIsAdmin(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#111827" }}
              />
              Администратор
            </label>

            {message && (
              <div
                style={{
                  marginTop: 10,
                  padding: "8px 12px",
                  borderRadius: 10,
                  fontSize: 13,
                  background:
                    messageType === "error"
                      ? "rgba(220,38,38,0.06)"
                      : "rgba(16,185,129,0.08)",
                  border:
                    messageType === "error"
                      ? "1px solid rgba(220,38,38,0.15)"
                      : "1px solid rgba(16,185,129,0.2)",
                  color: messageType === "error" ? "#991b1b" : "#065f46",
                }}
              >
                {message}
              </div>
            )}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy}
              style={{ width: "100%", marginTop: 14 }}
            >
              {busy ? "Создаём…" : "Создать пользователя"}
            </button>
          </form>
        </div>

        {/* Users table */}
        <div style={cardStyle}>
          <div style={sectionTitle}>
            <span>Пользователи</span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#6b7280",
                background: "rgba(15,23,42,0.04)",
                padding: "2px 10px",
                borderRadius: 999,
              }}
            >
              {users.length}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={loadUsers}
              disabled={usersLoading}
              style={{ fontSize: 12, padding: "4px 10px", marginLeft: "auto" }}
            >
              {usersLoading ? "…" : "↻"}
            </button>
          </div>

          {usersLoading && (
            <p style={{ color: "#6b7280", fontSize: 14 }}>Загружаем…</p>
          )}
          {usersError && (
            <div
              style={{
                background: "rgba(220,38,38,0.06)",
                border: "1px solid rgba(220,38,38,0.15)",
                color: "#991b1b",
                padding: "8px 12px",
                borderRadius: 10,
                fontSize: 13,
              }}
            >
              {usersError}
            </div>
          )}

          {!usersLoading && !usersError && (
            <>
              {users.length === 0 ? (
                <p style={{ color: "#6b7280", fontSize: 14 }}>
                  Пользователей пока нет.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Логин</th>
                        <th style={thStyle}>Роль</th>
                        <th style={thStyle}>Email</th>
                        <th style={{ ...thStyle, width: 80 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id ?? u.username}>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 600 }}>
                              {u.username}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                padding: "3px 8px",
                                borderRadius: 999,
                                background:
                                  u.role === "admin"
                                    ? "#111827"
                                    : "rgba(15,23,42,0.06)",
                                color:
                                  u.role === "admin" ? "#fff" : "#374151",
                              }}
                            >
                              {u.role}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, color: "#6b7280" }}>
                            {u.email}
                          </td>
                          <td style={tdStyle}>
                            {auth?.user !== u.username && (
                              <button
                                className="btn btn-ghost"
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                style={{
                                  fontSize: 12,
                                  padding: "4px 10px",
                                  color: "#dc2626",
                                }}
                              >
                                Удалить
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sites table — full width */}
      <div style={cardStyle}>
        <div style={sectionTitle}>
          <span>Сайты-источники</span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "#6b7280",
              background: "rgba(15,23,42,0.04)",
              padding: "2px 10px",
              borderRadius: 999,
            }}
          >
            {sites.length}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={loadSites}
            disabled={sitesLoading}
            style={{ fontSize: 12, padding: "4px 10px", marginLeft: "auto" }}
          >
            {sitesLoading ? "…" : "↻"}
          </button>
        </div>

        {sitesLoading && (
          <p style={{ color: "#6b7280", fontSize: 14 }}>Загружаем…</p>
        )}
        {sitesError && (
          <div
            style={{
              background: "rgba(220,38,38,0.06)",
              border: "1px solid rgba(220,38,38,0.15)",
              color: "#991b1b",
              padding: "8px 12px",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            {sitesError}
          </div>
        )}

        {!sitesLoading && !sitesError && (
          <>
            {sites.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: 14 }}>
                Сайтов-источников пока нет.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={tableStyle}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: 60 }}>ID</th>
                      <th style={thStyle}>Название</th>
                      <th style={thStyle}>URL</th>
                      <th style={{ ...thStyle, width: 90 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((s) => (
                      <tr key={s.id ?? `${s.name}-${s.url}`}>
                        <td style={{ ...tdStyle, color: "#6b7280" }}>
                          {s.id ?? "—"}
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>
                          {s.name ?? "—"}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            maxWidth: 480,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={s.url || ""}
                        >
                          {s.url ? (
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: "#2563eb" }}
                            >
                              {s.url.length > 70
                                ? s.url.slice(0, 70) + "…"
                                : s.url}
                            </a>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td style={tdStyle}>
                          {s.url && (
                            <button
                              className="btn btn-ghost"
                              type="button"
                              onClick={() =>
                                window.open(
                                  s.url,
                                  "_blank",
                                  "noopener,noreferrer"
                                )
                              }
                              style={{ fontSize: 12, padding: "4px 10px" }}
                            >
                              Открыть
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}