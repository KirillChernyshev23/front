// src/components/PdfWorkspaceViewer.jsx
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getClosestPageElement(node) {
  let current = node;
  while (current) {
    if (current.dataset?.pageNumber) return current;
    current = current.parentElement;
  }
  return null;
}

function normalizeRects(rects, pageRect) {
  return rects
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({
      x: (r.left - pageRect.left) / pageRect.width,
      y: (r.top - pageRect.top) / pageRect.height,
      width: r.width / pageRect.width,
      height: r.height / pageRect.height,
    }))
    .filter(
      (r) =>
        Number.isFinite(r.x) &&
        Number.isFinite(r.y) &&
        Number.isFinite(r.width) &&
        Number.isFinite(r.height)
    );
}

const PdfWorkspaceViewer = forwardRef(function PdfWorkspaceViewer(
  {
    fileUrl,
    documentId,
    loading,
    error,
    onDownload,
    annotations = [],
    flashAnnotationId = null,
    onTextSelected,
  },
  ref
) {
  const scrollRef = useRef(null);
  const pageRefs = useRef({});

  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.15);
  const [viewerError, setViewerError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setNumPages(0);
    setViewerError("");
    setCurrentPage(1);
    pageRefs.current = {};
  }, [fileUrl, documentId]);

  const annotationsByPage = useMemo(() => {
    const map = new Map();
    for (const ann of annotations) {
      const page = Number(ann.page || 1);
      if (!map.has(page)) map.set(page, []);
      map.get(page).push(ann);
    }
    return map;
  }, [annotations]);

  useImperativeHandle(
    ref,
    () => ({
      scrollToAnnotation(annotation) {
        const container = scrollRef.current;
        const pageEl = pageRefs.current[annotation.page];
        if (!container || !pageEl) return;

        const firstRect = annotation.rects?.[0];
        const containerRect = container.getBoundingClientRect();
        const pageRect = pageEl.getBoundingClientRect();

        if (firstRect) {
          const targetTop =
            pageRect.top -
            containerRect.top +
            firstRect.y * pageRect.height;
          container.scrollTo({
            top: Math.max(0, container.scrollTop + targetTop - 24),
            behavior: "smooth",
          });
        } else {
          container.scrollTo({
            top: Math.max(
              0,
              container.scrollTop + (pageRect.top - containerRect.top) - 24
            ),
            behavior: "smooth",
          });
        }
      },
    }),
    [numPages]
  );

  function handleDocumentLoadSuccess({ numPages: loadedPages }) {
    setNumPages(loadedPages);
    setCurrentPage(1);
    setViewerError("");
  }

  function handleDocumentLoadError(err) {
    setViewerError(err?.message || "Не удалось открыть PDF");
  }

  function handleScroll() {
    const container = scrollRef.current;
    if (!container || !numPages) return;

    const scrollTop = container.scrollTop;
    let bestPage = 1;
    let bestDistance = Infinity;

    for (let page = 1; page <= numPages; page += 1) {
      const el = pageRefs.current[page];
      if (!el) continue;
      const distance = Math.abs(el.offsetTop - scrollTop);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPage = page;
      }
    }

    setCurrentPage(bestPage);
  }

  function handleMouseUp() {
    const selection = window.getSelection();
    const text = selection?.toString()?.trim() || "";

    if (!text) return;

    const container = scrollRef.current;
    if (!container || !selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;

    const anchorEl =
      anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
    const focusEl =
      focusNode instanceof Element ? focusNode : focusNode?.parentElement;

    if (!anchorEl || !focusEl) return;
    if (!container.contains(anchorEl) || !container.contains(focusEl)) return;

    const anchorPageEl = getClosestPageElement(anchorEl);
    const focusPageEl = getClosestPageElement(focusEl);
    if (!anchorPageEl || !focusPageEl) return;

    const anchorPage = Number(anchorPageEl.dataset.pageNumber);
    const focusPage = Number(focusPageEl.dataset.pageNumber);

    if (anchorPage !== focusPage) {
      onTextSelected?.({
        text: "",
        page: anchorPage,
        rects: [],
        warning:
          "Пока можно создавать ярлык только для выделения внутри одной страницы.",
      });
      return;
    }

    const pageRect = anchorPageEl.getBoundingClientRect();
    const rects = normalizeRects(
      Array.from(range.getClientRects()),
      pageRect
    );

    if (!rects.length) {
      onTextSelected?.({
        text: "",
        page: anchorPage,
        rects: [],
        warning: "Не удалось определить область выделения.",
      });
      return;
    }

    onTextSelected?.({ text, page: anchorPage, rects, warning: "" });
  }

  const hasDocument = !!fileUrl;

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Тулбар — одна компактная строка */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.35rem 0.6rem",
          borderBottom: "1px solid #eee",
          background: "#fafafa",
          flexShrink: 0,
          fontSize: 13,
        }}
      >
        <span>
          Стр. <b>{numPages ? currentPage : "—"}</b>
          {numPages ? ` / ${numPages}` : ""}
        </span>

        <div style={{ width: 1, height: 18, background: "#ddd" }} />

        <button
          className="btn btn-secondary"
          onClick={() =>
            setScale((s) => clamp(Number((s - 0.1).toFixed(2)), 0.6, 2.2))
          }
          disabled={!hasDocument}
          type="button"
          style={{ padding: "0.15rem 0.4rem", fontSize: 13 }}
        >
          −
        </button>

        <b>{Math.round(scale * 100)}%</b>

        <button
          className="btn btn-secondary"
          onClick={() =>
            setScale((s) => clamp(Number((s + 0.1).toFixed(2)), 0.6, 2.2))
          }
          disabled={!hasDocument}
          type="button"
          style={{ padding: "0.15rem 0.4rem", fontSize: 13 }}
        >
          +
        </button>

        <div style={{ flex: 1 }} />

        <button
          className="btn btn-secondary"
          onClick={onDownload}
          disabled={!hasDocument}
          type="button"
          style={{ fontSize: 12, padding: "0.2rem 0.5rem" }}
        >
          Скачать
        </button>
      </div>

      {/* PDF */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onMouseUp={handleMouseUp}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          background: "#f8fafc",
        }}
      >
        {loading && (
          <div style={{ padding: "2rem", textAlign: "center" }}>
            Загрузка PDF…
          </div>
        )}

        {!loading && error && (
          <div style={{ color: "crimson", padding: "1rem" }}>{error}</div>
        )}

        {!loading && !error && !fileUrl && (
          <div
            style={{ opacity: 0.8, padding: "2rem", textAlign: "center" }}
          >
            Выбери документ слева, чтобы открыть PDF.
          </div>
        )}

        {!loading && !error && fileUrl && (
          <Document
            file={fileUrl}
            onLoadSuccess={handleDocumentLoadSuccess}
            onLoadError={handleDocumentLoadError}
            loading="Подготовка PDF…"
            noData="Нет PDF для отображения"
          >
            {viewerError ? (
              <div style={{ color: "crimson", padding: "1rem" }}>
                {viewerError}
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                  alignItems: "center",
                  padding: "0.5rem",
                }}
              >
                {Array.from({ length: numPages }, (_, index) => {
                  const pageNumber = index + 1;
                  const pageAnnotations =
                    annotationsByPage.get(pageNumber) || [];

                  return (
                    <div
                      key={pageNumber}
                      style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <div
                        ref={(node) => {
                          if (node) pageRefs.current[pageNumber] = node;
                        }}
                        data-page-number={pageNumber}
                        style={{
                          position: "relative",
                          width: "fit-content",
                          background: "#fff",
                          borderRadius: 6,
                          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                        }}
                      >
                        <Page
                          pageNumber={pageNumber}
                          scale={scale}
                          renderTextLayer
                          renderAnnotationLayer
                        />

                        {pageAnnotations.map((annotation) =>
                          (annotation.rects || []).map((rect, idx) => (
                            <div
                              key={`${annotation.id}_${idx}`}
                              title={
                                annotation.comment || annotation.text
                              }
                              style={{
                                position: "absolute",
                                left: `${rect.x * 100}%`,
                                top: `${rect.y * 100}%`,
                                width: `${rect.width * 100}%`,
                                height: `${rect.height * 100}%`,
                                background:
                                  flashAnnotationId === annotation.id
                                    ? "rgba(255, 193, 7, 0.45)"
                                    : "rgba(255, 235, 59, 0.32)",
                                boxShadow:
                                  flashAnnotationId === annotation.id
                                    ? "0 0 0 2px rgba(245, 158, 11, 0.35)"
                                    : "none",
                                borderRadius: 2,
                                pointerEvents: "none",
                                zIndex: 3,
                                transition: "all 0.25s ease",
                              }}
                            />
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Document>
        )}
      </div>
    </div>
  );
});

export default PdfWorkspaceViewer;