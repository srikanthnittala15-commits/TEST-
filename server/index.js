import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, all, get, run, DATA_DIR, UPLOAD_DIR } from './db.js';
import { CATALOG, dueDates } from './catalog.js';

const STATUSES = ['pending', 'in_progress', 'filed', 'not_applicable'];
const PRIORITIES = ['low', 'medium', 'high'];
const KINDS = ['individual', 'business', 'company', 'it'];
const DONE = "('filed','not_applicable')";

// ---- JWT secret persisted so sessions survive restarts
const secretFile = path.join(DATA_DIR, '.jwt-secret');
const SECRET = process.env.JWT_SECRET || (fs.existsSync(secretFile)
  ? fs.readFileSync(secretFile, 'utf8')
  : (() => { const s = crypto.randomBytes(48).toString('hex'); fs.writeFileSync(secretFile, s, { mode: 0o600 }); return s; })());

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

// ---- tiny in-memory login throttle
const attempts = new Map();
function throttled(key) {
  const now = Date.now();
  const rec = (attempts.get(key) || []).filter((t) => now - t < 15 * 60 * 1000);
  attempts.set(key, rec);
  return rec.length >= 10;
}

// ---- auth
const sign = (u) => jwt.sign({ uid: u.id }, SECRET, { expiresIn: '7d' });
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  try {
    const { uid } = jwt.verify(h.startsWith('Bearer ') ? h.slice(7) : '', SECRET);
    const u = get('SELECT id, org_id, name, email, role FROM users WHERE id = ?', uid);
    if (!u) throw new Error('no user');
    req.user = u;
    next();
  } catch { bad(res, 'Unauthorized', 401); }
}
const adminOnly = (req, res, next) => (req.user.role === 'admin' ? next() : bad(res, 'Admin only', 403));

app.post('/api/auth/register', wrap(async (req, res) => {
  const orgName = str(req.body.orgName, 120), name = str(req.body.name, 120);
  const email = str(req.body.email, 200).toLowerCase(), password = req.body.password;
  if (!orgName || !name || !/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Organisation, name and a valid email are required');
  if (typeof password !== 'string' || password.length < 8) return bad(res, 'Password must be at least 8 characters');
  if (get('SELECT 1 FROM users WHERE email = ?', email)) return bad(res, 'Email already registered', 409);
  const hash = await bcrypt.hash(password, 10);
  db.exec('BEGIN');
  try {
    const org = run('INSERT INTO orgs (name) VALUES (?)', orgName);
    const u = run('INSERT INTO users (org_id, name, email, password_hash, role) VALUES (?,?,?,?,?)', org.lastInsertRowid, name, email, hash, 'admin');
    db.exec('COMMIT');
    res.json({ token: sign({ id: Number(u.lastInsertRowid) }) });
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const email = str(req.body.email, 200).toLowerCase();
  if (throttled(email)) return bad(res, 'Too many attempts. Try again later.', 429);
  const u = get('SELECT * FROM users WHERE email = ?', email);
  const ok = u && typeof req.body.password === 'string' && await bcrypt.compare(req.body.password, u.password_hash);
  if (!ok) { attempts.get(email).push(Date.now()); return bad(res, 'Invalid email or password', 401); }
  res.json({ token: sign(u) });
}));

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api', auth);

app.get('/api/me', (req, res) => {
  res.json({ ...req.user, org: get('SELECT name FROM orgs WHERE id = ?', req.user.org_id).name });
});

// ---- users (team)
app.get('/api/users', (req, res) => res.json(all('SELECT id, name, email, role FROM users WHERE org_id = ? ORDER BY name', req.user.org_id)));
app.post('/api/users', adminOnly, wrap(async (req, res) => {
  const name = str(req.body.name, 120), email = str(req.body.email, 200).toLowerCase();
  const role = req.body.role === 'admin' ? 'admin' : 'member';
  if (!name || !/^\S+@\S+\.\S+$/.test(email)) return bad(res, 'Name and valid email required');
  if (typeof req.body.password !== 'string' || req.body.password.length < 8) return bad(res, 'Password must be at least 8 characters');
  if (get('SELECT 1 FROM users WHERE email = ?', email)) return bad(res, 'Email already registered', 409);
  const r = run('INSERT INTO users (org_id, name, email, password_hash, role) VALUES (?,?,?,?,?)', req.user.org_id, name, email, await bcrypt.hash(req.body.password, 10), role);
  res.status(201).json({ id: Number(r.lastInsertRowid), name, email, role });
}));
app.delete('/api/users/:id', adminOnly, (req, res) => {
  if (Number(req.params.id) === req.user.id) return bad(res, 'You cannot remove yourself');
  run('DELETE FROM users WHERE id = ? AND org_id = ?', req.params.id, req.user.org_id);
  res.json({ ok: true });
});

// ---- clients
const clientBody = (b) => ({
  name: str(b.name, 200), kind: KINDS.includes(b.kind) ? b.kind : 'business',
  pan: str(b.pan, 10).toUpperCase(), gstin: str(b.gstin, 15).toUpperCase(), notes: str(b.notes, 2000),
});
app.get('/api/clients', (req, res) => res.json(all(`
  SELECT c.*, COUNT(t.id) AS total,
    SUM(CASE WHEN t.status NOT IN ${DONE} AND t.due_date < ? THEN 1 ELSE 0 END) AS overdue,
    SUM(CASE WHEN t.status IN ${DONE} THEN 1 ELSE 0 END) AS done
  FROM clients c LEFT JOIN tasks t ON t.client_id = c.id
  WHERE c.org_id = ? GROUP BY c.id ORDER BY c.name`, todayIST(), req.user.org_id)));
app.post('/api/clients', (req, res) => {
  const c = clientBody(req.body);
  if (!c.name) return bad(res, 'Client name required');
  if (c.pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(c.pan)) return bad(res, 'Invalid PAN format');
  if (c.gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(c.gstin)) return bad(res, 'Invalid GSTIN format');
  const r = run('INSERT INTO clients (org_id, name, kind, pan, gstin, notes) VALUES (?,?,?,?,?,?)', req.user.org_id, c.name, c.kind, c.pan, c.gstin, c.notes);
  res.status(201).json({ id: Number(r.lastInsertRowid), ...c });
});
app.put('/api/clients/:id', (req, res) => {
  const c = clientBody(req.body);
  if (!c.name) return bad(res, 'Client name required');
  const r = run('UPDATE clients SET name=?, kind=?, pan=?, gstin=?, notes=? WHERE id=? AND org_id=?', c.name, c.kind, c.pan, c.gstin, c.notes, req.params.id, req.user.org_id);
  if (!r.changes) return bad(res, 'Not found', 404);
  res.json({ ok: true });
});
app.delete('/api/clients/:id', adminOnly, (req, res) => {
  const docs = all('SELECT d.stored FROM documents d JOIN tasks t ON t.id = d.task_id WHERE t.client_id = ? AND d.org_id = ?', req.params.id, req.user.org_id);
  const r = run('DELETE FROM clients WHERE id = ? AND org_id = ?', req.params.id, req.user.org_id);
  if (r.changes) docs.forEach((d) => fs.rmSync(path.join(UPLOAD_DIR, d.stored), { force: true }));
  res.json({ ok: true });
});

// ---- catalog + generation
app.get('/api/catalog', (_req, res) => res.json(CATALOG.map(({ rule, ...c }) => c)));
app.post('/api/clients/:id/generate', (req, res) => {
  const client = get('SELECT * FROM clients WHERE id = ? AND org_id = ?', req.params.id, req.user.org_id);
  if (!client) return bad(res, 'Not found', 404);
  const fy = Number(req.body.fy);
  if (!Number.isInteger(fy) || fy < 2020 || fy > 2100) return bad(res, 'Invalid financial year');
  const keys = Array.isArray(req.body.keys) && req.body.keys.length
    ? req.body.keys : CATALOG.filter((c) => c.applies.includes(client.kind) || (client.kind === 'company' && c.applies.includes('business'))).map((c) => c.key);
  let created = 0;
  db.exec('BEGIN');
  try {
    for (const t of CATALOG.filter((c) => keys.includes(c.key))) {
      for (const { due, period } of dueDates(t.rule, fy)) {
        created += run(`INSERT OR IGNORE INTO tasks (org_id, client_id, title, category, period, due_date, template_key)
          VALUES (?,?,?,?,?,?,?)`, req.user.org_id, client.id, t.title, t.category, period, due, t.key).changes;
      }
    }
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  res.json({ created });
});

// ---- tasks
const TASK_SELECT = `SELECT t.*, c.name AS client_name, u.name AS assignee_name,
  (SELECT COUNT(*) FROM documents d WHERE d.task_id = t.id) AS doc_count,
  CASE WHEN t.status NOT IN ${DONE} AND t.due_date < ? THEN 1 ELSE 0 END AS overdue
  FROM tasks t JOIN clients c ON c.id = t.client_id LEFT JOIN users u ON u.id = t.assignee_id`;

function listTasks(orgId, q) {
  const where = ['t.org_id = ?'], p = [todayIST(), orgId];
  if (STATUSES.includes(q.status)) { where.push('t.status = ?'); p.push(q.status); }
  if (q.status === 'overdue') where.push(`t.status NOT IN ${DONE} AND t.due_date < '${todayIST()}'`);
  if (q.client) { where.push('t.client_id = ?'); p.push(Number(q.client)); }
  if (q.assignee) { where.push('t.assignee_id = ?'); p.push(Number(q.assignee)); }
  if (q.category) { where.push('t.category = ?'); p.push(String(q.category)); }
  if (isDate(q.from)) { where.push('t.due_date >= ?'); p.push(q.from); }
  if (isDate(q.to)) { where.push('t.due_date <= ?'); p.push(q.to); }
  if (q.q) { where.push('(t.title LIKE ? OR c.name LIKE ?)'); p.push(`%${q.q}%`, `%${q.q}%`); }
  return all(`${TASK_SELECT} WHERE ${where.join(' AND ')} ORDER BY t.due_date, t.id LIMIT 2000`, ...p);
}
app.get('/api/tasks', (req, res) => res.json(listTasks(req.user.org_id, req.query)));

function taskBody(b, orgId) {
  const t = {
    title: str(b.title, 300), category: str(b.category, 60) || 'Other', period: str(b.period, 60),
    due_date: b.due_date, status: STATUSES.includes(b.status) ? b.status : 'pending',
    priority: PRIORITIES.includes(b.priority) ? b.priority : 'medium', notes: str(b.notes, 4000),
    assignee_id: b.assignee_id ? Number(b.assignee_id) : null,
  };
  if (!t.title) return { error: 'Title required' };
  if (!isDate(t.due_date)) return { error: 'Valid due date (YYYY-MM-DD) required' };
  if (t.assignee_id && !get('SELECT 1 FROM users WHERE id = ? AND org_id = ?', t.assignee_id, orgId)) return { error: 'Invalid assignee' };
  return { t };
}
app.post('/api/tasks', (req, res) => {
  const { t, error } = taskBody(req.body, req.user.org_id);
  if (error) return bad(res, error);
  if (!get('SELECT 1 FROM clients WHERE id = ? AND org_id = ?', req.body.client_id, req.user.org_id)) return bad(res, 'Invalid client');
  const r = run(`INSERT INTO tasks (org_id, client_id, title, category, period, due_date, status, priority, assignee_id, notes, completed_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`, req.user.org_id, req.body.client_id, t.title, t.category, t.period, t.due_date, t.status, t.priority, t.assignee_id, t.notes,
    t.status === 'filed' ? new Date().toISOString() : null);
  res.status(201).json({ id: Number(r.lastInsertRowid) });
});
app.put('/api/tasks/:id', (req, res) => {
  const cur = get('SELECT * FROM tasks WHERE id = ? AND org_id = ?', req.params.id, req.user.org_id);
  if (!cur) return bad(res, 'Not found', 404);
  const { t, error } = taskBody({ ...cur, ...req.body }, req.user.org_id);
  if (error) return bad(res, error);
  const completed = ['filed', 'not_applicable'].includes(t.status) ? (cur.completed_at || new Date().toISOString()) : null;
  run(`UPDATE tasks SET title=?, category=?, period=?, due_date=?, status=?, priority=?, assignee_id=?, notes=?, completed_at=? WHERE id=?`,
    t.title, t.category, t.period, t.due_date, t.status, t.priority, t.assignee_id, t.notes, completed, cur.id);
  res.json({ ok: true });
});
app.delete('/api/tasks/:id', (req, res) => {
  const docs = all('SELECT stored FROM documents WHERE task_id = ? AND org_id = ?', req.params.id, req.user.org_id);
  const r = run('DELETE FROM tasks WHERE id = ? AND org_id = ?', req.params.id, req.user.org_id);
  if (r.changes) docs.forEach((d) => fs.rmSync(path.join(UPLOAD_DIR, d.stored), { force: true }));
  res.json({ ok: true });
});

// ---- documents / evidence
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, _file, cb) => cb(null, crypto.randomUUID()),
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});
app.get('/api/tasks/:id/documents', (req, res) => res.json(all(
  'SELECT id, filename, size, created_at FROM documents WHERE task_id = ? AND org_id = ? ORDER BY id', req.params.id, req.user.org_id)));
app.post('/api/tasks/:id/documents', (req, res, next) => {
  if (!get('SELECT 1 FROM tasks WHERE id = ? AND org_id = ?', req.params.id, req.user.org_id)) return bad(res, 'Not found', 404);
  upload.array('files', 5)(req, res, (err) => {
    if (err) return bad(res, err.message);
    for (const f of req.files || []) {
      run('INSERT INTO documents (org_id, task_id, filename, stored, size, mime, uploaded_by) VALUES (?,?,?,?,?,?,?)',
        req.user.org_id, req.params.id, path.basename(f.originalname).slice(0, 200), f.filename, f.size, f.mimetype, req.user.id);
    }
    res.status(201).json({ uploaded: (req.files || []).length });
  });
});
app.get('/api/documents/:id/download', (req, res) => {
  const d = get('SELECT * FROM documents WHERE id = ? AND org_id = ?', req.params.id, req.user.org_id);
  if (!d) return bad(res, 'Not found', 404);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(path.join(UPLOAD_DIR, d.stored), d.filename);
});
app.delete('/api/documents/:id', (req, res) => {
  const d = get('SELECT * FROM documents WHERE id = ? AND org_id = ?', req.params.id, req.user.org_id);
  if (d) { run('DELETE FROM documents WHERE id = ?', d.id); fs.rmSync(path.join(UPLOAD_DIR, d.stored), { force: true }); }
  res.json({ ok: true });
});

// ---- dashboard, reminders, reports
app.get('/api/dashboard', (req, res) => {
  const org = req.user.org_id, today = todayIST();
  const one = (sql, ...p) => Object.values(get(sql, ...p))[0] || 0;
  const total = one('SELECT COUNT(*) FROM tasks WHERE org_id = ? AND status != ?', org, 'not_applicable');
  const done = one("SELECT COUNT(*) FROM tasks WHERE org_id = ? AND status = 'filed'", org);
  const overdue = one(`SELECT COUNT(*) FROM tasks WHERE org_id = ? AND status NOT IN ${DONE} AND due_date < ?`, org, today);
  const next7 = one(`SELECT COUNT(*) FROM tasks WHERE org_id = ? AND status NOT IN ${DONE} AND due_date BETWEEN ? AND ?`, org, today, addDays(today, 7));
  const dueInMonth = one(`SELECT COUNT(*) FROM tasks WHERE org_id = ? AND status NOT IN ${DONE} AND due_date BETWEEN ? AND ?`, org, today, addDays(today, 30));
  res.json({
    today, total, done, overdue, next7, dueInMonth,
    score: total ? Math.round((done / total) * 100) : 100,
    byStatus: all('SELECT status, COUNT(*) AS n FROM tasks WHERE org_id = ? GROUP BY status', org),
    byCategory: all(`SELECT category, COUNT(*) AS total,
      SUM(CASE WHEN status IN ${DONE} THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN status NOT IN ${DONE} AND due_date < ? THEN 1 ELSE 0 END) AS overdue
      FROM tasks WHERE org_id = ? GROUP BY category ORDER BY category`, today, org),
    byAssignee: all(`SELECT COALESCE(u.name,'Unassigned') AS name, COUNT(*) AS open
      FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
      WHERE t.org_id = ? AND t.status NOT IN ${DONE} GROUP BY t.assignee_id ORDER BY open DESC`, org),
  });
});
app.get('/api/reminders', (req, res) => {
  const today = todayIST(), days = Math.min(Number(req.query.days) || 7, 60);
  res.json(all(`${TASK_SELECT} WHERE t.org_id = ? AND t.status NOT IN ${DONE} AND t.due_date <= ?
    ${req.query.mine ? 'AND t.assignee_id = ' + Number(req.user.id) : ''} ORDER BY t.due_date LIMIT 200`,
  today, req.user.org_id, addDays(today, days)));
});
const csvCell = (v) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formulas
  return `"${s.replace(/"/g, '""')}"`;
};
app.get('/api/reports/tasks.csv', (req, res) => {
  const rows = listTasks(req.user.org_id, req.query);
  const head = ['Client', 'Task', 'Category', 'Period', 'Due date', 'Status', 'Overdue', 'Priority', 'Assignee', 'Evidence files', 'Notes'];
  const lines = [head.map(csvCell).join(',')].concat(rows.map((r) => [
    r.client_name, r.title, r.category, r.period, r.due_date, r.status, r.overdue ? 'Yes' : 'No', r.priority, r.assignee_name, r.doc_count, r.notes,
  ].map(csvCell).join(',')));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="compliance-report.csv"');
  res.send('﻿' + lines.join('\r\n'));
});

// ---- static client
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use('/api', (_req, res) => bad(res, 'Not found', 404));
app.use((err, _req, res, _next) => { console.error(err); bad(res, 'Server error', 500); });

const port = process.env.PORT || 3000;
if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`Compliance tracker on :${port}`));
export default app;
