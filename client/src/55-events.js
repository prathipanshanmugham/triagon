/* ---------- event wiring ---------- */
async function guarded(fn) { try { await fn(); } catch (e) { handleErr(e); } }
const ACT = {
  go(v) { if (!MOD[v]) return; ui.view = v; ui.navOpen = false; persistUI(); try { history.replaceState(null, '', '#' + v); } catch (e) { } render(); window.scrollTo(0, 0); $('#view').focus({ preventScroll: true }); },
  nav() { ui.navOpen = !ui.navOpen; renderSide(); },
  sort(id, k, isNum) { const cur = ui.sort[id]; ui.sort[id] = cur && cur.k === k ? { k, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { k, dir: isNum === '1' ? 'desc' : 'asc' }; schedule(); },
  tab(g, k) { if (g === 'dash') ui.dashTab = k; else ui.tab[g] = k; schedule(); },
  filt(g, k) { if (g === 'roleedit') ui.roleEdit = k; else ui.filt[g] = k; schedule(); },
  showall(id) { ui.q[id + ':all'] = true; schedule(); },
  open(type, id) { if (EDIT[type]) EDIT[type](id); },
  new(type) { if (EDIT[type]) EDIT[type](null); },
  stockin(pid) { EDIT.move(null, { productId: pid, type: 'purchase' }); },
  poprod(pid) { const p = prodOf(pid); if (!p) return; const s = stockState(p); const q = Math.max(N(p.reorderLevel) || 10, (N(p.reorderLevel) || 10) * 3 - s.on - s.ord); EDIT.po(null, { supplierId: p.supplierId || '', lines: [{ productId: pid, qty: Math.round(q), cost: N(p.costPrice) || null, received: 0 }] }); },
  stockfilter(f) { ui.tab.inv = 'stock'; ui.filt.stock = f; ACT.go('inventory'); },
  revfilter(f) { ui.tab.cus = 'reviews'; ui.filt.rst = f; ACT.go('customers'); },
  fintab(t) { ui.tab.fin = t; ACT.go('finance'); },
  invtab(t) { ui.tab.inv = t; ACT.go('inventory'); },
  recpost(id) { const r = S.recurring.find(x => x.id === id); if (!r) return; const d = pendingDates(r)[0]; if (!d) return; guarded(async () => { await postRecurring(r, [d], false); toast(`${r.name} marked paid for ${fmtD(d)}`); }); },
  poadd() { syncPoLines(); poLines.push({ productId: '', qty: 10, cost: null, received: 0 }); redrawPoLines(); },
  porm(i) { syncPoLines(); poLines.splice(+i, 1); if (!poLines.length) poLines.push({ productId: '', qty: 10, cost: null, received: 0 }); redrawPoLines(); },
  poreceive(id) { closeDrawer(); setTimeout(() => EDIT.receive(id), 230); },
  delapprove(id) { guarded(() => decideDeletion(id, true)); },
  delreject(id) { guarded(() => decideDeletion(id, false)); },
  delrestore(id) { guarded(() => restoreDeletion(id)); },
  delview(id) { viewDeletion(id); },
  delwithdraw(id) { const r = S.deletions.find(x => x.id === id); if (!r || r.requestedBy !== ME.id) return; guarded(async () => { await dbWrite('delete', 'deletions/' + id); addLog('request', r.module, 'Withdrew delete request for ' + r.label); toast('Request withdrawn'); }); },
  feesettings() { feeSettings(); },
  feeadd() { const { vals } = readForm($('#drForm')); feeList = feeList.map((p, i) => ({ ...p, ...((vals.pl || {})[i] || {}) })); feeList.push({ key: 'p' + rid().slice(0, 6), name: 'New platform', code: 'NEW', idLabel: 'Listing ID', commission: 0, fixed: 0, shipBase: 0, shipExtra: 0, collection: 0, gstOnFees: 18, tcs: 0.5, tds: 0.1, returnCost: 0, color: SWATCHES[feeList.length % 8], on: true }); redrawDrawer(); },
  feereset() { feeList = JSON.parse(JSON.stringify(DEFAULT_PLATFORMS)); redrawDrawer(); },
  import(kind) { openImport(kind); }, impcheck() { checkImport(); }, imptemplate() { copyText(IMPORT[IMP.kind].cols, 'Column row copied'); },
  demoload() { loadDemo(); }, democlear() { clearDemo(); },
  viewas(r) { ui.viewAs = r || null; if (r) addLog('preview', 'users', 'Previewed the ERP as ' + roleLabel(r)); bump(); },
  report(k) { ui.report = k; persistUI(); schedule(); },
  repcopy() { const x = reportCSV(); addLog('export', 'reports', `Copied report ${x.name} (${x.rows.length} rows)`); copyText(toCSV(x.cols, x.rows).replace(/,/g, '\t'), 'Report copied. Paste it into a spreadsheet.'); },
  repexport() { const x = reportCSV(); exportCSV(x.name, x.cols, x.rows, 'reports'); },
  exportsales() { const rows = salesIn(periodRange()).map(s => ({ s, f: saleFin(s), p: prodOf(s.productId) || {} })); exportCSV('Sales ledger', [{ l: 'Date', csv: x => x.s.date }, { l: 'Order ref', csv: x => x.s.orderRef }, { l: 'Platform', csv: x => PL(x.s.platform).name }, { l: 'SKU', csv: x => x.p.sku }, { l: 'Product', csv: x => x.p.name }, { l: 'Qty', csv: x => x.s.qty }, { l: 'Unit price', csv: x => x.s.unitPrice }, { l: 'Gross', csv: x => x.f.gross.toFixed(2) }, { l: 'Fees', csv: x => x.f.fees.toFixed(2) }, { l: 'GST on fees', csv: x => x.f.gstOnFees.toFixed(2) }, { l: 'Settlement', csv: x => x.f.settlement.toFixed(2) }, ...(allow('costs') ? [{ l: 'Contribution', csv: x => x.f.profit.toFixed(2) }] : []), { l: 'Status', csv: x => saleLabel(x.s.status) }], rows, 'finance'); },
  exportexp() { exportCSV('Expenses', [{ l: 'Date', k: 'date' }, { l: 'Category', k: 'category' }, { l: 'Vendor', k: 'vendor' }, { l: 'Brand', csv: e => e.brandId ? brandName(e.brandId) : 'Shared' }, { l: 'Amount', k: 'amount' }, { l: 'GST', k: 'gst' }, { l: 'Paid via', k: 'paidVia' }, { l: 'Invoice', k: 'ref' }, { l: 'Recurring', csv: e => e.recurringId ? 'Yes' : '' }, { l: 'Note', k: 'note' }], expensesIn(periodRange()), 'finance'); },
  exportassets() { exportCSV('Asset register', [{ l: 'Tag', k: 'tag' }, { l: 'Asset', k: 'name' }, { l: 'Category', csv: a => assetCat(a.category)[1] }, { l: 'Serial', k: 'serial' }, { l: 'Bought', k: 'purchaseDate' }, { l: 'Cost', k: 'cost' }, { l: 'Book value', csv: a => bookValue(a).toFixed(2) }, { l: 'Assigned to', csv: a => a.assignedTo ? personName(a.assignedTo) : (a.assignedName || '') }, { l: 'Location', k: 'location' }, { l: 'Warranty until', k: 'warrantyUntil' }, { l: 'Status', csv: a => (ASSET_STATUS.find(s => s[0] === a.status) || [, 'In use'])[1] }], assetsIn(), 'finance'); },
  exportcat() { exportCSV('Catalogue', [{ l: 'SKU', k: 'sku' }, { l: 'Name', k: 'name' }, { l: 'Brand', csv: p => brandName(p.brandId) }, { l: 'Category', k: 'category' }, { l: 'Variant', k: 'variant' }, { l: 'MRP', k: 'mrp' }, { l: 'Selling price', k: 'sellingPrice' }, ...(allow('costs') ? [{ l: 'Cost price', k: 'costPrice' }] : []), { l: 'GST rate', k: 'gstRate' }, { l: 'HSN', k: 'hsn' }, { l: 'Status', k: 'status' }, { l: 'Content score', csv: p => contentScore(p).score }], S.products.filter(inBrand), 'catalogue'); },
  exportstock() { exportCSV('Stock levels', [{ l: 'SKU', k: 'sku' }, { l: 'Product', k: 'name' }, { l: 'Location', k: 'location' }, { l: 'On hand', csv: p => stockState(p).on }, { l: 'On order', csv: p => stockState(p).ord }, { l: 'Reorder level', csv: p => stockState(p).rl }, { l: '30-day sales', csv: p => stockState(p).v }, { l: 'Status', csv: p => STOCK_PILL[stockState(p).st][0] }], S.products.filter(p => inBrand(p) && p.status !== 'archived'), 'inventory'); },
  exportcust() { const st = custStats(); exportCSV('Customers', [{ l: 'Name', k: 'name' }, { l: 'Phone', k: 'phone' }, { l: 'Email', k: 'email' }, { l: 'City', k: 'city' }, { l: 'State', k: 'state' }, { l: 'Tags', k: 'tags' }, { l: 'Orders', csv: c => (st[c.id] || {}).orders || 0 }, { l: 'Spend', csv: c => Math.round((st[c.id] || {}).spend || 0) }], S.customers, 'customers'); },
  logexport() { const r = periodRange(); const rows = allLogs().filter(e => inRange(e.t.slice(0, 10), r)); exportCSV('Activity log', [{ l: 'Time', csv: e => e.t }, { l: 'Person', csv: e => personName(e.u) }, { l: 'Action', csv: e => (ACT_LABEL[e.a] || [e.a])[0] }, { l: 'Module', csv: e => (MOD[e.m] || {}).l || e.m }, { l: 'Summary', csv: e => e.s }, { l: 'Details', csv: e => e.d || '' }], rows, 'logs'); },
  rolenew() { if (!canManageTeam()) return; const key = 'r_' + rid().slice(0, 6); const cur = S.settings.roles || {}; const roles = { ...(cur.roles || {}) }; roles[key] = { ...JSON.parse(JSON.stringify(DEFAULT_ROLE_DEFS.staff)), label: 'New role', custom: true }; guarded(async () => { await dbWrite('set', 'settings/roles', clean({ roles, updatedAt: nowISO(), updatedBy: ME.id })); addLog('permission', 'users', 'Created a new role'); ui.roleEdit = key; toast('Role created. Name it and set its access.'); }); },
  rolesave(key) { if (!canManageTeam()) return; const { vals } = readForm($('#roleForm')); const x = vals.r || {}; const cur = S.settings.roles || {}; const roles = {}; for (const [k, d] of Object.entries(roleDefs())) roles[k] = { label: d.label, custom: d.custom, modules: d.modules, sections: d.sections, abilities: d.abilities }; const prev = JSON.parse(JSON.stringify(roles[key])); roles[key] = { ...roles[key], label: (x.label || roles[key].label).slice(0, 40), modules: { ...roles[key].modules, ...(x.modules || {}), dashboard: 'view' }, sections: { ...roles[key].sections, ...(x.sections || {}) }, abilities: { ...roles[key].abilities, ...(x.abilities || {}) } }; const d = diffPerm(prev, roles[key]); guarded(async () => { await dbWrite('set', 'settings/roles', clean({ ...cur, roles, updatedAt: nowISO(), updatedBy: ME.id })); addLog('permission', 'users', `Updated permissions for ${roles[key].label}`, d); toast('Permissions saved'); }); },
  rolereset(key) { if (!canManageTeam()) return; const cur = S.settings.roles || {}; const roles = { ...(cur.roles || {}) }; roles[key] = { ...JSON.parse(JSON.stringify(DEFAULT_ROLE_DEFS[key])) }; guarded(async () => { await dbWrite('set', 'settings/roles', clean({ ...cur, roles, updatedAt: nowISO(), updatedBy: ME.id })); addLog('permission', 'users', `Reset ${roleLabel(key)} to default permissions`); toast('Reset to defaults'); }); },
  roledel(key) { if (!canManageTeam() || S.members.some(m => m.role === key)) return; const cur = S.settings.roles || {}; const roles = { ...(cur.roles || {}) }; const lbl = roleLabel(key); delete roles[key]; guarded(async () => { await dbWrite('set', 'settings/roles', clean({ ...cur, roles, updatedAt: nowISO(), updatedBy: ME.id })); addLog('permission', 'users', `Deleted the role ${lbl}`); ui.roleEdit = 'manager'; toast('Role deleted'); }); },
  companysave() { const { vals, errs } = readForm($('#companyForm')); if (errs.length || !vals.name) { toast('Company name is required.', 'bad'); return; } guarded(async () => { const d = diffText(company(), vals); await dbWrite('set', 'settings/company', clean({ ...vals, updatedAt: nowISO(), updatedBy: ME.id })); addLog('settings', 'users', 'Company profile updated', d); toast('Company profile saved'); }); },
  auditsave() { const { vals } = readForm($('#auditForm')); guarded(async () => { const before = audit().retention; await dbWrite('set', 'settings/audit', clean({ retention: vals.retention, updatedAt: nowISO(), updatedBy: ME.id })); addLog('settings', 'logs', 'Activity log retention changed', `${(RETENTION.find(r => r[0] === before) || [, before])[1]} → ${(RETENTION.find(r => r[0] === vals.retention) || [, vals.retention])[1]}`); toast('Retention saved'); }); },
  auditgo() { ui.tab.usr = 'company'; ACT.go('users'); },
  drclose() { closeDrawer(); },
  drtab(i) { DRW.tab = +i; $$('#dr .tab').forEach((t, j) => t.setAttribute('aria-selected', String(j === DRW.tab))); $$('#dr .drp').forEach(p => { p.hidden = +p.dataset.tab !== DRW.tab; }); },
  drsave() { drSave(); },
  drconfirm() { DRW.confirm = true; $('#drFoot').innerHTML = footHTML(); const r = $('#delReason'); if (r) r.focus(); },
  drnoconfirm() { DRW.confirm = false; $('#drFoot').innerHTML = footHTML(); },
  async drdelete() { const c = DRW.cfg; if (!c || !c.onDelete || DRW.busy) return; const reason = (($('#delReason') || {}).value || '').trim(); DRW.busy = true; try { const r = await c.onDelete(reason); if (r) { closeDrawer(); toast(r === 'requested' ? 'Delete request sent. A Manager or the CEO will review it.' : r === 'removed' ? 'Removed from the team' : 'Deleted. Restore it from Approvals & recycle bin if needed.'); } else { DRW.confirm = false; if ($('#drFoot')) $('#drFoot').innerHTML = footHTML(); } } catch (e) { handleErr(e); } finally { DRW.busy = false; } },
};
function diffPerm(a, b) { const ch = []; if (a.label !== b.label) ch.push(`Name: ${a.label} → ${b.label}`); for (const k in b.modules) if ((a.modules[k] || 'none') !== b.modules[k] && k !== 'dashboard') ch.push(`${MOD[k] ? MOD[k].l : k}: ${a.modules[k] || 'none'} → ${b.modules[k]}`); for (const k in b.sections) if (!!a.sections[k] !== !!b.sections[k]) ch.push(`${(FIN_SECTIONS.find(s => s[0] === k) || [, k])[1]}: ${b.sections[k] ? 'on' : 'off'}`); for (const k in b.abilities) if (!!a.abilities[k] !== !!b.abilities[k]) ch.push(`${(ABILITIES.find(s => s[0] === k) || [, k])[1]}: ${b.abilities[k] ? 'allowed' : 'not allowed'}`); return ch.join('; ') || 'No changes'; }
const IN = {
  q(v, el) { ui.q[el.dataset.key] = v; delete ui.q[el.dataset.key + ':all']; schedule(); },
  calc(v, el) { ui.calc[el.dataset.key] = v === '' ? '' : Number(v); schedule(); },
};
const CH = {
  brand(v) { ui.brand = v; persistUI(); bump(); },
  period(v) { ui.period = v; if (v === 'custom' && !ui.from) { const r = periodRange('30d'); ui.from = r[0]; ui.to = r[1]; } persistUI(); bump(); },
  from(v) { ui.from = v; bump(); }, to(v) { ui.to = v; bump(); },
  viewas(v) { ACT.viewas(v); },
  filtsel(v, el) { ui.filt[el.dataset.key] = v; schedule(); },
  report(v) { ui.report = v; persistUI(); schedule(); },
  calcgst(v) { ui.calc.gst = +v; schedule(); },
  calcuseplat(v, el) { ui.calc.usePlat = el.checked; schedule(); },
  calcprod(v) { const p = prodOf(v); ui.calc.productId = v; if (p) Object.assign(ui.calc, { price: N(p.sellingPrice), cost: N(p.costPrice), pack: N(p.packagingCost), weight: N(p.weight), gst: N(p.gstRate ?? 18) }); schedule(); },
  impfile(v, el) { const f = el.files && el.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { $('#impText').value = String(rd.result || ''); checkImport(); }; rd.readAsText(f); },
  assetcat(v) { const c = assetCat(v); const m = $('#fi_method'), r = $('#fi_rate'); if (m) m.value = c[2]; if (r) r.value = c[3]; },
};
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; const [a, ...args] = el.dataset.act.split(':'); const fn = ACT[a]; if (!fn) return; e.preventDefault(); fn(...args, el, e); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (DRW.cfg) ACT.drclose(); else if (ui.navOpen) ACT.nav(); } if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('tr[data-act],.li[data-act]')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('input', e => { const el = e.target; if (el.dataset && el.dataset.in && IN[el.dataset.in]) IN[el.dataset.in](el.value, el, e); });
document.addEventListener('change', e => { const el = e.target; if (el.dataset && el.dataset.ch && CH[el.dataset.ch]) CH[el.dataset.ch](el.value, el, e); });
document.addEventListener('submit', e => { e.preventDefault(); if (e.target.id === 'drForm') drSave(); });
$('#navScrim').addEventListener('click', () => ACT.nav());

