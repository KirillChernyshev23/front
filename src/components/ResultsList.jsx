// src/components/ResultsList.jsx
import React, { useState } from "react";
import { DOC_TYPES } from "../constants/docTypes";
import { api } from "../api/client";
import { normalizeMinioUrl } from "../utils/docUtils";
import AddToProjectModal from "./AddToProjectModal";

const LAST_ROUTE_AFTER_LOGIN = "ec_after_login_route";

function formatDateDDMMYYYY(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function ensureAbsoluteUrl(url) {
  if (!url) return "";
  const u = String(url).trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (u.startsWith("//")) return "https:" + u;
  return "https://" + u;
}

function looksLikeStorageUrl(url) {
  if (!url) return false;
  const s = String(url);
  if (s.includes("/documents/")) return true;
  return false;
}

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

function getPreviewText(doc) {
  const s = doc?.summary;
  return typeof s === "string" ? s.trim() : "";
}

function truncate(text, n = 700) {
  if (!text) return "";
  if (text.length <= n) return text;
  return text.slice(0, n).trimEnd() + "…";
}

export default function ResultsList({
  items,
  onDelete,
  isAdmin,
  isAuthenticated,
}) {
  const [addToProjectDocId, setAddToProjectDocId] = useState(null);

  function handleAddToProject(docId) {
    const token = localStorage.getItem("ec_jwt_token");
    if (!token) {
      const desired = window.location.hash.replace("#", "") || "/";
      localStorage.setItem(LAST_ROUTE_AFTER_LOGIN, desired);
      window.location.hash = "/login";
      return;
    }
    setAddToProjectDocId(docId);
  }

  if (!items.length) {
    return (
      <div className="ec-empty">
        <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.3 }}>📄</div>
        <div style={{ fontWeight: 600 }}>Ничего не найдено</div>
        <div style={{ color: "#6b7280", marginTop: 4, fontSize: 14 }}>
          Измените запрос или фильтры
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="ec-list">
        {items.map((d) => (
          <ResultItem
            key={d.id}
            doc={d}
            onDelete={onDelete}
            isAdmin={isAdmin}
            isAuthenticated={isAuthenticated}
            onAddToProject={handleAddToProject}
          />
        ))}
      </div>

      {isAuthenticated && (
        <AddToProjectModal
          open={addToProjectDocId != null}
          documentId={addToProjectDocId}
          onClose={() => setAddToProjectDocId(null)}
        />
      )}
    </>
  );
}

function ResultItem({
  doc,
  onDelete,
  isAdmin,
  isAuthenticated,
  onAddToProject,
}) {
  const typeCfg = DOC_TYPES[doc.kind];
  const docDateField =
    typeCfg?.metadataFields?.find((f) => f.isDocDate) || null;
  const hasSourceLinkField = !!typeCfg?.metadataFields?.some(
    (f) => f.isSourceLink
  );
  const internalSrc = isInternalSourceLink(doc);
  const createdAt = doc.uploadedAt || doc.created_at;

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
        if (typeof first === "string") url = first;
        else if (first && typeof first === "object")
          url = first.url || first.download_url || first.href || "";
      } else if (res && typeof res === "object") {
        url = res.url || res.download_url || res.href || "";
      }
      if (url) {
        url = normalizeMinioUrl(url);
        window.open(url, "_blank", "noopener,noreferrer");
        return;
      }
    } catch (e) {
      console.error("Не удалось получить download-url:", e);
    }
    if (doc.source_link) {
      const url = ensureAbsoluteUrl(normalizeMinioUrl(doc.source_link));
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      alert("Не удалось получить ссылку на файл");
    }
  }

  function handleDelete() {
    if (!isAdmin || !onDelete) return;
    if (window.confirm("Удалить документ?")) onDelete(doc.id);
  }

  function handleEdit() {
    if (!isAdmin) return;
    window.location.hash = `/edit/${doc.id}`;
  }

  function handleToProject() {
    const id = doc.apiId ?? doc.id;
    if (!id) return;
    if (typeof onAddToProject === "function") onAddToProject(id);
  }

  const shownText = showFull ? previewText : truncate(previewText, 700);
  const canExpandFull = previewText.length > 700;
  const tags = doc.keywords || [];

  return (
    <article className="ec-item">
      {/* Title row */}
      <div className="ec-item__row1">
        <h3 className="ec-item__title">
          {doc.title}
          <span className="kind">{typeCfg?.label || doc.kind}</span>
        </h3>
      </div>

      {/* Meta row */}
      <div className="ec-item__meta">
        {createdAt && (
          <span>
            Загружено <b>{new Date(createdAt).toLocaleDateString()}</b>
          </span>
        )}
        {docDateField && doc.document_date && (
          <span>
            {docDateField.label}{" "}
            <b>{formatDateDDMMYYYY(doc.document_date)}</b>
          </span>
        )}
      </div>

      {/* Tags */}
      {tags.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
            marginTop: 8,
          }}
        >
          {tags.map((k) => (
            <span
              key={k}
              style={{
                fontSize: 11,
                padding: "3px 9px",
                borderRadius: 999,
                background: "rgba(37,99,235,0.06)",
                border: "1px solid rgba(37,99,235,0.12)",
                color: "#2563eb",
                fontWeight: 500,
              }}
            >
              {k}
            </span>
          ))}
        </div>
      )}

      {/* Metadata fields */}
      <div className="ec-kv">
        {typeCfg?.metadataFields?.map(
          ({ key, label, isSourceLink, isDocDate, kind }) => {
            if (isDocDate) return null;
            if (isSourceLink) return null;
            let value = doc[key];
            if (value === null || value === undefined || value === "")
              return null;
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
            <b>Источник:</b>{" "}
            <a
              href={ensureAbsoluteUrl(normalizeMinioUrl(doc.source_link))}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#2563eb" }}
            >
              {doc.source_link.length > 60
                ? doc.source_link.slice(0, 60) + "…"
                : doc.source_link}
            </a>
          </div>
        )}
      </div>

      {/* Description */}
      {isDescOpen && (
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
          {hasPreview ? (
            <>
              {shownText}
              {canExpandFull && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ fontSize: 12, padding: "4px 10px" }}
                    onClick={() => setShowFull((v) => !v)}
                  >
                    {showFull ? "Свернуть" : "Показать полностью"}
                  </button>
                </div>
              )}
            </>
          ) : (
            <span style={{ color: "#9ca3af" }}>Описание пока недоступно.</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="ec-item__actions">
        <button
          className="btn btn-primary"
          onClick={handleOpenFile}
          type="button"
        >
          Открыть файл
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setIsDescOpen((v) => !v)}
        >
          {isDescOpen ? "Скрыть описание" : "Описание"}
        </button>

        {isAuthenticated && (
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleToProject}
          >
            В проект
          </button>
        )}

        {isAdmin && (
          <>
            <button
              className="btn btn-secondary"
              onClick={handleEdit}
              type="button"
            >
              Редактировать
            </button>
            <button
              className="btn btn-ghost"
              onClick={handleDelete}
              type="button"
            >
              Удалить
            </button>
          </>
        )}
      </div>
    </article>
  );
}