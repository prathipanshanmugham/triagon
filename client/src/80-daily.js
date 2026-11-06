/* =====================================================================
   Daily report: team updates, one-click PDF, automatic evening PDF
   ===================================================================== */
const UPD_CATS = ['General', 'Sales & orders', 'Dispatch & stock', 'Catalogue & listings', 'Production & workshop', 'Marketing', 'Customers', 'Accounts', 'Issue / blocker'];
const repCfg = () => Object.assign({ auto: true, time: '19:00', catchUp: true }, S.settings.reports || {});
const REP = { done: {}, busy: false, list: null, listAt: 0 };
const repDate = () => (ui.repDate && ui.repDate <= TODAY()) ? ui.repDate : TODAY();
const fullView = () => allow('costs') && allow('overview') && !restricted();

function dayData(d, full) {
  const scope = full ? () => true : inBrand; const costs = full || allow('costs');
  const sales = S.sales.filter(s => s.date === d && scope(s)); const T = finSum(sales);
  const live = sales.filter(s => s.status !== 'cancelled');
  const byPlat = Object.entries(groupBy(live, s => s.platform)).map(([k, l]) => ({ k, ...finSum(l), orders: l.length })).sort((a, b) => b.gross - a.gross);
  const exps = S.expenses.filter(e => e.date === d && scope(e));
  const moves = S.moves.filter(m => m.date === d && scope(m));
  const posNew = S.pos.filter(p => p.date === d); const posRecv = S.pos.filter(p => moves.some(m => m.poId === p.id));
  const reviews = S.reviews.filter(r => r.date === d && scope(r));
  const custNew = S.customers.filter(c => c.createdAt && localDay(c.createdAt) === d);
  const emps = S.employees.filter(e => e.status !== 'inactive' || attOf(e.id, d));
  const att = emps.map(e => ({ e, a: attDay(e, d) })).filter(x => !['na', 'future'].includes(x.a.code)).sort((x, y) => String(x.e.name).localeCompare(String(y.e.name)));
  const updates = S.updates.filter(u => u.date === d).sort((a, b) => a.at < b.at ? -1 : 1);
  const logs = allLogs().filter(e => localDay(e.t) === d && !['session'].includes(e.a)).slice().reverse();
  const lows = d === TODAY() ? S.products.filter(p => scope(p) && p.status !== 'archived').map(p => ({ p, ...stockState(p) })).filter(x => x.st === 'low' || x.st === 'out').sort((a, b) => a.on - b.on) : [];
  const camps = S.campaigns.filter(c => scope(c) && c.status === 'live' && (c.startDate || '0000') <= d && (c.endDate || '9999') >= d);
  const dels = S.deletions.filter(r => r.requestedAt && localDay(r.requestedAt) === d);
  const working = att.filter(x => !['off', 'holiday'].includes(x.a.code));
  return { d, full, costs, sales, T, byPlat, exps, moves, posNew, posRecv, reviews, custNew, att, working, updates, logs, lows, camps, dels };
}
const rEsc = esc;
function rTable(cols, rows, o = {}) {
  if (!rows.length) return `<p class="r-none">${rEsc(o.none || 'Nothing recorded.')}</p>`;
  const lim = o.limit || 0; const shown = lim ? rows.slice(0, lim) : rows;
  return `<table class="r-t"><thead><tr>${cols.map(c => `<th class="${c.num ? 'n' : ''}"${c.w ? ` style="width:${c.w}"` : ''}>${rEsc(c.l)}</th>`).join('')}</tr></thead><tbody>${shown.map(r => `<tr>${cols.map(c => `<td class="${c.num ? 'n' : ''}${c.cls ? ' ' + c.cls : ''}">${c.v(r)}</td>`).join('')}</tr>`).join('')}</tbody>${o.foot ? `<tfoot><tr>${cols.map((c, i) => `<td class="${c.num ? 'n' : ''}">${o.foot[c.k ?? i] ?? ''}</td>`).join('')}</tr></tfoot>` : ''}</table>${lim && rows.length > lim ? `<p class="r-more">+ ${num(rows.length - lim)} more not shown</p>` : ''}`;
}
const rSec = (n, title, body, sub = '') => `<section class="r-sec"><h2><span>${n}</span>${rEsc(title)}${sub ? `<small>${sub}</small>` : ''}</h2>${body}</section>`;
function reportBody(d, full, by) {
  const D = dataForReport(d, full); const co = company(); const x = parseD(d);
  const pres = D.working.filter(w => w.a.credit > 0).length; const lateN = D.att.filter(w => w.a.late).length;
  const expTot = sum(D.exps, e => e.amount); const head = `<header class="r-head"><img class="r-logo" src="assets/logo-full.png" alt="Triagon Ventures"><div class="r-title"><div class="r-eyebrow">Daily business report</div><h1>${rEsc(x.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</h1><p>${rEsc([co.legalName || co.name, co.gstin ? 'GSTIN ' + co.gstin : ''].filter(Boolean).join(' · '))}</p><p class="r-gen">Generated ${rEsc(new Date().toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }))}${by ? ' by ' + rEsc(by) : ' automatically'}${D.full ? '' : ' · limited to this user’s access'}</p></div></header>`;
  const k = (l, v, s = '', tone = '') => `<div class="r-k"><span>${rEsc(l)}</span><b class="${tone}">${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
  const money = D.full || allow('overview') || (canView('finance') && secOK('sales')); const showExp = D.full || (canView('finance') && secOK('expenses'));
  const kp = `<div class="r-kpis">${k('Orders', num(D.sales.filter(s => s.status !== 'cancelled').length), num(D.T.units) + ' units shipped')}${money ? k('Gross sales', inr(D.T.gross), D.T.returns ? inr(D.T.returns) + ' returned' : 'incl. GST') + k('Net revenue', inr(D.T.taxable), 'ex-GST') : k('Units shipped', num(D.T.units), 'across all platforms') + k('Stock alerts', num(D.lows.length), 'low or out of stock')}${D.costs && money ? k('Contribution', inr(D.T.profit), 'after product, fees & packing', D.T.profit < 0 ? 'neg' : '') : k('Returns', num(D.T.retUnits), 'units')}${showExp ? k('Expenses', inr(expTot), num(D.exps.length) + ' bill' + (D.exps.length === 1 ? '' : 's')) : k('Updates', num(D.updates.length), 'posted by the team')}${k('Attendance', D.working.length ? `${num(pres)}/${num(D.working.length)}` : '—', lateN ? `${num(lateN)} late` : 'present')}</div>`;
  let n = 0; const N2 = () => String(++n).padStart(2, '0');
  const upd = rSec(N2(), 'Team updates', (D.updates.length || D.att.some(w => w.a.update)) ? `<div class="r-upds">${D.updates.map(u => `<div class="r-upd"><div class="r-upd-h"><b>${rEsc(personName(u.by))}</b><span class="r-tag">${rEsc(u.category || 'General')}</span><span class="r-time">${rEsc(fmtT(u.at))}</span></div><p>${rEsc(u.text)}</p></div>`).join('')}${D.att.filter(w => w.a.update).map(w => `<div class="r-upd"><div class="r-upd-h"><b>${rEsc(w.e.name)}</b><span class="r-tag">Check-out note</span><span class="r-time">${w.a.lastOut ? rEsc(fmtT(w.a.lastOut)) : ''}</span></div><p>${rEsc(w.a.update)}</p></div>`).join('')}</div>` : '<p class="r-none">No updates were posted for this day.</p>');
  const attS = rSec(N2(), 'Attendance', rTable([
    { l: 'Employee', v: w => `<b>${rEsc(w.e.name)}</b><br><small>${rEsc(w.e.designation || w.e.code || '')}</small>` },
    { l: 'Status', v: w => `<span class="r-pill ${w.a.tone}">${rEsc(w.a.label)}</span>${w.a.late && !/late/i.test(w.a.label) ? ' <small>late</small>' : ''}` },
    { l: 'In', num: 1, v: w => w.a.first ? rEsc(fmtT(w.a.first)) : '—' }, { l: 'Out', num: 1, v: w => w.a.lastOut ? rEsc(fmtT(w.a.lastOut)) : w.a.open ? 'in' : '—' },
    { l: 'Hours', num: 1, v: w => w.a.mins ? fmtHrs(w.a.mins) : '—' }, { l: 'Late by', num: 1, v: w => w.a.late ? lateTxt(w.a.lateMin) : '—' },
  ], D.att, { none: 'No employees are set up for attendance.' }), D.working.length ? `${num(pres)} of ${num(D.working.length)} present · ${fmtHrs(sum(D.att, w => w.a.mins))} worked` : '');
  const platT = rTable([
    { l: 'Platform', v: r => rEsc(PL(r.k).name) }, { l: 'Orders', num: 1, v: r => num(r.orders) }, { l: 'Units', num: 1, v: r => num(r.units) },
    ...(money ? [{ l: 'Gross', num: 1, v: r => inr(r.gross) }, { l: 'Returns', num: 1, v: r => r.returns ? inr(r.returns) : '—' }, { l: 'Net (ex-GST)', num: 1, v: r => inr(r.taxable) }] : [{ l: 'Returned units', num: 1, v: r => r.retUnits ? num(r.retUnits) : '—' }]),
    ...(D.costs && money ? [{ l: 'Contribution', num: 1, v: r => `<span class="${r.profit < 0 ? 'neg' : ''}">${inr(r.profit)}</span>` }] : []),
  ], D.byPlat, { none: 'No sales were recorded for this day.' });
  const SS = Object.fromEntries(SALE_STATUS);
  const saleT = D.sales.length ? `<h3>Entries</h3>` + rTable([
    { l: 'Order', v: s => `<span class="mono">${rEsc(s.orderRef || '—')}</span>` }, { l: 'Product', v: s => { const p = prodOf(s.productId) || {}; return `<b>${rEsc(p.name || 'Deleted product')}</b><br><small class="mono">${rEsc(p.sku || '')}</small>`; } },
    { l: 'Platform', v: s => rEsc(PL(s.platform).name) }, { l: 'Qty', num: 1, v: s => num(s.qty) }, ...(money ? [{ l: 'Price', num: 1, v: s => inr(s.unitPrice) }, { l: 'Gross', num: 1, v: s => inr(N(s.qty) * N(s.unitPrice)) }] : []), { l: 'Status', v: s => rEsc(SS[s.status] || 'Delivered') },
  ], D.sales, { limit: 40 }) : '';
  const salesS = rSec(N2(), 'Sales', platT + saleT, D.sales.length ? `${num(D.sales.length)} entries${money ? ' · ' + inr(D.T.gross) + ' gross' : ''}` : '');
  const expS = !showExp ? '' : rSec(N2(), 'Expenses', rTable([
    { l: 'Category', v: e => rEsc(e.category || 'Other') }, { l: 'Vendor / note', v: e => `${rEsc(e.vendor || '')}${e.note ? `<br><small>${rEsc(e.note)}</small>` : ''}` }, { l: 'Paid via', v: e => rEsc(e.paidVia || '—') }, { l: 'GST', num: 1, v: e => N(e.gst) ? inr(e.gst) : '—' }, { l: 'Amount', num: 1, v: e => inr(e.amount) },
  ], D.exps, { none: 'No expenses were recorded for this day.', foot: D.exps.length > 1 ? { 4: inr(expTot) } : null }), D.exps.length ? inr(expTot) : '');
  const MT = Object.fromEntries(MOVE_TYPES.map(m => [m[0], m[1]]));
  const stockS = rSec(N2(), 'Stock & purchasing', rTable([
    { l: 'Product', v: m => { const p = prodOf(m.productId) || {}; return `<b>${rEsc(p.name || 'Deleted product')}</b><br><small class="mono">${rEsc(p.sku || '')}</small>`; } }, { l: 'Movement', v: m => rEsc(MT[m.type] || m.type) }, { l: 'Qty', num: 1, v: m => `<span class="${N(m.qty) < 0 ? 'neg' : ''}">${N(m.qty) > 0 ? '+' : ''}${num(m.qty)}</span>` }, { l: 'Reference', v: m => rEsc(m.ref || m.note || '') },
  ], D.moves, { none: 'No stock movements were recorded.' }) + (D.posNew.length ? `<h3>Purchase orders raised</h3>` + rTable([{ l: 'PO', v: p => `<span class="mono">${rEsc(p.number)}</span>` }, { l: 'Supplier', v: p => rEsc((supOf(p.supplierId) || {}).name || '—') }, { l: 'Items', num: 1, v: p => num((p.lines || []).length) }, ...(D.costs ? [{ l: 'Value', num: 1, v: p => inr(poValue(p)) }] : []), { l: 'Expected', v: p => rEsc(fmtD(p.expectedDate)) }], D.posNew) : '') + (D.lows.length ? `<h3>Stock alerts right now</h3>` + rTable([{ l: 'Product', v: x => `<b>${rEsc(x.p.name)}</b><br><small class="mono">${rEsc(x.p.sku || '')}</small>` }, { l: 'On hand', num: 1, v: x => `<span class="${x.on <= 0 ? 'neg' : ''}">${num(x.on)}</span>` }, { l: 'Reorder at', num: 1, v: x => num(x.rl) }, { l: 'On order', num: 1, v: x => x.ord ? num(x.ord) : '—' }, { l: 'Status', v: x => rEsc(STOCK_PILL[x.st][0]) }], D.lows, { limit: 15 }) : ''));
  const mkt = (D.camps.length ? `<h3>Live campaigns</h3>` + rTable([{ l: 'Campaign', v: c => `<b>${rEsc(c.name)}</b><br><small>${rEsc(c.channel || '')}</small>` }, { l: 'Spend to date', num: 1, v: c => inr(c.spend) }, { l: 'Budget', num: 1, v: c => inr(c.budget) }, { l: 'ROAS', num: 1, v: c => N(c.spend) ? (N(c.revenue) / N(c.spend)).toFixed(1) + '×' : '—' }], D.camps) : '') + `<h3>Reviews received</h3>` + rTable([{ l: 'Rating', v: r => '★'.repeat(N(r.rating)) + `<span class="r-off">${'★'.repeat(5 - N(r.rating))}</span>` }, { l: 'Product', v: r => rEsc((prodOf(r.productId) || {}).name || '') }, { l: 'Platform', v: r => rEsc(PL(r.platform).name) }, { l: 'Review', cls: 'wrap', v: r => rEsc(String(r.title || r.text || '').slice(0, 140)) }, { l: 'Status', v: r => rEsc((REV_STATUS.find(x => x[0] === (r.status || 'new')) || [, ''])[1]) }], D.reviews, { none: 'No new reviews.' }) + (D.custNew.length ? `<p class="r-line"><b>${num(D.custNew.length)} new customer${D.custNew.length === 1 ? '' : 's'}:</b> ${rEsc(D.custNew.map(c => c.name + (c.city ? ' (' + c.city + ')' : '')).join(', '))}</p>` : '');
  const mktS = rSec(N2(), 'Marketing & customers', mkt);
  const logS = rSec(N2(), 'Activity log', rTable([{ l: 'Time', w: '70px', v: e => rEsc(fmtT(e.t)) }, { l: 'Person', v: e => rEsc(personName(e.u)) }, { l: 'Module', v: e => rEsc((MOD[e.m] || {}).l || e.m) }, { l: 'What happened', cls: 'wrap', v: e => `${rEsc(e.s)}${e.d ? `<br><small>${rEsc(String(e.d).slice(0, 220))}</small>` : ''}` }], D.logs, { limit: 120, none: 'No changes were made in the ERP on this day.' }) + (D.dels.length ? `<p class="r-line"><b>Delete requests:</b> ${rEsc(D.dels.map(r => r.label + ' (' + r.status + ')').join('; '))}</p>` : ''), D.logs.length ? num(D.logs.length) + ' entries' : '');
  return `<article class="rpt">${head}${kp}${upd}${attS}${salesS}${showExp ? expS : ''}${stockS}${mktS}${logS}<footer class="r-foot">${rEsc(co.name)} · Prepared from Triagon ERP on this computer · Figures are as entered in the ERP at the time of generation.</footer></article>`;
}
const dataForReport = (d, full) => dayData(d, full);
function reportDoc(d, full, by) { return `<!doctype html><html><head><meta charset="utf-8"><title>Triagon daily report ${d}</title><link rel="stylesheet" href="fonts/fonts.css"><style>@page{size:A4}html,body{margin:0;background:#fff}${RPT_CSS}.rpt{box-shadow:none;margin:0;padding:0;width:auto;max-width:none}</style></head><body>${reportBody(d, full, by)}</body></html>`; }

/* ---------- PDF actions ---------- */
async function downloadReport(d, onServer) {
  if (REP.busy) { toast('A report is already being made. One moment.'); return; }
  REP.busy = true; schedule(); toast(onServer ? 'Saving the full report on the server…' : 'Making the PDF…');
  try {
    if (onServer) { await api('POST', '/api/reports/generate', { date: d }); toast(`Saved the report for ${fmtD(d)} on the server`); refreshRepList(true); }
    else { await HOST.dailyPDF({ html: reportDoc(d, fullView(), ME.name || ''), date: d, mode: 'ask' }); toast('Downloaded the daily report'); addLog('export', 'daily', `Daily report PDF for ${fmtD(d)}`, 'Downloaded'); }
  } catch (e) { console.error(e); toast(e.userMsg || 'The PDF couldn’t be made. Try again.', 'bad'); }
  finally { REP.busy = false; schedule(); }
}
function dayHasActivity(d) { return S.sales.some(s => s.date === d) || S.expenses.some(e => e.date === d && !e.recurringId) || S.attendance.some(a => a.date === d) || S.updates.some(u => u.date === d) || S.moves.some(m => m.date === d) || allLogs().some(e => localDay(e.t) === d && e.a !== 'session'); }
async function refreshRepList(force) { if (!canView('daily') || REP.loading) return; if (!force && REP.list && Date.now() - REP.listAt < 30000) return; REP.loading = true; try { REP.list = await HOST.listReports(); REP.listAt = Date.now(); schedule(); } catch (e) { REP.list = REP.list || []; } finally { REP.loading = false; } }

/* ---------- view ---------- */
V.daily = () => {
  const d = repDate(); const can = canEdit('daily'); const c = repCfg(); const fv = fullView();
  refreshRepList();
  let html = ph('Daily report', 'Everything that happened on one day, as a printable PDF: team updates, attendance, sales, expenses, stock, marketing and the activity log.', `<div class="daypick">${btn('', 'repday:-1', { i: 'back', cls: 'icon', title: 'Previous day' })}<input class="inp" type="date" id="repDate" data-ch="repdate" value="${d}" max="${TODAY()}" aria-label="Report date">${btn('', 'repday:1', { i: 'chev', cls: 'icon', title: 'Next day', dis: d >= TODAY() })}</div>${btn(REP.busy ? 'Making PDF…' : 'Download PDF', 'reppdf', { pri: true, i: 'pdf', dis: REP.busy })}`);
  if (!fv) html += `<div class="banner"><span>Your PDF shows what your role can see. The full company report is saved automatically every evening.</span></div>`;
  const D = dayData(d, fv);
  const preview = `<div class="rpt-sheet">${reportBody(d, fv, ME.name)}</div>`;
  const composer = can ? panel('Post an update', `<div class="col" style="gap:10px"><label class="sr" for="updText">Update</label><textarea class="inp" id="updText" rows="4" placeholder="What moved today? Orders shipped, supplier calls, listings fixed, problems the team should know about…" maxlength="1200"></textarea><div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label class="sr" for="updCat">Category</label><select class="inp" id="updCat" style="width:auto;flex:1">${UPD_CATS.map(x => `<option>${esc(x)}</option>`).join('')}</select>${btn('Post', 'updpost', { pri: true })}</div><p class="muted" style="font-size:12px;margin:0">Posted for ${esc(d === TODAY() ? 'today' : fmtD(d))}. Updates appear at the top of the PDF.</p></div>`) : '';
  const ups = D.updates.slice().reverse();
  const updList = panel(`Updates · ${d === TODAY() ? 'today' : fmtDs(d)}`, ups.length ? `<div class="list">${ups.map(u => `<div class="li" style="align-items:flex-start">${avHTML(u.by, personName(u.by))}<div class="grow" style="white-space:normal"><b>${esc(personName(u.by))}</b><small>${esc(u.category || 'General')} · ${esc(fmtT(u.at))}</small><div class="upd">${esc(u.text)}</div></div>${u.by === ME.id || realRole() === 'ceo' ? btn('', 'upddel:' + u.id, { i: 'trash', ghost: true, cls: 'icon sm', title: 'Delete update' }) : ''}</div>`).join('')}</div>` : empty('No updates yet', 'Post what happened today. Check-out notes from the kiosk are added to the report too.'), { flush: true });
  const dis = can && fv ? '' : ' disabled';
  const auto = panel('Automatic daily PDF', `<div id="repCfgForm" class="col" style="gap:10px">
    <label class="chk"><input type="checkbox" name="auto" data-t="check"${c.auto ? ' checked' : ''}${dis}> Save the full company report on the server every day</label>
    <div class="fld" style="max-width:200px"><label for="repTime">At</label><input class="inp" type="time" id="repTime" name="time" data-t="str" value="${esc(c.time)}"${dis}></div>
    <label class="chk"><input type="checkbox" name="catchUp" data-t="check"${c.catchUp ? ' checked' : ''}${dis}> Make any missed reports from the last 7 days</label>
    ${can && fv ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${btn('Save settings', 'repcfgsave', { sm: true })}${btn('Save this day on the server now', 'repsave', { sm: true, ghost: true, dis: REP.busy })}</div>` : ''}</div>`, { sub: 'Runs on the server, even when nobody is signed in' });
  const hist = panel('Saved reports', REP.list === null ? '<div class="loading"><div class="spin"></div></div>' : REP.list.length ? `<div class="list">${REP.list.slice(0, 14).map((r, i) => `<div class="li">${icon('pdf', 'pdfic')}<div class="grow"><b>${esc(parseD(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</b><small>${esc(r.name)} · ${num(r.size / 1024)} KB</small></div><div class="acts">${btn('Open', 'repopen:' + i, { sm: true })}</div></div>`).join('')}</div>` : empty('No saved reports yet', `The first one is saved at ${t12(c.time)}.`), { flush: true, sub: REP.list && REP.list.length ? num(REP.list.length) + ' files' : '' });
  html += `<div class="g-rep"><div class="rpt-wrap">${preview}</div><div class="col">${composer}${updList}${auto}${hist}</div></div>`;
  return html;
};
function teamUpdatesPanel() {
  if (!canView('daily')) return '';
  const ups = S.updates.filter(u => u.date >= addDays(TODAY(), -2)).sort((a, b) => a.at < b.at ? 1 : -1).slice(0, 6);
  return panel('Team updates', ups.length ? `<div class="list">${ups.map(u => `<div class="li" style="align-items:flex-start">${avHTML(u.by, personName(u.by))}<div class="grow" style="white-space:normal"><b>${esc(personName(u.by))}</b><small>${esc(u.category || 'General')} · ${esc(u.date === TODAY() ? fmtT(u.at) : fmtDs(u.date))}</small><div class="upd clamp">${esc(u.text)}</div></div></div>`).join('')}</div>` : empty('No updates yet', 'Post what happened today from the Daily report page.'), { flush: true, right: btn('Daily report', 'go:daily', { sm: true, ghost: true }) });
}
Object.assign(ACT, {
  repday(n) { const cur = repDate(); ui.repDate = +n === 0 ? TODAY() : addDays(cur, +n); if (ui.repDate > TODAY()) ui.repDate = TODAY(); schedule(); },
  reppdf() { downloadReport(repDate(), false); }, repsave() { downloadReport(repDate(), true); },
  repopen(i) { const r = REP.list && REP.list[+i]; if (r) window.open('/api/reports/' + r.date, '_blank', 'noopener'); },
  repcfgsave() { const { vals } = readForm($('#repCfgForm')); if (!/^\d{2}:\d{2}$/.test(vals.time || '')) { toast('Pick a time for the daily report.', 'bad'); return; } guarded(async () => { const prev = repCfg(); const next = { auto: !!vals.auto, time: vals.time, catchUp: !!vals.catchUp }; await dbWrite('set', 'settings/reports', clean({ ...next, updatedAt: nowISO(), updatedBy: ME.id })); addLog('settings', 'daily', 'Automatic daily report settings', diffText(prev, next)); REP.done[TODAY()] = 0; toast('Saved'); }); },
  updpost() { const t = (($('#updText') || {}).value || '').trim(); const cat = ($('#updCat') || {}).value || 'General'; if (!t) { toast('Write the update first.', 'bad'); return; } const d = repDate(); guarded(async () => { await dbWrite('set', 'updates/' + newId('updates'), clean({ date: d, text: t.slice(0, 1200), category: cat, by: ME.id, at: d === TODAY() ? nowISO() : isoAt(d, '18:00') })); addLog('create', 'daily', 'Posted an update' + (d === TODAY() ? '' : ' for ' + fmtD(d)), t.slice(0, 160)); toast('Update posted'); }); },
  upddel(id) { const u = S.updates.find(x => x.id === id); if (!u || (u.by !== ME.id && realRole() !== 'ceo')) return; guarded(async () => { await dbWrite('delete', 'updates/' + id); addLog('delete', 'daily', 'Deleted an update', String(u.text).slice(0, 120)); toast('Update deleted'); }); },
});
Object.assign(CH, { repdate(v) { if (v) { ui.repDate = v > TODAY() ? TODAY() : v; schedule(); } } });
