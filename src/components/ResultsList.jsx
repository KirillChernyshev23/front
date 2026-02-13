// src/components/ResultsList.jsx
import React, { useState } from "react";
import { DOC_TYPES } from "../constants/docTypes";
import { api } from "../api/client";
import { normalizeMinioUrl } from "../utils/docUtils";

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

// user-friendly: если ввели "site.com", откроем "https://site.com"
function ensureAbsoluteUrl(url) {
  if (!url) return "";
  const u = String(url).trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return "https:" + u;
  return "https://" + u;
}

// Похожа ли ссылка на внутреннюю ссылку хранилища (MinIO/S3)?
function looksLikeStorageUrl(url) {
  if (!url) return false;
  const s = String(url);
  if (s.includes("/documents/")) return true;
  return false;
}

// Проверяем, что source_link у документа — это ссылка на файл из хранилища,
// а не внешний интернет-источник
function isInternalSourceLink(doc) {
  if (!doc?.source_link) return false;

  if (Array.isArray(doc.links) && doc.links.length) {
    const match = doc.links.some(
      (l) => l?.s3_key && doc.source_link.includes(l.s3_key)
    );
    if (match) return true;
  }

  return looksLikeStorageUrl(doc.source_link);
}

// --- описание/краткий текст (потом можешь заменить на нужное поле) ---
function getPreviewText(doc) {
  const candidates = [
    doc?.summary,
    doc?.short_description,
    doc?.description,
    doc?.abstract,
    doc?.excerpt,
    doc?.llm_summary,
    doc?.metadata?.summary,
    doc?.metadata?.description,
    doc?.metadata?.llm_summary,
    doc?.metadata?.short_description,
    doc?.full_text,
    doc?.contents,
    doc?.text,
  ];
  const text = candidates.find((x) => typeof x === "string" && x.trim());
  return text ? text.trim() : "";
}

function truncate(text, n = 700) {
  if (!text) return "";
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

export default function ResultsList({ items, onDelete, isAdmin }) {
  if (!items.length) {
    return (
      <div className="ec-empty">
        Ничего не найдено. Измените запрос или фильтры.
      </div>
    );
  }

  return (
    <div className="ec-list">
      {items.map((d) => (
        <ResultItem key={d.id} doc={d} onDelete={onDelete} isAdmin={isAdmin} />
      ))}
    </div>
  );
}

function ResultItem({ doc, onDelete, isAdmin }) {
  const typeCfg = DOC_TYPES[doc.kind];

  const docDateField =
    typeCfg?.metadataFields?.find((f) => f.isDocDate) || null;

  const hasSourceLinkField = !!typeCfg?.metadataFields?.some(
    (f) => f.isSourceLink
  );

  const internalSrc = isInternalSourceLink(doc);
  const createdAt = doc.uploadedAt || doc.created_at;

  // --- состояние "шторки" ---
  const previewText = getPreviewText(doc);
  const hasPreview = !!previewText;
  const [isDescOpen, setIsDescOpen] = useState(false);
  const [showFull, setShowFull] = useState(false);

  async function handleOpenFile() {
    try {
      const res = await api.getDocumentDownloadUrls(doc.id);
      let url = "";

      if (Array.isArray(res) && res.length) {
        const first = res[0];

        if (typeof first === "string") {
          url = first;
        } else if (first && typeof first === "object") {
          url = first.url || first.download_url || first.href || "";
        }
      } else if (res && typeof res === "object") {
        url = res.url || res.download_url || res.href || "";
      }

      if (url) {
        url = normalizeMinioUrl(url);
        window.open(url, "_blank");
        return;
      }
    } catch (e) {
      console.error("Не удалось получить download-url:", e);
    }

    if (doc.source_link) {
      const url = ensureAbsoluteUrl(normalizeMinioUrl(doc.source_link));
      window.open(url, "_blank");
    } else {
      alert("Не удалось получить ссылку на файл");
    }
  }

  function handleDelete() {
    if (!isAdmin) return;
    if (!onDelete) return;
    if (window.confirm("Удалить документ?")) {
      onDelete(doc.id);
    }
  }

  function handleEdit() {
    if (!isAdmin) return;
    window.location.hash = `/edit/${doc.id}`;
  }

  const shownText = showFull ? previewText : truncate(previewText, 700);
  const canExpandFull = previewText.length > 700;

  return (
    <article className="ec-item">
      <div className="ec-item__row1">
        <h3 className="ec-item__title">
          {doc.title} <span className="kind">{typeCfg?.label || doc.kind}</span>
        </h3>
        <span className="badge">{doc.fileType || "—"}</span>
      </div>

      <div className="ec-item__meta">
        {createdAt && (
          <span>
            Загружено: <b>{new Date(createdAt).toLocaleDateString()}</b>
          </span>
        )}
        {!!(doc.keywords || []).length && (
          <span>
            Теги:{" "}
            <b>{(doc.keywords || []).map((k) => `#${k}`).join(", ")}</b>
          </span>
        )}
      </div>

      <div className="ec-kv">
        {docDateField && doc.document_date && (
          <div className="kv">
            <b>{docDateField.label}:</b>{" "}
            <span>{formatDateDDMMYYYY(doc.document_date)}</span>
          </div>
        )}

        {typeCfg?.metadataFields?.map(
          ({ key, label, isSourceLink, isDocDate, kind }) => {
            if (isDocDate) return null;
            if (isSourceLink) return null;

            let value = doc[key];
            if (value === null || value === undefined || value === "") return null;

            if (kind === "date") value = formatDateDDMMYYYY(value);

            return (
              <div className="kv" key={`meta-${key}`}>
                <b>{label}:</b> <span>{value}</span>
              </div>
            );
          }
        )}

        {hasSourceLinkField && doc.source_link && !internalSrc && (
          <div className="kv">
            <b>Ссылка на интернет-источник:</b>{" "}
            <a
              href={ensureAbsoluteUrl(normalizeMinioUrl(doc.source_link))}
              target="_blank"
              rel="noreferrer"
            >
              {doc.source_link}
            </a>
          </div>
        )}
      </div>

      {/* ✅ шторка "Описание" — раскрывается вниз */}
      {isDescOpen && (
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
          {hasPreview ? (
            <>
              {shownText}
              {canExpandFull && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowFull((v) => !v)}
                  >
                    {showFull ? "Свернуть" : "Показать полностью"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <span style={{ color: "#6b7280" }}>
              Описание пока недоступно.
            </span>
          )}
        </div>
      )}

      <div className="ec-item__actions">
        <button className="btn btn-primary" onClick={handleOpenFile}>
          Открыть файл
        </button>

        {/* ✅ новая кнопка */}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setIsDescOpen((v) => !v)}
        >
          {isDescOpen ? "Скрыть описание" : "Описание"}
        </button>

        {isAdmin && (
          <>
            <button className="btn btn-secondary" onClick={handleEdit}>
              Редактировать
            </button>
            <button className="btn btn-ghost" onClick={handleDelete}>
              Удалить
            </button>
          </>
        )}
      </div>
    </article>
  );
}