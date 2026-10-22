import { useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import { fmtDate, STATUS_LABEL } from './util.js';

function TaskModal({ task, clients, users, onClose, onSaved }) {
  const [t, setT] = useState(task);
  const [docs, setDocs] = useState([]);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setT({ ...t, [k]: e.target.value });
  const loadDocs = useCallback(() => t.id && api.docs(t.id).then(setDocs), [t.id]);
  useEffect(() => { loadDocs(); }, [loadDocs]);

  const save = async (e) => {
    e.preventDefault(); setErr('');
    try { await api.saveTask(t); onSaved(); } catch (x) { setErr(x.message); }
  };
  const upload = async (e) => {
    try { await api.upload(t.id, e.target.files); e.target.value = ''; loadDocs(); onSaved(true); } catch (x) { setErr(x.message); }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{t.id ? 'Edit task' : 'New task'}</h2>
        {!t.id && <label>Client
          <select value={t.client_id || ''} onChange={set('client_id')} required>
            <option value="">Select…</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></label>}
        <label>Title<input value={t.title || ''} onChange={set('title')} required /></label>
        <div className="row">
          <label>Category<input value={t.category || ''} onChange={set('category')} /></label>
          <label>Period<input value={t.period || ''} onChange={set('period')} /></label>
        </div>
        <div className="row">
          <label>Due date<input type="date" value={t.due_date || ''} onChange={set('due_date')} required /></label>
          <label>Status<select value={t.status} onChange={set('status')}>
            {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        <div className="row">
          <label>Assignee<select value={t.assignee_id || ''} onChange={set('assignee_id')}>
            <option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          <label>Priority<select value={t.priority} onChange={set('priority')}>
            <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        </div>
        <label>Notes<textarea rows={3} value={t.notes || ''} onChange={set('notes')} /></label>
        {t.id && <div>
          <h3>Evidence / documents</h3>
          <ul className="docs">{docs.map((d) => (
            <li key={d.id}>
              <button type="button" className="link" onClick={() => api.download(`/documents/${d.id}/download`, d.filename)}>{d.filename}</button>
              <small> {(d.size / 1024).toFixed(0)} KB</small>
              <button type="button" className="link danger" onClick={() => api.delDoc(d.id).then(() => { loadDocs(); onSaved(true); })}>remove</button>
            </li>))}
          </ul>
          <input type="file" multiple onChange={upload} />
          <small className="muted"> Max 10 MB per file.</small>
        </div>}
        {err && <div className="error">{err}</div>}
        <div className="actions">
          {t.id && <button type="button" className="danger" onClick={async () => { if (confirm('Delete this task and its documents?')) { await api.delTask(t.id); onSaved(); } }}>Delete</button>}
          <span className="spacer" />
          <button type="button" onClick={onClose}>Cancel</button>
          <button className="primary">Save</button>
        </div>
      </form>
    </div>
  );
}

export default function Tasks({ preset }) {
  const [f, setF] = useState({ status: '', client: '', assignee: '', category: '', from: '', to: '', q: '', ...preset });
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = useCallback(() => api.tasks(f).then(setTasks), [f]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.clients().then(setClients); api.users().then(setUsers); }, []);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const quick = async (t, status) => { await api.saveTask({ ...t, status }); load(); };
  const categories = [...new Set(tasks.map((t) => t.category))];

  return (
    <>
      <div className="toolbar">
        <input placeholder="Search client or task…" value={f.q} onChange={set('q')} />
        <select value={f.status} onChange={set('status')}>
          <option value="">All statuses</option><option value="overdue">Overdue</option>
          {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select value={f.client} onChange={set('client')}><option value="">All clients</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={f.assignee} onChange={set('assignee')}><option value="">Anyone</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <select value={f.category} onChange={set('category')}><option value="">All categories</option>
          {categories.map((c) => <option key={c}>{c}</option>)}</select>
        <input type="date" value={f.from} onChange={set('from')} title="Due from" />
        <input type="date" value={f.to} onChange={set('to')} title="Due until" />
        <span className="spacer" />
        <button onClick={() => api.download('/reports/tasks.csv?' + new URLSearchParams(Object.entries(f).filter(([, v]) => v)), 'compliance-report.csv')}>Export CSV</button>
        <button className="primary" onClick={() => setEdit({ status: 'pending', priority: 'medium', category: 'Other' })}>+ New task</button>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Due</th><th>Client</th><th>Task</th><th>Category</th><th>Assignee</th><th>Status</th><th>Docs</th><th /></tr></thead>
          <tbody>
            {tasks.map((t) => (
              <tr key={t.id} className={t.overdue ? 'overdue' : ''}>
                <td>{fmtDate(t.due_date)}</td><td>{t.client_name}</td>
                <td><button className="link" onClick={() => setEdit(t)}>{t.title}</button> <small>{t.period}</small></td>
                <td>{t.category}</td><td>{t.assignee_name || '—'}</td>
                <td><span className={`badge ${t.overdue ? 'overdue' : t.status}`}>{t.overdue ? 'Overdue' : STATUS_LABEL[t.status]}</span></td>
                <td>{t.doc_count || ''}</td>
                <td>{t.status !== 'filed' && <button onClick={() => quick(t, 'filed')}>Mark filed</button>}</td>
              </tr>))}
            {!tasks.length && <tr><td colSpan={8} className="muted">No tasks. Add a client and generate its compliance calendar.</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <TaskModal task={edit} clients={clients} users={users} onClose={() => setEdit(null)}
        onSaved={(keepOpen) => { load(); if (!keepOpen) setEdit(null); }} />}
    </>
  );
}
