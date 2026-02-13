// src/utils/docUtils.js
export const MINIO_BASE =
  process.env.REACT_APP_MINIO_URL || "http://localhost:9000";

/** Построить прямую ссылку на файл MinIO из метаданных */
export function buildMinioUrl(file) {
  if (!file) return "";
  const bucket = file.bucket || file.Bucket;
  const key = file.s3_key || file.Key;
  if (!bucket || !key) return "";
  return `${MINIO_BASE}/${bucket}/${encodeURIComponent(key)}`;
}

/** Переписать ссылки вида http://minio:9000/... на публичный MINIO_BASE */
export function normalizeMinioUrl(url) {
  if (!url) return "";

  const internalBase = "http://minio:9000";
  if (url.startsWith(internalBase)) {
    return MINIO_BASE + url.slice(internalBase.length);
  }
  return url;
}

/** Удалить blob: URL, если использовался */
export function revokeBlob(url) {
  if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
}
