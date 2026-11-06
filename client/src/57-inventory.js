/* =====================================================================
   Inventory: stock in each product's own unit, damaged / rejected stock,
   movement editor with decimals and purchase units, bulk movements
   ===================================================================== */
// [key, label, effect on sellable stock, effect on damaged stock, group]
const MV = [
  ['purchase', 'Purchase / inward', 1, 0, 'in'], ['return_in', 'Customer return, good (manual)', 1, 0, 'in'], ['adjust_add', 'Adjustment: add', 1, 0, 'in'],
  ['adjust_remove', 'Adjustment: remove', -1, 0, 'out'], ['damaged', 'Damaged, written off from sellable', -1, 0, 'out'], ['count', 'Physical count (set on-hand)', 0, 0, 'count'],
  ['mark_bad', 'Move sellable → damaged', -1, 1, 'bad'], ['bad_repair', 'Repaired: damaged → sellable', 1, -1, 'bad'], ['bad_writeoff', 'Write off damaged stock', 0, -1, 'bad'], ['bad_rtv', 'Return damaged stock to vendor', 0, -1, 'bad'], ['qc_reject', 'Rejected at receiving (QC)', 0, 1, 'bad'],
];
const mvOf = k => MV.find(m => m[0] === k) || [k, k, 1, 0, 'in'];
const mvLabel = m => m.poId ? (m.type === 'qc_reject' ? 'PO receipt · rejected' : 'PO receipt') : mvOf(m.type)[1];
const MV_PICK = MV.filter(m => m[0] !== 'qc_reject');

V.inventory = () => {
  const can = canEdit('inventory'); const tab = tabOf('inv', 'stock');
  const A = { stock: can ? btn('Bulk movement', 'bulkmove', { i: 'layers' }) + btn('Record movement', 'new:move', { pri: true, i: 'plus' }) : '', moves: can ? btn('Bulk movement', 'bulkmove', { i: 'layers' }) + btn('Record movement', 'new:move', { pri: true, i: 'plus' }) : '', damaged: can ? btn('Move stock to damaged', 'mvpreset:mark_bad', { pri: true, i: 'plus' }) : '', pos: can ? btn('New purchase order', 'new:po', { pri: true, i: 'plus' }) : '', invoices: canEdit('inventory') || canEdit('finance') ? btn('Purchase settings', 'purchset', { i: 'folder' }) + btn('Add purchase invoice', 'new:pinvoice', { pri: true, i: 'plus' }) : '', suppliers: can ? btn('Add vendor', 'new:supplier', { pri: true, i: 'plus' }) : '' };
  let html = ph('Inventory & purchasing', 'Stock is counted in each product’s own unit (pieces, sq ft, metres, kg) and worked out from opening stock, movements, received purchase orders and the sales ledger, so it never drifts from your records.', A[tab] || '');
  const openPO = S.pos.filter(p => p.status === 'ordered' || p.status === 'partial').length; const badN = Object.values(badMap()).filter(x => x > 0).length; const unpaid = S.pinvoices.filter(b => pinvDue(b) > 0.5).length;
  html += tabsHTML('inv', [['stock', 'Stock levels'], ['moves', 'Movements'], ['damaged', 'Damaged & rejected', badN || ''], ['pos', 'Purchase orders', openPO ? openPO + ' open' : ''], ['invoices', 'Purchase invoices', unpaid ? unpaid + ' unpaid' : ''], ['suppliers', 'Vendors', S.suppliers.length]], tab);
  if (tab === 'moves') return html + invMoves2(can);
  if (tab === 'damaged') return html + invDamaged(can);
  if (tab === 'pos') return html + invPOs2();
  if (tab === 'invoices') return html + invInvoices();
  if (tab === 'suppliers') return html + invVendors();
  return html + invStock(can);
};
function invStock(can) {
  const ps = S.products.filter(p => inBrand(p) && p.status !== 'archived').map(p => ({ p, ...stockState(p), bad: badMap()[p.id] || 0 }));
  const costs = allow('costs'); const c = k => ps.filter(x => x.st === k).length;
  const vCost = sum(ps, x => Math.max(0, x.on) * N(x.p.costPrice)), vRet = sum(ps, x => Math.max(0, x.on) * N(x.p.sellingPrice)), vBad = sum(ps, x => Math.max(0, x.bad) * N(x.p.costPrice));
  let html = kpis([
    { l: 'Active SKUs', v: num(ps.length), s: num(new Set(ps.map(x => x.p.brandId)).size) + ' brands' },
    costs ? { l: 'Stock at cost', v: inrS(vCost), title: inr(vCost) } : { l: 'Overstock', v: num(c('over')) },
    { l: 'Stock at price', v: inrS(vRet), title: inr(vRet), s: 'at selling price' },
    { l: 'Damaged & rejected', v: costs ? inrS(vBad) : num(ps.filter(x => x.bad > 0).length), s: num(ps.filter(x => x.bad > 0).length) + ' SKUs', title: costs ? inr(vBad) + ' at cost' : '' },
    { l: 'Low stock', v: num(c('low')) },
    { l: 'Out of stock', v: num(c('out')) },
  ]);
  const f = filtOf('stock', 'all');
  const rows = ps.filter(x => (f === 'all' || x.st === f) && matchQ('inv', x.p.name, x.p.sku, x.p.location, brandName(x.p.brandId)));
  html += `<div class="toolbar">${searchHTML('inv', 'Search product, SKU, location…')}${chipsHTML('stock', [['all', 'All', ps.length], ['out', 'Out', c('out')], ['low', 'Low', c('low')], ['over', 'Overstock', c('over')], ['ok', 'Healthy', c('ok')]], f)}<span class="sp"></span>${exportBtn('exportstock2', 'Export')}</div>`;
  if (can) html += selBar('stock', btn('Record movement for selected', 'bulkmovesel', { sm: true, i: 'layers' }) + btn('Raise PO for selected', 'posel', { sm: true, i: 'truck' }));
  html += panel('', table('stock', [
    { k: 'p', l: 'Product', render: x => prodCell(x.p), sort: x => x.p.name },
    { k: 'loc', l: 'Location', render: x => esc(x.p.location || '—'), sort: x => x.p.location || '' },
    { k: 'on', l: 'On hand', num: 1, render: x => `<b class="${x.on <= 0 ? 'neg' : ''}">${qty(x.on)}</b> <small class="muted">${esc(unitOf(x.p))}</small>${isPU(x.p.purchaseFactor) && x.p.purchaseUnit ? `<br><small class="muted">≈ ${qty(x.on / N(x.p.purchaseFactor))} ${esc(x.p.purchaseUnit)}</small>` : ''}` },
    { k: 'bad', l: 'Damaged', num: 1, render: x => x.bad ? `<span class="neg">${qty(x.bad)}</span>` : '—' },
    { k: 'ord', l: 'On order', num: 1, render: x => x.ord ? qty(x.ord) : '—' },
    { k: 'rl', l: 'Reorder at', num: 1, render: x => qty(x.rl) },
    { k: 'v', l: '30-day sales', num: 1, render: x => qty(x.v) },
    { k: 'cover', l: 'Days left', num: 1, render: x => Number.isFinite(x.cover) ? num(x.cover) : '—' },
    { k: 'val', l: 'Value at cost', num: 1, cost: 1, render: x => inr(Math.max(0, x.on) * N(x.p.costPrice)), sort: x => Math.max(0, x.on) * N(x.p.costPrice) },
    { k: 'st', l: 'Status', render: x => pill(...STOCK_PILL[x.st]), sort: x => ({ out: 0, low: 1, ok: 2, over: 3 })[x.st] },
    { k: 'a', l: '', nosort: 1, render: x => can ? `<span style="display:inline-flex;gap:6px">${btn('Adjust', 'stockin:' + x.p.id, { sm: true })}${(x.st === 'low' || x.st === 'out') ? btn('Order', 'poprod:' + x.p.id, { sm: true }) : ''}</span>` : '' },
  ], rows, { select: can, key: x => x.p.id, sort: { k: 'st', dir: 'asc' }, empty: S.products.length ? undefined : empty('No products yet', 'Stock appears here once you add products in the Catalogue.', canEdit('catalogue') ? btn('Add product', 'new:product', { pri: true }) : '') }), { flush: true });
  return html;
}
function invMoves2(can) {
  const r = periodRange(); const rows = [];
  S.moves.filter(m => inRange(m.date, r) && inBrand(m)).forEach(m => rows.push({ id: m.id, kind: 'move', m, date: m.date, type: mvLabel(m), tone: N(m.qty) > 0 ? 't-good' : N(m.qty) < 0 ? 't-bad' : 't-warn', productId: m.productId, qty: N(m.qty), bad: N(m.badQty), ref: [m.ref, m.supplier].filter(Boolean).join(' · '), by: m.createdBy, po: !!m.poId }));
  S.sales.filter(s => inRange(s.date, r) && inBrand(s)).forEach(s => { const out = saleStockOut(s); const rc = s.retCondition || (s.restocked === false ? 'bad' : 'good'); const lbl = s.status === 'returned' ? 'Return · ' + ({ good: 'restocked', bad: 'to damaged', missing: 'not received', wrong: 'wrong item' })[rc] : s.status === 'cancelled' ? 'Cancelled sale' : 'Sale · ' + PL(s.platform).name; rows.push({ id: s.id, kind: 'sale', date: s.date, type: lbl, tone: 't-neu', productId: s.productId, qty: -out, bad: s.status === 'returned' && rc === 'bad' ? N(s.qty) : 0, ref: s.orderRef || '', by: s.createdBy }); });
  const f = filtOf('mv', 'all'); const shown = rows.filter(x => f === 'all' || x.kind === f).filter(x => matchQ('mv', (prodOf(x.productId) || {}).name, (prodOf(x.productId) || {}).sku, x.ref, x.type));
  let html = `<div class="toolbar">${searchHTML('mv', 'Search product, reference…')}${chipsHTML('mv', [['all', 'All', rows.length], ['move', 'Stock movements', rows.filter(x => x.kind === 'move').length], ['sale', 'From sales ledger', rows.filter(x => x.kind === 'sale').length]], f)}</div>`;
  if (can) html += selBar('moves', btn('Delete selected', 'bulkdelmoves', { sm: true, i: 'trash', cls: 'danger' }));
  const unitCell = (x, v) => { const p = prodOf(x.productId); return `${v > 0 ? '+' : ''}${qty(v)} <small class="muted">${esc(unitOf(p))}</small>`; };
  html += panel('', table('moves', [
    { k: 'date', l: 'Date', render: x => `<span class="tnum">${esc(fmtD(x.date))}</span>` },
    { k: 'type', l: 'Type', render: x => pill(x.type, x.tone, 1) },
    { k: 'p', l: 'Product', render: x => prodCell(prodOf(x.productId)) + (x.kind === 'move' ? delPill('moves', x.id) : ''), sort: x => (prodOf(x.productId) || {}).name },
    { k: 'qty', l: 'Sellable', num: 1, render: x => x.qty ? `<b class="${x.qty < 0 ? 'neg' : 'pos'}">${unitCell(x, x.qty)}</b>` : '—' },
    { k: 'bad', l: 'Damaged', num: 1, render: x => x.bad ? `<span class="${x.bad > 0 ? 'neg' : 'pos'}">${unitCell(x, x.bad)}</span>` : '—' },
    { k: 'ref', l: 'Reference', render: x => esc(x.ref || '—') },
    { k: 'by', l: 'By', render: x => x.by ? esc(personName(x.by)) : '—', sort: x => personName(x.by) },
  ], shown, { select: can, key: x => x.kind + '|' + x.id, sort: { k: 'date', dir: 'desc' }, limit: 150, open: x => x.kind === 'move' ? 'open:move:' + x.id : (canView('finance') && secOK('sales') ? 'open:sale:' + x.id : ''), empty: empty('No movements in this period', 'Purchases, adjustments, damage and sales for the selected period appear here.') }), { flush: true });
  return html;
}
function invDamaged(can) {
  const costs = allow('costs'); const bm = badMap();
  const rows = S.products.filter(p => inBrand(p) && N(bm[p.id])).map(p => { const ms = S.moves.filter(m => m.productId === p.id && N(m.badQty)).sort((a, b) => a.date < b.date ? 1 : -1); const rs = S.sales.filter(s => s.productId === p.id && s.status === 'returned' && s.retCondition === 'bad'); return { p, bad: bm[p.id], last: ms[0] || null, rets: rs.length, qc: sum(ms.filter(m => m.type === 'qc_reject'), m => m.badQty) }; });
  const rv = sum(rows, x => Math.max(0, x.bad) * N(x.p.costPrice));
  let html = kpis([{ l: 'SKUs with damaged stock', v: num(rows.length) }, { l: 'Damaged value at cost', v: costs ? inrS(rv) : '—', title: costs ? inr(rv) : '' }, { l: 'From customer returns', v: num(sum(rows, x => x.rets)), s: 'returns marked bad' }, { l: 'Rejected at receiving', v: num(rows.filter(x => x.qc).length), s: 'SKUs with QC rejects' }], 'k4');
  html += panel('', table('damaged', [
    { k: 'p', l: 'Product', render: x => prodCell(x.p), sort: x => x.p.name },
    { k: 'bad', l: 'Damaged on hand', num: 1, render: x => `<b class="neg">${fmtQ(x.bad, x.p)}</b>` },
    { k: 'val', l: 'Value at cost', num: 1, cost: 1, render: x => inr(Math.max(0, x.bad) * N(x.p.costPrice)), sort: x => x.bad * N(x.p.costPrice) },
    { k: 'last', l: 'Last change', render: x => x.last ? `${esc(fmtD(x.last.date))}<br><small class="muted">${esc(mvLabel(x.last))}${x.last.note ? ' · ' + esc(x.last.note) : ''}</small>` : '<span class="muted">From returns</span>', sort: x => (x.last || {}).date || '' },
    { k: 'a', l: '', nosort: 1, render: x => can ? `<span style="display:inline-flex;gap:6px;flex-wrap:wrap">${btn('Repaired', 'mvpreset:bad_repair:' + x.p.id, { sm: true })}${btn('Return to vendor', 'mvpreset:bad_rtv:' + x.p.id, { sm: true })}${btn('Write off', 'mvpreset:bad_writeoff:' + x.p.id, { sm: true })}</span>` : '' },
  ], rows, { sort: { k: 'bad', dir: 'desc' }, empty: empty('No damaged stock', 'Stock rejected at receiving, returns that come back damaged and anything you move to damaged appear here, kept apart from sellable stock.') }), { flush: true });
  return html + `<p class="muted" style="margin:0;font-size:12px;max-width:90ch">Damaged stock never counts as sellable. Repairing moves it back to sellable stock; returning it to the vendor or writing it off removes it. Claims for damaged returns are tracked under Returns & claims.</p>`;
}

/* ---------- stock movement editor ---------- */
EDIT.move = (id, preset = {}) => {
  const m = id ? S.moves.find(x => x.id === id) : null; const can = canEdit('inventory') && !(m && m.poId); const costs = allow('costs');
  if (!S.products.length) { toast('Add products in the Catalogue first.', 'bad'); return; }
  const v0 = m ? { ...m, qty: m.entered ?? Math.abs(N(m.qty) || N(m.badQty)), inUnit: m.enteredUnit === 'purchase' ? 'purchase' : 'stock', unitCost: m.unitCost === null || m.unitCost === undefined ? null : Math.round(N(m.unitCost) * (m.enteredUnit === 'purchase' ? (N((prodOf(m.productId) || {}).purchaseFactor) || 1) : 1) * 100) / 100 } : { type: 'purchase', date: TODAY(), updateCost: true, inUnit: 'stock', ...preset };
  const p0 = prodOf(v0.productId); const u = unitOf(p0);
  const unitOpts = p => { const pu = p && p.purchaseUnit && isPU(p.purchaseFactor); return [['stock', unitOf(p)], ...(pu ? [['purchase', `${p.purchaseUnit} (1 = ${qty(p.purchaseFactor)} ${unitOf(p)})`]] : [])]; };
  const f = [
    { n: 'productId', l: 'Product', t: 'select', req: 1, full: 1, o: () => prodOptsWith(v0.productId), blank: 'Choose a product…', ch: 'mvprod' },
    { n: 'type', l: 'Movement', t: 'select', req: 1, o: (m && m.type === 'qc_reject' ? MV : MV_PICK).map(x => [x[0], x[1]]), ch: 'mvtype' },
    { n: 'date', l: 'Date', t: 'date', req: 1 },
    { n: 'qty', l: 'Quantity', t: 'number', req: 1, min: 0, step: 'any', help: 'Decimals are fine, e.g. 12.5 sq ft. For a physical count, enter the quantity you counted.' },
    { n: 'inUnit', l: 'Entered in', t: 'select', o: () => unitOpts(p0) },
    { n: 'unitCost', l: 'Cost per entered unit (ex-GST)', t: 'money', min: 0, help: 'For purchases.', hide: !costs },
    { n: 'updateCost', l: '', t: 'check', cl: 'Recalculate the product’s cost price as a weighted average', full: 1, hide: !costs || !!m },
    { n: 'supplier', l: 'Vendor' }, { n: 'ref', l: 'Reference', ph: 'Invoice, GRN or return number', mono: 1 },
    { n: 'note', l: 'Note', t: 'textarea', rows: 2, full: 1, ph: 'e.g. Cut 4 × 6 in pieces for order SO-2627-0012' },
  ];
  const stockLine = p => p ? `<div class="callout" id="mvStock"><b>${esc(p.name)}</b><span>On hand <b class="tnum">${fmtQ(stockMap()[p.id] || 0, p)}</b>${badMap()[p.id] ? ` · damaged <b class="tnum">${fmtQ(badMap()[p.id], p)}</b>` : ''}${p.purchaseUnit && N(p.purchaseFactor) !== 1 ? ` · bought as ${esc(p.purchaseUnit)} of ${fmtQ(p.purchaseFactor, p)}` : ''}</span></div>` : '<div class="callout" id="mvStock"><span class="muted">Pick a product to see its stock and unit.</span></div>';
  openDrawer({
    title: m ? (m.poId ? 'Purchase order receipt' : 'Stock movement') : 'Record stock movement', sub: m && m.poId ? 'Created by receiving a purchase order. Change it through the PO.' : 'Each product is counted in its own unit. Adjustments, damage, repairs, returns to vendor and physical counts.', readOnly: !can, delKey: 'moves/' + id,
    top: stockLine(p0), html: form(f, v0),
    validate: v => {
      const e = []; if (N(v.qty) <= 0 && v.type !== 'count') e.push({ n: 'qty', m: 'Enter a quantity above zero.' }); if (v.type === 'count' && (v.qty === null || N(v.qty) < 0)) e.push({ n: 'qty', m: 'Enter the counted quantity.' });
      const p = prodOf(v.productId); const fac = v.inUnit === 'purchase' ? N(p && p.purchaseFactor) || 1 : 1; const q = N(v.qty) * fac; const eff = mvOf(v.type);
      const badNow = (badMap()[v.productId] || 0) - (m && m.productId === v.productId ? N(m.badQty) : 0); if (eff[3] < 0 && q > badNow + 1e-9) e.push({ n: 'qty', m: `Only ${fmtQ(badNow, p)} is in damaged stock.` });
      return e;
    },
    onSave: async v => {
      const p = prodOf(v.productId); const eff = mvOf(v.type); const fac = v.inUnit === 'purchase' ? N(p.purchaseFactor) || 1 : 1; const q = rq3(N(v.qty) * fac);
      const curExcl = (stockMap()[v.productId] || 0) - (m && m.productId === v.productId ? N(m.qty) : 0);
      const dq = v.type === 'count' ? rq3(q - curExcl) : rq3(eff[2] * q); const db = rq3(eff[3] * q);
      const uc = v.unitCost !== null && v.unitCost !== undefined ? Math.round(N(v.unitCost) / fac * 10000) / 10000 : ((m && m.unitCost) ?? null);
      await saveDoc('moves', id, { ...base(m), productId: v.productId, brandId: p && p.brandId, type: v.type, qty: dq, badQty: db || null, entered: N(v.qty), enteredUnit: v.inUnit === 'purchase' ? 'purchase' : 'stock', date: v.date, unitCost: uc, supplier: v.supplier, ref: v.ref, note: v.note }, ['inventory', `${eff[1]}: ${dq ? (dq > 0 ? '+' : '') + fmtQ(dq, p) : ''}${db ? ` (damaged ${db > 0 ? '+' : ''}${fmtQ(db, p)})` : ''} × ${p ? p.sku : ''}`]);
      if (v.type === 'purchase' && v.updateCost && N(uc) > 0 && p && !m) { const cur = Math.max(0, curExcl); const nc = cur + dq > 0 ? (cur * N(p.costPrice) + dq * N(uc)) / (cur + dq) : N(uc); await saveDoc('products', p.id, { ...base(p), costPrice: Math.round(nc * 100) / 100 }, ['catalogue', `Cost price of ${p.sku} recalculated`]); }
    },
    onDelete: m && !m.poId ? delFn('moves', id, 'inventory', `Stock movement ${mvOf(m.type)[1]} ${N(m.qty) > 0 ? '+' : ''}${qty(m.qty || m.badQty)} × ${(prodOf(m.productId) || {}).sku || 'product'}`) : null,
  });
  void u;
};
Object.assign(CH, {
  mvprod(v) {
    const p = prodOf(v); const box = $('#mvStock'); if (box) box.outerHTML = p ? `<div class="callout" id="mvStock"><b>${esc(p.name)}</b><span>On hand <b class="tnum">${fmtQ(stockMap()[p.id] || 0, p)}</b>${badMap()[p.id] ? ` · damaged <b class="tnum">${fmtQ(badMap()[p.id], p)}</b>` : ''}</span></div>` : box.outerHTML;
    const sel = $('#fi_inUnit'); if (sel && p) { const pu = p.purchaseUnit && isPU(p.purchaseFactor); sel.innerHTML = `<option value="stock">${esc(unitOf(p))}</option>${pu ? `<option value="purchase">${esc(p.purchaseUnit)} (1 = ${esc(qty(p.purchaseFactor))} ${esc(unitOf(p))})</option>` : ''}`; }
  },
  mvtype() { },
});
Object.assign(ACT, {
  stockin(pid) { EDIT.move(null, { productId: pid, type: 'adjust_add' }); },
  mvpreset(type, pid) { EDIT.move(null, { productId: pid || '', type }); },
  bulkmove() { bulkMove([]); },
  bulkmovesel() { bulkMove(selIds('stock')); },
  posel() { const ids = selIds('stock'); const ps = ids.map(prodOf).filter(Boolean); if (!ps.length) return; const sup = ps.map(p => p.supplierId).find(Boolean) || ''; EDIT.po(null, { supplierId: sup, lines: ps.map(p => poLineFor(p)) }); },
  bulkdelmoves() { const ids = selIds('moves').filter(k => k.startsWith('move|')).map(k => k.slice(5)); const sales = selIds('moves').length - ids.length; if (sales) toast(`${sales} sales-ledger rows skipped. Change those in Finance › Sales.`); bulkDelete('moves', ids, 'inventory', m => `${mvLabel(m)} ${qty(m.qty || m.badQty)} × ${(prodOf(m.productId) || {}).sku || ''} on ${fmtD(m.date)}`, m => m.poId ? 'Part of a purchase order receipt. Change it through the PO.' : '', 'moves'); },
  exportstock2() { exportCSV('Stock levels', [{ l: 'SKU', k: 'sku' }, { l: 'Product', k: 'name' }, { l: 'Unit', csv: p => unitOf(p) }, { l: 'Location', k: 'location' }, { l: 'On hand', csv: p => rq3(stockState(p).on) }, { l: 'Damaged', csv: p => rq3(badMap()[p.id] || 0) }, { l: 'On order', csv: p => rq3(stockState(p).ord) }, { l: 'Reorder level', csv: p => stockState(p).rl }, { l: '30-day sales', csv: p => rq3(stockState(p).v) }, ...(allow('costs') ? [{ l: 'Value at cost', csv: p => (Math.max(0, stockState(p).on) * N(p.costPrice)).toFixed(2) }] : []), { l: 'Status', csv: p => STOCK_PILL[stockState(p).st][0] }], S.products.filter(p => inBrand(p) && p.status !== 'archived'), 'inventory'); },
});

/* ---------- bulk movement: many products, one go ---------- */
let BM = [];
function bulkMove(ids) {
  if (!S.products.length) { toast('Add products in the Catalogue first.', 'bad'); return; }
  BM = ids.length ? ids.map(pid => ({ productId: pid, qty: '', cost: '' })) : Array.from({ length: 5 }, () => ({ productId: '', qty: '', cost: '' }));
  const costs = allow('costs');
  const rowsHTML = () => `<div class="tw grid-w"><table class="t grid"><thead><tr><th>#</th><th>Product</th><th class="num">On hand</th><th>Quantity</th><th>Unit</th>${costs ? '<th>Cost / unit</th>' : ''}<th></th></tr></thead><tbody>${BM.map((r, i) => { const p = prodOf(r.productId); return `<tr><td class="muted tnum">${i + 1}</td><td style="min-width:240px"><select class="inp" name="b.${i}.productId" data-t="str" data-ch="bmprod" aria-label="Row ${i + 1} product"><option value="">Choose…</option>${prodOpts().map(([k, t]) => `<option value="${esc(k)}"${k === r.productId ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></td><td class="num tnum">${p ? fmtQ(stockMap()[p.id] || 0, p) : '—'}</td><td style="width:120px"><input class="inp tnum" type="number" step="any" min="0" name="b.${i}.qty" data-t="num" value="${esc(r.qty ?? '')}" aria-label="Row ${i + 1} quantity"></td><td class="muted">${p ? esc(unitOf(p)) : ''}</td>${costs ? `<td style="width:120px"><input class="inp tnum" type="number" step="any" min="0" name="b.${i}.cost" data-t="num" value="${esc(r.cost ?? '')}" placeholder="${p && N(p.costPrice) ? esc(p.costPrice) : ''}" aria-label="Row ${i + 1} cost"></td>` : ''}<td><button type="button" class="btn icon ghost sm" data-act="bmrm:${i}" aria-label="Remove row">${icon('x')}</button></td></tr>`; }).join('')}</tbody></table></div>`;
  openDrawer({
    title: 'Bulk stock movement', sub: 'Add, remove, damage or count many products at once. Quantities are in each product’s own unit.', wide: true, saveLabel: 'Record movements', savedMsg: null, noFocus: true,
    html: () => form([{ n: 'type', l: 'Movement', t: 'select', req: 1, o: MV_PICK.map(x => [x[0], x[1]]) }, { n: 'date', l: 'Date', t: 'date', req: 1 }, { n: 'ref', l: 'Reference', mono: 1, ph: 'Invoice, GRN or count sheet' }, { n: 'supplier', l: 'Vendor' }, { n: 'note', l: 'Note', full: 1 }, { n: 'updateCost', l: '', t: 'check', cl: 'For purchases, recalculate cost prices as a weighted average', full: 1, hide: !costs }], { type: 'adjust_add', date: TODAY(), updateCost: true })
      + `<details class="paste"><summary>${icon('copy')} Paste SKUs and quantities</summary><p class="help">Two or three columns from a spreadsheet: SKU (master or channel SKU), quantity${costs ? ', cost per unit' : ''}.</p><textarea class="inp mono" id="bmPaste" rows="4" placeholder="TVL-0001\t25.5\t92"></textarea><div style="margin-top:8px">${btn('Fill rows', 'bmpaste', { sm: true })}</div></details>
      <div id="bmBox">${rowsHTML()}</div><div style="margin-top:10px">${btn('Add 5 rows', 'bmadd', { sm: true, i: 'plus' })}</div>`,
    onSave: async v => {
      syncBM(); const rows = BM.filter(r => r.productId && (N(r.qty) > 0 || (v.type === 'count' && r.qty !== '' && r.qty !== null))); if (!rows.length) { toast('Enter a quantity for at least one product.', 'bad'); return false; }
      const eff = mvOf(v.type); const ops = []; const sm = stockMap(); const bm = badMap(); const errs = [];
      for (const r of rows) {
        const p = prodOf(r.productId); const q = rq3(N(r.qty)); if (eff[3] < 0 && q > (bm[p.id] || 0) + 1e-9) { errs.push(`${p.sku}: only ${fmtQ(bm[p.id] || 0, p)} damaged`); continue; }
        const dq = v.type === 'count' ? rq3(q - (sm[p.id] || 0)) : rq3(eff[2] * q); const db = rq3(eff[3] * q); const uc = r.cost !== '' && r.cost !== null && r.cost !== undefined ? N(r.cost) : (v.type === 'purchase' ? N(p.costPrice) || null : null);
        ops.push({ op: 'set', path: 'moves/' + newId('moves'), data: clean({ productId: p.id, brandId: p.brandId, type: v.type, qty: dq, badQty: db || null, entered: q, enteredUnit: 'stock', date: v.date, unitCost: uc, supplier: v.supplier, ref: v.ref, note: v.note, ...stampOf(null) }) });
        if (v.type === 'purchase' && v.updateCost && N(uc) > 0 && dq > 0) { const cur = Math.max(0, sm[p.id] || 0); const nc = (cur * N(p.costPrice) + dq * N(uc)) / (cur + dq); ops.push({ op: 'set', path: 'products/' + p.id, data: clean({ ...base(p), costPrice: Math.round(nc * 100) / 100, ...stampOf(p) }) }); }
      }
      if (errs.length) { toast(errs.slice(0, 2).join('; '), 'bad'); return false; }
      await batchAll(ops); selOf('stock').clear(); addLog('create', 'inventory', `${eff[1]} for ${rows.length} products`, rows.slice(0, 12).map(r => `${(prodOf(r.productId) || {}).sku} ${qty(r.qty)}`).join('; ') + (v.ref ? ' · ' + v.ref : '')); toast(`Recorded ${rows.length} movements`);
    },
  });
  DRW_bm = { html: rowsHTML };
}
let DRW_bm = null;
function syncBM() { const { vals } = readForm($('#drForm')); const b = vals.b || {}; BM = BM.map((r, i) => ({ ...r, ...(b[i] || {}) })); }
function redrawBM() { const el = $('#bmBox'); if (el && DRW_bm) el.innerHTML = DRW_bm.html(); }
const skuFind = s => { s = String(s || '').trim().toLowerCase(); if (!s) return null; return S.products.find(p => String(p.sku || '').toLowerCase() === s) || S.products.find(p => Object.values(p.listings || {}).some(l => String(l.sku || '').toLowerCase() === s || String(l.id || '').toLowerCase() === s)) || null; };
Object.assign(ACT, {
  bmadd() { syncBM(); for (let i = 0; i < 5; i++) BM.push({ productId: '', qty: '', cost: '' }); redrawBM(); },
  bmrm(i) { syncBM(); BM.splice(+i, 1); if (!BM.length) BM.push({ productId: '', qty: '', cost: '' }); redrawBM(); },
  bmpaste() { syncBM(); const lines = parsePaste(($('#bmPaste') || {}).value); const miss = []; const add = []; for (const c of lines) { const p = skuFind(c[0]); if (!p) { if (c[0] && !/sku/i.test(c[0])) miss.push(c[0]); continue; } add.push({ productId: p.id, qty: N(String(c[1] || '').replace(/[,\s]/g, '')) || '', cost: c[2] ? N(String(c[2]).replace(/[₹,\s]/g, '')) : '' }); } BM = BM.filter(r => r.productId).concat(add); if (!BM.length) BM.push({ productId: '', qty: '', cost: '' }); redrawBM(); toast(`${add.length} rows filled${miss.length ? `; not found: ${miss.slice(0, 4).join(', ')}` : ''}`, miss.length ? 'bad' : ''); },
});
Object.assign(CH, { bmprod() { syncBM(); redrawBM(); } });
