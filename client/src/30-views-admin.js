/* =====================================================================
   Views: approvals & recycle bin, users & permissions, activity log
   ===================================================================== */
const COL_LABEL = { brands: 'Brand', products: 'Product', sales: 'Sales entry', expenses: 'Expense', moves: 'Stock movement', campaigns: 'Campaign', customers: 'Customer', reviews: 'Review', recurring: 'Recurring expense', assets: 'Asset', payouts: 'Payout', suppliers: 'Supplier', pos: 'Purchase order' };

/* ---------------- approvals & recycle bin ---------------- */
V.approvals = () => {
  const can = allow('approveDelete'); const vis = r => can || r.requestedBy === ME.id; const all = S.deletions.filter(vis);
  const pend = all.filter(r => r.status === 'pending'), bin = all.filter(r => r.status === 'approved'), hist = all.filter(r => r.status === 'rejected' || r.status === 'restored');
  const tab = tabOf('apr', pend.length || !bin.length ? 'pending' : 'bin');
  let html = ph('Approvals & recycle bin', can ? 'Delete requests from your team, and everything deleted this quarter so it can be restored.' : 'Your delete requests and what happened to them. A Manager or the CEO approves each one.');
  html += tabsHTML('apr', [['pending', 'Waiting for approval', pend.length], ['bin', 'Recycle bin', bin.length], ['hist', 'Rejected & restored', hist.length]], tab);
  const what = r => `<div><b>${esc(r.label)}</b>${r.demo || (r.snapshot && r.snapshot.demo) ? ' ' + pill('Demo', 't-neu', 1) : ''}<br><small class="muted">${esc(COL_LABEL[r.col] || r.col)} · ${esc((MOD[r.module] || {}).l || r.module || '')}</small></div>`;
  const when = iso => iso ? `<span class="tnum">${esc(fmtD(String(iso).slice(0, 10)))} ${esc(fmtT(iso))}</span>` : '—';
  if (tab === 'pending') {
    html += panel('', table('aprp', [
      { k: 'w', l: 'Record', render: what, sort: r => r.label },
      { k: 'by', l: 'Requested by', render: r => personHTML(r.requestedBy), sort: r => personName(r.requestedBy) },
      { k: 'at', l: 'When', render: r => when(r.requestedAt), sort: r => r.requestedAt },
      { k: 'reason', l: 'Reason', cls: 'wrap', render: r => r.reason ? esc(r.reason) : '<span class="muted">No reason given</span>' },
      { k: 'a', l: '', nosort: 1, render: r => can && WRITE_OK ? `<span style="display:inline-flex;gap:6px">${btn('View', 'delview:' + r.id, { sm: true, ghost: true })}${btn('Reject', 'delreject:' + r.id, { sm: true })}${canDeleteCol(r.col) ? btn('Approve', 'delapprove:' + r.id, { sm: true, cls: 'danger' }) : pill('Only the CEO can approve', 't-neu', 1)}</span>` : (r.requestedBy === ME.id && WRITE_OK ? btn('Withdraw', 'delwithdraw:' + r.id, { sm: true }) : pill('Waiting', 't-warn', 1)) },
    ], pend, { sort: { k: 'at', dir: 'desc' }, empty: empty('Nothing waiting', can ? 'When someone without delete rights removes a record, the request lands here for you to approve or reject.' : 'Requests you send to delete records appear here until a Manager or the CEO decides.') }), { flush: true });
  } else if (tab === 'bin') {
    html += panel('', table('aprb', [
      { k: 'w', l: 'Record', render: what, sort: r => r.label },
      { k: 'by', l: 'Deleted by', render: r => personHTML(r.decidedBy || r.requestedBy), sort: r => personName(r.decidedBy) },
      { k: 'at', l: 'Deleted', render: r => when(r.decidedAt), sort: r => r.decidedAt },
      { k: 'req', l: 'Requested by', render: r => r.direct ? '<span class="muted">Deleted directly</span>' : esc(personName(r.requestedBy)) },
      { k: 'a', l: '', nosort: 1, render: r => `<span style="display:inline-flex;gap:6px">${btn('View', 'delview:' + r.id, { sm: true, ghost: true })}${can && WRITE_OK && r.col !== 'members' ? btn('Restore', 'delrestore:' + r.id, { sm: true, i: 'undo' }) : ''}</span>` },
    ], bin, { sort: { k: 'at', dir: 'desc' }, empty: empty('Recycle bin is empty', 'Deleted records stay here, ready to restore, until the quarterly clean-up.') }), { flush: true });
    html += `<p class="muted" style="margin:0;font-size:12px">Deleted records can be restored until ${esc(fmtD(addDays(nextClear(), -1)))}. The quarterly clean-up then removes them along with old activity log entries.</p>`;
  } else {
    html += panel('', table('aprh', [
      { k: 'w', l: 'Record', render: what, sort: r => r.label },
      { k: 'out', l: 'Outcome', render: r => r.status === 'rejected' ? pill('Rejected · record kept', 't-neu', 1) : pill('Restored', 't-acc', 1), sort: r => r.status },
      { k: 'by', l: 'By', render: r => esc(personName(r.status === 'restored' ? r.restoredBy : r.decidedBy)) },
      { k: 'at', l: 'When', render: r => when(r.status === 'restored' ? r.restoredAt : r.decidedAt), sort: r => r.restoredAt || r.decidedAt },
      { k: 'req', l: 'Requested by', render: r => esc(personName(r.requestedBy)) },
    ], hist, { sort: { k: 'at', dir: 'desc' }, empty: empty('Nothing here yet', 'Rejected requests and restored records are listed here.') }), { flush: true });
  }
  return html;
};
function viewDeletion(id) {
  const r = S.deletions.find(x => x.id === id); if (!r) return; const snap = r.snapshot || {};
  const rows = Object.keys(snap).filter(k => !META.has(k) && snap[k] !== '' && snap[k] !== null && snap[k] !== undefined && !(Array.isArray(snap[k]) && !snap[k].length)).map(k => `<div class="li" style="padding:8px 0"><div class="grow"><small>${esc(label(k))}</small><b style="white-space:normal;font-weight:500">${esc(typeof snap[k] === 'object' && !Array.isArray(snap[k]) ? 'Details recorded' : fmtVal(k, snap[k]))}</b></div></div>`).join('');
  openDrawer({ title: r.label, sub: `${esc(COL_LABEL[r.col] || r.col)} · ${r.status === 'pending' ? 'waiting for approval' : r.status}`, noFocus: true, html: `${r.reason ? `<div class="banner" style="margin-bottom:12px"><span><b>Reason:</b> ${esc(r.reason)}</span></div>` : ''}<div class="list">${rows || '<p class="muted">No details stored.</p>'}</div>` });
}

/* ---------------- users & permissions ---------------- */
V.users = () => {
  const manage = canManageTeam(); const tab = tabOf('usr', 'team');
  let html = ph('Users & permissions', 'Who works in the ERP, what each role can see and change, and which brands each person handles. Only the CEO changes these.', manage && tab === 'team' ? btn('Add member', 'new:member', { pri: true, i: 'plus' }) : '');
  html += tabsHTML('usr', [['team', 'Team', liveMembers().length], ['roles', 'Roles & permissions', Object.keys(roleDefs()).length + 1], ['company', 'Company & audit']], tab);
  if (tab === 'roles') return html + usrRoles(manage);
  if (tab === 'company') return html + usrCompany(manage);
  html += `<div class="banner"><span>Each person signs in on this computer with their own PIN. Their role, any overrides and their brands decide which modules, columns and actions they see.</span></div>`;
  const order = k => k === 'ceo' ? 0 : k === 'manager' ? 1 : k === 'staff' ? 3 : 2;
  const rows = liveMembers().slice().sort((a, b) => order(a.role) - order(b.role) || personName(a.id).localeCompare(personName(b.id)));
  html += panel('', table('team', [
    { k: 'p', l: 'Person', render: m => personHTML(m.id), sort: m => personName(m.id) },
    { k: 'title', l: 'Title', render: m => esc(m.title || '—') },
    { k: 'role', l: 'Role', render: m => pill(roleLabel(m.role), m.role === 'ceo' ? 't-acc' : m.role === 'manager' ? 't-info' : 't-neu') + (m.perms && Object.values(m.perms).some(o => o && Object.keys(o).length) ? ' ' + pill('Custom access', 't-warn', 1) : ''), sort: m => order(m.role) },
    { k: 'brands', l: 'Brands', nosort: 1, render: m => (Array.isArray(m.brands) && m.brands.length && m.role !== 'ceo') ? esc(m.brands.map(brandName).join(', ')) : '<span class="muted">All brands</span>' },
    { k: 'status', l: 'Status', render: m => pill(m.status === 'suspended' ? 'Suspended' : 'Active', m.status === 'suspended' ? 't-bad' : 't-good') },
    { k: 'lastSignIn', l: 'Last sign-in', render: m => m.lastSignIn ? `${esc(fmtDs(localDay(m.lastSignIn)))} <small class="muted">${esc(fmtT(m.lastSignIn))}</small>` : '<span class="muted">Never</span>', sort: m => m.lastSignIn || '' },
    { k: 'addedAt', l: 'Added', render: m => esc(m.addedAt ? fmtD(m.addedAt.slice(0, 10)) : '—') },
  ], rows, { open: m => manage && m.id !== ME.id ? 'open:member:' + m.id : '', empty: empty('Only you so far', 'Add colleagues with a role and a PIN. They choose their name on the sign-in screen.', manage ? btn('Add member', 'new:member', { pri: true }) : '') }), { flush: true });
  return html;
};
function usrRoles(manage) {
  const defs = roleDefs(); const key = defs[ui.roleEdit] ? ui.roleEdit : 'manager'; const d = defs[key]; const dis = manage ? '' : ' disabled';
  const used = S.members.filter(m => m.role === key).length;
  const bar = `<div class="rolebar">${chipsHTML('roleedit', [['ceo', 'CEO'], ...Object.entries(defs).map(([k, v]) => [k, v.label, S.members.filter(m => m.role === k).length])], ui.roleEdit === 'ceo' ? 'ceo' : key)}${manage ? btn('New role', 'rolenew', { sm: true, i: 'plus' }) : ''}</div>`;
  if (ui.roleEdit === 'ceo') return bar + panel('CEO', `<p style="margin:0">The CEO always has full access to every module, column and action, approves deletions and is the only role that can change users and permissions. Use <b>View as</b> at the top to check what any other role sees.</p>`);
  const lv = [['none', 'No access'], ['view', 'View'], ['edit', 'Edit']];
  const mods = MODULES.map(m => `<tr><td><b>${esc(m.l)}</b></td><td>${m.k === 'dashboard' ? '<span class="muted">Always visible</span>' : `<select class="inp" name="r.modules.${m.k}" data-t="str" aria-label="${esc(d.label)} access to ${esc(m.l)}"${dis}>${lv.map(([k, l]) => `<option value="${k}"${(d.modules[m.k] || 'none') === k ? ' selected' : ''}>${l}</option>`).join('')}</select>`}</td></tr>`).join('');
  const secs = FIN_SECTIONS.map(([k, l]) => `<label class="chk"><input type="checkbox" name="r.sections.${k}" data-t="check"${d.sections[k] !== false ? ' checked' : ''}${dis}> ${esc(l)}</label>`).join('');
  const abs = ABILITIES.map(([k, l, h]) => `<label class="chk" style="align-items:flex-start"><input type="checkbox" name="r.abilities.${k}" data-t="check"${d.abilities[k] ? ' checked' : ''}${dis} style="margin-top:2px"><span><b style="font-weight:600">${esc(l)}</b><br><small class="muted">${esc(h)}</small></span></label>`).join('');
  const body = `<div id="roleForm" class="col" style="gap:16px">
    <div class="form"><div class="fld"><label for="r_label">Role name</label><input class="inp" id="r_label" name="r.label" data-t="str" value="${esc(d.label)}"${dis}></div><div class="fld"><span class="lab">People with this role</span><div style="padding-top:8px">${num(used)}</div></div></div>
    <div><div class="subh" style="margin-top:0">Modules</div><div class="tw perm"><table class="t"><thead><tr><th>Module</th><th>Access</th></tr></thead><tbody>${mods}</tbody></table></div></div>
    <div><div class="subh" style="margin-top:0">Finance sections this role can open</div><div class="permgrid">${secs}</div><p class="muted" style="font-size:12px;margin:6px 0 0">Only applies when Finance & assets is set to View or Edit.</p></div>
    <div><div class="subh" style="margin-top:0">What else this role can see and do</div><div class="permgrid">${abs}</div></div>
  </div>
  ${manage ? `<div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap;align-items:center">${d.custom ? btn('Delete role', 'roledel:' + key, { ghost: true, cls: 'danger', dis: used > 0, title: used ? 'Move its people to another role first' : '' }) : btn('Reset to defaults', 'rolereset:' + key, { ghost: true })}<span style="flex:1"></span>${btn('Save ' + d.label, 'rolesave:' + key, { pri: true })}</div>` : ''}`;
  return bar + panel(d.label + (d.custom ? ' (custom role)' : ''), body, { sub: manage ? 'Changes apply as soon as you save. Individual overrides are set on each person.' : 'Only the CEO can change these' });
}
function usrCompany(manage) {
  const c = company(); const a = audit();
  const f = [{ n: 'name', l: 'Company name', req: 1 }, { n: 'legalName', l: 'Legal name' }, { n: 'gstin', l: 'GSTIN', mono: 1, ph: '33AAAAA0000A1Z5' }, { n: 'state', l: 'State', t: 'select', o: STATES }, { n: 'address', l: 'Registered address', t: 'textarea', rows: 2, full: 1 }];
  const companyP = panel('Company profile', `<div id="companyForm">${form(f.map(x => ({ ...x, ro: !manage })), c)}</div>${manage ? `<div style="margin-top:14px;display:flex;justify-content:flex-end">${btn('Save company', 'companysave', { pri: true })}</div>` : ''}`);
  const auditP = panel('Activity log & recycle bin retention', `<div id="auditForm" class="col" style="gap:12px"><p style="margin:0">Every change in the ERP is logged with who did it, when, and which fields changed. At the start of each quarter, entries and deleted records older than the retention window are removed automatically.</p>
    <div class="form"><div class="fld"><label for="au_ret">Keep</label><select class="inp" id="au_ret" name="retention" data-t="str"${manage ? '' : ' disabled'}>${RETENTION.map(([k, l]) => `<option value="${k}"${a.retention === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div><div class="fld"><span class="lab">Next clean-up</span><div style="padding-top:8px">${esc(fmtD(nextClear()))} · ${esc(qLabel(nextClear()))} begins</div></div></div>
    <p class="muted" style="margin:0;font-size:12px">Export the log from Activity log before the clean-up if you need a permanent record.</p></div>${manage ? `<div style="margin-top:14px;display:flex;justify-content:flex-end">${btn('Save retention', 'auditsave', { pri: true })}</div>` : ''}`);
  return `<div class="g2">${companyP}${auditP}</div>${dataPanel(manage)}`;
}

/* ---------------- activity log ---------------- */
V.logs = () => {
  const r = periodRange(); const cut = logCutoff(); const all = allLogs().filter(e => inRange(e.t.slice(0, 10), r));
  const mf = ui.filt.logmod || '', uf = ui.filt.logusr || '', af = filtOf('logact', 'all');
  const groups = { changes: ['create', 'update', 'delete', 'import', 'receive', 'post'], approvals: ['request', 'approve', 'reject', 'restore'], admin: ['settings', 'permission', 'purge', 'preview'], access: ['session', 'export'] };
  const rows = all.filter(e => (!mf || e.m === mf) && (!uf || e.u === uf) && (af === 'all' || (groups[af] || []).includes(e.a)) && matchQ('logs', e.s, e.d, personName(e.u), (MOD[e.m] || {}).l));
  const people = Array.from(new Set(allLogs().map(e => e.u)));
  let html = ph('Activity log', 'Everything done in the ERP: changes with the exact fields edited, delete requests and approvals, exports, permission changes and sign-ins. Each person’s entries are written under their own account, so teammates can’t edit or delete them.', exportBtn('logexport', 'Export'));
  html += `<div class="banner"><span>Keeping <b>${esc((RETENTION.find(x => x[0] === audit().retention) || RETENTION[0])[1].toLowerCase())}</b>: entries since ${esc(fmtD(cut))}. The next automatic clean-up is on <b>${esc(fmtD(nextClear()))}</b>${keepQuarters() === 1 ? ', when this quarter’s entries are removed' : ''}.</span>${canManageTeam() ? `<span class="sp"></span>${btn('Retention settings', 'auditgo', { sm: true })}` : ''}</div>`;
  html += `<div class="toolbar">${searchHTML('logs', 'Search details…')}${chipsHTML('logact', [['all', 'Everything', all.length], ['changes', 'Changes'], ['approvals', 'Deletes & approvals'], ['admin', 'Settings & permissions'], ['access', 'Sign-ins & exports']], af)}<span class="sp"></span>
  <label class="sr" for="logmod">Module</label><select class="inp" id="logmod" data-ch="filtsel" data-key="logmod" style="width:auto"><option value="">All modules</option>${MODULES.map(m => `<option value="${m.k}"${mf === m.k ? ' selected' : ''}>${esc(m.l)}</option>`).join('')}</select>
  <label class="sr" for="logusr">Person</label><select class="inp" id="logusr" data-ch="filtsel" data-key="logusr" style="width:auto"><option value="">Everyone</option>${people.map(id => `<option value="${esc(id)}"${uf === id ? ' selected' : ''}>${esc(personName(id))}</option>`).join('')}</select></div>`;
  if (!rows.length) return html + panel('', empty('No activity matches', 'Adding, editing or deleting records, approvals, exports and sign-ins all write entries here.'));
  const lim = ui.q['logs:all'] ? rows.length : 300; const days = groupBy(rows.slice(0, lim), e => e.t.slice(0, 10));
  const body = Object.entries(days).map(([d, es]) => `<tr><td colspan="5" style="background:var(--surface-2);font-weight:600;font-size:12px;color:var(--ink-2)">${esc(parseD(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} <span class="muted" style="font-weight:500">· ${num(es.length)}</span></td></tr>${es.map(e => `<tr><td class="tnum muted" style="width:84px;white-space:nowrap">${esc(fmtT(e.t))}</td><td>${personHTML(e.u)}</td><td>${pill((ACT_LABEL[e.a] || [e.a])[0], (ACT_LABEL[e.a] || [, 't-neu'])[1], 1)}</td><td class="muted" style="white-space:nowrap">${esc((MOD[e.m] || {}).l || e.m)}</td><td class="wrap">${esc(e.s)}${e.d ? `<br><small class="muted">${esc(e.d)}</small>` : ''}</td></tr>`).join('')}`).join('');
  html += panel('', `<div class="tw"><table class="t"><thead><tr><th>Time</th><th>Person</th><th>Action</th><th>Module</th><th>Details</th></tr></thead><tbody>${body}</tbody></table></div>${rows.length > lim ? `<div style="padding:10px 12px;border-top:1px solid var(--line-2)"><button class="btn sm ghost" data-act="showall:logs">Show all ${rows.length}</button></div>` : ''}`, { flush: true, sub: num(rows.length) + ' entries' });
  return html;
};
