// src/constants/docTypes.js

export const DOC_TYPES = {
  NPA: {
    label: "НПА",
    backendType: "НПА",
    dateLabel: "Дата принятия НПА",
    metadataFields: [
      {
        key: "document_date",
        label: "Дата принятия НПА",
        kind: "date",
        isDocDate: true,
      },
      { key: "npa_type", label: "Вид НПА", kind: "text" },
      { key: "npa_number", label: "Номер НПА", kind: "text" },
      {
        key: "issuing_authority",
        label: "Орган власти, принявший документ",
        kind: "text",
      },
      { key: "status", label: "Статус НПА", kind: "text" },
      {
        key: "source_link",
        label: "Ссылка на интернет-источник",
        kind: "text",
        isSourceLink: true,
      },
    ],
  },

  NEWS: {
    label: "Новости",
    backendType: "Новости",
    dateLabel: "Дата публикации",
    metadataFields: [
      {
        key: "document_date",
        label: "Дата публикации",
        kind: "date",
        isDocDate: true,
      },
      {
        key: "information_source",
        label: "Информационный ресурс",
        kind: "text",
      },
      {
        key: "person_mentions",
        label: "Упоминаемые личности",
        kind: "textarea",
      },
      {
        key: "event_mentions",
        label: "Упоминаемые мероприятия",
        kind: "textarea",
      },
      {
        key: "source_link",
        label: "Ссылка на интернет-источник",
        kind: "text",
        isSourceLink: true,
      },
    ],
  },

  JOURNAL: {
    label: "Научные публикации в журналах",
    backendType: "Научные публикации в журналах",
    dateLabel: "Дата публикации",
    metadataFields: [
      {
        key: "document_date",
        label: "Дата публикации",
        kind: "date",
        isDocDate: true,
      },
      { key: "author", label: "Автор публикации", kind: "text" },
      { key: "affiliation", label: "Аффилиация автора", kind: "text" },
      {
        key: "journal_name",
        label: "Наименование журнала",
        kind: "text",
      },
      {
        key: "publication_year",
        label: "Год публикации",
        kind: "number",
        valueType: "int",
      },
      { key: "issue_number", label: "Номер выпуска", kind: "text" },
      { key: "abstract", label: "Аннотация", kind: "textarea" },
      { key: "doi", label: "DOI", kind: "text" },
      {
        key: "source_link",
        label: "Ссылка на интернет-источник",
        kind: "text",
        isSourceLink: true,
      },
    ],
  },

  ANALYTICS: {
    label: "Аналитические материалы",
    backendType: "Аналитические материалы",
    dateLabel: "Дата публикации",
    metadataFields: [
      {
        key: "document_date",
        label: "Дата публикации",
        kind: "date",
        isDocDate: true,
      },
      { key: "author", label: "Автор", kind: "text" },
      {
        key: "organization",
        label: "Организация, выпустившая материал",
        kind: "text",
      },
      {
        key: "source_link",
        label: "Ссылка на интернет-источник",
        kind: "text",
        isSourceLink: true,
      },
    ],
  },

  BOOK: {
    label: "Книги и сборники статей",
    backendType: "Книги и сборники статей",
    // отдельной даты документа нет
    dateLabel: null,
    metadataFields: [
      { key: "authors", label: "Автор(ы)", kind: "text" },
      {
        key: "title",
        label: "Наименование издательства",
        kind: "text",
      },
      {
        key: "publication_year",
        label: "Год публикации",
        kind: "number",
        valueType: "int",
      },
      { key: "isbn", label: "ISBN", kind: "text" },
      { key: "abstract", label: "Аннотация", kind: "textarea" },
      {
        key: "source_link",
        label: "Ссылка на интернет-источник",
        kind: "text",
        isSourceLink: true,
      },
    ],
  },

  CKA: {
    label: "Материалы Центра креативной аналитики",
    backendType: "Материалы центра креативной аналитики",
    dateLabel: "Дата подготовки",
    metadataFields: [
      {
        key: "document_date",
        label: "Дата подготовки",
        kind: "date",
        isDocDate: true,
      },
      {
        key: "event_name",
        label: "Мероприятие, для которого был подготовлен материал",
        kind: "text",
      },
    ],
  },

  PRU: {
    label: "Программы развития вузов",
    backendType: "Программы развития вузов",
    dateLabel: "Дата принятия ПР",
    metadataFields: [
      {
        key: "document_date",
        label: "Дата принятия ПР",
        kind: "date",
        isDocDate: true,
      },
      { key: "university_name", label: "Вуз", kind: "text" },
      {
        key: "project_name",
        label: "Проект, в рамках которого подготовлена ПР",
        kind: "text",
      },
    ],
  },

  BEST: {
    label: "Лучшие практики вузов",
    backendType: "Лучшие практики вузов",
    dateLabel: null,
    metadataFields: [
      {
        key: "university_name",
        label: "Вуз, реализовавший практику",
        kind: "text",
      },
      {
        key: "practice_name",
        label: "Название практики",
        kind: "text",
      },
      {
        key: "practice_description",
        label: "Описание практики",
        kind: "textarea",
      },
    ],
  },
};

export const ALL_KIND_KEYS = Object.keys(DOC_TYPES);

const BACKEND_TO_KIND = Object.fromEntries(
  Object.entries(DOC_TYPES).map(([key, cfg]) => [
    cfg.backendType || cfg.label || key,
    key,
  ])
);

export function backendTypeToKind(documentType) {
  return BACKEND_TO_KIND[documentType] || documentType || "NPA";
}

export function kindToBackendType(kind) {
  return DOC_TYPES[kind]?.backendType || DOC_TYPES[kind]?.label || kind;
}

export function fieldLabel(kind, key) {
  const cfg = DOC_TYPES[kind];
  const f = cfg?.metadataFields?.find((x) => x.key === key);
  return f ? f.label : key;
}
