'use strict';
/* Triagon ERP — web server: sign-in, live data sync, files, PDFs, kiosk, backups, AI (MCP) access. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Store } = require('./db');
const { Perms } = require('./perms');
const L = require('./logic');
const PDF = require('./pdf');
const MODEL = require('../shared/model.js');

const VERSION = require('../package.json').version;
const CFG = {
  port: +process.env.PORT || 8080,
  host: process.env.HOST || '0.0.0.0',
  data: path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data')),
  pub: path.join(__dirname, '..', 'client', 'public'),
  secure: process.env.COOKIE_SECURE === '1',
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
};
const DIRS = { files: path.join(CFG.data, 'files'), reports: path.join(CFG.data, 'reports'), backups: path.join(CFG.data, 'backups') };
Object.values(DIRS).forEach(d => fs.mkdirSync(d, { recursive: true }));
const store = new Store(path.join(CFG.data, 'triagon-erp.sqlite'));
const perms = new Perms(store);
const SVC_TOKEN = crypto.randomBytes(32).toString('base64url');
const LOCAL_BASE = `http://127.0.0.1:${CFG.port}`;

/* ---------------- helpers ---------------- */
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const rid = (n = 12) => crypto.randomBytes(n).toString('base64url').replace(/[-_]/g, '').slice(0, n) || crypto.randomBytes(8).toString('hex');
const nowISO = () => new Date().toISOString();
class HttpErr extends Error { constructor(status, msg, extra) { super(msg); this.status = status; this.extra = extra; } }
function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body); const data = isBuf || typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': isBuf ? 'application/octet-stream' : typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
function readBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = []; let n = 0;
    req.on('data', c => { n += c.length; if (n > limit) { reject(new HttpErr(413, 'That upload is too large.')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks))); req.on('error', reject);
  });
}
async function json(req, limit) { const b = await readBody(req, limit); if (!b.length) return {}; try { return JSON.parse(b.toString('utf8')); } catch (e) { throw new HttpErr(400, 'Bad JSON'); } }
function cookies(req) { const o = {}; String(req.headers.cookie || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
const isHttps = req => CFG.secure || req.headers['x-forwarded-proto'] === 'https';
const ipOf = req => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
const isLocal = req => { const a = req.socket.remoteAddress || ''; return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1'; };
const todayStr = () => L.today();

/* ---------------- passwords, PINs, sessions ---------------- */
function hashPassword(pw) { const salt = crypto.randomBytes(16).toString('hex'); const h = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex'); return `scrypt$${salt}$${h}`; }
function verifyPassword(pw, stored) { if (!stored || !stored.startsWith('scrypt$')) return false; const [, salt, h] = stored.split('$'); const x = crypto.scryptSync(String(pw), salt, 64, { N: 16384, r: 8, p: 1 }); const y = Buffer.from(h, 'hex'); return y.length === x.length && crypto.timingSafeEqual(x, y); }
function hashPin(pin, salt) { salt = salt || crypto.randomBytes(16).toString('hex'); return { salt, hash: crypto.pbkdf2Sync(String(pin), salt, 120000, 32, 'sha256').toString('hex') }; }
function checkPin(rec, pin) { if (!rec || !rec.pin || !rec.pin.hash || !rec.pin.salt) return false; const a = Buffer.from(hashPin(pin, rec.pin.salt).hash, 'hex'), b = Buffer.from(String(rec.pin.hash), 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); }
const SESSION_DAYS = 30;
function newSession(uid, req, kind = 'user') {
  const token = crypto.randomBytes(32).toString('base64url'); const exp = Date.now() + SESSION_DAYS * 864e5;
  store.db.prepare('INSERT INTO sessions(id, uid, kind, created, expires, ua, ip, seen) VALUES(?,?,?,?,?,?,?,?)').run(sha(token), uid, kind, nowISO(), exp, String(req.headers['user-agent'] || '').slice(0, 200), ipOf(req), Date.now());
  return token;
}
const sessCookie = (req, token, maxAge) => `tv_sess=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${isHttps(req) ? '; Secure' : ''}`;
function auth(req) {
  if (req._auth !== undefined) return req._auth;
  let a = null; const c = cookies(req); const h = String(req.headers.authorization || '');
  if (c.tv_svc && c.tv_svc === SVC_TOKEN && isLocal(req)) a = { uid: 'system', kind: 'service' };
  else if (h.startsWith('Bearer ')) a = keyAuth(h.slice(7).trim());
  else if (c.tv_sess) {
    const s = store.db.prepare('SELECT id, uid, expires, seen FROM sessions WHERE id = ?').get(sha(c.tv_sess));
    if (s && s.expires > Date.now() && perms.active(s.uid)) {
      a = { uid: s.uid, kind: 'user', sid: s.id };
      if (Date.now() - s.seen > 10 * 60e3) store.db.prepare('UPDATE sessions SET seen = ?, expires = ? WHERE id = ?').run(Date.now(), Date.now() + SESSION_DAYS * 864e5, s.id);
    }
  }
  req._auth = a; return a;
}
function keyAuth(token) {
  if (!/^tvk_[A-Za-z0-9_-]{20,}$/.test(token)) return null;
  const k = store.db.prepare('SELECT * FROM apikeys WHERE hash = ? AND revoked IS NULL').get(sha(token));
  if (!k || !perms.active(k.uid)) return null;
  store.db.prepare('UPDATE apikeys SET lastUsed = ?, uses = uses + 1 WHERE id = ?').run(nowISO(), k.id);
  return { uid: k.uid, kind: 'key', keyId: k.id, keyName: k.name, readOnly: k.access !== 'write' };
}
function need(req, opts = {}) {
  const a = auth(req); if (!a) throw new HttpErr(401, 'Please sign in.');
  if (a.kind === 'user' && req.method !== 'GET' && req.headers['x-tv'] !== '1') throw new HttpErr(403, 'Missing request header.');
  if (opts.ceo && !perms.isCEO(a.uid)) throw new HttpErr(403, 'Only the CEO can do this.');
  if (opts.view && !MODEL.canView(perms.of(a.uid), opts.view)) throw new HttpErr(403, 'Your role can’t open this.');
  if (opts.edit && !MODEL.canEdit(perms.of(a.uid), opts.edit)) throw new HttpErr(403, 'Your role can’t change this.');
  return a;
}
const LIMIT = new Map();
function lockCheck(key) { const r = LIMIT.get(key); if (r && r.until > Date.now()) throw new HttpErr(429, `Too many wrong attempts. Try again in ${Math.ceil((r.until - Date.now()) / 1000)} seconds.`); }
function lockFail(key) { const r = LIMIT.get(key) || { n: 0, until: 0 }; r.n++; if (r.n >= 5) r.until = Date.now() + Math.min(15 * 60e3, 30e3 * 2 ** (r.n - 5)); LIMIT.set(key, r); if (LIMIT.size > 5000) LIMIT.clear(); }

/* ---------------- writes ---------------- */
const PATH_RE = /^[A-Za-z][A-Za-z0-9]*\/[A-Za-z0-9_\-]{1,140}(\/[A-Za-z]+\/[A-Za-z0-9_\-]{1,140})?$/;
function deepMerge(a, b) { const o = { ...a }; for (const k in b) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) ? deepMerge(a[k], b[k]) : b[k]; return o; }
function protect(pathStr, next, prev) {
  const col = pathStr.split('/')[0]; if (!next) return next; const o = { ...next };
  if (col === 'members') { delete o.password; delete o.pwhash; if (prev && prev.pin) o.pin = prev.pin; else delete o.pin; delete o.hasPin; }
  if (col === 'employees') { delete o.hasPin; if (o.pin === undefined && prev && prev.pin) o.pin = prev.pin; if (o.pin && !(typeof o.pin.salt === 'string' && typeof o.pin.hash === 'string')) delete o.pin; if (o.pin === null) delete o.pin; }
  return o;
}
// ops from a browser or an AI agent → validated, merged, permission-checked, applied atomically
function writeOps(uid, ops, origin = {}) {
  if (!Array.isArray(ops) || !ops.length) throw new HttpErr(400, 'Nothing to save.');
  if (ops.length > 500) throw new HttpErr(400, 'Too many changes in one go.');
  const resolved = []; const pending = new Map();
  for (const o of ops) {
    const p = String(o.path || ''); if (!PATH_RE.test(p)) throw new HttpErr(400, 'Bad record path: ' + p);
    const prev = pending.has(p) ? pending.get(p) : store.get(p);
    let next = null;
    if (o.op === 'set') { if (!o.data || typeof o.data !== 'object' || Array.isArray(o.data)) throw new HttpErr(400, 'Bad record data'); next = protect(p, o.data, prev); }
    else if (o.op === 'update') { if (!prev) throw new HttpErr(404, 'That record no longer exists.', { code: 'not_found', path: p }); next = protect(p, deepMerge(prev, o.data || {}), prev); }
    else if (o.op === 'delete') { if (!prev) continue; }
    else throw new HttpErr(400, 'Bad operation');
    if (next && JSON.stringify(next).length > 1.5e6) throw new HttpErr(413, 'That record is too large.');
    const why = perms.canWrite(uid, o.op === 'delete' ? 'delete' : 'set', p, next, prev);
    if (why) throw new HttpErr(403, why, { code: 'permission_denied', path: p });
    resolved.push(o.op === 'delete' ? { op: 'delete', path: p } : { op: 'set', path: p, data: next });
    pending.set(p, next);
  }
  const rev = store.apply(resolved, { uid, ...origin });
  return { rev, docs: Object.fromEntries(resolved.map(r => [r.path, { rev: store.revs.get(r.path), data: r.op === 'delete' ? null : perms.redact(r.path, store.get(r.path)) }])) };
}
// activity log entries written by the server (kiosk, AI agents, automatic jobs)
function addLog(uid, e) {
  const day = todayStr(); const p = `logs/${uid}/days/${day}`; const cur = store.get(p);
  const entries = ((cur && cur.entries) || []).concat([{ t: nowISO(), u: uid, ...e }]).slice(-900);
  store.apply([{ op: 'set', path: p, data: { date: day, uid, entries } }], { system: true });
}

/* ---------------- live updates (Server-Sent Events) ---------------- */
const streams = new Set();
store.listeners.add((changes, origin) => {
  const permChange = changes.some(c => c.path === 'settings/roles' || c.path.startsWith('members/'));
  for (const s of streams) {
    if (permChange && (origin.reset || changes.some(c => c.path === 'settings/roles' || c.path === 'members/' + s.uid))) { s.res.write(`event: resync\ndata: {}\n\n`); continue; }
    if (origin.reset) { s.res.write(`event: resync\ndata: {}\n\n`); continue; }
    const out = changes.filter(c => perms.canRead(s.uid, c.path)).map(c => ({ rev: c.rev, path: c.path, data: c.data ? perms.redact(c.path, c.data) : null }));
    if (out.length) s.res.write(`id: ${store.rev}\nevent: changes\ndata: ${JSON.stringify(out)}\n\n`);
  }
});
setInterval(() => { for (const s of streams) { if (!perms.active(s.uid) && s.uid !== 'system') { s.res.write('event: signout\ndata: {}\n\n'); s.res.end(); streams.delete(s); } else s.res.write(': ping\n\n'); } }, 25000).unref();
function snapshot(uid) {
  const docs = {}, revs = {};
  for (const [p, d] of store.entries()) if (perms.canRead(uid, p)) { docs[p] = perms.redact(p, d); revs[p] = store.revs.get(p) || 0; }
  return { rev: store.rev, docs, revs };
}

/* ---------------- kiosk ---------------- */
function kioskAuth(req) {
  const t = String(req.headers['x-kiosk'] || ''); if (t) { const k = store.db.prepare('SELECT * FROM kiosks WHERE hash = ? AND revoked IS NULL').get(sha(t)); if (k) { store.db.prepare('UPDATE kiosks SET lastUsed = ? WHERE id = ?').run(nowISO(), k.id); return { kiosk: k }; } }
  const a = auth(req); if (a && MODEL.canView(perms.of(a.uid), 'attendance')) return { uid: a.uid };
  throw new HttpErr(401, 'This device isn’t set up as a check-in kiosk.');
}
function kioskState() {
  const s = L.attSettings(store); const t = todayStr();
  const emps = store.list('employees').map(x => ({ id: x.id, ...x.data })).filter(e => e.status !== 'inactive' && (!e.joinDate || e.joinDate <= t)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return {
    company: (store.get('settings/company') || {}).name || 'Triagon Ventures', requirePin: s.requirePin !== false, now: nowISO(), today: t,
    holidays: (s.holidays || []).filter(h => h.date >= t).sort((a, b) => a.date < b.date ? -1 : 1).slice(0, 6),
    employees: emps.map(e => { const a = L.attToday(store, e); return { id: e.id, name: e.name, designation: e.designation || '', code: e.code || '', hasPin: !!(e.pin && e.pin.hash), open: a.open ? a.open.in : null, lastOut: a.lastOut, mins: Math.round(a.mins), mark: a.mark || null, first: a.first }; }),
  };
}
const kioskFails = new Map();
function kioskPinOK(e, pin) {
  const s = L.attSettings(store); const f = kioskFails.get(e.id) || { n: 0, until: 0 };
  if (f.until > Date.now()) throw new HttpErr(429, 'Too many wrong PINs. Wait a moment and try again.');
  if (!(e.pin && e.pin.hash)) { if (s.requirePin !== false) throw new HttpErr(400, 'No PIN is set for you yet. Ask a manager to set one.'); return true; }
  if (!checkPin(e, String(pin || ''))) { f.n++; if (f.n >= 5) { f.until = Date.now() + 30000; f.n = 0; } kioskFails.set(e.id, f); throw new HttpErr(403, 'That PIN isn’t right.'); }
  kioskFails.delete(e.id); return true;
}
function punch(e, kind, update, via, byUid) {
  const d = todayStr(); const p = `attendance/${e.id}_${d}`; const rec = store.get(p); const sess = ((rec && rec.sessions) || []).map(x => ({ ...x })); const t = nowISO();
  const open = sess.find(x => !x.out);
  if (kind === 'in') { if (open) throw new HttpErr(409, `${e.name} is already checked in.`); sess.push({ in: t, inVia: via, inBy: byUid || null }); }
  else { if (!open) throw new HttpErr(409, `${e.name} isn’t checked in.`); open.out = t; open.outVia = via; open.outBy = byUid || null; }
  const upd = String(update || '').trim().slice(0, 1200); const updateText = kind === 'out' && upd ? [rec && rec.update, upd].filter(Boolean).join('\n') : ((rec && rec.update) || '');
  store.apply([{ op: 'set', path: p, data: { ...(rec || {}), employeeId: e.id, date: d, sessions: sess, update: updateText, createdAt: (rec && rec.createdAt) || t, updatedAt: t, updatedBy: byUid || 'kiosk' } }], { system: true });
  const sh = L.empShift(store, e); const lateMin = kind === 'in' && sess.length === 1 ? Math.max(0, L.minsOf(t) - L.hm(sh.start)) : 0;
  const mins = L.sum(sess, x => Math.max(0, Date.parse(x.out || t) - Date.parse(x.in)) / 6e4);
  const tm = new Date(t).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  addLog(byUid || 'kiosk', { a: kind === 'in' ? 'checkin' : 'checkout', m: 'attendance', s: `${e.name} checked ${kind}`, d: `${tm}${lateMin > sh.grace ? ` · late by ${lateMin} min` : ''}${kind === 'out' ? ` · ${Math.floor(mins / 60)}h ${String(Math.round(mins % 60)).padStart(2, '0')}m today` : ''} · ${via === 'kiosk' ? 'on the kiosk' : 'from the ERP'}${upd ? ' · ' + upd.slice(0, 120) : ''}` });
  return { t, kind, lateMin, late: lateMin > sh.grace, mins: Math.round(mins), name: e.name };
}

/* ---------------- daily reports & backups ---------------- */
const reportFile = d => path.join(DIRS.reports, d.slice(0, 4), d.slice(0, 7), `Triagon-Daily-Report-${d}.pdf`);
function listReports() {
  const out = []; const walk = (dir, depth) => { let it = []; try { it = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; } for (const x of it) { const p = path.join(dir, x.name); if (x.isDirectory() && depth < 3) walk(p, depth + 1); else if (/^Triagon-Daily-Report-\d{4}-\d{2}-\d{2}\.pdf$/.test(x.name)) { const st = fs.statSync(p); out.push({ name: x.name, date: x.name.slice(21, 31), size: st.size, mtime: st.mtime.toISOString() }); } } };
  walk(DIRS.reports, 0); return out.sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 400);
}
function dayHasActivity(d) {
  for (const [p, x] of store.entries()) { const c = p.split('/')[0]; if (['sales', 'expenses', 'attendance', 'updates', 'moves', 'orders'].includes(c) && x && x.date === d && !x.recurringId) return true; }
  return false;
}
let genBusy = false;
async function generateDaily(d, why) {
  if (genBusy) return null; genBusy = true;
  try {
    const url = `${LOCAL_BASE}/?svc=report&date=${d}`;
    const pdf = await PDF.renderFromApp(url, { name: 'tv_svc', value: SVC_TOKEN, url: LOCAL_BASE }, `window.__TV_REPORT(${JSON.stringify(d)})`, { baseURL: LOCAL_BASE, footer: 'Triagon Ventures · Daily report' });
    if (!pdf) return null; const f = reportFile(d); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, pdf);
    console.log(`[report] ${d} saved (${why})`); return f;
  } catch (e) { console.error('[report] failed', d, e.message); return null; }
  finally { genBusy = false; }
}
const repCfg = () => Object.assign({ auto: true, time: '19:00', catchUp: true }, store.get('settings/reports') || {});
let lastBackupDay = '';
async function tick() {
  if (!store.list('members').length) return;
  const n = new Date(); const hhmm = String(n.getHours()).padStart(2, '0') + ':' + String(n.getMinutes()).padStart(2, '0'); const d = todayStr(); const c = repCfg();
  if (c.auto && hhmm >= c.time && !fs.existsSync(reportFile(d)) && PDF.available()) await generateDaily(d, 'scheduled');
  if (hhmm >= '02:15' && lastBackupDay !== d) { lastBackupDay = d; nightlyBackup(); }
}
function nightlyBackup() {
  try {
    const f = path.join(DIRS.backups, `triagon-erp-${todayStr()}.sqlite`); if (!fs.existsSync(f)) store.backup(f);
    const all = fs.readdirSync(DIRS.backups).filter(x => /^triagon-erp-\d{4}-\d{2}-\d{2}\.sqlite$/.test(x)).sort();
    while (all.length > 30) fs.unlinkSync(path.join(DIRS.backups, all.shift()));
  } catch (e) { console.error('[backup]', e.message); }
}
async function catchUp() {
  const c = repCfg(); if (!c.auto || !c.catchUp || !PDF.available() || !store.list('members').length) return;
  for (let i = 1; i <= 7; i++) { const d = L.addDays(todayStr(), -i); if (!fs.existsSync(reportFile(d)) && dayHasActivity(d)) await generateDaily(d, 'catch-up'); }
}

/* ---------------- static files ---------------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]); if (rel === '/' || rel === '/kiosk' || !path.extname(rel)) rel = '/index.html';
  const f = path.join(CFG.pub, path.normalize(rel).replace(/^([/\\])+/, ''));
  if (!f.startsWith(CFG.pub) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return send(res, 404, 'Not found');
  const ext = path.extname(f); const long = /\.(woff2|png|ico|svg)$/.test(f) || /[?&]v=/.test(urlPath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' || f.endsWith('sw.js') ? 'no-cache' : long ? 'public, max-age=31536000, immutable' : 'public, max-age=300', 'X-Content-Type-Options': 'nosniff', ...(ext === '.html' ? { 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin' } : {}) });
  fs.createReadStream(f).pipe(res);
}

/* ---------------- routes ---------------- */
const MCP = require('./mcp')({ store, perms, writeOps, addLog, logic: L, HttpErr, kioskState, listReports, VERSION });
const routes = [];
const on = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

on('GET', '/api/status', (req, res) => {
  const a = auth(req); const co = store.get('settings/company') || {};
  send(res, 200, { setup: !store.list('members').some(m => m.data.role === 'ceo' && store.user(m.id)), version: VERSION, company: co.name || 'Triagon Ventures', signedIn: !!(a && a.kind === 'user'), pdf: PDF.available() });
});
on('POST', '/api/setup', async (req, res) => {
  if (store.list('members').some(m => m.data.role === 'ceo' && store.user(m.id))) throw new HttpErr(409, 'This ERP is already set up. Sign in instead.');
  const b = await json(req, 60 * 1024 * 1024);
  const username = String(b.username || '').trim(); const pw = String(b.password || '');
  if (!/^[A-Za-z0-9._@-]{3,40}$/.test(username)) throw new HttpErr(400, 'Choose a username of 3 to 40 letters or numbers (no spaces).');
  if (pw.length < 8) throw new HttpErr(400, 'The password must be at least 8 characters.');
  let uid;
  if (b.importDocs && typeof b.importDocs === 'object') {
    const docs = b.importDocs.docs && typeof b.importDocs.docs === 'object' ? b.importDocs.docs : b.importDocs;
    const clean = {}; for (const p in docs) if (PATH_RE.test(p) && docs[p] && typeof docs[p] === 'object') clean[p] = docs[p];
    delete clean['settings/security'];
    store.replaceAll(clean);
    uid = b.adminUid && store.get('members/' + b.adminUid) ? b.adminUid : null;
  }
  const t = nowISO();
  if (!uid) { uid = 'u-' + rid(10); store.apply([{ op: 'set', path: 'members/' + uid, data: { name: String(b.name || 'Admin').slice(0, 80), title: String(b.title || 'Founder').slice(0, 80), role: 'ceo', status: 'active', brands: [], addedAt: t, addedBy: uid } }], { system: true }); }
  else { const m = store.get('members/' + uid); store.apply([{ op: 'set', path: 'members/' + uid, data: { ...m, role: 'ceo', status: 'active', ...(b.name ? { name: String(b.name).slice(0, 80) } : {}) } }], { system: true }); }
  if (b.company && !b.importDocs) store.apply([{ op: 'set', path: 'settings/company', data: { ...(store.get('settings/company') || {}), name: String(b.company).slice(0, 120), updatedAt: t, updatedBy: uid } }], { system: true });
  if (store.userByName(username) && store.userByName(username).uid !== uid) throw new HttpErr(409, 'That username is taken.');
  store.setUser(uid, { username, pwhash: hashPassword(pw) });
  addLog(uid, { a: 'session', m: 'users', s: b.importDocs ? 'Set up the web ERP from a desktop backup' : 'Set up the web ERP' });
  const tok = newSession(uid, req); send(res, 200, { ok: true, uid }, { 'Set-Cookie': sessCookie(req, tok, SESSION_DAYS * 86400) });
});
on('POST', '/api/setup/peek', async (req, res) => {
  // reads a desktop backup and lists the people in it, so the person setting up can say which one they are
  if (store.list('members').some(m => m.data.role === 'ceo' && store.user(m.id))) throw new HttpErr(409, 'Already set up.');
  const b = await json(req, 60 * 1024 * 1024); const docs = b.docs && typeof b.docs === 'object' ? b.docs : null;
  if (!docs) throw new HttpErr(400, 'That file isn’t a Triagon ERP backup.');
  const members = Object.entries(docs).filter(([p, d]) => /^members\/[^/]+$/.test(p) && d && d.status !== 'removed').map(([p, d]) => ({ uid: p.slice(8), name: d.name, role: d.role, title: d.title || '' }));
  const counts = {}; for (const p in docs) { const c = p.split('/')[0]; counts[c] = (counts[c] || 0) + 1; }
  send(res, 200, { members, counts, company: (docs['settings/company'] || {}).name || '' });
});
on('POST', '/api/login', async (req, res) => {
  const b = await json(req); const u = String(b.username || '').trim().toLowerCase(); const key = ipOf(req) + '|' + u;
  lockCheck(key);
  const row = store.userByName(u);
  if (!row || !row.pwhash || !verifyPassword(b.password, row.pwhash)) { lockFail(key); throw new HttpErr(401, 'That username and password don’t match.'); }
  const m = store.get('members/' + row.uid);
  if (!m || m.status === 'removed') throw new HttpErr(403, 'This account was removed.');
  if (m.status === 'suspended') throw new HttpErr(403, 'Your access is paused. Ask the CEO to reactivate it.');
  LIMIT.delete(key);
  const tok = newSession(row.uid, req);
  store.apply([{ op: 'set', path: 'members/' + row.uid, data: { ...m, lastSignIn: nowISO() } }], { system: true });
  addLog(row.uid, { a: 'session', m: 'dashboard', s: 'Signed in', d: String(req.headers['user-agent'] || '').replace(/^.*\) /, '').slice(0, 80) });
  send(res, 200, { ok: true, uid: row.uid }, { 'Set-Cookie': sessCookie(req, tok, SESSION_DAYS * 86400) });
});
on('POST', '/api/logout', (req, res) => {
  const a = auth(req); if (a && a.sid) { store.db.prepare('DELETE FROM sessions WHERE id = ?').run(a.sid); addLog(a.uid, { a: 'session', m: 'dashboard', s: 'Signed out' }); }
  send(res, 200, { ok: true }, { 'Set-Cookie': sessCookie(req, '', 0) });
});
on('GET', '/api/me', (req, res) => { const a = need(req); const u = store.user(a.uid); send(res, 200, { uid: a.uid, username: u ? u.username : null, kind: a.kind }); });
on('GET', '/api/snapshot', (req, res) => { const a = need(req); send(res, 200, snapshot(a.uid)); });
on('GET', '/api/events', (req, res) => {
  const a = need(req);
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ rev: store.rev })}\n\n`);
  const s = { res, uid: a.uid }; streams.add(s);
  const since = Number(new URL(req.url, 'http://x').searchParams.get('rev') || 0);
  if (since) { const ch = store.since(since); if (ch === null) res.write('event: resync\ndata: {}\n\n'); else { const out = ch.filter(c => perms.canRead(a.uid, c.path)).map(c => ({ rev: c.rev, path: c.path, data: c.data ? perms.redact(c.path, c.data) : null })); if (out.length) res.write(`event: changes\ndata: ${JSON.stringify(out)}\n\n`); } }
  req.on('close', () => streams.delete(s));
});
on('POST', '/api/write', async (req, res) => { const a = need(req); if (a.readOnly) throw new HttpErr(403, 'This key is read-only.'); const b = await json(req, 8 * 1024 * 1024); send(res, 200, writeOps(a.uid, b.ops, { via: a.kind })); });
on('POST', '/api/hash', async (req, res) => { need(req); const b = await json(req); if (!/^\d{4,8}$/.test(String(b.pin || ''))) throw new HttpErr(400, 'A PIN is 4 to 8 digits.'); send(res, 200, hashPin(b.pin)); });
on('POST', '/api/account/password', async (req, res) => {
  const a = need(req); const b = await json(req); const u = store.user(a.uid);
  if (!u || !verifyPassword(b.current, u.pwhash)) throw new HttpErr(403, 'Your current password isn’t right.');
  if (String(b.password || '').length < 8) throw new HttpErr(400, 'The new password must be at least 8 characters.');
  store.setUser(a.uid, { pwhash: hashPassword(b.password) }); store.dropSessions(a.uid, a.sid); addLog(a.uid, { a: 'permission', m: 'users', s: 'Changed own password' }); send(res, 200, { ok: true });
});
on('GET', '/api/users', (req, res) => { need(req, { ceo: true }); send(res, 200, store.users().map(u => ({ uid: u.uid, username: u.username, hasPassword: !!u.has }))); });
on('POST', '/api/users/:uid/credentials', async (req, res, p) => {
  const a = need(req); const b = await json(req); const self = p.uid === a.uid;
  if (!self && !perms.isCEO(a.uid)) throw new HttpErr(403, 'Only the CEO can change other people’s sign-in.');
  if (!store.get('members/' + p.uid)) throw new HttpErr(404, 'No such team member.');
  const f = {};
  if (b.username !== undefined) { const un = String(b.username).trim(); if (!/^[A-Za-z0-9._@-]{3,40}$/.test(un)) throw new HttpErr(400, 'Usernames are 3 to 40 letters or numbers, with no spaces.'); const ex = store.userByName(un); if (ex && ex.uid !== p.uid) throw new HttpErr(409, 'That username is taken.'); f.username = un; }
  if (b.password) { if (self) { const u = store.user(a.uid); if (!u || !verifyPassword(b.current, u.pwhash)) throw new HttpErr(403, 'Your current password isn’t right.'); } if (String(b.password).length < 8) throw new HttpErr(400, 'Passwords must be at least 8 characters.'); f.pwhash = hashPassword(b.password); }
  store.setUser(p.uid, f); if (f.pwhash) store.dropSessions(p.uid, self ? a.sid : '');
  addLog(a.uid, { a: 'permission', m: 'users', s: `${self ? 'Changed own' : 'Changed ' + (store.get('members/' + p.uid).name || '') + '’s'} sign-in`, d: [f.username ? 'username ' + f.username : '', f.pwhash ? 'new password' : ''].filter(Boolean).join(', ') });
  send(res, 200, { ok: true });
});
on('POST', '/api/users/:uid/signout', (req, res, p) => { need(req, { ceo: true }); store.dropSessions(p.uid, ''); send(res, 200, { ok: true }); });
// kiosk
on('GET', '/api/kiosk/devices', (req, res) => { need(req, { edit: 'attendance' }); send(res, 200, store.db.prepare('SELECT id, name, created, createdBy, lastUsed FROM kiosks WHERE revoked IS NULL ORDER BY created DESC').all()); });
on('POST', '/api/kiosk/devices', async (req, res) => { const a = need(req, { edit: 'attendance' }); const b = await json(req); const token = 'tvq_' + crypto.randomBytes(24).toString('base64url'); const id = rid(10); store.db.prepare('INSERT INTO kiosks(id, name, hash, created, createdBy) VALUES(?,?,?,?,?)').run(id, String(b.name || 'Kiosk').slice(0, 60), sha(token), nowISO(), a.uid); addLog(a.uid, { a: 'settings', m: 'attendance', s: 'Set up a check-in kiosk device', d: String(b.name || '') }); send(res, 200, { id, token }); });
on('DELETE', '/api/kiosk/devices/:id', (req, res, p) => { const a = need(req, { edit: 'attendance' }); store.db.prepare('UPDATE kiosks SET revoked = ? WHERE id = ?').run(nowISO(), p.id); addLog(a.uid, { a: 'settings', m: 'attendance', s: 'Removed a check-in kiosk device' }); send(res, 200, { ok: true }); });
on('GET', '/api/kiosk/state', (req, res) => { kioskAuth(req); send(res, 200, kioskState()); });
on('POST', '/api/kiosk/verify', async (req, res) => { kioskAuth(req); const b = await json(req); const e = store.get('employees/' + b.employeeId); if (!e || e.status === 'inactive') throw new HttpErr(404, 'Employee not found.'); kioskPinOK({ id: b.employeeId, ...e }, b.pin); send(res, 200, { ok: true }); });
on('POST', '/api/kiosk/punch', async (req, res) => {
  const k = kioskAuth(req); const b = await json(req); const e = store.get('employees/' + b.employeeId);
  if (!e || e.status === 'inactive') throw new HttpErr(404, 'Employee not found.');
  kioskPinOK({ id: b.employeeId, ...e }, b.pin);
  send(res, 200, punch({ id: b.employeeId, ...e }, b.kind === 'out' ? 'out' : 'in', b.update, 'kiosk', k.uid || null));
});
// files
on('POST', '/api/files', async (req, res) => {
  const a = need(req); if (a.readOnly) throw new HttpErr(403, 'This key is read-only.');
  const q = new URL(req.url, 'http://x').searchParams; const buf = await readBody(req, 25 * 1024 * 1024);
  if (!buf.length) throw new HttpErr(400, 'The file is empty.');
  const id = 'f' + rid(14); fs.writeFileSync(path.join(DIRS.files, id), buf);
  const doc = { name: String(q.get('name') || 'file').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 140), type: String(req.headers['content-type'] || 'application/octet-stream').slice(0, 100), size: buf.length, by: a.uid, at: nowISO(), col: q.get('col') || null, docId: q.get('docId') || null, note: q.get('note') || '' };
  const r = writeOps(a.uid, [{ op: 'set', path: 'files/' + id, data: doc }]); send(res, 200, { id, ...doc, rev: r.rev });
});
on('GET', '/api/files/:id', (req, res, p) => {
  const a = need(req); const d = store.get('files/' + p.id); const f = path.join(DIRS.files, p.id.replace(/[^A-Za-z0-9]/g, ''));
  if (!d || !fs.existsSync(f)) throw new HttpErr(404, 'File not found.'); if (!perms.canRead(a.uid, 'files/' + p.id)) throw new HttpErr(403, 'You can’t open this file.');
  const dl = new URL(req.url, 'http://x').searchParams.get('dl');
  res.writeHead(200, { 'Content-Type': /^[\w.+-]+\/[\w.+-]+$/.test(d.type) ? d.type : 'application/octet-stream', 'Content-Length': fs.statSync(f).size, 'Content-Disposition': `${dl ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(d.name)}`, 'Cache-Control': 'private, max-age=3600', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; plugin-types application/pdf", 'X-Frame-Options': 'SAMEORIGIN' });
  fs.createReadStream(f).pipe(res);
});
// PDFs
on('POST', '/api/pdf', async (req, res) => {
  const a = need(req); const b = await json(req, 16 * 1024 * 1024);
  if (!PDF.available()) throw new HttpErr(503, 'The PDF engine isn’t installed on this server.');
  const pdf = await PDF.render(String(b.html || ''), { baseURL: LOCAL_BASE, landscape: !!b.landscape, footer: String(b.footer || '').replace(/[<>]/g, '').slice(0, 120) });
  if (b.saveDaily && /^\d{4}-\d{2}-\d{2}$/.test(b.saveDaily) && MODEL.canView(perms.of(a.uid), 'daily')) { const f = reportFile(b.saveDaily); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, pdf); }
  const name = String(b.filename || 'document.pdf').replace(/[^\w.\- ]+/g, '_');
  res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' }); res.end(pdf);
});
on('GET', '/api/reports', (req, res) => { need(req, { view: 'daily' }); send(res, 200, listReports()); });
on('GET', '/api/reports/:date', (req, res, p) => {
  need(req, { view: 'daily' }); const d = String(p.date).replace(/\.pdf$/, ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new HttpErr(400, 'Bad date'); const f = reportFile(d);
  if (!fs.existsSync(f)) throw new HttpErr(404, 'No report saved for that day yet.');
  res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="Triagon-Daily-Report-${d}.pdf"`, 'Cache-Control': 'private, no-cache' }); fs.createReadStream(f).pipe(res);
});
on('POST', '/api/reports/generate', async (req, res) => { const a = need(req, { view: 'daily' }); const b = await json(req); const d = /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : todayStr(); const f = await generateDaily(d, 'on request'); if (!f) throw new HttpErr(500, 'The report couldn’t be made. Try again.'); addLog(a.uid, { a: 'export', m: 'daily', s: `Saved the daily report for ${d} on the server` }); send(res, 200, { ok: true, date: d }); });
// backups & server info
on('GET', '/api/backup', (req, res) => {
  const a = need(req, { ceo: true }); const docs = {}; for (const [p, d] of store.entries()) docs[p] = d;
  addLog(a.uid, { a: 'export', m: 'users', s: 'Downloaded a full backup' });
  res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="Triagon-ERP-backup-${todayStr()}.json"`, 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({ app: 'Triagon ERP', schema: 2, savedAt: nowISO(), docs }));
});
on('POST', '/api/restore', async (req, res) => {
  const a = need(req, { ceo: true }); const b = await json(req, 80 * 1024 * 1024); const docs = b && b.docs;
  if (!docs || typeof docs !== 'object') throw new HttpErr(400, 'That file isn’t a Triagon ERP backup.');
  nightlyBackup(); try { store.backup(path.join(DIRS.backups, `before-restore-${Date.now()}.sqlite`)); } catch (e) { }
  const clean = {}; for (const p in docs) if (PATH_RE.test(p) && docs[p] && typeof docs[p] === 'object') clean[p] = docs[p];
  delete clean['settings/security'];
  const me = store.get('members/' + a.uid); if (!clean['members/' + a.uid]) clean['members/' + a.uid] = { ...me, role: 'ceo', status: 'active' }; else clean['members/' + a.uid] = { ...clean['members/' + a.uid], role: 'ceo', status: 'active' };
  store.replaceAll(clean); addLog(a.uid, { a: 'settings', m: 'users', s: 'Restored all data from a backup file', d: Object.keys(clean).length + ' records' });
  send(res, 200, { ok: true, count: Object.keys(clean).length });
});
on('GET', '/api/server', (req, res) => {
  need(req, { ceo: true }); let dbSize = 0; try { dbSize = fs.statSync(store.file).size; } catch (e) { }
  const backups = fs.readdirSync(DIRS.backups).filter(x => x.endsWith('.sqlite')).sort();
  send(res, 200, { version: VERSION, dataDir: CFG.data, dbSize, records: store.cache.size, rev: store.rev, backups: backups.length, lastBackup: backups[backups.length - 1] || null, reports: listReports().length, uptime: process.uptime(), pdf: PDF.available(), publicUrl: CFG.publicUrl, node: process.version, tz: Intl.DateTimeFormat().resolvedOptions().timeZone });
});
// AI / API keys
on('GET', '/api/keys', (req, res) => { need(req, { ceo: true }); send(res, 200, store.db.prepare('SELECT id, name, uid, access, prefix, created, createdBy, lastUsed, uses FROM apikeys WHERE revoked IS NULL ORDER BY created DESC').all()); });
on('POST', '/api/keys', async (req, res) => {
  const a = need(req, { ceo: true }); const b = await json(req); const uid = b.uid || a.uid;
  if (!perms.active(uid)) throw new HttpErr(400, 'Choose an active team member for the key to act as.');
  const token = 'tvk_' + crypto.randomBytes(30).toString('base64url'); const id = rid(10);
  store.db.prepare('INSERT INTO apikeys(id, name, uid, access, hash, prefix, created, createdBy) VALUES(?,?,?,?,?,?,?,?)').run(id, String(b.name || 'AI agent').slice(0, 60), uid, b.access === 'write' ? 'write' : 'read', sha(token), token.slice(0, 10), nowISO(), a.uid);
  addLog(a.uid, { a: 'permission', m: 'users', s: `Created AI / API key “${String(b.name || 'AI agent').slice(0, 60)}”`, d: `${b.access === 'write' ? 'Read & write' : 'Read only'} · acts as ${(store.get('members/' + uid) || {}).name || ''}` });
  send(res, 200, { id, token });
});
on('DELETE', '/api/keys/:id', (req, res, p) => { const a = need(req, { ceo: true }); const k = store.db.prepare('SELECT name FROM apikeys WHERE id = ?').get(p.id); store.db.prepare('UPDATE apikeys SET revoked = ? WHERE id = ?').run(nowISO(), p.id); addLog(a.uid, { a: 'permission', m: 'users', s: `Revoked AI / API key “${(k && k.name) || ''}”` }); send(res, 200, { ok: true }); });
// MCP (AI agents) and a small REST API using the same keys
on('POST', '/mcp', (req, res) => MCP.handle(req, res, auth(req)));
on('POST', '/mcp/:key', (req, res, p) => MCP.handle(req, res, keyAuth(p.key)));
on('GET', '/mcp', (req, res) => send(res, 405, { error: 'Use POST for MCP requests.' }, { Allow: 'POST' }));
on('GET', '/mcp/:key', (req, res) => send(res, 405, { error: 'Use POST for MCP requests.' }, { Allow: 'POST' }));
on('GET', '/api/v1/:col', (req, res, p) => MCP.rest(req, res, auth(req), 'list', p));
on('GET', '/api/v1/:col/:id', (req, res, p) => MCP.rest(req, res, auth(req), 'get', p));
on('POST', '/api/v1/:col', (req, res, p) => MCP.rest(req, res, auth(req), 'create', p));
on('PATCH', '/api/v1/:col/:id', (req, res, p) => MCP.rest(req, res, auth(req), 'update', p));
on('DELETE', '/api/v1/:col/:id', (req, res, p) => MCP.rest(req, res, auth(req), 'delete', p));

const server = http.createServer(async (req, res) => {
  const url = req.url || '/'; const pathname = url.split('?')[0];
  try {
    if (pathname.startsWith('/api/') || pathname.startsWith('/mcp')) {
      for (const r of routes) { if (r.method !== req.method) continue; const m = pathname.match(r.re); if (m) { await r.fn(req, res, m.groups || {}); return; } }
      if (req.method === 'OPTIONS') return send(res, 204, '');
      throw new HttpErr(404, 'Not found');
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    serveStatic(req, res, url);
  } catch (e) {
    const st = e.status || 500; if (st >= 500) console.error(e);
    if (!res.headersSent) send(res, st, { error: st >= 500 && !e.status ? 'Something went wrong on the server.' : e.message, ...(e.extra || {}) }); else try { res.end(); } catch (x) { }
  }
});
server.requestTimeout = 120000; server.headersTimeout = 30000; server.keepAliveTimeout = 65000;
server.listen(CFG.port, CFG.host, () => {
  console.log(`Triagon ERP ${VERSION} listening on ${CFG.host}:${CFG.port} · data in ${CFG.data} · PDF ${PDF.available() ? 'ready' : 'not installed'} · TZ ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
  setInterval(() => tick().catch(e => console.error(e)), 60000).unref();
  setTimeout(() => catchUp().catch(e => console.error(e)), 20000).unref();
  setTimeout(() => { const d = todayStr(); if (!fs.existsSync(path.join(DIRS.backups, `triagon-erp-${d}.sqlite`))) nightlyBackup(); lastBackupDay = d; }, 5000).unref();
});
const stop = async () => { try { for (const s of streams) s.res.end(); await PDF.shutdown(); } catch (e) { } process.exit(0); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
module.exports = { store, perms };
