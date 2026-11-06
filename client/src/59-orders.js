/* =====================================================================
   Sales orders: custom sizes (leather cut to length × width), quotes,
   payments, dispatch posts to the sales ledger and reduces stock
   ===================================================================== */
const SO_STATUS = [['quote', 'Quotation'], ['confirmed', 'Confirmed'], ['production', 'Cutting / making'], ['ready', 'Ready to dispatch'], ['dispatched', 'Dispatched'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled']];
const SO_TONE = { quote: 't-neu', confirmed: 't-info', production: 't-warn', ready: 't-acc', dispatched: 't-info', delivered: 't-good', cancelled: 't-neu' };
const SO_OPEN = ['quote', 'confirmed', 'production', 'ready'];
const DIM_M = { mm: 0.001, cm: 0.01, in: 0.0254, ft: 0.3048, m: 1 };
const AREA_U = { 'sq ft': 0.09290304, 'sq m': 1 }; const LEN_U = { m: 1, ft: 0.3048 };
const soLabel = k => (SO_STATUS.find(x => x[0] === k) || [k, k])[1];
const lineModes = p => { const u = unitOf(p); return [...(AREA_U[u] ? [['area', 'L × W size']] : []), ...(LEN_U[u] ? [['length', 'Cut length']] : []), ['qty', 'Quantity']]; };
// one order line → billed quantity, stock used (with wastage) and amount, all in the product's unit
function soCalc(l) {
  const p = prodOf(l.productId); const u = unitOf(p); const pcs = Math.max(0, N(l.pieces) || (l.mode === 'qty' ? 0 : 1)); const k = DIM_M[l.dimUnit || 'in'] || DIM_M.in;
  let per = 0, bill = 0;
  if (l.mode === 'area' && AREA_U[u]) { per = (N(l.l) * k) * (N(l.w) * k) / AREA_U[u]; bill = per * pcs; }
  else if (l.mode === 'length' && LEN_U[u]) { per = N(l.l) * k / LEN_U[u]; bill = per * pcs; }
  else { bill = N(l.pieces); per = 1; }
  bill = rq3(bill); const use = rq3(bill * (1 + N(l.wastage) / 100));
  const amount = Math.round((l.priceMode === 'piece' ? N(l.rate) * pcs : N(l.rate) * bill) * 100) / 100;
  return { u, per: rq3(per), bill, use, waste: rq3(use - bill), amount, pcs };
}
const soSub = o => sum(o.lines || [], l => soCalc(l).amount);
const soTotal = o => Math.round((soSub(o) - N(o.discount) + N(o.shipping)) * 100) / 100;
const soPaid = o => sum(S.txns.filter(t => t.link && t.link.col === 'orders' && t.link.id === o.id), t => t.type === 'out' ? -N(t.amount) : N(t.amount));
const soBal = o => o.status === 'cancelled' ? 0 : soTotal(o) - soPaid(o);
const soCust = o => (o.customerId && (custOf(o.customerId) || {}).name) || o.customerName || 'Walk-in customer';
const dimTxt = l => { const c = soCalc(l); return l.mode === 'area' ? `${qty(l.l)} × ${qty(l.w)} ${l.dimUnit || 'in'} × ${num(c.pcs)} pc = ${fmtQ(c.bill, c.u)}` : l.mode === 'length' ? `${qty(l.l)} ${l.dimUnit || 'in'} × ${num(c.pcs)} pc = ${fmtQ(c.bill, c.u)}` : fmtQ(c.bill, c.u); };

V.orders = () => {
  const can = canEdit('orders'); const all = S.orders.filter(o => brandAll() || (o.lines || []).some(l => inBrand({ productId: l.productId })));
  let html = ph('Sales orders', 'Quotes and orders for custom sizes and direct buyers. Each line is priced and stocked in the product’s unit (sq ft, metres, pieces), with cutting wastage. Dispatching posts it to the sales ledger.', can ? btn('New order', 'new:order', { pri: true, i: 'plus' }) : '');
  const open = all.filter(o => SO_OPEN.includes(o.status)); const due7 = open.filter(o => o.dueDate && o.dueDate <= addDays(TODAY(), 7)); const late = open.filter(o => o.dueDate && o.dueDate < TODAY());
  const bal = sum(all.filter(o => o.status !== 'cancelled' && o.status !== 'quote'), o => Math.max(0, soBal(o)));
  html += kpis([{ l: 'Open orders', v: num(open.filter(o => o.status !== 'quote').length), s: num(open.filter(o => o.status === 'quote').length) + ' quotes' }, { l: 'Open order value', v: inrS(sum(open.filter(o => o.status !== 'quote'), soTotal)), title: inr(sum(open, soTotal)) }, { l: 'Due in 7 days', v: num(due7.length), s: late.length ? num(late.length) + ' late' : 'none late', tone: late.length ? 'neg' : '' }, { l: 'To collect', v: inrS(bal), title: inr(bal), tone: bal > 0 ? 'neg' : '' }], 'k4');
  const f = filtOf('sof', 'open'); const rows = all.filter(o => (f === 'all' || (f === 'open' ? SO_OPEN.includes(o.status) : f === 'unpaid' ? o.status !== 'cancelled' && o.status !== 'quote' && soBal(o) > 0.5 : o.status === f)) && matchQ('so', o.number, soCust(o), o.phone, o.notes, ...(o.lines || []).map(l => (prodOf(l.productId) || {}).name)));
  html += `<div class="toolbar">${searchHTML('so', 'Search order, customer, phone, product…')}${chipsHTML('sof', [['open', 'Open', open.length], ['unpaid', 'Unpaid', all.filter(o => o.status !== 'cancelled' && o.status !== 'quote' && soBal(o) > 0.5).length], ['dispatched', 'Dispatched'], ['delivered', 'Delivered'], ['cancelled', 'Cancelled'], ['all', 'All', all.length]], f)}</div>`;
  if (can) html += selBar('so', `<label class="sr" for="soBulk">Set status</label><select class="inp" id="soBulk" style="width:auto;height:30px"><option value="">Set status…</option>${SO_STATUS.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select>${btn('Apply', 'sobulk', { sm: true })}`);
  html += panel('', table('so', [
    { k: 'number', l: 'Order', render: o => `<b class="mono">${esc(o.number)}</b>${delPill('orders', o.id)}<br><small class="muted">${esc(fmtD(o.date))}</small>`, sort: o => o.number },
    { k: 'cust', l: 'Customer', render: o => `${esc(soCust(o))}<br><small class="muted">${esc(o.phone || (custOf(o.customerId) || {}).phone || '')}</small>`, sort: o => soCust(o) },
    { k: 'ch', l: 'Channel', render: o => platPill(o.channel || 'direct'), sort: o => PL(o.channel || 'direct').name },
    { k: 'items', l: 'Items', cls: 'wrap', render: o => (o.lines || []).slice(0, 2).map(l => `<div><b>${esc((prodOf(l.productId) || {}).name || l.desc || 'Item')}</b> <small class="muted">${esc(dimTxt(l))}</small>${l.mode === 'area' || l.mode === 'length' ? ' ' + pill('Custom size', 't-acc', 1) : ''}</div>`).join('') + ((o.lines || []).length > 2 ? `<small class="muted">+${(o.lines || []).length - 2} more</small>` : ''), sort: o => (o.lines || []).length },
    { k: 'total', l: 'Total', num: 1, render: o => inr(soTotal(o)), sort: o => soTotal(o) },
    { k: 'bal', l: 'Balance', num: 1, render: o => o.status === 'cancelled' || o.status === 'quote' ? '<span class="muted">—</span>' : soBal(o) > 0.5 ? `<b class="neg">${inr(soBal(o))}</b>` : pill('Paid', 't-good', 1), sort: o => soBal(o) },
    { k: 'due', l: 'Due', render: o => o.dueDate ? `<span class="${SO_OPEN.includes(o.status) && o.dueDate < TODAY() ? 'neg' : ''}">${esc(fmtD(o.dueDate))}</span>` : '—', sort: o => o.dueDate || '9' },
    { k: 'status', l: 'Status', render: o => pill(soLabel(o.status), SO_TONE[o.status]), sort: o => SO_STATUS.findIndex(x => x[0] === o.status) },
    { k: 'pdf', l: '', nosort: 1, render: o => btn('PDF', 'sopdf:' + o.id, { sm: true, ghost: true, i: 'pdf' }) },
  ], rows, { select: can, key: o => o.id, sort: { k: 'number', dir: 'desc' }, open: o => 'open:order:' + o.id, empty: empty('No orders here', 'Create a quote or order for a customer. Custom-size lines work out the area from length × width, add cutting wastage, and reduce stock in sq ft when dispatched.', can ? btn('New order', 'new:order', { pri: true }) : '') }), { flush: true });
  return html;
};

/* ---------- order editor ---------- */
let SOL = []; let DRW_so = null;
const soBlank = () => ({ lid: rid().slice(0, 8), productId: '', desc: '', mode: 'qty', l: null, w: null, dimUnit: 'in', pieces: 1, wastage: 0, priceMode: 'unit', rate: null, gstRate: 18 });
EDIT.order = (id, preset = {}) => {
  const o = id ? S.orders.find(x => x.id === id) : null; const can = canEdit('orders');
  if (!S.products.length) { toast('Add products in the Catalogue first.', 'bad'); return; }
  SOL = o ? JSON.parse(JSON.stringify(o.lines || [])) : (preset.lines || [soBlank()]); SOL.forEach((l, i) => { if (l.lid === undefined || l.lid === null) l.lid = String(i); });
  const v0 = o || { number: nextNum(S.orders, 'number', 'SO-' + fyShort() + '-'), date: TODAY(), dueDate: addDays(TODAY(), 5), status: 'confirmed', channel: 'direct', ...preset };
  const dis = can ? '' : ' disabled';
  const lineRow = (l, i) => {
    const p = prodOf(l.productId); const modes = p ? lineModes(p) : [['qty', 'Quantity']]; const c = soCalc(l); const dims = l.mode === 'area' || l.mode === 'length';
    return `<tr class="sol"><td style="min-width:210px"><select class="inp" name="sl.${i}.productId" data-t="str" data-ch="soprod" aria-label="Line ${i + 1} product"${dis}><option value="">Choose…</option>${prodOptsWith(l.productId).map(([k, t]) => `<option value="${esc(k)}"${k === l.productId ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${p ? `<small class="muted">On hand ${fmtQ(stockMap()[p.id] || 0, p)} · ${inr(p.sellingPrice, 2)}/${esc(unitOf(p))}</small>` : ''}<input class="inp" name="sl.${i}.desc" data-t="str" value="${esc(l.desc || '')}" placeholder="Note on this line, e.g. dark tan, no brand mark" aria-label="Line ${i + 1} note" style="margin-top:4px"${dis}></td>
    <td style="min-width:128px"><select class="inp" name="sl.${i}.mode" data-t="str" data-ch="somode" aria-label="Line ${i + 1} type"${dis}>${modes.map(([k, t]) => `<option value="${k}"${k === l.mode ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></td>
    <td style="min-width:236px">${dims ? `<div class="dimrow"><input class="inp tnum" type="number" step="any" min="0" name="sl.${i}.l" data-t="num" data-in="soline" value="${esc(l.l ?? '')}" placeholder="L" aria-label="Length"${dis}>${l.mode === 'area' ? `<span>×</span><input class="inp tnum" type="number" step="any" min="0" name="sl.${i}.w" data-t="num" data-in="soline" value="${esc(l.w ?? '')}" placeholder="W" aria-label="Width"${dis}>` : ''}<select class="inp" name="sl.${i}.dimUnit" data-t="str" data-ch="soline" aria-label="Size unit"${dis}>${Object.keys(DIM_M).map(k => `<option${(l.dimUnit || 'in') === k ? ' selected' : ''}>${k}</option>`).join('')}</select></div>` : '<span class="muted">—</span>'}</td>
    <td style="width:84px"><input class="inp tnum" type="number" step="${l.mode === 'qty' ? 'any' : '1'}" min="0" name="sl.${i}.pieces" data-t="num" data-in="soline" value="${esc(l.pieces ?? '')}" aria-label="${l.mode === 'qty' ? 'Quantity' : 'Pieces'}"${dis}><small class="muted">${l.mode === 'qty' ? esc(unitOf(p)) : 'pieces'}</small></td>
    <td style="width:74px"><input class="inp tnum" type="number" step="any" min="0" name="sl.${i}.wastage" data-t="num" data-in="soline" value="${esc(l.wastage ?? 0)}" aria-label="Wastage %"${dis}><small class="muted">waste %</small></td>
    <td style="min-width:176px"><div class="dimrow"><input class="inp tnum" type="number" step="any" min="0" name="sl.${i}.rate" data-t="num" data-in="soline" value="${esc(l.rate ?? '')}" placeholder="${p ? esc(p.sellingPrice) : ''}" aria-label="Rate incl GST"${dis}><select class="inp" name="sl.${i}.priceMode" data-t="str" data-ch="soline" aria-label="Rate per"${dis}><option value="unit"${l.priceMode !== 'piece' ? ' selected' : ''}>/ ${esc(unitOf(p))}</option><option value="piece"${l.priceMode === 'piece' ? ' selected' : ''}>/ piece</option></select></div><small class="muted">incl. GST</small></td>
    <td class="num tnum" id="soc_${i}"><b>${inr(c.amount, 2)}</b><br><small class="muted">${esc(fmtQ(c.bill, c.u))}${c.waste ? ` + ${esc(qty(c.waste))} waste` : ''}</small></td>
    <td>${can ? `<button type="button" class="btn icon ghost sm" data-act="sorm:${i}" aria-label="Remove line">${icon('x')}</button>` : ''}</td></tr>`;
  };
  const totals = () => { const fv = $('#drForm') ? readForm($('#drForm')).vals || {} : {}; const x = { lines: SOL, discount: 'discount' in fv ? N(fv.discount) : N(v0.discount), shipping: 'shipping' in fv ? N(fv.shipping) : N(v0.shipping) }; const sub = soSub(x); const tot = soTotal(x); const gst = sum(SOL, l => { const c = soCalc(l); const g = N(l.gstRate ?? ((prodOf(l.productId) || {}).gstRate ?? 18)); return c.amount - c.amount / (1 + g / 100); }); return `<div class="sotot"><div><span>Items</span><b>${inr(sub, 2)}</b></div><div><span>Of which GST</span><b>${inr(gst, 2)}</b></div><div class="g"><span>Order total</span><b>${inr(tot, 2)}</b></div></div>`; };
  const linesHTML = () => `<div class="tw"><table class="t grid soh"><thead><tr><th>Product</th><th>Type</th><th>Size</th><th>Qty</th><th>Waste</th><th>Rate</th><th class="num">Amount</th><th></th></tr></thead><tbody>${SOL.map(lineRow).join('')}</tbody></table></div>${can ? `<div style="margin-top:10px">${btn('Add line', 'soadd', { sm: true, i: 'plus' })}</div>` : ''}<p class="help">Custom size: enter length × width in inches, cm, mm, feet or metres and the number of pieces. The area is converted to the product’s unit (sq ft or sq m). Waste % covers offcuts: stock goes down by the cut area plus waste, the customer pays for the cut area (or per piece).</p>`;
  DRW_so = { lines: linesHTML, totals };
  const fH = [
    { n: 'number', l: 'Order number', mono: 1, req: 1 }, { n: 'date', l: 'Order date', t: 'date', req: 1 },
    { n: 'customerId', l: 'Customer', t: 'select', o: () => S.customers.slice().sort((a, b) => (a.name > b.name ? 1 : -1)).map(c => [c.id, c.name + (c.city ? ' · ' + c.city : '')]), blank: 'New or walk-in customer' },
    { n: 'customerName', l: 'Or customer name', ph: 'Saved as a new customer' }, { n: 'phone', l: 'Phone', t: 'tel' },
    { n: 'channel', l: 'Channel', t: 'select', o: () => platOpts(v0.channel) }, { n: 'status', l: 'Status', t: 'select', o: SO_STATUS }, { n: 'dueDate', l: 'Promised by', t: 'date' },
  ];
  const fT = [{ n: 'discount', l: 'Discount on the order', t: 'money', min: 0, help: 'Spread across lines when posted.' }, { n: 'shipping', l: 'Shipping charged', t: 'money', min: 0 }];
  const fD = [{ n: 'deliveryAddress', l: 'Delivery address', t: 'textarea', rows: 3, full: 1 }, { n: 'tracking', l: 'Courier & AWB', full: 1, ph: 'e.g. DTDC · D12345678' }, { n: 'notes', l: 'Notes printed on the order', t: 'textarea', rows: 3, full: 1 }, { n: 'internal', l: 'Internal notes', t: 'textarea', rows: 2, full: 1 }];
  const posted = o ? S.sales.filter(s => s.orderId === o.id && s.status !== 'cancelled').length : 0;
  const pays = o ? S.txns.filter(t => t.link && t.link.col === 'orders' && t.link.id === o.id).sort((a, b) => a.date < b.date ? -1 : 1) : [];
  const tabs = [{ l: 'Order & items', html: () => form(fH, v0) + `<div class="subh">Items</div><div id="soLines">${linesHTML()}</div>` + form(fT, v0) + `<div id="soTot">${totals()}</div>` }, { l: 'Delivery & notes', html: form(fD, v0) }];
  if (o) tabs.push({ l: `Payments (${pays.length})`, html: kvHTML([['Total', inr(soTotal(o))], ['Received', inr(soPaid(o))], ['Balance', `<span class="${soBal(o) > 0.5 ? 'neg' : ''}">${inr(soBal(o))}</span>`], ['Posted to sales', posted ? num(posted) + ' lines' : 'Not yet']]) + (pays.length ? `<div class="list bordered">${pays.map(t => `<div class="li"><span class="sev ${t.type === 'out' ? 'warn' : 'good'}"></span><div class="grow"><b>${t.type === 'out' ? 'Refund ' : ''}${inr(t.amount)}</b><small>${esc(fmtD(t.date))} · ${esc(t.mode || '')}${t.ref ? ' · ' + esc(t.ref) : ''}${t.accountId ? ' · ' + esc((S.accounts.find(a => a.id === t.accountId) || {}).name || '') : ''}</small></div></div>`).join('')}</div>` : '<p class="muted">No payments yet.</p>') + (canEdit('orders') && o.status !== 'cancelled' ? `<div style="margin-top:12px;display:flex;gap:8px">${btn('Record payment', 'sopay:' + o.id, { sm: true, i: 'wallet' })}${btn('Record refund', 'sorefund:' + o.id, { sm: true })}</div>` : '') });
  openDrawer({
    title: o ? o.number : 'New sales order', sub: o ? `${esc(soCust(o))} · ${esc(soLabel(o.status))}` : 'For direct buyers, custom-size cuts and wholesale. Set it to Dispatched or Delivered to post it to the sales ledger.', readOnly: !can, delKey: 'orders/' + id, wide: true, tabs,
    footExtra: o ? btn('PDF', 'sopdf:' + o.id, { i: 'pdf' }) + (o.phone || (custOf(o.customerId) || {}).phone ? `<a class="btn ghost" href="https://wa.me/${esc(String(o.phone || (custOf(o.customerId) || {}).phone).replace(/\D/g, '').replace(/^(\d{10})$/, '91$1'))}?text=${encodeURIComponent(`Hello ${soCust(o)}, your order ${o.number} for ${inr(soTotal(o))} is ${soLabel(o.status).toLowerCase()}.${soBal(o) > 0.5 ? ` Balance due: ${inr(soBal(o))}.` : ''} Thank you, ${company().name}`)}" target="_blank" rel="noopener">WhatsApp</a>` : '') : '',
    validate: v => { const e = []; syncSO(); const ls = SOL.filter(l => l.productId); if (!ls.length) e.push({ n: 'number', m: 'Add at least one item.' }); ls.forEach((l, i) => { const c = soCalc(l); if (c.bill <= 0) e.push({ n: `sl.${SOL.indexOf(l)}.pieces`, m: l.mode === 'qty' ? 'Enter a quantity' : 'Enter the size and pieces' }); if (N(l.rate) <= 0 && !N((prodOf(l.productId) || {}).sellingPrice)) e.push({ n: `sl.${SOL.indexOf(l)}.rate`, m: 'Enter a rate' }); void i; }); if (S.orders.some(x => x.id !== id && x.number === v.number)) e.push({ n: 'number', m: 'Another order has this number.' }); if (!v.customerId && !String(v.customerName || '').trim() && v.channel === 'direct' && v.status !== 'quote') e.push({ n: 'customerName', m: 'Pick a customer or enter a name.' }); return e; },
    onSave: async v => {
      syncSO(); const lines = SOL.filter(l => l.productId).map(l => { const p = prodOf(l.productId); const c = soCalc({ ...l, rate: N(l.rate) || N(p.sellingPrice) }); return clean({ ...l, lid: l.lid || rid().slice(0, 8), rate: N(l.rate) || N(p.sellingPrice), gstRate: N(l.gstRate ?? p.gstRate ?? 18), l: l.l ?? null, w: l.w ?? null, consume: c.use, billQty: c.bill, amount: c.amount }); });
      let customerId = v.customerId || null; const ops = [];
      if (!customerId && String(v.customerName || '').trim()) { const ex = S.customers.find(c => String(c.name).trim().toLowerCase() === v.customerName.trim().toLowerCase() && (!v.phone || !c.phone || c.phone === v.phone)); if (ex) customerId = ex.id; else { customerId = newId('customers'); ops.push({ op: 'set', path: 'customers/' + customerId, data: clean({ name: v.customerName.trim(), phone: v.phone || '', source: v.channel, ...stampOf(null) }) }); } }
      const oid = id || newId('orders'); const prev = o;
      const doc = clean({ ...base(prev), number: v.number, date: v.date, customerId, customerName: customerId ? (v.customerName || (custOf(customerId) || {}).name || '') : (v.customerName || ''), phone: v.phone, channel: v.channel || 'direct', status: v.status, dueDate: v.dueDate, discount: N(v.discount), shipping: N(v.shipping), lines, deliveryAddress: v.deliveryAddress, tracking: v.tracking, notes: v.notes, internal: v.internal, ...stampOf(prev) });
      doc.total = soTotal(doc); if (['dispatched', 'delivered'].includes(v.status) && !(prev && prev.dispatchedOn)) doc.dispatchedOn = TODAY();
      ops.push({ op: 'set', path: 'orders/' + oid, data: doc }); ops.push(...soSalesOps({ ...doc, id: oid }));
      await batchAll(ops); addLog(prev ? 'update' : 'create', 'orders', `Sales order ${v.number} · ${soLabel(v.status)} · ${inr(doc.total)}`, prev ? diffText(base(prev), doc) : `${lines.length} lines for ${customerId ? (custOf(customerId) || {}).name || v.customerName : v.customerName || 'walk-in'}`);
    },
    onDelete: o ? delFn('orders', id, 'orders', `Sales order ${o.number}`, () => posted ? 'This order is posted to the sales ledger. Cancel it instead, which reverses the stock.' : pays.length ? 'Payments are recorded on this order. Refund or delete them first.' : '') : null,
  });
};
// keep the sales ledger in step with a dispatched order: one entry per line, cutting waste counted as stock used
function soSalesOps(o) {
  const ops = []; const live = ['dispatched', 'delivered'].includes(o.status); const existing = S.sales.filter(s => s.orderId === o.id && !s.splitFrom); const sub = soSub(o); const f = sub ? soTotal(o) / sub : 1; const keep = new Set();
  if (live) (o.lines || []).forEach((l, i) => {
    const p = prodOf(l.productId); if (!p) return; const c = soCalc(l); if (c.bill <= 0) return; const sid = 'so-' + o.id + '-' + (l.lid ?? i); keep.add(sid); const prev = byId('sales')[sid];
    if (prev && prev.status === 'returned') return; // a return recorded against this line is left exactly as it is
    const parts = S.sales.filter(x => x.splitFrom === sid); const q = rq3(c.bill - sum(parts, x => x.qty)); if (q <= 0) return; // part returns were split off this entry
    const unitPrice = Math.round(c.amount * f / c.bill * 10000) / 10000; const s = { date: o.dispatchedOn || o.date, platform: o.channel || 'direct', productId: p.id, brandId: p.brandId, qty: q, wasteQty: c.waste || null, unitPrice, status: o.status === 'delivered' ? 'delivered' : 'transit', orderRef: o.number, orderId: o.id, customerId: o.customerId || null, note: l.mode === 'area' || l.mode === 'length' ? 'Custom size: ' + dimTxt(l) : (l.desc || '') };
    const calc = saleSnapshot(s, p, PL(s.platform)); const doc = clean({ ...(prev ? base(prev) : {}), ...s, calc, ...stampOf(prev) });
    if (!prev || diffText(base(prev), doc)) ops.push({ op: 'set', path: 'sales/' + sid, data: doc });
  });
  for (const s of existing) if (!keep.has(s.id) && s.status !== 'cancelled' && s.status !== 'returned') ops.push({ op: 'set', path: 'sales/' + s.id, data: clean({ ...base(s), status: 'cancelled', note: (s.note ? s.note + ' · ' : '') + `Order ${o.number} ${o.status === 'cancelled' ? 'cancelled' : 'changed'}`, ...stampOf(s) }) });
  return ops;
}
function syncSO() { const f = $('#drForm'); if (!f || !DRW_so) return; const { vals } = readForm(f); const raw = vals.sl || {}; SOL = SOL.map((l, i) => ({ ...l, ...(raw[i] || {}) })); }
function redrawSO() { const el = $('#soLines'); if (el && DRW_so) el.innerHTML = DRW_so.lines(); const t = $('#soTot'); if (t && DRW_so) t.innerHTML = DRW_so.totals(); }
Object.assign(IN, {
  soline(v, el) { syncSO(); const i = +(el.name.split('.')[1]); const l = SOL[i]; const c = $('#soc_' + i); if (l && c) { const x = soCalc({ ...l, rate: N(l.rate) || N((prodOf(l.productId) || {}).sellingPrice) }); c.innerHTML = `<b>${inr(x.amount, 2)}</b><br><small class="muted">${esc(fmtQ(x.bill, x.u))}${x.waste ? ` + ${esc(qty(x.waste))} waste` : ''}</small>`; } const t = $('#soTot'); if (t && DRW_so) t.innerHTML = DRW_so.totals(); },
});
Object.assign(CH, {
  soprod(v, el) { syncSO(); const i = +(el.name.split('.')[1]); const p = prodOf(v); if (p && SOL[i]) { const m = lineModes(p); SOL[i].mode = m[0][0]; SOL[i].rate = N(listingOf(p, (readForm($('#drForm')).vals || {}).channel).price) || N(p.sellingPrice); SOL[i].gstRate = N(p.gstRate ?? 18); SOL[i].pieces = 1; SOL[i].wastage = m[0][0] === 'area' ? 10 : 0; } redrawSO(); },
  somode() { syncSO(); redrawSO(); },
  soline(v, el) { IN.soline(v, el); },
  discount() { },
});
Object.assign(ACT, {
  soadd() { syncSO(); SOL.push(soBlank()); redrawSO(); },
  sorm(i) { syncSO(); SOL.splice(+i, 1); if (!SOL.length) SOL.push(soBlank()); redrawSO(); },
  sopdf(id) { soPDF(id); },
  sopay(id) { closeDrawer(); setTimeout(() => soPayment(id, 'in'), 230); }, sorefund(id) { closeDrawer(); setTimeout(() => soPayment(id, 'out'), 230); },
  sobulk() {
    const st = ($('#soBulk') || {}).value; if (!st) { toast('Choose a status first.', 'bad'); return; } const os = selIds('so').map(id => S.orders.find(o => o.id === id)).filter(Boolean);
    guarded(async () => { const ops = []; for (const o of os) { if (o.status === st) continue; const doc = clean({ ...base(o), status: st, ...(['dispatched', 'delivered'].includes(st) && !o.dispatchedOn ? { dispatchedOn: TODAY() } : {}), ...stampOf(o) }); ops.push({ op: 'set', path: 'orders/' + o.id, data: doc }, ...soSalesOps({ ...doc, id: o.id })); } if (!ops.length) return; await batchAll(ops); selOf('so').clear(); addLog('update', 'orders', `${os.length} orders set to ${soLabel(st)}`, os.map(o => o.number).join(', ')); toast(`${os.length} orders set to ${soLabel(st)}`); });
  },
});
// keep totals live when discount or shipping change
document.addEventListener('input', e => { if (e.target && (e.target.name === 'discount' || e.target.name === 'shipping') && $('#soTot') && DRW_so) $('#soTot').innerHTML = DRW_so.totals(); });
function soPayment(id, type) {
  const o = S.orders.find(x => x.id === id); if (!o) return;
  openDrawer({
    title: (type === 'out' ? 'Refund on ' : 'Payment for ') + o.number, sub: `${esc(soCust(o))} · balance ${inr(soBal(o))}`, saveLabel: type === 'out' ? 'Record refund' : 'Record payment',
    html: form([{ n: 'amount', l: 'Amount', t: 'money', req: 1, min: 0 }, { n: 'date', l: 'Date', t: 'date', req: 1 }, { n: 'accountId', l: type === 'out' ? 'Paid from' : 'Received into', t: 'select', o: () => S.accounts.filter(a => a.active !== false).map(a => [a.id, a.name]), blank: S.accounts.length ? 'Choose…' : 'Add accounts in Finance' }, { n: 'mode', l: 'Mode', t: 'select', o: ['UPI', 'Cash', 'Bank transfer', 'Card', 'Cheque', 'Marketplace'] }, { n: 'ref', l: 'UTR / reference', mono: 1 }, { n: 'note', l: 'Note', full: 1 }], { amount: type === 'out' ? null : Math.max(0, Math.round(soBal(o) * 100) / 100) || null, date: TODAY(), mode: 'UPI', accountId: (S.accounts.find(a => a.active !== false) || {}).id || '' }),
    validate: v => N(v.amount) <= 0 ? [{ n: 'amount', m: 'Enter the amount.' }] : [],
    onSave: async v => { await saveDoc('txns', null, { date: v.date, type, accountId: v.accountId || null, amount: N(v.amount), category: 'order_payment', link: { col: 'orders', id: o.id }, customerId: o.customerId || null, mode: v.mode, ref: v.ref, note: v.note }, ['orders', `${type === 'out' ? 'Refund' : 'Payment'} ${inr(v.amount)} on ${o.number}`]); },
  });
}
async function soPDF(id) {
  const o = S.orders.find(x => x.id === id); if (!o) return; const c = custOf(o.customerId) || {}; const kind = o.status === 'quote' ? 'Quotation' : ['dispatched', 'delivered'].includes(o.status) ? 'Delivery challan & invoice summary' : 'Order confirmation';
  const sub = soSub(o); const tot = soTotal(o); const paid = soPaid(o);
  const rows = (o.lines || []).map((l, i) => { const p = prodOf(l.productId) || {}; const x = soCalc(l); return `<tr><td>${i + 1}</td><td><b>${esc(p.name || 'Item')}</b><br><small>${esc(p.sku || '')}${p.hsn ? ' · HSN ' + esc(p.hsn) : ''}${l.desc ? ' · ' + esc(l.desc) : ''}</small></td><td>${l.mode === 'area' ? `${esc(qty(l.l))} × ${esc(qty(l.w))} ${esc(l.dimUnit || 'in')}<br><small>${num(x.pcs)} piece${x.pcs === 1 ? '' : 's'} · ${esc(qty(x.per))} ${esc(x.u)} each</small>` : l.mode === 'length' ? `${esc(qty(l.l))} ${esc(l.dimUnit || 'in')}<br><small>${num(x.pcs)} piece${x.pcs === 1 ? '' : 's'}</small>` : '—'}</td><td class="n">${esc(fmtQ(x.bill, x.u))}</td><td class="n">${inr(l.rate, 2)}<br><small>per ${l.priceMode === 'piece' ? 'piece' : esc(x.u)}</small></td><td class="n">${N(l.gstRate)}%</td><td class="n">${inr(x.amount, 2)}</td></tr>`; }).join('');
  const body = docHead(kind, soLabel(o.status)) + `<div class="meta"><div class="box"><h3>Customer</h3><b>${esc(soCust(o))}</b>${c.gstin ? '<br>GSTIN ' + esc(c.gstin) : ''}<br>${esc(o.phone || c.phone || '')}${(o.deliveryAddress || c.address) ? '<br>' + esc(o.deliveryAddress || c.address).replace(/\n/g, '<br>') : ''}</div><div class="box"><h3>Order</h3><div class="kv"><span>Number</span><b>${esc(o.number)}</b><span>Date</span><b>${esc(fmtD(o.date))}</b>${o.dueDate ? `<span>Promised by</span><b>${esc(fmtD(o.dueDate))}</b>` : ''}<span>Channel</span><b>${esc(PL(o.channel || 'direct').name)}</b>${o.tracking ? `<span>Courier</span><b>${esc(o.tracking)}</b>` : ''}</div></div></div>
  <table><thead><tr><th>#</th><th>Item</th><th>Size</th><th class="n">Quantity</th><th class="n">Rate</th><th class="n">GST</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="tot"><div><span>Items (incl. GST)</span><b>${inr(sub, 2)}</b></div>${N(o.discount) ? `<div><span>Discount</span><b>− ${inr(o.discount, 2)}</b></div>` : ''}${N(o.shipping) ? `<div><span>Shipping</span><b>${inr(o.shipping, 2)}</b></div>` : ''}<div class="g"><span>Total</span><span>${inr(tot, 2)}</span></div>${paid ? `<div><span>Paid</span><b>${inr(paid, 2)}</b></div><div><span>Balance</span><b>${inr(tot - paid, 2)}</b></div>` : ''}</div><div class="words">${esc(inWords(tot))}</div>
  ${o.notes ? `<div class="terms"><b>Notes</b><br>${esc(o.notes)}</div>` : ''}${o.status === 'quote' ? '<div class="terms">This quotation is valid for 15 days. Sizes are cut to order; custom-cut pieces can’t be returned unless they are faulty.</div>' : ''}<div class="sign"><div>Customer</div><div>For ${esc(company().legalName || company().name)}</div></div>`;
  await makePDF(docHTML(kind + ' ' + o.number, body), `${o.number}.pdf`, { footer: `${company().name} · ${o.number}` }); addLog('export', 'orders', 'Downloaded PDF of ' + o.number);
}
