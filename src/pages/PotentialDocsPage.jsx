// src/pages/PotentialDocsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { DOC_TYPES, backendTypeToKind } from "../constants/docTypes";

/**
 * TODO: поменяй на реальную ручку бэка, когда будет готово
 * Пример: "/collector/source-suggestions"
 */
const SOURCE_SUGGESTION_POST_PATH = "/collector/sites";

/** --- helpers (локально, чтобы не зависеть от импортов) --- */
function ensureAbsoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
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
    if (v.startsWith("http://") || v.startsWith("https://")) return true;
    if (v.startsWith("/")) return true;
    return false;
  };

  const toOpenableUrl = (s) => {
    if (!s) return "";
    const v = String(s).trim();
    if (!v) return "";
    if (v.startsWith("http://") || v.startsWith("https://")) return v;
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
    const s = res.find((x) => isUrlLikeString(x));
    if (s) return toOpenableUrl(s);

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

/** --- SCORE helpers --- */
function getScore(doc) {
  const raw = doc?.score;

  if (raw === null || raw === undefined || raw === "") return null;

  const value = Array.isArray(raw) ? raw[0] : raw;

  const num =
    typeof value === "number"
      ? value
      : parseFloat(String(value).replace(",", "."));

  if (Number.isNaN(num)) return null;

  return Math.max(0, Math.min(10, num));
}

function formatScore(score) {
  if (score === null || score === undefined) return "—";
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

function scoreBadgeStyle(score) {
  if (score === null || score === undefined) {
    return {
      background: "rgba(15,23,42,0.06)",
      border: "1px solid rgba(15,23,42,0.10)",
      color: "#374151",
    };
  }

  const hue = (score / 10) * 120;
  const bg = `hsl(${hue} 85% 45%)`;
  const bd = `hsl(${hue} 85% 35%)`;
  const textColor = hue >= 45 && hue <= 80 ? "#111827" : "#ffffff";

  return {
    background: bg,
    border: `1px solid ${bd}`,
    color: textColor,
  };
}

export default function PotentialDocsPage() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState({ id: null, action: "" }); // approve|delete|open
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [openMap, setOpenMap] = useState({});
  const [fullMap, setFullMap] = useState({});

  const [scoreSortDir, setScoreSortDir] = useState("desc"); // desc|asc

  // ====== NEW: форма предложения источника (только ссылка) ======
  const [srcUrl, setSrcUrl] = useState("");
  const [srcBusy, setSrcBusy] = useState(false);
  const [srcMsg, setSrcMsg] = useState("");
  const [srcErr, setSrcErr] = useState("");

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

    if (doc.source_link) {
      const url = ensureAbsoluteUrl(normalizeMinioUrl(doc.source_link));
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      alert("Не удалось получить ссылку на файл");
    }
  }

  // ====== NEW: отправка предложения (только url) ======
  async function submitSourceSuggestion(e) {
    e.preventDefault();
    setSrcMsg("");
    setSrcErr("");

    const url = (srcUrl || "").trim();
    if (!url) {
      setSrcErr("Укажи ссылку на источник.");
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

    setSrcBusy(true);
    try {
      await api._fetch(SOURCE_SUGGESTION_POST_PATH, {
        method: "POST",
        body: JSON.stringify({ url: normalizedUrl }),
      });

      setSrcMsg("Спасибо! Ссылка отправлена.");
      setSrcUrl("");
    } catch (err) {
      setSrcErr(
        err?.message ||
          "Не удалось отправить."
      );
    } finally {
      setSrcBusy(false);
    }
  }

  const itemsVm = useMemo(() => {
    const mapped = items.map((d) => ({
      ...d,
      _preview: getPreviewText(d, annotations),
      _score: getScore(d),
    }));

    const dir = scoreSortDir;
    const valueForSort = (s) => {
      if (s === null || s === undefined) return dir === "desc" ? -1 : 11;
      return s;
    };

    mapped.sort((a, b) => {
      const av = valueForSort(a._score);
      const bv = valueForSort(b._score);
      const diff = av - bv;
      if (diff === 0) return (a.id || 0) - (b.id || 0);
      return dir === "asc" ? diff : -diff;
    });

    return mapped;
  }, [items, scoreSortDir, annotations]);

  return (
    <div className="ec-page">
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 className="ec-page__title" style={{ margin: 0 }}>
          Предложенные карточки
        </h2>

        <button className="btn btn-ghost" type="button" onClick={load} disabled={loading}>
          {loading ? "Обновляем…" : "Обновить"}
        </button>

        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => setScoreSortDir((d) => (d === "desc" ? "asc" : "desc"))}
          disabled={loading}
          style={{ marginLeft: "0.25rem" }}
          title="Сортировка по score"
        >
          Score {scoreSortDir === "desc" ? "↓" : "↑"}
        </button>

        <div style={{ color: "#6b7280", fontSize: 13 }}>
          В очереди: {items.length}
        </div>
      </div>

      {error && <div className="ec-alert ec-alert--error">{error}</div>}

      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "flex-start",
          marginTop: 12,
          flexWrap: "wrap",
        }}
      >
        {/* левая колонка: форма */}
        <div style={{ flex: "0 0 320px", maxWidth: 360, width: "100%" }}>
          <div
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: 12,
              background: "#fff",
            }}
          >
            <h3 style={{ margin: "0 0 10px 0", fontSize: 16 }}>
              Предложить источник
            </h3>

            <form onSubmit={submitSourceSuggestion}>
              <label className="ec-label">
                Ссылка (URL)
                <input
                  className="ec-input"
                  value={srcUrl}
                  onChange={(e) => setSrcUrl(e.target.value)}
                  placeholder="https://example.com/news"
                  required
                />
              </label>

              {srcErr && (
                <div className="ec-alert ec-alert--error" style={{ marginTop: 8 }}>
                  {srcErr}
                </div>
              )}
              {srcMsg && (
                <div className="ec-alert" style={{ marginTop: 8 }}>
                  {srcMsg}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button className="btn btn-primary" type="submit" disabled={srcBusy}>
                  {srcBusy ? "Отправляем…" : "Отправить"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={srcBusy}
                  onClick={() => {
                    setSrcUrl("");
                    setSrcErr("");
                    setSrcMsg("");
                  }}
                >
                  Очистить
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* правая колонка: карточки */}
        <div style={{ flex: "1 1 560px", width: "100%" }}>
          {!loading && items.length === 0 && (
            <p style={{ marginTop: 12 }}>
              Очередь пуста — непринятых карточек нет.
            </p>
          )}

          <div style={{ display: "grid", gap: 12 }}>
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

              const badge = scoreBadgeStyle(doc._score);

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
                    <div style={{ minWidth: 0, display: "flex", gap: 10, alignItems: "flex-start" }}>
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

                      <div
                        title={doc._score == null ? "Score отсутствует" : `Score: ${formatScore(doc._score)} / 10`}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 999,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 800,
                          fontSize: 13,
                          lineHeight: 1,
                          flex: "0 0 auto",
                          ...badge,
                        }}
                      >
                        {formatScore(doc._score)}
                      </div>

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
                          onClick={() => window.open(ensureAbsoluteUrl(doc.source_link), "_blank", "noopener,noreferrer")}
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
                          <button type="button" className="btn btn-ghost" onClick={() => toggleFull(doc.id)}>
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
      </div>
    </div>
  );
}
