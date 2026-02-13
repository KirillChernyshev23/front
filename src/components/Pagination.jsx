import React from "react";

export default function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="ec-pages">
      {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
        <button key={n} onClick={() => onPage(n)} className={`pg ${n === page ? "is-active" : ""}`}>
          {n}
        </button>
      ))}
    </div>
  );
}
