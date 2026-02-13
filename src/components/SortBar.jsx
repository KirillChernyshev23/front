import React from "react";

export default function SortBar({ total, sort, onSort }) {
  return (
    <div className="ec-sort">
      <div className="ec-sort__left">Найдено: {total}</div>
      <div className="ec-sort__right">
        <label>Сортировка</label>
        <select
          className="ec-input"
          value={`${sort.by}:${sort.dir}`}
          onChange={(e) => {
            const [by, dir] = e.target.value.split(":");
            onSort({ by, dir });
          }}
        >
          <option value="uploadedAt:desc">Последние добавленные</option>
          <option value="title:asc">Название A→Я</option>
          <option value="title:desc">Название Я→A</option>
          <option value="document_date:desc">Дата документа ↓</option>
          <option value="document_date:asc">Дата документа ↑</option>
        </select>
      </div>
    </div>
  );
}
