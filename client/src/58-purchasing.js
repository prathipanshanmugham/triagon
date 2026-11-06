/* =====================================================================
   Purchasing: purchase orders (units, GST, PDF, delete with approval),
   receiving with QC rejects, vendor management, purchase invoices
   with uploaded bills, Drive folders by month and Gmail links
   ===================================================================== */
const DOC_CSS = `@page{size:A4;margin:14mm 13mm 16mm}html,body{margin:0;background:#fff}
.doc{font:400 10.5px/1.45 "IBM Plex Sans","Segoe UI",Arial,sans-serif;color:#1C1B18;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.doc *{box-sizing:border-box}.doc h1{font:600 20px/1.2 "IBM Plex Sans",Arial,sans-serif;letter-spacing:.02em;margin:0}
.doc .hd{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:12px;border-bottom:2px solid #B8893A;margin-bottom:14px}
.doc .hd img{width:150px;height:auto}.doc .co{text-align:right;font-size:10px;color:#4A463F}.doc .co b{font-size:12px;color:#1C1B18}
.doc .meta{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}.doc .box{border:1px solid #E6E0D4;border-radius:6px;padding:9px 11px}
.doc .box h3{margin:0 0 4px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;color:#86641C}.doc .kv{display:grid;grid-template-columns:auto 1fr;gap:2px 10px}.doc .kv span{color:#7C766C}
.doc table{width:100%;border-collapse:collapse;margin-top:4px}.doc th{background:#FBF6EA;color:#4A463F;font-size:9px;letter-spacing:.08em;text-transform:uppercase;text-align:left;padding:7px 8px;border-bottom:1px solid #E6E0D4}
.doc td{padding:7px 8px;border-bottom:1px solid #F0ECE3;vertical-align:top}.doc .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.doc small{color:#7C766C}
.doc .tot{margin-left:auto;width:300px;margin-top:10px}.doc .tot div{display:flex;justify-content:space-between;padding:4px 0}.doc .tot .g{border-top:2px solid #1C1B18;font-weight:700;font-size:12px;margin-top:4px;padding-top:7px}
.doc .terms{margin-top:16px;font-size:9.5px;color:#4A463F;white-space:pre-wrap}.doc .sign{display:flex;justify-content:space-between;margin-top:40px;font-size:10px}.doc .sign div{border-top:1px solid #7C766C;padding-top:5px;width:200px;text-align:center}
.doc .words{margin-top:6px;font-size:10px;color:#4A463F}.doc .stamp{display:inline-block;border:1px solid #86641C;color:#86641C;border-radius:4px;padding:2px 8px;font-size:9px;letter-spacing:.12em;text-transform:uppercase;margin-top:6px}`;
const docHTML = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><link rel="stylesheet" href="fonts/fonts.css"><style>${DOC_CSS}</style></head><body><div class="doc">${body}</div></body></html>`;
const docHead = (title, sub) => { const co = company(); return `<div class="hd"><div><img src="assets/logo-full.png" alt=""><h1 style="margin-top:10px">${esc(title)}</h1>${sub ? `<div class="stamp">${esc(sub)}</div>` : ''}</div><div class="co"><b>${esc(co.legalName || co.name)}</b><br>${esc(co.address || '').replace(/\n/g, '<br>')}${co.state ? '<br>' + esc(co.state) : ''}${co.gstin ? '<br>GSTIN ' + esc(co.gstin) : ''}${co.phone ? '<br>' + esc(co.phone) : ''}${co.email ? '<br>' + esc(co.email) : ''}</div></div>`; };
function inWords(n) {
  n = Math.round(N(n)); if (!n) return 'Zero rupees only'; const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']; const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''); const three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
  const parts = []; const cr = Math.floor(n / 1e7); n %= 1e7; const la = Math.floor(n / 1e5); n %= 1e5; const th = Math.floor(n / 1000); n %= 1000;
  if (cr) parts.push(three(cr) + ' Crore'); if (la) parts.push(two(la) + ' Lakh'); if (th) parts.push(two(th) + ' Thousand'); if (n) parts.push(three(n)); return 'Rupees ' + parts.join(' ') + ' only';
}
const PO_TONE2 = { draft: 't-neu', ordered: 't-info', partial: 't-warn', received: 't-good', cancelled: 't-neu' };
const poLineFor = p => { const pu = p.purchaseUnit && N(p.purchaseFactor) > 0 && N(p.purchaseFactor) !== 1; const s = stockState(p); const need = Math.max(N(p.reorderLevel) || 10, (N(p.reorderLevel) || 10) * 3 - s.on - s.ord); const fac = pu ? N(p.purchaseFactor) : 1; return { productId: p.id, unit: pu ? p.purchaseUnit : unitOf(p), factor: fac, qty: Math.max(1, Math.ceil(need / fac)), cost: N(p.costPrice) ? Math.round(N(p.costPrice) * fac * 100) / 100 : null, gstRate: N(p.gstRate ?? 18), received: 0, rejected: 0 }; };
const poTotals = po => { const tax = poValue(po), gst = poGST(po); const sup = supOf(po.supplierId) || {}; const inter = sup.state && company().state && sup.state !== company().state; return { tax, gst, total: tax + gst + N(po.freight), inter }; };

/* ---------- purchase order editor ---------- */
EDIT.po = (id, preset = {}) => {
  const po = id ? S.pos.find(x => x.id === id) : null; const can = canEdit('inventory') && (!po || !['received', 'cancelled'].includes(po.status)); const costs = allow('costs');
  if (!S.products.length) { toast('Add products in the Catalogue first.', 'bad'); return; }
  poLines = po ? JSON.parse(JSON.stringify(po.lines || [])) : (preset.lines || [{ productId: '', qty: 1, factor: 1, unit: '', cost: null, gstRate: 18, received: 0, rejected: 0 }]);
  const pset = Object.assign({ terms: 'Payment: as agreed. Delivery to our store. Goods are checked on arrival; rejected material is returned at the vendor’s cost.', shipTo: '' }, S.settings.purchase || {});
  const v0 = po || { number: nextNum(S.pos, 'number', 'PO-' + fyShort() + '-'), date: TODAY(), expectedDate: addDays(TODAY(), 10), status: 'ordered', supplierId: preset.supplierId || '', terms: pset.terms, shipTo: pset.shipTo || company().address || '' };
  const locked = po && ['partial', 'received'].includes(po.status);
  const f = [
    { n: 'number', l: 'PO number', mono: 1, req: 1 }, { n: 'supplierId', l: 'Vendor', t: 'select', req: 1, o: () => S.suppliers.map(s => [s.id, s.name]), blank: S.suppliers.length ? 'Choose…' : 'Add a vendor first' },
    { n: 'date', l: 'Order date', t: 'date', req: 1 }, { n: 'expectedDate', l: 'Expected delivery', t: 'date' },
    { n: 'status', l: 'Status', t: 'select', o: locked ? PO_STATUS : PO_STATUS.filter(s => ['draft', 'ordered', 'cancelled'].includes(s[0])), ro: locked }, { n: 'freight', l: 'Freight / other charges', t: 'money', min: 0, hide: !costs },
  ];
  const dis = can ? '' : ' disabled';
  const unitSel = (l, i) => { const p = prodOf(l.productId); if (!p) return `<span class="muted">—</span>`; const pu = p.purchaseUnit && isPU(p.purchaseFactor); const cur = isPU(l.factor) ? 'purchase' : 'stock'; return `<select class="inp" name="lines.${i}.uk" data-t="str" data-ch="poprodch" aria-label="Unit"${dis || (N(l.received) ? ' disabled' : '')}><option value="stock"${cur === 'stock' ? ' selected' : ''}>${esc(unitOf(p))}</option>${pu || cur === 'purchase' ? `<option value="purchase"${cur === 'purchase' ? ' selected' : ''}>${esc(p.purchaseUnit)} (${esc(qty(p.purchaseFactor))} ${esc(unitOf(p))})</option>` : ''}</select>`; };
  const lines = () => `<div class="subh">Items</div><div class="tw"><table class="t grid poh"><thead><tr><th>Product</th><th>Unit</th><th>Qty</th>${costs ? '<th>Rate (ex-GST)</th><th>GST %</th><th class="num">Amount</th>' : ''}<th class="num">Received</th><th></th></tr></thead><tbody>${poLines.map((l, i) => { const p = prodOf(l.productId); const amt = N(l.qty) * N(l.cost ?? 0); return `<tr><td style="min-width:220px"><select class="inp" name="lines.${i}.productId" data-t="str" data-ch="poprodch" aria-label="Product"${dis || (N(l.received) ? ' disabled' : '')}><option value="">Choose…</option>${prodOptsWith(l.productId).map(([k, t]) => `<option value="${esc(k)}"${k === l.productId ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></td><td style="min-width:120px">${unitSel(l, i)}</td><td style="width:100px"><input class="inp tnum" type="number" min="0" step="any" name="lines.${i}.qty" data-t="num" value="${esc(l.qty ?? '')}" aria-label="Quantity"${dis}></td>${costs ? `<td style="width:120px"><input class="inp tnum" type="number" step="any" min="0" name="lines.${i}.cost" data-t="num" value="${esc(l.cost ?? '')}" placeholder="${p && N(p.costPrice) ? esc(Math.round(N(p.costPrice) * (N(l.factor) || 1) * 100) / 100) : ''}" aria-label="Rate"${dis}></td><td style="width:80px"><input class="inp tnum" type="number" step="any" min="0" name="lines.${i}.gstRate" data-t="num" value="${esc(l.gstRate ?? (p ? N(p.gstRate ?? 18) : 18))}" aria-label="GST rate"${dis}></td><td class="num tnum">${inr(amt, 2)}</td>` : ''}<td class="num tnum muted">${qty(l.received || 0)}${N(l.rejected) ? `<br><small class="neg">${qty(l.rejected)} rejected</small>` : ''}</td><td>${can && !N(l.received) ? `<button type="button" class="btn icon ghost sm" data-act="porm:${i}" aria-label="Remove line">${icon('x')}</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>${can ? `<div style="margin-top:10px">${btn('Add item', 'poadd', { sm: true, i: 'plus' })}</div>` : ''}${costs ? `<p class="muted" style="font-size:12px">Taxable <b>${inr(sum(poLines, l => N(l.qty) * N(l.cost)), 2)}</b> · GST <b>${inr(sum(poLines, l => N(l.qty) * N(l.cost) * N(l.gstRate) / 100), 2)}</b>. A blank rate uses the product’s current cost × units per purchase unit.</p>` : ''}`;
  DRW_po = { po, lines };
  const pend = po && pendingDel()['pos/' + po.id]; const recd = po ? S.moves.filter(m => m.poId === po.id).length : 0;
  openDrawer({
    title: po ? po.number : 'New purchase order', sub: po ? `${esc((supOf(po.supplierId) || {}).name || '')} · ${esc((PO_STATUS.find(s => s[0] === po.status) || [, po.status])[1])}` : 'Order stock from a vendor in their units (hides, lots, boxes). Receive it when it arrives to add it to inventory.', readOnly: !can, delKey: 'pos/' + id, wide: true,
    top: po ? kvHTML([['Items', num((po.lines || []).length)], ['Received', pct(poReceivedPct(po), 0)], costs ? ['Total incl. GST', inr(poTotals(po).total)] : ['Expected', esc(fmtD(po.expectedDate))], ['Bills', num(S.pinvoices.filter(b => b.poId === po.id).length)]]) : '',
    html: () => form(f, v0) + `<div id="poLines">${lines()}</div>` + form([{ n: 'terms', l: 'Terms printed on the PO', t: 'textarea', rows: 3, full: 1 }, { n: 'shipTo', l: 'Deliver to', t: 'textarea', rows: 2 }, { n: 'notes', l: 'Internal notes', t: 'textarea', rows: 2 }], v0),
    footExtra: po ? `${btn('PDF', 'popdf:' + po.id, { i: 'pdf' })}${po && (supOf(po.supplierId) || {}).email ? btn('Email vendor', 'pomail:' + po.id, { i: 'mail' }) : ''}${['ordered', 'partial'].includes(po.status) && canEdit('inventory') ? btn('Receive items', 'poreceive:' + po.id, { i: 'box' }) : ''}${canEdit('inventory') || canEdit('finance') ? btn('Add bill', 'pobill:' + po.id, { i: 'plus' }) : ''}` : '',
    confirmText: recd ? `Delete this PO? Its ${recd} receipt movement${recd === 1 ? '' : 's'} will be removed from stock too. It goes to the recycle bin, where it can be restored this quarter.` : 'Delete this purchase order? It goes to the recycle bin, where it can be restored this quarter.',
    validate: v => { const e = []; const ls = linesFrom(v); if (!ls.length) e.push({ n: 'number', m: 'Add at least one item with a quantity.' }); if (S.pos.some(x => x.id !== id && x.number === v.number)) e.push({ n: 'number', m: 'Another PO has this number.' }); return e; },
    onSave: async v => { const ls = linesFrom(v); const status = locked ? po.status : v.status; await saveDoc('pos', id, { ...base(po), number: v.number, supplierId: v.supplierId, date: v.date, expectedDate: v.expectedDate, status, freight: v.freight ?? (po && po.freight) ?? null, terms: v.terms, shipTo: v.shipTo, notes: v.notes, lines: ls }, ['inventory', `Purchase order ${v.number} · ${(supOf(v.supplierId) || {}).name || ''} · ${ls.length} items`]); },
    // admins delete straight away (any status, receipts included); everyone else sends a request
    onDelete: po && canEdit('inventory') && !pend ? delFn('pos', id, 'inventory', `Purchase order ${po.number}${recd ? ` (with ${recd} receipt${recd === 1 ? '' : 's'})` : ''}`) : null,
  });
  if (po && !can && canEdit('inventory') && !pend) { DRW.cfg.readOnly = false; DRW.cfg.onSave = null; DRW.cfg.onDelete = delFn('pos', id, 'inventory', `Purchase order ${po.number}${recd ? ` (with ${recd} receipt${recd === 1 ? '' : 's'})` : ''}`); $('#drFoot').innerHTML = footHTML(); }
};
// read lines with unit choice (stock unit or purchase unit)
function linesFrom(v) {
  const raw = v.lines || {};
  return poLines.map((l, i) => {
    const x = raw[i] || {}; const pid = x.productId !== undefined ? x.productId : l.productId; const p = prodOf(pid) || {};
    const uk = x.uk !== undefined ? x.uk : (isPU(l.factor) ? 'purchase' : 'stock'); const fac = N(l.received) || N(l.rejected) ? (N(l.factor) || 1) : uk === 'purchase' ? (pid === l.productId && isPU(l.factor) ? N(l.factor) : N(p.purchaseFactor) > 0 ? N(p.purchaseFactor) : 1) : 1;
    const cost = x.cost !== undefined && x.cost !== null ? N(x.cost) : (l.cost !== null && l.cost !== undefined && pid === l.productId ? N(l.cost) : Math.round(N(p.costPrice) * fac * 100) / 100);
    return { productId: pid, unit: isPU(fac) ? (l.unit && pid === l.productId && isPU(l.factor) ? l.unit : p.purchaseUnit || 'lot') : unitOf(p), factor: fac, qty: rq3(N(x.qty !== undefined ? x.qty : l.qty)), cost, gstRate: N(x.gstRate !== undefined && x.gstRate !== null ? x.gstRate : (l.gstRate ?? p.gstRate ?? 18)), received: N(l.received), rejected: N(l.rejected) };
  }).filter(l => l.productId && l.qty > 0);
}
function syncPoLines() { const { vals } = readForm($('#drForm')); const raw = vals.lines || {}; poLines = poLines.map((l, i) => { const x = raw[i] || {}; const pid = x.productId !== undefined ? x.productId : l.productId; const p = prodOf(pid) || {}; const uk = x.uk !== undefined ? x.uk : (isPU(l.factor) ? 'purchase' : 'stock'); const fac = uk === 'purchase' && N(p.purchaseFactor) > 0 ? N(p.purchaseFactor) : 1; const locked = N(l.received) || N(l.rejected); const changed = !locked && (pid !== l.productId || fac !== (N(l.factor) || 1)); return { ...l, productId: pid, factor: locked ? l.factor : fac, unit: locked ? l.unit : isPU(fac) ? p.purchaseUnit : unitOf(p), qty: x.qty !== undefined ? x.qty : l.qty, cost: changed ? (N(p.costPrice) ? Math.round(N(p.costPrice) * fac * 100) / 100 : null) : (x.cost !== undefined ? x.cost : l.cost), gstRate: changed ? N(p.gstRate ?? 18) : (x.gstRate !== undefined ? x.gstRate : l.gstRate) }; }); }
Object.assign(CH, { poprodch() { syncPoLines(); redrawPoLines(); } });
Object.assign(ACT, {
  poadd() { syncPoLines(); poLines.push({ productId: '', qty: 1, factor: 1, cost: null, gstRate: 18, received: 0, rejected: 0 }); redrawPoLines(); },
  porm(i) { syncPoLines(); poLines.splice(+i, 1); if (!poLines.length) poLines.push({ productId: '', qty: 1, factor: 1, cost: null, gstRate: 18, received: 0, rejected: 0 }); redrawPoLines(); },
  poprod(pid) { const p = prodOf(pid); if (!p) return; EDIT.po(null, { supplierId: p.supplierId || '', lines: [poLineFor(p)] }); },
  popdf(id) { poPDF(id); },
  pomail(id) { const po = S.pos.find(x => x.id === id); const s = po && supOf(po.supplierId); if (!s || !s.email) return; const co = company(); const t = poTotals(po); const body = `Dear ${s.contact || s.name},\n\nPlease find our purchase order ${po.number} dated ${fmtD(po.date)}${allow('costs') ? ` for ${inr(t.total)} (incl. GST)` : ''}. The PDF is attached.\n\nItems:\n${(po.lines || []).map(l => `• ${(prodOf(l.productId) || {}).name || ''}: ${qty(l.qty)} ${l.unit || ''}`).join('\n')}\n\nExpected delivery: ${fmtD(po.expectedDate)}\n\nRegards,\n${ME.name || ''}\n${co.legalName || co.name}`; window.open(gmailCompose(s.email, `Purchase order ${po.number} from ${co.name}`, body), '_blank', 'noopener'); toast('Gmail opened. Download the PDF and attach it.'); poPDF(id); },
  pobill(id) { closeDrawer(); setTimeout(() => EDIT.pinvoice(null, { poId: id }), 230); },
});
const gmailCompose = (to, su, body) => 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(to || '') + '&su=' + encodeURIComponent(su || '') + '&body=' + encodeURIComponent(body || '');
async function poPDF(id) {
  const po = S.pos.find(x => x.id === id); if (!po) return; const s = supOf(po.supplierId) || {}; const t = poTotals(po); const costs = allow('costs');
  const rows = (po.lines || []).map((l, i) => { const p = prodOf(l.productId) || {}; const amt = N(l.qty) * N(l.cost); return `<tr><td>${i + 1}</td><td><b>${esc(p.name || 'Product')}</b><br><small>${esc(p.sku || '')}${p.hsn ? ' · HSN ' + esc(p.hsn) : ''}${isPU(l.factor) ? ` · 1 ${esc(l.unit)} = ${esc(qty(l.factor))} ${esc(unitOf(p))}` : ''}</small></td><td class="n">${qty(l.qty)} ${esc(l.unit || unitOf(p))}</td>${costs ? `<td class="n">${inr(l.cost, 2)}</td><td class="n">${N(l.gstRate)}%</td><td class="n">${inr(amt, 2)}</td>` : ''}</tr>`; }).join('');
  const body = docHead('Purchase order', (PO_STATUS.find(x => x[0] === po.status) || [, po.status])[1]) + `<div class="meta"><div class="box"><h3>Vendor</h3><b>${esc(s.name || '')}</b><br>${esc(s.address || '')}${s.city || s.state ? '<br>' + esc([s.city, s.state].filter(Boolean).join(', ')) : ''}${s.gstin ? '<br>GSTIN ' + esc(s.gstin) : ''}${s.phone ? '<br>' + esc(s.phone) : ''}${s.email ? ' · ' + esc(s.email) : ''}</div><div class="box"><h3>Order</h3><div class="kv"><span>PO number</span><b>${esc(po.number)}</b><span>Date</span><b>${esc(fmtD(po.date))}</b><span>Expected</span><b>${esc(fmtD(po.expectedDate))}</b>${s.terms ? `<span>Payment</span><b>${esc(s.terms)}</b>` : ''}</div>${po.shipTo ? `<h3 style="margin-top:8px">Deliver to</h3>${esc(po.shipTo).replace(/\n/g, '<br>')}` : ''}</div></div>
  <table><thead><tr><th>#</th><th>Item</th><th class="n">Quantity</th>${costs ? '<th class="n">Rate</th><th class="n">GST</th><th class="n">Amount</th>' : ''}</tr></thead><tbody>${rows}</tbody></table>
  ${costs ? `<div class="tot"><div><span>Taxable value</span><b>${inr(t.tax, 2)}</b></div>${t.inter ? `<div><span>IGST</span><b>${inr(t.gst, 2)}</b></div>` : `<div><span>CGST</span><b>${inr(t.gst / 2, 2)}</b></div><div><span>SGST</span><b>${inr(t.gst / 2, 2)}</b></div>`}${N(po.freight) ? `<div><span>Freight & other</span><b>${inr(po.freight, 2)}</b></div>` : ''}<div class="g"><span>Total</span><span>${inr(t.total, 2)}</span></div></div><div class="words">${esc(inWords(t.total))}</div>` : ''}
  ${po.terms ? `<div class="terms"><b>Terms</b><br>${esc(po.terms)}</div>` : ''}<div class="sign"><div>Vendor acceptance</div><div>For ${esc(company().legalName || company().name)}</div></div>`;
  await makePDF(docHTML('PO ' + po.number, body), `${po.number}.pdf`, { footer: `${company().name} · ${po.number}` }); addLog('export', 'inventory', 'Downloaded PDF of ' + po.number);
}

/* ---------- receiving: accepted and rejected (QC) quantities ---------- */
EDIT.receive = id => {
  const po = S.pos.find(x => x.id === id); if (!po) return; const costs = allow('costs');
  const rows = (po.lines || []).map((l, i) => ({ l, i, rem: Math.max(0, rq3(N(l.qty) - N(l.received) - N(l.rejected))) })).filter(x => x.rem > 0);
  const html = `<div class="form"><div class="fld"><label for="rc_date">Received on</label><input class="inp" type="date" id="rc_date" name="date" data-t="str" value="${TODAY()}" data-req="1"></div><div class="fld"><label for="rc_ref">GRN / invoice number</label><input class="inp mono" id="rc_ref" name="ref" data-t="str"></div></div>
  <div class="subh">Quantities received now</div><p class="help" style="margin-top:0">Accepted goes to sellable stock. Rejected (damaged, wrong size or grade) goes to damaged stock so you can return it or claim it.</p>
  <div class="tw"><table class="t grid"><thead><tr><th>Item</th><th class="num">Pending</th><th>Accepted</th><th>Rejected</th></tr></thead><tbody>${rows.map(x => { const p = prodOf(x.l.productId) || {}; return `<tr><td><b>${esc(p.name || 'Product')}</b><br><small class="muted">${esc(p.sku || '')} · ordered ${qty(x.l.qty)} ${esc(x.l.unit || '')}${isPU(x.l.factor) ? ` (× ${qty(x.l.factor)} ${esc(unitOf(p))})` : ''}${costs ? ' · ' + inr(x.l.cost, 2) + ' each' : ''}</small></td><td class="num tnum">${qty(x.rem)}</td><td style="width:110px"><input class="inp tnum" type="number" min="0" max="${x.rem}" step="any" name="rcv.${x.i}" data-t="num" value="${x.rem}" aria-label="Accepted for ${esc(p.name || 'product')}"></td><td style="width:110px"><input class="inp tnum" type="number" min="0" step="any" name="rej.${x.i}" data-t="num" value="" placeholder="0" aria-label="Rejected for ${esc(p.name || 'product')}"></td></tr>`; }).join('')}</tbody></table></div>
  <div class="form" style="margin-top:12px"><div class="fld full"><label for="rc_note">Rejection reason</label><input class="inp" id="rc_note" name="note" data-t="str" placeholder="e.g. 2 hides with brand marks and holes"></div></div>
  ${costs ? `<label class="chk" style="margin-top:6px"><input type="checkbox" name="wavg" data-t="check" checked> Recalculate cost prices as a weighted average</label>` : ''}`;
  openDrawer({
    title: 'Receive ' + po.number, sub: `${esc((supOf(po.supplierId) || {}).name || '')} · quantities in the PO’s units, converted to stock units`, html, saveLabel: 'Receive stock', savedMsg: null, wide: true,
    onSave: async v => {
      const sup = (supOf(po.supplierId) || {}).name || ''; const lines = JSON.parse(JSON.stringify(po.lines || [])); const tmp = {}; let n = 0; const ops = []; const det = [];
      for (const x of rows) {
        const a = rq3(Math.max(0, N((v.rcv || {})[x.i]))); const rj = rq3(Math.max(0, N((v.rej || {})[x.i]))); if (!a && !rj) continue; if (a + rj > x.rem + 1e-9) { toast(`More than pending on ${(prodOf(x.l.productId) || {}).sku || 'a line'}.`, 'bad'); return false; }
        const p = prodOf(x.l.productId); if (!p) continue; const fac = N(x.l.factor) || 1; const ucost = Math.round(N(x.l.cost) / fac * 10000) / 10000;
        const mv = { productId: p.id, brandId: p.brandId, date: v.date, unitCost: ucost, supplier: sup, ref: po.number + (v.ref ? ' · ' + v.ref : ''), poId: po.id, ...stampOf(null), ...(po.demo ? { demo: true } : {}) };
        if (a) { ops.push({ op: 'set', path: 'moves/' + newId('moves'), data: clean({ ...mv, type: 'purchase', qty: rq3(a * fac), entered: a, enteredUnit: isPU(fac) ? 'purchase' : 'stock' }) }); if (v.wavg && ucost > 0) { const t = tmp[p.id] || { on: Math.max(0, stockMap()[p.id] || 0), cost: N(p.costPrice) }; const q = a * fac; tmp[p.id] = { on: t.on + q, cost: (t.on * t.cost + q * ucost) / (t.on + q) }; } }
        if (rj) ops.push({ op: 'set', path: 'moves/' + newId('moves'), data: clean({ ...mv, type: 'qc_reject', qty: 0, badQty: rq3(rj * fac), entered: rj, enteredUnit: isPU(fac) ? 'purchase' : 'stock', note: v.note || 'Rejected at receiving' }) });
        lines[x.i].received = rq3(N(lines[x.i].received) + a); lines[x.i].rejected = rq3(N(lines[x.i].rejected) + rj); n++; det.push(`${p.sku} +${qty(a)}${rj ? ` (rejected ${qty(rj)})` : ''}`);
      }
      if (!n) { toast('Enter at least one received quantity.', 'bad'); return false; }
      for (const pid in tmp) { const p = prodOf(pid); ops.push({ op: 'set', path: 'products/' + pid, data: clean({ ...base(p), costPrice: Math.round(tmp[pid].cost * 100) / 100, ...stampOf(p) }) }); }
      const done = lines.every(l => N(l.received) + N(l.rejected) >= N(l.qty) - 1e-9);
      ops.push({ op: 'set', path: 'pos/' + po.id, data: clean({ ...base(po), lines, status: done ? 'received' : 'partial', receivedAt: done ? v.date : (po.receivedAt || null), ...stampOf(po) }) });
      await batchAll(ops); addLog('receive', 'inventory', `Received goods on ${po.number}${done ? ' (complete)' : ' (partial)'}`, det.join('; ') + (v.note ? ' · ' + v.note : '')); toast(`Received ${n} line${n === 1 ? '' : 's'} into stock`);
    },
  });
};

/* ---------- purchase orders list ---------- */
function invPOs2() {
  const all = S.pos.filter(p => brandAll() || (p.lines || []).some(l => inBrand({ productId: l.productId }))); const open = all.filter(p => p.status === 'ordered' || p.status === 'partial');
  const late = open.filter(p => p.expectedDate && p.expectedDate < TODAY()); const costs = allow('costs'); const can = canEdit('inventory');
  let html = kpis([
    { l: 'Open orders', v: num(open.length), s: num(all.filter(p => p.status === 'draft').length) + ' drafts' },
    { l: 'Value on order', v: costs ? inrS(sum(open, p => sum(p.lines || [], l => Math.max(0, N(l.qty) - N(l.received) - N(l.rejected)) * N(l.cost) * (1 + N(l.gstRate) / 100)))) : '—', s: 'incl. GST, not yet received' },
    { l: 'Late deliveries', v: num(late.length), s: late.length ? 'past the expected date' : 'none late', tone: late.length ? 'neg' : '' },
    { l: 'Vendors', v: num(S.suppliers.length) },
  ], 'k4');
  const f = filtOf('pof', 'open'); const rows = all.filter(p => (f === 'all' || (f === 'open' ? (p.status === 'ordered' || p.status === 'partial' || p.status === 'draft') : p.status === f)) && matchQ('po', p.number, (supOf(p.supplierId) || {}).name, p.notes));
  html += `<div class="toolbar">${searchHTML('po', 'Search PO number, vendor…')}${chipsHTML('pof', [['open', 'Open & drafts'], ['received', 'Received'], ['cancelled', 'Cancelled'], ['all', 'All', all.length]], f)}</div>`;
  if (can) html += selBar('pos', btn('Delete selected', 'bulkdelpos', { sm: true, i: 'trash', cls: 'danger' }));
  html += panel('', table('pos', [
    { k: 'number', l: 'PO', render: p => `<span class="mono"><b>${esc(p.number)}</b></span>${delPill('pos', p.id)}` },
    { k: 'sup', l: 'Vendor', render: p => esc((supOf(p.supplierId) || {}).name || '—'), sort: p => (supOf(p.supplierId) || {}).name || '' },
    { k: 'date', l: 'Ordered', render: p => esc(fmtD(p.date)) },
    { k: 'expectedDate', l: 'Expected', render: p => `${esc(fmtD(p.expectedDate))}${(p.status === 'ordered' || p.status === 'partial') && p.expectedDate && p.expectedDate < TODAY() ? ' ' + pill('Late', 't-bad', 1) : ''}` },
    { k: 'items', l: 'Items', num: 1, render: p => num((p.lines || []).length), sort: p => (p.lines || []).length },
    { k: 'value', l: 'Total incl. GST', num: 1, cost: 1, render: p => inr(poTotals(p).total), sort: p => poTotals(p).total },
    { k: 'rec', l: 'Received', render: p => `<div class="mcell">${meter(poReceivedPct(p), poReceivedPct(p) >= 1 ? 'good' : '')}<span class="tnum">${pct(poReceivedPct(p), 0)}</span></div>${sum(p.lines || [], l => l.rejected) ? '<small class="neg">has rejects</small>' : ''}`, sort: p => poReceivedPct(p) },
    { k: 'bills', l: 'Bills', num: 1, render: p => { const b = S.pinvoices.filter(x => x.poId === p.id); return b.length ? num(b.length) : '<span class="muted">—</span>'; }, sort: p => S.pinvoices.filter(x => x.poId === p.id).length },
    { k: 'status', l: 'Status', render: p => pill((PO_STATUS.find(s => s[0] === p.status) || [, p.status])[1], PO_TONE2[p.status] || 't-neu') },
    { k: 'pdf', l: '', nosort: 1, render: p => btn('PDF', 'popdf:' + p.id, { sm: true, ghost: true, i: 'pdf' }) },
  ], rows, { select: can, key: p => p.id, sort: { k: 'date', dir: 'desc' }, open: p => 'open:po:' + p.id, empty: empty('No purchase orders here', 'Raise a PO to a vendor, download it as a PDF, then receive it in one click to add the stock.', can ? btn('New purchase order', 'new:po', { pri: true }) : '') }), { flush: true });
  return html;
}
Object.assign(ACT, { bulkdelpos() { bulkDelete('pos', selIds('pos'), 'inventory', p => `Purchase order ${p.number}${S.moves.some(m => m.poId === p.id) ? ' (with receipts)' : ''}`, null, 'pos'); } });

/* ---------- vendors ---------- */
const supBills = id => S.pinvoices.filter(b => b.supplierId === id);
const billPaid = b => sum(S.txns.filter(t => t.link && t.link.col === 'pinvoices' && t.link.id === b.id && t.type === 'out'), t => t.amount);
const pinvDue = b => Math.max(0, N(b.total) - billPaid(b));
const supBalance = id => { const bills = supBills(id); const billed = sum(bills, b => b.total); const paid = sum(S.txns.filter(t => t.type === 'out' && ((t.link && t.link.col === 'pinvoices' && bills.some(b => b.id === t.link.id)) || (t.link && t.link.col === 'suppliers' && t.link.id === id))), t => t.amount); return { billed, paid, due: billed - paid }; };
function invVendors() {
  const rows = S.suppliers.filter(s => matchQ('sup', s.name, s.contact, s.city, s.categories, s.gstin, s.phone)).map(s => { const ps = S.pos.filter(p => p.supplierId === s.id); const bal = supBalance(s.id); return { s, open: ps.filter(p => p.status === 'ordered' || p.status === 'partial').length, pos: ps.length, bal, last: ps.reduce((m, p) => p.date > m ? p.date : m, ''), rej: sum(ps, p => sum(p.lines || [], l => l.rejected)), rcv: sum(ps, p => sum(p.lines || [], l => l.received)) }; });
  const costs = allow('costs'); const due = sum(rows, x => Math.max(0, x.bal.due));
  let html = kpis([{ l: 'Vendors', v: num(S.suppliers.length) }, { l: 'Open POs', v: num(sum(rows, x => x.open)) }, { l: 'Payable to vendors', v: costs ? inrS(due) : '—', title: costs ? inr(due) : '', tone: due > 0 ? 'neg' : '' }, { l: 'Bills this month', v: num(S.pinvoices.filter(b => String(b.date || '').slice(0, 7) === TODAY().slice(0, 7)).length) }], 'k4');
  html += `<div class="toolbar">${searchHTML('sup', 'Search vendor, contact, city, GSTIN…')}</div>`;
  html += panel('', table('sups', [
    { k: 'name', l: 'Vendor', render: x => `<b>${esc(x.s.name)}</b>${delPill('suppliers', x.s.id)}${N(x.s.rating) ? ' ' + stars(x.s.rating) : ''}<br><small class="muted">${esc(x.s.categories || '')}</small>`, sort: x => x.s.name },
    { k: 'contact', l: 'Contact', render: x => `${esc(x.s.contact || '—')}<br><small class="muted">${esc([x.s.phone, x.s.email].filter(Boolean).join(' · '))}</small>`, sort: x => x.s.contact || '' },
    { k: 'loc', l: 'Location', render: x => esc([x.s.city, x.s.state].filter(Boolean).join(', ') || '—') },
    { k: 'terms', l: 'Terms', render: x => esc(x.s.terms || '—') + (x.s.leadTime ? `<br><small class="muted">${num(x.s.leadTime)} days lead</small>` : '') },
    { k: 'pos', l: 'POs', num: 1, render: x => `${num(x.pos)}${x.open ? `<br><small class="muted">${num(x.open)} open</small>` : ''}` },
    { k: 'rej', l: 'Reject rate', num: 1, render: x => x.rcv + x.rej ? pct(ratio(x.rej, x.rcv + x.rej), 1) : '—', sort: x => ratio(x.rej, x.rcv + x.rej) },
    { k: 'billed', l: 'Billed', num: 1, cost: 1, render: x => inr(x.bal.billed), sort: x => x.bal.billed },
    { k: 'due', l: 'Payable', num: 1, cost: 1, render: x => x.bal.due > 0.5 ? `<b class="neg">${inr(x.bal.due)}</b>` : '<span class="muted">—</span>', sort: x => x.bal.due },
    { k: 'docs', l: 'Docs', nosort: 1, render: x => linkA(x.s.driveLink, 'Drive', 'folder', 'lnk') || '<span class="muted">—</span>' },
  ], rows, { sort: { k: 'due', dir: 'desc' }, open: x => 'open:supplier:' + x.s.id, empty: empty('No vendors yet', 'Keep vendor contacts, GSTIN, bank details, payment terms and lead times in one place, then raise POs and record their bills.', canEdit('inventory') ? btn('Add vendor', 'new:supplier', { pri: true }) : '') }), { flush: true });
  return html;
}
EDIT.supplier = id => {
  const s = id ? supOf(id) : null; const can = canEdit('inventory'); const costs = allow('costs');
  const fD = [
    { n: 'name', l: 'Vendor name', req: 1, full: 1 }, { n: 'contact', l: 'Contact person' }, { n: 'phone', l: 'Phone', t: 'tel' }, { n: 'email', l: 'Email', t: 'email' }, { n: 'whatsapp', l: 'WhatsApp', t: 'tel' },
    { n: 'gstin', l: 'GSTIN', mono: 1, max: 15 }, { n: 'pan', l: 'PAN', mono: 1, max: 10 },
    { n: 'address', l: 'Address', t: 'textarea', rows: 2, full: 1 }, { n: 'city', l: 'City' }, { n: 'state', l: 'State', t: 'select', o: STATES, blank: 'Choose…' },
    { n: 'categories', l: 'Supplies', full: 1, ph: 'e.g. Veg-tan hides, chrome leather, threads' },
    { n: 'terms', l: 'Payment terms', t: 'select', o: ['Advance', 'On delivery', '7 days', '15 days', '30 days', '45 days', '60 days'] }, { n: 'leadTime', l: 'Lead time', t: 'number', min: 0, suf: 'days' },
    { n: 'rating', l: 'Your rating', t: 'select', num: 1, o: [[5, '★★★★★ Excellent'], [4, '★★★★ Good'], [3, '★★★ OK'], [2, '★★ Poor'], [1, '★ Avoid']], blank: 'Not rated' }, { n: 'status', l: 'Status', t: 'select', o: [['active', 'Active'], ['inactive', 'Inactive']] },
  ];
  const fB = [{ n: 'bankName', l: 'Bank' }, { n: 'bankAcc', l: 'Account number', mono: 1 }, { n: 'ifsc', l: 'IFSC', mono: 1, max: 11 }, { n: 'upi', l: 'UPI id', mono: 1 }, { n: 'driveLink', l: 'Drive folder for their documents', full: 1, ph: 'https://drive.google.com/…', help: 'Quotes, price lists, agreements, KYC.' }, { n: 'notes', l: 'Notes', t: 'textarea', rows: 3, full: 1 }];
  const pos = s ? S.pos.filter(p => p.supplierId === id).sort((a, b) => a.date < b.date ? 1 : -1) : []; const bills = s ? supBills(id).sort((a, b) => a.date < b.date ? 1 : -1) : [];
  const tabs = [{ l: 'Details', html: form(fD, s || { terms: '30 days', status: 'active' }) }, { l: 'Bank & documents', html: form(fB, s || {}) }];
  if (s) {
    tabs.push({ l: `POs (${pos.length})`, html: pos.length ? table('suppos', [{ k: 'number', l: 'PO', render: p => `<b class="mono">${esc(p.number)}</b>` }, { k: 'date', l: 'Date', render: p => esc(fmtD(p.date)) }, { k: 'v', l: 'Total', num: 1, cost: 1, render: p => inr(poTotals(p).total) }, { k: 'r', l: 'Received', render: p => pct(poReceivedPct(p), 0) }, { k: 'st', l: 'Status', render: p => pill((PO_STATUS.find(x => x[0] === p.status) || [, p.status])[1], PO_TONE2[p.status]) }], pos, { open: p => 'open:po:' + p.id }) : empty('No purchase orders', 'Raise one from Inventory › Purchase orders.') });
    if (costs) { const bal = supBalance(id); const pays = S.txns.filter(t => t.type === 'out' && ((t.link && t.link.col === 'suppliers' && t.link.id === id) || (t.link && t.link.col === 'pinvoices' && bills.some(b => b.id === t.link.id)))); const led = [...bills.map(b => ({ d: b.date, t: 'Bill ' + (b.number || ''), dr: 0, cr: N(b.total), id: b.id, k: 'b' })), ...pays.map(t => ({ d: t.date, t: 'Payment' + (t.ref ? ' · ' + t.ref : ''), dr: N(t.amount), cr: 0, k: 'p' }))].sort((a, b) => a.d < b.d ? -1 : 1); let run = 0; led.forEach(x => { run += x.cr - x.dr; x.bal = run; });
      tabs.push({ l: 'Bills & ledger', html: kvHTML([['Billed', inr(bal.billed)], ['Paid', inr(bal.paid)], ['Payable', `<span class="${bal.due > 0.5 ? 'neg' : ''}">${inr(bal.due)}</span>`], ['Bills', num(bills.length)]]) + (led.length ? `<div class="tw"><table class="t"><thead><tr><th>Date</th><th>Entry</th><th class="num">Bill</th><th class="num">Paid</th><th class="num">Balance</th></tr></thead><tbody>${led.map(x => `<tr${x.k === 'b' ? ` class="click" data-act="open:pinvoice:${x.id}"` : ''}><td>${esc(fmtD(x.d))}</td><td>${esc(x.t)}</td><td class="num">${x.cr ? inr(x.cr) : ''}</td><td class="num">${x.dr ? inr(x.dr) : ''}</td><td class="num"><b>${inr(x.bal)}</b></td></tr>`).join('')}</tbody></table></div>` : empty('No bills yet', 'Add purchase invoices from Inventory › Purchase invoices.')) + (canEdit('finance') || canEdit('inventory') ? `<div style="margin-top:12px;display:flex;gap:8px">${btn('Add bill', 'supbill:' + id, { sm: true, i: 'plus' })}${btn('Record payment', 'suppay:' + id, { sm: true, i: 'wallet' })}</div>` : '') }); }
  }
  openDrawer({
    title: s ? s.name : 'New vendor', sub: s ? `${num(pos.length)} purchase orders · ${num(bills.length)} bills${s.gstin ? ' · GSTIN ' + esc(s.gstin) : ''}` : 'Vendors you buy stock and materials from.', readOnly: !can, delKey: 'suppliers/' + id, wide: !!s, tabs,
    footExtra: s ? [s.email ? `<a class="btn" href="${esc(gmailCompose(s.email, '', ''))}" target="_blank" rel="noopener">${icon('mail')}Email</a>` : '', s.email ? `<a class="btn ghost" href="https://mail.google.com/mail/u/0/#search/${encodeURIComponent('from:' + s.email + ' OR to:' + s.email)}" target="_blank" rel="noopener">${icon('search')}Gmail history</a>` : '', linkA(s.driveLink, 'Drive', 'folder', 'btn ghost')].join('') : '',
    validate: v => { const e = urlErr(v, ['driveLink']); if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) e.push({ n: 'email', m: 'That email doesn’t look right.' }); if (v.gstin && !/^[0-9A-Z]{15}$/i.test(v.gstin)) e.push({ n: 'gstin', m: 'GSTIN has 15 letters and digits.' }); if (S.suppliers.some(x => x.id !== id && String(x.name).trim().toLowerCase() === String(v.name).trim().toLowerCase())) e.push({ n: 'name', m: 'A vendor with this name exists.' }); return e; },
    onSave: async v => { await saveDoc('suppliers', id, { ...base(s), ...v, gstin: String(v.gstin || '').toUpperCase(), pan: String(v.pan || '').toUpperCase(), ifsc: String(v.ifsc || '').toUpperCase(), driveLink: safeURL(v.driveLink) || null }, ['inventory', 'Vendor ' + v.name]); },
    onDelete: s ? delFn('suppliers', id, 'inventory', 'Vendor ' + s.name, () => pos.some(p => p.status === 'ordered' || p.status === 'partial') ? 'This vendor has open purchase orders. Close or cancel them first.' : bills.length ? 'This vendor has bills recorded. Mark them Inactive instead.' : '') : null,
  });
};
Object.assign(ACT, { supbill(id) { closeDrawer(); setTimeout(() => EDIT.pinvoice(null, { supplierId: id }), 230); }, suppay(id) { closeDrawer(); setTimeout(() => EDIT.vpay(null, { supplierId: id }), 230); } });

/* ---------- purchase invoices (bills) ---------- */
const canPurch = () => canEdit('inventory') || canEdit('finance');
const purchSet = () => Object.assign({ driveRoot: '', months: {}, gmailQuery: 'invoice OR bill OR "tax invoice"', terms: '', shipTo: '' }, S.settings.purchase || {});
const monthGmail = (m, q) => { const [y, mo] = m.split('-').map(Number); const a = `${y}/${pad(mo)}/01`; const nx = new Date(y, mo, 1); const b = `${nx.getFullYear()}/${pad(nx.getMonth() + 1)}/01`; return 'https://mail.google.com/mail/u/0/#search/' + encodeURIComponent(`(${q || 'invoice'}) has:attachment after:${a} before:${b}`); };
function invInvoices() {
  const ps = purchSet(); const costs = allow('costs'); const months = monthsBack(12).reverse(); const m = ui.filt.pim && /^\d{4}-\d{2}$/.test(ui.filt.pim) ? ui.filt.pim : 'all';
  const all = S.pinvoices.slice(); const rows = all.filter(b => (m === 'all' || String(b.date || '').slice(0, 7) === m) && matchQ('pinv', b.number, (supOf(b.supplierId) || {}).name, b.notes));
  const due = sum(all, pinvDue); const od = all.filter(b => pinvDue(b) > 0.5 && b.dueDate && b.dueDate < TODAY());
  let html = kpis([{ l: 'Bills recorded', v: num(all.length), s: num(all.filter(b => b.fileId).length) + ' with the file attached' }, { l: 'Unpaid', v: costs ? inrS(due) : num(all.filter(b => pinvDue(b) > 0.5).length), title: costs ? inr(due) : '', tone: due > 0 ? 'neg' : '' }, { l: 'Overdue', v: num(od.length), tone: od.length ? 'neg' : '', s: od.length && costs ? inrS(sum(od, pinvDue)) : 'none overdue' }, { l: 'GST input this month', v: costs ? inrS(sum(all.filter(b => String(b.date || '').slice(0, 7) === TODAY().slice(0, 7)), b => b.gst)) : '—' }], 'k4');
  const mk = m === 'all' ? TODAY().slice(0, 7) : m; const mLink = (ps.months || {})[mk];
  html += `<div class="callout mfold"><div class="grow"><b>${esc(monthLabel(mk))} bills</b><span>Keep the month’s bill PDFs in one Drive folder and find vendor emails in Gmail.</span></div>${mLink ? linkA(mLink, 'Drive folder for ' + monthLabel(mk), 'folder', 'btn') : (canEdit('inventory') || canEdit('finance') ? btn('Set Drive folder for ' + monthLabel(mk), 'pimonth:' + mk, { i: 'folder' }) : '')}${linkA(ps.driveRoot, 'All bills', 'folder', 'btn ghost')}<a class="btn ghost" href="${esc(monthGmail(mk, ps.gmailQuery))}" target="_blank" rel="noopener">${icon('mail')}Gmail: ${esc(monthLabel(mk))} bills</a></div>`;
  html += `<div class="toolbar">${searchHTML('pinv', 'Search bill number, vendor…')}<label class="sr" for="pim">Month</label><select class="inp" id="pim" data-ch="filtsel" data-key="pim" style="width:auto"><option value="all">All months</option>${months.map(k => `<option value="${k}"${m === k ? ' selected' : ''}>${esc(monthLabel(k))}</option>`).join('')}</select></div>`;
  html += panel('', table('pinv', [
    { k: 'date', l: 'Date', render: b => `<span class="tnum">${esc(fmtD(b.date))}</span>` },
    { k: 'number', l: 'Bill', render: b => `<b class="mono">${esc(b.number || '—')}</b>${delPill('pinvoices', b.id)}${b.poId ? `<br><small class="muted">${esc((S.pos.find(p => p.id === b.poId) || {}).number || '')}</small>` : ''}` },
    { k: 'sup', l: 'Vendor', render: b => esc((supOf(b.supplierId) || {}).name || b.vendorName || '—'), sort: b => (supOf(b.supplierId) || {}).name || '' },
    { k: 'total', l: 'Total', num: 1, cost: 1, render: b => `${inr(b.total)}<br><small class="muted">GST ${inr(b.gst)}</small>`, sort: b => N(b.total) },
    { k: 'due', l: 'Balance', num: 1, cost: 1, render: b => { const d = pinvDue(b); return d > 0.5 ? `<b class="${b.dueDate && b.dueDate < TODAY() ? 'neg' : ''}">${inr(d)}</b>${b.dueDate ? `<br><small class="muted">due ${esc(fmtDs(b.dueDate))}</small>` : ''}` : pill('Paid', 't-good', 1); }, sort: b => pinvDue(b) },
    { k: 'file', l: 'Bill copy', nosort: 1, render: b => [b.fileId ? `<a class="lnk" href="${fileURL(b.fileId)}" target="_blank" rel="noopener">${icon('pdf')}File</a>` : '', linkA(b.driveLink, 'Drive', 'folder', 'lnk'), linkA(b.gmailLink, 'Email', 'mail', 'lnk')].filter(Boolean).join(' ') || '<span class="muted">—</span>' },
  ], rows, { sort: { k: 'date', dir: 'desc' }, open: b => 'open:pinvoice:' + b.id, empty: empty('No bills here', 'Record each vendor bill with its PDF or photo, Drive link or Gmail link, so purchase GST and payables stay complete.', canEdit('inventory') || canEdit('finance') ? btn('Add purchase invoice', 'new:pinvoice', { pri: true }) : '') }), { flush: true });
  return html;
}
EDIT.pinvoice = (id, preset = {}) => {
  const b = id ? S.pinvoices.find(x => x.id === id) : null; const can = canEdit('inventory') || canEdit('finance');
  const po0 = preset.poId ? S.pos.find(p => p.id === preset.poId) : null;
  const v0 = b || { date: TODAY(), supplierId: preset.supplierId || (po0 && po0.supplierId) || '', poId: preset.poId || '', taxable: po0 ? Math.round(poValue(po0) * 100) / 100 : null, gst: po0 ? Math.round(poGST(po0) * 100) / 100 : null, ...preset };
  const f = [
    { n: 'supplierId', l: 'Vendor', t: 'select', req: 1, o: () => S.suppliers.map(s => [s.id, s.name]), blank: 'Choose…' }, { n: 'number', l: 'Bill / invoice number', mono: 1, req: 1 },
    { n: 'date', l: 'Bill date', t: 'date', req: 1 }, { n: 'dueDate', l: 'Due date', t: 'date', help: 'Blank uses the vendor’s payment terms.' },
    { n: 'poId', l: 'Against PO', t: 'select', o: () => S.pos.slice().sort((a, c) => a.date < c.date ? 1 : -1).map(p => [p.id, p.number + ' · ' + ((supOf(p.supplierId) || {}).name || '')]), blank: 'No PO' }, { n: 'category', l: 'Type', t: 'select', o: [['stock', 'Stock / raw material'], ['expense', 'Expense (not stock)'], ['asset', 'Asset']] },
    { n: 'taxable', l: 'Taxable value', t: 'money', min: 0, req: 1 }, { n: 'gst', l: 'GST', t: 'money', min: 0 },
    { raw: `<div class="fld full"><label for="pinvFile">Bill copy (PDF or photo)</label>${b && b.fileId ? `<div class="filerow">${icon('pdf')}<a href="${fileURL(b.fileId)}" target="_blank" rel="noopener">${esc((fileOf(b.fileId) || {}).name || 'Uploaded bill')}</a><span class="muted">${esc(fmtBytes((fileOf(b.fileId) || {}).size || 0))}</span></div>` : ''}<input class="inp" type="file" id="pinvFile" accept="application/pdf,image/*"${can ? '' : ' disabled'}><div class="help">Up to 25 MB. Stored on your server with the bill.</div></div>` },
    { n: 'driveLink', l: 'Drive link', full: 1, ph: 'https://drive.google.com/file/…', help: 'If the bill already lives in Drive.' }, { n: 'gmailLink', l: 'Gmail link', full: 1, ph: 'https://mail.google.com/mail/u/0/#inbox/…', help: 'Open the vendor’s email in Gmail and copy the address bar.' },
    { n: 'notes', l: 'Notes', t: 'textarea', rows: 2, full: 1 },
  ];
  const paid = b ? billPaid(b) : 0; const pays = b ? S.txns.filter(t => t.link && t.link.col === 'pinvoices' && t.link.id === b.id) : [];
  openDrawer({
    title: b ? 'Bill ' + (b.number || '') : 'Add purchase invoice', sub: b ? `${esc((supOf(b.supplierId) || {}).name || '')} · ${esc(fmtD(b.date))}` : 'A vendor bill. It counts towards purchase GST and what you owe the vendor.', readOnly: !can, delKey: 'pinvoices/' + id,
    top: b ? kvHTML([['Total', inr(b.total)], ['Paid', inr(paid)], ['Balance', `<span class="${pinvDue(b) > 0.5 ? 'neg' : ''}">${inr(pinvDue(b))}</span>`], ['Payments', num(pays.length)]]) : '',
    html: form(f, v0), footExtra: b && pinvDue(b) > 0.5 && can ? btn('Record payment', 'pinvpay:' + b.id, { i: 'wallet' }) : '',
    validate: v => { const e = urlErr(v, ['driveLink', 'gmailLink']); if (N(v.taxable) <= 0) e.push({ n: 'taxable', m: 'Enter the taxable value.' }); if (S.pinvoices.some(x => x.id !== id && x.supplierId === v.supplierId && String(x.number).trim().toLowerCase() === String(v.number).trim().toLowerCase())) e.push({ n: 'number', m: 'This vendor’s bill with this number is already recorded.' }); return e; },
    onSave: async v => {
      const s = supOf(v.supplierId) || {}; const days = (String(s.terms || '').match(/(\d+)\s*days/) || [])[1]; const dueDate = v.dueDate || (days ? addDays(v.date, +days) : v.date);
      const bid = id || newId('pinvoices'); let fileId = b ? b.fileId || null : null; const fi = $('#pinvFile');
      if (fi && fi.files && fi.files[0]) { toast('Uploading the bill…'); const up = await uploadFile(fi.files[0], { col: 'pinvoices', docId: bid }); fileId = up.id; }
      await saveDoc('pinvoices', id || bid, { ...base(b), ...v, poId: v.poId || null, dueDate, total: Math.round((N(v.taxable) + N(v.gst)) * 100) / 100, fileId, driveLink: safeURL(v.driveLink) || null, gmailLink: safeURL(v.gmailLink) || null }, ['inventory', `Purchase bill ${v.number} · ${s.name || ''} · ${inr(N(v.taxable) + N(v.gst))}`]);
    },
    onDelete: b ? delFn('pinvoices', id, 'inventory', `Purchase bill ${b.number} · ${(supOf(b.supplierId) || {}).name || ''}`, () => pays.length ? 'Payments are recorded against this bill. Delete them in Finance › Accounts first.' : '') : null,
  });
};
// vendor payment = money out of an account, linked to a bill or the vendor
EDIT.vpay = (id, preset = {}) => {
  const bill = preset.billId ? S.pinvoices.find(b => b.id === preset.billId) : null; const sid = preset.supplierId || (bill && bill.supplierId);
  const bills = S.pinvoices.filter(b => b.supplierId === sid && pinvDue(b) > 0.5);
  openDrawer({
    title: 'Pay ' + ((supOf(sid) || {}).name || 'vendor'), sub: 'Records money paid out from one of your accounts.', saveLabel: 'Record payment',
    html: form([{ n: 'billId', l: 'Against bill', t: 'select', o: bills.map(b => [b.id, `${b.number} · ${inr(pinvDue(b))} due`]), blank: 'On account (no bill)' }, { n: 'amount', l: 'Amount paid', t: 'money', req: 1, min: 0 }, { n: 'date', l: 'Date', t: 'date', req: 1 }, { n: 'accountId', l: 'Paid from', t: 'select', o: () => S.accounts.filter(a => a.active !== false).map(a => [a.id, a.name]), blank: S.accounts.length ? 'Choose…' : 'Add an account in Finance first' }, { n: 'mode', l: 'Mode', t: 'select', o: ['Bank transfer', 'UPI', 'Cheque', 'Cash', 'Card'] }, { n: 'ref', l: 'UTR / cheque number', mono: 1 }, { n: 'note', l: 'Note', full: 1 }], { billId: bill ? bill.id : (bills[0] || {}).id || '', amount: bill ? Math.round(pinvDue(bill) * 100) / 100 : (bills[0] ? Math.round(pinvDue(bills[0]) * 100) / 100 : null), date: TODAY(), mode: 'Bank transfer', accountId: (S.accounts.find(a => a.active !== false) || {}).id || '' }),
    validate: v => N(v.amount) <= 0 ? [{ n: 'amount', m: 'Enter the amount paid.' }] : [],
    onSave: async v => { const link = v.billId ? { col: 'pinvoices', id: v.billId } : { col: 'suppliers', id: sid }; await saveDoc('txns', null, { date: v.date, type: 'out', accountId: v.accountId || null, amount: N(v.amount), category: 'vendor_payment', link, supplierId: sid, mode: v.mode, ref: v.ref, note: v.note }, ['inventory', `Paid ${(supOf(sid) || {}).name || 'vendor'} ${inr(v.amount)}${v.billId ? ' for bill ' + ((S.pinvoices.find(b => b.id === v.billId) || {}).number || '') : ''}`]); },
  });
};
Object.assign(ACT, {
  pinvpay(id) { closeDrawer(); setTimeout(() => EDIT.vpay(null, { billId: id }), 230); },
  pimonth(m) { purchMonth(m); }, purchset() { purchSettings(); },
});
function purchMonth(m) {
  const ps = purchSet();
  openDrawer({ title: 'Drive folder for ' + monthLabel(m), sub: 'Paste the link to the Google Drive folder that holds this month’s bills.', html: form([{ n: 'link', l: 'Folder link', full: 1, req: 1, ph: 'https://drive.google.com/drive/folders/…' }], { link: (ps.months || {})[m] || '' }),
    validate: v => urlErr(v, ['link']),
    onSave: async v => { await dbWrite('set', 'settings/purchase', clean({ ...ps, months: { ...(ps.months || {}), [m]: safeURL(v.link) }, updatedAt: nowISO(), updatedBy: ME.id })); addLog('settings', 'inventory', `Drive folder set for ${monthLabel(m)} bills`); } });
}
function purchSettings() {
  const ps = purchSet(); const ms = monthsBack(6).reverse();
  openDrawer({ title: 'Purchase settings', sub: 'Defaults for purchase orders, and where bills are kept.', readOnly: !canPurch(),
    html: form([{ n: 'driveRoot', l: 'Drive folder with all bills', full: 1, ph: 'https://drive.google.com/drive/folders/…' }, { n: 'gmailQuery', l: 'Gmail search words for bills', full: 1, help: 'Used for the “Gmail: month bills” button, e.g. invoice OR bill OR "tax invoice".' }, { raw: '<div class="subh" style="margin:4px 0 0">Monthly bill folders</div>' }, ...ms.map(k => ({ n: 'months.' + k, l: monthLabel(k), ph: 'https://drive.google.com/drive/folders/…' })), { raw: '<div class="subh" style="margin:4px 0 0">Purchase order defaults</div>' }, { n: 'terms', l: 'Terms printed on new POs', t: 'textarea', rows: 3, full: 1 }, { n: 'shipTo', l: 'Default delivery address', t: 'textarea', rows: 2, full: 1 }], ps),
    validate: v => urlErr(v, ['driveRoot', ...ms.map(k => 'months.' + k)]),
    onSave: async v => { const months = { ...(ps.months || {}) }; for (const k of ms) { const x = safeURL(getPath(v, 'months.' + k)); if (x) months[k] = x; else delete months[k]; } await dbWrite('set', 'settings/purchase', clean({ ...ps, driveRoot: safeURL(v.driveRoot), gmailQuery: v.gmailQuery, terms: v.terms, shipTo: v.shipTo, months, updatedAt: nowISO(), updatedBy: ME.id })); addLog('settings', 'inventory', 'Purchase settings updated'); } });
}
