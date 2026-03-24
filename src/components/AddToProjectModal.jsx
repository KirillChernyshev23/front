// src/components/AddToProjectModal.jsx
import React, { useEffect, useState } from "react";
import { api } from "../api/client";

/**
 * Нормализуем список проектов.
 * Бэк может вернуть:
 * - массив
 * - { items: [...] }
 * - { results: [...] }
 * - { projects: [...] }
 */
function asList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.projects)) return data.projects;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function getProjectId(p) {
  return p?.id ?? p?.project_id ?? p?._id ?? null;
}

function getProjectName(p) {
  return p?.name ?? p?.title ?? `Проект ${getProjectId(p)}`;
}

function getProjectDescription(p) {
  return p?.description ?? "";
}

export default function AddToProjectModal({ open, documentId, onClose }) {
  // Режим шторки:
  // "select" — выбираем существующий проект
  // "create" — создаём новый проект
  const [mode, setMode] = useState("select");

  // Список проектов
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");

  // Форма создания проекта
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Общее состояние UI
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function loadProjects() {
    try {
      setProjectsLoading(true);
      setProjectsError("");

      const data = await api.listWorkspaceProjects();
      const list = asList(data);

      setProjects(list);
    } catch (e) {
      setProjectsError(e.message || "Не удалось загрузить проекты");
    } finally {
      setProjectsLoading(false);
    }
  }

  // Когда шторка открывается:
  // - сбрасываем режим в "выбор проекта"
  // - чистим сообщения
  // - грузим проекты
  useEffect(() => {
    if (!open) return;

    setMode("select");
    setMessage("");
    setNewName("");
    setNewDescription("");

    loadProjects();
  }, [open]);

  async function handleAddToExisting(projectId) {
    if (!projectId || !documentId) return;

    try {
      setBusy(true);
      setMessage("");

      await api.addDocumentsToWorkspaceProject(projectId, [documentId]);

      setMessage("Документ добавлен в проект");

      // Небольшая задержка, чтобы пользователь увидел сообщение
      setTimeout(() => {
        onClose();
      }, 400);
    } catch (e) {
      setMessage(e.message || "Не удалось добавить документ в проект");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateAndAdd() {
    const name = newName.trim();
    const description = newDescription.trim();

    if (!name) {
      setMessage("Введите название проекта");
      return;
    }

    if (!documentId) {
      setMessage("Не найден документ для добавления");
      return;
    }

    try {
      setBusy(true);
      setMessage("");

      await api.createWorkspaceProject({
        name,
        description,
        document_ids: [documentId],
      });

      setMessage("Проект создан, документ добавлен");

      setTimeout(() => {
        onClose();
      }, 400);
    } catch (e) {
      setMessage(e.message || "Не удалось создать проект");
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.25)",
        zIndex: 9999,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      {/* Сама шторка */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 100%)",
          height: "100%",
          background: "#fff",
          boxShadow: "-8px 0 24px rgba(0,0,0,0.12)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Верхняя часть */}
        <div
          style={{
            padding: "1rem",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          {mode === "create" && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setMode("select");
                setMessage("");
              }}
              disabled={busy}
            >
              ←
            </button>
          )}

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              {mode === "select"
                ? "Добавить в проект"
                : "Создать новый проект"}
            </div>
            <div style={{ fontSize: 13, opacity: 0.7, marginTop: 2 }}>
              {mode === "select"
                ? "Выбери существующий проект"
                : "Документ будет добавлен в новый"}
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={busy}
          >
            ✕
          </button>
        </div>

        {/* Сообщение */}
        {message && (
          <div
            style={{
              margin: "1rem 1rem 0",
              padding: "0.75rem",
              borderRadius: 10,
              background: "#f5f5f5",
              fontSize: 14,
            }}
          >
            {message}
          </div>
        )}

        {/* Контент */}
        <div
          style={{
            padding: "1rem",
            overflowY: "auto",
            flex: 1,
          }}
        >
          {mode === "select" && (
            <>
              {projectsLoading && <div>Загрузка проектов…</div>}

              {projectsError && (
                <div style={{ color: "crimson", marginBottom: "0.75rem" }}>
                  {projectsError}
                </div>
              )}

              {!projectsLoading && !projectsError && projects.length === 0 && (
                <div
                  style={{
                    padding: "0.9rem",
                    border: "1px solid #eee",
                    borderRadius: 12,
                    marginBottom: "1rem",
                    opacity: 0.8,
                  }}
                >
                  У тебя пока нет проектов.
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {projects.map((p) => {
                  const id = getProjectId(p);
                  const description = getProjectDescription(p);

                  return (
                    <button
                      key={String(id)}
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => handleAddToExisting(id)}
                      disabled={busy}
                      style={{
                        textAlign: "left",
                        padding: "0.85rem",
                        border: "1px solid #e5e7eb",
                        borderRadius: 12,
                        background: "#fff",
                        width: "100%",
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {getProjectName(p)}
                      </div>

                      {description && (
                        <div
                          style={{
                            fontSize: 13,
                            opacity: 0.75,
                            marginTop: 4,
                            lineHeight: 1.35,
                          }}
                        >
                          {description}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {mode === "create" && (
            <>
              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 14,
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  Название проекта
                </label>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Например: Документы для исследования"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                  }}
                  disabled={busy}
                />
              </div>

              <div style={{ marginBottom: "0.75rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 14,
                    marginBottom: 6,
                    fontWeight: 600,
                  }}
                >
                  Описание проекта
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Необязательно"
                  style={{
                    width: "100%",
                    minHeight: 110,
                    padding: "0.75rem",
                    borderRadius: 10,
                    border: "1px solid #ddd",
                    resize: "vertical",
                  }}
                  disabled={busy}
                />
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateAndAdd}
                disabled={busy}
                style={{ width: "100%" }}
              >
                Создать проект и добавить документ
              </button>
            </>
          )}
        </div>

        {/* Нижняя часть */}
        {mode === "select" && (
          <div
            style={{
              padding: "1rem",
              borderTop: "1px solid #eee",
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setMode("create");
                setMessage("");
              }}
              disabled={busy}
              style={{ width: "100%" }}
            >
              + Создать новый проект
            </button>
          </div>
        )}
      </div>
    </div>
  );
}