// src/pages/PotentialDocsPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { DOC_TYPES, backendTypeToKind } from "../constants/docTypes";

/** --- helpers --- */
function ensureAbsoluteUrl(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  const base =
    process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";
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
  if (typeof res === "string")
    return isUrlLikeString(res) ? toOpenableUrl(res) : "";

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

function getPreviewText(doc, annotations) {
  if (!doc?.id) return "";
  const annotation = annotations[doc.id];
  if (typeof annotation === "string") return annotation.trim() || "";
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
  return { background: bg, border: `1px solid ${bd}`, color: textColor };
}

/** --- site helpers --- */
function normalizeSiteUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (!/^https?:\/\//i.test(raw)) return `https://${raw}`;
  return raw;
}

export default function PotentialDocsPage() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState({ id: null, action: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [openMap, setOpenMap] = useState({});
  const [fullMap, setFullMap] = useState({});
  const [annotations, setAnnotations] = useState({});
  const [scoreSortDir, setScoreSortDir] = useState("desc");

  const [siteName, setSiteName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [siteBusy, setSiteBusy] = useState(false);
  const [siteError, setSiteError] = useState("");
  const [siteOk, setSiteOk] = useState("");

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

      const annotationPromises = documents.map(async (doc) => {
        try {
          const summaryResponse = await api.getDocumentAnnotation(doc.id);
          const annotation = summaryResponse?.summary || "";
          return {
            id: doc.id,
            annotation: typeof annotation === "string" ? annotation : "",
          };
        } catch (e) {
          console.warn(
            `Failed to fetch summary for document ${doc.id}:`,
            e
          );
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
    const ok = window.confirm("Удалить документ? Это действие нельзя отменить.");
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

  async function submitSite(e) {
    e.preventDefault();
    setSiteError("");
    setSiteOk("");
    const name = String(siteName || "").trim();
    const url = normalizeSiteUrl(siteUrl);
    if (!name || !url) {
      setSiteError("Заполните название и URL сайта.");
      return;
    }
    try {
      new URL(url);
    } catch {
      setSiteError("Похоже, URL некорректный. Пример: https://example.com/");
      return;
    }
    setSiteBusy(true);
    try {
      await api.addSourceSite({ name, url });
      setSiteOk("Сайт добавлен.");
      setSiteName("");
      setSiteUrl("");
    } catch (e2) {
      setSiteError(e2?.message || "Не удалось добавить сайт.");
    } finally {
      setSiteBusy(false);
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
      if (s === null || s === undefined)
        return dir === "desc" ? -1 : 11;
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
    <div style={{ padding: "8px 0" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
          Предложенные карточки
        </h2>

        <button
          className="btn btn-ghost"
          type="button"
          onClick={load}
          disabled={loading}
          style={{ fontSize: 13 }}
        >
          {loading ? "Обновляем…" : "↻ Обновить"}
        </button>

        <button
          className="btn btn-secondary"
          type="button"
          onClick={() =>
            setScoreSortDir((d) => (d === "desc" ? "asc" : "desc"))
          }
          disabled={loading}
          style={{ fontSize: 13 }}
        >
          Score {scoreSortDir === "desc" ? "↓" : "↑"}
        </button>

        <div
          style={{
            fontSize: 13,
            color: "#6b7280",
            marginLeft: "auto",
            background: "rgba(15,23,42,0.04)",
            padding: "4px 12px",
            borderRadius: 999,
          }}
        >
          В очереди: <b>{items.length}</b>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "rgba(220,38,38,0.06)",
            border: "1px solid rgba(220,38,38,0.15)",
            color: "#991b1b",
            padding: "10px 14px",
            borderRadius: 12,
            fontSize: 14,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}

      {/* Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 16,
          alignItems: "start",
        }}
      >
        {/* Sidebar: add site */}
        <div
          className="ec-sidebar"
          style={{ position: "sticky", top: 16 }}
        >
          <div
            style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}
          >
            Добавить сайт-источник
          </div>

          <form onSubmit={submitSite}>
            <label className="ec-label">
              Название
              <input
                className="ec-input"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="Напр.: Минобрнауки"
                disabled={siteBusy}
                style={{ marginTop: 4, width: "100%" }}
              />
            </label>

            <label className="ec-label">
              URL
              <input
                className="ec-input"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://example.com/"
                disabled={siteBusy}
                style={{ marginTop: 4, width: "100%" }}
              />
            </label>

            {siteError && (
              <div
                style={{
                  marginTop: 8,
                  background: "rgba(220,38,38,0.06)",
                  border: "1px solid rgba(220,38,38,0.15)",
                  color: "#991b1b",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 13,
                }}
              >
                {siteError}
              </div>
            )}

            {siteOk && (
              <div
                style={{
                  marginTop: 8,
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  color: "#065f46",
                  padding: "8px 10px",
                  borderRadius: 10,
                  fontSize: 13,
                }}
              >
                {siteOk}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={siteBusy}
              style={{ width: "100%", marginTop: 12 }}
            >
              {siteBusy ? "Добавляем…" : "Добавить сайт"}
            </button>
          </form>
        </div>

        {/* Documents */}
        <div>
          {!loading && items.length === 0 && (
            <div
              className="ec-empty"
              style={{ textAlign: "center", padding: 32 }}
            >
              <div style={{ fontSize: 36, opacity: 0.3, marginBottom: 8 }}>
                ✓
              </div>
              <div style={{ fontWeight: 600 }}>Очередь пуста</div>
              <div style={{ color: "#6b7280", fontSize: 14, marginTop: 4 }}>
                Непринятых карточек нет
              </div>
            </div>
          )}

          <div style={{ display: "grid", gap: 10 }}>
            {itemsVm.map((doc) => {
              const tags = getTags(doc);
              const isBusyApprove =
                busy.id === doc.id && busy.action === "approve";
              const isBusyDelete =
                busy.id === doc.id && busy.action === "delete";
              const isBusyOpen =
                busy.id === doc.id && busy.action === "open";
              const anyBusy = isBusyApprove || isBusyDelete || isBusyOpen;

              const isOpen = !!openMap[doc.id];
              const hasPreview = !!doc._preview;
              const showFull = !!fullMap[doc.id];
              const shownText = showFull
                ? doc._preview
                : truncate(doc._preview, 700);
              const canExpandFull =
                doc._preview && doc._preview.length > 700;

              const badge = scoreBadgeStyle(doc._score);

              return (
                <div
                  key={doc.id}
                  className="ec-item"
                  style={{ margin: 0 }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "flex-start",
                    }}
                  >
                    {/* Score */}
                    <div
                      title={
                        doc._score == null
                          ? "Score отсутствует"
                          : `Score: ${formatScore(doc._score)} / 10`
                      }
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 800,
                        fontSize: 13,
                        lineHeight: 1,
                        flexShrink: 0,
                        ...badge,
                      }}
                    >
                      {formatScore(doc._score)}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {doc.title || "(без названия)"}
                      </div>
                      <div
                        style={{
                          color: "#6b7280",
                          fontSize: 13,
                          marginTop: 3,
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{getTypeLabel(doc)}</span>
                        <span>·</span>
                        <span>
                          {doc.document_date || doc.documentDate || "—"}
                        </span>
                        <span>·</span>
                        <span style={{ opacity: 0.6 }}>ID {doc.id}</span>
                      </div>

                      {/* Tags */}
                      {tags.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            gap: 5,
                            flexWrap: "wrap",
                            marginTop: 8,
                          }}
                        >
                          {tags.slice(0, 12).map((t) => (
                            <span
                              key={t}
                              style={{
                                fontSize: 11,
                                padding: "2px 8px",
                                borderRadius: 999,
                                background: "rgba(37,99,235,0.06)",
                                border: "1px solid rgba(37,99,235,0.12)",
                                color: "#2563eb",
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                        flexShrink: 0,
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => toggleOpen(doc.id)}
                        disabled={!hasPreview}
                        style={{
                          padding: "6px 10px",
                          fontSize: 12,
                          opacity: hasPreview ? 1 : 0.4,
                        }}
                      >
                        {isOpen ? "Скрыть" : "Описание"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => openPdfForDoc(doc)}
                        disabled={anyBusy}
                        style={{ padding: "6px 10px", fontSize: 12 }}
                      >
                        {isBusyOpen ? "…" : "PDF"}
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
                          disabled={anyBusy}
                          style={{ padding: "6px 10px", fontSize: 12 }}
                        >
                          Источник
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          (window.location.hash = `/potential/edit/${doc.id}`)
                        }
                        disabled={anyBusy}
                        style={{ padding: "6px 10px", fontSize: 12 }}
                      >
                        Редактировать
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => approve(doc.id)}
                        disabled={anyBusy}
                        style={{ padding: "6px 12px", fontSize: 12 }}
                      >
                        {isBusyApprove ? "…" : "✓ Подтвердить"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => remove(doc.id)}
                        disabled={anyBusy}
                        style={{
                          padding: "6px 10px",
                          fontSize: 12,
                          color: "#dc2626",
                        }}
                      >
                        {isBusyDelete ? "…" : "Удалить"}
                      </button>
                    </div>
                  </div>

                  {/* Description */}
                  {hasPreview && isOpen && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: "10px 12px",
                        borderRadius: 10,
                        background: "rgba(15,23,42,0.02)",
                        border: "1px solid rgba(15,23,42,0.06)",
                        color: "#374151",
                        fontSize: 14,
                        lineHeight: 1.5,
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
                            style={{ fontSize: 12, padding: "4px 10px" }}
                          >
                            {showFull ? "Свернуть" : "Показать полностью"}
                          </button>
                        </div>
                      )}
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