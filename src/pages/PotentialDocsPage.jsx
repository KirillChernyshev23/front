// src/pages/PotentialDocsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { DOC_TYPES, backendTypeToKind } from "../constants/docTypes";

/** --- helpers (локально, чтобы не зависеть от импортов) --- */
function ensureAbsoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  // если бэк отдаёт относительный путь — делаем абсолютным до API_BASE
  const base = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";
  return `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

function normalizeMinioUrl(url) {
  if (!url) return "";
  return String(url).trim();
}

function pickDownloadUrlFromResponse(res) {
  const isUrlLikeString = (s) => {
    if (!s || typeof s !== "string") return false;
    const v = s.trim();
    if (!v) return false;
    // абсолютная ссылка
    if (v.startsWith("http://") || v.startsWith("https://")) return true;
    // относительный путь (в т.ч. /api/v1/...)
    if (v.startsWith("/")) return true;
    return false;
  };

  const toOpenableUrl = (s) => {
    if (!s) return "";
    const v = String(s).trim();
    if (!v) return "";
    // абсолютная
    if (v.startsWith("http://") || v.startsWith("https://")) return v;
    // относительная — делаем абсолютной через API_BASE
    if (v.startsWith("/")) return ensureAbsoluteUrl(v);
    return "";
  };

  const tryObject = (obj) => {
    if (!obj || typeof obj !== "object") return "";

    const direct =
      obj.url ||
      obj.download_url ||
      obj.href ||
      obj.presigned_url ||
      obj.signed_url ||
      "";

    if (isUrlLikeString(direct)) return toOpenableUrl(direct);

    // fallback: ищем любую строку (http или /path) среди значений
    for (const v of Object.values(obj)) {
      if (isUrlLikeString(v)) return toOpenableUrl(v);
    }

    return "";
  };

  if (!res) return "";

  if (typeof res === "string") {
    return isUrlLikeString(res) ? toOpenableUrl(res) : "";
  }

  if (Array.isArray(res)) {
    // массив строк
    const s = res.find((x) => isUrlLikeString(x));
    if (s) return toOpenableUrl(s);

    // массив объектов
    for (const item of res) {
      const u = tryObject(item);
      if (u) return u;
    }
    return "";
  }

  if (typeof res === "object") {
    const u = tryObject(res);
    if (u) return u;

    if (Array.isArray(res.urls)) {
      const u2 = pickDownloadUrlFromResponse(res.urls);
      if (u2) return u2;
    }
  }

  return "";
}

/** --- domain helpers --- */
function getKind(doc) {
  const k =
    doc?.kind ||
    backendTypeToKind(doc?.document_type || doc?.documentType || "");
  return k || "NPA";
}

function getTypeLabel(doc) {
  const kind = getKind(doc);
  return DOC_TYPES[kind]?.label || doc?.document_type || kind || "—";
}

function getTags(doc) {
  if (Array.isArray(doc?.keywords)) return doc.keywords.filter(Boolean);
  if (Array.isArray(doc?.tags)) {
    return doc.tags
      .map((t) => t?.tag_name ?? t?.tag ?? (typeof t === "string" ? t : ""))
      .filter(Boolean);
  }
  return [];
}

// ✅ ОПИСАНИЕ: теперь берём из API endpoint /documents/{document_id}/summary
function getPreviewText(doc, annotations) {
  if (!doc?.id) return "";
  const annotation = annotations[doc.id];
  if (typeof annotation === "string") {
    return annotation.trim() || "";
  }
  return "";
}

function truncate(text, n = 700) {
  if (!text) return "";
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

export default function PotentialDocsPage() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState({ id: null, action: "" }); // approve|delete|open
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [openMap, setOpenMap] = useState({});
  const [fullMap, setFullMap] = useState({});
  const [annotations, setAnnotations] = useState({}); // { documentId: annotationText }

  const toggleOpen = (id) =>
    setOpenMap((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleFull = (id) =>
    setFullMap((prev) => ({ ...prev, [id]: !prev[id] }));

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.getUnprocessedDocuments({ skip: 0, limit: 200 });
      const documents = Array.isArray(res) ? res : [];
      setItems(documents);
      
      // Fetch summaries for all documents
      const annotationPromises = documents.map(async (doc) => {
        try {
          const summaryResponse = await api.getDocumentAnnotation(doc.id);
          const annotation = summaryResponse?.summary || "";
          return { id: doc.id, annotation: typeof annotation === "string" ? annotation : "" };
        } catch (e) {
          console.warn(`Failed to fetch summary for document ${doc.id}:`, e);
          return { id: doc.id, annotation: "" };
        }
      });
      
      const annotationResults = await Promise.all(annotationPromises);
      const annotationMap = {};
      annotationResults.forEach(({ id, annotation }) => {
        annotationMap[id] = annotation;
      });
      setAnnotations(annotationMap);
    } catch (e) {
      setError(e?.message || "Не удалось загрузить очередь");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(docId) {
    setBusy({ id: docId, action: "approve" });
    try {
      await api.markDocumentProcessed(docId);
      setItems((prev) => prev.filter((d) => d.id !== docId));
    } catch (e) {
      alert(e?.message || "Не удалось подтвердить документ");
    } finally {
      setBusy({ id: null, action: "" });
    }
  }

  async function remove(docId) {
    const ok = window.confirm(
      "Удалить документ из очереди? Это действие нельзя отменить."
    );
    if (!ok) return;

    setBusy({ id: docId, action: "delete" });
    try {
      await api.deleteDocument(docId);
      setItems((prev) => prev.filter((d) => d.id !== docId));
    } catch (e) {
      alert(e?.message || "Не удалось удалить документ");
    } finally {
      setBusy({ id: null, action: "" });
    }
  }

  // ✅ Открыть PDF: берём URL через download-url (S3 presigned) и открываем его
  async function openPdfForDoc(doc) {
    setBusy({ id: doc.id, action: "open" });
    try {
      const res = await api.getDocumentDownloadUrls(doc.id);
      let url = pickDownloadUrlFromResponse(res);

      if (url) {
        url = normalizeMinioUrl(url);
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
    } catch (e) {
      console.error("Не удалось получить download-url:", e);
    } finally {
      setBusy({ id: null, action: "" });
    }

    // Fallback — если вдруг нет pre-signed ссылки (оставляем как было)
    if (doc.source_link) {
      const url = ensureAbsoluteUrl(normalizeMinioUrl(doc.source_link));
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      alert("Не удалось получить ссылку на файл");
    }
  }

  const itemsVm = useMemo(() => {
    return items.map((d) => ({
      ...d,
      _preview: getPreviewText(d, annotations),
    }));
  }, [items, annotations]);

  return (
    <div className="ec-page">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <h2 className="ec-page__title" style={{ margin: 0 }}>
          Предложенные карточки
        </h2>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Обновляем…" : "Обновить"}
        </button>
        <div style={{ color: "#6b7280", fontSize: 13 }}>
          В очереди: {items.length}
        </div>
      </div>

      {error && <div className="ec-alert ec-alert--error">{error}</div>}

      {!loading && items.length === 0 && (
        <p style={{ marginTop: 12 }}>Очередь пуста — непринятых карточек нет.</p>
      )}

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {itemsVm.map((doc) => {
          const tags = getTags(doc);

          const isBusyApprove = busy.id === doc.id && busy.action === "approve";
          const isBusyDelete = busy.id === doc.id && busy.action === "delete";
          const isBusyOpen = busy.id === doc.id && busy.action === "open";

          const isOpen = !!openMap[doc.id];
          const hasPreview = !!doc._preview;
          const showFull = !!fullMap[doc.id];

          const shownText = showFull ? doc._preview : truncate(doc._preview, 700);
          const canExpandFull = doc._preview && doc._preview.length > 700;

          return (
            <div
              key={doc.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 14,
                padding: 12,
                background: "#fff",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr minmax(320px, 520px)",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                {/* левая часть */}
                <div style={{ minWidth: 0, display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => toggleOpen(doc.id)}
                    disabled={!hasPreview}
                    title={hasPreview ? "Показать описание" : "Описание отсутствует"}
                    style={{
                      width: 36,
                      height: 36,
                      padding: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 10,
                      opacity: hasPreview ? 1 : 0.5,
                      flex: "0 0 auto",
                    }}
                  >
                    {isOpen ? "▴" : "▾"}
                  </button>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {doc.title || "(без названия)"}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                      Тип: {getTypeLabel(doc)} • Дата:{" "}
                      {doc.document_date || doc.documentDate || "—"} • ID: {doc.id}
                    </div>
                  </div>
                </div>

                {/* правая часть */}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    alignContent: "flex-start",
                  }}
                >
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => openPdfForDoc(doc)}
                    disabled={isBusyApprove || isBusyDelete || isBusyOpen}
                  >
                    {isBusyOpen ? "Открываем…" : "Открыть PDF"}
                  </button>

                  {doc.source_link && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        window.open(
                          ensureAbsoluteUrl(doc.source_link),
                          "_blank",
                          "noopener,noreferrer"
                        )
                      }
                      disabled={isBusyApprove || isBusyDelete || isBusyOpen}
                    >
                      Источник
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => (window.location.hash = `/potential/edit/${doc.id}`)}
                    disabled={isBusyApprove || isBusyDelete || isBusyOpen}
                  >
                    Редактировать
                  </button>

                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => approve(doc.id)}
                    disabled={isBusyApprove || isBusyDelete || isBusyOpen}
                  >
                    {isBusyApprove ? "Подтверждаем…" : "Подтвердить"}
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => remove(doc.id)}
                    disabled={isBusyApprove || isBusyDelete || isBusyOpen}
                  >
                    {isBusyDelete ? "Удаляем…" : "Удалить"}
                  </button>
                </div>
              </div>

              {/* раскрывашка */}
              {hasPreview && isOpen && (
                <div
                  style={{
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 12,
                    background: "rgba(15,23,42,0.03)",
                    border: "1px solid rgba(15,23,42,0.10)",
                    color: "#374151",
                    fontSize: 14,
                    lineHeight: 1.45,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {shownText}

                  {canExpandFull && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => toggleFull(doc.id)}
                      >
                        {showFull ? "Свернуть" : "Показать полностью"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tags.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {tags.slice(0, 16).map((t) => (
                    <span
                      key={t}
                      style={{
                        fontSize: 12,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: "rgba(15,23,42,0.05)",
                        border: "1px solid rgba(15,23,42,0.08)",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}