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

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");

  async function loadUsers() {
    try {
      if (!auth?.isAdmin) return;

      setUsersLoading(true);
      setUsersError("");

      const data = await api.listUsers();
      // поддерживаем оба варианта ответа: массив или { users: [...] }
      const usersArr = Array.isArray(data)
        ? data
        : Array.isArray(data.users)
        ? data.users
        : [];

      setUsers(usersArr);
      console.log("USERS FROM API:", usersArr);
    } catch (err) {
      setUsersError(err?.message || "Не удалось загрузить пользователей");
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    loadUsers().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const role = isAdmin ? "admin" : "user";

      await api.createUser({
        username,
        email,
        password,
        role,
      });

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
    // пробуем найти хоть какой-то id-подобный ключ
    const id =
      user?.id ??
      user?.user_id ??
      user?.pk ??
      null;

    if (!id) {
      alert(
        "Не удалось определить ID пользователя для удаления.\n" +
          "Посмотри ответ /auth/users: нужно, чтобы там было поле id (или user_id)."
      );
      console.log("Нет id у пользователя:", user);
      return;
    }

    if (auth?.user && user.username === auth.user) {
      alert("Нельзя удалить самого себя.");
      return;
    }

    if (!window.confirm(`Удалить пользователя "${user.username}"?`)) {
      return;
    }

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
          <input
            className="ec-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
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
          />
        </label>

        <label className="ec-label ec-label--inline">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
          />{" "}
          Сделать администратором
        </label>

        {message && <div className="ec-auth__error">{message}</div>}

        <div className="ec-add__actions">
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Создаём…" : "Создать пользователя"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => (window.location.hash = "/")}
          >
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
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleDeleteUser(u)}
                        >
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
    </div>
  );
}
