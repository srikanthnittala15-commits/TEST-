import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function Team({ me }) {
  const [users, setUsers] = useState([]);
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'member' });
  const [err, setErr] = useState('');
  const load = () => api.users().then(setUsers);
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const add = async (e) => {
    e.preventDefault(); setErr('');
    try { await api.addUser(f); setF({ name: '', email: '', password: '', role: 'member' }); load(); } catch (x) { setErr(x.message); }
  };
  const admin = me.role === 'admin';
  return (
    <div className="grid2">
      <section className="card">
        <h2>Team</h2>
        <table><tbody>{users.map((u) => (
          <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td>
            <td>{admin && u.id !== me.id && <button className="danger" onClick={() => confirm(`Remove ${u.name}?`) && api.delUser(u.id).then(load)}>Remove</button>}</td></tr>))}
        </tbody></table>
      </section>
      {admin && (
        <form className="card" onSubmit={add}>
          <h2>Add team member</h2>
          <label>Name<input value={f.name} onChange={set('name')} required /></label>
          <label>Email<input type="email" value={f.email} onChange={set('email')} required /></label>
          <label>Temporary password<input type="password" minLength={8} value={f.password} onChange={set('password')} required /></label>
          <label>Role<select value={f.role} onChange={set('role')}><option value="member">Member</option><option value="admin">Admin</option></select></label>
          {err && <div className="error">{err}</div>}
          <button className="primary">Add</button>
        </form>)}
    </div>
  );
}
