import React, { useEffect, useMemo, useRef, useState } from "react";

function getCurrentToken(full) {
  const parts = String(full || "").split(",");
  return (parts[parts.length - 1] || "").trim();
}

// prefix = всё до последнего токена (включая ", " если есть)
function splitPrefix(full) {
  const m = String(full || "").match(/^(.*?,\s*)?([^,]*)$/);
  return { prefix: m?.[1] || "", token: m?.[2] || "" };
}

export default function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "",
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);

  const currentToken = useMemo(() => getCurrentToken(value), [value]);

  const usedLower = useMemo(() => {
    return new Set(
      String(value || "")
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    );
  }, [value]);

  const filtered = useMemo(() => {
    const q = currentToken.toLowerCase();
    if (!q) return [];

    const uniq = new Map(); // lower -> original
    for (const t of suggestions || []) {
      if (!t) continue;
      const k = String(t).trim();
      if (!k) continue;
      const lk = k.toLowerCase();
      if (!uniq.has(lk)) uniq.set(lk, k);
    }

    const res = Array.from(uniq.values())
      .filter((t) => t.toLowerCase().includes(q))
      .filter((t) => !usedLower.has(t.toLowerCase()))
      .slice(0, 8);

    return res;
  }, [suggestions, currentToken, usedLower]);

  useEffect(() => {
    if (open && active >= filtered.length) setActive(0);
  }, [open, active, filtered.length]);

  // закрывать подсказки при клике вне
  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const apply = (tag) => {
    const { prefix } = splitPrefix(value);
    const next = `${prefix}${tag}`;
    onChange(next);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      // если подсказки открыты — Enter выбирает
      e.preventDefault();
      apply(filtered[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="ec-tags" ref={rootRef}>
      <input
        className="ec-input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />

      {open && filtered.length > 0 && (
        <div className="ec-tags__list">
          {filtered.map((t, idx) => (
            <button
              type="button"
              key={t}
              className={
                "ec-tags__item" + (idx === active ? " ec-tags__item--active" : "")
              }
              onMouseEnter={() => setActive(idx)}
              onMouseDown={(e) => e.preventDefault()} // чтобы не терялся фокус
              onClick={() => apply(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
