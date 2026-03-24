import React from "react";

export default function Header({
  route,
  query,
  onQuery,
  onSearch,
  onClear,
  onGoAdd,
  onGoList,
  onGoAdmin,
  onGoAnalytics,
  onGoPotential,
  onGoWorkspace,
  auth,
  onLogout,
}) {
  const isPotential =
    route === "potential" ||
    (typeof route === "string" && route.startsWith("potential_edit:"));

  function handleSearchKeyDown(e) {
    if (e.key === "Enter" && onSearch) {
      onSearch();
    }
  }

  return (
    <header className="ec-header">
      {/* Row 1: brand + nav + user */}
      <div className="ec-header__top">
        <div
          className="ec-brand"
          onClick={onGoList}
          style={{ cursor: "pointer" }}
        >
          <div className="ec-logo">🎓</div>
          <div>
            <h1 className="ec-title" style={{ fontSize: 26 }}>
              HE Collection
            </h1>
            <div className="ec-subtitle">
              Информационно-аналитическая система
            </div>
          </div>
        </div>

        <nav className="ec-actions">
          {auth.isAdmin && route !== "add" && (
            <button className="btn btn-primary" onClick={onGoAdd}>
              <span style={{ marginRight: 5 }}>＋</span>
              Добавить документ
            </button>
          )}

          {auth.isAdmin && route !== "admin" && (
            <button className="btn btn-secondary" onClick={onGoAdmin}>
              Администрирование
            </button>
          )}

          {auth.token && route !== "analytics" && (
            <button className="btn btn-secondary" onClick={onGoAnalytics}>
              Статистика
            </button>
          )}

          {auth.token && route !== "workspace" && (
            <button
              className="btn btn-secondary"
              onClick={onGoWorkspace}
              type="button"
            >
              Мои проекты
            </button>
          )}

          {auth.isAdmin && !isPotential && (
            <button
              className="btn btn-secondary"
              onClick={onGoPotential}
              type="button"
            >
              Предложенное
            </button>
          )}

          {!auth.token ? (
            <button
              className="btn btn-secondary"
              onClick={() => (window.location.hash = "/login")}
            >
              Войти
            </button>
          ) : (
            <div className="ec-user">
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#111827",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {(auth.user || "U").charAt(0).toUpperCase()}
              </div>
              <span className="ec-user__name">{auth.user || "user"}</span>
              <button className="btn btn-ghost" onClick={onLogout}>
                Выйти
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* Row 2: search — centered, wider */}
      {route === "list" && (
        <div
          className="ec-search"
          style={{
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              flex: "1 1 auto",
              maxWidth: 700,
            }}
          >
            <span
              style={{
                position: "absolute",
                left: 16,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9ca3af",
                fontSize: 16,
                pointerEvents: "none",
              }}
            >
            </span>
            <input
              className="ec-search__input"
              style={{ paddingLeft: 22, width: "100%" }}
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Поиск..."
            />
          </div>
          <button
            className="btn btn-primary"
            onClick={onSearch}
            type="button"
          >
            Найти
          </button>
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