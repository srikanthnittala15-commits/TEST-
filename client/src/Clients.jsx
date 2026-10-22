import { useEffect, useState } from 'react';
import { api } from './api.js';
import { KIND_LABEL } from './util.js';

const nowFY = () => { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; };

function Generate({ client, onClose, onDone }) {
  const [catalog, setCatalog] = useState([]);
  const [sel, setSel] = useState(null);
  const [fy, setFy] = useState(nowFY());
  const [msg, setMsg] = useState('');
  useEffect(() => {
    api.catalog().then((c) => {
      setCatalog(c);
      setSel(new Set(c.filter((x) => x.applies.includes(client.kind) || (client.kind === 'company' && x.applies.includes('business'))).map((x) => x.key)));
    });
  }, [client.kind]);
  if (!sel) return null;
  const toggle = (k) => { const s = new Set(sel); s.has(k) ? s.delete(k) : s.add(k); setSel(s); };
  const go = async () => {
    try { const r = await api.generate(client.id, { fy, keys: [...sel] }); setMsg(`${r.created} new tasks created.`); onDone(); }
    catch (x) { setMsg(x.message); }
  };
  const cats = [...new Set(catalog.map((c) => c.category))];
  return (
    <div className="overlay" onClick={onClose}>
      <div className="card modal" onClick={(e) => e.stopPropagation()}>
        <h2>Generate compliance calendar: {client.name}</h2>
        <label>Financial year starting
          <select value={fy} onChange={(e) => setFy(Number(e.target.value))}>
            {[0, 1, -1].map((o) => <option key={o} value={nowFY() + o}>FY {nowFY() + o}-{String(nowFY() + o + 1).slice(2)}</option>)}
          </select></label>
        {cats.map((cat) => (
          <fieldset key={cat}><legend>{cat}</legend>
            {catalog.filter((c) => c.category === cat).map((c) => (
              <label key={c.key} className="check"><input type="checkbox" checked={sel.has(c.key)} onChange={() => toggle(c.key)} /> {c.title}</label>))}
          </fieldset>))}
        <p className="muted">Due dates are statutory defaults. Extensions by CBDT/CBIC/MCA notifications are not applied automatically, so edit individual tasks when dates change.</p>
        {msg && <div className="info">{msg}</div>}
        <div className="actions"><span className="spacer" /><button onClick={onClose}>Close</button><button className="primary" onClick={go}>Generate</button></div>
      </div>
    </div>
  );
}

export default function Clients({ go }) {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState(null);
  const [gen, setGen] = useState(null);
  const [err, setErr] = useState('');
  const load = () => api.clients().then(setClients);
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const save = async (e) => {
    e.preventDefault(); setErr('');
    try { await api.saveClient(form); setForm(null); load(); } catch (x) { setErr(x.message); }
  };
  return (
    <>
      <div className="toolbar"><span className="spacer" /><button className="primary" onClick={() => setForm({ kind: 'business' })}>+ New client</button></div>
      <div className="card">
        <table>
          <thead><tr><th>Client</th><th>Type</th><th>PAN</th><th>GSTIN</th><th>Done</th><th>Overdue</th><th /></tr></thead>
          <tbody>{clients.map((c) => (
            <tr key={c.id}>
              <td><button className="link" onClick={() => go('tasks', { client: String(c.id) })}>{c.name}</button></td>
              <td>{KIND_LABEL[c.kind]}</td><td>{c.pan}</td><td>{c.gstin}</td>
              <td>{c.done}/{c.total}</td><td className={c.overdue ? 'bad-text' : ''}>{c.overdue || 0}</td>
              <td className="actions">
                <button onClick={() => setGen(c)}>Generate calendar</button>
                <button onClick={() => { setErr(''); setForm(c); }}>Edit</button>
                <button className="danger" onClick={async () => { if (confirm(`Delete ${c.name} and all its tasks?`)) { try { await api.delClient(c.id); load(); } catch (x) { alert(x.message); } } }}>Delete</button>
              </td>
            </tr>))}
            {!clients.length && <tr><td colSpan={7} className="muted">No clients yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {form && (
        <div className="overlay" onClick={() => setForm(null)}>
          <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{form.id ? 'Edit client' : 'New client'}</h2>
            <label>Name<input value={form.name || ''} onChange={set('name')} required /></label>
            <label>Type<select value={form.kind} onChange={set('kind')}>
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <div className="row">
              <label>PAN<input value={form.pan || ''} maxLength={10} onChange={set('pan')} /></label>
              <label>GSTIN<input value={form.gstin || ''} maxLength={15} onChange={set('gstin')} /></label>
            </div>
            <label>Notes<textarea rows={3} value={form.notes || ''} onChange={set('notes')} /></label>
            {err && <div className="error">{err}</div>}
            <div className="actions"><span className="spacer" /><button type="button" onClick={() => setForm(null)}>Cancel</button><button className="primary">Save</button></div>
          </form>
        </div>)}
      {gen && <Generate client={gen} onClose={() => setGen(null)} onDone={load} />}
    </>
  );
}
