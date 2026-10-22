import { useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken } from './api.js';
import Dashboard from './Dashboard.jsx';
import Tasks from './Tasks.jsx';
import Clients from './Clients.jsx';
import Team from './Team.jsx';

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [f, setF] = useState({ orgName: '', name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    try {
      const { token } = await (mode === 'login' ? api.login(f) : api.register(f));
      setToken(token); onAuth();
    } catch (x) { setErr(x.message); }
  };
  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h1>Compliance Tracker</h1>
        <p className="muted">GST, TDS, Income Tax, ROC and IT/security audits in one place.</p>
        {mode === 'register' && <>
          <label>Organisation<input value={f.orgName} onChange={set('orgName')} required /></label>
          <label>Your name<input value={f.name} onChange={set('name')} required /></label>
        </>}
        <label>Email<input type="email" value={f.email} onChange={set('email')} required /></label>
        <label>Password<input type="password" minLength={8} value={f.password} onChange={set('password')} required /></label>
        {err && <div className="error">{err}</div>}
        <button className="primary">{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className="link" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'New organisation? Register' : 'Have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}

const TABS = [['dashboard', 'Dashboard'], ['tasks', 'Compliance calendar'], ['clients', 'Clients'], ['team', 'Team']];

export default function App() {
  const [me, setMe] = useState(null);
  const [checked, setChecked] = useState(!getToken());
  const [tab, setTab] = useState('dashboard');
  const [preset, setPreset] = useState({});

  const load = useCallback(() => {
    if (!getToken()) return setChecked(true);
    api.me().then(setMe).catch(() => setToken(null)).finally(() => setChecked(true));
  }, []);
  useEffect(load, [load]);

  if (!checked) return null;
  if (!me) return <Auth onAuth={load} />;

  const go = (t, p = {}) => { setPreset(p); setTab(t); };
  return (
    <div className="shell">
      <header>
        <strong>{me.org}</strong>
        <nav>{TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => go(k)}>{label}</button>))}
        </nav>
        <span className="muted">{me.name} ({me.role})</span>
        <button className="link" onClick={() => { setToken(null); setMe(null); }}>Sign out</button>
      </header>
      <main>
        {tab === 'dashboard' && <Dashboard go={go} />}
        {tab === 'tasks' && <Tasks key={JSON.stringify(preset)} preset={preset} />}
        {tab === 'clients' && <Clients go={go} />}
        {tab === 'team' && <Team me={me} />}
      </main>
    </div>
  );
}
