// src/pages/EditPage.jsx
import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import {
  DOC_TYPES,
  kindToBackendType,
  backendTypeToKind,
} from "../constants/docTypes";
import AutocompleteInput from "../components/AutocompleteInput";

const NPA_STATUS_OPTIONS = ["Проект", "Принято", "Неактуально"];

// Хелпер: проверить, что source_link у документа — это ссылка на файл из S3/MinIO
function isInternalSourceLink(doc) {
  if (!doc?.source_link) return false;
  if (!Array.isArray(doc.links) || !doc.links.length) return false;
  return doc.links.some(
    (l) => l?.s3_key && doc.source_link.includes(l.s3_key)
  );
}

function extractTagsAsStrings(initialDoc) {
  if (Array.isArray(initialDoc?.keywords)) return initialDoc.keywords.filter(Boolean);

  if (Array.isArray(initialDoc?.tags)) {
    return initialDoc.tags
      .map((t) => t?.tag_name ?? t?.tag ?? (typeof t === "string" ? t : ""))
      .filter(Boolean);
  }

  return [];
}

export default function EditPage({
  documentId,
  initialDoc,
  onUpdated,

  afterSaveHash = "/",
  afterCancelHash = "/",

  afterSave,

  saveButtonLabel,

  onDelete,
  deleteButtonLabel = "Удалить",
}) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyDelete, setBusyDelete] = useState(false);
  const [error, setError] = useState("");

  // Подсказки с бэка
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [npaTypeSuggestions, setNpaTypeSuggestions] = useState([]);

  useEffect(() => {
    api
      .listTags()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setTagSuggestions(list);
      })
      .catch(() => {});

    api
      .listUniqueValues("npa_type")
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setNpaTypeSuggestions(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!initialDoc) return;

    const kind =
      initialDoc.kind ||
      backendTypeToKind(
        initialDoc.document_type || initialDoc.documentType || ""
      ) ||
      "NPA";

    const typeCfg = DOC_TYPES[kind];
    const internalSrc = isInternalSourceLink(initialDoc);
    const tagsArr = extractTagsAsStrings(initialDoc);

    const base = {
      kind,
      title: initialDoc.title || "",
      document_date: initialDoc.document_date || "",
      access_level: initialDoc.access_level || initialDoc.accessLevel || "",
      source_link: internalSrc ? "" : (initialDoc.source_link || ""),
      tags: tagsArr.join(", "),
    };

    if (typeCfg?.metadataFields?.length) {
      typeCfg.metadataFields.forEach(({ key, isDocDate, isSourceLink }) => {
        if (isDocDate || isSourceLink) return;
        base[key] = initialDoc[key] ?? initialDoc.metadata?.[key] ?? "";
      });
    }

    setForm(base);
    setError("");
  }, [initialDoc]);

  const setF = (key, value) =>
    setForm((prev) => ({
      ...(prev || {}),
      [key]: value,
    }));

  if (!initialDoc) {
    return (
      <div className="ec-page">
        <h2>Редактировать документ</h2>
        <p>Загружаем данные документа…</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="ec-page">
        <h2>Редактировать документ</h2>
        <p>Подготавливаем форму…</p>
      </div>
    );
  }

  const typeCfg = DOC_TYPES[form.kind];
  const docDateField =
    typeCfg?.metadataFields?.find((f) => f.isDocDate) || null;
  const hasSourceLinkField = !!typeCfg?.metadataFields?.some(
    (f) => f.isSourceLink
  );

  async function handleSubmit(e) {
    e.preventDefault();

    if (docDateField && !form.document_date) {
      alert(`Укажите поле: "${docDateField.label}"`);
      return;
    }

    const metadataRaw = {};
    let hasNonEmptyMeta = false;

    if (typeCfg?.metadataFields?.length) {
      for (const field of typeCfg.metadataFields) {
        if (field.isDocDate || field.isSourceLink) continue;

        const raw = form[field.key];
        if (raw === undefined || raw === null) continue;

        let str =
          typeof raw === "string" ? raw.trim() : String(raw).trim();
        if (!str) continue;

        if (field.valueType === "int") {
          const parsed = parseInt(str, 10);
          if (Number.isNaN(parsed)) {
            alert(`Поле "${field.label}" должно быть числом`);
            return;
          }
          metadataRaw[field.key] = parsed;
        } else {
          metadataRaw[field.key] = str;
        }

        hasNonEmptyMeta = true;
      }
    }

    let tagsArr = undefined;
    if (typeof form.tags === "string") {
      tagsArr = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const payload = {
      title: form.title || "(без названия)",
      document_type: kindToBackendType(form.kind),
      access_level: form.access_level || "",
    };

    if (docDateField && form.document_date) {
      payload.document_date = form.document_date;
    }

    if (hasSourceLinkField) {
      const link = (form.source_link || "").trim();
      payload.source_link = link || null;
    }

    if (tagsArr !== undefined) payload.tags = tagsArr;
    if (typeCfg?.metadataFields?.length) {
      payload.metadata = hasNonEmptyMeta ? metadataRaw : null;
    }

    setBusy(true);
    setError("");
    try {
      await api.updateDocument(documentId, payload);

      if (onUpdated) await onUpdated();

      if (afterSave) {
        await afterSave(payload);
      }

      window.location.hash = afterSaveHash;
    } catch (err) {
      setError(err?.message || "Не удалось сохранить изменения");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteClick() {
    if (!onDelete) return;
    const ok = window.confirm("Удалить документ? Это действие нельзя отменить.");
    if (!ok) return;

    setBusyDelete(true);
    setError("");
    try {
      await onDelete();
      window.location.hash = afterCancelHash;
    } catch (err) {
      setError(err?.message || "Не удалось удалить документ");
    } finally {
      setBusyDelete(false);
    }
  }

  const renderMetaField = (field) => {
    let value;
    let onChange;
    let inputType = "text";

    if (field.isDocDate) {
      value = form.document_date || "";
      onChange = (e) => setF("document_date", e.target.value);
      inputType = "date";
    } else if (field.isSourceLink) {
      value = form.source_link || "";
      onChange = (e) => setF("source_link", e.target.value);
    } else {
      value = form[field.key] ?? "";
      onChange = (e) => setF(field.key, e.target.value);
      if (field.kind === "date") inputType = "date";
      if (field.kind === "number") inputType = "number";
    }

    // Автодополнение для «Вид НПА»
    if (field.key === "npa_type" && !field.isDocDate && !field.isSourceLink) {
      return (
        <label key={field.key} className="ec-label">
          {field.label}
          <AutocompleteInput
            className="ec-input"
            value={value}
            onChange={(val) => setF(field.key, val)}
            suggestions={npaTypeSuggestions}
          />
        </label>
      );
    }

    // Выпадающий список для «Статус НПА»
    if (field.key === "status" && !field.isDocDate && !field.isSourceLink) {
      return (
        <label key={field.key} className="ec-label">
          {field.label}
          <select
            className="ec-input"
            value={value}
            onChange={(e) => setF(field.key, e.target.value)}
          >
            <option value="">(не задан)</option>
            {NPA_STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
      );
    }

    const commonProps = { className: "ec-input", value, onChange };

    let control;
    switch (field.kind) {
      case "textarea":
        control = <textarea {...commonProps} rows={3} />;
        break;
      case "date":
        control = <input type="date" {...commonProps} />;
        break;
      case "number":
        control = <input type="number" {...commonProps} />;
        break;
      default:
        control = <input type={inputType} {...commonProps} />;
    }

    return (
      <label key={field.key} className="ec-label">
        {field.label}
        {control}
      </label>
    );
  };

  return (
    <form className="ec-add" onSubmit={handleSubmit}>
      <h2 className="ec-add__title">Редактировать документ</h2>

      {error && <div className="ec-alert ec-alert--error">{error}</div>}

      <div className="ec-grid-2">
        <label className="ec-label">
          Тип документа
          <select
            className="ec-input"
            value={form.kind}
            onChange={(e) => setF("kind", e.target.value)}
          >
            {Object.entries(DOC_TYPES).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.label}
              </option>
            ))}
          </select>
        </label>

        <label className="ec-label">
          Наименование документа
          <input
            className="ec-input"
            value={form.title}
            onChange={(e) => setF("title", e.target.value)}
            required
          />
        </label>
      </div>

      <div className="ec-grid-2">
        <label className="ec-label">
          Уровень доступа
          <select
            className="ec-input"
            value={form.access_level}
            onChange={(e) => setF("access_level", e.target.value)}
          >
            <option value="">(не задан)</option>
            <option value="public">публичный</option>
            <option value="internal">частный</option>
          </select>
        </label>

        <label className="ec-label">
          Ключевые слова / теги (через запятую)
          <AutocompleteInput
            className="ec-input"
            value={form.tags || ""}
            onChange={(val) => setF("tags", val)}
            suggestions={tagSuggestions}
            multi
            placeholder="вуз, аккредитация"
          />
        </label>
      </div>

      {typeCfg?.metadataFields?.length > 0 && (
        <div className="ec-grid-2">{typeCfg.metadataFields.map(renderMetaField)}</div>
      )}

      <div className="ec-add__actions">
        <button className="btn btn-primary" disabled={busy || busyDelete}>
          {busy ? "Сохраняем…" : (saveButtonLabel || "Сохранить изменения")}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => (window.location.hash = afterCancelHash)}
          disabled={busy || busyDelete}
        >
          Отмена
        </button>

        {onDelete && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleDeleteClick}
            disabled={busy || busyDelete}
            style={{ marginLeft: "auto" }}
          >
            {busyDelete ? "Удаляем…" : deleteButtonLabel}
          </button>
        )}
      </div>
    </form>
  );
}