// src/pages/WorkspacePage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api/client";
import PdfWorkspaceViewer from "../components/PdfWorkspaceViewer";
import {
  addAnnotation,
  deleteAnnotation,
  loadAnnotations,
} from "../utils/pdfAnnotationsStorage";

function normalizeProjectDoc(d) {
  return {
    id: d?.id ?? null,
    uuid: d?.uuid ?? "",
    title: d?.title ?? "Без названия",
    documentType: d?.document_type ?? "",
    sourceLink: d?.source_link ?? "",
    accessLevel: d?.access_level ?? "",
    documentDate: d?.document_date ?? "",
    createdAt: d?.created_at ?? "",
    summary:
    d?.summary ||
    "Это тестовое краткое описание документа. Здесь можно проверить, как выглядит карточка документа в левой панели, перенос строк и обрезка текста.",
    fullText: d?.full_text ?? "",
    files: Array.isArray(d?.files) ? d.files : [],
    raw: d,
  };
}

function asList(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.projects)) return data.projects;
  if (Array.isArray(data.documents)) return data.documents;
  if (Array.isArray(data.selected_documents)) return data.selected_documents;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

function getProjectId(p) {
  return p?.id ?? p?.project_id ?? p?.uuid ?? p?._id ?? null;
}

function getProjectName(p) {
  return p?.name ?? p?.title ?? `Проект ${getProjectId(p)}`;
}

function getProjectDescription(p) {
  return p?.description ?? p?.project_description ?? "";
}

function getDocId(d) {
  return d?.id ?? null;
}

function getDocTitle(d) {
  return d?.title ?? "Без названия";
}

function getDocSourceLink(d) {
  return d?.sourceLink ?? "";
}

function ensureAbsoluteUrl(url) {
  if (!url) return "";
  const u = String(url).trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return `https:${u}`;
  return `https://${u}`;
}

function pickFirstUrl(res) {
  if (!res) return "";
  if (typeof res === "string") return res;
  if (typeof res.url === "string") return res.url;
  if (typeof res.download_url === "string") return res.download_url;
  if (typeof res.href === "string") return res.href;
  if (Array.isArray(res.urls) && res.urls[0]) return res.urls[0];
  if (Array.isArray(res.download_urls) && res.download_urls[0]) {
    return res.download_urls[0];
  }
  if (Array.isArray(res) && res[0]) {
    if (typeof res[0] === "string") return res[0];
    if (typeof res[0] === "object") {
      return res[0].url || res[0].download_url || res[0].href || "";
    }
  }
  for (const v of Object.values(res)) {
    if (
      typeof v === "string" &&
      (v.startsWith("http://") || v.startsWith("https://"))
    ) {
      return v;
    }
  }
  return "";
}

function triggerDownload(url) {
  const a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.click();
}

function formatDateTime(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  return d.toLocaleString();
}

export default function WorkspacePage({ onGoList }) {
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState(null);

  const [leftView, setLeftView] = useState("projects");

  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState("");
  const [selectedDocId, setSelectedDocId] = useState(null);

  const [activePdfUrl, setActivePdfUrl] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState("");

  const [annotations, setAnnotations] = useState([]);
  const [flashAnnotationId, setFlashAnnotationId] = useState(null);
  const flashTimerRef = useRef(null);
  const viewerRef = useRef(null);

  const [pendingSelection, setPendingSelection] = useState(null);
  const [selectionComment, setSelectionComment] = useState("");

  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  useEffect(() => {
    if (selectedProjectId && selectedDocId) {
      setAnnotations(loadAnnotations(selectedProjectId, selectedDocId));
    } else {
      setAnnotations([]);
    }
    setPendingSelection(null);
    setSelectionComment("");
  }, [selectedProjectId, selectedDocId]);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const handleTextSelected = useCallback((sel) => {
    if (!sel?.text && !sel?.warning) {
      setPendingSelection(null);
      return;
    }
    setPendingSelection(sel);
    setSelectionComment("");
  }, []);

  function handleSaveAnnotation() {
    if (
      !pendingSelection?.text?.trim() ||
      !pendingSelection.rects?.length ||
      !selectedProjectId ||
      !selectedDocId
    ) {
      return;
    }

    const next = addAnnotation(selectedProjectId, selectedDocId, {
      page: pendingSelection.page,
      text: pendingSelection.text,
      comment: selectionComment.trim(),
      rects: pendingSelection.rects,
      documentTitle: selectedDoc?.title || "",
    });

    setAnnotations(next);
    setPendingSelection(null);
    setSelectionComment("");

    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  }

  function handleCancelSelection() {
    setPendingSelection(null);
    setSelectionComment("");
    const sel = window.getSelection();
    if (sel) sel.removeAllRanges();
  }

  function handleDeleteAnnotation(annotationId) {
    if (!selectedProjectId || !selectedDocId) return;
    const next = deleteAnnotation(
      selectedProjectId,
      selectedDocId,
      annotationId
    );
    setAnnotations(next);
  }

  function handleScrollToAnnotation(annotation) {
    viewerRef.current?.scrollToAnnotation(annotation);
    setFlashAnnotationId(annotation.id);

    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => {
      setFlashAnnotationId(null);
    }, 1800);
  }

  async function loadProjects({
    keepSelection = true,
    preferredProjectId = null,
  } = {}) {
    try {
      setProjectsLoading(true);
      setProjectsError("");

      const data = await api.listWorkspaceProjects();
      const list = asList(data);
      setProjects(list);

      if (!list.length) {
        setSelectedProjectId(null);
        return;
      }

      if (preferredProjectId != null) {
        const exists = list.some(
          (p) => String(getProjectId(p)) === String(preferredProjectId)
        );
        if (exists) {
          setSelectedProjectId(preferredProjectId);
          return;
        }
      }

      if (!keepSelection || !selectedProjectId) {
        setSelectedProjectId(getProjectId(list[0]));
        return;
      }

      const stillExists = list.some(
        (p) => String(getProjectId(p)) === String(selectedProjectId)
      );

      if (!stillExists) setSelectedProjectId(getProjectId(list[0]));
    } catch (e) {
      setProjectsError(e.message || "Не удалось загрузить проекты");
    } finally {
      setProjectsLoading(false);
    }
  }

  async function loadDocuments(projectId) {
    if (!projectId) {
      setDocuments([]);
      setSelectedDocId(null);
      return;
    }

    try {
      setDocsLoading(true);
      setDocsError("");

      const data = await api.listWorkspaceProjectDocuments(projectId);
      const list = asList(data).map(normalizeProjectDoc);
      setDocuments(list);

      if (!list.length) {
        setSelectedDocId(null);
        return;
      }

      const stillExists = list.some(
        (d) => String(getDocId(d)) === String(selectedDocId)
      );

      if (!stillExists) setSelectedDocId(getDocId(list[0]));
    } catch (e) {
      setDocsError(e.message || "Не удалось загрузить документы проекта");
    } finally {
      setDocsLoading(false);
    }
  }

  async function resolvePdfUrl(doc) {
    if (!doc) {
      setActivePdfUrl("");
      setPdfError("");
      return;
    }

    try {
      setPdfLoading(true);
      setPdfError("");

      if (doc.id) {
        const res = await api.getDocumentDownloadUrls(doc.id);
        const url = pickFirstUrl(res);
        if (url) {
          setActivePdfUrl(url);
          return;
        }
      }

      const fallbackUrl = getDocSourceLink(doc);
      if (fallbackUrl) {
        setActivePdfUrl(ensureAbsoluteUrl(fallbackUrl));
        return;
      }

      setActivePdfUrl("");
      setPdfError("Не удалось получить ссылку на PDF");
    } catch (e) {
      const fallbackUrl = getDocSourceLink(doc);
      if (fallbackUrl) {
        setActivePdfUrl(ensureAbsoluteUrl(fallbackUrl));
      } else {
        setActivePdfUrl("");
        setPdfError(e.message || "Не удалось загрузить PDF");
      }
    } finally {
      setPdfLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadDocuments(selectedProjectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProjectId]);

  const selectedProject = useMemo(
    () =>
      projects.find(
        (p) => String(getProjectId(p)) === String(selectedProjectId)
      ) || null,
    [projects, selectedProjectId]
  );

  const selectedDoc = useMemo(
    () =>
      documents.find((d) => String(getDocId(d)) === String(selectedDocId)) ||
      null,
    [documents, selectedDocId]
  );

  useEffect(() => {
    resolvePdfUrl(selectedDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDoc]);

  function handleSelectProject(id) {
    setSelectedProjectId(id);
    setLeftView("documents");
  }

  function handleBackToProjects() {
    setLeftView("projects");
  }

  async function handleCreateProject() {
    const name = newProjectName.trim();
    const description = newProjectDescription.trim();

    if (!name) {
      setMessage("Введите название проекта");
      return;
    }

    try {
      setBusy(true);
      setMessage("");

      const created = await api.createWorkspaceProject({
        name,
        description,
        document_ids: [],
      });

      const createdId = getProjectId(created);

      setNewProjectName("");
      setNewProjectDescription("");
      setShowNewProject(false);
      setMessage("Проект создан");

      await loadProjects({
        keepSelection: false,
        preferredProjectId: createdId,
      });
      setLeftView("documents");
    } catch (e) {
      setMessage(e.message || "Не удалось создать проект");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProject(projectId) {
    if (!projectId) return;

    const ok = window.confirm(
      "Удалить проект? Документы из базы не удалятся, только связь с проектом."
    );
    if (!ok) return;

    try {
      setBusy(true);
      setMessage("");

      await api.deleteWorkspaceProject(projectId);
      setMessage("Проект удалён");

      await loadProjects({ keepSelection: false });
      setLeftView("projects");
    } catch (e) {
      setMessage(e.message || "Не удалось удалить проект");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDocFromProject(projectId, documentId) {
    if (!projectId || !documentId) return;

    const ok = window.confirm("Удалить документ из проекта?");
    if (!ok) return;

    try {
      setBusy(true);
      setMessage("");

      await api.deleteWorkspaceProjectDocument(projectId, documentId);
      setMessage("Документ удалён из проекта");

      await loadDocuments(projectId);
    } catch (e) {
      setMessage(e.message || "Не удалось удалить документ из проекта");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadDoc(doc) {
    try {
      setBusy(true);
      setMessage("");

      if (doc?.id) {
        const res = await api.getDocumentDownloadUrls(doc.id);
        const url = pickFirstUrl(res);
        if (url) {
          triggerDownload(url);
          return;
        }
      }

      if (doc?.sourceLink) {
        triggerDownload(ensureAbsoluteUrl(doc.sourceLink));
        return;
      }

      setMessage("Не удалось получить ссылку для скачивания");
    } catch (e) {
      if (doc?.sourceLink) {
        triggerDownload(ensureAbsoluteUrl(doc.sourceLink));
        setMessage("Документ открыт по резервной ссылке");
      } else {
        setMessage(e.message || "Не удалось скачать документ");
      }
    } finally {
      setBusy(false);
    }
  }

  function renderProjectsList() {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "saturate(180%) blur(10px)",
          border: "1px solid rgba(255,255,255,0.55)",
          borderRadius: 14,
          padding: "0.9rem",
          boxShadow: "0 2px 8px rgba(2,6,23,0.06)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          flex: 1,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "0.6rem",
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0, flex: 1, fontSize: 16, fontWeight: 800 }}>Проекты</h3>
          <button
            className="btn btn-secondary"
            onClick={() => setShowNewProject((v) => !v)}
            type="button"
            style={{ fontSize: 12, padding: "0.25rem 0.55rem" }}
          >
            {showNewProject ? "Отмена" : "+ Новый"}
          </button>
        </div>

        {showNewProject && (
          <div
            style={{
              padding: "0.6rem",
              marginBottom: "0.6rem",
              background: "rgba(37,99,235,0.03)",
              border: "1px solid rgba(37,99,235,0.08)",
              borderRadius: 10,
              flexShrink: 0,
            }}
          >
            <input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Название проекта"
              style={{
                width: "100%",
                padding: "0.4rem 0.55rem",
                marginBottom: "0.4rem",
                boxSizing: "border-box",
                fontSize: 13,
              }}
              disabled={busy}
            />
            <input
              value={newProjectDescription}
              onChange={(e) => setNewProjectDescription(e.target.value)}
              placeholder="Описание (необязательно)"
              style={{
                width: "100%",
                padding: "0.4rem 0.55rem",
                marginBottom: "0.4rem",
                boxSizing: "border-box",
                fontSize: 13,
              }}
              disabled={busy}
            />
            <button
              className="btn btn-primary"
              onClick={handleCreateProject}
              disabled={busy}
              type="button"
              style={{ width: "100%", padding: "0.35rem", fontSize: 13 }}
            >
              Создать
            </button>
          </div>
        )}

        <div style={{ marginBottom: "0.35rem", flexShrink: 0 }}>
          {projectsLoading && (
            <div style={{ fontSize: 13 }}>Загрузка проектов…</div>
          )}
          {projectsError && (
            <div style={{ color: "crimson", fontSize: 13 }}>
              {projectsError}
            </div>
          )}
          {!projectsLoading && !projectsError && projects.length === 0 && (
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              Проектов пока нет.
            </div>
          )}
        </div>

        <div
          style={{
            overflowY: "auto",
            minHeight: 0,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "0.45rem",
            paddingRight: 4,
          }}
        >
          {projects.map((p) => {
            const id = getProjectId(p);
            const active = String(id) === String(selectedProjectId);
            const description = getProjectDescription(p);

            return (
              <div
                key={String(id)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.45rem",
                  padding: "0.55rem",
                  borderRadius: 10,
                  border: active ? "1.5px solid #2563eb" : "1px solid rgba(15,23,42,0.06)",
                  background: active ? "rgba(37,99,235,0.04)" : "white",
                  cursor: "pointer",
                }}
                onClick={() => handleSelectProject(id)}
                role="button"
                tabIndex={0}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 16,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {getProjectName(p)}
                  </div>
                  {description && (
                    <div
                      style={{
                        fontSize: 14,
                        opacity: 0.75,
                        marginTop: 3,
                        lineHeight: 1.35,
                      }}
                    >
                      {description}
                    </div>
                  )}
                </div>

                <button
                  className="btn btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteProject(id);
                  }}
                  disabled={busy}
                  type="button"
                  title="Удалить проект"
                  style={{ fontSize: 13, padding: "0.15rem" }}
                >
                  🗑
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDocumentsList() {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "saturate(180%) blur(10px)",
          border: "1px solid rgba(255,255,255,0.55)",
          borderRadius: 14,
          padding: "0.9rem",
          boxShadow: "0 2px 8px rgba(2,6,23,0.06)",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          flex: 1,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            marginBottom: "0.6rem",
            flexShrink: 0,
          }}
        >
          <button
            className="btn btn-ghost"
            onClick={handleBackToProjects}
            type="button"
            style={{ fontSize: 15, padding: "0.1rem 0.3rem", lineHeight: 1 }}
            title="Назад к проектам"
          >
            ←
          </button>
          <h3
            style={{
              margin: 0,
              flex: 1,
              fontSize: 16,
              fontWeight: 800,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {selectedProject ? getProjectName(selectedProject) : "Документы"}
          </h3>
        </div>

        <div style={{ marginBottom: "0.35rem", flexShrink: 0 }}>
          {docsLoading && (
            <div style={{ fontSize: 13 }}>Загрузка документов…</div>
          )}
          {docsError && (
            <div style={{ color: "crimson", fontSize: 13 }}>{docsError}</div>
          )}
          {!docsLoading && !docsError && documents.length === 0 && (
            <div style={{ opacity: 0.8, fontSize: 13 }}>
              В проекте пока нет документов.
            </div>
          )}
        </div>

        <div
          style={{
            overflowY: "auto",
            minHeight: 0,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "0.45rem",
            paddingRight: 4,
          }}
        >
          {!docsLoading &&
            !docsError &&
            documents.map((d) => {
              const docId = getDocId(d);
              const active = String(docId) === String(selectedDocId);

              return (
                <div
                  key={String(docId)}
                  style={{
                    padding: "0.55rem",
                    borderRadius: 10,
                    border: active ? "1.5px solid #2563eb" : "1px solid rgba(15,23,42,0.06)",
                    background: active ? "rgba(37,99,235,0.04)" : "white",
                    cursor: "pointer",
                  }}
                  onClick={() => setSelectedDocId(docId)}
                  role="button"
                  tabIndex={0}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: 16,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {getDocTitle(d)}
                  </div>

                  <div style={{
                    fontSize: 11,
                    marginTop: 3,
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(15,23,42,0.05)",
                    color: "#6b7280",
                    fontWeight: 500,
                  }}>
                    {d.documentType || "PDF"}
                  </div>

                  {!!d.summary && (
                    <div
                      style={{
                        fontSize: 14,
                        color: "#475569",
                        opacity: 0.95,
                        marginTop: 5,
                        lineHeight: 1.35,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        wordBreak: "break-word",
                      }}
                    >
                      {d.summary}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      gap: "0.35rem",
                      marginTop: "0.45rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      className="btn btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownloadDoc(d);
                      }}
                      disabled={busy}
                      type="button"
                      style={{ fontSize: 11, padding: "0.18rem 0.45rem" }}
                    >
                      Скачать
                    </button>

                    <button
                      className="btn btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocFromProject(selectedProjectId, docId);
                      }}
                      disabled={busy || !docId}
                      type="button"
                      title="Удалить из проекта"
                      style={{ fontSize: 11, padding: "0.15rem" }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    );
  }

  function renderSelectionForm() {
    if (!pendingSelection) return null;

    if (pendingSelection.warning) {
      return (
        <div
          style={{
            border: "1px solid #f0d090",
            borderRadius: 10,
            padding: "0.55rem 0.65rem",
            background: "#fffef5",
            flexShrink: 0,
            fontSize: 12,
            color: "#b45309",
          }}
        >
          {pendingSelection.warning}
        </div>
      );
    }

    return (
      <div
        style={{
          border: "1px solid rgba(37,99,235,0.12)",
          borderRadius: 10,
          padding: "0.65rem",
          background: "rgba(37,99,235,0.03)",
          flexShrink: 0,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
          Новая цитата · стр. {pendingSelection.page}
        </div>

        <div
          style={{
            fontSize: 11,
            lineHeight: 1.35,
            background: "#fff",
            border: "1px solid #eee",
            borderRadius: 6,
            padding: "0.45rem",
            marginBottom: "0.45rem",
            whiteSpace: "pre-wrap",
            color: "#555",
            maxHeight: 70,
            overflowY: "auto",
          }}
        >
          {pendingSelection.text.length > 200
            ? `${pendingSelection.text.slice(0, 200)}…`
            : pendingSelection.text}
        </div>

        <input
          value={selectionComment}
          onChange={(e) => setSelectionComment(e.target.value)}
          placeholder="Комментарий (необязательно)"
          style={{
            width: "100%",
            padding: "0.35rem 0.45rem",
            borderRadius: 6,
            border: "1px solid #ddd",
            fontSize: 12,
            marginBottom: "0.4rem",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: "0.35rem" }}>
          <button
            className="btn btn-primary"
            onClick={handleSaveAnnotation}
            type="button"
            style={{ fontSize: 12, padding: "0.28rem 0.55rem", flex: 1 }}
          >
            Сохранить
          </button>
          <button
            className="btn btn-ghost"
            onClick={handleCancelSelection}
            type="button"
            style={{ fontSize: 12, padding: "0.28rem 0.45rem" }}
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  function renderCitationsBlock() {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.75)",
          backdropFilter: "saturate(180%) blur(10px)",
          border: "1px solid rgba(255,255,255,0.55)",
          borderRadius: 14,
          padding: "0.7rem 0.8rem",
          boxShadow: "0 2px 8px rgba(2,6,23,0.06)",
          flexShrink: 0,
          minHeight: 120,
          maxHeight: 320,
          overflowY: "auto",
        }}
      >
        <div
          style={{ fontWeight: 800, fontSize: 13, marginBottom: "0.45rem" }}
        >
          Цитаты
        </div>

        {!selectedProjectId || !selectedDocId ? (
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Выберите документ.
          </div>
        ) : annotations.length === 0 ? (
          <div style={{ opacity: 0.7, fontSize: 12 }}>
            Выделите текст в PDF, чтобы сохранить цитату.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
            }}
          >
            {annotations.map((ann) => (
              <div
                key={ann.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.35rem",
                  padding: "0.4rem 0.5rem",
                  border: "1px solid rgba(15,23,42,0.06)",
                  borderRadius: 10,
                  background:
                    flashAnnotationId === ann.id ? "#fff4b8" : "rgba(255,255,255,0.8)",
                  transition: "background 0.25s ease",
                  cursor: "pointer",
                }}
                onClick={() => handleScrollToAnnotation(ann)}
                title={ann.text}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {ann.comment?.trim() || "Без комментария"}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.6,
                      marginTop: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    стр. {ann.page}
                    {ann.text ? ` · ${ann.text.slice(0, 70)}` : ""}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAnnotation(ann.id);
                  }}
                  title={`Удалить (${formatDateTime(ann.createdAt)})`}
                  style={{ fontSize: 11, padding: "0.1rem", flexShrink: 0 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "0.5rem 0.75rem",
        height: "100%",
        width: "100%",
        maxWidth: "none",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.5rem",
          flexShrink: 0,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Мои проекты</h2>
        <div style={{ flex: 1 }} />
        <button
          className="btn btn-secondary"
          onClick={onGoList}
          type="button"
        >
          ← Назад к поиску
        </button>
      </div>

      {message && (
        <div
          style={{
            marginBottom: "0.4rem",
            padding: "0.35rem 0.75rem",
            background: "rgba(37,99,235,0.06)",
            border: "1px solid rgba(37,99,235,0.12)",
            borderRadius: 10,
            flexShrink: 0,
            fontSize: 13,
          }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "700px minmax(0, 1fr)",
          gap: "0.75rem",
          overflow: "hidden",
        }}
      >
        {/* Левая панель */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {leftView === "projects"
            ? renderProjectsList()
            : renderDocumentsList()}

          {leftView === "documents" && renderSelectionForm()}
          {leftView === "documents" && renderCitationsBlock()}
        </div>

        {/* Правая зона — PDF */}
        <div
          style={{
            background: "rgba(255,255,255,0.5)",
            border: "1px solid rgba(255,255,255,0.55)",
            borderRadius: 14,
            boxShadow: "0 2px 8px rgba(2,6,23,0.06)",
            minWidth: 0,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <PdfWorkspaceViewer
            ref={viewerRef}
            fileUrl={activePdfUrl}
            documentId={selectedDocId}
            documentTitle={selectedDoc?.title || ""}
            loading={pdfLoading}
            error={pdfError}
            onDownload={() => {
              if (selectedDoc) handleDownloadDoc(selectedDoc);
            }}
            annotations={annotations}
            flashAnnotationId={flashAnnotationId}
            onTextSelected={handleTextSelected}
          />
        </div>
      </div>
    </div>
  );
}