'use strict';
/* Admin commands, run on the server:
   node server/cli.js users                      list sign-in names
   node server/cli.js reset-password <username>  set a new password (prints it) */
const path = require('path'); const crypto = require('crypto');
const { Store } = require('./db');
const store = new Store(path.join(path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data')), 'triagon-erp.sqlite'));
const [cmd, arg] = process.argv.slice(2);
const hash = pw => { const salt = crypto.randomBytes(16).toString('hex'); return `scrypt$${salt}$${crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')}`; };
if (cmd === 'users') { for (const u of store.users()) { const m = store.get('members/' + u.uid) || {}; console.log(`${u.username || '(no username)'}\t${m.name || ''}\t${m.role || ''}\t${m.status || ''}`); } }
else if (cmd === 'reset-password' && arg) {
  const u = store.userByName(arg); if (!u) { console.error('No user called ' + arg); process.exit(1); }
  const pw = crypto.randomBytes(9).toString('base64url'); store.setUser(u.uid, { pwhash: hash(pw) }); store.dropSessions(u.uid, '');
  const m = store.get('members/' + u.uid); if (m && m.status !== 'active') store.apply([{ op: 'set', path: 'members/' + u.uid, data: { ...m, status: 'active' } }], { system: true });
  console.log(`New password for ${arg}: ${pw}\nSign in and change it from your profile.`);
} else { console.log('Usage: node server/cli.js users | reset-password <username>'); }
