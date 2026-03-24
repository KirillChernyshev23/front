// src/components/SidebarFilters.jsx
import React, { useMemo, useState, useEffect } from "react";
import { DOC_TYPES } from "../constants/docTypes";
import { api } from "../api/client";
import AutocompleteInput from "./AutocompleteInput";

export default function SidebarFilters({
  filters,
  onSet,
  onAddKeyword,
  onRemoveKeyword,
  onClear,
}) {
  const [kw, setKw] = useState("");
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [showTypeFields, setShowTypeFields] = useState(true);

  useEffect(() => {
    api
      .listTags()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setTagSuggestions(list);
      })
      .catch(() => {});
  }, []);

  const kind = filters?.kind || "";
  const cfg = kind ? DOC_TYPES[kind] : null;
  const dynFields = useMemo(() => cfg?.metadataFields || [], [cfg]);

  useEffect(() => {
    if (!kind) return;
    const allowed = new Set();
    dynFields.forEach((f) => {
      allowed.add(f.key);
      if (f.kind === "date") {
        allowed.add(`${f.key}_from`);
        allowed.add(`${f.key}_to`);
      }
    });
    Object.keys(filters || {}).forEach((k) => {
      if (["kind", "q", "keywords"].includes(k)) return;
      if (!allowed.has(k) && filters[k]) {
        onSet(k, "");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const enteredKeywords = useMemo(
    () => new Set((filters.keywords || []).map((k) => k.toLowerCase())),
    [filters.keywords]
  );

  const filteredSuggestions = useMemo(
    () => tagSuggestions.filter((s) => !enteredKeywords.has(s.toLowerCase())),
    [tagSuggestions, enteredKeywords]
  );

  function addKw(e) {
    e.preventDefault();
    const v = kw.trim();
    if (v) onAddKeyword(v);
    setKw("");
  }

  const hasActiveFilters =
    !!kind ||
    !!(filters.keywords || []).length ||
    !!filters.uploadedFrom ||
    !!filters.uploadedTo ||
    !!filters.accessLevel;

  return (
    <aside className="ec-sidebar">
      <div className="ec-sidebar__head">
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Фильтры</h3>
        {hasActiveFilters && (
          <button
            className="btn btn-ghost"
            onClick={onClear}
            style={{ fontSize: 12, padding: "4px 10px" }}
          >
            Сбросить
          </button>
        )}
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
          {Object.keys(DOC_TYPES).map((k) => (
            <option key={k} value={k}>
              {DOC_TYPES[k].label}
            </option>
          ))}
        </select>
      </label>

      {/* Ключевые слова с автодополнением */}
      <div className="ec-label">
        Ключевые слова
        <form
          onSubmit={addKw}
          style={{ display: "flex", gap: 6, marginTop: 6 }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <AutocompleteInput
              className="ec-input"
              value={kw}
              onChange={(val) => setKw(val)}
              suggestions={filteredSuggestions}
              placeholder="Введите тег…"
              maxShown={6}
            />
          </div>
          <button
            type="submit"
            className="btn btn-secondary"
            style={{ padding: "8px 12px", fontSize: 13, flexShrink: 0 }}
          >
            +
          </button>
        </form>

        {!!(filters.keywords || []).length && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginTop: 8,
            }}
          >
            {(filters.keywords || []).map((t) => (
              <span
                key={t}
                className="chip"
                style={{ cursor: "pointer" }}
                onClick={() => onRemoveKeyword(t)}
                title="Нажмите, чтобы удалить"
              >
                #{t}
                <span className="chip__x">✕</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Динамические поля под выбранный тип */}
      {kind && dynFields.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setShowTypeFields((v) => !v)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              fontWeight: 700,
              color: "#374151",
              width: "100%",
            }}
          >
            <span
              style={{
                display: "inline-block",
                transition: "transform 0.2s",
                transform: showTypeFields ? "rotate(90deg)" : "rotate(0deg)",
              }}
            >
              ▸
            </span>
            Поля «{DOC_TYPES[kind].label}»
          </button>

          {showTypeFields && (
            <div style={{ marginTop: 6 }}>
              {dynFields.map((f) => {
                // Дата — рендерим как интервал (от — до)
                if (f.kind === "date") {
                  const fromKey = `${f.key}_from`;
                  const toKey = `${f.key}_to`;

                  return (
                    <div key={f.key} style={{ marginTop: 10 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "#6b7280",
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          marginBottom: 6,
                        }}
                      >
                        {f.label}
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 6,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#9ca3af",
                              marginBottom: 3,
                            }}
                          >
                            от
                          </div>
                          <input
                            type="date"
                            className="ec-input"
                            value={filters[fromKey] || ""}
                            onChange={(e) => onSet(fromKey, e.target.value)}
                            style={{ width: "100%" }}
                          />
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              color: "#9ca3af",
                              marginBottom: 3,
                            }}
                          >
                            до
                          </div>
                          <input
                            type="date"
                            className="ec-input"
                            value={filters[toKey] || ""}
                            onChange={(e) => onSet(toKey, e.target.value)}
                            style={{ width: "100%" }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }

                // Остальные поля — как было
                return (
                  <label key={f.key} className="ec-label">
                    {f.label}
                    {f.kind === "textarea" ? (
                      <textarea
                        rows={2}
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
                );
              })}
            </div>
          )}
        </div>
      )}
    </aside>
  );
}