/* ---------- Triagon wiring: icons, team members with PINs, review templates ---------- */
Object.assign(IC, {
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  pdf: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 16.5h6M9 9.5h2.5"/>',
  chev: '<path d="m9 6 6 6-6 6"/>', back: '<path d="m15 6-6 6 6 6"/>',
  login: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>',
  logout: '<path d="M14 17l5-5-5-5"/><path d="M19 12H7"/><path d="M10 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.7-8.7M16 7l2.5 2.5M14 9l2 2"/>',
  folder: '<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="m16 11 2 2 4-4"/>',
});
META.add('pin'); META.add('lastSignIn');
FL.pin = 'PIN'; FL.employeeId = 'Employee'; FL.memberId = 'ERP login'; FL.designation = 'Designation'; FL.shiftStart = 'Shift start'; FL.shiftEnd = 'Shift end'; FL.weeklyOff = 'Weekly off'; FL.joinDate = 'Joining date';
Object.assign(ACT_LABEL, { checkin: ['Checked in', 't-good'], checkout: ['Checked out', 't-info'] });

EDIT.member = id => {
  const m = id ? memberMap()[id] : null; if (!canManageTeam()) return; if (!USERS.loaded) { loadUsers().then(() => EDIT.member(id)); return; }
  const roleOpts = [...Object.entries(roleDefs()).map(([k, d]) => [k, d.label]), ['ceo', 'CEO (full access)']];
  const f = [
    { n: 'name', l: 'Full name', req: 1 }, { n: 'title', l: 'Job title', ph: 'e.g. Catalogue executive' },
    { n: 'role', l: 'Role', t: 'select', req: 1, o: roleOpts }, { n: 'status', l: 'Status', t: 'select', o: [['active', 'Active'], ['suspended', 'Suspended (can’t sign in)']] },
    { n: 'username', l: 'Username', mono: 1, req: !m || !USERS.map[id], help: 'What they type to sign in. Letters, numbers, dot or dash.' },
    { n: 'newPw', l: m && USERS.map[id] && USERS.map[id].hasPassword ? 'New password' : 'Password', t: 'pw', req: !m || !(USERS.map[id] && USERS.map[id].hasPassword), help: m && USERS.map[id] && USERS.map[id].hasPassword ? 'Leave blank to keep their password.' : 'At least 8 characters. Tell them privately; they can change it in My profile.' },
    { n: 'brands', l: 'Brands they handle', t: 'multi', full: 1, o: () => S.brands.map(b => [b.id, b.name]), none: 'No brands yet', help: 'Leave all unticked for every brand. Ignored for CEOs.' },
  ];
  const ov = (m && m.perms) || {}; const def = roleDefs()[(m && m.role) || 'staff'] || roleDefs().staff; const LV = { none: 'No access', view: 'View', edit: 'Edit' };
  const ovHTML = `<p class="muted" style="margin:0 0 12px">Overrides apply to this person only, on top of their role. Leave a setting on “Role default” to follow the role. Overrides don’t apply to CEOs.</p>
    <div class="tw perm"><table class="t"><thead><tr><th>Module</th><th>Access</th></tr></thead><tbody>${MODULES.filter(x => x.k !== 'dashboard').map(x => `<tr><td>${esc(x.l)}</td><td><select class="inp" name="ov.modules.${x.k}" data-t="str" aria-label="${esc(x.l)}"><option value="">Role default (${LV[def.modules[x.k] || 'none']})</option>${Object.entries(LV).map(([k, l]) => `<option value="${k}"${(ov.modules || {})[x.k] === k ? ' selected' : ''}>${l}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div>
    <div class="subh">Finance sections</div><div class="permgrid">${FIN_SECTIONS.map(([k, l]) => { const v = (ov.sections || {})[k]; return `<div class="fld"><label for="ovs_${k}">${esc(l)}</label><select class="inp" id="ovs_${k}" name="ov.sections.${k}" data-t="str"><option value="">Role default (${def.sections[k] !== false ? 'on' : 'off'})</option><option value="on"${v === true ? ' selected' : ''}>On</option><option value="off"${v === false ? ' selected' : ''}>Off</option></select></div>`; }).join('')}</div>
    <div class="subh">Abilities</div><div class="permgrid">${ABILITIES.map(([k, l]) => { const v = (ov.abilities || {})[k]; return `<div class="fld"><label for="ova_${k}">${esc(l)}</label><select class="inp" id="ova_${k}" name="ov.abilities.${k}" data-t="str"><option value="">Role default (${def.abilities[k] ? 'allowed' : 'not allowed'})</option><option value="on"${v === true ? ' selected' : ''}>Allowed</option><option value="off"${v === false ? ' selected' : ''}>Not allowed</option></select></div>`; }).join('')}</div>`;
  const ceos = () => liveMembers().filter(x => x.role === 'ceo' && x.status !== 'suspended');
  openDrawer({
    title: m ? m.name : 'Add team member', sub: m ? esc(m.title || roleLabel(m.role)) : 'They sign in on any device with their own username and password.', directDelete: id !== ME.id,
    tabs: [{ l: 'Person & role', html: form(f, m ? { ...m, username: (USERS.map[id] || {}).username || '' } : { role: 'staff', status: 'active', brands: [] }) }, { l: 'Permission overrides', html: ovHTML }],
    validate: v => { const e = []; if (v.newPw && v.newPw.length < 8) e.push({ n: 'newPw', m: 'At least 8 characters' }); if (v.username && !/^[A-Za-z0-9._@-]{3,40}$/.test(v.username)) e.push({ n: 'username', m: '3–40 letters or numbers, no spaces' }); if (v.username && Object.values(USERS.map).some(u => u.uid !== id && String(u.username || '').toLowerCase() === v.username.toLowerCase())) e.push({ n: 'username', m: 'That username is taken' }); if (id === ME.id && v.status !== 'active') e.push({ n: 'status', m: 'You can’t suspend yourself' }); if (liveMembers().some(x => x.id !== id && String(x.name).trim().toLowerCase() === String(v.name).trim().toLowerCase())) e.push({ n: 'name', m: 'Someone on the team already has this name' }); if (m && m.role === 'ceo' && (v.role !== 'ceo' || v.status === 'suspended') && ceos().length <= 1) e.push({ n: 'role', m: 'Keep at least one active CEO' }); return e; },
    onSave: async v => {
      const uid = m ? id : 'u-' + rid(); const o = v.ov || {}; const perms = { modules: {}, sections: {}, abilities: {} };
      for (const k in (o.modules || {})) if (o.modules[k]) perms.modules[k] = o.modules[k];
      for (const k in (o.sections || {})) if (o.sections[k]) perms.sections[k] = o.sections[k] === 'on';
      for (const k in (o.abilities || {})) if (o.abilities[k]) perms.abilities[k] = o.abilities[k] === 'on';
      const doc = clean({ ...base(m), name: v.name, role: v.role, title: v.title, status: v.status, brands: v.brands || [], perms, addedAt: (m && m.addedAt) || nowISO(), addedBy: (m && m.addedBy) || ME.id });
      const d = m ? diffText(base(m), doc) : '';
      if (!m || d) await dbWrite('set', 'members/' + uid, doc);
      const cred = {}; if (v.username && v.username !== (USERS.map[uid] || {}).username) cred.username = v.username; if (v.newPw) cred.password = v.newPw;
      if (Object.keys(cred).length) { if (uid === ME.id && cred.password) { toast('Change your own password from My profile.', 'bad'); delete cred.password; } if (Object.keys(cred).length) await api('POST', '/api/users/' + uid + '/credentials', cred); }
      if (!m || d || Object.keys(cred).length) addLog(m ? 'permission' : 'create', 'users', `${v.name} · ${roleLabel(v.role)}${v.status === 'suspended' ? ' (suspended)' : ''}`, [d, cred.password && m ? 'Password reset' : '', cred.username ? 'Username ' + cred.username : ''].filter(Boolean).join('; '));
      USERS.loaded = false; loadUsers();
    },
    onDelete: m && id !== ME.id ? async () => { if (m.role === 'ceo' && ceos().length <= 1) { toast('Keep at least one active CEO.', 'bad'); return false; } await dbWrite('set', 'members/' + id, clean({ ...base(m), status: 'removed', removedAt: nowISO(), removedBy: ME.id })); S.employees.filter(e => e.memberId === id).forEach(e => dbWrite('set', 'employees/' + e.id, clean({ ...base(e), memberId: null }))); addLog('permission', 'users', `Removed ${m.name} from the team`); return 'removed'; } : null,
    confirmText: 'Remove this person? They can no longer sign in. Their past activity stays in the log.',
  });
};
const REPLY_TPL = [
  ['thanks', 'Thank you (happy customer)', r => `Thank you${r.reviewer ? ', ' + String(r.reviewer).split(' ')[0] : ''}, for taking the time to share this. We’re really glad it’s working well for your projects. Happy making!\nTeam Triagon`],
  ['issue', 'Sorry, we’ll fix it (problem)', r => `Thank you${r.reviewer ? ', ' + String(r.reviewer).split(' ')[0] : ''}, and we’re sorry your order didn’t meet your expectations. Our team is looking into this. Please message us through the platform’s buyer-seller messages with your order details so we can make it right.\nTeam Triagon`],
  ['mixed', 'Thanks, noted (mixed feedback)', r => `Thank you for the honest feedback${r.reviewer ? ', ' + String(r.reviewer).split(' ')[0] : ''}. We’ve shared your note with our product team so we can keep improving. If anything needs our help, message us through the platform.\nTeam Triagon`],
];
function insertReplyTpl(k) {
  const t = REPLY_TPL.find(x => x[0] === k); if (!t) return; const { vals } = readForm($('#drForm')); const p = prodOf(vals.productId);
  const box = $('#fi_response'); if (box) { box.value = t[2]({ reviewer: vals.reviewer, product: p ? p.name.toLowerCase() : '' }); box.focus(); }
}
const USERS = { loaded: false, map: {} };
async function loadUsers() { if (!canManageTeam()) return; try { const l = await api('GET', '/api/users'); USERS.map = Object.fromEntries(l.map(u => [u.uid, u])); USERS.loaded = true; schedule(); } catch (e) { } }
Object.assign(ACT, {
  glogin() { gateLoginGo(); }, gsetup() { gateSetupGo(); },
  signout() { signOut(); }, myprofile() { editMyProfile(); },
  async bkexport() { await HOST.exportBackup(); toast('Backup download started'); },
  replytpl(k) { insertReplyTpl(k); },
});
Object.assign(CH, { setupmode(v, el) { GATE.mode = el.value; if (el.value === 'fresh') GATE.imp = null; renderGate(); }, setupfile(v, el) { setupFile(el); }, bkimport(v, el) { restoreBackup(el); } });

