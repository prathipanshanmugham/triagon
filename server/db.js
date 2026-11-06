'use strict';
/* Document store on SQLite (built into Node 22+). Every record is a JSON document at a path like
   "products/abc123", "settings/company" or "logs/<uid>/days/2026-11-06". A global revision number
   orders all changes so browsers can catch up from where they left off. */
process.removeAllListeners('warning');
process.on('warning', w => { if (w && w.name === 'ExperimentalWarning' && /SQLite/.test(w.message)) return; console.warn(w); });
const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

class Store {
  constructor(file) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.file = file;
    this.db = new DatabaseSync(file);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS docs (path TEXT PRIMARY KEY, col TEXT NOT NULL, data TEXT NOT NULL, rev INTEGER NOT NULL, updated TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS docs_col ON docs(col);
      CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
      CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, username TEXT UNIQUE COLLATE NOCASE, pwhash TEXT, updated TEXT);
      CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, uid TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'user', created TEXT, expires INTEGER, ua TEXT, ip TEXT, seen INTEGER);
      CREATE TABLE IF NOT EXISTS apikeys (id TEXT PRIMARY KEY, name TEXT, uid TEXT, access TEXT, hash TEXT UNIQUE, prefix TEXT, created TEXT, createdBy TEXT, lastUsed TEXT, uses INTEGER DEFAULT 0, revoked TEXT);
      CREATE TABLE IF NOT EXISTS kiosks (id TEXT PRIMARY KEY, name TEXT, hash TEXT UNIQUE, created TEXT, createdBy TEXT, lastUsed TEXT, revoked TEXT);`);
    this.q = {
      get: this.db.prepare('SELECT data FROM docs WHERE path = ?'),
      put: this.db.prepare('INSERT INTO docs(path,col,data,rev,updated) VALUES(?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data, rev=excluded.rev, updated=excluded.updated'),
      del: this.db.prepare('DELETE FROM docs WHERE path = ?'),
      all: this.db.prepare('SELECT path, data, rev FROM docs'),
      col: this.db.prepare('SELECT path, data FROM docs WHERE col = ?'),
      prefix: this.db.prepare("SELECT path, data FROM docs WHERE path >= ? AND path < ?"),
      count: this.db.prepare('SELECT col, COUNT(*) n FROM docs GROUP BY col'),
      metaGet: this.db.prepare('SELECT v FROM meta WHERE k = ?'),
      metaPut: this.db.prepare('INSERT INTO meta(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v'),
    };
    this.rev = Number(this.meta('rev') || 0);
    this.changes = []; // recent changes {rev, path, data}
    this.listeners = new Set();
    this.cache = new Map(); // path -> parsed doc (whole DB is small enough to keep in memory)
    this.revs = new Map(); // path -> rev of its last change
    this.reload();
  }
  meta(k, v) { if (v === undefined) { const r = this.q.metaGet.get(k); return r ? r.v : null; } this.q.metaPut.run(k, String(v)); return v; }
  static colOf(p) { return String(p).split('/')[0]; }
  get(p) { return this.cache.has(p) ? this.cache.get(p) : undefined; }
  list(col) { const out = []; for (const [p, d] of this.cache) if (p.startsWith(col + '/') && p.split('/').length === 2) out.push({ id: p.slice(col.length + 1), path: p, data: d }); return out; }
  under(prefix) { const out = []; for (const [p, d] of this.cache) if (p.startsWith(prefix)) out.push({ path: p, data: d }); return out; }
  entries() { return this.cache.entries(); }
  // ops: [{op:'set'|'delete', path, data}] already validated & resolved. Returns new rev.
  apply(ops, origin) {
    if (!ops.length) return this.rev;
    const now = new Date().toISOString(); const out = [];
    this.db.exec('BEGIN');
    try {
      for (const o of ops) {
        const rev = ++this.rev;
        if (o.op === 'delete') { this.q.del.run(o.path); this.cache.delete(o.path); this.revs.set(o.path, rev); out.push({ rev, path: o.path, data: null }); }
        else { const s = JSON.stringify(o.data); this.q.put.run(o.path, Store.colOf(o.path), s, rev, now); this.cache.set(o.path, JSON.parse(s)); this.revs.set(o.path, rev); out.push({ rev, path: o.path, data: this.cache.get(o.path) }); }
      }
      this.q.metaPut.run('rev', String(this.rev));
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); this.rev = Number(this.meta('rev') || 0); this.reload(); throw e; }
    for (const c of out) this.changes.push(c);
    if (this.changes.length > 20000) this.changes.splice(0, this.changes.length - 15000);
    for (const fn of this.listeners) { try { fn(out, origin); } catch (e) { console.error(e); } }
    return this.rev;
  }
  reload() { this.cache.clear(); this.revs.clear(); for (const r of this.q.all.all()) { try { this.cache.set(r.path, JSON.parse(r.data)); this.revs.set(r.path, Number(r.rev)); } catch (e) { } } }
  since(rev) { if (!this.changes.length) return rev === this.rev ? [] : null; if (rev < this.changes[0].rev - 1) return null; return this.changes.filter(c => c.rev > rev); }
  counts() { return Object.fromEntries(this.q.count.all().map(r => [r.col, r.n])); }
  replaceAll(docs, keepPred) {
    const ops = [];
    for (const [p] of this.cache) if (!keepPred || !keepPred(p)) ops.push({ op: 'delete', path: p });
    for (const p in docs) ops.push({ op: 'set', path: p, data: docs[p] });
    return this.apply(ops, { system: true, reset: true });
  }
  backup(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); try { fs.unlinkSync(file); } catch (e) { } this.db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`); }
  // users / sessions / keys
  user(uid) { return this.db.prepare('SELECT uid, username, pwhash FROM users WHERE uid = ?').get(uid); }
  userByName(u) { return this.db.prepare('SELECT uid, username, pwhash FROM users WHERE username = ?').get(String(u || '').trim()); }
  users() { return this.db.prepare('SELECT uid, username, (pwhash IS NOT NULL) has FROM users').all(); }
  setUser(uid, fields) {
    const cur = this.user(uid);
    if (!cur) this.db.prepare('INSERT INTO users(uid, username, pwhash, updated) VALUES(?,?,?,?)').run(uid, fields.username ?? null, fields.pwhash ?? null, new Date().toISOString());
    else this.db.prepare('UPDATE users SET username = ?, pwhash = ?, updated = ? WHERE uid = ?').run(fields.username !== undefined ? fields.username : cur.username, fields.pwhash !== undefined ? fields.pwhash : cur.pwhash, new Date().toISOString(), uid);
  }
  dropSessions(uid, exceptId) { this.db.prepare('DELETE FROM sessions WHERE uid = ? AND id != ?').run(uid, exceptId || ''); }
}
module.exports = { Store };
