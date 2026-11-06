'use strict';
/* Business maths the server needs on its own (AI tools, kiosk punches, automatic reports).
   Mirrors the browser app's formulas. */
const N = v => { const n = +v; return Number.isFinite(n) ? n : 0; };
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const today = () => ymd(new Date());
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); const x = new Date(y, m - 1, d + n); return ymd(x); };
const sum = (a, f) => a.reduce((t, x) => t + N(f(x)), 0);

const DEFAULT_PLATFORMS = [
  { key: 'amazon', name: 'Amazon', code: 'AMZ', commission: 15, fixed: 25, shipBase: 60, shipExtra: 25, collection: 0, gstOnFees: 18, tcs: 0.5, tds: 0.1, returnCost: 80, on: true },
  { key: 'flipkart', name: 'Flipkart', code: 'FK', commission: 14, fixed: 30, shipBase: 65, shipExtra: 25, collection: 1.5, gstOnFees: 18, tcs: 0.5, tds: 0.1, returnCost: 85, on: true },
  { key: 'meesho', name: 'Meesho', code: 'MSH', commission: 0, fixed: 0, shipBase: 70, shipExtra: 30, collection: 0, gstOnFees: 18, tcs: 0.5, tds: 0.1, returnCost: 70, on: true },
  { key: 'website', name: 'Own website', code: 'WEB', commission: 0, fixed: 0, shipBase: 70, shipExtra: 30, collection: 2, gstOnFees: 18, tcs: 0, tds: 0, returnCost: 100, on: true },
  { key: 'b2b', name: 'Wholesale / B2B', code: 'B2B', commission: 0, fixed: 0, shipBase: 0, shipExtra: 0, collection: 0, gstOnFees: 18, tcs: 0, tds: 0, returnCost: 0, on: true },
  { key: 'direct', name: 'Direct & custom orders', code: 'DIR', commission: 0, fixed: 0, shipBase: 0, shipExtra: 0, collection: 0, gstOnFees: 18, tcs: 0, tds: 0, returnCost: 0, on: true },
  { key: 'etsy', name: 'Etsy (export)', code: 'ETSY', commission: 6.5, fixed: 20, shipBase: 650, shipExtra: 250, collection: 3, gstOnFees: 18, tcs: 0, tds: 0, returnCost: 0, on: false },
];
function platforms(store) {
  const s = store.get('settings/platforms'); const l = s && Array.isArray(s.list) && s.list.length ? s.list.slice() : DEFAULT_PLATFORMS.slice();
  for (const d of DEFAULT_PLATFORMS) if (d.key === 'direct' && !l.some(x => x.key === 'direct')) l.push(d);
  return l;
}
const PL = (store, key) => platforms(store).find(p => p.key === key) || { key, name: key || '—', commission: 0, fixed: 0, shipBase: 0, shipExtra: 0, collection: 0, gstOnFees: 18, tcs: 0, tds: 0, returnCost: 0 };
function effPlat(plat, prod) {
  const f = ((((prod || {}).listings || {})[plat.key] || {}).fees) || {}; const o = { ...plat };
  const has = k => f[k] !== undefined && f[k] !== null && f[k] !== '';
  if (has('commission')) o.commission = N(f.commission); if (has('fixed')) o.fixed = N(f.fixed);
  if (has('ship')) { o.shipBase = N(f.ship); o.shipExtra = 0; } if (has('collection')) o.collection = N(f.collection);
  if (has('other')) o.otherFee = N(f.other); if (has('returnCost')) o.returnCost = N(f.returnCost);
  return o;
}
function unitEcon({ price, gst, cost, pack, weight, plat, ads = 0, ret = 0 }) {
  price = N(price); gst = N(gst); cost = N(cost); pack = N(pack); weight = N(weight);
  const p = plat || {}; const taxable = price / (1 + gst / 100), outGST = price - taxable;
  const commission = price * N(p.commission) / 100, fixed = N(p.fixed) + N(p.otherFee);
  const slabs = Math.max(0, Math.ceil(Math.max(weight, 1) / 500) - 1); const shipping = N(p.shipBase) + slabs * N(p.shipExtra);
  const collection = price * N(p.collection) / 100; const fees = commission + fixed + shipping + collection;
  const gstFeeRate = N(p.gstOnFees === undefined ? 18 : p.gstOnFees) / 100; const gstOnFees = fees * gstFeeRate;
  const tcs = taxable * N(p.tcs) / 100, tds = taxable * N(p.tds) / 100; const settlement = price - fees - gstOnFees - tcs - tds;
  const profit = taxable - cost - fees - pack - N(ads) - N(ret) / 100 * (N(p.returnCost) + shipping);
  return { price, taxable, outGST, fees, gstOnFees, gstFeeRate, shipping, returnCost: N(p.returnCost), tcs, tds, settlement, cost, pack, profit };
}
function saleSnapshot(store, s, prod) {
  const p = prod || store.get('products/' + s.productId) || {};
  const e = unitEcon({ price: s.unitPrice, gst: p.gstRate ?? 18, cost: p.costPrice, pack: p.packagingCost, weight: p.weight, plat: effPlat(PL(store, s.platform), p) });
  return { taxable: e.taxable, outGST: e.outGST, cost: e.cost, pack: e.pack, fees: e.fees, gstOnFees: e.gstOnFees, gstFeeRate: e.gstFeeRate, shipping: e.shipping, returnCost: e.returnCost, tcs: e.tcs, tds: e.tds, gstRate: N(p.gstRate ?? 18) };
}
function saleFin(s) {
  const q = N(s.qty), price = N(s.unitPrice); const c = s.calc || {};
  const r = { units: 0, gross: 0, returns: 0, taxable: 0, cogs: 0, fees: 0, settlement: 0, profit: 0 };
  if (s.status === 'cancelled') return r; r.gross = price * q;
  if (s.status === 'returned') { r.returns = price * q; r.fees = (N(c.shipping) + N(c.returnCost)) * q; r.settlement = -r.fees * (1 + N(c.gstFeeRate)); r.cogs = (isRestocked(s) ? 0 : N(c.cost) * q) + N(c.cost) * N(s.wasteQty); r.profit = -r.cogs - r.fees - N(c.pack) * q; return r; }
  r.units = q; r.taxable = N(c.taxable) * q; r.cogs = N(c.cost) * (q + N(s.wasteQty)); r.fees = s.actualFees != null && s.actualFees !== '' ? N(s.actualFees) : N(c.fees) * q;
  r.settlement = r.gross - r.fees * (1 + N(c.gstFeeRate)) - (N(c.tcs) + N(c.tds)) * q; r.profit = r.taxable - r.cogs - r.fees - N(c.pack) * q; return r;
}
const isRestocked = s => s.retCondition ? s.retCondition === 'good' : s.restocked !== false;
// wasteQty: extra stock used when cutting a custom size (leather offcuts); it is never restocked
const saleStockOut = s => { const q = N(s.qty); if (s.status === 'cancelled') return 0; const w = N(s.wasteQty); if (s.status === 'returned') return (isRestocked(s) ? 0 : q) + w; return q + w; };
function stock(store) {
  const good = {}, bad = {};
  for (const { id, data } of store.list('products')) { good[id] = N(data.openingStock); bad[id] = 0; }
  for (const { data: m } of store.list('moves')) if (m.productId in good) { good[m.productId] += N(m.qty); bad[m.productId] += N(m.badQty); }
  for (const { data: s } of store.list('sales')) if (s.productId in good) { good[s.productId] -= saleStockOut(s); if (s.status === 'returned' && s.retCondition === 'bad') bad[s.productId] += N(s.retQty || s.qty); }
  return { good, bad };
}
/* attendance */
const hm = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const minsOf = iso => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
function attSettings(store) { return Object.assign({ start: '09:30', end: '18:30', grace: 10, halfDay: 4, weeklyOff: ['0'], holidays: [], requirePin: true }, store.get('settings/attendance') || {}); }
function empShift(store, e) { const s = attSettings(store); return { start: (e && e.shiftStart) || s.start, end: (e && e.shiftEnd) || s.end, grace: N(s.grace), weeklyOff: (e && Array.isArray(e.weeklyOff) && e.weeklyOff.length) ? e.weeklyOff : (s.weeklyOff || []) }; }
function attToday(store, e, d = today()) {
  const rec = store.get('attendance/' + e.id + '_' + d) || null; const sess = ((rec && rec.sessions) || []).filter(s => s && s.in);
  let mins = 0, open = null; for (const s of sess) { const a = Date.parse(s.in), b = s.out ? Date.parse(s.out) : Date.now(); if (!s.out) open = s; mins += Math.max(0, b - a) / 6e4; }
  const first = sess[0] ? sess[0].in : null; const last = sess.length ? sess[sess.length - 1] : null; const sh = empShift(store, e);
  const lateMin = first ? Math.max(0, minsOf(first) - hm(sh.start)) : 0;
  return { rec, sess, mins, open, first, lastOut: last && last.out ? last.out : null, late: !!first && lateMin > sh.grace, lateMin, mark: rec && rec.mark };
}
module.exports = { N, pad, ymd, today, addDays, sum, DEFAULT_PLATFORMS, platforms, PL, effPlat, unitEcon, saleSnapshot, saleFin, saleStockOut, isRestocked, stock, attSettings, empShift, attToday, hm, minsOf };
