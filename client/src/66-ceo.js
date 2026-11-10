/* =====================================================================
   CEO report: one business health score (0–100) built from 7 areas and 29 measures.
   Every measure shows its value, how it is worked out, the "poor" and "good" marks it is scored against and the points
   it would add if it reached "good". Measures without data (or outside the viewer's access) are left out and the
   remaining weights are re-balanced. Targets and area weights are editable in Scoring targets (settings/ceo).
   ===================================================================== */
Object.assign(IC, { gauge: '<path d="M4.2 17.5a9 9 0 1 1 15.6 0"/><path d="m12 13.2 3.6-4.6"/><circle cx="12" cy="13.2" r="1.5"/>', target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>' });

const CEO_AREAS = [
  { k: 'growth', l: 'Sales growth', w: 15, d: 'Is the business selling more than before, and is advertising paying back?' },
  { k: 'profit', l: 'Profitability', w: 20, d: 'Does each rupee of sales make money after cost of goods, fees and overheads?' },
  { k: 'cash', l: 'Cash & collections', w: 15, d: 'Is there enough cash, and is money coming in and going out on time?' },
  { k: 'stock', l: 'Inventory health', w: 15, d: 'Is the right stock on hand without too much money tied up or damaged?' },
  { k: 'customers', l: 'Customers & fulfilment', w: 15, d: 'Are buyers happy, orders on time, returns low and claims recovered?' },
  { k: 'ops', l: 'Listings & purchasing', w: 10, d: 'Are products live, well presented and restocked on time?' },
  { k: 'people', l: 'People', w: 10, d: 'Is the team showing up on time, at a sensible cost for the sales it brings?' },
];
// f: how the value is shown · t: [poor, good] (good can be lower than poor when lower is better)
const CEO_M = [
  { k: 'revGrowth', a: 'growth', l: 'Net revenue growth', f: 'dpct', t: [-0.2, 0.15], how: 'Net revenue (ex-GST) this period vs the previous period of the same length.', go: 'fintab:sales' },
  { k: 'unitGrowth', a: 'growth', l: 'Units sold growth', f: 'dpct', t: [-0.2, 0.15], how: 'Units sold this period vs the previous period.', go: 'fintab:sales' },
  { k: 'revTarget', a: 'growth', l: 'Revenue vs target', f: 'pct', t: [0.6, 1], how: 'Net revenue against your monthly revenue target, pro-rated to the days in the period. Set the target in Scoring targets.', go: 'ceotargets' },
  { k: 'roas', a: 'growth', l: 'Return on ad spend', f: 'x', t: [1.5, 4], how: 'Revenue from campaigns ÷ ad spend, for campaigns running in the period.', go: 'go:marketing' },
  { k: 'gm', a: 'profit', l: 'Gross margin', f: 'pct', t: [0.25, 0.5], how: '(Net revenue − cost of goods sold) ÷ net revenue.', go: 'fintab:pnl' },
  { k: 'cm', a: 'profit', l: 'Contribution margin', f: 'pct', t: [0.1, 0.35], how: 'What is left after cost of goods, platform fees and packing, ÷ net revenue.', go: 'fintab:pnl' },
  { k: 'nm', a: 'profit', l: 'Net profit margin', f: 'pct', t: [-0.05, 0.15], how: 'Net profit after expenses and depreciation ÷ net revenue.', go: 'fintab:pnl' },
  { k: 'fees', a: 'profit', l: 'Platform fees share', f: 'pct', t: [0.3, 0.12], how: 'Marketplace commission, shipping and fixed fees ÷ net revenue. Lower is better.', go: 'go:calculator' },
  { k: 'runway', a: 'cash', l: 'Cash runway', f: 'mo', t: [1, 4], how: 'Bank, cash, UPI and wallet balances ÷ average monthly spend (expenses plus vendor bills over the last 90 days). Company-wide.', go: 'fintab:accounts' },
  { k: 'recvOver', a: 'cash', l: 'Unpaid on delivered orders', f: 'pct', t: [0.3, 0], how: 'Balance still owed on dispatched and delivered sales orders ÷ their value. Lower is better.', go: 'ceogo:orders.sof.unpaid' },
  { k: 'payOver', a: 'cash', l: 'Vendor bills overdue', f: 'pct', t: [0.5, 0], how: 'Unpaid vendor bills past their due date ÷ all unpaid vendor bills. Lower is better.', go: 'invtab:invoices' },
  { k: 'recurOver', a: 'cash', l: 'Recurring bills overdue', f: 'n', t: [3, 0], how: 'Rent, salaries, subscriptions and other recurring bills past their due date and not yet posted.', go: 'fintab:recurring' },
  { k: 'inStock', a: 'stock', l: 'Products in stock', f: 'pct', t: [0.8, 0.98], how: 'Active products with stock on hand ÷ all active products.', go: 'stockfilter:out' },
  { k: 'lowShare', a: 'stock', l: 'Out or below reorder level', f: 'pct', t: [0.3, 0.05], how: 'Active products that are out of stock or at or below their reorder level ÷ all active products.', go: 'stockfilter:low' },
  { k: 'overShare', a: 'stock', l: 'Stock in overstock', f: 'pct', t: [0.4, 0.1], how: 'Stock value (at cost) in products holding more than 120 days of sales ÷ all stock value.', go: 'stockfilter:over' },
  { k: 'badShare', a: 'stock', l: 'Damaged & rejected stock', f: 'pct', t: [0.08, 0.01], how: 'Damaged and QC-rejected stock ÷ good plus damaged stock, by value at cost.', go: 'invtab:damaged' },
  { k: 'retRate', a: 'customers', l: 'Return rate', f: 'pct', t: [0.15, 0.03], how: 'Units returned ÷ units sold plus returned, this period.', go: 'go:returns' },
  { k: 'rating', a: 'customers', l: 'Average listing rating', f: 'star', t: [3.6, 4.5], how: 'Latest star rating of every listing, weighted by its number of ratings.', go: 'ceogo:customers.cus.ratings' },
  { k: 'reviewsOpen', a: 'customers', l: 'Reviews waiting for a reply', f: 'n', t: [10, 0], how: 'Reviews logged as new that nobody has replied to yet.', go: 'revfilter:new' },
  { k: 'ordersLate', a: 'customers', l: 'Sales orders running late', f: 'pct', t: [0.3, 0], how: 'Open sales orders past their promised date ÷ open sales orders.', go: 'go:orders' },
  { k: 'claimRec', a: 'customers', l: 'Claim money recovered', f: 'pct', t: [0.3, 0.8], how: 'Amount reimbursed ÷ amount claimed, for claims the platform has closed.', go: 'ceogo:returns.ret.claims' },
  { k: 'unclaimed', a: 'customers', l: 'Damaged returns not claimed', f: 'n', t: [5, 0], how: 'Damaged or missing returns this period, on platforms that reimburse, with no claim raised.', go: 'go:returns' },
  { k: 'liveShare', a: 'ops', l: 'Products live on a channel', f: 'pct', t: [0.6, 0.95], how: 'Active products live on at least one sales channel ÷ all active products.', go: 'go:catalogue' },
  { k: 'suppressed', a: 'ops', l: 'Suppressed listings', f: 'n', t: [3, 0], how: 'Listings marked suppressed on a marketplace.', go: 'go:catalogue' },
  { k: 'content', a: 'ops', l: 'Listing content score', f: 'score', t: [50, 90], how: 'Average content score of active products: title, bullets, description, keywords, images and HSN.', go: 'go:catalogue' },
  { k: 'poLate', a: 'ops', l: 'Purchase orders late', f: 'pct', t: [0.5, 0], how: 'Open purchase orders past their expected delivery date ÷ open purchase orders.', go: 'invtab:pos' },
  { k: 'lateShare', a: 'people', l: 'Late arrivals', f: 'pct', t: [0.25, 0.05], how: 'Days checked in after shift start plus grace ÷ days present (last 30 days of the period at most).', go: 'go:attendance' },
  { k: 'absShare', a: 'people', l: 'Absence', f: 'pct', t: [0.12, 0.02], how: 'Absent, loss-of-pay and not-checked-in days ÷ working days (approved leave and holidays don’t count against).', go: 'go:attendance' },
  { k: 'payShare', a: 'people', l: 'Salary cost ÷ revenue', f: 'pct', t: [0.35, 0.12], how: 'Salaries & wages expenses ÷ net revenue, this period.', go: 'fintab:expenses' },
];
const CEO_PCT = new Set(['pct', 'dpct']);
const ceoSet = () => { const s = S.settings.ceo || {}; return { revTarget: N(s.revTarget), w: { ...Object.fromEntries(CEO_AREAS.map(a => [a.k, a.w])), ...(s.w || {}) }, t: s.t || {}, off: s.off || {}, updatedAt: s.updatedAt || '' }; };
const ceoT = m => { const o = ceoSet().t[m.k]; return Array.isArray(o) && o.length === 2 && o.every(x => x !== null && x !== '' && Number.isFinite(+x)) && +o[0] !== +o[1] ? [+o[0], +o[1]] : m.t; };
const ceoScore = (v, t) => clamp((v - t[0]) / (t[1] - t[0]), 0, 1) * 100;
function ceoFmt(f, v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (f === 'dpct') return (v > 0 ? '+' : v < 0 ? '−' : '') + pct(Math.abs(v), Math.abs(v) < 0.1 && Math.round(v * 1000) % 10 !== 0 ? 1 : 0);
  if (f === 'pct') return pct(v, Math.abs(v) < 0.1 && Math.round(v * 1000) % 10 !== 0 ? 1 : 0);
  if (f === 'mo') return v >= 24 ? '24+ months' : `${nf1.format(v)} month${v === 1 ? '' : 's'}`;
  if (f === 'x') return nf1.format(v) + '×';
  if (f === 'star') return v.toFixed(2) + ' ★';
  if (f === 'score') return Math.round(v) + '/100';
  return num(v);
}
const ceoGoal = m => { const [p, g] = m.t; const up = g > p; return `${up ? '≥' : '≤'} ${ceoFmt(m.f, g)}`; };
const ceoPoor = m => { const [p, g] = m.t; const up = g > p; return `${up ? '≤' : '≥'} ${ceoFmt(m.f, p)}`; };
// [label, pill tone, ring colour, ring colour for PDFs (no CSS variables there)]
const ceoGrade = s => s === null || s === undefined ? ['Not enough data', 't-neu', 'var(--muted)', '#78716A'] : s >= 85 ? ['Excellent', 't-good', 'var(--good)', '#1D7A47'] : s >= 70 ? ['Healthy', 't-good', 'var(--good)', '#1D7A47'] : s >= 55 ? ['Needs attention', 't-warn', 'var(--warn)', '#B07D24'] : s >= 40 ? ['At risk', 't-warn', 'var(--warn)', '#B07D24'] : ['Critical', 't-bad', 'var(--bad)', '#B8381F'];
const ceoTone = s => s === null || s === undefined ? 'na' : s >= 70 ? 'good' : s >= 45 ? 'warn' : 'bad';

/* ---------- the numbers behind each measure ---------- */
function ceoValues() {
  const r = periodRange(), pr = prevRange(); const P = pnl(r), Q = pr ? pnl(pr) : null; const T = TODAY(); const costs = allow('costs');
  const v = {}, note = {}, why = {}; const set = ceoSet();
  // sales growth
  if (Q && (P.taxable || Q.taxable)) { v.revGrowth = Q.taxable ? (P.taxable - Q.taxable) / Math.abs(Q.taxable) : 1; note.revGrowth = `${inrS(P.taxable)} vs ${inrS(Q.taxable)} before`; }
  if (Q && (P.units || Q.units)) { v.unitGrowth = Q.units ? (P.units - Q.units) / Math.abs(Q.units) : 1; note.unitGrowth = `${num(P.units)} vs ${num(Q.units)} units before`; }
  if (!Q) why.growth = 'Growth needs a previous period to compare with; pick a period other than All time.';
  if (set.revTarget > 0) { const first = S.sales.reduce((a, s) => (s.date && s.date < a ? s.date : a), T); const a = r[0] > first ? r[0] : first; const b = r[1] < T ? r[1] : T; const days = Math.max(1, daysBetween(a, b) + 1); const exp = set.revTarget * days / 30.4375; v.revTarget = P.taxable / exp; note.revTarget = `${inrS(P.taxable)} of ${inrS(exp)} expected for ${num(days)} days`; }
  const cs = campStats(campsIn(r)); if (cs.spend > 0) { v.roas = cs.roas; note.roas = `${inrS(cs.rev)} from ${inrS(cs.spend)} spend`; }
  // profitability
  if (!costs) why.profit = 'Your role doesn’t see cost prices, so profit can’t be scored.';
  else if (P.taxable > 0) {
    v.gm = P.gp / P.taxable; note.gm = `${inrS(P.gp)} gross profit`;
    v.cm = P.contribution / P.taxable; note.cm = `${inrS(P.contribution)} contribution`;
    v.nm = P.net / P.taxable; note.nm = `${inrS(P.net)} net profit`;
    v.fees = P.fees / P.taxable; note.fees = `${inrS(P.fees)} in fees`;
  } else why.profit = 'No sales in this period.';
  // cash & collections
  if (canView('finance') && secOK('accounts')) {
    const acc = S.accounts.filter(a => a.active !== false && a.type !== 'card');
    if (acc.length) {
      const cash = sum(acc, a => acctBal(a)); const from = addDays(T, -89);
      const spend = sum(S.expenses.filter(e => e.date >= from && e.date <= T), e => N(e.amount) + N(e.gst)) + sum(S.pinvoices.filter(b => b.date >= from && b.date <= T), b => N(b.total));
      const burn = spend / 3; v.runway = burn > 0 ? Math.max(0, Math.min(24, cash / burn)) : (cash > 0 ? 24 : 0); note.runway = `${inrS(cash)} cash · ${inrS(burn)} a month`;
    }
  }
  if (canView('orders') || canView('finance')) {
    const done = S.orders.filter(o => ['dispatched', 'delivered'].includes(o.status) && (brandAll() || (o.lines || []).some(l => inBrand({ productId: l.productId }))));
    const tot = sum(done, soTotal); if (tot > 0) { const owed = sum(done, o => Math.max(0, soBal(o))); v.recvOver = owed / tot; note.recvOver = `${inrS(owed)} unpaid of ${inrS(tot)}`; }
  }
  if ((canView('inventory') || canView('finance')) && costs) {
    const bills = S.pinvoices.map(b => ({ b, due: pinvDue(b) })).filter(x => x.due > 0.5);
    if (S.pinvoices.length) { const due = sum(bills, x => x.due); const od = sum(bills.filter(x => x.b.dueDate && x.b.dueDate < T), x => x.due); v.payOver = due ? od / due : 0; note.payOver = due ? `${inrS(od)} overdue of ${inrS(due)} unpaid` : 'All bills paid'; }
  }
  if (canView('finance') && secOK('recurring')) { const rec = S.recurring.filter(x => x.active !== false && !x.autoPost); if (rec.length) { const od = rec.filter(x => overdueDates(x).length); v.recurOver = od.length; note.recurOver = od.length ? od.slice(0, 2).map(x => x.name).join(', ') : 'None overdue'; } }
  // inventory
  const ps = S.products.filter(p => inBrand(p) && p.status !== 'archived'); const act = ps.filter(p => p.status !== 'draft');
  if (act.length) {
    const st = act.map(p => ({ p, ...stockState(p) })); const val = p => costs ? N(p.costPrice) : 1;
    v.inStock = st.filter(x => x.on > 0).length / st.length; note.inStock = `${num(st.filter(x => x.on > 0).length)} of ${num(st.length)} products`;
    const low = st.filter(x => x.st === 'out' || x.st === 'low').length; v.lowShare = low / st.length; note.lowShare = `${num(low)} product${low === 1 ? '' : 's'}`;
    const stockV = sum(st, x => Math.max(0, x.on) * val(x.p)); const overV = sum(st.filter(x => x.st === 'over'), x => x.on * val(x.p));
    if (stockV > 0) { v.overShare = overV / stockV; note.overShare = costs ? `${inrS(overV)} of ${inrS(stockV)} at cost` : `${num(overV)} of ${num(stockV)} units`; }
    const bad = badMap(); const badV = sum(act, p => N(bad[p.id]) * val(p)); if (stockV + badV > 0) { v.badShare = badV / (stockV + badV); note.badShare = costs ? `${inrS(badV)} damaged` : `${num(badV)} units damaged`; }
    // listings & catalogue
    const plats = activePlatforms(); if (plats.length) { const live = act.filter(p => liveCount(p) > 0).length; v.liveShare = live / act.length; note.liveShare = `${num(live)} of ${num(act.length)} products`; }
    const lists = act.flatMap(p => Object.values(p.listings || {}).filter(l => l && l.status && l.status !== 'none')); if (lists.length) { const sup = lists.filter(l => l.status === 'suppressed').length; v.suppressed = sup; note.suppressed = `${num(sup)} of ${num(lists.length)} listings`; }
    v.content = sum(act, p => contentScore(p).score) / act.length; note.content = `${num(act.filter(p => contentScore(p).score >= 80).length)} products at 80+`;
    // ratings
    let rs = 0, rn = 0, rl = 0; for (const p of act) for (const pl of plats) { const c = curRating(p, pl.key).cur; if (c && N(c.avg) > 0) { const w = Math.max(1, N(c.count)); rs += N(c.avg) * w; rn += w; rl++; } }
    if (rn) { v.rating = rs / rn; note.rating = `${num(rl)} listing${rl === 1 ? '' : 's'}, ${num(rn)} ratings`; }
  } else { why.stock = 'No active products yet.'; why.ops = 'No active products yet.'; }
  if (canView('inventory')) { const open = S.pos.filter(p => (p.status === 'ordered' || p.status === 'partial') && (brandAll() || (p.lines || []).some(l => inBrand({ productId: l.productId, brandId: (l.newItem || {}).brandId })))); if (open.length) { const late = open.filter(p => p.expectedDate && p.expectedDate < T).length; v.poLate = late / open.length; note.poLate = `${num(late)} of ${num(open.length)} open`; } }
  // customers & fulfilment
  if (P.units + P.retUnits > 0) { v.retRate = P.returnRate; note.retRate = `${num(P.retUnits)} of ${num(P.units + P.retUnits)} units`; }
  const revs = S.reviews.filter(x => inBrand(x)); if (revs.length) { const nw = revs.filter(x => (x.status || 'new') === 'new').length; v.reviewsOpen = nw; note.reviewsOpen = nw ? `${num(revs.filter(x => (x.status || 'new') === 'new' && N(x.rating) <= 3).length)} of them 3★ or lower` : 'All answered'; }
  if (canView('orders')) { const open = S.orders.filter(o => SO_OPEN.includes(o.status) && o.status !== 'quote' && (brandAll() || (o.lines || []).some(l => inBrand({ productId: l.productId })))); if (open.length) { const late = open.filter(o => o.dueDate && o.dueDate < T).length; v.ordersLate = late / open.length; note.ordersLate = `${num(late)} of ${num(open.length)} open orders`; } }
  if (canView('returns') || canView('finance')) {
    const closed = S.claims.filter(c => inBrand(c) && ['paid', 'partial', 'rejected'].includes(c.status)); const amt = sum(closed, c => c.amount); if (amt > 0) { const got = sum(closed, c => c.received); v.claimRec = got / amt; note.claimRec = `${inrS(got)} of ${inrS(amt)}`; }
    const rets = salesIn(r, s => s.status === 'returned'); if (rets.length) { const claimed = new Set(S.claims.map(c => c.saleId).filter(Boolean)); const need = rets.filter(s => rcOf(s) !== 'good' && claimWin(s.platform) && !claimed.has(s.id)).length; v.unclaimed = need; note.unclaimed = `${num(rets.length)} returns this period`; }
  }
  // people (company-wide)
  if (canView('attendance')) {
    const b = r[1] < T ? r[1] : T; const a0 = addDays(b, -29); const a = r[0] > a0 ? r[0] : a0;
    if (a <= b && S.attendance.some(x => x.date >= a && x.date <= b)) {
      let work = 0, pres = 0, late = 0, abs = 0;
      for (const e of activeEmps()) for (let d = a; d <= b; d = addDays(d, 1)) { const x = attDay(e, d); if (['na', 'off', 'holiday', 'future', 'notyet'].includes(x.code)) continue; work++; if (['absent', 'notin', 'lop'].includes(x.code)) abs++; else if (x.code !== 'leave') { pres++; if (x.late) late++; } }
      if (pres) { v.lateShare = late / pres; note.lateShare = `${num(late)} of ${num(pres)} days present`; }
      if (work) { v.absShare = abs / work; note.absShare = `${num(abs)} of ${num(work)} working days`; }
    } else why.people = 'No attendance records in this period.';
  }
  if (costs && canView('finance') && P.taxable > 0) { const sal = sum(expensesIn(r).filter(e => /salar|wage|payroll/i.test(e.category || '')), e => e.amount); if (sal > 0) { v.payShare = sal / P.taxable; note.payShare = `${inrS(sal)} salaries`; } }
  return { v, note, why, P, Q, r };
}
function ceoReport() {
  return memo('ceo:' + [ui.brand, ui.period, ui.from || '', ui.to || '', myRole()].join('|'), () => {
    const X = ceoValues(); const set = ceoSet();
    const ms = CEO_M.map(m => { const v = X.v[m.k]; const t = ceoT(m); const on = !set.off[m.k]; const has = on && v !== undefined && v !== null && Number.isFinite(v); return { ...m, v: has ? v : null, t, on, note: X.note[m.k] || '', s: has ? ceoScore(v, t) : null, gain: 0 }; });
    const areas = CEO_AREAS.map(a => { const list = ms.filter(m => m.a === a.k); const sc = list.filter(m => m.s !== null); return { ...a, w: Math.max(0, N(set.w[a.k])), list, n: sc.length, s: sc.length ? sum(sc, m => m.s) / sc.length : null, why: X.why[a.k] || 'No data for these measures yet.' }; });
    const live = areas.filter(a => a.s !== null && a.w > 0); const W = sum(live, a => a.w);
    const score = W ? Math.round(sum(live, a => a.s * a.w) / W) : null;
    for (const a of live) for (const m of a.list) if (m.s !== null) m.gain = (100 - m.s) / a.n * a.w / W;
    const fixes = ms.filter(m => m.s !== null && m.s < 75 && m.gain >= 0.5).sort((x, y) => y.gain - x.gain).slice(0, 6);
    const wins = ms.filter(m => m.s !== null && m.s >= 85).sort((x, y) => (y.s - x.s) || ((areas.find(a => a.k === y.a) || {}).w - (areas.find(a => a.k === x.a) || {}).w)).slice(0, 5);
    return { score, areas, live, ms, fixes, wins, used: ms.filter(m => m.s !== null).length, P: X.P, Q: X.Q, r: X.r };
  });
}
// brand by brand: the measures that make sense for one brand
const CEO_BRAND_M = ['revGrowth', 'cm', 'retRate', 'inStock', 'rating', 'content'];
function ceoBrands() {
  return memo('ceob:' + [ui.period, ui.from || '', ui.to || '', myRole()].join('|'), () => {
    const keep = ui.brand; const out = [];
    try {
      for (const b of myBrands()) {
        ui.brand = b.id; const X = ceoValues(); const ms = CEO_BRAND_M.map(k => CEO_M.find(m => m.k === k)).filter(m => !ceoSet().off[m.k]).map(m => { const v = X.v[m.k]; const has = v !== undefined && v !== null && Number.isFinite(v); return { ...m, v: has ? v : null, s: has ? ceoScore(v, ceoT(m)) : null }; });
        const sc = ms.filter(m => m.s !== null); out.push({ b, P: X.P, ms: Object.fromEntries(ms.map(m => [m.k, m])), s: sc.length ? Math.round(sum(sc, m => m.s) / sc.length) : null });
      }
    } finally { ui.brand = keep; }
    return out.sort((x, y) => y.P.taxable - x.P.taxable);
  });
}

/* ---------- the page ---------- */
const ceoRing = (s, size = 148, doc) => { const g = ceoGrade(s); const R = 54, C = 2 * Math.PI * R; const f = s === null ? 0 : clamp(s, 0, 100) / 100; return `<svg class="ceo-ring" viewBox="0 0 128 128" width="${size}" height="${size}" role="img" aria-label="Business health score ${s === null ? 'not available' : s + ' out of 100'}"><circle cx="64" cy="64" r="${R}" fill="none" stroke="${doc ? '#F1EEE7' : 'var(--sunken)'}" stroke-width="11"/><circle cx="64" cy="64" r="${R}" fill="none" stroke="${doc ? g[3] : g[2]}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${(C * f).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 64 64)"/><text x="64" y="66" text-anchor="middle" class="ceo-ring-n">${s === null ? '—' : s}</text><text x="64" y="86" text-anchor="middle" class="ceo-ring-l">out of 100</text></svg>`; };
const ceoBar = s => `<span class="ceo-bar ${ceoTone(s)}"><i style="width:${s === null ? 0 : clamp(s, 0, 100).toFixed(0)}%"></i></span>`;
const ceoChip = s => `<span class="ceo-sc ${ceoTone(s)}">${s === null ? '—' : Math.round(s)}</span>`;
function ceoScopeLabel() { return brandAll() ? (restricted() ? 'Your brands' : 'All brands') : brandName(ui.brand); }
function ceoVerdict(R) {
  if (R.score === null) return 'There isn’t enough data in this period to score the business yet. Record sales, stock and expenses, or pick a longer period.';
  const sorted = R.live.slice().sort((a, b) => b.s - a.s); const best = sorted[0], worst = sorted[sorted.length - 1];
  let t = ''; if (best && worst && best !== worst) t += `Strongest area: ${best.l} (${Math.round(best.s)}). Weakest: ${worst.l} (${Math.round(worst.s)}).`; else if (best) t += `${best.l} scores ${Math.round(best.s)}.`;
  if (R.fixes.length) t += ` Fixing the top ${Math.min(3, R.fixes.length)} item${R.fixes.length === 1 ? '' : 's'} below would add about ${Math.round(sum(R.fixes.slice(0, 3), m => m.gain))} points.`;
  return t;
}
function ceoFixHTML(m, i) {
  const [, g] = m.t; return `<div class="li"><span class="ceo-rank">${i + 1}</span><div class="grow"><b>${esc(m.l)}: ${esc(ceoFmt(m.f, m.v))} → aim for ${esc(ceoFmt(m.f, g))}</b><small>${esc(m.note || m.how)}</small></div><span class="pill t-acc nd" title="Points the overall score would gain">+${Math.max(1, Math.round(m.gain))} pts</span>${m.go ? `<button class="btn sm" data-act="${esc(m.go)}">Open</button>` : ''}</div>`;
}
function ceoAreaHTML(a) {
  const rows = a.list.map(m => `<li class="${m.s === null ? 'na' : ''}"><div class="grow"><b>${esc(m.l)}</b><small title="${esc(m.how)}">${esc(m.s === null ? (m.on ? 'No data yet' : 'Turned off in Scoring targets') : m.note)}</small></div><div class="ceo-v"><b class="tnum">${esc(ceoFmt(m.f, m.v))}</b><small>good ${esc(ceoGoal(m))}</small></div>${ceoChip(m.s)}</li>`).join('');
  return `<section class="panel ceo-area"><div class="ceo-ah"><div class="grow"><h3>${esc(a.l)}</h3><p>${esc(a.d)}</p></div><div class="ceo-big ${ceoTone(a.s)}">${a.s === null ? '—' : Math.round(a.s)}<small>${a.s === null ? '' : '/100'}</small></div></div>${ceoBar(a.s)}<div class="ceo-w muted">Weight ${num(a.w)}${a.s === null ? ` · ${esc(a.why)}` : ` · ${num(a.n)} of ${num(a.list.length)} measures scored`}</div><ul class="ceo-ml">${rows}</ul></section>`;
}
V.ceo = () => {
  const R = ceoReport(); const g = ceoGrade(R.score); const P = R.P, Q = R.Q; const costs = allow('costs'); const T = TODAY();
  const acts = `${btn('Copy summary', 'ceocopy', { i: 'copy' })}${btn('Download PDF', 'ceopdf', { i: 'pdf' })}${canEdit('ceo') ? btn('Scoring targets', 'ceotargets', { i: 'target' }) : ''}`;
  let html = ph('CEO report', `${esc(ceoScopeLabel())} · ${esc(rangeLabel())}. One health score for the business, the areas behind it and what to fix first.`, acts);
  html += `<section class="panel ceo-hero"><div class="ceo-hero-l">${ceoRing(R.score)}<div><span class="pill ${g[1]}">${esc(g[0])}</span><p class="ceo-verdict">${esc(ceoVerdict(R))}</p><p class="muted ceo-basis">Scored on ${num(R.used)} of ${num(CEO_M.length)} measures across ${num(R.live.length)} areas.${Q ? ` Growth compares with ${esc(rangeLabel(prevRange()))}.` : ''}</p></div></div>
    <div class="ceo-hero-r">${R.areas.map(a => `<div class="ceo-hb"><span>${esc(a.l)}</span>${ceoBar(a.s)}<b class="tnum">${a.s === null ? '—' : Math.round(a.s)}</b></div>`).join('')}</div></section>`;
  // key numbers
  const d = k => Q ? deltaOf(P[k], Q[k]) : undefined; const inv = invValue(); const k = [];
  k.push({ l: 'Net revenue', v: inrS(P.taxable), d: d('taxable'), s: 'ex-GST', title: inr(P.taxable) });
  if (costs) k.push({ l: 'Net profit', v: inrS(P.net), tone: P.net < 0 ? 'neg' : '', d: d('net'), s: pct(ratio(P.net, P.taxable), 0) + ' margin', title: inr(P.net) });
  if (canView('finance') && secOK('accounts')) { const cash = sum(S.accounts.filter(a => a.active !== false && a.type !== 'card'), a => acctBal(a)); k.push({ l: 'Cash & bank', v: inrS(cash), tone: cash < 0 ? 'neg' : '', s: 'all accounts', title: inr(cash) }); }
  if (canView('orders')) { const owed = sum(S.orders.filter(o => o.status !== 'cancelled' && o.status !== 'quote'), o => Math.max(0, soBal(o))); k.push({ l: 'To collect', v: inrS(owed), s: 'sales orders', title: inr(owed) }); }
  if ((canView('inventory') || canView('finance')) && costs) { const due = sum(S.pinvoices, b => pinvDue(b)); const od = sum(S.pinvoices.filter(b => b.dueDate && b.dueDate < T), b => pinvDue(b)); k.push({ l: 'To pay vendors', v: inrS(due), s: od > 0.5 ? inrS(od) + ' overdue' : 'nothing overdue', tone: od > 0.5 ? 'neg' : '', title: inr(due) }); }
  k.push(costs ? { l: 'Stock at cost', v: inrS(inv.cost), s: num(inv.units) + ' units', title: inr(inv.cost) } : { l: 'Stock at price', v: inrS(inv.retail), s: num(inv.units) + ' units' });
  html += kpis(k.slice(0, 6));
  const fixes = R.fixes.length ? `<div class="list ceo-list">${R.fixes.map(ceoFixHTML).join('')}</div>` : `<div class="empty" style="padding:24px 16px"><h3>Nothing urgent</h3><p>Every scored measure is at 75 or better.</p></div>`;
  const wins = R.wins.length ? `<div class="list ceo-list">${R.wins.map(m => `<div class="li"><span class="sev good"></span><div class="grow"><b>${esc(m.l)}: ${esc(ceoFmt(m.f, m.v))}</b><small>${esc(m.note || '')} · good is ${esc(ceoGoal(m))}</small></div>${ceoChip(m.s)}</div>`).join('')}</div>` : `<div class="empty" style="padding:24px 16px"><p>No measure has reached 85 yet.</p></div>`;
  html += `<div class="g31">${panel('Fix these first', fixes, { flush: true, sub: 'ranked by points they add to the score' })}${panel('Going well', wins, { flush: true })}</div>`;
  html += `<div class="ceo-areas">${R.areas.map(ceoAreaHTML).join('')}</div>`;
  if (brandAll() && myBrands().length > 1) {
    const rows = ceoBrands(); const cell = (x, k2) => { const m = x.ms[k2]; return m ? `<span class="tnum">${esc(ceoFmt(m.f, m.v))}</span>` : '<span class="muted">—</span>'; };
    html += panel('Brand scorecard', table('ceob', [
      { k: 'b', l: 'Brand', render: x => `<div class="cell-main">${brandTile(x.b)}<div><b>${esc(x.b.name)}</b></div></div>`, sort: x => x.b.name },
      { k: 'rev', l: 'Net revenue', num: 1, render: x => inr(x.P.taxable), sort: x => x.P.taxable },
      { k: 'g', l: 'Growth', num: 1, render: x => cell(x, 'revGrowth'), sort: x => (x.ms.revGrowth || {}).v ?? -9 },
      { k: 'cm', l: 'Contribution', num: 1, cost: 1, render: x => cell(x, 'cm'), sort: x => (x.ms.cm || {}).v ?? -9 },
      { k: 'ret', l: 'Return rate', num: 1, render: x => cell(x, 'retRate'), sort: x => (x.ms.retRate || {}).v ?? 9 },
      { k: 'ins', l: 'In stock', num: 1, render: x => cell(x, 'inStock'), sort: x => (x.ms.inStock || {}).v ?? -9 },
      { k: 'rat', l: 'Rating', num: 1, render: x => cell(x, 'rating'), sort: x => (x.ms.rating || {}).v ?? -9 },
      { k: 'con', l: 'Content', num: 1, render: x => cell(x, 'content'), sort: x => (x.ms.content || {}).v ?? -9 },
      { k: 's', l: 'Brand score', num: 1, render: x => `<span class="ceo-bs">${ceoBar(x.s)}${ceoChip(x.s)}</span>`, sort: x => x.s ?? -1 },
    ], rows, { sort: { k: 'rev', dir: 'desc' }, empty: empty('No brands yet', 'Add brands to compare them here.') }), { flush: true, sub: 'growth, margin, returns, stock, rating and content, scored on the same targets' });
  }
  html += `<details class="panel ceo-how"><summary>How the score works</summary><div class="panel-b"><p>Each measure gets 0 to 100 points: 0 at or beyond its <b>poor</b> mark, 100 at or beyond its <b>good</b> mark, and in proportion in between. An area’s score is the average of its measures that have data. The overall score is the weighted average of the areas (weights ${R.areas.map(a => `${esc(a.l)} ${num(a.w)}`).join(', ')}). Measures and areas with no data, or that your role can’t see, are left out and the other weights are re-balanced, so a new business isn’t marked down for empty modules.</p><p>The points next to each fix are what the overall score would gain if that measure reached its good mark. Bands: 85+ Excellent, 70–84 Healthy, 55–69 Needs attention, 40–54 At risk, under 40 Critical. The period and brand at the top of the page apply; cash, vendor bills, people and the recurring bills are company-wide.</p>${canEdit('ceo') ? `<p>${btn('Change targets and weights', 'ceotargets', { sm: true, i: 'target' })}</p>` : ''}</div></details>`;
  return html;
};

/* ---------- copy, PDF, targets ---------- */
function ceoSummaryText() {
  const R = ceoReport(); const g = ceoGrade(R.score)[0];
  const lines = [`${company().name || 'Triagon Ventures'} · CEO report`, `${ceoScopeLabel()} · ${rangeLabel()}`, '', `Health score: ${R.score === null ? '—' : R.score + '/100'} (${g})`, ...R.areas.map(a => `• ${a.l}: ${a.s === null ? 'no data' : Math.round(a.s)}`)];
  if (R.fixes.length) lines.push('', 'Fix first:', ...R.fixes.slice(0, 5).map((m, i) => `${i + 1}. ${m.l}: ${ceoFmt(m.f, m.v)} → ${ceoFmt(m.f, m.t[1])} (+${Math.max(1, Math.round(m.gain))} pts)`));
  if (R.wins.length) lines.push('', 'Going well:', ...R.wins.slice(0, 3).map(m => `• ${m.l}: ${ceoFmt(m.f, m.v)}`));
  if (allow('costs')) lines.push('', `Net revenue ${inr(R.P.taxable)} · net profit ${inr(R.P.net)}`); else lines.push('', `Net revenue ${inr(R.P.taxable)}`);
  return lines.join('\n');
}
function ceoDoc() {
  const R = ceoReport(); const g = ceoGrade(R.score); const costs = allow('costs'); const P = R.P;
  const css = `<style>.doc .ceo-top{display:grid;grid-template-columns:150px 1fr;gap:18px;align-items:center;margin:4px 0 14px}.doc .ceo-top svg{width:140px;height:140px}.doc .ceo-ring-n{font:700 34px "IBM Plex Sans",Arial,sans-serif;fill:#1C1B18}.doc .ceo-ring-l{font:500 9px "IBM Plex Sans",Arial,sans-serif;fill:#7C766C}
  .doc .gr{display:inline-block;border-radius:999px;padding:2px 10px;font-weight:700;font-size:10px;letter-spacing:.06em;text-transform:uppercase}.doc .gr.t-good{background:#E3F2E8;color:#1D7A47}.doc .gr.t-warn{background:#FBF1DB;color:#986109}.doc .gr.t-bad{background:#FBE5DE;color:#B8381F}.doc .gr.t-neu{background:#F1EEE7;color:#4A463F}
  .doc .bar{display:inline-block;width:110px;height:7px;border-radius:4px;background:#F1EEE7;vertical-align:middle;margin-right:6px;overflow:hidden}.doc .bar i{display:block;height:100%;border-radius:4px}.doc .good i{background:#1D7A47}.doc .warn i{background:#C68A1A}.doc .bad i{background:#B8381F}.doc .na i{background:#ccc}
  .doc h2{font:600 13px "IBM Plex Sans",Arial,sans-serif;margin:16px 0 6px;color:#1C1B18}.doc .sc{font-weight:700}.doc .sc.good{color:#1D7A47}.doc .sc.warn{color:#986109}.doc .sc.bad{color:#B8381F}.doc tr.ar td{background:#FBF6EA;font-weight:600}.doc .keep{page-break-inside:avoid;break-inside:avoid}.doc h2{break-after:avoid;page-break-after:avoid}</style>`;
  const bar = s => `<span class="bar ${ceoTone(s)}"><i style="width:${s === null ? 0 : clamp(s, 0, 100).toFixed(0)}%"></i></span>`;
  const sc = s => `<span class="sc ${ceoTone(s)}">${s === null ? '—' : Math.round(s)}</span>`;
  const key = [['Net revenue (ex-GST)', inr(P.taxable)], ...(costs ? [['Contribution', inr(P.contribution)], ['Net profit', inr(P.net)]] : []), ['Units sold', num(P.units)], ['Return rate', pct(P.returnRate)]];
  let b = css + docHead('CEO report', `${ceoScopeLabel()} · ${rangeLabel()}`);
  b += `<div class="ceo-top keep">${ceoRing(R.score, 140, true)}<div><span class="gr ${g[1]}">${esc(g[0])}</span><p style="font-size:12px;margin:8px 0 6px">${esc(ceoVerdict(R))}</p><div class="kv">${key.map(([l, v]) => `<span>${esc(l)}</span><b>${v}</b>`).join('')}</div></div></div>`;
  b += `<div class="keep"><h2>Areas</h2><table><thead><tr><th>Area</th><th class="n">Weight</th><th>Score</th><th>Measures scored</th></tr></thead><tbody>${R.areas.map(a => `<tr><td><b>${esc(a.l)}</b><br><small>${esc(a.d)}</small></td><td class="n">${num(a.w)}</td><td>${bar(a.s)}${sc(a.s)}</td><td>${a.s === null ? `<small>${esc(a.why)}</small>` : `${num(a.n)} of ${num(a.list.length)}`}</td></tr>`).join('')}</tbody></table></div>`;
  if (R.fixes.length) b += `<div class="keep"><h2>Fix these first</h2><table><thead><tr><th>#</th><th>Measure</th><th class="n">Now</th><th class="n">Aim for</th><th class="n">Adds</th></tr></thead><tbody>${R.fixes.map((m, i) => `<tr><td>${i + 1}</td><td><b>${esc(m.l)}</b><br><small>${esc(m.note || m.how)}</small></td><td class="n">${esc(ceoFmt(m.f, m.v))}</td><td class="n">${esc(ceoFmt(m.f, m.t[1]))}</td><td class="n">+${Math.max(1, Math.round(m.gain))} pts</td></tr>`).join('')}</tbody></table></div>`;
  b += `<h2>All measures</h2><table><thead><tr><th>Measure</th><th class="n">Value</th><th class="n">Good</th><th class="n">Poor</th><th class="n">Score</th></tr></thead><tbody>${R.areas.map(a => `<tr class="ar"><td colspan="4">${esc(a.l)}</td><td class="n">${sc(a.s)}</td></tr>${a.list.map(m => `<tr><td>${esc(m.l)}<br><small>${esc(m.s === null ? (m.on ? 'No data yet' : 'Turned off') : m.note)}</small></td><td class="n">${esc(ceoFmt(m.f, m.v))}</td><td class="n">${esc(ceoGoal(m))}</td><td class="n">${esc(ceoPoor(m))}</td><td class="n">${sc(m.s)}</td></tr>`).join('')}`).join('')}</tbody></table>`;
  if (brandAll() && myBrands().length > 1) { const rows = ceoBrands(); const c = (x, k) => { const m = x.ms[k]; return m ? esc(ceoFmt(m.f, m.v)) : '—'; }; b += `<div class="keep"><h2>Brand scorecard</h2><table><thead><tr><th>Brand</th><th class="n">Net revenue</th><th class="n">Growth</th>${costs ? '<th class="n">Contribution</th>' : ''}<th class="n">Returns</th><th class="n">In stock</th><th class="n">Rating</th><th class="n">Score</th></tr></thead><tbody>${rows.map(x => `<tr><td><b>${esc(x.b.name)}</b></td><td class="n">${inr(x.P.taxable)}</td><td class="n">${c(x, 'revGrowth')}</td>${costs ? `<td class="n">${c(x, 'cm')}</td>` : ''}<td class="n">${c(x, 'retRate')}</td><td class="n">${c(x, 'inStock')}</td><td class="n">${c(x, 'rating')}</td><td class="n">${sc(x.s)}</td></tr>`).join('')}</tbody></table></div>`; }
  b += `<p class="terms">How it is scored: each measure gets 0 points at its poor mark and 100 at its good mark, in proportion in between. Areas average their measures; the overall score is the weighted average of the areas, leaving out anything without data. Bands: 85+ Excellent, 70–84 Healthy, 55–69 Needs attention, 40–54 At risk, under 40 Critical. Prepared ${esc(fmtD(TODAY()))} by ${esc(ME.name || '')}.</p>`;
  return docHTML('CEO report', b);
}
Object.assign(ACT, {
  ceogo(a) { const [m, g, t] = String(a).split('.'); if (g === 'sof') ui.filt.sof = t; else if (g && t) ui.tab[g] = t; ACT.go(m); },
  ceocopy() { copyText(ceoSummaryText(), 'Summary copied. Paste it into WhatsApp or email.'); addLog('export', 'ceo', 'Copied the CEO report summary'); },
  async ceopdf() { const ok = await makePDF(ceoDoc(), `CEO-report-${periodRange()[0]}-to-${periodRange()[1] > TODAY() ? TODAY() : periodRange()[1]}.pdf`.replace('2000-01-01-to', 'all-time-to'), { footer: `${company().name || 'Triagon Ventures'} · CEO report · ${rangeLabel()}` }); if (ok) addLog('export', 'ceo', 'Downloaded the CEO report PDF', rangeLabel()); },
  ceotargets() {
    if (!canEdit('ceo')) { toast('Only people who can edit the CEO report can change its targets.', 'bad'); return; }
    const set = ceoSet(); const shown = (m, x) => CEO_PCT.has(m.f) ? Math.round(x * 1000) / 10 : x; const unit = m => CEO_PCT.has(m.f) ? '%' : m.f === 'mo' ? 'months' : m.f === 'x' ? '×' : m.f === 'star' ? '★' : m.f === 'score' ? '/100' : '';
    const mrow = m => { const t = ceoT(m); return `<tr><td><label class="chk"><input type="checkbox" name="on.${m.k}" data-t="check"${set.off[m.k] ? '' : ' checked'}> <b>${esc(m.l)}</b></label><small class="muted" style="display:block">${esc(m.how)}</small></td><td><input class="inp tnum" type="number" step="any" name="tp.${m.k}" data-t="num" value="${esc(shown(m, t[0]))}" aria-label="${esc(m.l)} poor mark"></td><td><input class="inp tnum" type="number" step="any" name="tg.${m.k}" data-t="num" value="${esc(shown(m, t[1]))}" aria-label="${esc(m.l)} good mark"></td><td class="muted">${esc(unit(m))}</td></tr>`; };
    const tabs = [
      { l: 'Targets', html: form([{ n: 'revTarget', l: 'Monthly net revenue target (ex-GST)', t: 'money', min: 0, help: 'Used by “Revenue vs target”. Leave blank to skip that measure.' }], { revTarget: set.revTarget || '' }) + `<p class="help">Each measure scores 0 at its poor mark and 100 at its good mark. When lower is better (returns, overdue bills), put the lower number in Good. Percentages are in %.</p>` },
      { l: 'Area weights', html: form(CEO_AREAS.map(a => ({ n: 'w.' + a.k, l: a.l, t: 'number', min: 0, step: 1, help: a.d })), { w: set.w }) + `<p class="help">Weights are relative: an area with weight 20 counts twice as much as one with 10. Set 0 to leave an area out.</p>` },
      ...CEO_AREAS.map(a => ({ l: a.l, html: `<div class="tw"><table class="t grid"><thead><tr><th>Measure</th><th>Poor</th><th>Good</th><th></th></tr></thead><tbody>${CEO_M.filter(m => m.a === a.k).map(mrow).join('')}</tbody></table></div>` })),
    ];
    openDrawer({
      title: 'Scoring targets', sub: 'What counts as poor and good for each measure, and how much each area weighs in the score.', tabs, wide: true, saveLabel: 'Save targets', footExtra: btn('Reset to defaults', 'ceoreset', { ghost: true }),
      validate: v => { const e = []; for (const m of CEO_M) { const p = getPath(v, 'tp.' + m.k), g = getPath(v, 'tg.' + m.k); if (p === null || g === null || p === undefined || g === undefined) e.push({ n: 'tp.' + m.k, m: `${m.l}: enter both a poor and a good mark.` }); else if (p === g) e.push({ n: 'tg.' + m.k, m: `${m.l}: poor and good can’t be the same.` }); } if (CEO_AREAS.every(a => !N(getPath(v, 'w.' + a.k)))) e.push({ n: 'w.growth', m: 'Give at least one area a weight above 0.' }); return e; },
      onSave: async v => {
        const t = {}, off = {}, w = {};
        for (const m of CEO_M) { const k = CEO_PCT.has(m.f) ? 100 : 1; const p = N(getPath(v, 'tp.' + m.k)) / k, g = N(getPath(v, 'tg.' + m.k)) / k; if (p !== m.t[0] || g !== m.t[1]) t[m.k] = [p, g]; if (!getPath(v, 'on.' + m.k)) off[m.k] = true; }
        for (const a of CEO_AREAS) w[a.k] = Math.max(0, N(getPath(v, 'w.' + a.k)));
        await dbWrite('set', 'settings/ceo', clean({ revTarget: N(v.revTarget) || null, w, t, off, updatedAt: nowISO(), updatedBy: ME.id }));
        addLog('settings', 'ceo', 'CEO report targets and weights updated');
      },
      savedMsg: 'Targets saved. The score is updated.',
    });
  },
  async ceoreset() { if (!canEdit('ceo')) return; await dbWrite('set', 'settings/ceo', { updatedAt: nowISO(), updatedBy: ME.id }); addLog('settings', 'ceo', 'CEO report targets reset to defaults'); closeDrawer(); toast('Targets and weights are back to the defaults.'); },
});

// the dashboard's company overview gets a one-line link to the score
{
  const dash0 = V.dashboard;
  V.dashboard = () => {
    const h = dash0(); if (!canView('ceo') || !allow('overview') || (ui.dashTab && ui.dashTab !== 'overview')) return h;
    const at = h.indexOf('<section class="kpis'); if (at < 0) return h;
    const R = ceoReport(); const g = ceoGrade(R.score); const worst = R.live.slice().sort((a, b) => a.s - b.s)[0];
    const strip = `<button type="button" class="ceo-strip" data-act="go:ceo">${ceoRing(R.score, 46)}<span class="grow"><b>Business health ${R.score === null ? '—' : R.score + '/100'}</b> <span class="pill ${g[1]} nd">${esc(g[0])}</span><small>${worst && R.live.length > 1 ? `Weakest area: ${esc(worst.l)} (${Math.round(worst.s)})` : 'See how the score is made up'}${R.fixes[0] ? ` · first fix: ${esc(R.fixes[0].l.toLowerCase())}` : ''}</small></span><span class="ceo-strip-go">CEO report ${icon('chev')}</span></button>`;
    return h.slice(0, at) + strip + h.slice(at);
  };
}
