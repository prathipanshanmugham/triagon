/* =====================================================================
   Returns & claims: condition of every return (good / damaged / missing /
   wrong item), damaged stock, and claims with each platform
   ===================================================================== */
const RET_COND = [['good', 'Good: back to sellable stock'], ['bad', 'Damaged: to damaged stock'], ['missing', 'Not received / lost'], ['wrong', 'Wrong or swapped item received']];
const RC_TONE = { good: 't-good', bad: 't-bad', missing: 't-warn', wrong: 't-warn' };
const rcOf = s => s.retCondition || (s.restocked === false ? 'bad' : 'good');
const CLAIM_TYPES = [['damaged_return', 'Damaged return'], ['wrong_item', 'Wrong / swapped item returned'], ['not_returned', 'Return not received'], ['lost_transit', 'Lost in transit'], ['missing_parts', 'Missing parts'], ['fee_error', 'Fee or weight overcharge'], ['other', 'Other']];
const CLAIM_ST = [['to_file', 'To file'], ['filed', 'Filed'], ['review', 'Under review'], ['approved', 'Approved'], ['partial', 'Partly approved'], ['rejected', 'Rejected'], ['paid', 'Reimbursed']];
const CL_TONE = { to_file: 't-warn', filed: 't-info', review: 't-info', approved: 't-good', partial: 't-warn', rejected: 't-bad', paid: 't-good' };
const CL_OPEN = ['to_file', 'filed', 'review', 'approved', 'partial'];
const claimSet = () => { const d = { windows: { amazon: 30, flipkart: 30, meesho: 30, website: 0, b2b: 0, direct: 0, etsy: 0 }, notes: {} }; const s = S.settings.claims || {}; return { windows: { ...d.windows, ...(s.windows || {}) }, notes: { ...(s.notes || {}) } }; };
const claimWin = k => N(claimSet().windows[k]);
const claimDeadline = (pk, from) => claimWin(pk) && from ? addDays(from, claimWin(pk)) : '';
const condToClaim = { bad: 'damaged_return', wrong: 'wrong_item', missing: 'not_returned' };

V.returns = () => {
  const tab = tabOf('ret', 'returns'); const canR = canEdit('returns');
  const A = { returns: canR ? btn('Record a return', 'new:ret', { pri: true, i: 'plus' }) : '', claims: canR ? btn('New claim', 'new:claim', { pri: true, i: 'plus' }) : '', settings: '' };
  let html = ph('Returns & claims', 'Every return with the condition it came back in. Good returns go back to stock, damaged ones to damaged stock, and anything you’re owed is claimed from the platform.', A[tab] || '');
  const toFile = S.claims.filter(c => c.status === 'to_file').length;
  html += tabsHTML('ret', [['returns', 'Returns'], ['claims', 'Claims', toFile ? toFile + ' to file' : S.claims.filter(c => CL_OPEN.includes(c.status)).length || ''], ['byplat', 'By platform'], ['settings', 'Claim windows']], tab);
  if (tab === 'claims') return html + retClaims();
  if (tab === 'byplat') return html + retByPlat();
  if (tab === 'settings') return html + retSettings();
  return html + retList();
};
function retList() {
  const r = periodRange(); const all = S.sales.filter(s => s.status === 'returned' && inRange(s.retDate || s.date, r) && inBrand(s));
  const c = k => all.filter(s => rcOf(s) === k); const claimed = new Set(S.claims.map(x => x.saleId).filter(Boolean));
  const need = all.filter(s => rcOf(s) !== 'good' && !claimed.has(s.id) && claimWin(s.platform));
  const delivered = S.sales.filter(s => inRange(s.date, r) && inBrand(s) && s.status !== 'cancelled');
  let html = kpis([
    { l: 'Returns', v: num(all.length), s: pct(ratio(all.length, delivered.length), 1) + ' of orders' },
    { l: 'Back in stock', v: num(c('good').length), s: 'good condition' },
    { l: 'Damaged', v: num(c('bad').length), tone: c('bad').length ? 'neg' : '' },
    { l: 'Missing / wrong item', v: num(c('missing').length + c('wrong').length) },
    { l: 'Need a claim', v: num(need.length), tone: need.length ? 'neg' : '', s: 'not claimed yet' },
    allow('costs') ? { l: 'Return loss', v: inrS(sum(all, s => -saleFin(s).profit)), s: 'fees, shipping & lost stock' } : { l: 'Return value', v: inrS(sum(all, s => N(s.unitPrice) * N(s.qty))), s: 'at selling price' },
  ]);
  const f = filtOf('rc', 'all'); const pf = ui.filt.retplat || '';
  const rows = all.filter(s => (f === 'all' || (f === 'claim' ? need.includes(s) : rcOf(s) === f)) && (!pf || s.platform === pf) && matchQ('ret', s.orderRef, (prodOf(s.productId) || {}).name, (prodOf(s.productId) || {}).sku, s.note));
  html += `<div class="toolbar">${searchHTML('ret', 'Search order id, product…')}${chipsHTML('rc', [['all', 'All', all.length], ['good', 'Good', c('good').length], ['bad', 'Damaged', c('bad').length], ['missing', 'Missing', c('missing').length], ['wrong', 'Wrong item', c('wrong').length], ['claim', 'Need a claim', need.length]], f)}<span class="sp"></span><label class="sr" for="retplat">Platform</label><select class="inp" id="retplat" data-ch="filtsel" data-key="retplat" style="width:auto"><option value="">All platforms</option>${platforms().map(p => `<option value="${esc(p.key)}"${pf === p.key ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;
  if (canEdit('returns')) html += selBar('rets', btn('Raise claims for selected', 'claimsel', { sm: true, i: 'plus' }));
  html += panel('', table('rets', [
    { k: 'date', l: 'Returned', render: s => `<span class="tnum">${esc(fmtD(s.retDate || s.date))}</span><br><small class="muted">ordered ${esc(fmtDs(s.date))}</small>`, sort: s => s.retDate || s.date },
    { k: 'pl', l: 'Platform', render: s => platPill(s.platform), sort: s => PL(s.platform).name },
    { k: 'ref', l: 'Order', render: s => `<span class="mono">${esc(s.orderRef || '—')}</span>` },
    { k: 'p', l: 'Product', render: s => prodCell(prodOf(s.productId)), sort: s => (prodOf(s.productId) || {}).name },
    { k: 'qty', l: 'Qty', num: 1, render: s => fmtQ(s.qty, prodOf(s.productId)) },
    { k: 'cond', l: 'Condition', render: s => pill((RET_COND.find(x => x[0] === rcOf(s)) || [, rcOf(s)])[1].split(':')[0], RC_TONE[rcOf(s)]), sort: s => rcOf(s) },
    { k: 'loss', l: 'Loss', num: 1, cost: 1, render: s => inr(-saleFin(s).profit), sort: s => -saleFin(s).profit },
    { k: 'claim', l: 'Claim', render: s => { const cl = S.claims.find(x => x.saleId === s.id); if (cl) return pill((CLAIM_ST.find(x => x[0] === cl.status) || [, cl.status])[1], CL_TONE[cl.status], 1); if (rcOf(s) === 'good') return '<span class="muted">—</span>'; const dl = claimDeadline(s.platform, s.retDate || s.date); return canEdit('returns') ? btn('Raise claim', 'claimfor:' + s.id, { sm: true }) + (dl ? `<br><small class="${dl < TODAY() ? 'neg' : 'muted'}">by ${esc(fmtDs(dl))}</small>` : '') : '<span class="muted">Not claimed</span>'; }, sort: s => S.claims.some(x => x.saleId === s.id) ? 1 : 0 },
  ], rows, { select: canEdit('returns'), key: s => s.id, sort: { k: 'date', dir: 'desc' }, limit: 150, open: s => 'open:ret:' + s.id, empty: empty('No returns in this period', 'When a return arrives, record it against the sale and mark the condition it came back in.', canEdit('returns') ? btn('Record a return', 'new:ret', { pri: true }) : '') }), { flush: true });
  return html;
}
// record (or correct) a return against a sales entry; a part return splits the entry
EDIT.ret = (id, preset = {}) => {
  const s0 = id ? S.sales.find(x => x.id === id) : null; const can = canEdit('returns');
  const cands = () => S.sales.filter(s => s.status !== 'cancelled' && (s.status !== 'returned' || s.id === id) && inBrand(s)).sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 400).map(s => [s.id, `${fmtDs(s.date)} · ${PL(s.platform).code || PL(s.platform).name} · ${s.orderRef || 'no order id'} · ${(prodOf(s.productId) || {}).sku || ''} × ${qty(s.qty)}`]);
  const v0 = s0 ? { saleId: s0.id, retQty: s0.qty, retCondition: rcOf(s0), retDate: s0.retDate || TODAY(), retNote: s0.retNote || '', raise: false } : { retDate: TODAY(), retCondition: 'good', raise: true, ...preset };
  const f = [
    { n: 'saleId', l: 'Sale it came back from', t: 'select', req: 1, full: 1, o: cands, blank: 'Pick the order…', ro: !!s0, help: s0 ? '' : 'Search by date, platform, order id or SKU. Import or record the sale first if it isn’t here.' },
    { n: 'retQty', l: 'Quantity returned', t: 'number', min: 0, step: 'any', help: 'Less than the sale quantity for a part return.' }, { n: 'retDate', l: 'Received on', t: 'date', req: 1 },
    { n: 'retCondition', l: 'Condition', t: 'select', req: 1, full: 1, o: RET_COND },
    { n: 'retNote', l: 'What was wrong', t: 'textarea', rows: 2, full: 1, ph: 'e.g. scratches on the grain side, customer used it, box missing' },
    { n: 'raise', l: '', t: 'check', cl: 'Raise a claim with the platform if it’s damaged, missing or the wrong item', full: 1, hide: !!s0 },
  ];
  openDrawer({
    title: s0 ? 'Return' : 'Record a return', sub: s0 ? `${esc(PL(s0.platform).name)} · ${esc(s0.orderRef || '')} · ${esc((prodOf(s0.productId) || {}).name || '')}` : 'Good returns go back to sellable stock; damaged ones go to damaged stock.', readOnly: !can,
    html: form(f, v0),
    validate: v => { const s = S.sales.find(x => x.id === (s0 ? s0.id : v.saleId)); const e = []; if (!s) e.push({ n: 'saleId', m: 'Pick the sale.' }); else if (v.retQty !== null && (N(v.retQty) <= 0 || N(v.retQty) > N(s.qty) + 1e-9)) e.push({ n: 'retQty', m: `Between 0 and ${qty(s.qty)}.` }); return e; },
    onSave: async v => {
      const s = S.sales.find(x => x.id === (s0 ? s0.id : v.saleId)); const q = v.retQty === null ? N(s.qty) : rq3(N(v.retQty)); const ops = []; let rid0 = s.id;
      const ret = { status: 'returned', retCondition: v.retCondition, restocked: v.retCondition === 'good', retDate: v.retDate, retNote: v.retNote };
      if (q < N(s.qty) - 1e-9 && !s0) { rid0 = 'ret-' + s.id + '-' + rid().slice(0, 5); ops.push({ op: 'set', path: 'sales/' + s.id, data: clean({ ...base(s), qty: rq3(N(s.qty) - q), ...stampOf(s) }) }, { op: 'set', path: 'sales/' + rid0, data: clean({ ...base(s), qty: q, wasteQty: null, ...ret, splitFrom: s.id, ...stampOf(null) }) }); }
      else ops.push({ op: 'set', path: 'sales/' + s.id, data: clean({ ...base(s), ...ret, ...stampOf(s) }) });
      const p = prodOf(s.productId);
      if (v.raise && v.retCondition !== 'good' && !S.claims.some(c => c.saleId === rid0)) ops.push({ op: 'set', path: 'claims/' + newId('claims'), data: clean({ platform: s.platform, saleId: rid0, orderRef: s.orderRef || '', productId: s.productId, brandId: s.brandId, type: condToClaim[v.retCondition], status: 'to_file', amount: Math.round(N(s.unitPrice) * q * 100) / 100, deadline: claimDeadline(s.platform, v.retDate) || null, notes: v.retNote, ...stampOf(null) }) });
      await batchAll(ops); addLog('update', 'returns', `Return ${qty(q)} × ${p ? p.sku : ''} on ${PL(s.platform).name}${s.orderRef ? ' (' + s.orderRef + ')' : ''}`, `Condition: ${(RET_COND.find(x => x[0] === v.retCondition) || [, v.retCondition])[1]}${v.retNote ? ' · ' + v.retNote : ''}`);
      toast(v.retCondition === 'good' ? 'Return recorded and restocked' : v.raise ? 'Return recorded and a claim added to file' : 'Return recorded');
    },
  });
};
Object.assign(ACT, {
  claimfor(sid) { const s = S.sales.find(x => x.id === sid); if (!s) return; EDIT.claim(null, { platform: s.platform, saleId: s.id, orderRef: s.orderRef || '', productId: s.productId, type: condToClaim[rcOf(s)] || 'other', amount: Math.round(N(s.unitPrice) * N(s.qty) * 100) / 100, deadline: claimDeadline(s.platform, s.retDate || s.date), notes: s.retNote || '' }); },
  claimsel() { const ss = selIds('rets').map(id => S.sales.find(s => s.id === id)).filter(s => s && rcOf(s) !== 'good' && !S.claims.some(c => c.saleId === s.id)); if (!ss.length) { toast('The selected returns are in good condition or already claimed.', 'bad'); return; } guarded(async () => { await batchAll(ss.map(s => ({ op: 'set', path: 'claims/' + newId('claims'), data: clean({ platform: s.platform, saleId: s.id, orderRef: s.orderRef || '', productId: s.productId, brandId: s.brandId, type: condToClaim[rcOf(s)] || 'other', status: 'to_file', amount: Math.round(N(s.unitPrice) * N(s.qty) * 100) / 100, deadline: claimDeadline(s.platform, s.retDate || s.date) || null, notes: s.retNote || '', ...stampOf(null) }) }))); selOf('rets').clear(); addLog('create', 'returns', `Raised ${ss.length} claims`, ss.map(s => s.orderRef || s.id).slice(0, 12).join(', ')); toast(`${ss.length} claims added to file`); }); },
});
function retClaims() {
  const all = S.claims.filter(c => inBrand(c)); const open = all.filter(c => CL_OPEN.includes(c.status)); const soon = open.filter(c => c.status === 'to_file' && c.deadline && c.deadline <= addDays(TODAY(), 5));
  const won = all.filter(c => ['approved', 'partial', 'paid'].includes(c.status)); const decided = all.filter(c => ['approved', 'partial', 'paid', 'rejected'].includes(c.status));
  let html = kpis([{ l: 'Open claims', v: num(open.length), s: inrS(sum(open, c => c.amount)) + ' claimed' }, { l: 'To file', v: num(all.filter(c => c.status === 'to_file').length), s: soon.length ? num(soon.length) + ' due within 5 days' : 'nothing urgent', tone: soon.length ? 'neg' : '' }, { l: 'Recovered', v: inrS(sum(all, c => c.received)), title: inr(sum(all, c => c.received)) }, { l: 'Win rate', v: decided.length ? pct(ratio(won.length, decided.length), 0) : '—', s: num(decided.length) + ' decided' }], 'k4');
  const f = filtOf('clf', 'open'); const pf = ui.filt.clplat || '';
  const rows = all.filter(c => (f === 'all' || (f === 'open' ? CL_OPEN.includes(c.status) : c.status === f)) && (!pf || c.platform === pf) && matchQ('cl', c.orderRef, c.claimRef, (prodOf(c.productId) || {}).name, c.notes));
  html += `<div class="toolbar">${searchHTML('cl', 'Search order id, case id, product…')}${chipsHTML('clf', [['open', 'Open', open.length], ['to_file', 'To file'], ['rejected', 'Rejected'], ['paid', 'Reimbursed'], ['all', 'All', all.length]], f)}<span class="sp"></span><label class="sr" for="clplat">Platform</label><select class="inp" id="clplat" data-ch="filtsel" data-key="clplat" style="width:auto"><option value="">All platforms</option>${platforms().map(p => `<option value="${esc(p.key)}"${pf === p.key ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;
  html += panel('', table('claims', [
    { k: 'pl', l: 'Platform', render: c => platPill(c.platform), sort: c => PL(c.platform).name },
    { k: 'type', l: 'Claim', render: c => `<b>${esc((CLAIM_TYPES.find(x => x[0] === c.type) || [, c.type || 'Other'])[1])}</b>${delPill('claims', c.id)}<br><small class="muted mono">${esc(c.orderRef || '')}${c.claimRef ? ' · case ' + esc(c.claimRef) : ''}</small>`, sort: c => c.type },
    { k: 'p', l: 'Product', render: c => esc((prodOf(c.productId) || {}).name || '—'), sort: c => (prodOf(c.productId) || {}).name || '' },
    { k: 'amount', l: 'Claimed', num: 1, render: c => inr(c.amount), sort: c => N(c.amount) },
    { k: 'received', l: 'Recovered', num: 1, render: c => N(c.received) ? inr(c.received) : '—', sort: c => N(c.received) },
    { k: 'deadline', l: 'File by', render: c => c.deadline ? `<span class="${c.status === 'to_file' && c.deadline < TODAY() ? 'neg' : ''}">${esc(fmtD(c.deadline))}</span>` : '—', sort: c => c.deadline || '9' },
    { k: 'filed', l: 'Filed', render: c => esc(c.filedOn ? fmtD(c.filedOn) : '—'), sort: c => c.filedOn || '' },
    { k: 'ev', l: 'Evidence', nosort: 1, render: c => linkA(c.evidenceLink, 'Drive', 'folder', 'lnk') || '<span class="muted">—</span>' },
    { k: 'st', l: 'Status', render: c => pill((CLAIM_ST.find(x => x[0] === c.status) || [, c.status])[1], CL_TONE[c.status]), sort: c => CLAIM_ST.findIndex(x => x[0] === c.status) },
  ], rows, { sort: { k: 'deadline', dir: 'asc' }, open: c => 'open:claim:' + c.id, empty: empty('No claims here', 'Raise claims for damaged or missing returns, lost shipments and fee overcharges, then track them until the money comes back.', canEdit('returns') ? btn('New claim', 'new:claim', { pri: true }) : '') }), { flush: true });
  return html;
}
function retByPlat() {
  const r = periodRange(); const rows = platforms().map(pl => { const sales = S.sales.filter(s => s.platform === pl.key && inRange(s.date, r) && inBrand(s) && s.status !== 'cancelled'); const rets = sales.filter(s => s.status === 'returned'); const cl = S.claims.filter(c => c.platform === pl.key && inBrand(c)); return { pl, n: sales.length, r: rets.length, bad: rets.filter(s => rcOf(s) !== 'good').length, loss: sum(rets, s => -saleFin(s).profit), open: cl.filter(c => CL_OPEN.includes(c.status)).length, claimed: sum(cl, c => c.amount), rec: sum(cl, c => c.received), rej: cl.filter(c => c.status === 'rejected').length, win: claimWin(pl.key) }; }).filter(x => x.n || x.open || x.claimed);
  return panel('', table('retplat', [
    { k: 'pl', l: 'Platform', render: x => platPill(x.pl.key), sort: x => x.pl.name }, { k: 'n', l: 'Orders', num: 1, render: x => num(x.n) },
    { k: 'r', l: 'Returns', num: 1, render: x => `${num(x.r)}<br><small class="muted">${pct(ratio(x.r, x.n), 1)}</small>` }, { k: 'bad', l: 'Not good', num: 1, render: x => num(x.bad) },
    { k: 'loss', l: 'Return loss', num: 1, cost: 1, render: x => inr(x.loss) }, { k: 'open', l: 'Open claims', num: 1, render: x => num(x.open) },
    { k: 'claimed', l: 'Claimed', num: 1, render: x => inr(x.claimed) }, { k: 'rec', l: 'Recovered', num: 1, render: x => `${inr(x.rec)}<br><small class="muted">${pct(ratio(x.rec, x.claimed), 0)}</small>` },
    { k: 'win', l: 'Claim window', num: 1, render: x => x.win ? num(x.win) + ' days' : '—' },
  ], rows, { sort: allow('costs') ? { k: 'loss', dir: 'desc' } : { k: 'r', dir: 'desc' }, empty: empty('Nothing yet', 'Platforms with sales, returns or claims in the period appear here.') }), { flush: true, sub: rangeLabel() });
}
function retSettings() {
  const cs = claimSet(); const can = canEdit('returns');
  return panel('Claim windows', `<p class="muted" style="margin:0 0 12px;max-width:80ch">How many days after a return is received you can still raise a claim on each platform. New claims get a “file by” date from this. Check your seller policies: windows change and differ by claim type.</p><div id="clsForm" class="form">${platforms().map(p => fld({ n: 'windows.' + p.key, l: p.name, t: 'number', min: 0, suf: 'days', ro: !can }, cs.windows[p.key] ?? 0) + fld({ n: 'notes.' + p.key, l: p.name + ' claim notes', ph: 'e.g. SAFE-T claim, Seller support case', ro: !can }, cs.notes[p.key] || '')).join('')}</div>${can ? `<div style="display:flex;justify-content:flex-end;margin-top:14px">${btn('Save claim windows', 'clssave', { pri: true })}</div>` : ''}`);
}
Object.assign(ACT, { clssave() { const { vals } = readForm($('#clsForm')); guarded(async () => { const w = {}; for (const k in (vals.windows || {})) w[k] = N(vals.windows[k]); await dbWrite('set', 'settings/claims', clean({ windows: w, notes: vals.notes || {}, updatedAt: nowISO(), updatedBy: ME.id })); addLog('settings', 'returns', 'Claim windows updated'); toast('Claim windows saved'); }); } });
EDIT.claim = (id, preset = {}) => {
  const c = id ? S.claims.find(x => x.id === id) : null; const can = canEdit('returns');
  const v0 = c || { status: 'to_file', platform: (activePlatforms()[0] || {}).key, type: 'damaged_return', ...preset };
  const f = [
    { n: 'platform', l: 'Platform', t: 'select', req: 1, o: () => platOpts(v0.platform) }, { n: 'type', l: 'Claim for', t: 'select', req: 1, o: CLAIM_TYPES },
    { n: 'orderRef', l: 'Order id', mono: 1 }, { n: 'productId', l: 'Product', t: 'select', o: () => prodOptsWith(v0.productId), blank: 'Not product-specific' },
    { n: 'amount', l: 'Amount claimed', t: 'money', min: 0, req: 1 }, { n: 'deadline', l: 'File by', t: 'date' },
    { n: 'status', l: 'Status', t: 'select', o: CLAIM_ST }, { n: 'claimRef', l: 'Case / claim id', mono: 1 },
    { n: 'filedOn', l: 'Filed on', t: 'date' }, { n: 'decidedOn', l: 'Decision on', t: 'date' },
    { n: 'received', l: 'Amount recovered', t: 'money', min: 0 }, { n: 'receivedOn', l: 'Recovered on', t: 'date' },
    { n: 'evidenceLink', l: 'Evidence folder (photos, unboxing video)', full: 1, ph: 'https://drive.google.com/…' },
    { n: 'notes', l: 'Notes', t: 'textarea', rows: 3, full: 1 },
  ];
  const tip = (claimSet().notes || {})[v0.platform];
  openDrawer({
    title: c ? 'Claim' : 'New claim', sub: c ? `${esc(PL(c.platform).name)} · ${esc((CLAIM_TYPES.find(x => x[0] === c.type) || [, ''])[1])}` : 'Track a claim from filing until the money is credited.', readOnly: !can, delKey: 'claims/' + id,
    top: tip ? `<div class="callout"><b>${esc(PL(v0.platform).name)}</b><span>${esc(tip)}</span></div>` : '', html: form(f, v0),
    validate: v => { const e = urlErr(v, ['evidenceLink']); if (N(v.amount) <= 0) e.push({ n: 'amount', m: 'Enter the amount.' }); if (N(v.received) > N(v.amount) * 1.5) e.push({ n: 'received', m: 'That’s a lot more than claimed. Check the amount.' }); return e; },
    onSave: async v => { const p = prodOf(v.productId); const st = v.status === 'filed' && !v.filedOn ? { filedOn: TODAY() } : {}; const st2 = N(v.received) > 0 && v.status !== 'paid' && v.status !== 'partial' && N(v.received) >= N(v.amount) - 0.5 ? { status: 'paid' } : {}; await saveDoc('claims', id, { ...base(c), ...v, ...st, ...st2, saleId: (c && c.saleId) || preset.saleId || null, productId: v.productId || null, brandId: p ? p.brandId : (c && c.brandId) || null, evidenceLink: safeURL(v.evidenceLink) || null }, ['returns', `Claim ${PL(v.platform).name} ${inr(v.amount)}${v.orderRef ? ' · ' + v.orderRef : ''}`]); },
    onDelete: c ? delFn('claims', id, 'returns', `Claim ${PL(c.platform).name} ${inr(c.amount)}${c.orderRef ? ' · ' + c.orderRef : ''}`) : null,
  });
};
