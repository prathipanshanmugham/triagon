'use strict';
/* AI access: an MCP server (Streamable HTTP, JSON responses) plus a small REST API.
   An access key works as one team member: that person's role, permissions and the activity log apply. */
const MODEL = require('../shared/model.js');

const F = (o) => o; // field doc helper
const UNIT_KEYS = ['pc', 'sq ft', 'sq m', 'm', 'ft', 'kg', 'g', 'l', 'ml', 'set', 'pair', 'roll', 'box', 'sheet', 'hide'];
const ADJ_TYPES = ['incentive', 'bonus', 'overtime', 'arrears', 'reimb', 'advance', 'deduction', 'tds'];
const SCHEMA = {
  brands: { d: 'Brands the company sells under.', f: F({ name: 'Brand name', code: '2–4 letter code, used as SKU prefix', category: 'Category', status: 'Active | Launching | Paused | Discontinued', tagline: 'Tagline', launchDate: 'YYYY-MM-DD', tmStatus: 'Trademark status', tmClass: 'Trademark class' }) },
  products: { d: 'Catalogue products, one per SKU. Stock is counted in `unit` (e.g. sq ft for leather) and bought in `purchaseUnit`.', f: F({ sku: 'Master SKU (auto if blank)', name: 'Product name', brandId: 'brands id', category: 'Category', variant: 'Variant text', unit: 'Stock & selling unit: pc, sq ft, sq m, kg, g, m, ft, l, ml, roll, set, pair, box', purchaseUnit: 'Unit bought from vendors, e.g. hide, 100 sq ft lot, bag', purchaseFactor: 'How many stock units in one purchase unit', mrp: 'MRP per unit', sellingPrice: 'Selling price per unit incl. GST', costPrice: 'Landed cost per unit ex-GST', packagingCost: 'Packaging per unit', gstRate: 'GST %', hsn: 'HSN code', weight: 'Packed weight per unit in grams', openingStock: 'Units on hand when tracking started', reorderLevel: 'Low-stock level', location: 'Storage location', supplierId: 'suppliers id', status: 'active | draft | archived', title: 'Master marketplace title', bullets: 'Master bullets, one per line', description: 'Master description', keywords: 'Comma-separated keywords', images: 'Number of images ready', driveLink: 'Google Drive folder with images and data', listings: '{ platformKey: { status: none|draft|live|inactive|suppressed, id: ASIN/FSN/listing id, sku: channel SKU, title, bullets, description, keywords, price, mrp, url, driveLink, fees: { commission %, fixed ₹, ship ₹, collection %, other ₹ } (overrides platform defaults for this SKU), ratingAvg, ratingCount, ratingAsOf } }' }) },
  moves: { d: 'Stock movements. On-hand stock = opening + moves + sales. qty changes sellable stock; badQty changes damaged/rejected stock.', f: F({ productId: 'products id', type: 'purchase | adjust_add | adjust_remove | damaged | count | mark_bad | bad_writeoff | bad_repair | bad_rtv | qc_reject | return_in', qty: 'Change in sellable stock in the product unit (negative removes)', badQty: 'Change in damaged stock', date: 'YYYY-MM-DD', unitCost: 'Cost per unit ex-GST (purchases)', supplier: 'Supplier name', ref: 'Reference', note: 'Note', poId: 'pos id when from a purchase order' }) },
  pos: { d: 'Purchase orders to vendors.', f: F({ number: 'PO-YY-0001', supplierId: 'suppliers id', date: 'Order date', expectedDate: 'Expected delivery', status: 'draft | ordered | partial | received | cancelled', lines: '[{ productId, qty (in line unit), unit, factor (stock units per line unit), cost (per line unit ex-GST), gstRate, received, rejected }] — for an item not yet in the catalogue leave productId empty and give newItem: { name, brandId, category, unit (stock unit), purchaseUnit, factor, sku, hsn, sellingPrice }; it becomes a product when the PO is received in the ERP', terms: 'Payment & delivery terms', shipTo: 'Delivery address', notes: 'Notes' }) },
  suppliers: { d: 'Vendors.', f: F({ name: 'Name', contact: 'Contact person', phone: 'Phone', email: 'Email', gstin: 'GSTIN', pan: 'PAN', address: 'Address', city: 'City', state: 'State', terms: 'Payment terms', leadTime: 'Lead time days', categories: 'What they supply', bankName: 'Bank', bankAcc: 'Account number', ifsc: 'IFSC', upi: 'UPI id', driveLink: 'Drive folder for their documents', rating: '1–5', notes: 'Notes' }) },
  pinvoices: { d: 'Purchase invoices (bills) from vendors, with files or Drive/Gmail links.', f: F({ number: 'Vendor invoice number', date: 'Invoice date', supplierId: 'suppliers id', poId: 'pos id', taxable: 'Taxable value', gst: 'GST amount', total: 'Invoice total', dueDate: 'Due date', fileId: 'files id of the uploaded bill', driveLink: 'Drive link', gmailLink: 'Gmail link', notes: 'Notes' }) },
  orders: { d: 'Sales orders, including custom-size orders (leather cut to size). Lines with mode "area" use length × width.', f: F({ number: 'SO-YY-0001', date: 'Order date', customerId: 'customers id', customerName: 'Name if no customer record', phone: 'Phone', channel: 'Platform key (direct, website, b2b, amazon…)', status: 'quote | confirmed | production | ready | dispatched | delivered | cancelled', dueDate: 'Promised date', lines: '[{ productId, desc, mode: area|length|qty, l, w, dimUnit: in|cm|mm|ft|m, pieces, wastage %, priceMode: unit|piece, rate (incl GST), gstRate, consume (stock units, computed), amount (incl GST) }]', discount: '₹', shipping: '₹', total: 'Order total incl GST', deliveryAddress: 'Address', tracking: 'Courier & AWB', notes: 'Notes' }) },
  sales: { d: 'Sales ledger entries (one order or one day’s units of a SKU on a platform).', f: F({ date: 'YYYY-MM-DD', platform: 'Platform key', productId: 'products id', qty: 'Units (decimals allowed for sq ft etc.)', unitPrice: 'Price per unit incl GST', status: 'delivered | transit | returned | cancelled', orderRef: 'Order id', customerId: 'customers id', actualFees: 'Actual fees ex-GST', retCondition: 'For returns: good | bad | missing | wrong', retDate: 'Return received date', retNote: 'What was wrong with the return', wasteQty: 'Extra stock used cutting a custom size (offcuts), never restocked', orderId: 'orders id', note: 'Note' }) },
  claims: { d: 'Claims raised with marketplaces for returns, damage, loss or fee errors.', f: F({ platform: 'Platform key', saleId: 'sales id', orderRef: 'Order id', productId: 'products id', type: 'damaged_return | wrong_item | not_returned | lost_transit | missing_parts | fee_error | other', claimRef: 'Platform case/claim id', filedOn: 'Date filed', amount: 'Amount claimed', status: 'to_file | filed | review | approved | partial | rejected | paid', received: 'Amount received', receivedOn: 'Date', deadline: 'Last date to file', evidenceLink: 'Drive link', notes: 'Notes' }) },
  expenses: { d: 'Expenses (bills paid).', f: F({ date: 'YYYY-MM-DD', category: 'Category', amount: 'Amount before GST (ex-GST)', gst: 'GST paid on it (input credit), added on top of amount', vendor: 'Paid to', paidVia: 'Bank transfer | UPI | Card | Cash', accountId: 'accounts id', brandId: 'brands id', ref: 'Bill number', note: 'Note' }) },
  recurring: { d: 'Recurring bills (rent, salaries, subscriptions).', f: F({ name: 'Name', category: 'Category', vendor: 'Vendor', amount: 'Amount', gst: 'GST', frequency: 'monthly | quarterly | halfyearly | yearly | weekly', day: 'Day of month', startDate: 'Start', endDate: 'End', autoPost: 'Post automatically', active: 'Active' }) },
  payouts: { d: 'Marketplace settlements received in the bank.', f: F({ date: 'Date', platform: 'Platform key', amount: 'Amount', ref: 'UTR', periodFrom: 'From', periodTo: 'To', accountId: 'accounts id' }) },
  accounts: { d: 'Bank, cash and UPI accounts with starting balances.', f: F({ name: 'Name', type: 'bank | cash | upi | wallet | card', bankName: 'Bank', number: 'Last digits', opening: 'Starting balance', openingDate: 'Balance as of (entries dated on or after it are added)', active: 'Active', recon: '[{ date, stmt, erp, diff, note }] statement reconciliations, newest first' }) },
  txns: { d: 'Money movements not captured elsewhere: customer payments on orders, vendor payments on bills, transfers, capital, loans, other income.', f: F({ date: 'Date', type: 'in | out | transfer', accountId: 'accounts id', toAccountId: 'For transfers', amount: 'Amount', category: 'order_payment | vendor_payment | transfer | capital | loan | other_income | other_expense | adjustment', link: '{ col, id } e.g. { col: "orders", id }', ref: 'Reference', note: 'Note' }) },
  assets: { d: 'Fixed assets with depreciation.', f: F({ tag: 'TV-AST-0001', name: 'Name', category: 'Category', purchaseDate: 'Date', cost: 'Cost', status: 'in_use | idle | repair | disposed', location: 'Location' }) },
  campaigns: { d: 'Marketing campaigns.', f: F({ name: 'Name', channel: 'Channel', brandId: 'brands id', status: 'planned | live | paused | ended', startDate: 'Start', endDate: 'End', budget: 'Budget', spend: 'Spend', impressions: 'Impressions', clicks: 'Clicks', orders: 'Orders', revenue: 'Revenue' }) },
  offers: { d: 'Sales offers and deals per platform and product, tracked against sales in their window.', f: F({ name: 'Name', platform: 'Platform key', productIds: '[products id]', kind: 'deal | coupon | discount | bundle | bogo | freeship | other', discType: 'pct | flat | price', value: 'Discount % / ₹ off / offer price', start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', fee: 'Deal fee ₹', code: 'Coupon code', cancelled: 'true if cancelled', notes: 'Notes' }) },
  customers: { d: 'Customers.', f: F({ name: 'Name', phone: 'Phone', email: 'Email', city: 'City', state: 'State', source: 'Platform key', gstin: 'GSTIN', address: 'Address', tags: 'Tags', notes: 'Notes' }) },
  reviews: { d: 'Customer reviews per product and platform (listing).', f: F({ productId: 'products id', platform: 'Platform key', rating: '1–5', title: 'Title', text: 'Text', reviewer: 'Name', date: 'Date', status: 'new | replied | escalated | resolved', response: 'Reply' }) },
  ratingSnaps: { d: 'Snapshots of a listing’s overall rating on a platform.', f: F({ productId: 'products id', platform: 'Platform key', date: 'Date', avg: 'Average stars', count: 'Number of ratings' }) },
  employees: { d: 'Employees (attendance, kiosk PIN, linked ERP login).', f: F({ code: 'EMP-0001', name: 'Name', designation: 'Designation', department: 'Department', phone: 'Phone', joinDate: 'Joining date', shiftStart: 'HH:MM', shiftEnd: 'HH:MM', weeklyOff: '["0"=Sun … "6"=Sat]', memberId: 'members id', status: 'active | inactive' }) },
  attendance: { d: 'Attendance per employee per day (id = employeeId_YYYY-MM-DD).', f: F({ employeeId: 'employees id', date: 'YYYY-MM-DD', sessions: '[{ in: ISO time, out: ISO time }]', mark: 'present | half | wfh | leave | lop | holiday | absent (overrides automatic)', update: 'Work update', note: 'Manager note' }) },
  updates: { d: 'Team updates that appear in the daily report.', f: F({ date: 'YYYY-MM-DD', text: 'Update', category: 'Category', by: 'members id', at: 'ISO time' }) },
  candidates: { d: 'Hiring pipeline (HR).', f: F({ name: 'Name', phone: 'Phone', email: 'Email', position: 'Role', stage: 'applied | screening | interview | offer | hired | rejected | withdrawn', expectedCTC: 'Monthly', offeredCTC: 'Monthly', joinDate: 'Date', notes: 'Notes' }) },
  hrprofiles: { d: 'Private HR profile per employee (id = employees id): personal details, bank, statutory numbers, salary structure, onboarding and exit.', f: F({ salary: '{ basic, hra, conveyance, special, other } monthly', pf: 'PF applies', esi: 'ESI applies', pt: 'Professional tax applies', uan: 'UAN', esic: 'ESI number', pan: 'PAN', bankAcc: 'Account', ifsc: 'IFSC', exit: '{ type, noticeDate, lastDay, reason, status }' }) },
  payroll: { d: 'Monthly payroll runs (id = YYYY-MM).', f: F({ month: 'YYYY-MM', status: 'draft | final | paid', rows: '[{ employeeId, paidDays, gross, adds, ded, net, er }]', totals: 'Totals' }) },
  hradj: { d: 'Payroll additions and deductions: incentives, bonus, overtime, advances.', f: F({ employeeId: 'employees id', month: 'YYYY-MM', type: 'incentive | bonus | overtime | arrears | reimb (additions) · deduction | tds (deductions) · advance (recovered monthly)', amount: '₹', monthly: 'Advance recovery per month', note: 'Note' }) },
  deletions: { d: 'Delete requests and the recycle bin.', f: F({ col: 'Collection', docId: 'Record id', label: 'What', status: 'pending | approved | rejected | restored', reason: 'Reason' }), ro: true },
  members: { d: 'Team members (ERP users).', f: F({ name: 'Name', title: 'Title', role: 'ceo | manager | staff | custom', status: 'active | suspended | removed' }), ro: true },
  files: { d: 'Uploaded files (bills, documents).', f: F({ name: 'File name', type: 'MIME', size: 'Bytes', col: 'Linked collection', docId: 'Linked record' }), ro: true },
};
const MOD_OF = col => (MODEL.writeMods(col) || ['dashboard'])[0];
const STRIP_COST = ['costPrice', 'unitCost', 'calc', 'cost', 'cogs'];
const rid = () => require('crypto').randomBytes(9).toString('base64url').replace(/[-_]/g, '').slice(0, 12);

module.exports = function makeMCP(ctx) {
  const { store, perms, writeOps, addLog, logic: L, HttpErr, kioskState, VERSION } = ctx;
  const canCol = (uid, col) => perms.canRead(uid, col + '/x');
  const stripCosts = (uid, o) => { if (MODEL.ability(perms.of(uid), 'costs')) return o; const f = x => Array.isArray(x) ? x.map(f) : x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).filter(([k]) => !STRIP_COST.includes(k)).map(([k, v]) => [k, f(v)])) : x; return f(o); };
  const rec = (uid, col, id, d) => stripCosts(uid, { id, ...perms.redact(col + '/' + id, d) });
  const who = a => { const m = store.get('members/' + a.uid) || {}; return `${m.name || 'Someone'} via AI (${a.keyName || 'key'})`; };
  const getPath = (o, p) => String(p).split('.').reduce((x, k) => x == null ? undefined : x[k], o);
  function match(d, where) {
    for (const k in where || {}) {
      const v = getPath(d, k); let cond = where[k];
      if (cond === null || typeof cond !== 'object' || Array.isArray(cond)) cond = Array.isArray(cond) ? { in: cond } : { eq: cond };
      for (const op in cond) {
        const x = cond[op];
        if (op === 'eq' && !(v === x || String(v) === String(x))) return false;
        if (op === 'ne' && (v === x || String(v) === String(x))) return false;
        if (op === 'gt' && !(v > x)) return false; if (op === 'gte' && !(v >= x)) return false;
        if (op === 'lt' && !(v < x)) return false; if (op === 'lte' && !(v <= x)) return false;
        if (op === 'in' && !(Array.isArray(x) && x.some(y => String(y) === String(v)))) return false;
        if (op === 'contains' && !(Array.isArray(v) ? v.map(String).includes(String(x)) : String(v ?? '').toLowerCase().includes(String(x).toLowerCase()))) return false;
        if (op === 'exists' && (x ? v === undefined || v === null || v === '' : !(v === undefined || v === null || v === ''))) return false;
      }
    }
    return true;
  }
  function checkCol(uid, col) { if (!SCHEMA[col]) throw new HttpErr(400, `Unknown collection “${col}”. Use list_collections.`); if (!canCol(uid, col)) throw new HttpErr(403, `This key’s role can’t read ${col}.`); }
  // ------------- normalising records the way the app would -------------
  function normalise(uid, col, data, prev) {
    const d = { ...(prev || {}), ...data }; const t = new Date().toISOString();
    d.updatedAt = t; d.updatedBy = uid; if (!prev) { d.createdAt = t; d.createdBy = uid; }
    const num = k => { if (d[k] !== undefined && d[k] !== null && d[k] !== '') d[k] = Number(d[k]); };
    if (col === 'products') { ['mrp', 'sellingPrice', 'costPrice', 'packagingCost', 'gstRate', 'weight', 'openingStock', 'reorderLevel', 'purchaseFactor'].forEach(num); d.status = d.status || 'active'; d.unit = d.unit || 'pc'; if (!UNIT_KEYS.includes(d.unit)) throw new HttpErr(400, 'unit must be one of: ' + UNIT_KEYS.join(', ')); if (!d.sku) { const b = store.get('brands/' + d.brandId) || {}; const code = (b.code || 'SKU').toUpperCase(); const nums = store.list('products').map(x => String(x.data.sku || '')).filter(s => s.startsWith(code + '-')).map(s => +s.split('-').pop() || 0); d.sku = code + '-' + String(Math.max(0, ...nums) + 1).padStart(4, '0'); } d.listings = d.listings || {}; }
    if (col === 'sales') { ['qty', 'unitPrice', 'actualFees'].forEach(num); const p = store.get('products/' + d.productId); if (!p) throw new HttpErr(400, 'productId doesn’t match a product.'); d.brandId = p.brandId; d.status = d.status || 'delivered'; if (d.unitPrice == null) d.unitPrice = Number(((p.listings || {})[d.platform] || {}).price) || Number(p.sellingPrice) || 0; if (!prev || prev.unitPrice !== d.unitPrice || prev.productId !== d.productId || prev.platform !== d.platform) d.calc = L.saleSnapshot(store, d, p); }
    if (col === 'moves') { ['qty', 'badQty', 'unitCost'].forEach(num); const p = store.get('products/' + d.productId); if (!p) throw new HttpErr(400, 'productId doesn’t match a product.'); d.brandId = p.brandId; d.date = d.date || L.today(); }
    if (col === 'hradj') { ['amount', 'monthly'].forEach(num); if (!ADJ_TYPES.includes(d.type)) throw new HttpErr(400, 'type must be one of: ' + ADJ_TYPES.join(', ')); if (!/^\d{4}-\d{2}$/.test(d.month || '')) throw new HttpErr(400, 'month must be YYYY-MM'); }
    if (col === 'expenses') { ['amount', 'gst'].forEach(num); d.date = d.date || L.today(); }
    if (col === 'updates') { d.by = d.by || uid; d.at = d.at || t; d.date = d.date || L.today(); }
    if (col === 'claims') { ['amount', 'received'].forEach(num); d.status = d.status || 'to_file'; }
    if (col === 'txns') { num('amount'); d.date = d.date || L.today(); }
    return d;
  }
  function write(a, ops, logEntry) {
    if (a.readOnly) throw new HttpErr(403, 'This key is read-only. Ask the CEO for a read & write key.');
    const r = writeOps(a.uid, ops, { via: 'ai', key: a.keyName });
    if (logEntry) addLog(a.uid, { ...logEntry, s: logEntry.s, d: [logEntry.d, `by AI (${a.keyName})`].filter(Boolean).join(' · '), via: 'ai' });
    return r;
  }
  const labelOf = (col, d) => d.number || d.sku || d.name || d.title || d.orderRef || d.ref || d.date || '';
  // ------------- reports -------------
  function salesSummary(uid, { from, to, by = 'platform' }) {
    from = from || L.addDays(L.today(), -29); to = to || L.today(); const g = {};
    for (const { data: s } of store.list('sales')) {
      if (!(s.date >= from && s.date <= to)) continue; const p = store.get('products/' + s.productId) || {};
      const k = by === 'product' ? (p.sku || s.productId) : by === 'brand' ? ((store.get('brands/' + p.brandId) || {}).name || '—') : by === 'day' ? s.date : s.platform;
      const f = L.saleFin(s); const o = g[k] || (g[k] = { key: k, entries: 0, units: 0, gross: 0, returns: 0, net: 0, fees: 0, settlement: 0, profit: 0 });
      o.entries++; o.units += f.units; o.gross += f.gross; o.returns += f.returns; o.net += f.taxable; o.fees += f.fees; o.settlement += f.settlement; o.profit += f.profit;
    }
    const rows = Object.values(g).map(x => { for (const k in x) if (typeof x[k] === 'number') x[k] = Math.round(x[k] * 100) / 100; if (!MODEL.ability(perms.of(uid), 'costs')) delete x.profit; return x; }).sort((a, b) => b.gross - a.gross);
    return { from, to, by, rows, total: rows.reduce((t, r) => ({ units: t.units + r.units, gross: Math.round((t.gross + r.gross) * 100) / 100 }), { units: 0, gross: 0 }) };
  }
  function stockLevels(uid, { filter = 'all' }) {
    const st = L.stock(store); const ord = {};
    for (const { data: po } of store.list('pos')) if (po.status === 'ordered' || po.status === 'partial') for (const l of po.lines || []) if (l.productId) ord[l.productId] = (ord[l.productId] || 0) + Math.max(0, Number(l.qty) - Number(l.received || 0)) * (Number(l.factor) || 1);
    const costs = MODEL.ability(perms.of(uid), 'costs');
    const rows = store.list('products').filter(x => x.data.status !== 'archived').map(({ id, data: p }) => { const on = Math.round(st.good[id] * 1000) / 1000; const rl = Number(p.reorderLevel ?? 10); return { id, sku: p.sku, name: p.name, unit: p.unit || 'pc', onHand: on, damaged: Math.round(st.bad[id] * 1000) / 1000, reorderLevel: rl, onOrder: ord[id] || 0, status: on <= 0 ? 'out' : on <= rl ? 'low' : 'ok', ...(costs ? { valueAtCost: Math.round(Math.max(0, on) * Number(p.costPrice || 0)) } : {}) }; });
    return { rows: rows.filter(r => filter === 'all' || r.status === filter || (filter === 'low' && r.status === 'out')) };
  }
  function attendanceDay({ date }) {
    const d = date || L.today();
    return { date: d, rows: store.list('employees').filter(x => x.data.status !== 'inactive').map(({ id, data: e }) => { const a = L.attToday(store, { id, ...e }, d); return { employee: e.name, code: e.code, in: a.first, out: a.lastOut, open: !!a.open, hours: Math.round(a.mins / 6) / 10, late: a.late, lateMin: a.lateMin, mark: a.mark || null, update: (a.rec && a.rec.update) || '' }; }) };
  }
  function dailySummary(uid, { date }) {
    const d = date || L.today(); const sales = store.list('sales').filter(x => x.data.date === d).map(x => x.data);
    const gross = sales.reduce((t, s) => t + L.saleFin(s).gross, 0);
    const out = { date: d, orders: sales.filter(s => s.status !== 'cancelled').length, grossSales: Math.round(gross), attendance: attendanceDay({ date: d }).rows, updates: store.list('updates').filter(x => x.data.date === d).map(x => ({ by: (store.get('members/' + x.data.by) || {}).name, category: x.data.category, text: x.data.text })), stockMoves: store.list('moves').filter(x => x.data.date === d).length, salesOrders: store.list('orders').filter(x => x.data.date === d).map(x => ({ number: x.data.number, status: x.data.status, total: x.data.total })) };
    if (canCol(uid, 'expenses')) out.expenses = store.list('expenses').filter(x => x.data.date === d).map(x => ({ category: x.data.category, vendor: x.data.vendor, amount: x.data.amount }));
    return out;
  }
  function payables(uid) {
    const out = {};
    if (canCol(uid, 'pinvoices')) { const paid = {}; for (const { data: t } of store.list('txns')) if (t.link && t.link.col === 'pinvoices') paid[t.link.id] = (paid[t.link.id] || 0) + Number(t.amount || 0); out.unpaidBills = store.list('pinvoices').map(({ id, data: b }) => ({ id, number: b.number, vendor: (store.get('suppliers/' + b.supplierId) || {}).name, date: b.date, dueDate: b.dueDate, total: Number(b.total || 0), paid: paid[id] || 0, due: Math.round((Number(b.total || 0) - (paid[id] || 0)) * 100) / 100 })).filter(x => x.due > 0.5); }
    if (canCol(uid, 'orders')) { const paid = {}; for (const { data: t } of store.list('txns')) if (t.link && t.link.col === 'orders') paid[t.link.id] = (paid[t.link.id] || 0) + Number(t.amount || 0); out.ordersBalanceDue = store.list('orders').filter(x => !['cancelled', 'quote'].includes(x.data.status)).map(({ id, data: o }) => ({ id, number: o.number, customer: o.customerName || (store.get('customers/' + o.customerId) || {}).name, total: Number(o.total || 0), paid: paid[id] || 0, due: Math.round((Number(o.total || 0) - (paid[id] || 0)) * 100) / 100, status: o.status })).filter(x => x.due > 0.5); }
    if (canCol(uid, 'claims')) out.openClaims = store.list('claims').filter(x => !['paid', 'rejected'].includes(x.data.status)).map(({ id, data: c }) => ({ id, platform: c.platform, orderRef: c.orderRef, type: c.type, amount: c.amount, status: c.status, deadline: c.deadline }));
    return out;
  }
  function overview(a) {
    const p = perms.of(a.uid); const m = store.get('members/' + a.uid) || {}; const t = L.today(); const st = stockLevels(a.uid, { filter: 'low' });
    const month = t.slice(0, 7) + '-01';
    return {
      company: (store.get('settings/company') || {}).name || 'Triagon Ventures', today: t, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, currency: 'INR',
      key: { name: a.keyName, worksAs: m.name, role: m.role, access: a.readOnly ? 'read only' : 'read & write' },
      modules: MODEL.MODULES.filter(x => MODEL.canView(p, x.k)).map(x => ({ module: x.k, name: x.l, access: MODEL.access(p, x.k) })),
      salesThisMonth: salesSummary(a.uid, { from: month, to: t }).total, salesToday: salesSummary(a.uid, { from: t, to: t }).total,
      lowStock: st.rows.slice(0, 15), attendanceToday: canCol(a.uid, 'attendance') ? attendanceDay({}).rows.map(r => ({ employee: r.employee, in: r.in, open: r.open, late: r.late, mark: r.mark })) : undefined,
      pendingDeleteRequests: store.list('deletions').filter(x => x.data.status === 'pending').length,
      openPurchaseOrders: store.list('pos').filter(x => ['ordered', 'partial'].includes(x.data.status)).length,
      openSalesOrders: store.list('orders').filter(x => ['confirmed', 'production', 'ready'].includes(x.data.status)).length,
      tips: 'Use list_collections and describe_collection to learn the data, query to read, run_report for totals, and create_record / update_record to change things. Money is INR; dates YYYY-MM-DD in India time.',
    };
  }
  // ------------- tools -------------
  const S = (props, req = []) => ({ type: 'object', properties: props, required: req, additionalProperties: false });
  const TOOLS = [
    { name: 'overview', description: 'Start here. Today’s position: sales, low stock, attendance, open orders, and what this key can access.', inputSchema: S({}), annotations: { readOnlyHint: true }, run: a => overview(a) },
    { name: 'list_collections', description: 'Lists the kinds of records in the ERP that this key can read, with counts and whether it can change them.', inputSchema: S({}), annotations: { readOnlyHint: true }, run: a => { const c = store.counts(); const p = perms.of(a.uid); return Object.entries(SCHEMA).filter(([k]) => canCol(a.uid, k)).map(([k, v]) => ({ collection: k, description: v.d, records: c[k] || 0, canWrite: !a.readOnly && !v.ro && !!MODEL.writeMods(k) && MODEL.writeMods(k).some(mm => mm === '*' || MODEL.canEdit(p, mm)) })); } },
    { name: 'describe_collection', description: 'Fields of one collection with their meaning and one recent example record. Read this before creating or updating records.', inputSchema: S({ collection: { type: 'string' } }, ['collection']), annotations: { readOnlyHint: true }, run: (a, x) => { checkCol(a.uid, x.collection); const l = store.list(x.collection); const ex = l.sort((p, q) => String(q.data.updatedAt || '').localeCompare(String(p.data.updatedAt || '')))[0]; return { collection: x.collection, description: SCHEMA[x.collection].d, fields: SCHEMA[x.collection].f, example: ex ? rec(a.uid, x.collection, ex.id, ex.data) : null }; } },
    { name: 'query', description: 'Reads records from a collection. `where` filters by field: {"status":"live"} or {"date":{"gte":"2026-11-01"}}; operators eq, ne, gt, gte, lt, lte, in, contains, exists. Dotted paths work (e.g. "listings.amazon.status"). `search` matches any text in the record.', inputSchema: S({ collection: { type: 'string' }, where: { type: 'object' }, search: { type: 'string' }, fields: { type: 'array', items: { type: 'string' } }, order_by: { type: 'string' }, desc: { type: 'boolean' }, limit: { type: 'integer', minimum: 1, maximum: 500 }, offset: { type: 'integer', minimum: 0 } }, ['collection']), annotations: { readOnlyHint: true },
      run: (a, x) => {
        checkCol(a.uid, x.collection); const q = String(x.search || '').toLowerCase();
        let l = store.list(x.collection).filter(r => match(r.data, x.where) && (!q || JSON.stringify(r.data).toLowerCase().includes(q)));
        if (x.order_by) l.sort((p, r) => { const u = getPath(p.data, x.order_by), v = getPath(r.data, x.order_by); return (u > v ? 1 : u < v ? -1 : 0) * (x.desc ? -1 : 1); });
        const total = l.length; const off = x.offset || 0; const lim = Math.min(x.limit || 50, 500);
        const rows = l.slice(off, off + lim).map(r => { const o = rec(a.uid, x.collection, r.id, r.data); if (Array.isArray(x.fields) && x.fields.length) { const s = { id: o.id }; for (const f of x.fields) s[f] = getPath(o, f); return s; } return o; });
        return { collection: x.collection, total, offset: off, returned: rows.length, records: rows };
      } },
    { name: 'get_record', description: 'One record by collection and id.', inputSchema: S({ collection: { type: 'string' }, id: { type: 'string' } }, ['collection', 'id']), annotations: { readOnlyHint: true }, run: (a, x) => { checkCol(a.uid, x.collection); const d = store.get(x.collection + '/' + x.id); if (!d) throw new HttpErr(404, 'No such record.'); return rec(a.uid, x.collection, x.id, d); } },
    { name: 'create_record', description: 'Creates a record. Check describe_collection first. Dates are YYYY-MM-DD. Linked records use ids (productId, supplierId…). Returns the new id.', inputSchema: S({ collection: { type: 'string' }, data: { type: 'object' }, id: { type: 'string' } }, ['collection', 'data']), annotations: { destructiveHint: false },
      run: (a, x) => { checkCol(a.uid, x.collection); if (SCHEMA[x.collection].ro) throw new HttpErr(403, 'This collection is read-only for AI keys.'); const id = x.id || (x.collection === 'hrprofiles' || x.collection === 'payroll' ? null : rid()); if (!id) throw new HttpErr(400, 'Give the id (employee id for hrprofiles, YYYY-MM for payroll).'); if (store.get(x.collection + '/' + id)) throw new HttpErr(409, 'A record with this id exists. Use update_record.'); const d = normalise(a.uid, x.collection, x.data, null); write(a, [{ op: 'set', path: x.collection + '/' + id, data: d }], { a: 'create', m: MOD_OF(x.collection), s: `Added ${x.collection.replace(/s$/, '')} ${labelOf(x.collection, d)}`.trim() }); return { ok: true, id, record: rec(a.uid, x.collection, id, store.get(x.collection + '/' + id)) }; } },
    { name: 'update_record', description: 'Changes fields of a record (other fields stay). Nested objects merge; arrays are replaced.', inputSchema: S({ collection: { type: 'string' }, id: { type: 'string' }, changes: { type: 'object' } }, ['collection', 'id', 'changes']),
      run: (a, x) => { checkCol(a.uid, x.collection); if (SCHEMA[x.collection].ro) throw new HttpErr(403, 'This collection is read-only for AI keys.'); const p = x.collection + '/' + x.id; const prev = store.get(p); if (!prev) throw new HttpErr(404, 'No such record.'); const merged = JSON.parse(JSON.stringify(prev)); const mergeIn = (o, c) => { for (const k in c) { if (c[k] && typeof c[k] === 'object' && !Array.isArray(c[k]) && o[k] && typeof o[k] === 'object' && !Array.isArray(o[k])) mergeIn(o[k], c[k]); else o[k] = c[k]; } }; const ch = x.changes || x.data || {}; if (!Object.keys(ch).length) throw new HttpErr(400, 'Nothing to change: pass the fields to change in “changes”.'); mergeIn(merged, ch); const d = normalise(a.uid, x.collection, merged, prev); const changed = Object.keys(ch).join(', '); write(a, [{ op: 'set', path: p, data: d }], { a: 'update', m: MOD_OF(x.collection), s: `Updated ${x.collection.replace(/s$/, '')} ${labelOf(x.collection, d)}`.trim(), d: 'Changed ' + changed }); return { ok: true, record: rec(a.uid, x.collection, x.id, store.get(p)) }; } },
    { name: 'delete_record', description: 'Deletes a record into the recycle bin if this key’s person can approve deletions; otherwise sends a delete request for approval. Always give a reason.', inputSchema: S({ collection: { type: 'string' }, id: { type: 'string' }, reason: { type: 'string' } }, ['collection', 'id', 'reason']), annotations: { destructiveHint: true },
      run: (a, x) => {
        checkCol(a.uid, x.collection); if (SCHEMA[x.collection].ro) throw new HttpErr(403, 'This collection is read-only for AI keys.'); const p = x.collection + '/' + x.id; const prev = store.get(p); if (!prev) throw new HttpErr(404, 'No such record.');
        const lbl = `${x.collection.replace(/s$/, '')} ${labelOf(x.collection, prev)}`.trim(); const t = new Date().toISOString(); const req = { col: x.collection, docId: x.id, module: MOD_OF(x.collection), label: lbl, snapshot: prev, reason: String(x.reason || '') + ' (via AI)', requestedBy: a.uid, requestedAt: t };
        if (MODEL.ability(perms.of(a.uid), 'approveDelete')) { write(a, [{ op: 'delete', path: p }, { op: 'set', path: 'deletions/' + rid(), data: { ...req, status: 'approved', direct: true, decidedBy: a.uid, decidedAt: t } }], { a: 'delete', m: req.module, s: lbl, d: 'Reason: ' + x.reason }); return { ok: true, result: 'Deleted. It is in the recycle bin (Approvals) and can be restored.' }; }
        write(a, [{ op: 'set', path: 'deletions/' + rid(), data: { ...req, status: 'pending' } }], { a: 'request', m: req.module, s: 'Asked to delete ' + lbl, d: 'Reason: ' + x.reason }); return { ok: true, result: 'Delete request sent. A manager or the CEO must approve it.' };
      } },
    { name: 'run_report', description: 'Ready-made reports: sales_summary (from, to, by: platform|product|brand|day), stock_levels (filter: all|low|out), attendance_day (date), daily_summary (date), payables_receivables, payroll_month (month YYYY-MM).', inputSchema: S({ report: { type: 'string', enum: ['sales_summary', 'stock_levels', 'attendance_day', 'daily_summary', 'payables_receivables', 'payroll_month'] }, from: { type: 'string' }, to: { type: 'string' }, by: { type: 'string' }, filter: { type: 'string' }, date: { type: 'string' }, month: { type: 'string' } }, ['report']), annotations: { readOnlyHint: true },
      run: (a, x) => {
        if (x.report === 'sales_summary') return salesSummary(a.uid, x);
        if (x.report === 'stock_levels') return stockLevels(a.uid, x);
        if (x.report === 'attendance_day') { checkCol(a.uid, 'attendance'); return attendanceDay(x); }
        if (x.report === 'daily_summary') return dailySummary(a.uid, x);
        if (x.report === 'payables_receivables') return payables(a.uid);
        if (x.report === 'payroll_month') { checkCol(a.uid, 'payroll'); const d = store.get('payroll/' + (x.month || L.today().slice(0, 7))); return d || { note: 'No payroll prepared for that month yet.' }; }
        throw new HttpErr(400, 'Unknown report');
      } },
    { name: 'post_update', description: 'Posts a team update for today’s daily report.', inputSchema: S({ text: { type: 'string' }, category: { type: 'string' } }, ['text']),
      run: (a, x) => { const id = rid(); const d = normalise(a.uid, 'updates', { text: String(x.text).slice(0, 1200), category: x.category || 'General' }, null); write(a, [{ op: 'set', path: 'updates/' + id, data: d }], { a: 'create', m: 'daily', s: 'Posted an update', d: String(x.text).slice(0, 160) }); return { ok: true, id }; } },
  ];
  const TOOLMAP = Object.fromEntries(TOOLS.map(t => [t.name, t]));
  const listTools = () => TOOLS.map(({ run, ...t }) => t);
  async function readJSON(req) { const chunks = []; for await (const c of req) { chunks.push(c); if (chunks.reduce((n, b) => n + b.length, 0) > 2e6) throw new HttpErr(413, 'Too large'); } const s = Buffer.concat(chunks).toString('utf8'); try { return s ? JSON.parse(s) : {}; } catch (e) { throw new HttpErr(400, 'Bad JSON'); } }
  function rpc(a, msg) {
    const id = msg.id; const ok = result => ({ jsonrpc: '2.0', id, result }); const err = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });
    if (msg.jsonrpc !== '2.0' || !msg.method) return err(-32600, 'Invalid request');
    switch (msg.method) {
      case 'initialize': { const v = (msg.params || {}).protocolVersion; return ok({ protocolVersion: ['2025-06-18', '2025-03-26', '2024-11-05'].includes(v) ? v : '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: 'triagon-erp', title: 'Triagon ERP', version: VERSION }, instructions: 'You are connected to Triagon Ventures’ ERP (crafts e-commerce: leather, pottery, craft tools; catalogue & marketplace listings, inventory & purchasing, sales orders, returns & claims, finance & accounts, marketing & offers, attendance, HR & payroll). The access key works as one team member: their role and permissions apply and every change is recorded in the activity log. Start with `overview`, use `list_collections` and `describe_collection` before writing, `query` to read and `run_report` for totals. Money is INR, dates YYYY-MM-DD in India time. Confirm with the person before deleting or making large changes.' }); }
      case 'notifications/initialized': case 'notifications/cancelled': return null;
      case 'ping': return ok({});
      case 'tools/list': return ok({ tools: listTools() });
      case 'tools/call': {
        const t = TOOLMAP[(msg.params || {}).name]; if (!t) return err(-32602, 'Unknown tool');
        try { const r = t.run(a, (msg.params || {}).arguments || {}); return ok({ content: [{ type: 'text', text: JSON.stringify(r, null, 1) }], structuredContent: Array.isArray(r) ? { items: r } : r, isError: false }); }
        catch (e) { return ok({ content: [{ type: 'text', text: e.message || 'Failed' }], isError: true }); }
      }
      case 'resources/list': return ok({ resources: [] });
      case 'prompts/list': return ok({ prompts: [] });
      default: return id === undefined ? null : err(-32601, 'Method not found');
    }
  }
  async function handle(req, res, a) {
    const deny = () => { res.writeHead(401, { 'Content-Type': 'application/json', 'WWW-Authenticate': 'Bearer realm="triagon-erp"' }); res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'A valid Triagon ERP access key is needed. Create one in Users & permissions → AI & API access.' } })); };
    if (!a || a.kind !== 'key') return deny();
    const body = await readJSON(req); const msgs = Array.isArray(body) ? body : [body];
    const out = msgs.map(m => rpc(a, m)).filter(Boolean);
    if (!out.length) { res.writeHead(202); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(Array.isArray(body) ? out : out[0]));
  }
  async function rest(req, res, a, action, p) {
    if (!a || a.kind !== 'key') { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Send an access key: Authorization: Bearer tvk_…' })); return; }
    const sendJ = (st, o) => { res.writeHead(st, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
    try {
      const q = Object.fromEntries(new URL(req.url, 'http://x').searchParams);
      if (action === 'list') { const where = {}; for (const k in q) if (!['limit', 'offset', 'order_by', 'desc', 'search'].includes(k)) where[k] = q[k]; return sendJ(200, TOOLMAP.query.run(a, { collection: p.col, where, limit: +q.limit || 50, offset: +q.offset || 0, order_by: q.order_by, desc: q.desc === '1' || q.desc === 'true', search: q.search })); }
      if (action === 'get') return sendJ(200, TOOLMAP.get_record.run(a, { collection: p.col, id: p.id }));
      const body = action === 'delete' ? {} : await readJSON(req);
      if (action === 'create') return sendJ(201, TOOLMAP.create_record.run(a, { collection: p.col, data: body }));
      if (action === 'update') return sendJ(200, TOOLMAP.update_record.run(a, { collection: p.col, id: p.id, changes: body }));
      if (action === 'delete') return sendJ(200, TOOLMAP.delete_record.run(a, { collection: p.col, id: p.id, reason: q.reason || 'Deleted through the API' }));
    } catch (e) { sendJ(e.status || 500, { error: e.message }); }
  }
  return { handle, rest, TOOLS, SCHEMA };
};
