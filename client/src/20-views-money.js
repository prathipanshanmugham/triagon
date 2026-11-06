/* =====================================================================
   Views: finance & assets, reports, marketing, customers & reviews
   ===================================================================== */
const SALE_TONE = { delivered: 't-good', transit: 't-info', returned: 't-warn', cancelled: 't-neu' };
const saleLabel = s => (SALE_STATUS.find(x => x[0] === s) || [s, s])[1];

/* ---------------- finance ---------------- */
V.finance = () => {
  const can = canEdit('finance'); const secs = finSecs();
  if (!secs.length) return ph('Finance & assets', '') + panel('', empty('No finance sections for your role', 'Ask the CEO to turn on the finance sections you need in Users & permissions.'));
  const keys = secs.map(s => s[0]); const tab = keys.includes(ui.tab.fin) ? ui.tab.fin : keys[0];
  const A = {
    pnl: '', sales: (can ? btn('Import sales CSV', 'import:sales', { i: 'upload' }) + btn('Record sale', 'new:sale', { pri: true, i: 'plus' }) : ''),
    expenses: can ? btn('Add expense', 'new:expense', { pri: true, i: 'plus' }) : '', recurring: can ? btn('Add recurring expense', 'new:recurring', { pri: true, i: 'plus' }) : '',
    payouts: can ? btn('Record payout', 'new:payout', { pri: true, i: 'plus' }) : '', assets: can ? btn('Add asset', 'new:asset', { pri: true, i: 'plus' }) : '',
  };
  let html = ph('Finance & assets', 'Sales, one-off and recurring expenses, platform payouts, fixed assets and a profit & loss statement with a GST view.', A[tab]);
  const od = S.recurring.filter(x => inBrand(x) && x.active !== false && !x.autoPost && overdueDates(x).length).length;
  html += tabsHTML('fin', secs.map(([k, l]) => [k, k === 'pnl' ? 'Profit & loss' : l, k === 'recurring' && od ? od + ' due' : undefined]), tab);
  return html + ({ pnl: finPnl, sales: finSales, expenses: finExpenses, recurring: finRecurring, payouts: finPayouts, assets: finAssets }[tab])();
};
function finPnl() {
  if (!allow('costs')) return panel('', empty('Profit figures are hidden for your role', 'Your role doesn’t include cost prices, margins and profit. Ask the CEO if you need them.'));
  const r = periodRange(), pr = prevRange(); const P = pnl(r), Q = pr ? pnl(pr) : null; const d = k => Q ? deltaOf(P[k], Q[k]) : undefined;
  let html = kpis([
    { l: 'Net revenue', v: inrS(P.taxable), d: d('taxable'), s: 'ex-GST', title: inr(P.taxable) },
    { l: 'Gross profit', v: inrS(P.gp), d: d('gp'), s: pct(ratio(P.gp, P.taxable), 0) + ' GP', title: inr(P.gp) },
    { l: 'Contribution', v: inrS(P.contribution), d: d('contribution'), s: pct(ratio(P.contribution, P.taxable), 0) + ' after fees', title: inr(P.contribution) },
    { l: 'Expenses & dep.', v: inrS(P.expenses + P.dep), d: deltaOf(P.expenses + P.dep, Q ? Q.expenses + Q.dep : null), inv: true, s: inrS(P.dep) + ' depreciation', title: inr(P.expenses + P.dep) },
    { l: 'Net profit', v: inrS(P.net), tone: P.net < 0 ? 'neg' : '', d: d('net'), s: pct(ratio(P.net, P.taxable), 0) + ' net margin', title: inr(P.net) },
    { l: 'Net GST payable', v: inrS(Math.max(0, P.gstPayable)), s: P.gstPayable < 0 ? inrS(-P.gstPayable) + ' credit' : 'estimate', title: inr(P.gstPayable) },
  ]);
  const rows = [['Gross sales (incl. GST)', P.gross, ''], ['Less returns', -P.returns, 'ind'], ['Net sales (incl. GST)', P.netSales, 'sub'], ['Less output GST', -P.outGST, 'ind'], ['Net revenue', P.taxable, 'sub'], ['Less cost of goods sold', -P.cogs, 'ind'], ['Gross profit', P.gp, 'sub'], ['Less platform fees, shipping & returns', -P.fees, 'ind'], ['Less packaging', -P.pack, 'ind'], ['Contribution margin', P.contribution, 'sub']];
  Object.entries(P.exByCat).map(([k, l]) => [k, sum(l, e => e.amount)]).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => rows.push(['Less ' + k.toLowerCase(), -v, 'ind']));
  if (P.dep) rows.push(['Less depreciation on assets', -P.dep, 'ind']);
  rows.push(['Net profit', P.net, 'tot']);
  const stmt = `<div class="tw"><table class="stmt">${rows.map(([l, v, c]) => `<tr class="${c}"><td>${esc(l)}</td><td class="num ${v < 0 && c !== 'ind' ? 'neg' : ''}">${inr(v)}</td><td class="num pc">${P.taxable ? pct(ratio(v, P.taxable), 0) : ''}</td></tr>`).join('')}</table></div>`;
  const note = !brandAll() ? '<p class="muted" style="margin:12px 16px;font-size:12px">A single brand is selected, so expenses and assets shared across brands are left out.</p>' : '';
  const gst = `<div class="list">${[['Output GST on sales', P.outGST], ['Input credit on platform fees', -P.gstOnFees], ['Input credit on expenses', -P.expGST], ['Net GST payable (estimate)', P.gstPayable], ['TCS collected by platforms', P.tcs], ['TDS deducted u/s 194-O', P.tds]].map(([l, v], i) => `<div class="li"><div class="grow"><b style="font-weight:${i === 3 ? 700 : 500}">${esc(l)}</b></div><span class="tnum" style="font-weight:${i === 3 ? 700 : 500}">${inr(v)}</span></div>`).join('')}</div><p class="muted" style="margin:0;padding:10px 16px 14px;font-size:12px">Worked out from the entries recorded here. TCS and TDS show up as credits in your GST and income-tax ledgers. File returns from your accountant’s books.</p>`;
  const byP = salesGrouped(r, s => s.platform).sort((a, b) => b.taxable - a.taxable);
  const pt = table('pnlplat', [
    { k: 'k', l: 'Platform', render: x => platPill(x.k), sort: x => PL(x.k).name },
    { k: 'units', l: 'Units', num: 1, render: x => num(x.units) },
    { k: 'taxable', l: 'Net revenue', num: 1, render: x => inr(x.taxable) },
    { k: 'fees', l: 'Fees', num: 1, render: x => inr(x.fees) },
    { k: 'profit', l: 'Contribution', num: 1, render: x => `<span class="${x.profit < 0 ? 'neg' : ''}">${inr(x.profit)}</span>` },
    { k: 'm', l: 'Margin', num: 1, render: x => pct(ratio(x.profit, x.taxable)), sort: x => ratio(x.profit, x.taxable) },
  ], byP, { empty: empty('No sales in this period', 'Record sales to see platform profitability.') });
  html += `<div class="g31">${panel('Profit & loss statement', stmt + note, { flush: true, sub: rangeLabel() })}<div class="col">${panel('GST and tax credits', gst, { flush: true })}${panel('By platform', pt, { flush: true })}</div></div>`;
  return html;
}
function finSales() {
  const r = periodRange(); const all = salesIn(r); const st = filtOf('sst', 'all'); const pf = ui.filt.splat || '';
  const rows = all.filter(s => (st === 'all' || s.status === st) && (!pf || s.platform === pf) && matchQ('sales', s.orderRef, (prodOf(s.productId) || {}).name, (prodOf(s.productId) || {}).sku, (custOf(s.customerId) || {}).name)).map(s => ({ s, f: saleFin(s) }));
  const c = k => all.filter(s => s.status === k).length; const T = finSum(rows.map(x => x.s));
  let html = `<div class="toolbar">${searchHTML('sales', 'Search order ref, product, customer…')}${chipsHTML('sst', [['all', 'All', all.length], ...SALE_STATUS.map(([k, l]) => [k, l, c(k)])], st)}<span class="sp"></span><label class="sr" for="splat">Platform</label><select class="inp" id="splat" data-ch="filtsel" data-key="splat" style="width:auto"><option value="">All platforms</option>${platforms().map(p => `<option value="${esc(p.key)}"${pf === p.key ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>${exportBtn('exportsales', 'Export')}</div>`;
  html += panel('', table('sales', [
    { k: 'date', l: 'Date', render: x => `<span class="tnum">${esc(fmtD(x.s.date))}</span>`, sort: x => x.s.date },
    { k: 'ref', l: 'Order ref', render: x => `<span class="mono">${esc(x.s.orderRef || '—')}</span>${delPill('sales', x.s.id)}`, sort: x => x.s.orderRef || '' },
    { k: 'pl', l: 'Platform', render: x => platPill(x.s.platform), sort: x => PL(x.s.platform).name },
    { k: 'p', l: 'Product', render: x => prodCell(prodOf(x.s.productId)), sort: x => (prodOf(x.s.productId) || {}).name },
    { k: 'qty', l: 'Qty', num: 1, render: x => num(x.s.qty), sort: x => N(x.s.qty) },
    { k: 'up', l: 'Unit price', num: 1, render: x => inr(x.s.unitPrice), sort: x => N(x.s.unitPrice) },
    { k: 'gross', l: 'Gross', num: 1, render: x => inr(x.f.gross), sort: x => x.f.gross },
    { k: 'fees', l: 'Fees + GST', num: 1, render: x => inr(x.f.fees + x.f.gstOnFees), sort: x => x.f.fees },
    { k: 'set', l: 'Settlement', num: 1, render: x => inr(x.f.settlement), sort: x => x.f.settlement },
    { k: 'profit', l: 'Contribution', num: 1, cost: 1, render: x => `<span class="${x.f.profit < 0 ? 'neg' : ''}">${inr(x.f.profit)}</span>`, sort: x => x.f.profit },
    { k: 'st', l: 'Status', render: x => pill(saleLabel(x.s.status), SALE_TONE[x.s.status] || 't-neu'), sort: x => x.s.status },
  ], rows, { sort: { k: 'date', dir: 'desc' }, limit: 150, open: x => 'open:sale:' + x.s.id, foot: { date: 'Total', qty: num(sum(rows, x => x.s.qty)), gross: inr(T.gross), fees: inr(T.fees + T.gstOnFees), set: inr(T.settlement), profit: inr(T.profit) }, empty: empty('No sales in this period', 'Record each order, or a day’s orders per SKU and platform as one entry with a quantity.', canEdit('finance') ? btn('Record sale', 'new:sale', { pri: true }) : '') }), { flush: true });
  return html;
}
function finExpenses() {
  const r = periodRange(); const all = expensesIn(r); const f = filtOf('exk', 'all');
  const rows = all.filter(e => (f === 'all' || (f === 'rec' ? !!e.recurringId : !e.recurringId)) && matchQ('exp', e.category, e.vendor, e.note, e.ref));
  const byCat = Object.entries(groupBy(all, e => e.category || 'Other')).map(([k, l]) => ({ l: k, v: sum(l, e => e.amount), c: SWATCHES[EXP_CATS.indexOf(k) % 8] || 'c8' })).sort((a, b) => b.v - a.v);
  const recTot = sum(all.filter(e => e.recurringId), e => e.amount);
  return `<div class="g31"><div class="col" style="gap:12px"><div class="toolbar">${searchHTML('exp', 'Search category, vendor, note…')}${chipsHTML('exk', [['all', 'All', all.length], ['oneoff', 'One-off', all.filter(e => !e.recurringId).length], ['rec', 'Recurring', all.filter(e => e.recurringId).length]], f)}<span class="sp"></span>${exportBtn('exportexp', 'Export')}</div>${panel('', table('exp', [
    { k: 'date', l: 'Date', render: e => `<span class="tnum">${esc(fmtD(e.date))}</span>` },
    { k: 'category', l: 'Category', render: e => `${esc(e.category || 'Other')}${e.recurringId ? ' ' + pill('Recurring', 't-info', 1) : ''}${delPill('expenses', e.id)}` },
    { k: 'vendor', l: 'Vendor / note', render: e => `${esc(e.vendor || '—')}${e.note ? `<br><small class="muted">${esc(String(e.note).slice(0, 60))}</small>` : ''}`, sort: e => e.vendor || '' },
    { k: 'brand', l: 'Brand', render: e => e.brandId ? esc(brandName(e.brandId)) : '<span class="muted">Shared</span>', sort: e => brandName(e.brandId) },
    { k: 'amount', l: 'Amount', num: 1, render: e => inr(e.amount), sort: e => N(e.amount) },
    { k: 'gst', l: 'GST (ITC)', num: 1, render: e => N(e.gst) ? inr(e.gst) : '—', sort: e => N(e.gst) },
    { k: 'paidVia', l: 'Paid via', render: e => esc(e.paidVia || '—') },
  ], rows, { sort: { k: 'date', dir: 'desc' }, limit: 100, open: e => 'open:expense:' + e.id, foot: { date: 'Total', amount: inr(sum(rows, e => e.amount)), gst: inr(sum(rows, e => e.gst)) }, empty: empty('No expenses here', 'Add salaries, rent, ad invoices and other running costs so the P&L shows real net profit. Bills that repeat belong under Recurring expenses.', canEdit('finance') ? btn('Add expense', 'new:expense', { pri: true }) : '') }), { flush: true })}</div><div class="col">${panel('By category', hbars(byCat), { sub: inrS(sum(all, e => e.amount)) + ' total' })}${panel('', `<div class="li" style="padding:0;border:0"><div class="grow"><b>${inr(recTot)} from recurring bills</b><small>${pct(ratio(recTot, sum(all, e => e.amount)), 0)} of this period’s expenses</small></div>${secOK('recurring') ? btn('Recurring', 'fintab:recurring', { sm: true }) : ''}</div>`)}</div></div>`;
}
function finRecurring() {
  const list = S.recurring.filter(inBrand); const act = list.filter(x => x.active !== false && (!x.endDate || x.endDate >= TODAY()));
  const in30 = act.flatMap(x => dueDates(x, addDays(TODAY(), 1), addDays(TODAY(), 30)).map(d => ({ x, d })));
  const od = act.filter(x => !x.autoPost && overdueDates(x).length);
  let html = kpis([
    { l: 'Active schedules', v: num(act.length), s: num(act.filter(x => x.autoPost).length) + ' post automatically' },
    { l: 'Monthly commitment', v: inrS(sum(act, monthlyEquiv)), s: inrS(sum(act, monthlyEquiv) * 12) + ' a year', title: inr(sum(act, monthlyEquiv)) },
    { l: 'Due in 30 days', v: inrS(sum(in30, y => y.x.amount)), s: num(in30.length) + ' bills' },
    { l: 'Overdue', v: num(od.length), tone: od.length ? 'neg' : '', s: od.length ? inrS(sum(od, x => N(x.amount) * overdueDates(x).length)) + ' unpaid' : 'nothing overdue' },
  ], 'k4');
  const RS = x => x.active === false ? ['Paused', 't-neu'] : (x.endDate && x.endDate < TODAY()) ? ['Ended', 't-neu'] : (!x.autoPost && overdueDates(x).length) ? ['Overdue', 't-bad'] : ['Active', 't-good'];
  const tbl = table('rec', [
    { k: 'name', l: 'Bill', render: x => `<b>${esc(x.name)}</b>${delPill('recurring', x.id)}<br><small class="muted">${esc(x.category || '')}${x.vendor ? ' · ' + esc(x.vendor) : ''}</small>`, sort: x => x.name },
    { k: 'freq', l: 'Repeats', render: x => esc(freqOf(x.frequency)[1]) + (x.frequency !== 'weekly' ? `<br><small class="muted">on day ${N(x.day) || parseD(x.startDate).getDate()}</small>` : ''), sort: x => freqOf(x.frequency)[2] },
    { k: 'amount', l: 'Amount', num: 1, render: x => inr(x.amount), sort: x => N(x.amount) },
    { k: 'm', l: 'Per month', num: 1, render: x => inr(monthlyEquiv(x)), sort: x => monthlyEquiv(x) },
    { k: 'next', l: 'Next due', render: x => { const o = !x.autoPost ? overdueDates(x) : []; return o.length ? `<span class="neg"><b>${esc(fmtD(o[0]))}</b></span>${o.length > 1 ? ` <small class="muted">+${o.length - 1}</small>` : ''}` : esc(fmtD(nextDue(x))); }, sort: x => (!x.autoPost && overdueDates(x)[0]) || nextDue(x) || '9' },
    { k: 'auto', l: 'Posting', render: x => x.autoPost ? pill('Automatic', 't-info', 1) : pill('Manual', 't-neu', 1), sort: x => x.autoPost ? 0 : 1 },
    { k: 'st', l: 'Status', render: x => pill(...RS(x)), sort: x => RS(x)[0] },
    { k: 'a', l: '', nosort: 1, render: x => (canEdit('finance') && !x.autoPost && x.active !== false && overdueDates(x).length) ? btn('Mark paid', 'recpost:' + x.id, { sm: true }) : '' },
  ], list, { sort: { k: 'next', dir: 'asc' }, open: x => 'open:recurring:' + x.id, empty: empty('No recurring expenses yet', 'Add rent, salaries, software subscriptions, insurance and EMIs once. Automatic ones post to Expenses on their due date; manual ones wait for you to mark them paid.', canEdit('finance') ? btn('Add recurring expense', 'new:recurring', { pri: true }) : '') });
  const up = act.flatMap(x => dueDates(x, TODAY(), addDays(TODAY(), 60)).map(d => ({ x, d }))).sort((a, b) => a.d < b.d ? -1 : 1).slice(0, 12);
  const upList = up.length ? `<div class="list">${up.map(y => `<div class="li"><span class="tnum muted" style="width:56px;flex:none">${esc(fmtDs(y.d))}</span><div class="grow"><b>${esc(y.x.name)}</b><small>${esc(y.x.category || '')}${y.x.autoPost ? ' · posts automatically' : ''}</small></div><span class="tnum" style="font-weight:600">${inr(y.x.amount)}</span></div>`).join('')}</div>` : empty('Nothing due', 'No recurring bills fall in the next 60 days.');
  return html + panel('', tbl, { flush: true }) + panel('Coming up, next 60 days', upList, { flush: true });
}
function finPayouts() {
  const r = periodRange(); const pays = S.payouts.filter(p => inRange(p.date, r));
  const exp = Object.fromEntries(salesGrouped(r, s => s.platform).map(x => [x.k, x.settlement]));
  const keys = Array.from(new Set([...Object.keys(exp), ...pays.map(p => p.platform)]));
  const rows = keys.map(k => { const rec = sum(pays.filter(p => p.platform === k), p => p.amount); const e = exp[k] || 0; return { k, e, rec, gap: e - rec, gp: ratio(e - rec, e) }; }).sort((a, b) => b.e - a.e);
  const E = sum(rows, x => x.e), Rv = sum(rows, x => x.rec);
  let html = kpis([
    { l: 'Expected settlement', v: inrS(E), s: 'from sales in the period', title: inr(E) },
    { l: 'Received', v: inrS(Rv), s: num(pays.length) + ' payouts', title: inr(Rv) },
    { l: 'Difference', v: inrS(E - Rv), tone: E - Rv > 0.02 * E ? 'neg' : '', s: pct(ratio(E - Rv, E)) + ' of expected', title: inr(E - Rv) },
    { l: 'Platforms to check', v: num(rows.filter(x => Math.abs(x.gp) > 0.02 && x.e).length), s: 'gap above 2%' },
  ], 'k4');
  const recon = table('recon', [
    { k: 'k', l: 'Platform', render: x => platPill(x.k), sort: x => PL(x.k).name },
    { k: 'e', l: 'Expected', num: 1, render: x => inr(x.e) }, { k: 'rec', l: 'Received', num: 1, render: x => inr(x.rec) },
    { k: 'gap', l: 'Difference', num: 1, render: x => `<span class="${x.gap > 0.02 * x.e ? 'neg' : ''}">${inr(x.gap)}</span>` },
    { k: 'st', l: 'Check', render: x => !x.e ? pill('No sales', 't-neu', 1) : Math.abs(x.gp) <= 0.02 ? pill('Matches', 't-good', 1) : x.gap > 0 ? pill('Short ' + pct(x.gp, 0), 't-bad', 1) : pill('Over ' + pct(-x.gp, 0), 't-info', 1), sort: x => x.gp },
  ], rows, { empty: empty('Nothing to reconcile', 'Record sales and the payouts that hit your bank to compare them.') });
  const list = table('payouts', [
    { k: 'date', l: 'Date', render: p => esc(fmtD(p.date)) }, { k: 'pl', l: 'Platform', render: p => platPill(p.platform), sort: p => PL(p.platform).name },
    { k: 'ref', l: 'UTR / reference', render: p => `<span class="mono">${esc(p.ref || '—')}</span>${delPill('payouts', p.id)}` },
    { k: 'per', l: 'Covers', render: p => p.periodFrom ? esc(fmtDs(p.periodFrom) + ' – ' + fmtDs(p.periodTo)) : '—' },
    { k: 'amount', l: 'Amount', num: 1, render: p => inr(p.amount), sort: p => N(p.amount) },
  ], pays, { sort: { k: 'date', dir: 'desc' }, open: p => 'open:payout:' + p.id, foot: { date: 'Total', amount: inr(Rv) }, empty: empty('No payouts recorded', 'Add each settlement that lands in your bank account, with its UTR, to reconcile it against your sales.', canEdit('finance') ? btn('Record payout', 'new:payout', { pri: true }) : '') });
  return html + `<div class="g2">${panel('Reconciliation by platform', recon, { flush: true, sub: rangeLabel() })}${panel('Payouts received', list, { flush: true })}</div><p class="muted" style="margin:0;font-size:12px;max-width:90ch">Expected settlement is worked out from sales dated in the period. Platforms pay on their own cycles (often 7 to 15 days after delivery), so small gaps at the edges of a period are normal. A gap that persists usually means unclaimed returns, wrong weight slabs or fee changes worth raising with seller support.</p>`;
}
function finAssets() {
  const all = assetsIn(); const live = all.filter(a => a.status !== 'disposed'); const fy = periodRange('fy');
  const f = filtOf('ast', 'live'); const rows = all.filter(a => (f === 'all' || (f === 'live' ? a.status !== 'disposed' : a.status === f)) && matchQ('ast', a.name, a.tag, a.serial, a.location, assetCat(a.category)[1], personName(a.assignedTo)));
  const soon = addDays(TODAY(), 60);
  let html = kpis([
    { l: 'Assets in use', v: num(live.length), s: num(all.length - live.length) + ' disposed' },
    { l: 'Purchase cost', v: inrS(sum(live, a => a.cost)), title: inr(sum(live, a => a.cost)) },
    { l: 'Book value today', v: inrS(sum(live, a => bookValue(a))), title: inr(sum(live, a => bookValue(a))) },
    { l: 'Depreciation this FY', v: inrS(sum(all, a => depIn(a, fy))), s: fyLabel(TODAY()) },
  ], 'k4');
  const ST = { in_use: 't-good', idle: 't-neu', repair: 't-warn', disposed: 't-neu' };
  html += `<div class="toolbar">${searchHTML('ast', 'Search asset, tag, serial, location, person…')}${chipsHTML('ast', [['live', 'In service', live.length], ['repair', 'In repair', all.filter(a => a.status === 'repair').length], ['disposed', 'Disposed', all.filter(a => a.status === 'disposed').length], ['all', 'All', all.length]], f)}<span class="sp"></span>${exportBtn('exportassets', 'Export')}</div>`;
  html += panel('', table('assets', [
    { k: 'tag', l: 'Tag', render: a => `<span class="mono"><b>${esc(a.tag || '—')}</b></span>` },
    { k: 'name', l: 'Asset', render: a => `<b>${esc(a.name)}</b>${delPill('assets', a.id)}<br><small class="muted">${esc(assetCat(a.category)[1])}${a.location ? ' · ' + esc(a.location) : ''}</small>`, sort: a => a.name },
    { k: 'who', l: 'Assigned to', render: a => a.assignedTo ? personHTML(a.assignedTo, false) : (a.assignedName ? esc(a.assignedName) : '<span class="muted">—</span>'), sort: a => personName(a.assignedTo) },
    { k: 'purchaseDate', l: 'Bought', render: a => esc(fmtD(a.purchaseDate)) },
    { k: 'cost', l: 'Cost', num: 1, render: a => inr(a.cost), sort: a => N(a.cost) },
    { k: 'bv', l: 'Book value', num: 1, render: a => inr(bookValue(a)), sort: a => bookValue(a) },
    { k: 'w', l: 'Warranty', render: a => !a.warrantyUntil ? '<span class="muted">—</span>' : a.warrantyUntil < TODAY() ? pill('Expired', 't-neu', 1) : a.warrantyUntil <= soon ? pill('Ends ' + fmtDs(a.warrantyUntil), 't-warn', 1) : esc(fmtD(a.warrantyUntil)), sort: a => a.warrantyUntil || '' },
    { k: 'status', l: 'Status', render: a => pill((ASSET_STATUS.find(s => s[0] === a.status) || [, 'In use'])[1], ST[a.status || 'in_use']) },
  ], rows, { sort: { k: 'purchaseDate', dir: 'desc' }, open: a => 'open:asset:' + a.id, foot: { tag: 'Total', cost: inr(sum(rows, a => a.cost)), bv: inr(sum(rows, a => bookValue(a))) }, empty: empty('No assets yet', 'Track laptops, printers, cameras, furniture and vehicles with their cost, who has them, warranty dates and depreciation.', canEdit('finance') ? btn('Add asset', 'new:asset', { pri: true }) : '') }), { flush: true });
  html += `<p class="muted" style="margin:0;font-size:12px;max-width:90ch">Assets are capitalised, not expensed. Their depreciation appears in the P&L as a non-cash cost. Default rates follow the written-down-value block rates commonly used under the Income Tax Act (computers 40%, furniture 10%, machinery 15%); confirm the method and rates with your accountant.</p>`;
  return html;
}

/* ---------------- reports ---------------- */
const RT = { inr: v => inr(v), num: v => num(v), pct: v => pct(v), x: v => v ? N(v).toFixed(2) + '×' : '—', rating: v => v ? N(v).toFixed(2) + '★' : '—', date: v => fmtD(v), text: v => esc(v ?? '') };
function stockAt(pid, before) { const p = prodOf(pid); let q = N(p && p.openingStock); for (const m of S.moves) if (m.productId === pid && m.date < before) q += N(m.qty); for (const s of S.sales) if (s.productId === pid && s.date < before) q -= saleStockOut(s); return q; }
const REPORTS = [
  { k: 'sales_platform', l: 'Sales by platform', d: 'Units, revenue, fees and contribution for each marketplace in the period.', run(r) { return finGroupReport(r, s => s.platform, k => PL(k).name, 'Platform', k => PL(k).color); } },
  { k: 'sales_brand', l: 'Sales by brand', d: 'How each brand sold across all platforms in the period.', run(r) { return finGroupReport(r, s => s.brandId || (prodOf(s.productId) || {}).brandId || '', k => brandName(k), 'Brand', k => (brandOf(k) || {}).color || 'c8'); } },
  {
    k: 'products', l: 'Product performance', d: 'Sales, profitability, returns and ratings for every product.', run(r) {
      const g = groupBy(salesIn(r), s => s.productId); const rows = S.products.filter(inBrand).map(p => { const f = finSum(g[p.id] || []); const rv = S.reviews.filter(x => x.productId === p.id); return { sku: p.sku, name: p.name, brand: brandName(p.brandId), units: f.units, taxable: f.taxable, profit: f.profit, margin: ratio(f.profit, f.taxable), ret: ratio(f.retUnits, f.units + f.retUnits), rating: rv.length ? sum(rv, x => x.rating) / rv.length : 0, stock: stockMap()[p.id] || 0 }; }).sort((a, b) => b.taxable - a.taxable);
      return { cols: [['sku', 'SKU', 'text'], ['name', 'Product', 'text'], ['brand', 'Brand', 'text'], ['units', 'Units', 'num'], ['taxable', 'Net revenue', 'inr'], ['profit', 'Contribution', 'inr', 1], ['margin', 'Margin', 'pct', 1], ['ret', 'Return rate', 'pct'], ['rating', 'Rating', 'rating'], ['stock', 'On hand', 'num']], rows, foot: { sku: 'Total', units: sum(rows, x => x.units), taxable: sum(rows, x => x.taxable), profit: sum(rows, x => x.profit) }, chart: rows.filter(x => x.taxable > 0).slice(0, 8).map(x => ({ l: x.name, v: x.taxable })) };
    }
  },
  {
    k: 'monthly', l: 'Monthly trend', d: 'Month-by-month revenue, costs and profit across the period.', cost: 1, run(r) {
      let start = r[0]; if (start < '2001') start = S.sales.reduce((m, s) => s.date < m ? s.date : m, TODAY()); const ms = []; let d = parseD(start.slice(0, 7) + '-01'); const end = r[1] > TODAY() ? TODAY() : r[1];
      while (ymd(d) <= end && ms.length < 36) { ms.push(ymd(d).slice(0, 7)); d = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
      const rows = ms.map(k => { const mr = monthRange(k); const a = [mr[0] < r[0] ? r[0] : mr[0], mr[1] > r[1] ? r[1] : mr[1]]; const P = pnl(a); return { m: monthLabel(k), units: P.units, gross: P.gross, taxable: P.taxable, cogs: P.cogs, fees: P.fees + P.pack, contribution: P.contribution, expenses: P.expenses, dep: P.dep, net: P.net }; });
      return { cols: [['m', 'Month', 'text'], ['units', 'Units', 'num'], ['gross', 'Gross sales', 'inr'], ['taxable', 'Net revenue', 'inr'], ['cogs', 'COGS', 'inr'], ['fees', 'Fees & packing', 'inr'], ['contribution', 'Contribution', 'inr'], ['expenses', 'Expenses', 'inr'], ['dep', 'Depreciation', 'inr'], ['net', 'Net profit', 'inr']], rows, foot: { m: 'Total', ...Object.fromEntries(['units', 'gross', 'taxable', 'cogs', 'fees', 'contribution', 'expenses', 'dep', 'net'].map(k => [k, sum(rows, x => x[k])])) } };
    }
  },
  {
    k: 'pnl_brand', l: 'Profit & loss by brand', d: 'Contribution per brand, less expenses and depreciation booked to that brand. Shared costs are shown on their own line.', cost: 1, sec: 'pnl', run(r) {
      const g = groupBy(salesIn(r), s => s.brandId || (prodOf(s.productId) || {}).brandId || ''); const ex = expensesIn(r);
      const rows = myBrands().filter(b => brandScope().has(b.id)).map(b => { const f = finSum(g[b.id] || []); const de = sum(ex.filter(e => e.brandId === b.id), e => e.amount); const dp = sum(S.assets.filter(a => a.brandId === b.id), a => depIn(a, r)); return { b: b.name, taxable: f.taxable, cogs: f.cogs, fees: f.fees + f.pack, contribution: f.profit, direct: de, dep: dp, net: f.profit - de - dp, margin: ratio(f.profit - de - dp, f.taxable) }; });
      const shared = sum(ex.filter(e => !e.brandId), e => e.amount), sdep = sum(S.assets.filter(a => !a.brandId), a => depIn(a, r)); if ((shared || sdep) && brandAll()) rows.push({ b: 'Shared costs', taxable: 0, cogs: 0, fees: 0, contribution: 0, direct: shared, dep: sdep, net: -shared - sdep, margin: 0 });
      return { cols: [['b', 'Brand', 'text'], ['taxable', 'Net revenue', 'inr'], ['cogs', 'COGS', 'inr'], ['fees', 'Fees & packing', 'inr'], ['contribution', 'Contribution', 'inr'], ['direct', 'Expenses', 'inr'], ['dep', 'Depreciation', 'inr'], ['net', 'Net profit', 'inr'], ['margin', 'Net margin', 'pct']], rows, foot: { b: 'Total', ...Object.fromEntries(['taxable', 'cogs', 'fees', 'contribution', 'direct', 'dep', 'net'].map(k => [k, sum(rows, x => x[k])])) } };
    }
  },
  {
    k: 'stock_val', l: 'Inventory valuation', d: 'Current on-hand stock valued at cost and at selling price. Ignores the period filter.', run() {
      const rows = S.products.filter(p => inBrand(p) && p.status !== 'archived').map(p => { const s = stockState(p); const on = Math.max(0, s.on); return { sku: p.sku, name: p.name, brand: brandName(p.brandId), on: s.on, ord: s.ord, cost: N(p.costPrice), vc: on * N(p.costPrice), vr: on * N(p.sellingPrice), v: s.v, cover: Number.isFinite(s.cover) ? Math.round(s.cover) : '' }; }).sort((a, b) => b.vr - a.vr);
      return { cols: [['sku', 'SKU', 'text'], ['name', 'Product', 'text'], ['brand', 'Brand', 'text'], ['on', 'On hand', 'num'], ['ord', 'On order', 'num'], ['cost', 'Unit cost', 'inr', 1], ['vc', 'Value at cost', 'inr', 1], ['vr', 'Value at price', 'inr'], ['v', '30-day sales', 'num'], ['cover', 'Days left', 'text']], rows, foot: { sku: 'Total', on: sum(rows, x => x.on), ord: sum(rows, x => x.ord), vc: sum(rows, x => x.vc), vr: sum(rows, x => x.vr) } };
    }
  },
  {
    k: 'stock_moves', l: 'Stock movement', d: 'Opening, inward, outward and closing units per product for the period.', run(r) {
      const end = addDays(r[1] > TODAY() ? TODAY() : r[1], 1);
      const rows = S.products.filter(inBrand).map(p => { const open = stockAt(p.id, r[0]); let inn = 0, out = 0; S.moves.forEach(m => { if (m.productId === p.id && inRange(m.date, r)) { if (N(m.qty) >= 0) inn += N(m.qty); else out -= N(m.qty); } }); S.sales.forEach(s => { if (s.productId === p.id && inRange(s.date, r)) out += saleStockOut(s); }); return { sku: p.sku, name: p.name, open, inn, out, close: stockAt(p.id, end) }; }).filter(x => x.open || x.inn || x.out || x.close);
      return { cols: [['sku', 'SKU', 'text'], ['name', 'Product', 'text'], ['open', 'Opening', 'num'], ['inn', 'In', 'num'], ['out', 'Out', 'num'], ['close', 'Closing', 'num']], rows, foot: { sku: 'Total', open: sum(rows, x => x.open), inn: sum(rows, x => x.inn), out: sum(rows, x => x.out), close: sum(rows, x => x.close) } };
    }
  },
  {
    k: 'purchases', l: 'Purchases by supplier', d: 'Purchase orders raised and received per supplier in the period.', cost: 1, run(r) {
      const g = groupBy(S.pos.filter(p => inRange(p.date, r) && p.status !== 'cancelled'), p => p.supplierId || '');
      const rows = Object.entries(g).map(([k, l]) => ({ s: (supOf(k) || {}).name || 'No supplier', n: l.length, units: sum(l, p => sum(p.lines || [], x => x.qty)), ordered: sum(l, poValue), received: sum(l, p => sum(p.lines || [], x => N(x.received) * N(x.cost))), open: l.filter(p => p.status === 'ordered' || p.status === 'partial').length })).sort((a, b) => b.ordered - a.ordered);
      return { cols: [['s', 'Supplier', 'text'], ['n', 'POs', 'num'], ['units', 'Units ordered', 'num'], ['ordered', 'Ordered value', 'inr'], ['received', 'Received value', 'inr'], ['open', 'Still open', 'num']], rows, foot: { s: 'Total', n: sum(rows, x => x.n), units: sum(rows, x => x.units), ordered: sum(rows, x => x.ordered), received: sum(rows, x => x.received), open: sum(rows, x => x.open) }, chart: rows.map((x, i) => ({ l: x.s, v: x.ordered, c: SWATCHES[i % 8] })) };
    }
  },
  {
    k: 'expenses', l: 'Expenses by category', d: 'Operating expenses and claimable GST, grouped by category, with the recurring share.', sec: 'expenses', run(r) {
      const ex = expensesIn(r); const tot = sum(ex, e => e.amount); const rows = Object.entries(groupBy(ex, e => e.category || 'Other')).map(([k, l]) => ({ c: k, n: l.length, amt: sum(l, e => e.amount), rec: sum(l.filter(e => e.recurringId), e => e.amount), gst: sum(l, e => e.gst), share: ratio(sum(l, e => e.amount), tot) })).sort((a, b) => b.amt - a.amt);
      return { cols: [['c', 'Category', 'text'], ['n', 'Entries', 'num'], ['amt', 'Amount', 'inr'], ['rec', 'From recurring', 'inr'], ['gst', 'GST (ITC)', 'inr'], ['share', 'Share', 'pct']], rows, foot: { c: 'Total', n: sum(rows, x => x.n), amt: tot, rec: sum(rows, x => x.rec), gst: sum(rows, x => x.gst) }, chart: rows.map((x, i) => ({ l: x.c, v: x.amt, c: SWATCHES[i % 8] })) };
    }
  },
  {
    k: 'recurring', l: 'Recurring commitments', d: 'Every active recurring bill with its monthly and yearly cost. Ignores the period filter.', sec: 'recurring', run() {
      const rows = S.recurring.filter(x => inBrand(x) && x.active !== false && (!x.endDate || x.endDate >= TODAY())).map(x => ({ n: x.name, c: x.category, f: freqOf(x.frequency)[1], amt: N(x.amount), m: monthlyEquiv(x), y: monthlyEquiv(x) * 12, next: nextDue(x) || '', auto: x.autoPost ? 'Automatic' : 'Manual' })).sort((a, b) => b.m - a.m);
      return { cols: [['n', 'Bill', 'text'], ['c', 'Category', 'text'], ['f', 'Repeats', 'text'], ['amt', 'Amount', 'inr'], ['m', 'Per month', 'inr'], ['y', 'Per year', 'inr'], ['next', 'Next due', 'date'], ['auto', 'Posting', 'text']], rows, foot: { n: 'Total', m: sum(rows, x => x.m), y: sum(rows, x => x.y) } };
    }
  },
  {
    k: 'assets', l: 'Asset register', d: 'Fixed assets with cost, depreciation this financial year and book value today. Ignores the period filter.', sec: 'assets', run() {
      const fy = periodRange('fy'); const rows = assetsIn().map(a => ({ tag: a.tag || '', n: a.name, c: assetCat(a.category)[1], who: a.assignedTo ? personName(a.assignedTo) : (a.assignedName || ''), d: a.purchaseDate, cost: N(a.cost), m: a.method === 'slm' ? `SLM ${N(a.life) || 5} yrs` : `WDV ${N(a.rate)}%`, dep: depIn(a, fy), bv: bookValue(a), st: (ASSET_STATUS.find(s => s[0] === a.status) || [, 'In use'])[1] })).sort((a, b) => b.cost - a.cost);
      return { cols: [['tag', 'Tag', 'text'], ['n', 'Asset', 'text'], ['c', 'Category', 'text'], ['who', 'Assigned to', 'text'], ['d', 'Bought', 'date'], ['cost', 'Cost', 'inr'], ['m', 'Method', 'text'], ['dep', 'Depreciation this FY', 'inr'], ['bv', 'Book value', 'inr'], ['st', 'Status', 'text']], rows, foot: { tag: 'Total', cost: sum(rows, x => x.cost), dep: sum(rows, x => x.dep), bv: sum(rows, x => x.bv) } };
    }
  },
  {
    k: 'payouts', l: 'Payout reconciliation', d: 'Expected settlements from sales compared with payouts received, by platform.', sec: 'payouts', run(r) {
      const exp = Object.fromEntries(salesGrouped(r, s => s.platform).map(x => [x.k, x.settlement])); const pays = S.payouts.filter(p => inRange(p.date, r));
      const rows = Array.from(new Set([...Object.keys(exp), ...pays.map(p => p.platform)])).map(k => { const rec = sum(pays.filter(p => p.platform === k), p => p.amount); return { p: PL(k).name, e: exp[k] || 0, rec, gap: (exp[k] || 0) - rec, gp: ratio((exp[k] || 0) - rec, exp[k] || 0) }; });
      return { cols: [['p', 'Platform', 'text'], ['e', 'Expected', 'inr'], ['rec', 'Received', 'inr'], ['gap', 'Difference', 'inr'], ['gp', 'Difference %', 'pct']], rows, foot: { p: 'Total', e: sum(rows, x => x.e), rec: sum(rows, x => x.rec), gap: sum(rows, x => x.gap) } };
    }
  },
  {
    k: 'marketing', l: 'Marketing performance', d: 'Spend and return for every campaign running in the period.', mod: 'marketing', run(r) {
      const rows = campsIn(r).map(c => { const s = campStats([c]); return { name: c.name, ch: c.channel, brand: brandName(c.brandId), status: (CAMP_STATUS.find(x => x[0] === c.status) || [, c.status])[1], spend: s.spend, rev: s.rev, roas: s.roas, acos: s.acos, ctr: s.ctr, cpc: s.cpc, ord: s.ord }; }).sort((a, b) => b.spend - a.spend); const t = campStats(campsIn(r));
      return { cols: [['name', 'Campaign', 'text'], ['ch', 'Channel', 'text'], ['brand', 'Brand', 'text'], ['status', 'Status', 'text'], ['spend', 'Spend', 'inr'], ['rev', 'Revenue', 'inr'], ['roas', 'ROAS', 'x'], ['acos', 'ACoS', 'pct'], ['ctr', 'CTR', 'pct'], ['cpc', 'CPC', 'inr'], ['ord', 'Orders', 'num']], rows, foot: { name: 'Total', spend: t.spend, rev: t.rev, roas: t.roas, acos: t.acos, ctr: t.ctr, cpc: t.cpc, ord: t.ord } };
    }
  },
  {
    k: 'customers', l: 'Top customers', d: 'Customers ranked by what they spent in the period (sales linked to a customer record).', mod: 'customers', run(r) {
      const g = groupBy(salesIn(r, s => !!s.customerId && s.status !== 'cancelled'), s => s.customerId);
      const rows = Object.entries(g).map(([id, l]) => { const c = custOf(id) || {}; return { name: c.name || 'Removed customer', city: [c.city, c.state].filter(Boolean).join(', '), orders: l.length, units: sum(l, s => s.qty), spend: sum(l, s => N(s.qty) * N(s.unitPrice)), last: l.reduce((m, s) => s.date > m ? s.date : m, '') }; }).sort((a, b) => b.spend - a.spend);
      return { cols: [['name', 'Customer', 'text'], ['city', 'Location', 'text'], ['orders', 'Orders', 'num'], ['units', 'Units', 'num'], ['spend', 'Spend (incl. GST)', 'inr'], ['last', 'Last order', 'date']], rows, foot: { name: 'Total', orders: sum(rows, x => x.orders), units: sum(rows, x => x.units), spend: sum(rows, x => x.spend) } };
    }
  },
  {
    k: 'reviews', l: 'Ratings by product', d: 'Average rating, share of negative reviews and reply rate for reviews received in the period.', mod: 'customers', run(r) {
      const g = groupBy(S.reviews.filter(x => inRange(x.date, r) && inBrand(x)), x => x.productId);
      const rows = Object.entries(g).map(([id, l]) => ({ name: (prodOf(id) || {}).name || 'Removed product', n: l.length, avg: sum(l, x => x.rating) / l.length, neg: ratio(l.filter(x => N(x.rating) <= 2).length, l.length), reply: ratio(l.filter(x => x.status && x.status !== 'new').length, l.length) })).sort((a, b) => a.avg - b.avg);
      const all = Object.values(g).flat();
      return { cols: [['name', 'Product', 'text'], ['n', 'Reviews', 'num'], ['avg', 'Average', 'rating'], ['neg', '1–2 star share', 'pct'], ['reply', 'Replied', 'pct']], rows, foot: { name: 'All products', n: all.length, avg: all.length ? sum(all, x => x.rating) / all.length : 0, neg: ratio(all.filter(x => N(x.rating) <= 2).length, all.length), reply: ratio(all.filter(x => x.status && x.status !== 'new').length, all.length) } };
    }
  },
  {
    k: 'gst', l: 'GST summary by rate', d: 'Taxable value and output GST by rate slab, with input credits. An estimate to reconcile against your GSTR-1 and GSTR-3B.', sec: 'pnl', run(r) {
      const g = groupBy(salesIn(r), s => String(saleFin(s).gstRate)); const rows = Object.entries(g).map(([rate, l]) => { const f = finSum(l); return { rate: rate + '%', taxable: f.taxable, gst: f.outGST, cgst: f.outGST / 2, sgst: f.outGST / 2, total: f.taxable + f.outGST }; }).sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
      const P = pnl(r);
      return { cols: [['rate', 'GST rate', 'text'], ['taxable', 'Taxable value', 'inr'], ['gst', 'Output GST', 'inr'], ['cgst', 'CGST (intra-state)', 'inr'], ['sgst', 'SGST (intra-state)', 'inr'], ['total', 'Invoice value', 'inr']], rows, foot: { rate: 'Total', taxable: P.taxable, gst: P.outGST, cgst: P.outGST / 2, sgst: P.outGST / 2, total: P.taxable + P.outGST }, note: `Input credit on platform fees ${inr(P.gstOnFees)} · on expenses ${inr(P.expGST)} · estimated net GST payable <b>${inr(P.gstPayable)}</b>. The CGST/SGST split assumes intra-state supply; interstate sales attract IGST instead, so check the place of supply in your platform tax reports.` };
    }
  },
];
function finGroupReport(r, keyFn, nameFn, lbl, colorFn) {
  const rows = salesGrouped(r, keyFn).map(x => ({ name: nameFn(x.k), key: x.k, entries: x.entries, units: x.units, ret: x.retUnits, gross: x.gross, taxable: x.taxable, fees: x.fees + x.gstOnFees, profit: x.profit, margin: ratio(x.profit, x.taxable) })).sort((a, b) => b.taxable - a.taxable);
  return { cols: [['name', lbl, 'text'], ['entries', 'Entries', 'num'], ['units', 'Units', 'num'], ['ret', 'Returned', 'num'], ['gross', 'Gross sales', 'inr'], ['taxable', 'Net revenue', 'inr'], ['fees', 'Fees + GST', 'inr'], ['profit', 'Contribution', 'inr', 1], ['margin', 'Margin', 'pct', 1]], rows, foot: { name: 'Total', entries: sum(rows, x => x.entries), units: sum(rows, x => x.units), ret: sum(rows, x => x.ret), gross: sum(rows, x => x.gross), taxable: sum(rows, x => x.taxable), fees: sum(rows, x => x.fees), profit: sum(rows, x => x.profit), margin: ratio(sum(rows, x => x.profit), sum(rows, x => x.taxable)) }, chart: rows.map(x => ({ l: x.name, v: x.taxable, c: colorFn(x.key) })) };
}
const myReports = () => REPORTS.filter(x => (!x.cost || allow('costs')) && (!x.sec || (canView('finance') && secOK(x.sec))) && (!x.mod || canView(x.mod)));
function currentReport() { const list = myReports(); const rep = list.find(x => x.k === ui.report) || list[0]; const out = rep.run(periodRange()); out.cols = out.cols.filter(c => !c[3] || allow('costs')); return { rep, out }; }
V.reports = () => {
  const { rep, out } = currentReport(); const list = myReports();
  const cols = out.cols.map(([k, l, t]) => ({ k, l, num: t !== 'text', render: x => RT[t](x[k]), sort: x => x[k] }));
  let html = ph('Reports', `Every report follows the brand and period filters at the top. ${esc(rangeLabel())}.`);
  const nav = `<nav class="rep-nav" aria-label="Reports">${list.map(x => `<button data-act="report:${x.k}"${x.k === rep.k ? ' aria-current="true"' : ''}>${esc(x.l)}</button>`).join('')}</nav>`;
  const sel = `<div class="rep-sel"><label class="sr" for="repsel">Report</label><select class="inp" id="repsel" data-ch="report">${list.map(x => `<option value="${x.k}"${x.k === rep.k ? ' selected' : ''}>${esc(x.l)}</option>`).join('')}</select></div>`;
  const foot = out.foot ? Object.fromEntries(out.cols.map(([k, , t]) => [k, out.foot[k] === undefined ? '' : (typeof out.foot[k] === 'string' && t !== 'text' ? esc(out.foot[k]) : RT[t](out.foot[k]))])) : null;
  const body = `${sel}<div class="ph" style="align-items:flex-start"><div><h2 class="sec" style="font-size:20px">${esc(rep.l)}</h2><p style="margin:4px 0 0;color:var(--muted);max-width:70ch">${esc(rep.d)}</p></div><div class="acts">${allow('export') ? btn('Copy', 'repcopy', { i: 'copy' }) + btn('Export CSV', 'repexport', { i: 'dl', pri: true }) : ''}</div></div>
  ${out.chart && out.chart.length ? panel('', hbars(out.chart.slice(0, 10))) : ''}
  ${panel('', table('rep-' + rep.k, cols, out.rows, { foot, empty: empty('Nothing to report', 'There’s no data for this report in the selected period and brand.') }), { flush: true })}
  ${out.note ? `<p class="muted" style="margin:0;font-size:12.5px;max-width:90ch">${out.note}</p>` : ''}`;
  return html + `<div class="rep">${nav}<div class="col" style="gap:14px">${body}</div></div>`;
};
function reportCSV() { const { rep, out } = currentReport(); const cols = out.cols.map(([k, l, t]) => ({ k, l, csv: x => { const v = x[k]; if (t === 'text' || t === 'date') return v ?? ''; if (t === 'pct') return (N(v) * 100).toFixed(2); return Math.round(N(v) * 100) / 100; } })); return { name: rep.l, cols, rows: out.rows }; }

/* ---------------- marketing ---------------- */
V.marketing = () => {
  const can = canEdit('marketing'); const r = periodRange(); const list = campsIn(r); const st = campStats(list); const tab = tabOf('mkt', 'camps');
  let html = ph('Marketing', 'Campaigns across marketplaces and social, with spend, return on ad spend and budget burn.', can ? btn('Add campaign', 'new:campaign', { pri: true, i: 'plus' }) : '');
  html += kpis([
    { l: 'Ad spend', v: inrS(st.spend), s: inrS(st.budget) + ' budgeted', title: inr(st.spend) },
    { l: 'Attributed revenue', v: inrS(st.rev), title: inr(st.rev) },
    { l: 'ROAS', v: st.spend ? st.roas.toFixed(2) + '×' : '—', s: 'revenue ÷ spend' },
    { l: 'ACoS', v: st.rev ? pct(st.acos) : '—', s: 'spend ÷ revenue' },
    { l: 'CTR', v: st.imp ? pct(st.ctr, 2) : '—', s: num(st.clk) + ' clicks' },
    { l: 'Cost per click', v: st.clk ? inr(st.cpc, 2) : '—', s: num(st.ord) + ' orders' },
  ]);
  html += tabsHTML('mkt', [['camps', 'Campaigns', list.length], ['chan', 'By channel']], tab);
  if (tab === 'chan') {
    const rows = Object.entries(groupBy(list, c => c.channel || 'Other')).map(([k, l]) => ({ k, n: l.length, ...campStats(l) }));
    return html + `<div class="g31">${panel('', table('chan', [
      { k: 'k', l: 'Channel', render: x => esc(x.k) }, { k: 'n', l: 'Campaigns', num: 1, render: x => num(x.n) }, { k: 'spend', l: 'Spend', num: 1, render: x => inr(x.spend) }, { k: 'rev', l: 'Revenue', num: 1, render: x => inr(x.rev) },
      { k: 'roas', l: 'ROAS', num: 1, render: x => x.spend ? pill(x.roas.toFixed(2) + '×', roasTone(x.roas), 1) : '—' }, { k: 'ctr', l: 'CTR', num: 1, render: x => x.imp ? pct(x.ctr, 2) : '—' }, { k: 'cpc', l: 'CPC', num: 1, render: x => x.clk ? inr(x.cpc, 2) : '—' },
    ], rows, { sort: { k: 'spend', dir: 'desc' }, empty: empty('No campaigns in this period', 'Campaigns whose dates overlap the period are counted.') }), { flush: true })}${panel('Spend share', hbars(rows.sort((a, b) => b.spend - a.spend).map((x, i) => ({ l: x.k, v: x.spend, c: SWATCHES[i % 8] }))))}</div>`;
  }
  const f = filtOf('cst', 'all'); const rows = list.filter(c => (f === 'all' || c.status === f) && matchQ('camp', c.name, c.channel, brandName(c.brandId), c.coupon));
  html += `<div class="toolbar">${searchHTML('camp', 'Search campaigns…')}${chipsHTML('cst', [['all', 'All', list.length], ...CAMP_STATUS.map(([k, l]) => [k, l, list.filter(c => c.status === k).length])], f)}</div>`;
  const CT = { planned: 't-info', live: 't-good', paused: 't-warn', ended: 't-neu' };
  html += panel('', table('camps', [
    { k: 'name', l: 'Campaign', render: c => `<div><b>${esc(c.name)}</b>${delPill('campaigns', c.id)}<br><small class="muted">${esc(c.channel || '')}${c.coupon ? ' · code ' + esc(c.coupon) : ''}</small></div>` },
    { k: 'brand', l: 'Brand', render: c => esc(brandName(c.brandId)), sort: c => brandName(c.brandId) },
    { k: 'status', l: 'Status', render: c => pill((CAMP_STATUS.find(x => x[0] === c.status) || [, c.status || '—'])[1], CT[c.status] || 't-neu') },
    { k: 'dates', l: 'Dates', render: c => `<span class="tnum">${esc(fmtDs(c.startDate))} – ${esc(c.endDate ? fmtDs(c.endDate) : 'ongoing')}</span>`, sort: c => c.startDate || '' },
    { k: 'burn', l: 'Budget used', render: c => { const b = ratio(N(c.spend), N(c.budget)); return N(c.budget) ? `<div class="mcell">${meter(b, b > 1 ? 'bad' : b > .85 ? 'warn' : '')}<span class="tnum">${pct(b, 0)}</span></div>` : '<span class="muted">No budget</span>'; }, sort: c => ratio(N(c.spend), N(c.budget)) },
    { k: 'spend', l: 'Spend', num: 1, render: c => inr(c.spend), sort: c => N(c.spend) },
    { k: 'revenue', l: 'Revenue', num: 1, render: c => inr(c.revenue), sort: c => N(c.revenue) },
    { k: 'roas', l: 'ROAS', num: 1, render: c => N(c.spend) ? pill(ratio(N(c.revenue), N(c.spend)).toFixed(2) + '×', roasTone(ratio(N(c.revenue), N(c.spend))), 1) : '—', sort: c => ratio(N(c.revenue), N(c.spend)) },
    { k: 'acos', l: 'ACoS', num: 1, render: c => N(c.revenue) ? pct(ratio(N(c.spend), N(c.revenue))) : '—', sort: c => ratio(N(c.spend), N(c.revenue)) },
    { k: 'ctr', l: 'CTR', num: 1, render: c => N(c.impressions) ? pct(ratio(N(c.clicks), N(c.impressions)), 2) : '—', sort: c => ratio(N(c.clicks), N(c.impressions)) },
    { k: 'orders', l: 'Orders', num: 1, render: c => num(c.orders), sort: c => N(c.orders) },
  ], rows, { sort: { k: 'spend', dir: 'desc' }, open: c => 'open:campaign:' + c.id, empty: empty('No campaigns in this period', 'Add sponsored ads, social campaigns, influencer pushes and deals to track what they return.', can ? btn('Add campaign', 'new:campaign', { pri: true }) : '') }), { flush: true });
  html += `<p class="muted" style="margin:0;font-size:12px">ROAS pills: green at 4× or more, amber from 2× to 4×, red under 2×. Record ad invoices under Finance › Expenses › Advertising so they reach the P&L.</p>`;
  return html;
};

/* ---------------- customers & reviews ---------------- */
V.customers = () => {
  const can = canEdit('customers'); const tab = tabOf('cus', 'customers');
  const acts = (tab === 'customers' ? exportBtn('exportcust', 'Export') : '') + (can ? (tab === 'reviews' ? btn('Log review', 'new:review', { pri: true, i: 'plus' }) : btn('Add customer', 'new:customer', { pri: true, i: 'plus' })) : '');
  let html = ph('Customers & reviews', 'Customer records linked to their orders, and every marketplace review in one queue.', acts);
  const nr = S.reviews.filter(x => inBrand(x) && (x.status || 'new') === 'new').length;
  html += tabsHTML('cus', [['customers', 'Customers', S.customers.length], ['reviews', 'Reviews', nr ? nr + ' new' : undefined]], tab);
  return html + (tab === 'reviews' ? cusReviews() : cusList());
};
function custStats() { return memo('custstats', () => { const m = {}; for (const s of S.sales) { if (!s.customerId || s.status === 'cancelled') continue; const x = m[s.customerId] = m[s.customerId] || { orders: 0, spend: 0, last: '' }; x.orders++; x.spend += N(s.qty) * N(s.unitPrice); if (s.date > x.last) x.last = s.date; } return m; }); }
function cusList() {
  const cs = S.customers; const st = custStats(); const rows = cs.filter(c => matchQ('cus', c.name, c.phone, c.email, c.city, c.state, c.tags)).map(c => ({ c, ...(st[c.id] || { orders: 0, spend: 0, last: '' }) }));
  const repeat = rows.filter(x => x.orders >= 2).length; const states = Object.entries(groupBy(cs.filter(c => c.state), c => c.state)).sort((a, b) => b[1].length - a[1].length);
  let html = kpis([
    { l: 'Customers', v: num(cs.length) },
    { l: 'Repeat buyers', v: num(repeat), s: pct(ratio(repeat, cs.length), 0) + ' of customers' },
    { l: 'Avg lifetime spend', v: inr(ratio(sum(rows, x => x.spend), rows.filter(x => x.orders).length)) },
    { l: 'Top state', v: states.length ? esc(states[0][0]) : '—', s: states.length ? num(states[0][1].length) + ' customers' : '' },
  ], 'k4');
  html += `<div class="toolbar">${searchHTML('cus', 'Search name, phone, email, city, tag…')}</div>`;
  html += panel('', table('cus', [
    { k: 'name', l: 'Customer', render: x => `<div><b>${esc(x.c.name)}</b>${(x.c.tags || '').split(',').filter(t => t.trim()).map(t => ' ' + pill(t.trim(), 't-acc', 1)).join('')}${delPill('customers', x.c.id)}<br><small class="muted">${esc([x.c.phone, x.c.email].filter(Boolean).join(' · ') || '—')}</small></div>`, sort: x => x.c.name },
    { k: 'loc', l: 'Location', render: x => esc([x.c.city, x.c.state].filter(Boolean).join(', ') || '—'), sort: x => x.c.state || '' },
    { k: 'src', l: 'First bought on', render: x => x.c.source ? platPill(x.c.source) : '—', sort: x => x.c.source || '' },
    { k: 'orders', l: 'Orders', num: 1, render: x => num(x.orders) },
    { k: 'spend', l: 'Spend', num: 1, render: x => inr(x.spend) },
    { k: 'last', l: 'Last order', render: x => esc(x.last ? fmtD(x.last) : '—') },
  ], rows, { sort: { k: 'spend', dir: 'desc' }, limit: 100, open: x => 'open:customer:' + x.c.id, empty: empty('No customers yet', 'Add repeat buyers, wholesale accounts and anyone you deal with directly. Link them to sales to build their history.', canEdit('customers') ? btn('Add customer', 'new:customer', { pri: true }) : '') }), { flush: true });
  return html;
}
function cusReviews() {
  const all = S.reviews.filter(inBrand); const n = all.length; const avg = n ? sum(all, x => x.rating) / n : 0;
  const dist = [5, 4, 3, 2, 1].map(k => ({ k, n: all.filter(x => Math.round(N(x.rating)) === k).length }));
  const replied = all.filter(x => x.status && x.status !== 'new').length;
  const summary = `<div class="rsum"><div><div class="big tnum">${n ? avg.toFixed(1) : '—'}</div>${stars(avg)}<div class="muted" style="font-size:12px;margin-top:4px">${num(n)} reviews · ${pct(ratio(replied, n), 0)} replied</div></div><div class="hb">${dist.map(d => `<div class="hb-r" style="--bc:var(--${d.k >= 4 ? 'good' : d.k === 3 ? 'warn' : 'bad'});grid-template-columns:44px minmax(0,1fr) 40px"><span class="lab">${d.k} ★</span><span class="bar"><i style="width:${(ratio(d.n, n) * 100).toFixed(1)}%"></i></span><span class="val">${num(d.n)}</span></div>`).join('')}</div></div>`;
  const f = filtOf('rst', 'all'), pf = ui.filt.rplat || '', rf = ui.filt.rrat || '';
  const rows = all.filter(x => (f === 'all' || (x.status || 'new') === f) && (!pf || x.platform === pf) && (!rf || (rf === 'neg' ? N(x.rating) <= 3 : Math.round(N(x.rating)) === +rf)) && matchQ('rev', x.text, x.title, x.reviewer, (prodOf(x.productId) || {}).name));
  let html = `<div class="g31">${panel('Rating summary', summary)}${panel('By platform', hbars(Object.entries(groupBy(all, x => x.platform)).map(([k, l]) => ({ l: PL(k).name, v: sum(l, x => x.rating) / l.length, c: PL(k).color, noShare: 1 })).sort((a, b) => b.v - a.v), v => N(v).toFixed(2) + '★'))}</div>`;
  html += `<div class="toolbar">${searchHTML('rev', 'Search review text, reviewer, product…')}${chipsHTML('rst', [['all', 'All', n], ...REV_STATUS.map(([k, l]) => [k, l, all.filter(x => (x.status || 'new') === k).length])], f)}<span class="sp"></span>
  <label class="sr" for="rplat">Platform</label><select class="inp" id="rplat" data-ch="filtsel" data-key="rplat" style="width:auto"><option value="">All platforms</option>${platforms().map(p => `<option value="${esc(p.key)}"${pf === p.key ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
  <label class="sr" for="rrat">Rating</label><select class="inp" id="rrat" data-ch="filtsel" data-key="rrat" style="width:auto"><option value="">Any rating</option><option value="neg"${rf === 'neg' ? ' selected' : ''}>3★ and below</option>${[5, 4, 3, 2, 1].map(k => `<option value="${k}"${rf === String(k) ? ' selected' : ''}>${k}★</option>`).join('')}</select></div>`;
  const RT2 = { new: 't-bad', replied: 't-good', escalated: 't-warn', resolved: 't-neu' };
  html += panel('', table('rev', [
    { k: 'date', l: 'Date', render: x => `<span class="tnum">${esc(fmtD(x.date))}</span>` },
    { k: 'p', l: 'Product', render: x => esc((prodOf(x.productId) || {}).name || '—') + delPill('reviews', x.id), sort: x => (prodOf(x.productId) || {}).name || '' },
    { k: 'pl', l: 'Platform', render: x => platPill(x.platform), sort: x => PL(x.platform).name },
    { k: 'rating', l: 'Rating', render: x => stars(x.rating), sort: x => N(x.rating) },
    { k: 'text', l: 'Review', cls: 'wrap', render: x => `${x.title ? `<b>${esc(x.title)}</b> ` : ''}<span class="muted">${esc(String(x.text || '').slice(0, 110))}${String(x.text || '').length > 110 ? '…' : ''}</span>`, sort: x => x.title || x.text || '' },
    { k: 'reviewer', l: 'By', render: x => esc(x.reviewer || '—') },
    { k: 'status', l: 'Status', render: x => pill((REV_STATUS.find(s => s[0] === (x.status || 'new')) || [, x.status])[1], RT2[x.status || 'new']), sort: x => x.status || 'new' },
  ], rows, { sort: { k: 'date', dir: 'desc' }, limit: 100, open: x => 'open:review:' + x.id, empty: empty('No reviews here', 'Log reviews from Amazon, Flipkart, Meesho and your site to reply to them from one place.', canEdit('customers') ? btn('Log review', 'new:review', { pri: true }) : '') }), { flush: true });
  return html;
}
