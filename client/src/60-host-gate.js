/* =====================================================================
   Web host: talks to the Triagon ERP server. Sign-in, live sync,
   files, PDFs, backups. Data lives on the server; every open browser
   sees changes as they happen.
   ===================================================================== */
const SVC = (() => { const q = new URLSearchParams(location.search); return q.get('svc') === 'report' ? { date: q.get('date') } : null; })();
async function api(method, url, body, o = {}) {
  const h = { 'X-TV': '1' }; let b = body;
  if (body !== undefined && !(body instanceof Blob) && !(body instanceof ArrayBuffer)) { h['Content-Type'] = 'application/json'; b = JSON.stringify(body); }
  if (o.headers) Object.assign(h, o.headers);
  let r; try { r = await fetch(url, { method, headers: h, body: b, credentials: 'same-origin', cache: 'no-store' }); }
  catch (e) { throw { code: 'unavailable', userMsg: 'Can’t reach the server. Check the internet connection and try again.' }; }
  if (o.raw) { if (!r.ok) { let m = ''; try { m = (await r.json()).error; } catch (e) { } throw { status: r.status, userMsg: m || 'That didn’t work.' }; } return r; }
  let j = null; try { j = await r.json(); } catch (e) { }
  if (!r.ok) { if (r.status === 401 && !o.noAuthRedirect && MODE === 'live') sessionLost(); throw { status: r.status, code: (j && j.code) || 'server', userMsg: (j && j.error) || 'That didn’t work. Try again.', path: j && j.path }; }
  return j;
}
const HOST = {
  desktop: true, web: true,
  hashPin: async (pin) => api('POST', '/api/hash', { pin }),
  info: async () => api('GET', '/api/server'),
  saveFile: async o => { downloadBlob(new Blob([(o.bom ? '﻿' : '') + o.data], { type: 'text/csv;charset=utf-8' }), o.filename); return o.filename; },
  dailyPDF: async o => { const blob = await pdfBlob(o.html, `Triagon-Daily-Report-${o.date}.pdf`, { footer: 'Triagon Ventures · Daily report', saveDaily: o.mode === 'auto' ? o.date : '' }); if (o.mode !== 'auto') downloadBlob(blob, `Triagon-Daily-Report-${o.date}.pdf`); return `Triagon-Daily-Report-${o.date}.pdf`; },
  reportExists: async date => { try { const l = await api('GET', '/api/reports'); return l.some(x => x.date === date); } catch (e) { return false; } },
  listReports: async () => (await api('GET', '/api/reports')).map(r => ({ ...r, path: '/api/reports/' + r.date })),
  chooseReportsDir: async () => null,
  openPath: async p => { window.open(p, '_blank', 'noopener'); return ''; }, showItem: async p => { window.open(p, '_blank', 'noopener'); return true; },
  openReports: async () => { ui.view = 'daily'; schedule(); }, openDataFolder: async () => { },
  exportBackup: async () => { const a = document.createElement('a'); a.href = '/api/backup'; a.download = ''; document.body.appendChild(a); a.click(); a.remove(); return 'backup'; },
  importBackup: async () => null, onClosing: () => { }, closeReady: () => { },
};
function downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
async function pdfBlob(html, filename, o = {}) { const r = await api('POST', '/api/pdf', { html, filename, footer: o.footer || '', landscape: !!o.landscape, saveDaily: o.saveDaily || '' }, { raw: true }); return await r.blob(); }
async function makePDF(html, filename, o = {}) { toast('Making the PDF…'); try { const b = await pdfBlob(html, filename, o); downloadBlob(b, filename); toast('Downloaded ' + filename); return true; } catch (e) { toast(e.userMsg || 'The PDF couldn’t be made.', 'bad'); return false; } }
async function uploadFile(file, link = {}) {
  if (file.size > 25 * 1024 * 1024) throw { userMsg: 'Files up to 25 MB can be uploaded.' };
  const q = new URLSearchParams({ name: file.name, ...(link.col ? { col: link.col } : {}), ...(link.docId ? { docId: link.docId } : {}) });
  const r = await api('POST', '/api/files?' + q, file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } }); return r;
}
const fileURL = (id, dl) => '/api/files/' + encodeURIComponent(id) + (dl ? '?dl=1' : '');
const fileOf = id => byId('files')[id];

/* ---------- live store: same API as the in-memory store, backed by the server ---------- */
function remoteDB(snap) {
  const docs = new Map(); const revs = new Map(); const subs = new Set(); let pend = false; let maxRev = 0;
  const load = s => { docs.clear(); revs.clear(); for (const p in s.docs) { docs.set(p, Object.freeze(s.docs[p])); revs.set(p, (s.revs || {})[p] || 0); } maxRev = s.rev || 0; };
  load(snap);
  const snapDoc = (id, d) => ({ id, exists: d !== undefined, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } });
  const colDocs = path => { const pre = path + '/'; const out = []; for (const [p, d] of docs) if (p.startsWith(pre) && !p.slice(pre.length).includes('/')) out.push({ id: p.slice(pre.length), d }); return out; };
  const cmp = (a, op, b) => op === '==' ? a === b : op === '!=' ? a !== b : op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : op === '>=' ? a >= b : op === 'in' ? b.includes(a) : op === 'array-contains' ? (a || []).includes(b) : true;
  const runQ = q => { let a = colDocs(q.path); for (const [f, op, v] of q.w) a = a.filter(x => cmp(x.d[f], op, v)); if (q.o) { const [f, dir] = q.o; a.sort((x, y) => ((x.d[f] > y.d[f]) ? 1 : (x.d[f] < y.d[f]) ? -1 : 0) * (dir === 'desc' ? -1 : 1)); } else a.sort((x, y) => x.id < y.id ? -1 : 1); if (q.l) a = a.slice(0, q.l); return a; };
  const deliver = s => { if (s.kind === 'doc') s.next(snapDoc(s.path.split('/').pop(), docs.get(s.path))); else { const ds = runQ(s.q).map(x => snapDoc(x.id, x.d)); s.next({ docs: ds, size: ds.length, empty: !ds.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }); } };
  const notify = () => { if (pend) return; pend = true; setTimeout(() => { pend = false; subs.forEach(deliver); }, 0); };
  const put = (p, rev, data) => { if (rev && rev < (revs.get(p) || 0)) return false; revs.set(p, rev || revs.get(p) || 0); if (rev > maxRev) maxRev = rev; if (data === null || data === undefined) docs.delete(p); else docs.set(p, Object.freeze(data)); return true; };
  async function send(ops) {
    SYNC.pending++; paintSaveState();
    try { const r = await api('POST', '/api/write', { ops }); for (const p in r.docs) put(p, r.docs[p].rev, r.docs[p].data); notify(); SYNC.at = nowISO(); SYNC.failed = false; }
    catch (e) { if (e.code === 'unavailable') SYNC.failed = true; throw e; }
    finally { SYNC.pending--; paintSaveState(); }
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  function docRef(path) {
    return {
      id: path.split('/').pop(), path,
      get: async () => snapDoc(path.split('/').pop(), docs.get(path)),
      set: async d => send([{ op: 'set', path, data: clone(d) }]),
      update: async d => send([{ op: 'update', path, data: clone(d) }]),
      delete: async () => send([{ op: 'delete', path }]),
      onSnapshot(next) { const s = { kind: 'doc', path, next }; subs.add(s); setTimeout(() => deliver(s)); return () => subs.delete(s); },
      collection: p => colRef(path + '/' + p),
    };
  }
  function query(path, q) {
    return {
      where: (f, op, v) => query(path, { ...q, w: [...q.w, [f, op, v]] }), orderBy: (f, dir = 'asc') => query(path, { ...q, o: [f, dir] }), limit: n => query(path, { ...q, l: n }),
      get: async () => { const ds = runQ({ ...q, path }).map(x => snapDoc(x.id, x.d)); return { docs: ds, size: ds.length, empty: !ds.length }; },
      onSnapshot(next) { const s = { kind: 'col', q: { ...q, path }, next }; subs.add(s); setTimeout(() => deliver(s)); return () => subs.delete(s); },
    };
  }
  function colRef(path) { return Object.assign(query(path, { w: [], o: null, l: 0 }), { path, doc: id => docRef(path + '/' + (id || rid())), add: async d => { const r = docRef(path + '/' + rid()); await r.set(d); return r; } }); }
  return {
    doc: docRef, collection: colRef, _docs: docs, batch: ops => send(ops.map(o => ({ ...o, data: o.data ? clone(o.data) : undefined }))),
    remote(changes) { let any = false; for (const c of changes) any = put(c.path, c.rev, c.data) || any; if (any) notify(); },
    reset(s) { load(s); notify(); }, rev: () => maxRev,
  };
}
// write several records in one go (all or nothing)
async function dbBatch(ops) { if (!DB) throw { code: 'unavailable' }; return DB.batch(ops); }

/* ---------- connection state ---------- */
const SYNC = { pending: 0, at: null, failed: false, online: true, es: null, retry: 0 };
function paintSaveState() {
  const el = $('#saveState'); if (!el) return;
  const t = !SYNC.online ? ['Offline · reconnecting', 'bad'] : SYNC.failed ? ['Not saved · check connection', 'bad'] : SYNC.pending ? ['Saving…', 'warn'] : ['Live · all saved', 'good'];
  el.innerHTML = `<i class="sev ${t[1]}"></i>${esc(t[0])}`;
}
function listen() {
  if (SYNC.es) { try { SYNC.es.close(); } catch (e) { } }
  const es = new EventSource('/api/events?rev=' + (DB ? DB.rev() : 0)); SYNC.es = es;
  es.addEventListener('hello', () => { SYNC.online = true; SYNC.retry = 0; paintSaveState(); });
  es.addEventListener('changes', ev => { try { DB.remote(JSON.parse(ev.data)); } catch (e) { console.warn(e); } });
  es.addEventListener('resync', () => resync());
  es.addEventListener('signout', () => sessionLost());
  es.onerror = () => { SYNC.online = false; paintSaveState(); try { es.close(); } catch (e) { } clearTimeout(SYNC.t); SYNC.t = setTimeout(() => { if (MODE === 'live' || SVC) api('GET', '/api/me', undefined, { noAuthRedirect: true }).then(() => listen(), e => { if (e.status === 401) sessionLost(); else listen(); }); }, Math.min(15000, 1000 * 2 ** (SYNC.retry++))); };
}
async function resync() { try { const s = await api('GET', '/api/snapshot'); DB.reset(s); memoC.clear(); bump(); } catch (e) { console.warn(e); } }
function sessionLost() { if (MODE !== 'live') return; try { SYNC.es && SYNC.es.close(); } catch (e) { } MODE = 'locked'; ME.id = null; GATE.step = 'login'; GATE.err = 'You were signed out. Sign in again to continue.'; resetShell(); renderGate(); }
window.addEventListener('online', () => { if (MODE === 'live') listen(); });

/* ---------- people (names come from the members list) ---------- */
const AVC = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
const avColor = id => { let h = 0; for (const ch of String(id || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AVC[h % AVC.length]; };
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
const avHTML = (id, name, cls = '') => `<span class="av ini ${cls}" style="--bc:var(--${avColor(id)})" aria-hidden="true">${esc(initials(name))}</span>`;
const liveMembers = () => S.members.filter(m => m.status !== 'removed' && m.name);
const pinOK = p => /^\d{4,8}$/.test(String(p || ''));
async function hashPin(pin) { const r = await HOST.hashPin(String(pin)); return { salt: r.salt, hash: r.hash }; }

/* ---------- sign-in, first-time setup ---------- */
const GATE = { step: 'login', err: '', busy: false, status: null, imp: null, impName: '' };
const KIOSK_TOKEN = () => { try { return localStorage.getItem('tv-kiosk') || ''; } catch (e) { return ''; } };
const gateBrand = () => `<div class="gate-brand">
  <img class="gate-logo" src="assets/logo-full.png" alt="Triagon Ventures">
  <div class="gate-copy"><h2>Run the whole business from one desk.</h2><p>Catalogue and listings, stock and purchasing, sales orders, returns, finance, marketing, attendance, HR and payroll, in one place.</p></div>
  <ul class="gate-pts"><li>${icon('users')}Each person signs in with their own account and sees only what their role allows.</li><li>${icon('check')}Changes appear live on every screen, on any device.</li><li>${icon('pdf')}A daily PDF report is saved on the server every evening.</li></ul>
</div>`;
function renderGate() {
  const g = $('#gate'); if (!g) return;
  if (MODE === 'live' || KIOSK.open || SVC) { g.hidden = true; g.innerHTML = ''; return; }
  g.hidden = false;
  if (MODE === 'connecting' || !GATE.status) { g.innerHTML = `<div class="gate-wrap"><div class="gate-load"><img src="assets/mark.png" alt=""><div class="spin"></div><span>Opening Triagon ERP…</span></div></div>`; return; }
  const card = GATE.status.setup ? gateSetup() : gateLogin();
  g.innerHTML = `<div class="gate-wrap">${gateBrand()}<div class="gate-side"><div class="gate-card">${card}</div><p class="gate-foot">${esc(GATE.status.company || 'Triagon Ventures')} · Triagon ERP ${esc(GATE.status.version || '')}</p></div></div>`;
  const f = $('#gate [data-autofocus]'); if (f) setTimeout(() => f.focus(), 30);
}
function gateLogin() {
  return `<div class="gate-h"><span class="eyebrow">Sign in</span><h1>Welcome back</h1><p>Use the username and password the CEO gave you.</p></div>
  <form class="form one" id="loginForm" autocomplete="on" onsubmit="return false">
    <div class="fld"><label for="lgUser">Username</label><input class="inp" id="lgUser" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" data-autofocus></div>
    <div class="fld"><label for="lgPass">Password</label><input class="inp" id="lgPass" name="password" type="password" autocomplete="current-password"></div>
  </form>
  ${GATE.err ? `<div class="gate-err">${esc(GATE.err)}</div>` : ''}
  <button class="btn pri block" data-act="glogin"${GATE.busy ? ' disabled' : ''}>${GATE.busy ? 'Signing in…' : 'Sign in'}</button>
  <p class="gate-note">Forgot your password? Ask the CEO to set a new one in Users & permissions.</p>
  ${KIOSK_TOKEN() ? `<div class="gate-alt"><span>This device is an attendance kiosk.</span>${btn('Employee check-in / check-out', 'kiosk', { i: 'clock' })}</div>` : ''}`;
}
function gateSetup() {
  const imp = GATE.imp;
  return `<div class="gate-h"><span class="eyebrow">First-time setup</span><h1>Set up Triagon ERP</h1><p>You become the CEO account, with full access. Add your team afterwards in Users & permissions.</p></div>
  <div class="form one" id="setupForm">
    <div class="fld"><span class="lab">Start with</span><div class="seg">
      <label class="chk"><input type="radio" name="sMode" value="fresh"${!imp ? ' checked' : ''} data-ch="setupmode"> A fresh company</label>
      <label class="chk"><input type="radio" name="sMode" value="import"${imp ? ' checked' : ''} data-ch="setupmode"> My desktop ERP data</label></div></div>
    ${imp ? `<div class="banner"><span><b>${esc(GATE.impName)}</b> · ${num(Object.values(imp.counts || {}).reduce((a, b) => a + b, 0))} records${imp.company ? ' · ' + esc(imp.company) : ''}</span></div>
      <div class="fld"><label for="sWho">Which of these people are you?</label><select class="inp" id="sWho">${imp.members.map(m => `<option value="${esc(m.uid)}"${m.role === 'ceo' ? ' selected' : ''}>${esc(m.name)}${m.title ? ' · ' + esc(m.title) : ''}${m.role === 'ceo' ? ' (CEO)' : ''}</option>`).join('')}</select><div class="help">Everyone else keeps their role. You set their passwords after signing in.</div></div>`
      : `<div class="fld" id="impPick" ${GATE.mode === 'import' ? '' : 'hidden'}><label for="sFile">Desktop backup file (.json)</label><input class="inp" type="file" id="sFile" accept=".json,application/json" data-ch="setupfile"><div class="help">In the desktop app: Users & permissions → Company & audit → Save a backup copy.</div></div>
      <div class="fld"><label for="sCo">Company name</label><input class="inp" id="sCo" value="Triagon Ventures" autocomplete="organization"></div>
      <div class="form two"><div class="fld"><label for="sName">Your name</label><input class="inp" id="sName" autocomplete="name" data-autofocus></div><div class="fld"><label for="sTitle">Your title</label><input class="inp" id="sTitle" value="Founder"></div></div>`}
    <div class="form two"><div class="fld"><label for="sUser">Username</label><input class="inp" id="sUser" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="e.g. prathipan"></div><div class="fld"><label for="sPass">Password</label><input class="inp" id="sPass" type="password" autocomplete="new-password" placeholder="At least 8 characters"></div></div>
    ${!imp ? `<label class="chk"><input type="checkbox" id="sDemo"> Load demo data so I can look around first (removable in one click)</label>` : ''}
  </div>
  ${GATE.err ? `<div class="gate-err">${esc(GATE.err)}</div>` : ''}
  <button class="btn pri block" data-act="gsetup"${GATE.busy ? ' disabled' : ''}>${GATE.busy ? 'Setting up…' : imp ? 'Import and create my account' : 'Create my account'}</button>`;
}
function gateErr(m) { GATE.err = m; GATE.busy = false; renderGate(); }
async function gateLoginGo() {
  const u = (($('#lgUser') || {}).value || '').trim(), p = ($('#lgPass') || {}).value || '';
  if (!u || !p) return gateErr('Enter your username and password.');
  GATE.busy = true; GATE.err = ''; renderGate();
  try { await api('POST', '/api/login', { username: u, password: p }, { noAuthRedirect: true }); GATE.busy = false; await startSession(); }
  catch (e) { gateErr(e.userMsg || 'Sign-in failed.'); }
}
async function gateSetupGo() {
  const v = id => (($('#' + id) || {}).value || '').trim();
  const body = { username: v('sUser'), password: ($('#sPass') || {}).value || '' };
  if (GATE.imp) { body.importDocs = GATE.imp.docs; body.adminUid = v('sWho'); }
  else { body.company = v('sCo') || 'Triagon Ventures'; body.name = v('sName'); body.title = v('sTitle'); if (!body.name) return gateErr('Enter your name.'); }
  if (!/^[A-Za-z0-9._@-]{3,40}$/.test(body.username)) return gateErr('Choose a username of 3 to 40 letters or numbers, with no spaces.');
  if (body.password.length < 8) return gateErr('The password must be at least 8 characters.');
  const demo = !GATE.imp && ($('#sDemo') || {}).checked;
  GATE.busy = true; GATE.err = ''; renderGate();
  try { await api('POST', '/api/setup', body, { noAuthRedirect: true }); GATE.imp = null; GATE.status.setup = false; GATE.busy = false; await startSession(); if (demo) setTimeout(loadDemo, 400); }
  catch (e) { gateErr(e.userMsg || 'Setup failed.'); }
}
async function setupFile(input) {
  const f = input.files && input.files[0]; if (!f) return;
  try { const text = await f.text(); const j = JSON.parse(text); const peek = await api('POST', '/api/setup/peek', j, { noAuthRedirect: true }); if (!peek.members.length) return gateErr('No team members were found in that backup.'); GATE.imp = { ...peek, docs: j.docs }; GATE.impName = f.name; GATE.err = ''; renderGate(); }
  catch (e) { gateErr(e.userMsg || 'That file isn’t a Triagon ERP backup.'); }
}
function resetShell() { if (DRW.cfg) closeDrawer(); lastSide = ''; lastTop = ''; $('#side').innerHTML = ''; $('#top').innerHTML = ''; $('#view').innerHTML = ''; }
async function startSession() {
  const me = await api('GET', '/api/me', undefined, { noAuthRedirect: true }); const snap = await api('GET', '/api/snapshot');
  ME.id = me.uid; ME.username = me.username; ME.isOwner = false; ME.canEdit = true; WRITE_OK = true; WRITE_KNOWN = true;
  if (!DB) { DB = remoteDB(snap); subscribeAll(); } else DB.reset(snap);
  const m = (snap.docs['members/' + me.uid]) || {}; ME.name = m.name || ''; ME.isOwner = m.role === 'ceo';
  myLog.day = ''; myLog.entries = []; ui.viewAs = null; memoC.clear();
  try { const saved = JSON.parse(localStorage.getItem('tv-erp-ui-' + me.uid) || '{}'); ['view', 'brand', 'period', 'report'].forEach(k => { if (saved[k]) ui[k] = saved[k]; }); } catch (e) { }
  { const h = (location.hash || '').slice(1); if (MOD[h]) ui.view = h; }
  MODE = 'live'; sessionLogged = true; GATE.err = ''; lastSide = ''; lastTop = '';
  listen(); syncLogSubs(); renderGate(); bump(); setTimeout(() => { purged = false; purgeOld(); }, 4000);
  if (location.pathname === '/kiosk') openKiosk();
}
async function signOut() {
  if (MODE !== 'live') return; try { await flushLog(); } catch (e) { }
  try { await api('POST', '/api/logout', {}); } catch (e) { }
  try { SYNC.es && SYNC.es.close(); } catch (e) { }
  ME.id = null; ME.name = ''; ME.isOwner = false; ui.viewAs = null; myLog.day = ''; myLog.entries = []; memoC.clear();
  MODE = 'locked'; GATE.step = 'login'; resetShell(); renderGate(); bump();
}
document.addEventListener('keydown', e => {
  if (MODE === 'live' || KIOSK.open || e.key !== 'Enter') return; const t = e.target; if (!t || !t.closest || !t.closest('#gate')) return;
  if (t.closest('#loginForm')) { e.preventDefault(); gateLoginGo(); } else if (t.closest('#setupForm') && t.type !== 'file') { e.preventDefault(); gateSetupGo(); }
});

/* ---------- my profile ---------- */
function editMyProfile() {
  const m = myMember(); if (!m) return;
  openDrawer({
    title: 'My profile', sub: esc(roleLabel(realRole())), saveLabel: 'Save',
    tabs: [
      { l: 'Name & title', html: form([{ n: 'name', l: 'Name', req: 1, full: 1 }, { n: 'title', l: 'Job title' }, { n: 'phone', l: 'Phone', t: 'tel' }, { n: 'email', l: 'Email', t: 'email', full: 1 }], m) },
      { l: 'Sign-in', html: form([{ n: 'username', l: 'Username', mono: 1, full: 1, help: 'Letters, numbers, dot, dash or @. No spaces.' }, { n: 'current', l: 'Current password', t: 'pw', full: 1, help: 'Needed only to change your password.' }, { n: 'pw1', l: 'New password', t: 'pw' }, { n: 'pw2', l: 'Repeat new password', t: 'pw' }], { username: ME.username || '' }) },
    ],
    validate: v => { const e = []; if (v.pw1 && v.pw1.length < 8) e.push({ n: 'pw1', m: 'At least 8 characters' }); if (v.pw1 !== v.pw2) e.push({ n: 'pw2', m: 'Doesn’t match' }); if (v.pw1 && !v.current) e.push({ n: 'current', m: 'Enter your current password' }); if (v.username && !/^[A-Za-z0-9._@-]{3,40}$/.test(v.username)) e.push({ n: 'username', m: 'Use 3–40 letters or numbers, no spaces' }); return e; },
    onSave: async v => {
      const next = clean({ ...base(m), name: v.name, title: v.title, phone: v.phone, email: v.email, updatedAt: nowISO(), updatedBy: ME.id });
      const d = diffText(base(m), next); if (d) { await dbWrite('set', 'members/' + ME.id, next); addLog('update', 'users', 'Updated own profile', d); ME.name = v.name; }
      const cred = {}; if (v.username && v.username !== ME.username) cred.username = v.username; if (v.pw1) { cred.password = v.pw1; cred.current = v.current; }
      if (Object.keys(cred).length) { await api('POST', '/api/users/' + ME.id + '/credentials', cred); if (cred.username) ME.username = cred.username; }
      lastSide = ''; schedule();
    }, savedMsg: 'Profile saved',
  });
}

/* ---------- server, backups & security (CEO) ---------- */
const APPINFO = { v: null, at: 0 };
async function loadAppInfo() { if (APPINFO.busy || Date.now() - APPINFO.at < 30000) return; APPINFO.busy = true; try { APPINFO.v = await HOST.info(); APPINFO.at = Date.now(); schedule(); } catch (e) { } finally { APPINFO.busy = false; } }
const fmtBytes = b => b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB';
function dataPanel(manage) {
  if (!manage) return '';
  const i = APPINFO.v; loadAppInfo();
  const rows = i ? [['Server', `Triagon ERP ${esc(i.version)} · Node ${esc(i.node)} · ${esc(i.tz)}`], ['Database', `${num(i.records)} records · ${fmtBytes(i.dbSize)}`], ['Automatic backups', `${num(i.backups)} kept on the server · one per night, last 30 days${i.lastBackup ? ' · latest ' + esc(i.lastBackup.replace(/^triagon-erp-|\.sqlite$/g, '')) : ''}`], ['Daily PDF reports', `${num(i.reports)} saved on the server · PDF engine ${i.pdf ? 'ready' : '<span class="neg">not installed</span>'}`]] : [];
  const body = `<p style="margin:0 0 12px">All data is stored in one database on your server and saved the moment anyone makes a change. The server keeps a copy every night.</p>
  <div class="kvl">${rows.map(([l, v]) => `<div><span>${esc(l)}</span><b>${v}</b></div>`).join('')}</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">${btn('Download a full backup', 'bkexport', { i: 'dl' })}<label class="btn">${icon('undo')}Restore from a backup…<input type="file" accept=".json,application/json" data-ch="bkimport" hidden></label></div>
  <p class="muted" style="font-size:12px;margin:10px 0 0">Download a backup now and then and keep it off the server, for example in Google Drive. Restoring replaces all data; the server keeps a copy of what was there first.</p>`;
  return panel('Server, data & backups', body);
}
async function restoreBackup(input) {
  const f = input.files && input.files[0]; input.value = ''; if (!f) return;
  if (!confirm('Replace ALL data in the ERP with this backup? The server keeps a copy of the current data first.')) return;
  try { const j = JSON.parse(await f.text()); const r = await api('POST', '/api/restore', j); toast(`Restored ${num(r.count)} records.`); await resync(); }
  catch (e) { toast(e.userMsg || 'That file isn’t a Triagon ERP backup.', 'bad'); }
}
