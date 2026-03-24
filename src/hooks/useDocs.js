// src/hooks/useDocs.js
import { useEffect, useMemo, useReducer, useCallback } from "react";
import { api } from "../api/client";
import { buildMinioUrl, revokeBlob } from "../utils/docUtils";
import {
  ALL_KIND_KEYS,
  DOC_TYPES,
  backendTypeToKind,
} from "../constants/docTypes";

const initialState = {
  route: "list",
  docs: [],
  query: "",
  searchTrigger: 0,
  isSearchResult: false,
  filters: {
    kind: "",
    keywords: [],
    uploadedFrom: "",
    uploadedTo: "",
    accessLevel: "",
  },
  sort: { by: "uploadedAt", dir: "desc" },
  page: 1,
  pageSize: 20,
};

function reducer(state, action) {
  switch (action.type) {
    case "INIT":
      return { ...state, docs: action.docs };
    case "NAVIGATE":
      return { ...state, route: action.route };
    case "SET_QUERY":
      return { ...state, query: action.value };
    case "TRIGGER_SEARCH":
      return { ...state, searchTrigger: state.searchTrigger + 1, isSearchResult: !!state.query.trim(), page: 1 };
    case "SET_FILTER":
      return {
        ...state,
        filters: { ...state.filters, [action.key]: action.value },
        page: 1,
      };
    case "ADD_KEYWORD": {
      const kw = (action.value || "").trim();
      if (!kw || state.filters.keywords.includes(kw)) return state;
      return {
        ...state,
        filters: {
          ...state.filters,
          keywords: [...state.filters.keywords, kw],
        },
        page: 1,
      };
    }
    case "REMOVE_KEYWORD":
      return {
        ...state,
        filters: {
          ...state.filters,
          keywords: state.filters.keywords.filter(
            (k) => k !== action.value
          ),
        },
      };
    case "CLEAR_FILTERS":
      return { ...state, filters: initialState.filters, query: "", isSearchResult: false, page: 1, searchTrigger: state.searchTrigger + 1 };
    case "SET_SORT":
      return { ...state, sort: action.value, page: 1 };
    case "SET_PAGE":
      return { ...state, page: action.value };
    case "DELETE_DOC": {
      const doc = state.docs.find((d) => d.id === action.id);
      if (doc?.fileObjectUrl) revokeBlob(doc.fileObjectUrl);
      const docs = state.docs.filter((d) => d.id !== action.id);
      return { ...state, docs };
    }
    default:
      return state;
  }
}

/** Нормализуем ответ бэка в объект карточки фронта */
function normalizeFromApi(d) {
  // Файл может прийти в d.file, d.files[0] или d.links[0]
  const link = (d.links && d.links[0]) || null;
  const fileFromFiles =
    Array.isArray(d.files) && d.files.length ? d.files[0] : null;
  const fileMeta = d.file || fileFromFiles || link || null;

  const directUrl = fileMeta?.url || null;
  const fileUrl = directUrl || buildMinioUrl(fileMeta);

  const metadata = d.metadata || {};
  const kind = backendTypeToKind(d.document_type) || "NPA";
  const normalized = {
    id: d.id,
    apiId: d.id,
    kind,
    title: d.title,
    uploadedAt: d.created_at || new Date().toISOString(),
    fileType:
      (
        d.file?.content_type ||
        fileFromFiles?.content_type ||
        link?.content_type ||
        ""
      ).toUpperCase() || "—",

    // базовые поля
    document_date: d.document_date,
    original_id: d.original_id,
    authority:
      d.authority ||
      metadata.issuing_authority ||
      metadata.information_source ||
      metadata.university_name ||
      "",
    accessLevel: d.access_level || "",

    // теги (Tag)
    keywords: Array.isArray(d.tags) ? d.tags.map((t) => t.tag_name) : [],

    // для кнопок
    hasFile: !!fileUrl,
    source_link: d.source_link || fileUrl,

    // для удаления/скачивания
    s3: {
      bucket: fileMeta?.bucket || fileMeta?.Bucket,
      key:
        fileMeta?.s3_key ||
        fileMeta?.Key ||
        fileMeta?.key,
    },

    metadata,
    extras: metadata,
    full_text: d.full_text,
    contents: d.contents,
    summary: d.summary,

  };

  const typeCfg = DOC_TYPES[kind];
  if (typeCfg?.metadataFields?.length) {
    typeCfg.metadataFields.forEach(({ key }) => {
      if (metadata[key] !== undefined) {
        normalized[key] = metadata[key];
      }
    });
  }

  return normalized;
}

export function useDocs(authToken) {
  const [s, dispatch] = useReducer(reducer, initialState);

  // hash-роутинг
  useEffect(() => {
    const applyHash = () => {
      const raw = (window.location.hash || "").replace("#", "");
      const hash = raw.replace(/\/+$/, "") || "/";

      if (hash === "/add") {
        dispatch({ type: "NAVIGATE", route: "add" });
      } else if (hash === "/login") {
        dispatch({ type: "NAVIGATE", route: "login" });
      } else if (hash === "/admin") {
        dispatch({ type: "NAVIGATE", route: "admin" });
      } else if (hash === "/analytics") {
        dispatch({ type: "NAVIGATE", route: "analytics" });
      } else if (hash === "/workspace") {
        dispatch({ type: "NAVIGATE", route: "workspace" });
      } else if (hash === "/potential") {
        dispatch({ type: "NAVIGATE", route: "potential" });
      } else if (hash.startsWith("/potential/edit/")) {
        const parts = hash.split("/");
        const id = parts[3];
        if (id) dispatch({ type: "NAVIGATE", route: `potential_edit:${id}` });
        else dispatch({ type: "NAVIGATE", route: "potential" });
      } else if (hash.startsWith("/edit/")) {
        const parts = hash.split("/");
        const id = parts[2];
        if (id) {
          dispatch({ type: "NAVIGATE", route: `edit:${id}` });
        } else {
          dispatch({ type: "NAVIGATE", route: "list" });
        }
      } else {
        dispatch({ type: "NAVIGATE", route: "list" });
      }
    };

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  // загрузка списка (в том числе гибридный поиск)
  const reload = async ({ query } = {}) => {
    let items;

    const q = (query || "").trim();

    if (q) {
      items = await api.searchHybrid(q, 10);
    } else {
      items = await api.listDocuments({ skip: 0, limit: 500 });
    }

    const docs = (Array.isArray(items) ? items : []).map(normalizeFromApi);
    dispatch({ type: "INIT", docs });
  };

  // Начальная загрузка при логине / монтировании
  useEffect(() => {
    reload().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  // Поиск по явному триггеру (кнопка / Enter)
  useEffect(() => {
    if (s.searchTrigger === 0) return; // пропускаем начальное значение
    reload({ query: s.query }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.searchTrigger]);

  /** Вызвать поиск вручную (для кнопки / Enter) */
  const doSearch = useCallback(() => {
    dispatch({ type: "TRIGGER_SEARCH" });
  }, []);

  const vm = useMemo(() => {
    let list = s.docs.slice();

    const hasSearchQuery = s.isSearchResult;

    // Фронтовые фильтры применяем только при обычном просмотре без поиска.
    // При поиске бэкенд сам отбирает и ранжирует результаты.
    if (!hasSearchQuery) {
      const f = s.filters;

      if (f.kind) list = list.filter((d) => d.kind === f.kind);

      if (f.keywords.length) {
        const kw = f.keywords.map((x) => x.toLowerCase());
        list = list.filter((d) => {
          const dk = (d.keywords || []).map((x) => x.toLowerCase());
          return kw.every((k) => dk.includes(k));
        });
      }

      if (f.uploadedFrom)
        list = list.filter(
          (d) => new Date(d.uploadedAt) >= new Date(f.uploadedFrom)
        );
      if (f.uploadedTo)
        list = list.filter(
          (d) => new Date(d.uploadedAt) <= new Date(f.uploadedTo)
        );
      if (f.accessLevel)
        list = list.filter((d) => d.accessLevel === f.accessLevel);

      if (f.kind) {
        const metadataFields = DOC_TYPES[f.kind]?.metadataFields || [];
        metadataFields.forEach(({ key, kind: fieldKind }) => {
          if (fieldKind === "date") {
            // Интервал дат: key_from и key_to
            const fromVal = (f[`${key}_from`] || "").trim();
            const toVal = (f[`${key}_to`] || "").trim();
            if (!fromVal && !toVal) return;

            list = list.filter((d) => {
              const raw = d[key] !== undefined ? d[key] : d.metadata?.[key];
              if (!raw) return false;
              const docDate = new Date(raw);
              if (Number.isNaN(docDate.getTime())) return false;

              if (fromVal && docDate < new Date(fromVal)) return false;
              // toVal включительно — до конца дня
              if (toVal && docDate > new Date(toVal + "T23:59:59")) return false;
              return true;
            });
          } else {
            const value = (f[key] || "").trim();
            if (!value) return;
            const needle = value.toLowerCase();
            list = list.filter((d) => {
              const hay =
                (d[key] !== undefined
                  ? String(d[key])
                  : d.metadata?.[key] || "")?.toLowerCase() || "";
              return hay.includes(needle);
            });
          }
        });
      }

      const { by, dir } = s.sort;
      list.sort((a, b) => {
        const av = a[by],
          bv = b[by];
        const cmp =
          by === "uploadedAt" || by === "document_date"
            ? new Date(av || 0).getTime() -
              new Date(bv || 0).getTime()
            : String(av || "").localeCompare(
                String(bv || ""),
                "ru",
                { sensitivity: "base" }
              );
        return dir === "asc" ? cmp : -cmp;
      });
    }

    const total = list.length;
    const start = (s.page - 1) * s.pageSize;
    const end = start + s.pageSize;
    const pageItems = list.slice(start, end);

    return {
      ...s,
      pageItems,
      total,
      options: { kinds: ALL_KIND_KEYS, accessLevels: [] },
      reload,
    };
  }, [s]);

  return { state: vm, dispatch, reload, doSearch };
}