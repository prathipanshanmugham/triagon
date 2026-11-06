/* =====================================================================
   Views: dashboard, brands, catalogue, inventory & purchasing, calculator
   ===================================================================== */
function invValue() { return memo('inv:' + ui.brand, () => { let units = 0, cost = 0, retail = 0; for (const p of S.products) { if (!inBrand(p) || p.status === 'archived') continue; const on = Math.max(0, stockMap()[p.id] || 0); units += on; cost += on * N(p.costPrice); retail += on * N(p.sellingPrice); } return { units, cost, retail }; }); }
function salesGrouped(r, keyFn) { const g = groupBy(salesIn(r), keyFn); return Object.entries(g).map(([k, list]) => ({ k, ...finSum(list) })); }
const ACT_LABEL = { create: ['Added', 't-good'], update: ['Updated', 't-info'], delete: ['Deleted', 't-bad'], request: ['Delete request', 't-warn'], approve: ['Approved', 't-good'], reject: ['Rejected', 't-neu'], restore: ['Restored', 't-good'], import: ['Imported', 't-info'], export: ['Exported', 't-neu'], settings: ['Settings', 't-neu'], permission: ['Permissions', 't-warn'], session: ['Sign-in', 't-neu'], post: ['Auto-posted', 't-info'], receive: ['Received', 't-good'], purge: ['Clean-up', 't-neu'], preview: ['Role preview', 't-neu'] };

/* ---------------- dashboard ---------------- */
V.dashboard = () => {
  const avail = []; if (allow('overview')) avail.push(['overview', 'Company overview']); if (myRole() !== 'staff') avail.push(['ops', 'Operations']); avail.push(['mine', 'My work']);
  const keys = avail.map(a => a[0]); const tab = keys.includes(ui.dashTab) ? ui.dashTab : keys[0];
  const hr = new Date().getHours(); const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const first = (ME.name || '').trim().split(/\s+/)[0];
  const scope = brandAll() ? (restricted() ? 'Your brands' : 'All brands') : brandName(ui.brand);
  let html = ph(`${greet}${first ? ', ' + first : ''}`, `${esc(scope)} · ${esc(rangeLabel())}`);
  if (avail.length > 1) html += tabsHTML('dash', avail, tab);
  if (realRole() === 'ceo' && !ui.viewAs && (!S.brands.length || !S.products.length)) html += setupPanel();
  return html + (tab === 'overview' ? dashOverview() : tab === 'ops' ? dashOps() : dashMine());
};
function setupPanel() {
  const steps = [
    [S.brands.length > 0, 'Add your brands', 'Each brand gets a short code that prefixes its SKUs.', btn('Add brand', 'new:brand', { sm: true, i: 'plus' })],
    [S.products.length > 0, 'Add products', 'One at a time, or paste a CSV export from your seller account.', btn('Import CSV', 'import:products', { sm: true, i: 'upload' }) + ' ' + btn('Add product', 'new:product', { sm: true })],
    [!!S.settings.platforms, 'Check platform fees', 'Replace the example fee rates with the ones on your seller contracts.', btn('Fee settings', 'feesettings', { sm: true })],
    [liveMembers().length > 1, 'Bring in your team', 'Give each person a role and a PIN, and decide what they can see.', btn('Users & permissions', 'go:users', { sm: true })],
    [S.employees.length > 0, 'Set up attendance', 'Add employees with a kiosk PIN so they can check in and out.', btn('Add employee', 'new:employee', { sm: true })],
  ];
  const demoBtn = WRITE_OK && !S.products.some(p => p.demo) ? `<div class="banner acc" style="margin-top:14px"><span>Want to look around first? Load a demo crafts company with four brands, six months of sales, purchase orders, bills, assets, reviews, employees and a month of attendance. Every demo record is tagged and can be removed in one click.</span><span class="sp"></span>${btn('Load demo data', 'demoload', { sm: true, pri: true })}</div>` : '';
  return panel('Set up Triagon ERP', `<ol class="steps">${steps.map(([done, t, p, a]) => `<li class="${done ? 'done' : ''}"><b>${esc(t)}</b><p>${esc(p)}</p>${done ? '<span class="muted" style="font-size:12px">Done</span>' : `<div>${a}</div>`}</li>`).join('')}</ol>${demoBtn}`);
}
function dashOverview() {
  const r = periodRange(), pr = prevRange(); const P = pnl(r), Q = pr ? pnl(pr) : null; const inv = invValue(); const costs = allow('costs');
  const d = k => Q ? deltaOf(P[k], Q[k]) : undefined;
  let html = kpis(costs ? [
    { l: 'Net revenue', v: inrS(P.taxable), d: d('taxable'), s: 'ex-GST', title: inr(P.taxable) },
    { l: 'Contribution', v: inrS(P.contribution), d: d('contribution'), s: pct(ratio(P.contribution, P.taxable), 0) + ' after COGS & fees', title: inr(P.contribution) },
    { l: 'Net profit', v: inrS(P.net), tone: P.net < 0 ? 'neg' : '', d: d('net'), s: inrS(P.expenses + P.dep) + ' expenses & dep.', title: inr(P.net) },
    { l: 'Units sold', v: num(P.units), d: d('units'), s: num(P.entries) + ' sales entries' },
    { l: 'Return rate', v: pct(P.returnRate), d: d('returnRate'), inv: true, s: num(P.retUnits) + ' units returned' },
    { l: 'Stock value', v: inrS(inv.cost), s: num(inv.units) + ' units at cost', title: inr(inv.cost) },
  ] : [
    { l: 'Net revenue', v: inrS(P.taxable), d: d('taxable'), s: 'ex-GST' }, { l: 'Gross sales', v: inrS(P.gross), d: d('gross'), s: 'incl. GST' },
    { l: 'Units sold', v: num(P.units), d: d('units') }, { l: 'Avg unit price', v: inr(ratio(P.netSales, P.units)), s: 'incl. GST' },
    { l: 'Return rate', v: pct(P.returnRate), d: d('returnRate'), inv: true }, { l: 'Stock at price', v: inrS(inv.retail), s: num(inv.units) + ' units' },
  ]);
  const months = monthsBack(6).map(k => { const m = pnl(monthRange(k)); return { k, rev: m.taxable, profit: m.net }; });
  html += `<div class="g31">${panel('Revenue' + (costs ? ' and profit' : '') + ', last 6 months', trendChart(months, costs))}${panel('Needs attention', alertsList(), { flush: true })}</div>`;
  const byPlat = salesGrouped(r, s => s.platform).sort((a, b) => b.taxable - a.taxable).map(x => ({ l: PL(x.k).name, v: x.taxable, c: PL(x.k).color }));
  const byBrand = salesGrouped(r, s => s.brandId || (prodOf(s.productId) || {}).brandId || '').sort((a, b) => b.taxable - a.taxable).map(x => ({ l: brandName(x.k), v: x.taxable, c: (brandOf(x.k) || {}).color || 'c8' }));
  html += `<div class="g2">${panel('Net revenue by platform', hbars(byPlat))}${panel('Net revenue by brand', hbars(byBrand))}</div>`;
  const top = salesGrouped(r, s => s.productId).sort((a, b) => b.taxable - a.taxable);
  html += panel('Top products', table('dashtop', [
    { k: 'p', l: 'Product', render: x => prodCell(prodOf(x.k)), sort: x => (prodOf(x.k) || {}).name },
    { k: 'units', l: 'Units', num: 1, render: x => num(x.units) },
    { k: 'taxable', l: 'Net revenue', num: 1, render: x => inr(x.taxable) },
    { k: 'profit', l: 'Contribution', num: 1, cost: 1, render: x => `<span class="${x.profit < 0 ? 'neg' : ''}">${inr(x.profit)}</span>` },
    { k: 'm', l: 'Margin', num: 1, cost: 1, render: x => pct(ratio(x.profit, x.taxable)), sort: x => ratio(x.profit, x.taxable) },
  ], top, { limit: 5, open: x => prodOf(x.k) && canView('catalogue') ? 'open:product:' + x.k : '', empty: empty('No sales in this period', 'Record sales in Finance, or pick a longer period at the top.') }), { flush: true, sub: 'by net revenue' });
  return html;
}
function alertsList() {
  const items = []; const ps = S.products.filter(p => inBrand(p) && p.status !== 'archived');
  const pend = S.deletions.filter(x => x.status === 'pending'); if (pend.length && allow('approveDelete')) items.push(['acc', `${pend.length} delete request${pend.length > 1 ? 's' : ''} to approve`, pend.slice(0, 2).map(x => x.label).join(', '), 'go:approvals', 'approvals']);
  const ss = ps.map(p => stockState(p)); const out = ss.filter(s => s.st === 'out').length, low = ss.filter(s => s.st === 'low').length;
  if (out) items.push(['bad', `${out} product${out > 1 ? 's' : ''} out of stock`, 'Listings may go inactive on marketplaces.', 'stockfilter:out', 'inventory']);
  if (low) items.push(['warn', `${low} product${low > 1 ? 's' : ''} below reorder level`, 'Raise purchase orders before they run out.', 'stockfilter:low', 'inventory']);
  if (secOK('recurring')) { const od = S.recurring.filter(x => inBrand(x) && x.active !== false && !x.autoPost && overdueDates(x).length); if (od.length) items.push(['bad', `${od.length} recurring bill${od.length > 1 ? 's' : ''} overdue`, od.slice(0, 2).map(x => x.name).join(', '), 'fintab:recurring', 'finance']); }
  const lateP = S.pos.filter(p => (p.status === 'ordered' || p.status === 'partial') && p.expectedDate && p.expectedDate < TODAY()); if (lateP.length) items.push(['warn', `${lateP.length} purchase order${lateP.length > 1 ? 's' : ''} past the expected date`, lateP.slice(0, 2).map(p => p.number + ' · ' + ((supOf(p.supplierId) || {}).name || '')).join(', '), 'invtab:pos', 'inventory']);
  const nr = S.reviews.filter(r => inBrand(r) && (r.status || 'new') === 'new'); const neg = nr.filter(r => N(r.rating) <= 3).length;
  if (nr.length) items.push([neg ? 'bad' : 'info', `${nr.length} review${nr.length > 1 ? 's' : ''} waiting for a reply`, neg ? `${neg} of them rated 3 stars or lower.` : 'Replying lifts conversion on the listing.', 'revfilter:new', 'customers']);
  if (secOK('assets')) { const soon = addDays(TODAY(), 30); const exp = S.assets.filter(a => inBrand(a) && a.status !== 'disposed' && ((a.warrantyUntil && a.warrantyUntil >= TODAY() && a.warrantyUntil <= soon) || (a.insuranceUntil && a.insuranceUntil >= TODAY() && a.insuranceUntil <= soon))); if (exp.length) items.push(['info', `${exp.length} asset warrant${exp.length > 1 ? 'ies or policies' : 'y or policy'} ending within 30 days`, exp.slice(0, 2).map(a => a.name).join(', '), 'fintab:assets', 'finance']); }
  const weak = S.campaigns.filter(c => inBrand(c) && c.status === 'live' && N(c.spend) > 0 && ratio(N(c.revenue), N(c.spend)) < 2);
  if (weak.length) items.push(['warn', `${weak.length} live campaign${weak.length > 1 ? 's' : ''} below 2× ROAS`, weak.slice(0, 2).map(c => c.name).join(', '), 'go:marketing', 'marketing']);
  const sup = ps.filter(p => Object.values(p.listings || {}).some(l => l && l.status === 'suppressed')).length;
  if (sup) items.push(['bad', `${sup} listing${sup > 1 ? 's' : ''} suppressed`, 'Fix the listing on the marketplace, then update its status.', 'go:catalogue', 'catalogue']);
  const left = daysBetween(TODAY(), nextClear()); if (canView('logs') && left <= 14) items.push(['info', `Activity log clears in ${left} day${left === 1 ? '' : 's'}`, `Entries before ${fmtD(addMonths(nextClear(), -3 * keepQuarters()))} are removed on ${fmtD(nextClear())}. Export them first.`, 'go:logs', 'logs']);
  if (allow('costs')) { const noCost = ps.filter(p => !N(p.costPrice)).length; if (noCost) items.push(['info', `${noCost} product${noCost > 1 ? 's have' : ' has'} no cost price`, 'Profit figures treat their cost as ₹0.', 'go:catalogue', 'catalogue']); }
  const shown = items.filter(i => canView(i[4]));
  if (!shown.length) return `<div class="empty" style="padding:28px 16px"><h3>All clear</h3><p>No stock, bill, approval, review or listing issues right now.</p></div>`;
  return `<div class="list">${shown.map(([sev, t, s, a]) => `<div class="li"><span class="sev ${sev}"></span><div class="grow"><b>${esc(t)}</b><small>${esc(s)}</small></div><button class="btn sm" data-act="${a}">Open</button></div>`).join('')}</div>`;
}
function dashOps() {
  const r = periodRange(); const P = pnl(r); const ps = S.products.filter(p => inBrand(p) && p.status !== 'archived');
  const lowList = ps.map(p => ({ p, ...stockState(p) })).filter(x => x.st === 'low' || x.st === 'out').sort((a, b) => a.cover - b.cover || a.on - b.on);
  const waiting = S.reviews.filter(x => inBrand(x) && (x.status || 'new') === 'new').sort((a, b) => N(a.rating) - N(b.rating) || (a.date < b.date ? 1 : -1));
  const liveC = S.campaigns.filter(c => inBrand(c) && c.status === 'live'); const transit = S.sales.filter(s => inBrand(s) && s.status === 'transit');
  const openPO = S.pos.filter(p => p.status === 'ordered' || p.status === 'partial');
  const pend = S.deletions.filter(x => x.status === 'pending');
  let html = kpis([
    { l: 'Units shipped', v: num(P.units), s: 'in this period' },
    { l: 'In transit', v: num(sum(transit, s => s.qty)), s: num(transit.length) + ' entries open' },
    { l: 'Returns', v: num(P.retUnits), s: pct(P.returnRate) + ' return rate' },
    { l: 'Reviews to answer', v: num(waiting.length), s: num(waiting.filter(x => N(x.rating) <= 3).length) + ' rated 3★ or lower' },
    { l: 'Low or out of stock', v: num(lowList.length), s: num(openPO.length) + ' purchase orders open' },
    { l: 'Delete requests', v: num(pend.length), s: allow('approveDelete') ? 'waiting for you' : 'waiting for approval' },
  ]);
  const restock = table('restock', [
    { k: 'p', l: 'Product', render: x => prodCell(x.p), sort: x => x.p.name },
    { k: 'on', l: 'On hand', num: 1, render: x => `<b class="${x.on <= 0 ? 'neg' : ''}">${num(x.on)}</b>` },
    { k: 'ord', l: 'On order', num: 1, render: x => x.ord ? num(x.ord) : '—' },
    { k: 'cover', l: 'Days left', num: 1, render: x => Number.isFinite(x.cover) ? num(x.cover) : '—' },
    { k: 'a', l: '', nosort: 1, render: x => canEdit('inventory') ? btn('Order', 'poprod:' + x.p.id, { sm: true }) : '' },
  ], lowList, { limit: 6, empty: empty('Stock is healthy', 'Nothing is below its reorder level.') });
  const revs = waiting.length ? `<div class="list">${waiting.slice(0, 6).map(x => `<div class="li" data-act="open:review:${x.id}" role="button" tabindex="0">${stars(x.rating)}<div class="grow"><b>${esc((prodOf(x.productId) || {}).name || 'Product')}</b><small>${esc(PL(x.platform).name)} · ${esc(String(x.text || x.title || '').slice(0, 90))}</small></div></div>`).join('')}</div>` : empty('Inbox zero', 'Every review has a reply.');
  html += `<div class="g2">${panel('Restock soon', restock, { flush: true })}${panel('Reviews waiting for a reply', revs, { flush: true, right: canView('customers') ? btn('All reviews', 'revfilter:new', { sm: true, ghost: true }) : '' })}</div>`;
  const appr = pend.length ? `<div class="list">${pend.slice(0, 6).map(x => `<div class="li"><span class="sev warn"></span><div class="grow"><b>${esc(x.label)}</b><small>${esc(personName(x.requestedBy))} · ${esc((MOD[x.module] || {}).l || x.module)}${x.reason ? ' · ' + esc(x.reason) : ''}</small></div>${allow('approveDelete') ? `<div class="acts">${btn('Reject', 'delreject:' + x.id, { sm: true })}${btn('Approve', 'delapprove:' + x.id, { sm: true, cls: 'danger' })}</div>` : ''}</div>`).join('')}</div>` : empty('No delete requests', 'Requests from your team to delete records appear here for approval.');
  const pos = openPO.length ? `<div class="list">${openPO.slice(0, 6).map(p => `<div class="li" data-act="open:po:${p.id}" role="button" tabindex="0"><div class="grow"><b>${esc(p.number)} · ${esc((supOf(p.supplierId) || {}).name || 'Supplier')}</b><small>${num((p.lines || []).length)} items · expected ${esc(fmtD(p.expectedDate))}${p.expectedDate && p.expectedDate < TODAY() ? ' · late' : ''}</small></div>${meter(poReceivedPct(p), p.expectedDate && p.expectedDate < TODAY() ? 'warn' : '')}</div>`).join('')}</div>` : empty('No open purchase orders', 'Orders you place with suppliers show here until they’re received.');
  html += `<div class="g2">${panel('Delete requests', appr, { flush: true, right: canView('approvals') ? btn('Approvals', 'go:approvals', { sm: true, ghost: true }) : '' })}${panel('Open purchase orders', pos, { flush: true })}</div>`;
  const camps = liveC.length ? `<div class="list">${liveC.slice(0, 6).map(c => { const st = campStats([c]); return `<div class="li"><div class="grow"><b>${esc(c.name)}</b><small>${esc(c.channel || '')} · ${inrS(c.spend)} of ${inrS(c.budget)}</small></div>${pill(st.spend ? st.roas.toFixed(1) + '× ROAS' : 'No spend', st.spend ? roasTone(st.roas) : 't-neu', 1)}</div>`; }).join('')}</div>` : empty('No live campaigns', 'Campaigns you mark as Live show up here.');
  const attP = attTodayPanel(), updP = teamUpdatesPanel(); if (attP || updP) html += `<div class="g2">${attP}${updP}</div>`;
  html += `<div class="g2">${panel('Campaign pulse', camps, { flush: true })}${canView('logs') ? panel('Team activity', logList(allLogs().filter(e => e.a !== 'session').slice(0, 8)), { flush: true, right: btn('Activity log', 'go:logs', { sm: true, ghost: true }) }) : ''}</div>`;
  return html;
}
function dashMine() {
  const qa = [];
  if (canEdit('finance') && secOK('sales')) qa.push(['truck', 'Record a sale', 'new:sale']);
  if (canEdit('inventory')) { qa.push(['box', 'Stock in / adjust', 'new:move']); qa.push(['cart', 'New purchase order', 'new:po']); }
  if (canEdit('catalogue')) qa.push(['grid', 'Add a product', 'new:product']);
  if (canEdit('finance') && secOK('expenses')) qa.push(['rupee', 'Add an expense', 'new:expense']);
  if (canEdit('customers')) { qa.push(['star', 'Log a review', 'new:review']); qa.push(['users', 'Add a customer', 'new:customer']); }
  if (canView('calculator')) qa.push(['calc', 'Check a price', 'go:calculator']);
  if (canEdit('daily')) qa.push(['pdf', 'Post an update', 'go:daily']);
  if (canView('attendance')) qa.push(['clock', 'Check-in kiosk', 'kiosk']);
  const ps = S.products.filter(p => inBrand(p) && p.status !== 'archived'); const tasks = [];
  if (canView('inventory')) ps.forEach(p => { const s = stockState(p); if (s.st === 'out' || s.st === 'low') tasks.push({ t: s.st === 'out' ? 'Out of stock' : 'Low stock', tone: s.st === 'out' ? 't-bad' : 't-warn', title: p.name, sub: `${num(s.on)} on hand · ${s.ord ? num(s.ord) + ' on order' : 'reorder at ' + num(s.rl)}`, act: canEdit('inventory') ? 'stockin:' + p.id : '', al: 'Stock in', w: s.st === 'out' ? 0 : 2 }); });
  if (canView('customers')) S.reviews.filter(x => inBrand(x) && (x.status || 'new') === 'new').forEach(x => tasks.push({ t: 'Reply to review', tone: N(x.rating) <= 3 ? 't-bad' : 't-info', title: (prodOf(x.productId) || {}).name || 'Product', sub: `${N(x.rating)}★ on ${PL(x.platform).name} · ${String(x.text || '').slice(0, 60)}`, act: 'open:review:' + x.id, al: 'Reply', w: N(x.rating) <= 3 ? 1 : 3 }));
  if (canView('catalogue')) ps.filter(p => (p.status || 'active') === 'active' && contentScore(p).score < 70).forEach(p => tasks.push({ t: 'Improve listing', tone: 't-neu', title: p.name, sub: `Content score ${contentScore(p).score}/100`, act: 'open:product:' + p.id, al: 'Open', w: 4 }));
  if (canEdit('finance') && secOK('recurring')) S.recurring.filter(x => inBrand(x) && x.active !== false && !x.autoPost && overdueDates(x).length).forEach(x => tasks.push({ t: 'Bill due', tone: 't-bad', title: x.name, sub: `${inr(x.amount)} due ${fmtD(overdueDates(x)[0])}`, act: 'recpost:' + x.id, al: 'Mark paid', w: 0 }));
  tasks.sort((a, b) => a.w - b.w);
  let html = qa.length ? `<section class="qa" aria-label="Quick actions">${qa.map(([i, l, a]) => `<button data-act="${a}">${icon(i)}<span>${esc(l)}</span></button>`).join('')}</section>` : '';
  const q = tasks.length ? `<div class="list">${tasks.slice(0, 12).map(x => `<div class="li">${pill(x.t, x.tone, 1)}<div class="grow"><b>${esc(x.title)}</b><small>${esc(x.sub)}</small></div>${x.act ? btn(x.al, x.act, { sm: true }) : ''}</div>`).join('')}</div>` : empty('Nothing waiting', 'Restocks, bills, review replies and listing fixes will show up here.');
  const mineReq = S.deletions.filter(x => x.requestedBy === ME.id && !x.direct).sort((a, b) => a.requestedAt < b.requestedAt ? 1 : -1).slice(0, 5);
  const RS = { pending: ['Waiting', 't-warn'], approved: ['Approved', 't-good'], rejected: ['Rejected', 't-neu'], restored: ['Restored', 't-acc'] };
  const reqs = mineReq.length ? `<div class="list">${mineReq.map(x => `<div class="li"><div class="grow"><b>${esc(x.label)}</b><small>${esc(fmtD(String(x.requestedAt).slice(0, 10)))}${x.decidedBy ? ' · ' + esc(personName(x.decidedBy)) : ''}</small></div>${pill(...(RS[x.status] || [x.status, 't-neu']), 1)}</div>`).join('')}</div>` : '';
  const mine = allLogs().filter(e => e.u === ME.id && e.a !== 'session').slice(0, 8);
  html += `<div class="g31">${panel('Your queue', q, { flush: true, sub: tasks.length ? tasks.length + ' open' : '' })}<div class="col">${reqs ? panel('Your delete requests', reqs, { flush: true }) : ''}${panel('Your recent activity', logList(mine, true), { flush: true })}</div></div>`;
  return html;
}
function logList(entries, hideWho) {
  if (!entries.length) return empty('No activity yet', 'Every change people make in the ERP is recorded here automatically.');
  return `<div class="list">${entries.map(e => `<div class="li"><span class="sev ${e.a === 'delete' || e.a === 'request' ? 'bad' : e.a === 'create' || e.a === 'approve' ? 'good' : 'info'}"></span><div class="grow"><b>${esc(e.s)}</b><small>${hideWho ? '' : esc(personName(e.u)) + ' · '}${esc((MOD[e.m] || {}).l || e.m)} · ${esc(fmtDs(e.t.slice(0, 10)))} ${esc(fmtT(e.t))}${e.d ? ' · ' + esc(e.d) : ''}</small></div></div>`).join('')}</div>`;
}

/* ---------------- brands ---------------- */
V.brands = () => {
  const can = canEdit('brands'); const r = periodRange(); const bs = myBrands(); const costs = allow('costs');
  let html = ph('Brands', `${num(bs.length)} brand${bs.length === 1 ? '' : 's'} under ${esc(company().name)}. Brand codes prefix every SKU.`, can ? btn('Add brand', 'new:brand', { pri: true, i: 'plus' }) : '');
  if (!bs.length) return html + panel('', empty('No brands yet', 'Add each label you sell under, for example your watch-bracelet line. Products, campaigns and reports are then split by brand.', can ? btn('Add your first brand', 'new:brand', { pri: true }) : ''));
  const stats = bs.map(b => {
    const ps = S.products.filter(p => p.brandId === b.id); const stock = sum(ps, p => Math.max(0, stockMap()[p.id] || 0) * N(costs ? p.costPrice : p.sellingPrice));
    const f = finSum(S.sales.filter(s => inRange(s.date, r) && (s.brandId || (prodOf(s.productId) || {}).brandId) === b.id));
    const rv = S.reviews.filter(x => (x.brandId || (prodOf(x.productId) || {}).brandId) === b.id); const rating = rv.length ? sum(rv, x => x.rating) / rv.length : 0;
    const cs = campStats(S.campaigns.filter(c => c.brandId === b.id && (c.startDate || '0000') <= r[1] && (c.endDate || '9999') >= r[0]));
    return { b, products: ps.length, stock, ...f, rating, reviews: rv.length, adSpend: cs.spend, roas: cs.roas };
  });
  const totalRev = sum(stats, s => s.taxable);
  const ST = { Active: 't-good', Launching: 't-info', Paused: 't-warn', Discontinued: 't-neu' };
  html += `<div class="bgrid">${stats.map(s => `<button class="bcard" style="--bc:var(--${s.b.color || 'c1'})" data-act="open:brand:${s.b.id}">
    <div class="hd">${brandTile(s.b, 1)}<div style="min-width:0;flex:1"><h3>${esc(s.b.name)}</h3><small>${esc(s.b.category || 'Uncategorised')}${s.b.tagline ? ' · ' + esc(s.b.tagline) : ''}</small></div>${pill(s.b.status || 'Active', ST[s.b.status || 'Active'] || 't-neu')}</div>
    <div class="st"><div><span>Products</span><b>${num(s.products)}</b></div><div><span>Stock ${costs ? 'at cost' : 'at price'}</span><b>${inrS(s.stock)}</b></div><div><span>Net revenue</span><b>${inrS(s.taxable)}</b></div><div><span>Rating</span><b>${s.reviews ? s.rating.toFixed(1) + '★' : '—'}</b></div></div>
    <div class="ft"><span>™ ${esc(s.b.tmStatus || 'Not filed')}${s.b.tmClass ? ' · Class ' + esc(s.b.tmClass) : ''}</span><span>${s.b.managerId ? 'Lead: ' + esc(personName(s.b.managerId)) : 'No brand lead'}</span></div></button>`).join('')}</div>`;
  html += panel('Brand comparison', table('brandcmp', [
    { k: 'name', l: 'Brand', render: s => `<div class="cell-main">${brandTile(s.b)}<b>${esc(s.b.name)}</b></div>`, sort: s => s.b.name },
    { k: 'products', l: 'Products', num: 1, render: s => num(s.products) },
    { k: 'units', l: 'Units sold', num: 1, render: s => num(s.units) },
    { k: 'taxable', l: 'Net revenue', num: 1, render: s => inr(s.taxable) },
    { k: 'share', l: 'Share', render: s => `<div class="mcell">${meter(ratio(s.taxable, totalRev))}<span class="tnum">${pct(ratio(s.taxable, totalRev), 0)}</span></div>`, sort: s => s.taxable },
    { k: 'profit', l: 'Contribution', num: 1, cost: 1, render: s => `<span class="${s.profit < 0 ? 'neg' : ''}">${inr(s.profit)}</span>` },
    { k: 'margin', l: 'Margin', num: 1, cost: 1, render: s => pct(ratio(s.profit, s.taxable)), sort: s => ratio(s.profit, s.taxable) },
    { k: 'adSpend', l: 'Ad spend', num: 1, render: s => inr(s.adSpend) },
    { k: 'roas', l: 'ROAS', num: 1, render: s => s.adSpend ? s.roas.toFixed(1) + '×' : '—' },
  ], stats, { open: s => 'open:brand:' + s.b.id, sort: { k: 'taxable', dir: 'desc' } }), { flush: true, sub: rangeLabel() });
  return html;
};

/* ---------------- catalogue ---------------- */
V.catalogue = () => {
  const can = canEdit('catalogue'); const all = S.products.filter(inBrand);
  const st = filtOf('cat', 'active'); const pf = ui.filt.catplat || '';
  const cnt = k => all.filter(p => (p.status || 'active') === k).length;
  const rows = all.filter(p => (st === 'all' || (p.status || 'active') === st) && matchQ('cat', p.name, p.sku, p.variant, p.category, brandName(p.brandId)) && (() => { if (!pf) return true; const [m, k] = pf.split('|'); const s = ((p.listings || {})[k] || {}).status || 'none'; return m === 'live' ? s === 'live' : s !== 'live'; })());
  const acts = (can ? btn('Import CSV', 'import:products', { i: 'upload' }) : '') + exportBtn('exportcat', 'Export') + (can ? btn('Add product', 'new:product', { pri: true, i: 'plus' }) : '');
  let html = ph('Catalogue', 'Product master data, marketplace content and listing status for every platform.', acts);
  if (!S.brands.length) return html + panel('', empty('Add a brand first', 'Every product belongs to a brand. Create your brands, then add products here.', canEdit('brands') ? btn('Add brand', 'new:brand', { pri: true }) : ''));
  const ap = activePlatforms();
  html += `<div class="toolbar">${searchHTML('cat', 'Search name, SKU, category…')}${chipsHTML('cat', [['active', 'Active', cnt('active')], ['draft', 'Draft', cnt('draft')], ['archived', 'Archived', cnt('archived')], ['all', 'All', all.length]], st)}<span class="sp"></span><label class="sr" for="catplat">Listing filter</label><select class="inp" id="catplat" data-ch="filtsel" data-key="catplat" style="width:auto"><option value="">Any listing status</option>${ap.map(p => `<option value="live|${p.key}"${pf === 'live|' + p.key ? ' selected' : ''}>Live on ${esc(p.name)}</option><option value="not|${p.key}"${pf === 'not|' + p.key ? ' selected' : ''}>Not live on ${esc(p.name)}</option>`).join('')}</select></div>`;
  const LS = { live: 'live', draft: 'draft', suppressed: 'bad', inactive: 'off' };
  html += panel('', table('cat', [
    { k: 'name', l: 'Product', render: p => prodCell(p) + delPill('products', p.id) },
    { k: 'brand', l: 'Brand', render: p => esc(brandName(p.brandId)), sort: p => brandName(p.brandId) },
    { k: 'category', l: 'Category', render: p => esc(p.category || '—') },
    { k: 'sellingPrice', l: 'Price', num: 1, render: p => `${inr(p.sellingPrice)}${N(p.mrp) > N(p.sellingPrice) ? `<br><small class="muted"><s>${inr(p.mrp)}</s> MRP</small>` : ''}`, sort: p => N(p.sellingPrice) },
    { k: 'costPrice', l: 'Cost', num: 1, cost: 1, render: p => N(p.costPrice) ? inr(p.costPrice) : '<span class="muted">—</span>', sort: p => N(p.costPrice) },
    { k: 'gstRate', l: 'GST', num: 1, render: p => N(p.gstRate ?? 18) + '%' },
    { k: 'score', l: 'Content', render: p => { const s = contentScore(p).score; return `<div class="mcell">${meter(s / 100, s >= 70 ? 'good' : s >= 40 ? 'warn' : 'bad')}<span class="tnum">${s}</span></div>`; }, sort: p => contentScore(p).score },
    { k: 'list', l: 'Listings', nosort: 1, render: p => `<div class="dotrow">${ap.map(pl => { const s = ((p.listings || {})[pl.key] || {}).status || 'none'; return `<span class="ldot ${LS[s] || ''}" title="${esc(pl.name)}: ${esc((LIST_STATUS.find(x => x[0] === s) || [])[1] || s)}">${esc((pl.code || pl.name).slice(0, 3))}</span>`; }).join('')}</div>` },
    { k: 'status', l: 'Status', render: p => pill(({ active: 'Active', draft: 'Draft', archived: 'Archived' })[p.status || 'active'], ({ active: 't-good', draft: 't-info', archived: 't-neu' })[p.status || 'active']) },
  ], rows, { open: p => 'open:product:' + p.id, empty: all.length ? undefined : empty('No products yet', 'Add products one at a time or import a CSV with SKU, name, brand code and prices.', can ? btn('Import CSV', 'import:products') + ' ' + btn('Add product', 'new:product', { pri: true }) : '') }), { flush: true });
  html += `<p class="muted" style="margin:0;font-size:12px">Listing codes: ${ap.map(p => `<b>${esc((p.code || p.name).slice(0, 3))}</b> ${esc(p.name)}`).join(' · ')}. Green is live, blue is draft, amber is inactive, red is suppressed.</p>`;
  return html;
};

/* ---------------- inventory & purchasing ---------------- */
V.inventory = () => {
  const can = canEdit('inventory'); const tab = tabOf('inv', 'stock');
  const acts = tab === 'pos' ? (can ? btn('New purchase order', 'new:po', { pri: true, i: 'plus' }) : '') : tab === 'suppliers' ? (can ? btn('Add supplier', 'new:supplier', { pri: true, i: 'plus' }) : '') : (can ? btn('Record movement', 'new:move', { pri: true, i: 'plus' }) : '');
  let html = ph('Inventory & purchasing', 'On-hand stock is worked out from opening stock, stock movements, received purchase orders and the sales ledger, so it never drifts from your records.', acts);
  const openPO = S.pos.filter(p => p.status === 'ordered' || p.status === 'partial').length;
  html += tabsHTML('inv', [['stock', 'Stock levels'], ['moves', 'Movements'], ['pos', 'Purchase orders', openPO ? openPO + ' open' : ''], ['suppliers', 'Suppliers', S.suppliers.length]], tab);
  if (tab === 'moves') return html + invMoves();
  if (tab === 'pos') return html + invPOs();
  if (tab === 'suppliers') return html + invSuppliers();
  const ps = S.products.filter(p => inBrand(p) && p.status !== 'archived').map(p => ({ p, ...stockState(p) }));
  const inv = invValue(); const c = k => ps.filter(x => x.st === k).length; const costs = allow('costs');
  html += kpis([
    { l: 'Active SKUs', v: num(ps.length), s: num(new Set(ps.map(x => x.p.brandId)).size) + ' brands' },
    { l: 'Units on hand', v: num(inv.units), s: num(sum(ps, x => x.ord)) + ' on order' },
    costs ? { l: 'Value at cost', v: inrS(inv.cost), title: inr(inv.cost) } : { l: 'Overstock', v: num(c('over')) },
    { l: 'Value at price', v: inrS(inv.retail), title: inr(inv.retail), s: 'at selling price' },
    { l: 'Low stock', v: num(c('low')) },
    { l: 'Out of stock', v: num(c('out')) },
  ]);
  const f = filtOf('stock', 'all');
  const rows = ps.filter(x => (f === 'all' || x.st === f) && matchQ('inv', x.p.name, x.p.sku, x.p.location, brandName(x.p.brandId)));
  html += `<div class="toolbar">${searchHTML('inv', 'Search product, SKU, location…')}${chipsHTML('stock', [['all', 'All', ps.length], ['out', 'Out', c('out')], ['low', 'Low', c('low')], ['over', 'Overstock', c('over')], ['ok', 'Healthy', c('ok')]], f)}<span class="sp"></span>${exportBtn('exportstock', 'Export')}</div>`;
  html += panel('', table('stock', [
    { k: 'p', l: 'Product', render: x => prodCell(x.p), sort: x => x.p.name },
    { k: 'loc', l: 'Location', render: x => esc(x.p.location || '—'), sort: x => x.p.location || '' },
    { k: 'on', l: 'On hand', num: 1, render: x => `<b class="${x.on <= 0 ? 'neg' : ''}">${num(x.on)}</b>` },
    { k: 'ord', l: 'On order', num: 1, render: x => x.ord ? num(x.ord) : '—' },
    { k: 'rl', l: 'Reorder at', num: 1, render: x => num(x.rl) },
    { k: 'v', l: '30-day sales', num: 1, render: x => num(x.v) },
    { k: 'cover', l: 'Days left', num: 1, render: x => Number.isFinite(x.cover) ? num(x.cover) : '—' },
    { k: 'val', l: 'Value at cost', num: 1, cost: 1, render: x => inr(Math.max(0, x.on) * N(x.p.costPrice)), sort: x => Math.max(0, x.on) * N(x.p.costPrice) },
    { k: 'st', l: 'Status', render: x => pill(...STOCK_PILL[x.st]), sort: x => ({ out: 0, low: 1, ok: 2, over: 3 })[x.st] },
    { k: 'a', l: '', nosort: 1, render: x => can ? `<span style="display:inline-flex;gap:6px">${btn('Adjust', 'stockin:' + x.p.id, { sm: true })}${(x.st === 'low' || x.st === 'out') ? btn('Order', 'poprod:' + x.p.id, { sm: true }) : ''}</span>` : '' },
  ], rows, { sort: { k: 'st', dir: 'asc' }, empty: S.products.length ? undefined : empty('No products yet', 'Stock appears here once you add products in the Catalogue.', canEdit('catalogue') ? btn('Add product', 'new:product', { pri: true }) : '') }), { flush: true });
  return html;
};
function invMoves() {
  const r = periodRange(); const mt = Object.fromEntries(MOVE_TYPES.map(m => [m[0], m[1]]));
  const rows = [];
  S.moves.filter(m => inRange(m.date, r) && inBrand(m)).forEach(m => rows.push({ id: m.id, kind: 'move', date: m.date, type: m.poId ? 'PO receipt' : (mt[m.type] || m.type), tone: N(m.qty) >= 0 ? 't-good' : 't-bad', productId: m.productId, qty: N(m.qty), ref: [m.ref, m.supplier].filter(Boolean).join(' · '), by: m.createdBy }));
  S.sales.filter(s => inRange(s.date, r) && inBrand(s)).forEach(s => { const out = saleStockOut(s); const lbl = s.status === 'returned' ? (s.restocked === false ? 'Return (not restocked)' : 'Return (restocked)') : s.status === 'cancelled' ? 'Cancelled sale' : 'Sale · ' + PL(s.platform).name; rows.push({ id: s.id, kind: 'sale', date: s.date, type: lbl, tone: 't-neu', productId: s.productId, qty: -out, ref: s.orderRef || '', by: s.createdBy }); });
  const f = filtOf('mv', 'all'); const shown = rows.filter(x => f === 'all' || x.kind === f).filter(x => matchQ('mv', (prodOf(x.productId) || {}).name, (prodOf(x.productId) || {}).sku, x.ref, x.type));
  let html = `<div class="toolbar">${searchHTML('mv', 'Search product, reference…')}${chipsHTML('mv', [['all', 'All', rows.length], ['move', 'Stock movements', rows.filter(x => x.kind === 'move').length], ['sale', 'From sales ledger', rows.filter(x => x.kind === 'sale').length]], f)}</div>`;
  html += panel('', table('moves', [
    { k: 'date', l: 'Date', render: x => `<span class="tnum">${esc(fmtD(x.date))}</span>` },
    { k: 'type', l: 'Type', render: x => pill(x.type, x.tone, 1) },
    { k: 'p', l: 'Product', render: x => prodCell(prodOf(x.productId)) + (x.kind === 'move' ? delPill('moves', x.id) : ''), sort: x => (prodOf(x.productId) || {}).name },
    { k: 'qty', l: 'Qty', num: 1, render: x => `<b class="${x.qty < 0 ? 'neg' : x.qty > 0 ? 'pos' : ''}">${x.qty > 0 ? '+' : ''}${num(x.qty)}</b>` },
    { k: 'ref', l: 'Reference', render: x => esc(x.ref || '—') },
    { k: 'by', l: 'By', render: x => x.by ? esc(personName(x.by)) : '—', sort: x => personName(x.by) },
  ], shown, { sort: { k: 'date', dir: 'desc' }, limit: 100, open: x => x.kind === 'move' ? 'open:move:' + x.id : (canView('finance') && secOK('sales') ? 'open:sale:' + x.id : ''), empty: empty('No movements in this period', 'Purchases, adjustments and sales for the selected period appear here.') }), { flush: true });
  return html;
}
const PO_TONE = { draft: 't-neu', ordered: 't-info', partial: 't-warn', received: 't-good', cancelled: 't-neu' };
function invPOs() {
  const all = S.pos.filter(p => brandAll() || (p.lines || []).some(l => inBrand({ productId: l.productId }))); const open = all.filter(p => p.status === 'ordered' || p.status === 'partial');
  const late = open.filter(p => p.expectedDate && p.expectedDate < TODAY());
  let html = kpis([
    { l: 'Open orders', v: num(open.length), s: num(all.filter(p => p.status === 'draft').length) + ' drafts' },
    { l: 'Value on order', v: allow('costs') ? inrS(sum(open, p => sum(p.lines || [], l => Math.max(0, N(l.qty) - N(l.received)) * N(l.cost)))) : '—', s: 'ex-GST, not yet received' },
    { l: 'Late deliveries', v: num(late.length), s: late.length ? 'past the expected date' : 'none late' },
    { l: 'Suppliers', v: num(S.suppliers.length) },
  ], 'k4');
  const f = filtOf('pof', 'open'); const rows = all.filter(p => (f === 'all' || (f === 'open' ? (p.status === 'ordered' || p.status === 'partial' || p.status === 'draft') : p.status === f)) && matchQ('po', p.number, (supOf(p.supplierId) || {}).name, p.notes));
  html += `<div class="toolbar">${searchHTML('po', 'Search PO number, supplier…')}${chipsHTML('pof', [['open', 'Open & drafts'], ['received', 'Received'], ['cancelled', 'Cancelled'], ['all', 'All', all.length]], f)}</div>`;
  html += panel('', table('pos', [
    { k: 'number', l: 'PO', render: p => `<span class="mono"><b>${esc(p.number)}</b></span>${delPill('pos', p.id)}` },
    { k: 'sup', l: 'Supplier', render: p => esc((supOf(p.supplierId) || {}).name || '—'), sort: p => (supOf(p.supplierId) || {}).name || '' },
    { k: 'date', l: 'Ordered', render: p => esc(fmtD(p.date)) },
    { k: 'expectedDate', l: 'Expected', render: p => `${esc(fmtD(p.expectedDate))}${(p.status === 'ordered' || p.status === 'partial') && p.expectedDate && p.expectedDate < TODAY() ? ' ' + pill('Late', 't-bad', 1) : ''}` },
    { k: 'items', l: 'Items', num: 1, render: p => num((p.lines || []).length) + ' / ' + num(sum(p.lines || [], l => l.qty)) + ' units', sort: p => sum(p.lines || [], l => l.qty) },
    { k: 'value', l: 'Value', num: 1, cost: 1, render: p => inr(poValue(p)), sort: p => poValue(p) },
    { k: 'rec', l: 'Received', render: p => `<div class="mcell">${meter(poReceivedPct(p), poReceivedPct(p) >= 1 ? 'good' : '')}<span class="tnum">${pct(poReceivedPct(p), 0)}</span></div>`, sort: p => poReceivedPct(p) },
    { k: 'status', l: 'Status', render: p => pill((PO_STATUS.find(s => s[0] === p.status) || [, p.status])[1], PO_TONE[p.status] || 't-neu') },
  ], rows, { sort: { k: 'date', dir: 'desc' }, open: p => 'open:po:' + p.id, empty: empty('No purchase orders here', 'Raise a PO to a supplier, then receive it in one click to add the stock.', canEdit('inventory') ? btn('New purchase order', 'new:po', { pri: true }) : '') }), { flush: true });
  return html;
}
function invSuppliers() {
  const rows = S.suppliers.filter(s => matchQ('sup', s.name, s.contact, s.city, s.categories, s.gstin)).map(s => { const ps = S.pos.filter(p => p.supplierId === s.id); return { s, open: ps.filter(p => p.status === 'ordered' || p.status === 'partial').length, total: sum(ps, p => sum(p.lines || [], l => N(l.received) * N(l.cost))), last: ps.reduce((m, p) => p.date > m ? p.date : m, '') }; });
  let html = `<div class="toolbar">${searchHTML('sup', 'Search supplier, contact, city…')}</div>`;
  html += panel('', table('sups', [
    { k: 'name', l: 'Supplier', render: x => `<b>${esc(x.s.name)}</b>${delPill('suppliers', x.s.id)}<br><small class="muted">${esc(x.s.categories || '')}</small>`, sort: x => x.s.name },
    { k: 'contact', l: 'Contact', render: x => `${esc(x.s.contact || '—')}<br><small class="muted">${esc([x.s.phone, x.s.email].filter(Boolean).join(' · '))}</small>`, sort: x => x.s.contact || '' },
    { k: 'loc', l: 'Location', render: x => esc([x.s.city, x.s.state].filter(Boolean).join(', ') || '—') },
    { k: 'terms', l: 'Terms', render: x => esc(x.s.terms || '—') },
    { k: 'lead', l: 'Lead time', num: 1, render: x => x.s.leadTime ? num(x.s.leadTime) + ' days' : '—', sort: x => N(x.s.leadTime) },
    { k: 'open', l: 'Open POs', num: 1, render: x => num(x.open) },
    { k: 'total', l: 'Received value', num: 1, cost: 1, render: x => inr(x.total) },
    { k: 'last', l: 'Last order', render: x => esc(x.last ? fmtD(x.last) : '—') },
  ], rows, { sort: { k: 'total', dir: 'desc' }, open: x => 'open:supplier:' + x.s.id, empty: empty('No suppliers yet', 'Keep vendor contacts, GSTIN, payment terms and lead times in one place, then raise POs to them.', canEdit('inventory') ? btn('Add supplier', 'new:supplier', { pri: true }) : '') }), { flush: true });
  return html;
}

/* ---------------- revenue calculator ---------------- */
V.calculator = () => {
  const c = ui.calc; const prods = S.products.filter(inBrand).sort((a, b) => (a.name > b.name ? 1 : -1)); const p = prodOf(c.productId); const costs = allow('costs');
  const plats = activePlatforms();
  const rows = plats.map(pl => {
    const price = c.usePlat && p && N(((p.listings || {})[pl.key] || {}).price) ? N(p.listings[pl.key].price) : N(c.price);
    const args = { price, gst: c.gst, cost: costs ? c.cost : 0, pack: c.pack, weight: c.weight, plat: pl, ads: c.ads, ret: c.ret };
    return { pl, e: unitEcon(args), be: solvePrice({ ...args }, 0), tp: solvePrice({ ...args }, N(c.target) / 100) };
  });
  const best = rows.reduce((a, b) => (!a || (costs ? b.e.profit > a.e.profit : b.e.settlement > a.e.settlement)) ? b : a, null);
  const inp = (k, l, pre, suf, step = 'any') => `<label>${esc(l)}<div class="affix${pre ? ' hp' : ''}${suf ? ' hs' : ''}">${pre ? `<span class="pre">${pre}</span>` : ''}<input class="inp tnum" type="number" inputmode="decimal" step="${step}" id="calc-${k}" data-in="calc" data-key="${k}" value="${esc(c[k])}">${suf ? `<span class="suf">${suf}</span>` : ''}</div></label>`;
  let html = ph('Revenue calculator', 'Per-unit economics on every platform: commission, closing and shipping fees, 18% GST on fees, TCS and TDS under section 194-O.', btn(canEdit('calculator') ? 'Edit fee settings' : 'Fee settings', 'feesettings', { i: 'calc' }));
  const inputs = `<div class="inputs">
    <label>Product<select class="inp" id="calc-prod" data-ch="calcprod"><option value="">Custom numbers</option>${prods.map(x => `<option value="${esc(x.id)}"${x.id === c.productId ? ' selected' : ''}>${esc(x.sku ? x.sku + ' · ' : '')}${esc(x.name)}</option>`).join('')}</select></label>
    ${p ? `<label class="chk" style="flex-direction:row;font-weight:500"><input type="checkbox" id="calc-useplat" data-ch="calcuseplat"${c.usePlat ? ' checked' : ''}> Use each platform’s listed price</label>` : ''}
    ${inp('price', 'Selling price (incl. GST)', '₹')}
    <div class="two">${costs ? inp('cost', 'Cost price (ex-GST)', '₹') : ''}${inp('pack', 'Packaging', '₹')}</div>
    <div class="two">${inp('weight', 'Shipping weight', '', 'g', '10')}<label>GST rate<select class="inp" id="calc-gst" data-ch="calcgst">${GST_RATES.map(g => `<option value="${g}"${N(c.gst) === g ? ' selected' : ''}>${g}%</option>`).join('')}</select></label></div>
    <div class="two">${inp('ads', 'Ad spend per unit', '₹')}${inp('ret', 'Expected returns', '', '%', '0.5')}</div>
    ${costs ? inp('target', 'Target margin on price', '', '%', '1') : ''}
  </div>`;
  const callout = best ? `<div class="callout"><div><div class="eyebrow">${costs ? 'Most profitable' : 'Highest payout'}</div><div class="big">${esc(best.pl.name)}: ${inr(costs ? best.e.profit : best.e.settlement)} per unit</div></div><span class="muted">${costs ? pct(best.e.margin) + ' of the selling price' + (best.e.profit < 0 ? '. Every platform loses money at these numbers.' : '') : 'bank settlement after fees, GST on fees, TCS and TDS'}</span></div>` : '';
  const M = [
    ['Selling price', x => inr(x.e.price, 2), 'b'], ['Taxable value (ex-GST)', x => inr(x.e.taxable, 2)], ['Output GST', x => inr(x.e.outGST, 2)],
    ['Commission', x => inr(x.e.commission, 2)], ['Fixed / closing fee', x => inr(x.e.fixed, 2)], ['Shipping', x => inr(x.e.shipping, 2)], ['Collection fee', x => inr(x.e.collection, 2)], ['GST on fees', x => inr(x.e.gstOnFees, 2)], ['TCS', x => inr(x.e.tcs, 2)], ['TDS (194-O)', x => inr(x.e.tds, 2)],
    ['Bank settlement', x => inr(x.e.settlement, 2), 'b'],
    ['Cost price', x => inr(x.e.cost, 2), '', 1], ['Packaging', x => inr(x.e.pack, 2)], ['Ad spend', x => inr(x.e.ads, 2)], ['Returns provision', x => inr(x.e.returnsLoss, 2)],
    ['Net profit per unit', x => `<span class="${x.e.profit < 0 ? 'neg' : 'pos'}">${inr(x.e.profit, 2)}</span>`, 'b', 1], ['Margin on price', x => pct(x.e.margin), 'b', 1],
    ['Breakeven price', x => x.be === null ? '—' : inr(Math.ceil(x.be)), '', 1], [`Price for ${N(c.target)}% margin`, x => x.tp === null ? 'Not reachable' : inr(Math.ceil(x.tp)), '', 1],
  ].filter(m => costs || !m[3]);
  const tbl = `<div class="tw"><table class="t"><thead><tr><th>Per unit</th>${rows.map(x => `<th class="num${x === best ? ' best' : ''}">${esc(x.pl.name)}</th>`).join('')}</tr></thead><tbody>${M.map(([l, f, b]) => `<tr><td${b ? ' style="font-weight:700"' : ''}>${esc(l)}</td>${rows.map(x => `<td class="num${x === best && b ? ' best' : ''}"${b ? ' style="font-weight:700"' : ''}>${f(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  let stack = '';
  if (costs) {
    const SEG = [['cost', 'Cost price', 'c7'], ['pack', 'Packaging', 'c8'], ['fees', 'Platform fees', 'c4'], ['ads', 'Ads', 'c3'], ['returnsLoss', 'Returns', 'c6'], ['outGST', 'GST', 'c5']];
    const maxT = Math.max(1, ...rows.map(x => Math.max(x.e.price, x.e.price - x.e.profit)));
    stack = panel('Where each rupee of the price goes', `<div style="display:flex;flex-direction:column;gap:10px">${rows.map(x => { const segs = SEG.map(([k, , col]) => `<i style="--bc:var(--${col});width:${(Math.max(0, x.e[k]) / maxT * 100).toFixed(2)}%" title="${esc(k)}: ${esc(inr(x.e[k], 2))}"></i>`).join('') + (x.e.profit > 0 ? `<i style="--bc:var(--good);width:${(x.e.profit / maxT * 100).toFixed(2)}%" title="Profit ${esc(inr(x.e.profit, 2))}"></i>` : ''); return `<div class="stack-r"><span>${esc(x.pl.name)}</span><div class="stack">${segs}</div><span class="val ${x.e.profit < 0 ? 'neg' : 'pos'}">${inr(x.e.profit)}</span></div>`; }).join('')}</div><div class="legend" style="margin-top:12px">${SEG.map(([, l, col]) => `<span style="--bc:var(--${col})"><i></i>${l}</span>`).join('')}<span style="--bc:var(--good)"><i></i>Profit</span></div>`);
  }
  html += `<div class="calc">${panel('Inputs', inputs)}<div class="col">${callout}${panel('Platform comparison', tbl, { flush: true })}${stack}</div></div>`;
  html += `<p class="muted" style="margin:0;font-size:12px;max-width:90ch">Fee rates are editable examples, not the marketplaces’ published rate cards. Amazon and Flipkart vary commission and closing fees by category and price band, so enter the rates from your own seller contracts in Fee settings. GST on fees, TCS and TDS are deducted from the payout but come back as input tax credit and tax credits, so they reduce cash at settlement, not profit.${costs ? '' : ' Cost and profit rows are hidden for your role.'}</p>`;
  return html;
};
