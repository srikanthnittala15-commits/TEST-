import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ct-'));
const { default: app } = await import('../index.js');
const { dueDates, CATALOG } = await import('../catalog.js');

let server, base;
before(() => new Promise((r) => { server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; r(); }); }));
after(() => server.close());

const call = async (p, { method = 'GET', body, token, raw } = {}) => {
  const res = await fetch(base + p, {
    method, headers: { ...(body && !raw ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: raw || (body ? JSON.stringify(body) : undefined),
  });
  const ct = res.headers.get('content-type') || '';
  return { status: res.status, data: ct.includes('json') ? await res.json() : await res.text() };
};

test('due-date rules', () => {
  const gstr3b = dueDates(CATALOG.find((c) => c.key === 'gstr3b').rule, 2026);
  assert.equal(gstr3b.length, 12);
  assert.equal(gstr3b[0].due, '2026-05-20'); // Apr 2026 return
  assert.equal(gstr3b[11].due, '2027-04-20'); // Mar 2027 return
  const adv = dueDates(CATALOG.find((c) => c.key === 'adv_tax').rule, 2026).map((d) => d.due);
  assert.deepEqual(adv, ['2026-06-15', '2026-09-15', '2026-12-15', '2027-03-15']);
});

test('full flow with tenant isolation', async () => {
  const a = (await call('/api/auth/register', { method: 'POST', body: { orgName: 'A & Co', name: 'Asha', email: 'a@x.com', password: 'password1' } })).data.token;
  const b = (await call('/api/auth/register', { method: 'POST', body: { orgName: 'B Ltd', name: 'Bob', email: 'b@x.com', password: 'password1' } })).data.token;
  assert.equal((await call('/api/clients')).status, 401);

  const c = await call('/api/clients', { method: 'POST', token: a, body: { name: 'Acme', kind: 'company', pan: 'ABCDE1234F', gstin: '29ABCDE1234F1Z5' } });
  assert.equal(c.status, 201);
  assert.equal((await call('/api/clients', { method: 'POST', token: a, body: { name: 'Bad', pan: 'xx' } })).status, 400);

  const g = await call(`/api/clients/${c.data.id}/generate`, { method: 'POST', token: a, body: { fy: 2026 } });
  assert.ok(g.data.created > 40);
  assert.equal((await call(`/api/clients/${c.data.id}/generate`, { method: 'POST', token: a, body: { fy: 2026 } })).data.created, 0, 'idempotent');

  const tasks = (await call('/api/tasks', { token: a })).data;
  const t = tasks[0];
  assert.equal((await call(`/api/tasks/${t.id}`, { method: 'PUT', token: a, body: { status: 'filed' } })).status, 200);
  assert.equal((await call('/api/tasks', { token: b })).data.length, 0);
  assert.equal((await call(`/api/tasks/${t.id}`, { method: 'PUT', token: b, body: { status: 'filed' } })).status, 404);

  const fd = new FormData(); fd.append('files', new Blob(['ack']), 'ack.txt');
  assert.equal((await call(`/api/tasks/${t.id}/documents`, { method: 'POST', token: a, raw: fd })).data.uploaded, 1);
  const docs = (await call(`/api/tasks/${t.id}/documents`, { token: a })).data;
  assert.equal((await call(`/api/documents/${docs[0].id}/download`, { token: a })).data, 'ack');
  assert.equal((await call(`/api/documents/${docs[0].id}/download`, { token: b })).status, 404);

  const d = (await call('/api/dashboard', { token: a })).data;
  assert.equal(d.done, 1);
  const csv = (await call('/api/reports/tasks.csv', { token: a })).data;
  assert.ok(csv.includes('Acme'));
});
