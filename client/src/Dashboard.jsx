import { useEffect, useState } from 'react';
import { api } from './api.js';
import { fmtDate, STATUS_LABEL } from './util.js';

const Stat = ({ label, value, tone, onClick }) => (
  <button className={`stat ${tone || ''}`} onClick={onClick}><span>{value}</span>{label}</button>
);

export default function Dashboard({ go }) {
  const [d, setD] = useState(null);
  const [rem, setRem] = useState([]);
  useEffect(() => { api.dashboard().then(setD); api.reminders(14).then(setRem); }, []);
  if (!d) return <p>Loading…</p>;
  return (
    <>
      <div className="stats">
        <Stat label="Compliance score" value={`${d.score}%`} tone={d.score >= 80 ? 'good' : d.score >= 50 ? 'warn' : 'bad'} />
        <Stat label="Overdue" value={d.overdue} tone={d.overdue ? 'bad' : 'good'} onClick={() => go('tasks', { status: 'overdue' })} />
        <Stat label="Due in 7 days" value={d.next7} tone={d.next7 ? 'warn' : ''} onClick={() => go('tasks', { from: d.today, to: addDays(d.today, 7) })} />
        <Stat label="Due in 30 days" value={d.dueInMonth} />
        <Stat label="Filed / total" value={`${d.done}/${d.total}`} />
      </div>
      <div className="grid2">
        <section className="card">
          <h2>Needs attention (next 14 days)</h2>
          {rem.length === 0 ? <p className="muted">Nothing pending. 🎉</p> : (
            <table><tbody>{rem.map((t) => (
              <tr key={t.id} className={t.overdue ? 'overdue' : ''}>
                <td>{fmtDate(t.due_date)}</td><td>{t.client_name}</td><td>{t.title} <small>{t.period}</small></td>
                <td>{t.overdue ? <b>Overdue</b> : STATUS_LABEL[t.status]}</td>
              </tr>))}</tbody></table>)}
        </section>
        <section className="card">
          <h2>By category</h2>
          <table>
            <thead><tr><th>Category</th><th>Done</th><th>Total</th><th>Overdue</th></tr></thead>
            <tbody>{d.byCategory.map((c) => (
              <tr key={c.category}><td>{c.category}</td><td>{c.done}</td><td>{c.total}</td>
                <td className={c.overdue ? 'bad-text' : ''}>{c.overdue}</td></tr>))}</tbody>
          </table>
          <h2>Open work by person</h2>
          <table><tbody>{d.byAssignee.map((a) => <tr key={a.name}><td>{a.name}</td><td>{a.open}</td></tr>)}</tbody></table>
        </section>
      </div>
    </>
  );
}

function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
