// src/pages/AddPage.jsx
import { useState } from "react";
import { api } from "../api/client";
import { DOC_TYPES, kindToBackendType } from "../constants/docTypes";

export default function AddPage({ onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    kind: "NPA",
    title: "",
    document_date: "",
    source_link: "",
    access_level: "",
    tags: "",
    file: null,
  });

  const setF = (key, value) =>
    setForm((s) => ({
      ...s,
      [key]: value,
    }));

  const typeCfg = DOC_TYPES[form.kind];
  const docDateField =
    typeCfg?.metadataFields?.find((f) => f.isDocDate) || null;

  async function onSubmit(e) {
    e.preventDefault();

    if (!form.file) {
      alert("Выберите файл");
      return;
    }

    // если для типа есть поле даты — требуем его
    if (docDateField && !form.document_date) {
      alert(`Укажите поле: "${docDateField.label}"`);
      return;
    }

    // Сбор метаданных с учётом числовых полей
    const metadata = {};
    if (typeCfg?.metadataFields?.length) {
      for (const field of typeCfg.metadataFields) {
        if (field.isDocDate || field.isSourceLink) continue;

        const raw = form[field.key];
        if (raw === undefined || raw === null) continue;

        let str =
          typeof raw === "string" ? raw.trim() : String(raw).trim();
        if (!str) continue; // пустое поле не отправляем

        if (field.valueType === "int") {
          const parsed = parseInt(str, 10);
          if (Number.isNaN(parsed)) {
            alert(`Поле "${field.label}" должно быть числом`);
            return;
          }
          metadata[field.key] = parsed;
        } else {
          metadata[field.key] = str;
        }
      }
    }

    // Если типа даты нет — шлём сегодняшнюю, чтобы не упал бэк
    const documentDateToSend =
      docDateField && form.document_date
        ? form.document_date
        : new Date().toISOString().slice(0, 10);

    setBusy(true);
    try {
      await api.uploadDocument({
        file: form.file,
        title: form.title || "(без названия)",
        document_date: documentDateToSend,
        document_type: kindToBackendType(form.kind),
        source_link: form.source_link || "",
        access_level: form.access_level || "",
        tags: typeof form.tags === "string" ? form.tags : "",
        metadata,
      });

      if (onUploaded) {
        await onUploaded();
      }
      window.location.hash = "/";
    } catch (err) {
      alert("Не удалось загрузить: " + (err?.message || err));
    } finally {
      setBusy(false);
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

    const commonProps = {
      className: "ec-input",
      value,
      onChange,
    };

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
    <form className="ec-add" onSubmit={onSubmit}>
      <h2 className="ec-add__title">Добавить документ</h2>

      {/* ОБЩИЕ реквизиты */}
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
          <option value="public">public</option>
          <option value="internal">internal</option>
          <option value="secret">secret</option>
        </select>
      </label>

        <label className="ec-label">
          Ключевые слова / теги (через запятую)
          <input
            className="ec-input"
            value={form.tags}
            onChange={(e) => setF("tags", e.target.value)}
            placeholder="вуз, аккредитация"
          />
        </label>
      </div>

      {/* КАТЕГОРИАЛЬНЫЕ реквизиты */}
      {typeCfg?.metadataFields?.length > 0 && (
        <div className="ec-grid-2">
          {typeCfg.metadataFields.map((field) => renderMetaField(field))}
        </div>
      )}

      <div className="ec-grid-2">
        <label className="ec-label">
          Файл
          <input
            type="file"
            className="ec-input"
            onChange={(e) => setF("file", e.target.files?.[0] || null)}
          />
        </label>
      </div>

      <div className="ec-add__actions">
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Сохраняем…" : "Сохранить"}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => (window.location.hash = "/")}
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
