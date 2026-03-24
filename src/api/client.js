// src/api/client.js
const API_BASE =
  process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

class ApiClient {
  constructor(base = API_BASE) {
    this.base = base;
    this.token = localStorage.getItem("ec_jwt_token") || "";
  }

  setToken(token) {
    this.token = token || "";
    if (token) localStorage.setItem("ec_jwt_token", token);
    else localStorage.removeItem("ec_jwt_token");
  }

  _headers(extra = {}, isForm = false) {
    const h = isForm ? {} : { "Content-Type": "application/json" };
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return { ...h, ...extra };
  }

  async _fetch(path, opts = {}) {
    const isForm = opts.body instanceof FormData;

    const url =
      path.startsWith("http")
        ? path
        : `${this.base}${path.startsWith("/") ? "" : "/"}${path}`;

    const res = await fetch(url, {
      ...opts,
      headers: { ...this._headers(opts.headers, isForm) },
    });

    // если токен протух — на страницу логина
    if (res.status === 401) {
      this.setToken("");
      if (window.location.hash !== "#/login") {
        window.location.hash = "/login";
      }
      throw new Error("Unauthorized");
    }

    if (res.status === 204) return null;

    const ct = res.headers.get("content-type") || "";
    const data = ct.includes("application/json")
      ? await res.json()
      : await res.text();

    if (!res.ok) {
      const msg = typeof data === "string" ? data : JSON.stringify(data);
      throw new Error(`HTTP ${res.status}: ${msg}`);
    }
    return data;
  }


  async addSourceSite(payload) {
    // payload: { url: string, name: string }
    return this._fetch("/collector/sites", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async listSourceSites() {
    return this._fetch("/collector/sites", { method: "GET" });
  }

  // ------ AUTH ------
  async login(username, password) {
    const body = new URLSearchParams({
      username,
      password,
      grant_type: "password",
    });

    const data = await this._fetch(`/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    this.setToken(data.access_token);
    return data;
  }

  // ------ DOCUMENTS ------
  async listDocuments(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const path = `/documents${qs ? `?${qs}` : ""}`;
    return this._fetch(path, { method: "GET" });
  }

  async uploadDocument(fields) {
    const fd = new FormData();

    // бэку нужен параметр files (множественное число)
    fd.append("files", fields.file);

    fd.append("title", fields.title);
    fd.append("document_date", fields.document_date); // YYYY-MM-DD

    if (fields.original_id) fd.append("original_id", fields.original_id);
    if (fields.document_type) fd.append("document_type", fields.document_type);
    if (fields.source_link) fd.append("source_link", fields.source_link);
    if (fields.access_level) fd.append("access_level", fields.access_level);
    if (fields.full_text) fd.append("full_text", fields.full_text);
    if (fields.summary) fd.append("summary", fields.summary);


    // теги — строкой через запятую
    if (Array.isArray(fields.tags)) fd.append("tags", fields.tags.join(","));
    else if (typeof fields.tags === "string") fd.append("tags", fields.tags);

    // contents / comments — просто текст (если вдруг ещё используешь)
    if (fields.contents) fd.append("contents", fields.contents);
    if (fields.comments) fd.append("comments", fields.comments);

    if (fields.metadata && Object.keys(fields.metadata).length) {
      fd.append("metadata", JSON.stringify(fields.metadata));
    }

    return this._fetch(`/documents/upload`, { method: "POST", body: fd });
  }

  async deleteDocument(id) {
    // DELETE /api/v1/documents/documents/{document_id}
    return this._fetch(`/documents/documents/${id}`, {
      method: "DELETE",
    });
  }

  async updateDocument(id, payload) {
    // PATCH /api/v1/documents/documents/{document_id}
    return this._fetch(`/documents/documents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async searchKeyword(q, limit = 20) {
    return this._fetch(
      `/documents/search/keyword?q=${encodeURIComponent(q)}&limit=${limit}`
    );
  }

  async searchSemantic(q, limit = 20) {
    return this._fetch(
      `/documents/search/semantic?q=${encodeURIComponent(q)}&limit=${limit}`
    );
  }

  // гибридный поиск (ключевые слова + семантика)
  async searchHybrid(q, limit = 20) {
    return this._fetch(
      `/documents/search/hybrid?q=${encodeURIComponent(q)}&limit=${limit}`
    );
  }

  async getFileUrl(id) {
    return this._fetch(`/documents/${id}/file-url`, { method: "GET" });
  }

  // pre-signed URLs для скачивания документа
  async getDocumentDownloadUrls(documentId) {
    return this._fetch(`/documents/documents/${documentId}/download-url`, {
      method: "GET",
    });
  }

  // ------ AUTOCOMPLETE / SUGGESTIONS ------

  /** Список уникальных тегов (GET /api/v1/documents/tags) */
  async listTags(limit = 1000) {
    return this._fetch(`/documents/tags?limit=${limit}`, { method: "GET" });
  }

  /** Уникальные значения по колонке (GET /api/v1/documents/unique-values?column=...) */
  async listUniqueValues(column, limit = 100) {
    return this._fetch(
      `/documents/unique-values?column=${encodeURIComponent(column)}&limit=${limit}`,
      { method: "GET" }
    );
  }

  // ------ WORKSPACE (проекты пользователя) ------

  // Список проектов текущего пользователя
  async listWorkspaceProjects() {
    return this._fetch(`/workspace/projects`, { method: "GET" });
  }

  // Создать проект (и опционально сразу привязать документы)
  // swagger: { name: string, description: string, document_ids: number[] }
  async createWorkspaceProject({ name, description = "", document_ids = [] }) {
    return this._fetch(`/workspace/projects`, {
      method: "POST",
      body: JSON.stringify({ name, description, document_ids }),
    });
  }

  // Удалить проект
  async deleteWorkspaceProject(projectId) {
    return this._fetch(`/workspace/projects/${projectId}`, {
      method: "DELETE",
    });
  }

  // Документы конкретного проекта
  async listWorkspaceProjectDocuments(projectId) {
    return this._fetch(`/workspace/projects/${projectId}/documents`, {
      method: "GET",
    });
  }

  // Добавить документы в уже существующий проект
  // swagger: { document_ids: number[] }
  async addDocumentsToWorkspaceProject(projectId, documentIds = []) {
    return this._fetch(`/workspace/projects/${projectId}/documents`, {
      method: "POST",
      body: JSON.stringify({ document_ids: documentIds }),
    });
  }

  // Удалить документ из проекта
  async deleteWorkspaceProjectDocument(projectId, documentId) {
    return this._fetch(`/workspace/projects/${projectId}/documents/${documentId}`, {
      method: "DELETE",
    });
  }

  // ------ ANALYTICS ------
  async getDashboard() {
    // GET /api/v1/analytics/dashboard
    return this._fetch(`/analytics/dashboard`, { method: "GET" });
  }

  async refreshDashboard() {
    // POST /api/v1/analytics/dashboard/refresh
    return this._fetch(`/analytics/dashboard/refresh`, {
      method: "POST",
    });
  }

  // ------ USERS (admin) ------
  async createUser({ username, email, password, role }) {
    return this._fetch(`/auth/users`, {
      method: "POST",
      body: JSON.stringify({ username, role, email, password }),
    });
  }

  async listUsers() {
    return this._fetch(`/auth/users`, { method: "GET" });
  }

  async deleteUser(userId) {
    return this._fetch(`/auth/users/${userId}`, {
      method: "DELETE",
    });
  }

    // ------ COLLECTOR (admin) ------
  // ------ REVIEW QUEUE (admin) ------
  async getUnprocessedDocuments({ skip = 0, limit = 100 } = {}) {
    const qs = new URLSearchParams({ skip: String(skip), limit: String(limit) }).toString();
    return this._fetch(`/documents/unprocessed?${qs}`, { method: "GET" });
  }


  async markDocumentProcessed(documentId) {
    return this._fetch(`/documents/documents/${documentId}/mark_processed`, {
      method: "POST",
    });
  }


  
}

export const api = new ApiClient();