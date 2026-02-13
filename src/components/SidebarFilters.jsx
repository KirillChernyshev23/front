// src/components/SidebarFilters.jsx
import React, { useMemo, useState, useEffect } from "react";
import { DOC_TYPES } from "../constants/docTypes";

export default function SidebarFilters({
  filters,
  onSet,
  onAddKeyword,
  onRemoveKeyword,
  onClear,
}) {
  const [kw, setKw] = useState("");

  // Выбранный тип или пусто (любой)
  const kind = filters?.kind || "";

  // Конфиг выбранного типа
  const cfg = kind ? DOC_TYPES[kind] : null;

  // Поля для фильтров под выбранный тип (date/text/textarea)
  const dynFields = useMemo(() => (cfg?.metadataFields || []), [cfg]);

  // Автоочистка полей чужого типа при смене kind (чтобы не висели старые значения)
  useEffect(() => {
    if (!kind) return;
    const allowed = new Set(dynFields.map(f => f.key));
    Object.keys(filters || {}).forEach(k => {
      if (["kind","q","keywords"].includes(k)) return;
      if (!allowed.has(k) && filters[k]) {
        onSet(k, ""); // чистим
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function addKw(e) {
    e.preventDefault();
    const v = kw.trim();
    if (v) onAddKeyword(v);
    setKw("");
  }

  return (
    <aside className="ec-sidebar">
      <div className="ec-sidebar__head">
        <h3>Фильтры</h3>
        <button className="btn btn-ghost" onClick={onClear}>Сброс</button>
      </div>

      {/* Тип документа */}
      <label className="ec-label">
        Тип документа
        <select
          className="ec-input"
          value={kind}
          onChange={(e) => onSet("kind", e.target.value)}
        >
          <option value="">— любой —</option>
          {Object.keys(DOC_TYPES).map(k => (
            <option key={k} value={k}>{DOC_TYPES[k].label}</option>
          ))}
        </select>
      </label>

      {/* Ключевые слова (фильтр) */}
      <div className="ec-label">
        Ключевые слова
        <form onSubmit={addKw} className="ec-tagform">
          <input
            className="ec-input"
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            placeholder="Тег"
          />
        </form>
        {!!(filters.keywords || []).length && (
          <div className="ec-tags">
            {(filters.keywords || []).map((t) => (
              <span key={t} className="tag" onClick={() => onRemoveKeyword(t)}>#{t} ✕</span>
            ))}
          </div>
        )}
      </div>

      {/* Динамические поля под выбранный тип */}
      {kind && dynFields.length > 0 && (
        <div className="ec-block">
          <div className="ec-subhead">Поля {DOC_TYPES[kind].label}</div>
          {dynFields.map(f => (
            <label key={f.key} className="ec-label">
              {f.label}
              {f.kind === "date" ? (
                <input
                  type="date"
                  className="ec-input"
                  value={filters[f.key] || ""}
                  onChange={(e) => onSet(f.key, e.target.value)}
                />
              ) : f.kind === "textarea" ? (
                <textarea
                  rows={3}
                  className="ec-input"
                  value={filters[f.key] || ""}
                  onChange={(e) => onSet(f.key, e.target.value)}
                  placeholder={f.placeholder || ""}
                />
              ) : (
                <input
                  className="ec-input"
                  value={filters[f.key] || ""}
                  onChange={(e) => onSet(f.key, e.target.value)}
                  placeholder={f.placeholder || ""}
                />
              )}
            </label>
          ))}
        </div>
      )}
    </aside>
  );
}
