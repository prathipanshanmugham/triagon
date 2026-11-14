/* Stock engine — shared by the browser and the server so both always show the same numbers.
   Stock is worked out from the records, never stored: opening stock, movements, the sales ledger and sales orders.
   That is what makes it safe: re-importing an order or changing its status repeatedly can't deduct twice, because
   each order counts once, according to the state it is in now.

   Master stock: a product can take its stock from one or more master items ("materials": leather in sq ft, paint in
   litres, dye in kg…). Its link says how much of each master one unit uses — a fixed amount (50 ml, 100 g), a size
   (12 × 18 in → 1.5 sq ft), or the size the customer orders. Sales of the product then reduce the master instead.

   Deduction stage: ledger entries (marketplace and direct sales) take stock when placed, shipped or delivered, and
   sales orders when confirmed, cut, ready or dispatched — as set in Stock settings. Before that they are "committed".
   Cancelled orders take nothing; returns in good condition go back to stock, damaged ones to damaged stock.

   Physical counts set the on-hand quantity. Anything dated before the count (or on the count day, for an end-of-day
   count) is taken as already reflected in it, so sales imported later for those days are not deducted again. */
const STOCK = (() => {
  const N = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const r3 = n => Math.round(N(n) * 1000) / 1000;
  // unit families; the number is the unit's size in the family's base (g, ml, sq m, m)
  const FAM = {
    g: ['mass', 1], kg: ['mass', 1000],
    ml: ['vol', 1], l: ['vol', 1000],
    'sq in': ['area', 0.00064516], 'sq cm': ['area', 0.0001], 'sq ft': ['area', 0.09290304], 'sq m': ['area', 1],
    mm: ['len', 0.001], cm: ['len', 0.01], in: ['len', 0.0254], ft: ['len', 0.3048], m: ['len', 1],
  };
  const DIM = { mm: 0.001, cm: 0.01, in: 0.0254, ft: 0.3048, m: 1 };
  const famOf = u => (FAM[u] || [null])[0];
  const fine = n => Math.round(n * 1e9) / 1e9;
  const conv = (q, from, to) => { if (from === to) return N(q); const a = FAM[from], b = FAM[to]; if (!a || !b || a[0] !== b[0]) return null; return fine(N(q) * a[1] / b[1]); };
  const compat = u => FAM[u] ? Object.keys(FAM).filter(k => FAM[k][0] === FAM[u][0]) : [u];
  // L × W in inches, cm… → area in an area unit (sq ft: L × W ÷ 144 for inches)
  const areaOf = (l, w, du, to) => { const k = DIM[du] || DIM.in; return conv(N(l) * k * N(w) * k, 'sq m', to); };
  const unitOf = p => (p && p.unit) || 'pc';
  const isRestocked = s => s.retCondition ? s.retCondition === 'good' : s.restocked !== false;

  const LEDGER_STAGES = [['placed', 'When the order is placed'], ['shipped', 'When it ships'], ['delivered', 'When it is delivered']];
  const ORDER_STAGES = [['confirmed', 'When confirmed'], ['production', 'When cutting / making starts'], ['ready', 'When ready to dispatch'], ['dispatched', 'When dispatched']];
  const FLOW = ['quote', 'confirmed', 'production', 'ready', 'dispatched', 'delivered'];
  const settings = s => ({ ledgerStage: LEDGER_STAGES.some(x => x[0] === (s && s.ledgerStage)) ? s.ledgerStage : 'shipped', orderStage: ORDER_STAGES.some(x => x[0] === (s && s.orderStage)) ? s.orderStage : 'dispatched' });
  const LRANK = { pending: 0, transit: 1, delivered: 2 }; const LNEED = { placed: 0, shipped: 1, delivered: 2 };

  /* ---- links ---- */
  const linked = p => !!(p && p.link && Array.isArray(p.link.parts) && p.link.parts.some(x => x && x.id));
  // what one unit of product p takes from each master, in the master's own unit; a customer's size overrides "sized" parts
  function partsOf(p, P, size) {
    if (!linked(p)) return null; const out = [];
    for (const x of p.link.parts) {
      const m = x && P[x.id]; if (!m || linked(m) || m.id === p.id) continue; const mu = unitOf(m); let per = null;
      if (x.sized && size && N(size.l) > 0 && N(size.w) > 0 && famOf(mu) === 'area') per = areaOf(size.l, size.w, size.dimUnit, mu);
      if (per === null && N(x.l) > 0 && N(x.w) > 0 && famOf(mu) === 'area') per = areaOf(x.l, x.w, x.dimUnit, mu);
      if (per === null) per = conv(x.qty, x.unit || mu, mu);
      if (per !== null && per > 0) out.push({ id: m.id, per: Math.round(per * 1e6) / 1e6, sized: !!x.sized });
    }
    return out.length ? out : null;
  }
  // human text for one part: "50 ml", "12 × 18 in (1.5 sq ft)", "customer’s size"
  function partText(x, m) {
    const mu = unitOf(m); const f = n => String(Math.round(N(n) * 1000) / 1000);
    if (N(x.l) > 0 && N(x.w) > 0) { const a = areaOf(x.l, x.w, x.dimUnit, mu); return `${f(x.l)} × ${f(x.w)} ${x.dimUnit || 'in'}${a !== null ? ` = ${f(a)} ${mu}` : ''}${x.sized ? ' (or the size ordered)' : ''}`; }
    if (x.sized && !N(x.qty)) return 'the size ordered';
    return `${f(x.qty)} ${x.unit || mu}${x.unit && x.unit !== mu && conv(x.qty, x.unit, mu) !== null ? ` = ${f(conv(x.qty, x.unit, mu))} ${mu}` : ''}${x.sized ? ' (or the size ordered)' : ''}`;
  }
  // one sales-order line → stock used in the product's unit (with cutting waste) and the size of each piece
  function lineUse(l, p) {
    const u = unitOf(p); const pcs = Math.max(0, N(l.pieces) || (l.mode === 'qty' ? 0 : 1)); const du = l.dimUnit || 'in'; let bill = 0, size = null;
    if (l.mode === 'area' && famOf(u) === 'area') bill = areaOf(l.l, l.w, du, u) * pcs;
    else if (l.mode === 'area') { bill = pcs; size = { l: l.l, w: l.w, dimUnit: du }; }
    else if (l.mode === 'length' && famOf(u) === 'len') bill = N(conv(N(l.l), du, u)) * pcs;
    else bill = N(l.pieces);
    bill = r3(bill); return { bill, use: r3(bill * (1 + N(l.wastage) / 100)), size };
  }
  // Does this sale or order take stock from the masters, or from the product's own stock (it came before the link)?
  // A link made in the app records when (at): anything recorded after that, or deducted on a later day, uses the
  // masters — so orders imported later for earlier days still reduce the master, and sales already taken from the
  // product's own stock before linking are not taken again. Links without "at" use their start date (since).
  function fromMaster(p, d, src) {
    const L = p.link || {};
    if (L.at) { const c = src && src.createdAt; return (!!c && String(c) >= L.at) || (!!d && d > String(L.at).slice(0, 10)); }
    return !L.since || !d || d >= L.since;
  }
  /* ---- order and ledger state ---- */
  const orderAt = (o, set) => FLOW.indexOf(o.status) >= FLOW.indexOf(set.orderStage);
  // the day an order reached the deduction stage (first recorded day of that stage or any later one)
  function orderDate(o, set) {
    const sd = o.stageDates || {}; let d = null;
    for (let k = FLOW.indexOf(set.orderStage); k < FLOW.length; k++) { const x = sd[FLOW[k]] || ((FLOW[k] === 'dispatched' || FLOW[k] === 'delivered') ? o.dispatchedOn : null); if (x && (!d || x < d)) d = x; }
    return d || o.date || '';
  }
  // ledger entry: 'out' takes stock now, 'open' is committed (waiting for its stage), 'none' takes nothing
  function saleState(s, set) {
    if (s.status === 'cancelled') return 'none';
    if (s.status === 'returned' || s.orderId) return 'out'; // order entries exist only once dispatched, past any order stage
    const r = LRANK[s.status || 'delivered']; return (r === undefined ? 2 : r) >= LNEED[set.ledgerStage] ? 'out' : 'open';
  }
  function saleDate(s, set, O) {
    if (s.orderId && O[s.orderId]) return orderDate(O[s.orderId], set);
    if (set.ledgerStage === 'shipped') return s.shippedOn || s.date || '';
    if (set.ledgerStage === 'delivered') return s.deliveredOn || s.shippedOn || s.date || '';
    return s.date || '';
  }
  // status changes keep the dates stock depends on: first day shipped, first day delivered
  function stampSale(prev, next, today) {
    const d = { ...next }; const was = prev ? prev.status : null;
    const rank = st => st === 'returned' ? 3 : LRANK[st] ?? 2;
    if (d.status !== 'pending' && d.status !== 'cancelled' && !d.shippedOn) d.shippedOn = (prev && prev.shippedOn) || (was === 'pending' ? today : d.date);
    if (rank(d.status) >= 2 && d.status !== 'cancelled' && !d.deliveredOn) d.deliveredOn = (prev && prev.deliveredOn) || ((was === 'pending' || was === 'transit') ? today : d.date);
    return d;
  }
  // import / API: how a status may move. Never backwards; cancelled only before delivery; a recorded return stays.
  function statusMove(cur, inc) {
    if (!cur || cur === inc) return cur || inc; if (cur === 'returned') return cur;
    if (inc === 'cancelled') return (cur === 'pending' || cur === 'transit') ? inc : cur;
    if (cur === 'cancelled') return cur;
    const r = st => st === 'returned' ? 3 : LRANK[st] ?? 2; return r(inc) > r(cur) ? inc : cur;
  }

  /* ---- the computation ---- */
  // in: products, moves, sales, orders, settings; optional asOf (YYYY-MM-DD, end of that day)
  // out: on (sellable on hand per stock-holding item), bad (damaged), open (committed), ev (events per item), use30
  function compute({ products, moves, sales, orders, settings: st, asOf, today }) {
    const set = settings(st); const P = {}; for (const p of products || []) P[p.id] = p; const O = {}; for (const o of orders || []) if (o && o.id) O[o.id] = o;
    const ev = {}, bad = {}, open = {};
    const push = (id, d, q, k, src, pid) => { const e = { d: d || '', q, k, src, pid }; (ev[id] || (ev[id] = [])).push(e); return e; };
    // where one use of product p (q in p's units, on day d) comes from
    const route = (p, q, d, size, src) => { const parts = linked(p) && fromMaster(p, d, src) ? partsOf(p, P, size) : null; return parts ? parts.map(x => [x.id, q * x.per]) : [[p.id, q]]; };
    const sizeOf = s => (N(s.l) > 0 && N(s.w) > 0) ? { l: s.l, w: s.w, dimUnit: s.dimUnit || 'in' } : null;
    for (const p of products || []) if (N(p.openingStock)) push(p.id, '', N(p.openingStock), 'opening', null, p.id);
    for (const m of moves || []) {
      if (!P[m.productId]) continue;
      if (m.type === 'count' && m.setTo !== undefined && m.setTo !== null && m.setTo !== '') push(m.productId, m.date, 0, 'count', m, m.productId);
      else if (N(m.qty)) push(m.productId, m.date, N(m.qty), 'move', m, m.productId);
      if (N(m.badQty) && (!asOf || (m.date || '') <= asOf)) bad[m.productId] = (bad[m.productId] || 0) + N(m.badQty);
    }
    for (const s of sales || []) {
      const p = P[s.productId]; if (!p) continue; const state = saleState(s, set); if (state === 'none') continue;
      const q = N(s.qty) + N(s.wasteQty); const size = sizeOf(s);
      if (state === 'open') { if (!asOf) for (const [id, x] of route(p, q, s.date, size, s)) open[id] = (open[id] || 0) + x; continue; }
      const d = saleDate(s, set, O); const parts = route(p, q, d, size, s);
      for (const [id, x] of parts) push(id, d, -x, 'sale', s, p.id);
      if (s.status === 'returned') {
        const rd = s.retDate || d; const back = route(p, N(s.qty), d, size, s);
        if (isRestocked(s)) for (const [id, x] of back) push(id, rd, x, 'return', s, p.id);
        else if (s.retCondition === 'bad') { const bq = N(s.retQty) || N(s.qty); for (const [id, x] of route(p, bq, d, size, s)) { if (!asOf || rd <= asOf) bad[id] = (bad[id] || 0) + x; push(id, rd, 0, 'bad', s, p.id).b = x; } }
      }
    }
    // sales orders past their deduction stage but not yet dispatched (from dispatch on, the ledger carries them)
    for (const o of orders || []) {
      if (!o || o.status === 'cancelled' || o.status === 'quote' || FLOW.indexOf(o.status) < 0 || FLOW.indexOf(o.status) >= FLOW.indexOf('dispatched')) continue;
      const at = orderAt(o, set); const d = orderDate(o, set);
      for (const l of o.lines || []) {
        const p = P[l.productId]; if (!p) continue; const u = lineUse(l, p); if (!(u.use > 0)) continue;
        for (const [id, x] of route(p, u.use, d, u.size, o)) { if (at) push(id, d, -x, 'order', o, p.id); else if (!asOf) open[id] = (open[id] || 0) + x; }
      }
    }
    // on hand: the latest physical count, plus everything after it
    const on = {}, base = {}, use30 = {}; const t30 = today ? addDays(today, -29) : null;
    for (const p of products || []) {
      const list = ev[p.id] || []; let b = null;
      for (const e of list) if (e.k === 'count' && (!asOf || e.d <= asOf) && (!b || e.d > b.d || (e.d === b.d && String(e.src.createdAt || '') > String(b.src.createdAt || '')))) b = e;
      let q = b ? N(b.src.setTo) : 0; let u = 0;
      for (const e of list) {
        if (e.k === 'count' || (asOf && e.d > asOf)) continue;
        e.counted = !!b && (e.d < b.d || (e.d === b.d && b.src.countAt !== 'start'));
        if (!e.counted) q += e.q;
        if (t30 && e.d >= t30 && (e.k === 'sale' || e.k === 'order' || e.k === 'return')) u -= e.q;
      }
      on[p.id] = r3(q); base[p.id] = b ? b.src : null; use30[p.id] = r3(Math.max(0, u));
    }
    for (const k in bad) bad[k] = r3(bad[k]); for (const k in open) open[k] = r3(open[k]);
    return { on, bad, open, ev, base, use30, set, P };
  }
  // how many units of a linked product the masters' stock covers (whole units for pieces)
  function canMake(p, R, size, useOpen) {
    const parts = partsOf(p, R.P, size); if (!parts) return null; let n = Infinity;
    for (const x of parts) { const have = N(R.on[x.id]) - (useOpen ? N(R.open[x.id]) : 0); n = Math.min(n, have / x.per); }
    n = Math.max(0, n); return (unitOf(p) === 'pc' || unitOf(p) === 'set' || unitOf(p) === 'pair' || unitOf(p) === 'box') ? Math.floor(n + 1e-9) : r3(n);
  }
  function addDays(d, n) { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  /* ---- reading sizes and amounts out of product names: "50 ml", "100g", "12 x 18 inch", "1.5 sq ft", "pack of 3" ---- */
  function guess(text, masterUnit) {
    const t = String(text || '').toLowerCase().replace(/×/g, 'x'); const fam = famOf(masterUnit);
    const pack = (() => { const m = t.match(/(?:pack|set|combo)\s*of\s*(\d+)|(\d+)\s*(?:pcs|pieces|bottles|jars|tins)\b/); return m ? N(m[1] || m[2]) || 1 : 1; })();
    if (fam === 'area') {
      const a = t.match(/(\d+(?:\.\d+)?)\s*(?:"|''|in(?:ch(?:es)?)?|cm|mm|ft|feet)?\s*x\s*(\d+(?:\.\d+)?)\s*("|''|in(?:ch(?:es)?)?|cm|mm|ft|feet)?/);
      if (a) { const raw = a[3] || (t.match(/\b(cm|mm|ft|feet)\b/) || [])[1] || 'in'; const du = /^(in|inch|"|'')/.test(raw) ? 'in' : raw === 'feet' ? 'ft' : raw; return { l: N(a[1]), w: N(a[2]), dimUnit: DIM[du] ? du : 'in', qty: r3(areaOf(a[1], a[2], DIM[du] ? du : 'in', masterUnit) * pack), unit: masterUnit, pack }; }
      const s = t.match(/(\d+(?:\.\d+)?)\s*(sq\.?\s*ft|sqft|square\s*feet|sq\.?\s*m|sq\.?\s*in)/);
      if (s) { const u = /in/.test(s[2]) ? 'sq in' : /m$/.test(s[2].trim()) ? 'sq m' : 'sq ft'; return { qty: r3(N(s[1]) * pack), unit: u, pack }; }
      return null;
    }
    if (fam === 'vol' || fam === 'mass') {
      const re = fam === 'vol' ? /(\d+(?:\.\d+)?)\s*(ml|millilit(?:er|re)s?|l|ltr|lit(?:er|re)s?)\b/ : /(\d+(?:\.\d+)?)\s*(g|gm|gms|grams?|kg|kgs|kilo(?:gram)?s?)\b/;
      const m = t.match(re); if (!m) return null;
      const u = fam === 'vol' ? (/^m/.test(m[2]) ? 'ml' : 'l') : (/^k/.test(m[2]) ? 'kg' : 'g');
      return { qty: r3(N(m[1]) * pack), unit: u, pack };
    }
    if (fam === 'len') { const m = t.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|metres?|meters?|ft|feet|in|inch(?:es)?)\b/); if (!m) return null; const u = /^mm/.test(m[2]) ? 'mm' : /^cm/.test(m[2]) ? 'cm' : /^(ft|feet)/.test(m[2]) ? 'ft' : /^in/.test(m[2]) ? 'in' : 'm'; return { qty: r3(N(m[1]) * pack), unit: u, pack }; }
    return null;
  }
  return { fromMaster, FAM, DIM, famOf, conv, compat, areaOf, r3, linked, partsOf, partText, lineUse, settings, LEDGER_STAGES, ORDER_STAGES, FLOW, orderAt, orderDate, saleState, saleDate, stampSale, statusMove, compute, canMake, guess, isRestocked };
})();
if (typeof module !== 'undefined') module.exports = STOCK;
