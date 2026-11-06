'use strict';
/* Server-side permission checks. The browser hides what a role can't see; the server makes sure
   nobody can read or change what their role doesn't allow, however they send the request. */
const MODEL = require('../shared/model.js');
const SECRET_FIELDS = ['pin', 'password', 'pwhash'];

class Perms {
  constructor(store) { this.store = store; this.cache = new Map(); store.listeners.add(ch => { if (ch.some(c => c.path.startsWith('members/') || c.path === 'settings/roles')) this.cache.clear(); }); }
  member(uid) { return uid === 'system' ? { role: 'ceo', name: 'System', status: 'active' } : this.store.get('members/' + uid); }
  of(uid) {
    if (this.cache.has(uid)) return this.cache.get(uid);
    const m = this.member(uid); let p;
    if (!m || m.status === 'removed' || m.status === 'suspended') p = { none: true, modules: {}, sections: {}, abilities: {} };
    else p = MODEL.permsFor(m, this.store.get('settings/roles'));
    this.cache.set(uid, p); return p;
  }
  isCEO(uid) { const m = this.member(uid); return !!m && m.role === 'ceo' && m.status !== 'suspended' && m.status !== 'removed'; }
  active(uid) { const m = this.member(uid); return !!m && m.status !== 'removed' && m.status !== 'suspended'; }
  anyView(p, mods) { return mods.some(k => k === '*' || MODEL.canView(p, k)); }
  anyEdit(p, mods) { return mods.some(k => k === '*' || MODEL.canEdit(p, k)); }
  // ---- reading ----
  canRead(uid, path) {
    const p = this.of(uid); if (p && p.none) return false;
    const parts = path.split('/'); const col = parts[0];
    if (col === 'logs') return parts[1] === uid || MODEL.canView(p, 'logs') || (parts[1] === 'kiosk' && MODEL.canView(p, 'attendance'));
    if (col === 'settings') return parts[1] !== 'security';
    if (col === 'files') { const d = this.store.get(path); return !d || !d.col || this.canRead(uid, d.col + '/x'); }
    const rm = MODEL.readMods(col); if (!rm) return true;
    return this.anyView(p, rm);
  }
  redact(path, data) {
    if (!data || typeof data !== 'object') return data; const col = path.split('/')[0];
    if (col === 'members' || col === 'employees') { const o = { ...data }; for (const k of SECRET_FIELDS) if (k in o) { o.hasPin = !!(o.pin && o.pin.hash); delete o[k]; } return o; }
    return data;
  }
  // ---- writing ---- returns null when allowed, or a reason string
  canWrite(uid, op, path, next, prev) {
    const p = this.of(uid); if (p && p.none) return 'Your account is not active.';
    const parts = path.split('/'); const col = parts[0]; const ceo = !p;
    const approve = MODEL.ability(p, 'approveDelete');
    if (col === 'logs') return parts[1] === uid || (ceo && op === 'delete') ? null : 'You can only write your own activity log.';
    if (col === 'settings') {
      const key = parts[1]; if (ceo) return null;
      const mods = MODEL.SETTINGS_W[key]; return mods && this.anyEdit(p, mods) ? null : 'Only the CEO can change these settings.';
    }
    if (col === 'members') {
      if (ceo) return null;
      if (parts[1] === uid && op !== 'delete' && prev) { // people may edit their own name, title and sign-in time
        const allowed = new Set(['name', 'title', 'lastSignIn', 'phone', 'email', 'updatedAt', 'updatedBy']);
        for (const k of new Set([...Object.keys(prev), ...Object.keys(next || {})])) if (!allowed.has(k) && JSON.stringify(prev[k]) !== JSON.stringify((next || {})[k])) return 'Only the CEO can change roles and permissions.';
        return null;
      }
      return 'Only the CEO can manage team members.';
    }
    if (col === 'deletions') {
      if (op === 'set' && !prev && next && next.status === 'pending') return null;
      return approve ? null : 'Only people who approve deletions can do that.';
    }
    if (col === 'updates') { if (op === 'delete') return (prev && prev.by === uid) || ceo ? null : 'You can delete only your own updates.'; return MODEL.canEdit(p, 'daily') || (next && next.by === uid) ? null : 'Your role can’t post updates.'; }
    if (col === 'files') { if (op === 'delete') return approve || (prev && prev.by === uid) ? null : 'Only the uploader or an approver can delete a file.'; return null; }
    if (col === 'attendance' && !MODEL.canEdit(p, 'attendance')) {
      // linked employees can punch themselves in and out for today
      const d = next || prev || {}; const e = this.store.get('employees/' + d.employeeId);
      if (op !== 'delete' && e && e.memberId === uid && d.date === require('./logic').today()) return null;
      return 'Your role can’t change attendance.';
    }
    const wm = MODEL.writeMods(col); if (!wm) return 'Unknown kind of record: ' + col;
    if (!this.anyEdit(p, wm)) return this.anyView(p, wm) ? 'Your role can only view this section.' : 'Your role doesn’t have access to this section.';
    if (op === 'delete' && !approve) {
      if (col === 'claims' || col === 'txns' || col === 'hradj' || col === 'ratingSnaps') return null;
      return 'Deleting needs approval. Send a delete request instead.';
    }
    return null;
  }
}
module.exports = { Perms, SECRET_FIELDS };
