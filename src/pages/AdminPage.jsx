// src/pages/AdminPage.jsx
import React, { useEffect, useState } from "react";
import { api } from "../api/client";

/**
 * TODO: поменяй на реальную ручку бэка, когда будет готово
 * Пример: "/collector/source-suggestions"
 */
const SOURCE_SUGGESTION_GET_PATH = "/collector/source-suggestions";

export default function AdminPage({ auth }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");

  // ===== NEW: предложения источников (только ссылка) =====
  const [sources, setSources] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [sourcesError, setSourcesError] = useState("");

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

  async function loadSourceSuggestions() {
    try {
      if (!auth?.isAdmin) return;

      setSourcesLoading(true);
      setSourcesError("");

      const data = await api._fetch(SOURCE_SUGGESTION_GET_PATH, { method: "GET" });

      // поддержка массива или { items: [...] }
      const arr = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
        ? data.items
        : [];

      // оставляем только url, терпим разные ключи
      const urls = arr
        .map((x) => x?.url ?? x?.link ?? x?.source_link ?? x?.sourceLink ?? "")
        .map((u) => String(u || "").trim())
        .filter(Boolean);

      setSources(urls);
    } catch (err) {
      setSourcesError(
        err?.message ||
          "Не удалось загрузить предложения."
      );
      setSources([]);
    } finally {
      setSourcesLoading(false);
    }
  }

  useEffect(() => {
    loadUsers().catch(() => {});
    loadSourceSuggestions().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const role = isAdmin ? "admin" : "user";

      await api.createUser({ username, email, password, role });

      setMessage(`Пользователь "${username}" создан (${role})`);
      setUsername("");
      setEmail("");
      setPassword("");
      setIsAdmin(false);

      await loadUsers();
    } catch (err) {
      setMessage(`Ошибка: ${err?.message || err}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteUser(user) {
    const id = user?.id ?? user?.user_id ?? user?.pk ?? null;

    if (!id) {
      alert(
        "Не удалось определить ID пользователя для удаления.\n" +
          "Посмотри ответ /auth/users: нужно, чтобы там было поле id (или user_id)."
      );
      return;
    }

    if (auth?.user && user.username === auth.user) {
      alert("Нельзя удалить самого себя.");
      return;
    }

    if (!window.confirm(`Удалить пользователя "${user.username}"?`)) return;

    try {
      await api.deleteUser(id);
      await loadUsers();
    } catch (err) {
      alert(`Не удалось удалить пользователя: ${err?.message || err}`);
    }
  }

  if (!auth?.isAdmin) {
    return (
      <div className="ec-page">
        <h2>Администрирование</h2>
        <p>Доступ к этой странице есть только у администраторов.</p>
      </div>
    );
  }

  return (
    <div className="ec-auth">
      <form className="ec-auth__card" onSubmit={handleSubmit}>
        <h2 className="ec-auth__title">Управление пользователями</h2>

        <label className="ec-label">
          Логин
          <input className="ec-input" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>

        <label className="ec-label">
          Email
          <input type="email" className="ec-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label className="ec-label">
          Пароль
          <input type="password" className="ec-input" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>

        <label className="ec-label ec-label--inline">
          <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />{" "}
          Сделать администратором
        </label>

        {message && <div className="ec-auth__error">{message}</div>}

        <div className="ec-add__actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Создаём…" : "Создать пользователя"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => (window.location.hash = "/")}>
            Назад
          </button>
        </div>
      </form>

      <div className="ec-auth__card" style={{ marginTop: "1.5rem" }}>
        <h3 className="ec-auth__title">Список пользователей</h3>

        {usersLoading && <p>Загружаем пользователей…</p>}
        {usersError && <p className="ec-auth__error">{usersError}</p>}

        {!usersLoading && !usersError && (
          <>
            {users.length === 0 ? (
              <p>Пользователей пока нет.</p>
            ) : (
              <table className="ec-table">
                <thead>
                  <tr>
                    <th>Логин</th>
                    <th>Роль</th>
                    <th>Email</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id ?? u.username}>
                      <td>{u.username}</td>
                      <td>{u.role}</td>
                      <td>{u.email}</td>
                      <td>
                        <button className="btn btn-ghost" onClick={() => handleDeleteUser(u)}>
                          Удалить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>

      {/* ===== NEW: предложения источников (только ссылки) ===== */}
      <div className="ec-auth__card" style={{ marginTop: "1.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <h3 className="ec-auth__title" style={{ margin: 0 }}>
            Предложения источников
          </h3>

          <button type="button" className="btn btn-ghost" onClick={loadSourceSuggestions} disabled={sourcesLoading}>
            {sourcesLoading ? "Обновляем…" : "Обновить"}
          </button>
        </div>

        {sourcesLoading && <p>Загружаем предложения…</p>}
        {sourcesError && <p className="ec-auth__error">{sourcesError}</p>}

        {!sourcesLoading && !sourcesError && (
          <>
            {sources.length === 0 ? (
              <p>Предложений пока нет.</p>
            ) : (
              <ul style={{ marginTop: 10, paddingLeft: 18 }}>
                {sources.map((u, idx) => (
                  <li key={`${u}-${idx}`} style={{ marginBottom: 6 }}>
                    <a href={u} target="_blank" rel="noreferrer">
                      {u}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
