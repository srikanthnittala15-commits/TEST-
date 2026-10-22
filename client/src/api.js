const KEY = 'ct_token';
export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

async function request(path, { method = 'GET', body, form } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  if (res.status === 401 && getToken()) { setToken(null); location.reload(); }
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res;
}
const json = async (path, opts) => (await request(path, opts)).json();

export const api = {
  login: (b) => json('/auth/login', { method: 'POST', body: b }),
  register: (b) => json('/auth/register', { method: 'POST', body: b }),
  me: () => json('/me'),
  dashboard: () => json('/dashboard'),
  reminders: (days) => json(`/reminders?days=${days}`),
  users: () => json('/users'),
  addUser: (b) => json('/users', { method: 'POST', body: b }),
  delUser: (id) => json(`/users/${id}`, { method: 'DELETE' }),
  clients: () => json('/clients'),
  saveClient: (c) => json(c.id ? `/clients/${c.id}` : '/clients', { method: c.id ? 'PUT' : 'POST', body: c }),
  delClient: (id) => json(`/clients/${id}`, { method: 'DELETE' }),
  catalog: () => json('/catalog'),
  generate: (id, b) => json(`/clients/${id}/generate`, { method: 'POST', body: b }),
  tasks: (q) => json('/tasks?' + new URLSearchParams(Object.entries(q).filter(([, v]) => v))),
  saveTask: (t) => json(t.id ? `/tasks/${t.id}` : '/tasks', { method: t.id ? 'PUT' : 'POST', body: t }),
  delTask: (id) => json(`/tasks/${id}`, { method: 'DELETE' }),
  docs: (id) => json(`/tasks/${id}/documents`),
  upload: (id, files) => { const f = new FormData(); [...files].forEach((x) => f.append('files', x)); return json(`/tasks/${id}/documents`, { method: 'POST', form: f }); },
  delDoc: (id) => json(`/documents/${id}`, { method: 'DELETE' }),
  download: async (path, name) => {
    const blob = await (await request(path)).blob();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
    a.click(); URL.revokeObjectURL(a.href);
  },
};
