// src/App.js
import React, { useEffect, useState } from "react";
import Header from "./components/Header";
import SidebarFilters from "./components/SidebarFilters";
import SortBar from "./components/SortBar";
import ResultsList from "./components/ResultsList";
import Pagination from "./components/Pagination";
import LoginPage from "./pages/LoginPage";
import AddPage from "./pages/AddPage";
import AdminPage from "./pages/AdminPage";
import EditPage from "./pages/EditPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import PotentialDocsPage from "./pages/PotentialDocsPage";
import PotentialEditPage from "./pages/PotentialEditPage";
import WorkspacePage from "./pages/WorkspacePage";
import { useAuth } from "./hooks/useAuth";
import { useDocs } from "./hooks/useDocs";
import { api } from "./api/client";

const LAST_ROUTE_AFTER_LOGIN = "ec_after_login_route";

export default function App() {
  const { auth, login, logout } = useAuth();
  const { state, dispatch, reload, doSearch } = useDocs(auth.token);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const isEditRoute =
    typeof state.route === "string" && state.route.startsWith("edit:");
  const currentEditId = isEditRoute
    ? parseInt(state.route.split(":")[1], 10)
    : null;

  const isPotentialEditRoute =
    typeof state.route === "string" &&
    state.route.startsWith("potential_edit:");
  const currentPotentialEditId = isPotentialEditRoute
    ? parseInt(state.route.split(":")[1], 10)
    : null;

  const isWorkspaceRoute = state.route === "workspace";

  useEffect(() => {
    if (state.route === "add") {
      if (!auth.token) {
        localStorage.setItem(LAST_ROUTE_AFTER_LOGIN, "/add");
        window.location.hash = "/login";
      } else if (!auth.isAdmin) {
        window.location.hash = "/";
      }
    }

    if (isEditRoute) {
      if (!auth.token) {
        const desired = window.location.hash.replace("#", "") || "/";
        localStorage.setItem(LAST_ROUTE_AFTER_LOGIN, desired);
        window.location.hash = "/login";
      } else if (!auth.isAdmin) {
        window.location.hash = "/";
      }
    }

    if (state.route === "admin") {
      if (!auth.isAdmin) {
        window.location.hash = "/";
      }
    }

    if (state.route === "potential" || isPotentialEditRoute) {
      if (!auth.token) {
        const desired =
          window.location.hash.replace("#", "") || "/potential";
        localStorage.setItem(LAST_ROUTE_AFTER_LOGIN, desired);
        window.location.hash = "/login";
      } else if (!auth.isAdmin) {
        window.location.hash = "/";
      }
    }

    if (state.route === "workspace") {
      if (!auth.token) {
        localStorage.setItem(LAST_ROUTE_AFTER_LOGIN, "/workspace");
        window.location.hash = "/login";
      }
    }
  }, [
    state.route,
    auth.token,
    auth.isAdmin,
    isEditRoute,
    isPotentialEditRoute,
  ]);

  useEffect(() => {
    function onScroll() {
      setShowScrollTop(window.scrollY > 400);
    }

    window.addEventListener("scroll", onScroll);
    onScroll();

    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  async function handleLogin(u, p) {
    const ok = await login(u, p);
    if (ok) {
      const next = localStorage.getItem(LAST_ROUTE_AFTER_LOGIN) || "/";
      localStorage.removeItem(LAST_ROUTE_AFTER_LOGIN);
      window.location.hash = next;
    }
  }

  async function handleDelete(id) {
    if (!auth.isAdmin) {
      alert("Удалять документы могут только администраторы");
      return;
    }
    await api.deleteDocument(id);
    dispatch({ type: "DELETE_DOC", id });
  }

  let content = null;

  if (state.route === "login") {
    content = <LoginPage auth={auth} onLogin={handleLogin} />;
  } else if (state.route === "add") {
    content = <AddPage onUploaded={reload} />;
  } else if (state.route === "admin") {
    content = <AdminPage auth={auth} />;
  } else if (state.route === "analytics") {
    content = <AnalyticsPage />;
  } else if (state.route === "potential") {
    content = <PotentialDocsPage />;
  } else if (isPotentialEditRoute && currentPotentialEditId) {
    content = <PotentialEditPage documentId={currentPotentialEditId} />;
  } else if (isEditRoute && currentEditId) {
    const currentDoc =
      state.docs.find((d) => d.id === currentEditId) || null;

    content = (
      <EditPage
        documentId={currentEditId}
        initialDoc={currentDoc}
        onUpdated={reload}
      />
    );
  } else if (state.route === "workspace") {
    content = <WorkspacePage onGoList={() => (window.location.hash = "/")} />;
  } else {
    content = (
      <div className="ec-main">
        <SidebarFilters
          filters={state.filters}
          options={state.options}
          onSet={(k, v) =>
            dispatch({ type: "SET_FILTER", key: k, value: v })
          }
          onAddKeyword={(v) =>
            dispatch({ type: "ADD_KEYWORD", value: v })
          }
          onRemoveKeyword={(v) =>
            dispatch({ type: "REMOVE_KEYWORD", value: v })
          }
          onClear={() => dispatch({ type: "CLEAR_FILTERS" })}
        />
        <div className="ec-content">
          <SortBar
            total={state.total}
            sort={state.sort}
            onSort={(v) => dispatch({ type: "SET_SORT", value: v })}
          />
          <ResultsList
            items={state.pageItems}
            onDelete={handleDelete}
            isAdmin={auth.isAdmin}
            isAuthenticated={!!auth.token}
          />
          <Pagination
            page={state.page}
            pageSize={state.pageSize}
            total={state.total}
            onPage={(n) => dispatch({ type: "SET_PAGE", value: n })}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="ec-shell">
      <div
        className={`ec-container ${
          isWorkspaceRoute ? "ec-container--wide ec-container--workspace" : ""
        }`}
      >
        {!isWorkspaceRoute && (
          <Header
            route={state.route}
            query={state.query}
            onQuery={(v) => dispatch({ type: "SET_QUERY", value: v })}
            onSearch={doSearch}
            onClear={() => dispatch({ type: "CLEAR_FILTERS" })}
            onGoAdd={() => {
              if (!auth.token) {
                localStorage.setItem(LAST_ROUTE_AFTER_LOGIN, "/add");
                window.location.hash = "/login";
              } else if (!auth.isAdmin) {
                alert("Добавлять документы могут только администраторы");
              } else {
                window.location.hash = "/add";
              }
            }}
            onGoList={() => (window.location.hash = "/")}
            onGoAdmin={() => {
              if (auth.isAdmin) {
                window.location.hash = "/admin";
              }
            }}
            onGoAnalytics={() => {
              window.location.hash = "/analytics";
            }}
            onGoPotential={() => {
              if (!auth.token) {
                localStorage.setItem(LAST_ROUTE_AFTER_LOGIN, "/potential");
                window.location.hash = "/login";
              } else if (!auth.isAdmin) {
                alert("Доступно только администраторам");
              } else {
                window.location.hash = "/potential";
              }
            }}
            onGoWorkspace={() => {
              if (!auth.token) {
                localStorage.setItem(LAST_ROUTE_AFTER_LOGIN, "/workspace");
                window.location.hash = "/login";
              } else {
                window.location.hash = "/workspace";
              }
            }}
            auth={auth}
            onLogout={logout}
          />
        )}

        {content}

        {!isWorkspaceRoute && (
          <footer className="ec-footer">
            © {new Date().getFullYear()} EducationConsult
          </footer>
        )}
      </div>

      {(state.route === "list" || state.route === "potential") && showScrollTop && (
        <button
          type="button"
          className="btn btn-primary ec-scroll-top"
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: "smooth",
            })
          }
        >
          Наверх ↑
        </button>
      )}
    </div>
  );
}