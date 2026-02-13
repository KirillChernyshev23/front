// src/pages/PotentialEditPage.jsx
import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import EditPage from "./EditPage";

export default function PotentialEditPage({ documentId }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busyApprove, setBusyApprove] = useState(false);
  const [error, setError] = useState("");

  async function loadOne() {
    setLoading(true);
    setError("");
    try {
      const list = await api.getUnprocessedDocuments({ skip: 0, limit: 200 });
      const found = Array.isArray(list)
        ? list.find((d) => String(d.id) === String(documentId))
        : null;

      if (!found) {
        setDoc(null);
        setError("Документ не найден в очереди (возможно, уже подтверждён или удалён).");
      } else {
        setDoc(found);
      }
    } catch (e) {
      setError(e?.message || "Не удалось загрузить документ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOne();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  async function approveOnly() {
    setBusyApprove(true);
    try {
      await api.markDocumentProcessed(documentId);
      alert("Документ опубликован (подтверждён человеком).");
      window.location.hash = "/potential";
    } catch (e) {
      alert(e?.message || "Не удалось подтвердить документ");
    } finally {
      setBusyApprove(false);
    }
  }

  async function deleteDoc() {
    await api.deleteDocument(documentId);
    alert("Документ удалён.");
  }

  return (
    <div className="ec-page">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => (window.location.hash = "/potential")}
        >
          ← Назад к очереди
        </button>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={approveOnly}
          disabled={!doc || busyApprove}
        >
          {busyApprove ? "Публикуем…" : "Опубликовать без правок"}
        </button>

        <button
          type="button"
          className="btn btn-ghost"
          onClick={loadOne}
          disabled={loading}
        >
          {loading ? "Обновляем…" : "Обновить данные"}
        </button>
      </div>

      {error && (
        <div className="ec-alert ec-alert--error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      {loading && !doc && <p style={{ marginTop: 12 }}>Загружаем документ…</p>}

      {doc && (
        <EditPage
          documentId={documentId}
          initialDoc={doc}
          onUpdated={loadOne}
          afterSaveHash="/potential"
          afterCancelHash="/potential"
          saveButtonLabel="Сохранить и опубликовать"
          afterSave={async () => {
            // ✅ публикация после сохранения
            await api.markDocumentProcessed(documentId);
            alert("Изменения сохранены и документ опубликован.");
          }}
          onDelete={deleteDoc}
          deleteButtonLabel="Удалить из очереди"
        />
      )}
    </div>
  );
}
