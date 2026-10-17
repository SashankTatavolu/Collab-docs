const TOKEN_KEY = 'collabdocs.token';

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (t) => (t ? sessionStorage.setItem(TOKEN_KEY, t) : sessionStorage.removeItem(TOKEN_KEY));

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, url, { body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  return data;
}

/** Downloads a document as Markdown (auth header required, so we fetch + blob rather than use a plain link). */
async function downloadMarkdown(id, title) {
  const token = getToken();
  let res;
  try {
    res = await fetch(`/api/docs/${id}/export?format=md`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Check your connection.');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error || `Export failed (${res.status})`);
  }
  const blob = await res.blob();
  const name = (String(title).replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 100) || 'document') + '.md';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const api = {
  downloadMarkdown,
  demoUsers: () => request('GET', '/api/demo-users'),
  login: (email) => request('POST', '/api/login', { body: { email } }),
  logout: () => request('POST', '/api/logout'),
  me: () => request('GET', '/api/me'),
  listDocs: () => request('GET', '/api/docs'),
  createDoc: (title) => request('POST', '/api/docs', { body: title ? { title } : {} }),
  getDoc: (id) => request('GET', `/api/docs/${id}`),
  updateDoc: (id, patch) => request('PUT', `/api/docs/${id}`, { body: patch }),
  deleteDoc: (id) => request('DELETE', `/api/docs/${id}`),
  listShares: (id) => request('GET', `/api/docs/${id}/shares`),
  share: (id, email, role) => request('POST', `/api/docs/${id}/shares`, { body: { email, role } }),
  unshare: (id, userId) => request('DELETE', `/api/docs/${id}/shares/${userId}`),
  users: () => request('GET', '/api/users'),
  importFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', '/api/import', { form });
  },
  importInfo: () => request('GET', '/api/import/supported'),
};
