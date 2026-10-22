const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let meta, clientId, tab = "dashboard";
const user = $("#user");
user.value = localStorage.getItem("user") || "";
user.onchange = () => localStorage.setItem("user", user.value.trim());

async function api(method, url, body) {
  const r = await fetch(url, {method, headers: {"Content-Type": "application/json", "X-User": user.value.trim()}, body: body ? JSON.stringify(body) : undefined});
  const j = await r.json();
  if (!r.ok) { say(j.error || "Error"); throw new Error(j.error); }
  return j;
}
function say(t, ok) { const m = $("#msg"); m.textContent = t; m.className = ok ? "ok" : ""; if (ok) setTimeout(() => m.textContent = "", 3000); }
const pill = (v) => v ? `<span class="pill ${esc(v)}">${esc(v)}</span>` : "";

function form(title, fields, init = {}) {
  return new Promise((resolve) => {
    const f = $("#dlgForm");
    f.innerHTML = `<h3>${esc(title)}</h3>` + fields.map(([k, label, type, opts]) => {
      const v = init[k] ?? "";
      if (type === "select") return `<label>${label}</label><select name="${k}">${opts.map((o) => `<option ${o == v ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
      if (type === "textarea") return `<label>${label}</label><textarea name="${k}" rows="3">${esc(v)}</textarea>`;
      if (type === "checkbox") return `<label><input type="checkbox" name="${k}" ${v ? "checked" : ""}> ${label}</label>`;
      return `<label>${label}</label><input name="${k}" type="${type || "text"}" value="${esc(v)}">`;
    }).join("") + `<div class="row"><button class="pri" value="ok">Save</button><button value="cancel" formnovalidate>Cancel</button></div>`;
    const d = $("#dlg");
    d.onclose = () => {
      if (d.returnValue !== "ok") return resolve(null);
      const out = {};
      for (const [k, , type] of fields) { const el = f.elements[k]; out[k] = type === "checkbox" ? el.checked : el.value; }
      resolve(out);
    };
    d.returnValue = ""; d.showModal();
  });
}

async function boot() {
  meta = await api("GET", "/api/meta");
  await loadClients();
}
async function loadClients(select) {
  const cs = await api("GET", "/api/clients");
  $("#client").innerHTML = cs.map((c) => `<option value="${c.id}">${esc(c.name)} (${esc(c.financial_year || "")})</option>`).join("");
  clientId = select || (cs[0] && cs[0].id);
  if (clientId) $("#client").value = clientId;
  render();
}
$("#client").onchange = (e) => { clientId = +e.target.value; render(); };
$("#newClient").onclick = async () => {
  const v = await form("New client", [["name", "Name"], ["entity_type", "Entity type", "select", ["Private Limited", "Public Limited", "LLP", "Partnership", "Proprietorship", "Trust / NGO"]], ["financial_year", "Financial year", "text"]], {financial_year: "2025-26"});
  if (!v || !v.name.trim()) return;
  const r = await api("POST", "/api/clients", v); await loadClients(r.id);
};
$("#tabs").onclick = (e) => { if (!e.target.dataset.tab) return; tab = e.target.dataset.tab; document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b === e.target)); render(); };

async function render() {
  const v = $("#view");
  if (!clientId) { v.innerHTML = `<p>Create a client to begin.</p>`; return; }
  $("#reportLink").href = `/report/${clientId}`;
  try { await ({dashboard, rcm, tests, findings, log: auditLog}[tab])(v); } catch (e) { /* message already shown */ }
}

async function dashboard(v) {
  const d = await api("GET", `/api/clients/${clientId}/dashboard`);
  const card = (n, l) => `<div class="card"><b>${n}</b><span>${l}</span></div>`;
  v.innerHTML = `<div class="banner"><b>${esc(d.indication)}</b><br><small>${esc(d.indication_note)}</small></div>
  <div class="cards">${card(d.controls, "controls in RCM")}${card(d.key_controls, "key controls")}${card(d.tested_pct + "%", "tested &amp; reviewed")}${card(d.key_tested_pct + "%", "key controls covered")}
  ${card(d.pending_review, "tests awaiting review")}${card(d.open_findings.High, "open High findings")}${card(d.overdue_findings, "overdue actions")}</div>
  <h2>Coverage by process</h2><div class="scroll"><table><tr><th>Process</th><th>Controls</th><th>Tested</th><th>Ineffective</th><th></th></tr>
  ${Object.entries(d.by_process).map(([p, x]) => `<tr><td>${esc(p)}</td><td>${x.controls}</td><td>${x.tested}</td><td>${x.ineffective ? `<span class="pill High">${x.ineffective}</span>` : 0}</td><td><div class="bar"><i style="width:${Math.round(100 * x.tested / x.controls)}%"></i></div></td></tr>`).join("")}</table></div>`;
}

async function rcm(v) {
  const cs = await api("GET", `/api/clients/${clientId}/controls`);
  v.innerHTML = `<div class="row"><button class="pri" id="add">+ Add control</button>
    ${cs.length ? "" : `<button id="tpl">Load Indian starter RCM (${meta.template_size} controls)</button>`}</div>
  <div class="scroll"><table><tr><th>Ref</th><th>Process</th><th>Risk</th><th>Control</th><th>Type / nature</th><th>Freq.</th><th>Key</th><th>Rating</th><th>Latest result</th><th></th></tr>
  ${cs.map((c) => `<tr><td>${esc(c.ref)}</td><td>${esc(c.process)}</td><td>${esc(c.risk)}</td><td>${esc(c.control)}</td><td>${esc(c.type)}<br><small>${esc(c.nature)}</small></td><td>${esc(c.frequency)}</td><td>${c.is_key ? "&#9733;" : ""}</td><td>${pill(c.risk_rating)}</td><td>${pill(c.latest_result)}</td><td><button data-e="${c.id}">Edit</button></td></tr>`).join("")}</table></div>`;
  const fields = [["process", "Process"], ["risk", "Risk"], ["control", "Control activity", "textarea"], ["type", "Type", "select", meta.enums.type], ["nature", "Nature", "select", meta.enums.nature], ["frequency", "Frequency", "select", meta.frequencies], ["is_key", "Key control", "checkbox"], ["assertion", "Assertion"], ["risk_rating", "Risk rating", "select", meta.enums.risk_rating], ["owner", "Control owner"]];
  $("#add").onclick = async () => { const x = await form("Add control", fields); if (x) { await api("POST", `/api/clients/${clientId}/controls`, x); render(); } };
  if ($("#tpl")) $("#tpl").onclick = async () => { await api("POST", `/api/clients/${clientId}/load-template`, {}); say("Template loaded", true); render(); };
  v.querySelectorAll("[data-e]").forEach((b) => b.onclick = async () => {
    const c = cs.find((z) => z.id == b.dataset.e); const x = await form("Edit " + c.ref, fields, c);
    if (x) { await api("PUT", `/api/controls/${c.id}`, x); render(); }
  });
}

async function tests(v) {
  const [cs, ts] = await Promise.all([api("GET", `/api/clients/${clientId}/controls`), api("GET", `/api/clients/${clientId}/tests`)]);
  v.innerHTML = `<div class="row"><button class="pri" id="add">+ Record test</button><small>Reviewer must differ from the preparer; reviewed tests are locked.</small></div>
  <div class="scroll"><table><tr><th>Control</th><th>Procedure</th><th>Sample / exceptions</th><th>Result</th><th>Prepared</th><th>Review</th><th></th></tr>
  ${ts.map((t) => `<tr><td>${esc(t.ref)}<br><small>${esc(t.control)}</small></td><td>${esc(t.procedure)}<br><small>${esc(t.evidence)}</small></td><td>${t.sample_size} / ${t.exceptions}</td><td>${pill(t.result)}</td><td>${esc(t.prepared_by)}<br><small>${esc(t.test_date)}</small></td><td>${pill(t.review_status)}<br><small>${esc(t.reviewed_by || "")} ${esc(t.review_note || "")}</small></td><td>${t.review_status === "Pending" ? `<button data-r="${t.id}">Review</button>` : ""}${t.result === "Ineffective" || t.result === "Effective with exceptions" ? `<button data-f="${t.id}" data-c="${t.control_id}">Raise finding</button>` : ""}</td></tr>`).join("")}</table></div>`;
  $("#add").onclick = async () => {
    if (!cs.length) return say("Add controls first");
    const x = await form("Record test of control", [["control_id", "Control", "select", cs.map((c) => c.id + " - " + c.ref + " " + c.control.slice(0, 60))], ["procedure", "Test procedure (inquiry, inspection, re-performance...)", "textarea"], ["sample_size", "Sample size", "number"], ["exceptions", "Exceptions", "number"], ["evidence", "Evidence reference (doc / file / screenshot)"], ["result", "Result", "select", meta.enums.result], ["prepared_by", "Prepared by"]],
      {prepared_by: user.value, sample_size: 0, exceptions: 0});
    if (!x) return;
    const id = parseInt(x.control_id); delete x.control_id;
    await api("POST", `/api/controls/${id}/tests`, x); render();
  };
  v.querySelectorAll("[data-r]").forEach((b) => b.onclick = async () => {
    const x = await form("Review test", [["status", "Decision", "select", ["Approved", "Rejected"]], ["reviewed_by", "Reviewer"], ["review_note", "Review note (required if rejected)", "textarea"]], {reviewed_by: user.value});
    if (x) { await api("POST", `/api/tests/${b.dataset.r}/review`, x); render(); }
  });
  v.querySelectorAll("[data-f]").forEach((b) => b.onclick = () => newFinding({control_id: +b.dataset.c, test_id: +b.dataset.f}));
}

const FFIELDS = () => [["title", "Finding title"], ["observation", "Observation / condition", "textarea"], ["severity", "Severity", "select", meta.enums.severity], ["recommendation", "Recommendation", "textarea"], ["mgmt_response", "Management response", "textarea"], ["owner", "Action owner"], ["due_date", "Due date", "date"]];
async function newFinding(link = {}) {
  const x = await form("Raise finding", FFIELDS());
  if (x) { if (!x.due_date) delete x.due_date; await api("POST", `/api/clients/${clientId}/findings`, {...x, ...link}); say("Finding raised", true); tab = "findings"; document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === "findings")); render(); }
}
async function findings(v) {
  const fs = await api("GET", `/api/clients/${clientId}/findings`);
  const today = new Date().toISOString().slice(0, 10);
  v.innerHTML = `<div class="row"><button class="pri" id="add">+ Raise finding</button></div><div class="scroll"><table><tr><th>Severity</th><th>Finding</th><th>Recommendation / response</th><th>Owner / due</th><th>Status</th><th></th></tr>
  ${fs.map((f) => `<tr><td>${pill(f.severity)}</td><td><b>${esc(f.title)}</b><br>${esc(f.observation)}<br><small>${esc(f.control_ref || "")}</small></td><td>${esc(f.recommendation)}<br><small>${esc(f.mgmt_response)}</small></td><td>${esc(f.owner)}<br>${f.due_date && f.status !== "Closed" && f.due_date < today ? `<span class="pill High">overdue ${esc(f.due_date)}</span>` : esc(f.due_date)}</td><td>${pill(f.status)}</td><td>${f.status === "Closed" ? "" : `<button data-u="${f.id}">Update</button>`}</td></tr>`).join("")}</table></div>`;
  $("#add").onclick = () => newFinding();
  v.querySelectorAll("[data-u]").forEach((b) => b.onclick = async () => {
    const f = fs.find((z) => z.id == b.dataset.u);
    const x = await form("Update finding", [["mgmt_response", "Management response", "textarea"], ["owner", "Action owner"], ["due_date", "Due date", "date"], ["status", "Status", "select", ["Open", "In progress", "Closed"]], ["closure_note", "Closure note: evidence that remediation was verified", "textarea"]], f);
    if (x) { if (!x.due_date) delete x.due_date; await api("PUT", `/api/findings/${f.id}`, x); render(); }
  });
}

async function auditLog(v) {
  const [l, ver] = await Promise.all([api("GET", `/api/clients/${clientId}/log`), api("GET", "/api/log/verify")]);
  v.innerHTML = `<div class="banner">Hash-chain integrity: <b class="${ver.valid ? "Low" : "High"}">${ver.valid ? "VALID (" + ver.entries + " entries)" : "BROKEN at entry " + ver.broken_at}</b></div>
  <div class="scroll"><table><tr><th>#</th><th>Time (UTC)</th><th>User</th><th>Action</th><th>Detail</th></tr>${l.map((e) => `<tr><td>${e.id}</td><td>${esc(e.ts)}</td><td>${esc(e.actor)}</td><td>${esc(e.action)} ${esc(e.entity)} #${e.entity_id}</td><td><small>${esc(e.detail)}</small></td></tr>`).join("")}</table></div>`;
}
boot();
