import React from "react";

export default function Header({
  route,
  query,
  onQuery,
  onClear,
  onGoAdd,
  onGoList,
  onGoAdmin,
  onGoAnalytics,
  onGoPotential,
  auth,
  onLogout,
}) {
  const isPotential =
    route === "potential" ||
    (typeof route === "string" && route.startsWith("potential_edit:"));

  return (
    <header className="ec-header">
      <div className="ec-header__top">
        <div
          className="ec-brand"
          onClick={onGoList}
          style={{ cursor: "pointer" }}
        >
          <div className="ec-logo">🎓</div>
          <div>
            <h1 className="ec-title">HE Collection</h1>
            <div className="ec-subtitle">Информационно-аналитическая система</div>
          </div>
        </div>

        <div className="ec-actions">
          {auth.isAdmin && route !== "add" && (
            <button className="btn btn-primary" onClick={onGoAdd}>
              Добавить документ
            </button>
          )}

          {auth.isAdmin && route !== "admin" && (
            <button
              className="btn btn-secondary"
              onClick={onGoAdmin}
              style={{ marginLeft: "0.5rem" }}
            >
              Администрирование
            </button>
          )}

          {route !== "analytics" && (
            <button
              className="btn btn-secondary"
              onClick={onGoAnalytics}
              style={{ marginLeft: "0.5rem" }}
            >
              Статистика
            </button>
          )}

          {auth.isAdmin && !isPotential && (
            <button
              className="btn btn-secondary"
              onClick={onGoPotential}
              style={{ marginLeft: "0.5rem" }}
              type="button"
            >
              Предложенное
            </button>
          )}

          {!auth.token ? (
            <button
              className="btn btn-secondary"
              onClick={() => (window.location.hash = "/login")}
              style={{ marginLeft: "0.5rem" }}
            >
              Войти
            </button>
          ) : (
            <div className="ec-user">
              <span className="ec-user__name">👤 {auth.user || "user"}</span>
              <button
                className="btn btn-ghost"
                onClick={onLogout}
                style={{ marginLeft: "0.5rem" }}
              >
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>

      {route === "list" && (
        <div className="ec-search">
          <input
            className="ec-search__input"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Поиск"
          />
          {query && (
            <button className="btn btn-ghost" onClick={onClear}>
              Сбросить
            </button>
          )}
        </div>
      )}
    </header>
  );
}
