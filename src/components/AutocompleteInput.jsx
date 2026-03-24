// src/components/AutocompleteInput.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * Input с автодополнением.
 *
 * Props:
 *  - value / onChange  — как обычный controlled input
 *  - suggestions       — полный массив строк-подсказок
 *  - multi             — если true, работает в режиме «теги через запятую»:
 *                        автодополняет только текущий сегмент после последней запятой
 *  - placeholder, className, disabled
 *  - maxShown          — макс. подсказок (по умолчанию 8)
 */
export default function AutocompleteInput({
  value = "",
  onChange,
  suggestions = [],
  multi = false,
  placeholder = "",
  className = "",
  disabled = false,
  maxShown = 8,
}) {
  const [open, setOpen] = useState(false);
  const [hlIdx, setHlIdx] = useState(-1);
  const wrapRef = useRef(null);
  const listRef = useRef(null);

  // --- helpers для multi-режима ---
  const currentSegment = multi
    ? (value.split(",").pop() || "").trim().toLowerCase()
    : value.trim().toLowerCase();

  const enteredSet = multi
    ? new Set(
        value
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      )
    : new Set();

  // --- фильтрация ---
  const filtered =
    currentSegment.length >= 1
      ? suggestions
          .filter((s) => {
            const low = s.toLowerCase();
            if (!low.includes(currentSegment)) return false;
            if (multi) return !enteredSet.has(low);
            return low !== currentSegment;
          })
          .slice(0, maxShown)
      : [];

  const showDrop = open && filtered.length > 0;

  // закрытие при клике снаружи
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => setHlIdx(-1), [currentSegment]);

  useEffect(() => {
    if (hlIdx >= 0 && listRef.current) {
      const el = listRef.current.children[hlIdx];
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [hlIdx]);

  function selectItem(item) {
    if (multi) {
      const parts = value.split(",");
      parts[parts.length - 1] = ` ${item}`;
      onChange(parts.join(",").replace(/^[\s,]+/, "") + ", ");
    } else {
      onChange(item);
    }
    setOpen(false);
  }

  function handleKeyDown(e) {
    if (!showDrop) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHlIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHlIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && hlIdx >= 0) {
      e.preventDefault();
      selectItem(filtered[hlIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="text"
        className={className}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />

      {showDrop && (
        <ul
          ref={listRef}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 50,
            margin: 0,
            padding: 0,
            listStyle: "none",
            background: "#fff",
            border: "1px solid #ddd",
            borderTop: "none",
            borderRadius: "0 0 8px 8px",
            maxHeight: 200,
            overflowY: "auto",
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          {filtered.map((item, idx) => (
            <li
              key={item}
              onMouseDown={(e) => {
                e.preventDefault();
                selectItem(item);
              }}
              onMouseEnter={() => setHlIdx(idx)}
              style={{
                padding: "0.45rem 0.7rem",
                cursor: "pointer",
                fontSize: 14,
                background: idx === hlIdx ? "#f0f4ff" : "transparent",
              }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}