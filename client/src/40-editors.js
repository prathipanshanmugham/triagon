/* =====================================================================
   Editors (drawers) for every record type
   ===================================================================== */
const prodOpts = () => S.products.filter(p => inBrand(p) && p.status !== 'archived').sort((a, b) => (a.name > b.name ? 1 : -1)).map(p => [p.id, (p.sku ? p.sku + ' · ' : '') + p.name]);
const brandOpts = () => myBrands().map(b => [b.id, b.name]);
const platOpts = cur => platforms().filter(p => p.on !== false || p.key === cur).map(p => [p.key, p.name]);
const memberOpts = () => liveMembers().map(m => [m.id, personName(m.id)]);
function nextSku(brandId) { const b = brandOf(brandId); const code = ((b && b.code) || 'SKU').toUpperCase(); let max = 0; S.products.forEach(p => { const m = String(p.sku || '').match(new RegExp('^' + code + '-(\\d+)$')); if (m) max = Math.max(max, +m[1]); }); return code + '-' + String(max + 1).padStart(4, '0'); }
function nextNum(list, field, prefix) { let max = 0; list.forEach(x => { const m = String(x[field] || '').match(new RegExp('^' + prefix.replace(/[-/]/g, '\\$&') + '(\\d+)$')); if (m) max = Math.max(max, +m[1]); }); return prefix + String(max + 1).padStart(4, '0'); }
const fyShort = () => { const d = parseD(TODAY()); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return String(y).slice(2) + String(y + 1).slice(2); };
const kvHTML = items => `<div class="kv">${items.map(([l, v]) => `<div><span>${esc(l)}</span><b>${v}</b></div>`).join('')}</div>`;
const delFn = (col, id, mod, lbl, guard) => async reason => { if (guard) { const g = guard(); if (g) { toast(g, 'bad'); return false; } } return deleteRecord(col, id, mod, lbl, reason); };
const EDIT = {};

/* ---------- brand ---------- */
EDIT.brand = id => {
  const b = id ? brandOf(id) : null; const can = canEdit('brands');
  const used = new Set(S.brands.map(x => x.color)); const nextColor = SWATCHES.find(s => !used.has(s)) || 'c1';
  const f1 = [
    { n: 'name', l: 'Brand name', req: 1, ph: 'e.g. Linkcraft' },
    { n: 'code', l: 'Brand code', req: 1, mono: 1, max: 5, ph: 'e.g. LNK', help: '2–5 letters or digits. Prefixes this brand’s SKUs.' },
    { n: 'category', l: 'Category', t: 'select', o: BRAND_CATS },
    { n: 'status', l: 'Status', t: 'select', o: ['Active', 'Launching', 'Paused', 'Discontinued'] },
    { n: 'tagline', l: 'Tagline', full: 1, ph: 'One line on what the brand stands for' },
    { n: 'color', l: 'Brand colour', t: 'swatch', full: 1 },
    { n: 'launchDate', l: 'Launch date', t: 'date' },
    { n: 'managerId', l: 'Brand lead', t: 'select', o: memberOpts, blank: 'No lead yet' },
  ];
  const f2 = [
    { n: 'tmStatus', l: 'Trademark status', t: 'select', o: ['Not filed', 'Filed', 'Objected', 'Accepted', 'Registered'] },
    { n: 'tmClass', l: 'Trademark class', ph: 'e.g. 14', help: 'Class 14 covers jewellery and watches, 25 clothing and footwear, 18 bags.' },
    { n: 'tmApp', l: 'Application number', mono: 1, full: 1 }, { n: 'notes', l: 'Notes', t: 'textarea', full: 1 },
  ];
  const nP = b ? S.products.filter(p => p.brandId === id).length : 0;
  openDrawer({
    title: b ? b.name : 'New brand', sub: b ? `${num(nP)} products · code ${esc(b.code || '—')}` : 'Brands group products, campaigns and reports.', readOnly: !can, delKey: 'brands/' + id,
    tabs: [{ l: 'Brand', html: form(f1, b || { status: 'Active', color: nextColor, category: BRAND_CATS[0] }) }, { l: 'Trademark & notes', html: form(f2, b || { tmStatus: 'Not filed' }) }],
    validate: v => { const e = []; const code = String(v.code || '').toUpperCase(); if (code && !/^[A-Z0-9]{2,5}$/.test(code)) e.push({ n: 'code', m: 'Use 2–5 letters or digits.' }); if (code && S.brands.some(x => x.id !== id && String(x.code || '').toUpperCase() === code)) e.push({ n: 'code', m: 'Another brand already uses this code.' }); return e; },
    onSave: async v => { v.code = v.code.toUpperCase(); await saveDoc('brands', id, { ...base(b), ...v }, ['brands', 'Brand ' + v.name]); },
    onDelete: b ? delFn('brands', id, 'brands', 'Brand ' + b.name, () => nP ? `Move or delete this brand’s ${nP} products first.` : '') : null,
  });
};

/* ---------- product ---------- */
EDIT.product = (id, preset = {}) => {
  const p = id ? prodOf(id) : null; const can = canEdit('catalogue'); const costs = allow('costs');
  if (!S.brands.length) { toast('Add a brand first.', 'bad'); return; }
  const v0 = p || { status: 'active', gstRate: 18, reorderLevel: 10, brandId: (ui.brand !== 'all' ? ui.brand : (myBrands()[0] || {}).id), ...preset };
  const fD = [
    { n: 'name', l: 'Product name', req: 1, full: 1, ph: 'e.g. Stainless steel mesh watch bracelet 22 mm' },
    { n: 'brandId', l: 'Brand', t: 'select', req: 1, o: brandOpts },
    { n: 'sku', l: 'SKU', mono: 1, ph: 'Leave blank to auto-number', help: p ? '' : 'Auto format: BRANDCODE-0001' },
    { n: 'category', l: 'Category', t: 'select', o: PROD_CATS, blank: 'Choose…' }, { n: 'variant', l: 'Variant', ph: 'e.g. Black / 22 mm' },
    { n: 'hsn', l: 'HSN code', mono: 1, ph: 'e.g. 9113' }, { n: 'gstRate', l: 'GST rate', t: 'select', num: 1, o: GST_RATES.map(g => [g, g + '%']) },
    { n: 'weight', l: 'Shipping weight', t: 'number', suf: 'g', min: 0, help: 'Packed weight, used for shipping slabs.' },
    { n: 'status', l: 'Status', t: 'select', o: [['active', 'Active'], ['draft', 'Draft'], ['archived', 'Archived']] },
  ];
  const on = p ? stockMap()[p.id] || 0 : 0;
  const fP = [
    { n: 'mrp', l: 'MRP', t: 'money', min: 0 }, { n: 'sellingPrice', l: 'Selling price (incl. GST)', t: 'money', req: 1, min: 0 },
    { n: 'costPrice', l: 'Cost price (ex-GST)', t: 'money', min: 0, help: 'Landed cost per unit. Receiving purchase orders updates it as a weighted average.', hide: !costs },
    { n: 'packagingCost', l: 'Packaging per unit', t: 'money', min: 0 },
    { n: 'openingStock', l: 'Opening stock', t: 'number', min: 0, help: p ? `On hand now: ${num(on)}. Change stock through Inventory, not here.` : 'Units on hand when you start tracking.' },
    { n: 'reorderLevel', l: 'Reorder level', t: 'number', min: 0, help: 'Flagged as low stock at or below this.' },
    { n: 'supplierId', l: 'Preferred supplier', t: 'select', o: () => S.suppliers.map(s => [s.id, s.name]), blank: 'None' },
    { n: 'location', l: 'Storage location', ph: 'e.g. Salem warehouse · Rack A3' },
  ];
  const cs = p ? contentScore(p) : null;
  const fC = [
    { raw: cs ? `<div class="score"><div class="big tnum">${cs.score}</div><ul>${cs.checks.map(c => `<li class="${c[1] ? 'ok' : 'no'}">${c[1] ? '✓' : '○'} ${esc(c[0])}</li>`).join('')}</ul></div>` : '<p class="muted" style="margin:0">A content score appears after you save, based on the fields below.</p>' },
    { n: 'title', l: 'Marketplace title', t: 'textarea', rows: 2, full: 1, help: 'Brand + product + key attributes. Aim for 80–150 characters.' },
    { n: 'bullets', l: 'Bullet points', t: 'textarea', rows: 5, full: 1, help: 'One per line. Lead each with the benefit.' },
    { n: 'description', l: 'Description', t: 'textarea', rows: 5, full: 1 }, { n: 'keywords', l: 'Search keywords', full: 1, help: 'Comma-separated back-end search terms.' },
    { n: 'images', l: 'Images ready', t: 'number', min: 0, help: 'Main image plus gallery shots that meet platform specs.' },
  ];
  const lst = (p && p.listings) || {}; const pls = platforms().filter(x => x.on !== false || lst[x.key]); const dis = can ? '' : ' disabled';
  const listingHTML = `<p class="muted" style="margin:0 0 6px">Track where this product is live and the listing ID on each platform. A platform price overrides the selling price in the calculator and sales entries.</p><div class="lrow" style="font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)"><span>Platform</span><span>Status</span><span>Listing ID</span><span>Price</span></div>${pls.map(pl => { const l = lst[pl.key] || {}; return `<div class="lrow"><b>${esc(pl.name)}</b><select class="inp" name="listings.${pl.key}.status" data-t="str" aria-label="${esc(pl.name)} status"${dis}>${LIST_STATUS.map(([k, t]) => `<option value="${k}"${(l.status || 'none') === k ? ' selected' : ''}>${t}</option>`).join('')}</select><input class="inp mono" name="listings.${pl.key}.id" data-t="str" value="${esc(l.id || '')}" placeholder="${esc(pl.idLabel || 'Listing ID')}" aria-label="${esc(pl.name)} ${esc(pl.idLabel || 'listing ID')}"${dis}><div class="affix hp"><span class="pre">₹</span><input class="inp tnum" type="number" step="any" name="listings.${pl.key}.price" data-t="num" value="${esc(l.price ?? '')}" placeholder="Same" aria-label="${esc(pl.name)} price"${dis}></div></div>`; }).join('')}`;
  openDrawer({
    title: p ? p.name : 'New product', sub: p ? `${esc(p.sku || '')} · ${esc(brandName(p.brandId))} · ${num(on)} on hand` : 'Add the essentials now; content and listings can follow.', readOnly: !can, delKey: 'products/' + id,
    tabs: [{ l: 'Details', html: form(fD, v0) }, { l: 'Pricing & stock', html: form(fP, v0) }, { l: 'Content', html: form(fC, v0) }, { l: 'Listings', html: listingHTML }],
    validate: v => { const e = []; const sku = String(v.sku || '').trim(); if (sku && S.products.some(x => x.id !== id && String(x.sku || '').toLowerCase() === sku.toLowerCase())) e.push({ n: 'sku', m: 'Another product already uses this SKU.' }); if (N(v.sellingPrice) <= 0) e.push({ n: 'sellingPrice', m: 'Enter a price above zero.' }); if (v.mrp && N(v.mrp) < N(v.sellingPrice)) e.push({ n: 'mrp', m: 'MRP can’t be below the selling price.' }); return e; },
    onSave: async v => {
      if (!v.sku) v.sku = nextSku(v.brandId); v.sku = v.sku.toUpperCase();
      const listings = { ...((p && p.listings) || {}) }; for (const k in (v.listings || {})) { const l = v.listings[k]; listings[k] = { status: l.status || 'none', id: l.id || '', price: l.price ?? null }; }
      await saveDoc('products', id, { ...base(p), ...v, supplierId: v.supplierId || null, listings }, ['catalogue', `Product ${v.sku} · ${v.name}`]);
    },
    onDelete: p ? delFn('products', id, 'catalogue', `Product ${p.sku} · ${p.name}`, () => { const n = S.sales.filter(s => s.productId === id).length; return n ? `This product has ${n} sales entries. Archive it instead so your history stays intact.` : ''; }) : null,
  });
};

/* ---------- stock movement ---------- */
EDIT.move = (id, preset = {}) => {
  const m = id ? S.moves.find(x => x.id === id) : null; const can = canEdit('inventory') && !(m && m.poId); const costs = allow('costs');
  if (!S.products.length) { toast('Add products in the Catalogue first.', 'bad'); return; }
  const v0 = m ? { ...m, qty: m.entered ?? Math.abs(N(m.qty)) } : { type: 'purchase', date: TODAY(), updateCost: true, ...preset };
  const p0 = prodOf(v0.productId);
  const f = [
    { n: 'productId', l: 'Product', t: 'select', req: 1, full: 1, o: prodOpts, blank: 'Choose a product…' },
    { n: 'type', l: 'Movement', t: 'select', req: 1, o: MOVE_TYPES.map(x => [x[0], x[1]]) },
    { n: 'qty', l: 'Quantity', t: 'number', req: 1, min: 0, step: 1, help: 'For a physical count, enter the units you counted.' },
    { n: 'date', l: 'Date', t: 'date', req: 1 },
    { n: 'unitCost', l: 'Unit cost (ex-GST)', t: 'money', min: 0, help: 'For purchases.', hide: !costs },
    { n: 'updateCost', l: '', t: 'check', cl: 'Recalculate the product’s cost price as a weighted average', full: 1, hide: !costs || !!m },
    { n: 'supplier', l: 'Supplier' }, { n: 'ref', l: 'Reference', ph: 'Invoice or GRN number', mono: 1 },
    { n: 'note', l: 'Note', t: 'textarea', rows: 2, full: 1 },
  ];
  openDrawer({
    title: m ? (m.poId ? 'Purchase order receipt' : 'Stock movement') : 'Record stock movement', sub: m && m.poId ? 'Created by receiving a purchase order. Change it through the PO.' : p0 ? `${esc(p0.name)} · ${num(stockMap()[p0.id] || 0)} on hand now` : 'Adjustments, write-offs, returns and physical counts. Use purchase orders for supplier deliveries.', readOnly: !can, delKey: 'moves/' + id,
    html: form(f, v0),
    validate: v => (N(v.qty) <= 0 && v.type !== 'count') ? [{ n: 'qty', m: 'Enter a quantity above zero.' }] : [],
    onSave: async v => {
      const p = prodOf(v.productId); const sign = (MOVE_TYPES.find(x => x[0] === v.type) || [, , 1])[2];
      const curExcl = (stockMap()[v.productId] || 0) - (m && m.productId === v.productId ? N(m.qty) : 0);
      const qty = v.type === 'count' ? Math.round(N(v.qty) - curExcl) : sign * Math.abs(Math.round(N(v.qty)));
      await saveDoc('moves', id, { ...base(m), productId: v.productId, brandId: p && p.brandId, type: v.type, qty, entered: N(v.qty), date: v.date, unitCost: v.unitCost ?? (m && m.unitCost) ?? null, supplier: v.supplier, ref: v.ref, note: v.note }, ['inventory', `${(MOVE_TYPES.find(x => x[0] === v.type) || [, v.type])[1]}: ${qty > 0 ? '+' : ''}${qty} × ${p ? p.sku : ''}`]);
      if (v.type === 'purchase' && v.updateCost && N(v.unitCost) > 0 && p && !m) {
        const cur = Math.max(0, curExcl); const nc = cur + qty > 0 ? (cur * N(p.costPrice) + qty * N(v.unitCost)) / (cur + qty) : N(v.unitCost);
        await saveDoc('products', p.id, { ...base(p), costPrice: Math.round(nc * 100) / 100 }, ['catalogue', `Cost price of ${p.sku} recalculated`]);
      }
    },
    onDelete: m && !m.poId ? delFn('moves', id, 'inventory', `Stock movement ${N(m.qty) > 0 ? '+' : ''}${m.qty} × ${(prodOf(m.productId) || {}).sku || 'product'}`) : null,
  });
};

/* ---------- sale ---------- */
EDIT.sale = (id, preset = {}) => {
  const s = id ? S.sales.find(x => x.id === id) : null; const can = canEdit('finance') && secOK('sales');
  if (!S.products.length) { toast('Add products in the Catalogue first.', 'bad'); return; }
  const v0 = s ? { ...s, retCondition: s.retCondition || (s.restocked === false ? 'bad' : 'good') } : { date: TODAY(), qty: 1, status: 'delivered', platform: (activePlatforms()[0] || {}).key, retCondition: 'good', ...preset };
  const f = [
    { n: 'date', l: 'Order date', t: 'date', req: 1 }, { n: 'platform', l: 'Platform', t: 'select', req: 1, o: () => platOpts(v0.platform) },
    { n: 'productId', l: 'Product', t: 'select', req: 1, full: 1, o: () => { const o = prodOpts(); if (s && !o.some(x => x[0] === s.productId) && prodOf(s.productId)) o.push([s.productId, prodOf(s.productId).name]); return o; }, blank: 'Choose a product…' },
    { n: 'qty', l: 'Quantity', t: 'number', req: 1, min: 0, step: 'any', help: 'In the product’s unit (pieces, sq ft, metres…). Decimals are fine.' }, { n: 'unitPrice', l: 'Price per unit (incl. GST)', t: 'money', min: 0, help: 'Blank uses the product’s price on this platform.' },
    { n: 'status', l: 'Status', t: 'select', o: SALE_STATUS }, { n: 'orderRef', l: 'Order or settlement ref', mono: 1, ph: 'e.g. 402-1234567-1234567' },
    { n: 'retCondition', l: 'It came back', t: 'select', o: () => RET_COND, when: 'status:returned' }, { n: 'retDate', l: 'Return received on', t: 'date', when: 'status:returned' },
    { n: 'customerId', l: 'Customer', t: 'select', o: () => S.customers.slice().sort((a, b) => (a.name > b.name ? 1 : -1)).map(c => [c.id, c.name + (c.city ? ' · ' + c.city : '')]), blank: 'No customer record' },
    { n: 'actualFees', l: 'Actual fees charged (ex-GST)', t: 'money', min: 0, help: 'Total for this entry from the settlement report. Blank uses Fee settings.' },
    { n: 'note', l: 'Note', t: 'textarea', rows: 2, full: 1 },
  ];
  const fin = s ? saleFin(s) : null;
  openDrawer({
    title: s ? 'Sales entry' : 'Record sale', sub: s ? `${esc(PL(s.platform).name)} · ${esc(fmtD(s.date))}` : 'One order, or one day’s orders for a SKU on one platform.', readOnly: !can, delKey: 'sales/' + id,
    top: fin ? kvHTML([['Gross', inr(fin.gross)], ['Fees + GST', inr(fin.fees + fin.gstOnFees)], ['Settlement', inr(fin.settlement)], allow('costs') ? ['Contribution', `<span class="${fin.profit < 0 ? 'neg' : ''}">${inr(fin.profit)}</span>`] : ['Units', num(fin.units)]]) : '',
    html: form(f, v0),
    validate: v => { const e = []; if (N(v.qty) <= 0) e.push({ n: 'qty', m: 'Enter a quantity above zero.' }); const p = prodOf(v.productId); if (p && v.unitPrice === null && !N(((p.listings || {})[v.platform] || {}).price) && !N(p.sellingPrice)) e.push({ n: 'unitPrice', m: 'This product has no price yet. Enter the unit price.' }); return e; },
    onSave: async v => {
      const p = prodOf(v.productId); const pl = PL(v.platform);
      const unitPrice = v.unitPrice !== null ? v.unitPrice : (N(((p.listings || {})[v.platform] || {}).price) || N(p.sellingPrice));
      const changed = !s || s.productId !== v.productId || s.platform !== v.platform || N(s.unitPrice) !== N(unitPrice);
      const ret = v.status === 'returned'; const doc = { ...base(s), ...v, qty: rq3(N(v.qty)), unitPrice, brandId: p.brandId, retCondition: ret ? (v.retCondition || 'good') : null, retDate: ret ? (v.retDate || (s && s.retDate) || TODAY()) : null, restocked: ret ? (v.retCondition || 'good') === 'good' : true, customerId: v.customerId || null, calc: changed ? saleSnapshot({ ...v, unitPrice }, p, pl) : s.calc };
      await saveDoc('sales', id, doc, ['finance', `Sale ${v.qty} × ${p.sku} on ${pl.name}${v.orderRef ? ' (' + v.orderRef + ')' : ''}`]);
    },
    onDelete: s ? delFn('sales', id, 'finance', `Sale ${s.qty} × ${(prodOf(s.productId) || {}).sku || ''} on ${PL(s.platform).name}${s.orderRef ? ' (' + s.orderRef + ')' : ''}`) : null,
  });
};

/* ---------- expense ---------- */
EDIT.expense = id => {
  const e = id ? S.expenses.find(x => x.id === id) : null; const can = canEdit('finance') && secOK('expenses');
  const f = [
    { n: 'date', l: 'Date', t: 'date', req: 1 }, { n: 'category', l: 'Category', t: 'select', req: 1, o: EXP_CATS },
    { n: 'amount', l: 'Amount (ex-GST)', t: 'money', req: 1, min: 0 }, { n: 'gst', l: 'GST paid (input credit)', t: 'money', min: 0 },
    { n: 'brandId', l: 'Brand', t: 'select', o: brandOpts, blank: 'Shared across brands' }, { n: 'vendor', l: 'Vendor' },
    { n: 'paidVia', l: 'Paid via', t: 'select', o: ['Bank transfer', 'UPI', 'Card', 'Cash'] }, { n: 'accountId', l: 'Paid from account', t: 'select', o: () => S.accounts.filter(a => a.active !== false).map(a => [a.id, a.name]), blank: 'Not linked to an account' }, { n: 'ref', l: 'Invoice number', mono: 1 },
    { n: 'note', l: 'Note', t: 'textarea', rows: 2, full: 1 },
  ];
  const rec = e && e.recurringId ? S.recurring.find(r => r.id === e.recurringId) : null;
  openDrawer({
    title: e ? 'Expense' : 'Add expense', sub: rec ? `Posted from the recurring bill “${esc(rec.name)}”` : 'Running costs that aren’t per-order. Bills that repeat belong under Recurring expenses.', readOnly: !can, delKey: 'expenses/' + id,
    html: form(f, e || { date: TODAY(), category: 'Advertising', paidVia: 'Bank transfer', brandId: ui.brand !== 'all' ? ui.brand : '' }),
    validate: v => N(v.amount) <= 0 ? [{ n: 'amount', m: 'Enter an amount above zero.' }] : [],
    onSave: async v => { await saveDoc('expenses', id, { ...base(e), ...v, brandId: v.brandId || null, accountId: v.accountId || null }, ['finance', `Expense ${v.category} ${inr(v.amount)}${v.vendor ? ' · ' + v.vendor : ''}`]); },
    onDelete: e ? delFn('expenses', id, 'finance', `Expense ${e.category} ${inr(e.amount)} on ${fmtD(e.date)}`) : null,
  });
};

/* ---------- recurring expense ---------- */
EDIT.recurring = id => {
  const r = id ? S.recurring.find(x => x.id === id) : null; const can = canEdit('finance') && secOK('recurring');
  const f = [
    { n: 'name', l: 'Bill name', req: 1, full: 1, ph: 'e.g. Warehouse rent, Salem' },
    { n: 'category', l: 'Category', t: 'select', req: 1, o: EXP_CATS }, { n: 'vendor', l: 'Paid to' },
    { n: 'amount', l: 'Amount each time (ex-GST)', t: 'money', req: 1, min: 0 }, { n: 'gst', l: 'GST each time', t: 'money', min: 0 },
    { n: 'frequency', l: 'Repeats', t: 'select', o: FREQ.map(x => [x[0], x[1]]) }, { n: 'day', l: 'Due on day', t: 'number', min: 1, step: 1, help: 'Day of the month (ignored for weekly).' },
    { n: 'startDate', l: 'First due date', t: 'date', req: 1 }, { n: 'endDate', l: 'Ends on', t: 'date', help: 'Blank if it keeps going.' },
    { n: 'brandId', l: 'Brand', t: 'select', o: brandOpts, blank: 'Shared across brands' }, { n: 'paidVia', l: 'Paid via', t: 'select', o: ['Bank transfer', 'UPI', 'Card', 'Cash', 'Auto-debit'] },
    { n: 'autoPost', l: '', t: 'check', cl: 'Post to Expenses automatically on each due date', full: 1 },
    { raw: '<p class="help" style="margin:-6px 0 0">Automatic bills post the next time anyone on the team opens the ERP on or after the due date. Manual bills show as due until someone marks them paid.</p>' },
    { n: 'active', l: '', t: 'check', cl: 'Active', full: 1 },
    { n: 'backfill', l: '', t: 'check', cl: 'Also record bills already due since the first due date', full: 1, hide: !!r },
    { n: 'notes', l: 'Notes', t: 'textarea', rows: 2, full: 1 },
  ];
  openDrawer({
    title: r ? r.name : 'New recurring expense', sub: r ? `${esc(freqOf(r.frequency)[1])} · ${inr(monthlyEquiv(r))} a month · next due ${esc(fmtD(nextDue(r)))}` : 'Rent, salaries, subscriptions, insurance and EMIs: set them up once.', readOnly: !can, delKey: 'recurring/' + id,
    top: r ? kvHTML([['Per month', inr(monthlyEquiv(r))], ['Per year', inr(monthlyEquiv(r) * 12)], ['Paid through', esc(fmtD(r.postedThrough))], ['Posted', num(S.expenses.filter(e => e.recurringId === id).length) + ' bills']]) : '',
    html: form(f, r || { category: 'Rent & utilities', frequency: 'monthly', day: 1, startDate: addMonths(TODAY(), 1), active: true, autoPost: true, paidVia: 'Bank transfer', brandId: '' }),
    validate: v => { const e = []; if (N(v.amount) <= 0) e.push({ n: 'amount', m: 'Enter an amount above zero.' }); if (v.endDate && v.endDate < v.startDate) e.push({ n: 'endDate', m: 'Ends before it starts.' }); return e; },
    onSave: async v => {
      const back = v.backfill; delete v.backfill; let postedThrough = r ? r.postedThrough : null;
      if (!r && !back && v.startDate < TODAY()) postedThrough = addDays(TODAY(), -1);
      if (r && v.startDate !== r.startDate && (!postedThrough || postedThrough < v.startDate)) postedThrough = postedThrough && postedThrough >= v.startDate ? postedThrough : addDays(v.startDate, -1);
      const nid = await saveDoc('recurring', id, { ...base(r), ...v, day: v.day ? Math.round(N(v.day)) : null, brandId: v.brandId || null, postedThrough: postedThrough || null }, ['finance', `Recurring bill ${v.name} · ${inr(v.amount)} ${freqOf(v.frequency)[1].toLowerCase()}`]);
      autoDone.delete(nid);
    },
    onDelete: r ? delFn('recurring', id, 'finance', `Recurring bill ${r.name}`) : null,
  });
};
async function postRecurring(r, dates, auto) {
  if (!dates.length) return; const now = nowISO();
  for (const d of dates) { const eid = 'rec-' + r.id + '-' + d; if (byId('expenses')[eid]) continue; await dbWrite('set', 'expenses/' + eid, clean({ date: d, category: r.category, amount: N(r.amount), gst: N(r.gst), brandId: r.brandId || null, vendor: r.vendor || '', paidVia: r.paidVia || '', note: r.name + ' (' + freqOf(r.frequency)[1].toLowerCase() + ')', recurringId: r.id, ...(r.demo ? { demo: true } : {}), createdAt: now, createdBy: ME.id, updatedAt: now, updatedBy: ME.id })); }
  const last = dates[dates.length - 1]; const cur = S.recurring.find(x => x.id === r.id) || r;
  await dbWrite('set', 'recurring/' + r.id, clean({ ...base(cur), postedThrough: (cur.postedThrough || '') > last ? cur.postedThrough : last, updatedAt: now }));
  addLog(auto ? 'post' : 'create', 'finance', `${auto ? 'Auto-posted' : 'Marked paid'}: ${r.name}, ${dates.length} × ${inr(r.amount)}`, dates.map(fmtD).join(', '));
}
const autoDone = new Set();
async function autoPostRecurring() {
  if (!WRITE_OK || !S.definitive.recurring || !S.definitive.expenses) return;
  for (const r of S.recurring) { if (!r.autoPost || r.active === false || autoDone.has(r.id)) continue; autoDone.add(r.id); const ds = pendingDates(r); if (ds.length) { try { await postRecurring(r, ds, true); } catch (e) { console.warn('auto-post', e); } } }
}

/* ---------- payout ---------- */
EDIT.payout = id => {
  const p = id ? S.payouts.find(x => x.id === id) : null; const can = canEdit('finance') && secOK('payouts');
  const f = [
    { n: 'date', l: 'Date received', t: 'date', req: 1 }, { n: 'platform', l: 'Platform', t: 'select', req: 1, o: () => platOpts(p && p.platform) },
    { n: 'amount', l: 'Amount credited', t: 'money', req: 1, min: 0 }, { n: 'ref', l: 'UTR / reference', mono: 1 }, { n: 'accountId', l: 'Credited to account', t: 'select', o: () => S.accounts.filter(a => a.active !== false).map(a => [a.id, a.name]), blank: 'Not linked to an account' },
    { n: 'periodFrom', l: 'Covers sales from', t: 'date' }, { n: 'periodTo', l: 'to', t: 'date' },
    { n: 'note', l: 'Note', t: 'textarea', rows: 2, full: 1 },
  ];
  openDrawer({
    title: p ? 'Payout' : 'Record payout', sub: 'A settlement credited to your bank by a marketplace or payment gateway.', readOnly: !can, delKey: 'payouts/' + id,
    html: form(f, p || { date: TODAY(), platform: (activePlatforms()[0] || {}).key }),
    validate: v => N(v.amount) <= 0 ? [{ n: 'amount', m: 'Enter an amount above zero.' }] : [],
    onSave: async v => { await saveDoc('payouts', id, { ...base(p), ...v, accountId: v.accountId || null }, ['finance', `Payout ${PL(v.platform).name} ${inr(v.amount)}${v.ref ? ' · ' + v.ref : ''}`]); },
    onDelete: p ? delFn('payouts', id, 'finance', `Payout ${PL(p.platform).name} ${inr(p.amount)} on ${fmtD(p.date)}`) : null,
  });
};

/* ---------- asset ---------- */
EDIT.asset = id => {
  const a = id ? S.assets.find(x => x.id === id) : null; const can = canEdit('finance') && secOK('assets');
  const cat0 = assetCat((a && a.category) || 'it');
  const v0 = a || { category: 'it', method: cat0[2], rate: cat0[3], life: 5, salvage: 0, status: 'in_use', purchaseDate: TODAY(), tag: nextNum(S.assets, 'tag', 'TV-AST-') };
  const fD = [
    { n: 'name', l: 'Asset name', req: 1, full: 1, ph: 'e.g. MacBook Air 13" (catalogue team)' },
    { n: 'tag', l: 'Asset tag', mono: 1, req: 1 }, { n: 'category', l: 'Category', t: 'select', o: ASSET_CATS.map(c => [c[0], c[1]]), ch: 'assetcat' },
    { n: 'serial', l: 'Serial / model number', mono: 1 }, { n: 'status', l: 'Status', t: 'select', o: ASSET_STATUS },
    { n: 'purchaseDate', l: 'Purchase date', t: 'date', req: 1 }, { n: 'cost', l: 'Cost (ex-GST)', t: 'money', req: 1, min: 0 },
    { n: 'gst', l: 'GST paid', t: 'money', min: 0 }, { n: 'vendor', l: 'Bought from' }, { n: 'invoice', l: 'Invoice number', mono: 1 },
    { n: 'assignedTo', l: 'Assigned to', t: 'select', o: memberOpts, blank: 'Not assigned' }, { n: 'assignedName', l: 'Or held by', ph: 'e.g. Warehouse, packing desk' },
    { n: 'location', l: 'Location', ph: 'e.g. Salem office' }, { n: 'brandId', l: 'Brand', t: 'select', o: brandOpts, blank: 'Shared across brands' },
    { n: 'notes', l: 'Notes', t: 'textarea', rows: 2, full: 1 },
  ];
  const fDep = [
    { n: 'method', l: 'Method', t: 'select', o: [['wdv', 'Written down value (WDV)'], ['slm', 'Straight line (SLM)']] },
    { n: 'rate', l: 'WDV rate per year', t: 'pct', min: 0, help: 'Used with WDV.' }, { n: 'life', l: 'Useful life (years)', t: 'number', min: 1, help: 'Used with SLM.' },
    { n: 'salvage', l: 'Salvage value', t: 'money', min: 0 },
  ];
  let sched = '';
  if (a && a.purchaseDate) { const rows = []; let fy = parseD(a.purchaseDate); let y = fy.getMonth() >= 3 ? fy.getFullYear() : fy.getFullYear() - 1; for (let i = 0; i < 8; i++, y++) { const r = [y + '-04-01', (y + 1) + '-03-31']; if (r[0] > TODAY()) break; const open = N(a.cost) - accDep(a, addDays(r[0], -1)); const dep = depIn(a, r); rows.push(`<tr><td>FY ${y}–${String(y + 1).slice(2)}</td><td class="num">${inr(open)}</td><td class="num">${inr(dep)}</td><td class="num">${inr(open - dep)}</td></tr>`); } sched = `<div class="subh">Depreciation schedule</div><div class="tw"><table class="t"><thead><tr><th>Year</th><th class="num">Opening</th><th class="num">Depreciation</th><th class="num">Closing</th></tr></thead><tbody>${rows.join('')}</tbody></table></div><p class="muted" style="font-size:12px">The current year runs to today. Save changes to refresh the schedule.</p>`; }
  const fW = [
    { n: 'warrantyUntil', l: 'Warranty until', t: 'date' }, { n: 'amcUntil', l: 'AMC until', t: 'date' }, { n: 'insuranceUntil', l: 'Insurance until', t: 'date' }, { n: 'insurer', l: 'Insurer / policy number' },
    { raw: '<div class="subh" style="margin:6px 0 0">Disposal</div>' },
    { n: 'disposedOn', l: 'Disposed on', t: 'date', help: 'Set Status to Disposed as well.' }, { n: 'disposalValue', l: 'Sale or scrap value', t: 'money', min: 0 }, { n: 'disposalNote', l: 'How it was disposed', full: 1 },
  ];
  openDrawer({
    title: a ? a.name : 'New asset', sub: a ? `${esc(a.tag || '')} · book value ${inr(bookValue(a))}` : 'Equipment, furniture and vehicles the business owns. These are depreciated, not expensed.', readOnly: !can, delKey: 'assets/' + id,
    top: a ? kvHTML([['Cost', inr(a.cost)], ['Depreciated', inr(accDep(a, TODAY()))], ['Book value', inr(bookValue(a))], ['This FY', inr(depIn(a, periodRange('fy')))]]) : '',
    tabs: [{ l: 'Details', html: form(fD, v0) }, { l: 'Depreciation', html: form(fDep, v0) + sched }, { l: 'Warranty & disposal', html: form(fW, v0) }],
    validate: v => { const e = []; if (N(v.cost) <= 0) e.push({ n: 'cost', m: 'Enter the cost.' }); if (v.status === 'disposed' && !v.disposedOn) e.push({ n: 'disposedOn', m: 'Enter the disposal date.' }); if (S.assets.some(x => x.id !== id && x.tag && x.tag === v.tag)) e.push({ n: 'tag', m: 'Another asset has this tag.' }); return e; },
    onSave: async v => { await saveDoc('assets', id, { ...base(a), ...v, assignedTo: v.assignedTo || null, brandId: v.brandId || null }, ['finance', `Asset ${v.tag} · ${v.name}`]); },
    onDelete: a ? delFn('assets', id, 'finance', `Asset ${a.tag || ''} · ${a.name}`) : null,
  });
};

/* ---------- supplier ---------- */
EDIT.supplier = id => {
  const s = id ? supOf(id) : null; const can = canEdit('inventory');
  const f = [
    { n: 'name', l: 'Supplier name', req: 1, full: 1 }, { n: 'contact', l: 'Contact person' }, { n: 'phone', l: 'Phone', t: 'tel' }, { n: 'email', l: 'Email', t: 'email' },
    { n: 'gstin', l: 'GSTIN', mono: 1 }, { n: 'city', l: 'City' }, { n: 'state', l: 'State', t: 'select', o: STATES, blank: 'Choose…' },
    { n: 'terms', l: 'Payment terms', t: 'select', o: ['Advance', 'On delivery', '15 days', '30 days', '45 days', '60 days'] }, { n: 'leadTime', l: 'Lead time', t: 'number', min: 0, suf: 'days' },
    { n: 'categories', l: 'Supplies', full: 1, ph: 'e.g. Watch straps, metal bracelets' }, { n: 'notes', l: 'Notes', t: 'textarea', rows: 3, full: 1 },
  ];
  const pos = s ? S.pos.filter(p => p.supplierId === id) : [];
  openDrawer({
    title: s ? s.name : 'New supplier', sub: s ? `${num(pos.length)} purchase orders` : 'Vendors you buy stock from.', readOnly: !can, delKey: 'suppliers/' + id,
    html: form(f, s || { terms: '30 days' }),
    onSave: async v => { await saveDoc('suppliers', id, { ...base(s), ...v }, ['inventory', 'Supplier ' + v.name]); },
    onDelete: s ? delFn('suppliers', id, 'inventory', 'Supplier ' + s.name, () => pos.some(p => p.status === 'ordered' || p.status === 'partial') ? 'This supplier has open purchase orders. Close or cancel them first.' : '') : null,
  });
};

/* ---------- purchase order ---------- */
let poLines = [];
EDIT.po = (id, preset = {}) => {
  const po = id ? S.pos.find(x => x.id === id) : null; const can = canEdit('inventory') && (!po || !['received', 'cancelled'].includes(po.status)); const costs = allow('costs');
  if (!S.products.length) { toast('Add products in the Catalogue first.', 'bad'); return; }
  poLines = po ? JSON.parse(JSON.stringify(po.lines || [])) : (preset.lines || [{ productId: '', qty: 10, cost: null, received: 0 }]);
  const v0 = po || { number: nextNum(S.pos, 'number', 'PO-' + fyShort() + '-'), date: TODAY(), expectedDate: addDays(TODAY(), 10), status: 'ordered', supplierId: preset.supplierId || '' };
  const locked = po && ['partial', 'received'].includes(po.status);
  const f = [
    { n: 'number', l: 'PO number', mono: 1, req: 1 }, { n: 'supplierId', l: 'Supplier', t: 'select', req: 1, o: () => S.suppliers.map(s => [s.id, s.name]), blank: S.suppliers.length ? 'Choose…' : 'Add a supplier first' },
    { n: 'date', l: 'Order date', t: 'date', req: 1 }, { n: 'expectedDate', l: 'Expected delivery', t: 'date' },
    { n: 'status', l: 'Status', t: 'select', o: locked ? PO_STATUS : PO_STATUS.filter(s => ['draft', 'ordered', 'cancelled'].includes(s[0])), ro: locked },
  ];
  const dis = can ? '' : ' disabled';
  const lines = () => `<div class="subh">Items</div><div class="porow h"><span>Product</span><span>Qty</span><span>${costs ? 'Unit cost' : ''}</span><span>Received</span><span></span></div>${poLines.map((l, i) => `<div class="porow"><select class="inp" name="lines.${i}.productId" data-t="str" aria-label="Product"${dis || (N(l.received) ? ' disabled' : '')}><option value="">Choose…</option>${prodOpts().map(([k, t]) => `<option value="${esc(k)}"${k === l.productId ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select><input class="inp tnum" type="number" min="1" step="1" name="lines.${i}.qty" data-t="num" value="${esc(l.qty ?? '')}" aria-label="Quantity"${dis}>${costs ? `<div class="affix hp"><span class="pre">₹</span><input class="inp tnum" type="number" step="any" min="0" name="lines.${i}.cost" data-t="num" value="${esc(l.cost ?? '')}" placeholder="${esc(N((prodOf(l.productId) || {}).costPrice) || '')}" aria-label="Unit cost"${dis}></div>` : '<span></span>'}<span class="tnum muted">${num(l.received || 0)}</span>${can && !N(l.received) ? `<button type="button" class="btn icon ghost sm" data-act="porm:${i}" aria-label="Remove line">${icon('x')}</button>` : '<span></span>'}</div>`).join('')}${can ? `<div style="margin-top:10px">${btn('Add item', 'poadd', { sm: true, i: 'plus' })}</div>` : ''}${costs ? `<p class="muted" style="font-size:12px">Total ex-GST: <b>${inr(sum(poLines, l => N(l.qty) * N(l.cost ?? (prodOf(l.productId) || {}).costPrice)))}</b>. A blank cost uses the product’s current cost price.</p>` : ''}`;
  DRW_po = { po, lines };
  openDrawer({
    title: po ? po.number : 'New purchase order', sub: po ? `${esc((supOf(po.supplierId) || {}).name || '')} · ${esc((PO_STATUS.find(s => s[0] === po.status) || [, po.status])[1])}` : 'Order stock from a supplier. Receive it when it arrives to add it to inventory.', readOnly: !can, delKey: 'pos/' + id, wide: true,
    top: po ? kvHTML([['Items', num((po.lines || []).length)], ['Units', num(sum(po.lines || [], l => l.qty))], ['Received', pct(poReceivedPct(po), 0)], costs ? ['Value', inr(poValue(po))] : ['Expected', esc(fmtD(po.expectedDate))]]) : '',
    html: () => form(f, v0) + `<div id="poLines">${lines()}</div>` + form([{ n: 'notes', l: 'Notes', t: 'textarea', rows: 2, full: 1 }], v0),
    footExtra: po && ['ordered', 'partial'].includes(po.status) && canEdit('inventory') ? btn('Receive items', 'poreceive:' + po.id, { i: 'box' }) : '',
    validate: v => { const e = []; const ls = linesFrom(v); if (!ls.length) e.push({ n: 'number', m: 'Add at least one item with a quantity.' }); if (S.pos.some(x => x.id !== id && x.number === v.number)) e.push({ n: 'number', m: 'Another PO has this number.' }); return e; },
    onSave: async v => { const ls = linesFrom(v); const status = locked ? po.status : v.status; await saveDoc('pos', id, { ...base(po), number: v.number, supplierId: v.supplierId, date: v.date, expectedDate: v.expectedDate, status, notes: v.notes, lines: ls }, ['inventory', `Purchase order ${v.number} · ${(supOf(v.supplierId) || {}).name || ''} · ${ls.length} items`]); },
    onDelete: po && !N(sum(po.lines || [], l => l.received)) ? delFn('pos', id, 'inventory', `Purchase order ${po.number}`) : null,
  });
};
let DRW_po = null;
function linesFrom(v) { const raw = v.lines || {}; return poLines.map((l, i) => { const x = raw[i] || {}; const pid = x.productId !== undefined ? x.productId : l.productId; return { productId: pid, qty: Math.round(N(x.qty !== undefined ? x.qty : l.qty)), cost: x.cost !== undefined && x.cost !== null ? N(x.cost) : (l.cost !== null && l.cost !== undefined ? N(l.cost) : N((prodOf(pid) || {}).costPrice)), received: N(l.received) }; }).filter(l => l.productId && l.qty > 0); }
function syncPoLines() { const { vals } = readForm($('#drForm')); const raw = vals.lines || {}; poLines = poLines.map((l, i) => { const x = raw[i] || {}; return { ...l, productId: x.productId !== undefined ? x.productId : l.productId, qty: x.qty !== undefined ? x.qty : l.qty, cost: x.cost !== undefined ? x.cost : l.cost }; }); }
function redrawPoLines() { const el = $('#poLines'); if (el && DRW_po) el.innerHTML = DRW_po.lines(); }
EDIT.receive = id => {
  const po = S.pos.find(x => x.id === id); if (!po) return; const costs = allow('costs');
  const rows = (po.lines || []).map((l, i) => ({ l, i, rem: Math.max(0, N(l.qty) - N(l.received)) })).filter(x => x.rem > 0);
  const html = `<div class="form"><div class="fld"><label for="rc_date">Received on</label><input class="inp" type="date" id="rc_date" name="date" data-t="str" value="${TODAY()}" data-req="1"></div><div class="fld"><label for="rc_ref">GRN / invoice number</label><input class="inp mono" id="rc_ref" name="ref" data-t="str"></div></div>
  <div class="subh">Quantities received now</div>${rows.map(x => { const p = prodOf(x.l.productId) || {}; return `<div class="li" style="padding:10px 0"><div class="grow"><b>${esc(p.name || 'Product')}</b><small>${esc(p.sku || '')} · ordered ${num(x.l.qty)}, received ${num(x.l.received || 0)}${costs ? ' · ' + inr(x.l.cost, 2) + ' each' : ''}</small></div><div style="width:110px"><input class="inp tnum" type="number" min="0" max="${x.rem}" step="1" name="rcv.${x.i}" data-t="num" value="${x.rem}" aria-label="Units received for ${esc(p.name || 'product')}"></div></div>`; }).join('')}
  ${costs ? `<label class="chk" style="margin-top:14px"><input type="checkbox" name="wavg" data-t="check" checked> Recalculate cost prices as a weighted average</label>` : ''}`;
  openDrawer({
    title: 'Receive ' + po.number, sub: `${esc((supOf(po.supplierId) || {}).name || '')} · stock is added to inventory as a purchase`, html, saveLabel: 'Receive stock', savedMsg: null,
    onSave: async v => {
      const sup = (supOf(po.supplierId) || {}).name || ''; const lines = JSON.parse(JSON.stringify(po.lines || [])); const tmp = {}; let units = 0;
      for (const x of rows) {
        const q = Math.min(x.rem, Math.max(0, Math.round(N((v.rcv || {})[x.i])))); if (!q) continue; const p = prodOf(x.l.productId); if (!p) continue;
        await dbWrite('set', 'moves/' + newId('moves'), clean({ productId: p.id, brandId: p.brandId, type: 'purchase', qty: q, entered: q, date: v.date, unitCost: N(x.l.cost), supplier: sup, ref: po.number + (v.ref ? ' · ' + v.ref : ''), poId: po.id, createdAt: nowISO(), createdBy: ME.id, updatedAt: nowISO(), updatedBy: ME.id, ...(po.demo ? { demo: true } : {}) }));
        if (v.wavg && N(x.l.cost) > 0) { const t = tmp[p.id] || { on: Math.max(0, stockMap()[p.id] || 0), cost: N(p.costPrice) }; const nc = (t.on * t.cost + q * N(x.l.cost)) / (t.on + q); tmp[p.id] = { on: t.on + q, cost: nc }; }
        lines[x.i].received = N(lines[x.i].received) + q; units += q;
      }
      if (!units) { toast('Enter at least one received quantity.', 'bad'); return false; }
      for (const pid in tmp) { const p = prodOf(pid); await dbWrite('set', 'products/' + pid, clean({ ...base(p), costPrice: Math.round(tmp[pid].cost * 100) / 100, updatedAt: nowISO(), updatedBy: ME.id })); }
      const done = lines.every(l => N(l.received) >= N(l.qty));
      await dbWrite('set', 'pos/' + po.id, clean({ ...base(po), lines, status: done ? 'received' : 'partial', receivedAt: done ? v.date : (po.receivedAt || null), updatedAt: nowISO(), updatedBy: ME.id }));
      addLog('receive', 'inventory', `Received ${units} units on ${po.number}${done ? ' (complete)' : ' (partial)'}`, (lines.map(l => `${(prodOf(l.productId) || {}).sku || ''} ${N(l.received)}/${N(l.qty)}`).join('; ')));
      toast(`Received ${units} units into stock`);
    },
  });
};

/* ---------- customer ---------- */
EDIT.customer = id => {
  const c = id ? custOf(id) : null; const can = canEdit('customers');
  const f = [
    { n: 'name', l: 'Name', req: 1, full: 1 }, { n: 'phone', l: 'Phone', t: 'tel' }, { n: 'email', l: 'Email', t: 'email' },
    { n: 'city', l: 'City' }, { n: 'state', l: 'State', t: 'select', o: STATES, blank: 'Choose…' }, { n: 'pincode', l: 'PIN code', mono: 1, max: 6 },
    { n: 'source', l: 'First bought on', t: 'select', o: () => platforms().map(p => [p.key, p.name]), blank: 'Not known' },
    { n: 'tags', l: 'Tags', full: 1, ph: 'e.g. VIP, Wholesale, Gifting', help: 'Comma-separated.' }, { n: 'notes', l: 'Notes', t: 'textarea', rows: 3, full: 1 },
  ];
  const sales = c ? S.sales.filter(s => s.customerId === id).sort((a, b) => a.date < b.date ? 1 : -1) : [];
  const orders = sales.length ? table('custorders', [
    { k: 'date', l: 'Date', render: s => esc(fmtD(s.date)) }, { k: 'p', l: 'Product', render: s => esc((prodOf(s.productId) || {}).name || '—') },
    { k: 'pl', l: 'Platform', render: s => esc(PL(s.platform).name) }, { k: 'qty', l: 'Qty', num: 1, render: s => num(s.qty) }, { k: 'v', l: 'Value', num: 1, render: s => inr(N(s.qty) * N(s.unitPrice)) },
    { k: 'st', l: 'Status', render: s => pill(saleLabel(s.status), SALE_TONE[s.status]) },
  ], sales, { open: s => canView('finance') && secOK('sales') ? 'open:sale:' + s.id : '' }) : empty('No linked orders', 'Pick this customer on a sales entry to build their order history.');
  openDrawer({
    title: c ? c.name : 'New customer', sub: c ? `${num(sales.length)} orders · ${inr(sum(sales.filter(s => s.status !== 'cancelled'), s => N(s.qty) * N(s.unitPrice)))} spent` : 'Direct buyers, repeat customers and wholesale accounts.', readOnly: !can, delKey: 'customers/' + id,
    tabs: c ? [{ l: 'Details', html: form(f, c) }, { l: 'Orders', html: orders }] : [{ l: 'Details', html: form(f, {}) }],
    validate: v => v.email && !/^\S+@\S+\.\S+$/.test(v.email) ? [{ n: 'email', m: 'That email doesn’t look right.' }] : [],
    onSave: async v => { await saveDoc('customers', id, { ...base(c), ...v }, ['customers', `Customer ${v.name}`]); },
    onDelete: c ? delFn('customers', id, 'customers', `Customer ${c.name}`) : null,
  });
};

/* ---------- review ---------- */
EDIT.review = id => {
  const r = id ? S.reviews.find(x => x.id === id) : null; const can = canEdit('customers');
  if (!S.products.length) { toast('Add products in the Catalogue first.', 'bad'); return; }
  const f = [
    { n: 'productId', l: 'Product', t: 'select', req: 1, full: 1, o: prodOpts, blank: 'Choose a product…' },
    { n: 'platform', l: 'Platform', t: 'select', req: 1, o: () => platOpts(r && r.platform) }, { n: 'rating', l: 'Rating', t: 'select', req: 1, num: 1, o: [5, 4, 3, 2, 1].map(k => [k, '★'.repeat(k) + ' ' + k]) },
    { n: 'date', l: 'Review date', t: 'date', req: 1 }, { n: 'reviewer', l: 'Reviewer name' },
    { n: 'title', l: 'Review title', full: 1 }, { n: 'text', l: 'Review text', t: 'textarea', rows: 4, full: 1 },
    { n: 'status', l: 'Status', t: 'select', o: REV_STATUS },
    { raw: `<div class="fld" data-fld="response" style="gap:6px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><label for="fi_response">Your public reply</label>${can ? `<span style="display:flex;gap:6px;flex-wrap:wrap">${REPLY_TPL.map(t => `<button type="button" class="btn sm ghost" data-act="replytpl:${t[0]}">${esc(t[1])}</button>`).join('')}</span>` : ''}</div><textarea class="inp" id="fi_response" name="response" data-t="str" rows="6"${can ? '' : ' disabled'}>${esc((r && r.response) || '')}</textarea><div class="help" id="draftNote">Pick a template to start from, edit it, post it on the marketplace, then save it here.</div></div>` },
  ];
  openDrawer({
    title: r ? 'Review' : 'Log a review', sub: r ? `${esc((prodOf(r.productId) || {}).name || '')} · ${esc(PL(r.platform).name)}` : 'Copy reviews in from seller central so the team can reply from one queue.', readOnly: !can, delKey: 'reviews/' + id,
    html: form(f, r || { date: TODAY(), rating: 5, status: 'new', platform: (activePlatforms()[0] || {}).key }),
    onSave: async v => { const p = prodOf(v.productId); if (v.response && v.status === 'new') v.status = 'replied'; await saveDoc('reviews', id, { ...base(r), ...v, brandId: p && p.brandId }, ['customers', `Review ${v.rating}★ on ${p ? p.sku : ''}${v.reviewer ? ' by ' + v.reviewer : ''}`]); },
    onDelete: r ? delFn('reviews', id, 'customers', `Review ${r.rating}★ by ${r.reviewer || 'customer'}`) : null,
  });
};
/* ---------- campaign ---------- */
EDIT.campaign = id => {
  const c = id ? S.campaigns.find(x => x.id === id) : null; const can = canEdit('marketing');
  const f = [
    { n: 'name', l: 'Campaign name', req: 1, full: 1, ph: 'e.g. Diwali mesh bracelets, Sponsored Products' },
    { n: 'channel', l: 'Channel', t: 'select', req: 1, o: CHANNELS }, { n: 'brandId', l: 'Brand', t: 'select', o: brandOpts, blank: 'Several brands' },
    { n: 'status', l: 'Status', t: 'select', o: CAMP_STATUS }, { n: 'coupon', l: 'Coupon or deal code', mono: 1 },
    { n: 'startDate', l: 'Start date', t: 'date', req: 1 }, { n: 'endDate', l: 'End date', t: 'date', help: 'Blank if ongoing.' },
    { n: 'budget', l: 'Budget', t: 'money', min: 0 }, { n: 'spend', l: 'Spend to date', t: 'money', min: 0 },
    { n: 'impressions', l: 'Impressions', t: 'number', min: 0 }, { n: 'clicks', l: 'Clicks', t: 'number', min: 0 },
    { n: 'orders', l: 'Orders', t: 'number', min: 0 }, { n: 'revenue', l: 'Attributed revenue', t: 'money', min: 0 },
    { n: 'notes', l: 'Notes', t: 'textarea', rows: 3, full: 1 },
  ];
  const st = c ? campStats([c]) : null;
  openDrawer({
    title: c ? c.name : 'New campaign', sub: c ? esc(c.channel || '') : 'Update spend and results from the ad console as the campaign runs.', readOnly: !can, delKey: 'campaigns/' + id,
    top: st ? kvHTML([['ROAS', st.spend ? st.roas.toFixed(2) + '×' : '—'], ['ACoS', st.rev ? pct(st.acos) : '—'], ['CTR', st.imp ? pct(st.ctr, 2) : '—'], ['CPC', st.clk ? inr(st.cpc, 2) : '—']]) : '',
    html: form(f, c || { status: 'planned', startDate: TODAY(), channel: CHANNELS[0], brandId: ui.brand !== 'all' ? ui.brand : '' }),
    validate: v => (v.endDate && v.startDate && v.endDate < v.startDate) ? [{ n: 'endDate', m: 'End date is before the start date.' }] : [],
    onSave: async v => { await saveDoc('campaigns', id, { ...base(c), ...v, brandId: v.brandId || null }, ['marketing', `Campaign ${v.name}`]); },
    onDelete: c ? delFn('campaigns', id, 'marketing', `Campaign ${c.name}`) : null,
  });
};

/* ---------- fee settings ---------- */
let feeList = null;
function feeSettings() {
  const can = canEdit('calculator'); feeList = JSON.parse(JSON.stringify(platforms()));
  const fields = [['commission', '%'], ['fixed', '₹'], ['shipBase', '₹'], ['shipExtra', '₹'], ['collection', '%'], ['tcs', '%'], ['tds', '%'], ['returnCost', '₹']];
  const dis = can ? '' : ' disabled';
  const html = () => `<p class="muted" style="margin:0 0 14px;max-width:80ch">These are example rates. Replace them with the fees on your seller contracts. Percentages apply to the selling price including GST, except TCS and TDS, which apply to the taxable value. 18% GST is added on all fees.</p><div class="tw"><div class="plrow h"><span>On</span><span>Platform</span><span>Commission %</span><span>Fixed fee ₹</span><span>Ship 500 g ₹</span><span>Extra 500 g ₹</span><span>Collection %</span><span>TCS %</span><span>TDS %</span><span>Return cost ₹</span></div>${feeList.map((p, i) => `<div class="plrow" style="padding:4px 0"><input type="checkbox" name="pl.${i}.on" data-t="check" aria-label="Use ${esc(p.name)}"${p.on !== false ? ' checked' : ''}${dis} style="width:16px;height:16px;accent-color:var(--accent)"><input class="inp" name="pl.${i}.name" data-t="str" value="${esc(p.name)}" aria-label="Platform name"${dis}>${fields.map(([k]) => `<input class="inp tnum" type="number" step="any" min="0" name="pl.${i}.${k}" data-t="num" value="${esc(p[k] ?? 0)}" aria-label="${esc(p.name)} ${k}"${dis}>`).join('')}</div>`).join('')}</div>`;
  openDrawer({
    title: 'Platform fee settings', sub: 'Used by the revenue calculator and to estimate fees on new sales entries.', wide: true, readOnly: !can, noFocus: true,
    html, footExtra: can ? `<button type="button" class="btn ghost" data-act="feeadd">Add platform</button><button type="button" class="btn ghost" data-act="feereset">Reset to examples</button>` : '',
    validate: v => { const e = []; Object.entries(v.pl || {}).forEach(([i, x]) => { if (!x.name) e.push({ n: 'pl.' + i + '.name', m: 'Name required' }); }); return e; },
    onSave: async v => { const prev = platforms(); const list = feeList.map((p, i) => { const x = (v.pl || {})[i] || {}; const o = { ...p, ...x, on: !!x.on }; for (const [k] of fields) o[k] = N(x[k]); if (!o.code) o.code = o.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(); return o; }); const d = list.map(p => { const q = prev.find(x => x.key === p.key); return q ? diffText(q, p) : 'Added ' + p.name; }).map((t, i) => t ? list[i].name + ' — ' + t : '').filter(Boolean).join(' | '); await dbWrite('set', 'settings/platforms', clean({ list, updatedAt: nowISO(), updatedBy: ME.id })); addLog('settings', 'calculator', 'Platform fee settings updated', d.slice(0, 600)); },
  });
}
