const BASE = "/api";

function authHeaders(token) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function handle(res) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────────
export async function apiRegister({ name, email, password, role }) {
  return handle(await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, role }),
  }));
}

export async function apiLogin({ email, password }) {
  const form = new URLSearchParams({ username: email, password });
  return handle(await fetch(`${BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  }));
}

export async function apiMe(token) {
  return handle(await fetch(`${BASE}/auth/me`, { headers: authHeaders(token) }));
}

// ── Books ─────────────────────────────────────────────────────────────────────
export async function apiUploadFiles(token, files, summaryFormat, summaryRole) {
  const fd = new FormData();
  files.forEach(f => fd.append("files", f));
  fd.append("summary_format", summaryFormat);
  fd.append("summary_role", summaryRole);
  return handle(await fetch(`${BASE}/books/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  }));
}

export async function apiUploadText(token, text, title, summaryFormat, summaryRole) {
  const fd = new FormData();
  fd.append("text", text);
  fd.append("title", title || "Pasted Text");
  fd.append("summary_format", summaryFormat);
  fd.append("summary_role", summaryRole);
  return handle(await fetch(`${BASE}/books/text`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  }));
}

export async function apiUploadYouTube(token, url, summaryFormat, summaryRole) {
  return handle(await fetch(`${BASE}/books/youtube`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ url, summary_format: summaryFormat, summary_role: summaryRole }),
  }));
}

export async function apiJobStatus(token, jobId) {
  return handle(await fetch(`${BASE}/books/status/${jobId}`, { headers: authHeaders(token) }));
}

export async function apiGetSummary(token, bookId) {
  return handle(await fetch(`${BASE}/books/summary/${bookId}`, { headers: authHeaders(token) }));
}

export async function apiListBooks(token) {
  return handle(await fetch(`${BASE}/books/`, { headers: authHeaders(token) }));
}

export async function apiDeleteBook(token, bookId) {
  return handle(await fetch(`${BASE}/books/${bookId}`, {
    method: "DELETE",
    headers: authHeaders(token),
  }));
}

export async function apiGetMindmap(token, bookId) {
  return handle(await fetch(`${BASE}/books/mindmap/${bookId}`, { headers: authHeaders(token) }));
}

export function apiExportUrl(bookId, format) {
  return `${BASE}/books/export/${bookId}?format=${format}`;
}

// ── Feedback ─────────────────────────────────────────────────────────────────
export async function apiSubmitFeedback(token, summaryId, rating, comment) {
  return handle(await fetch(`${BASE}/feedback/`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ summary_id: summaryId, rating, comment }),
  }));
}

// ── Quizzes ───────────────────────────────────────────────────────────────────
export async function apiGenerateQuiz(token, bookId, numQuestions = 10) {
  return handle(await fetch(`${BASE}/quizzes/books/${bookId}/generate`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ num_questions: numQuestions }),
  }));
}

export async function apiGetQuiz(token, quizId) {
  return handle(await fetch(`${BASE}/quizzes/${quizId}`, { headers: authHeaders(token) }));
}

export async function apiSubmitAnswer(token, questionId, userAnswer) {
  return handle(await fetch(`${BASE}/quizzes/question/${questionId}/attempt`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ user_answer: userAnswer }),
  }));
}

// ── Admin ─────────────────────────────────────────────────────────────────────
export async function apiAdminStats(token) {
  return handle(await fetch(`${BASE}/admin/stats`, { headers: authHeaders(token) }));
}

export async function apiAdminUsers(token) {
  return handle(await fetch(`${BASE}/admin/users`, { headers: authHeaders(token) }));
}

export async function apiAdminDeleteUser(token, userId) {
  return handle(await fetch(`${BASE}/admin/users/${userId}`, {
    method: "DELETE", headers: authHeaders(token),
  }));
}

export async function apiAdminUpdateRole(token, userId, role) {
  return handle(await fetch(`${BASE}/admin/users/${userId}/role`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ role }),
  }));
}

export async function apiAdminBooks(token) {
  return handle(await fetch(`${BASE}/admin/books`, { headers: authHeaders(token) }));
}

export async function apiAdminJobs(token) {
  return handle(await fetch(`${BASE}/admin/jobs`, { headers: authHeaders(token) }));
}

export async function apiGetBookText(token, bookId) {
  return handle(await fetch(`${BASE}/books/${bookId}/text`, { headers: authHeaders(token) }));
}

// ── Ask AI (document Q&A) ─────────────────────────────────────────────────────
export async function apiAskDocument(token, bookId, question) {
  return handle(await fetch(`${BASE}/books/${bookId}/ask`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ question }),
  }));
}

// ── Explain passage ───────────────────────────────────────────────────────────
export async function apiExplainText(token, bookId, text, mode) {
  return handle(await fetch(`${BASE}/books/${bookId}/explain`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ text, mode }),
  }));
}

// ── Key Insights ──────────────────────────────────────────────────────────────
export async function apiGetInsights(token, bookId) {
  return handle(await fetch(`${BASE}/books/${bookId}/insights`, {
    headers: authHeaders(token),
  }));
}

// ── Knowledge Graph ───────────────────────────────────────────────────────────
export async function apiGetKnowledgeGraph(token, bookId) {
  return handle(await fetch(`${BASE}/books/${bookId}/knowledge-graph`, {
    headers: authHeaders(token),
  }));
}
