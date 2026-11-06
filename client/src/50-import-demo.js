/* =====================================================================
   Imports, demo data, event wiring, boot
   ===================================================================== */
const IMPORT = {
  products: { title: 'Import products', cols: 'sku,name,brand_code,category,variant,mrp,selling_price,cost_price,packaging_cost,gst_rate,hsn,weight_g,opening_stock,reorder_level,location,status', help: 'Brand is matched by brand code or name. Rows with an existing SKU update that product; blank cells keep the current value.' },
  sales: { title: 'Import sales', cols: 'date,platform,sku,qty,unit_price,status,order_ref,actual_fees', help: 'Dates as YYYY-MM-DD or DD-MM-YYYY. Platform by name (Amazon, Flipkart…). Status: delivered, in transit, returned or cancelled; blank means delivered. Blank unit price uses the product’s price.' },
};
let IMP = null;
function parseCSV(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) { const ch = text[i]; if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; } else if (ch === '"') q = true; else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch; }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim()));
}
function normDate(s) { s = String(s || '').trim(); let m; if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`; if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`; return null; }
function openImport(kind) {
  const cfg = IMPORT[kind]; IMP = { kind, ok: [], errs: [] };
  openDrawer({
    title: cfg.title, sub: 'Paste CSV text or choose a .csv file. The first row must be the column names.', noFocus: true, saveLabel: 'Import', savedMsg: null,
    html: `<div class="fld" style="margin-bottom:12px"><span class="lab">Columns</span><code class="mono" style="display:block;padding:8px 10px;background:var(--sunken);border-radius:7px;overflow-x:auto;white-space:nowrap">${esc(cfg.cols)}</code><div class="help">${esc(cfg.help)}</div><div><button type="button" class="btn sm ghost" data-act="imptemplate">${icon('copy')}Copy column row</button></div></div>
      <div class="fld" style="margin-bottom:12px"><label for="impFile">CSV file</label><input type="file" id="impFile" accept=".csv,text/csv" data-ch="impfile"></div>
      <div class="fld"><label for="impText">Or paste CSV</label><textarea class="inp mono" id="impText" rows="9" placeholder="${esc(cfg.cols)}"></textarea></div>
      <div style="margin-top:10px">${btn('Check rows', 'impcheck', { sm: true })}</div><div id="impOut" style="margin-top:12px"></div>`,
    onSave: async () => { checkImport(); if (!IMP.ok.length) { toast('Nothing to import yet. Paste rows and check them first.', 'bad'); return false; } await runImport(); return true; },
  });
}
function checkImport() {
  const text = ($('#impText') || {}).value || ''; const rows = parseCSV(text); IMP.ok = []; IMP.errs = [];
  if (!rows.length) { $('#impOut').innerHTML = ''; return; }
  const head = rows[0].map(h => h.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')); const idx = k => head.indexOf(k);
  const get = (r, k) => { const i = idx(k); return i < 0 ? '' : String(r[i] ?? '').trim(); };
  const numv = v => v === '' ? undefined : Number(String(v).replace(/[₹,\s]/g, ''));
  rows.slice(1).forEach((r, n) => {
    const line = n + 2;
    if (IMP.kind === 'products') {
      const sku = get(r, 'sku').toUpperCase(), name = get(r, 'name'); const bc = get(r, 'brand_code') || get(r, 'brand');
      const b = S.brands.find(x => String(x.code || '').toLowerCase() === bc.toLowerCase() || String(x.name || '').toLowerCase() === bc.toLowerCase());
      const ex = sku && S.products.find(p => String(p.sku || '').toUpperCase() === sku);
      if (!ex && !name) return IMP.errs.push(`Row ${line}: name is required for a new product.`);
      if (!ex && !b) return IMP.errs.push(`Row ${line}: brand “${bc}” not found. Add the brand first.`);
      const vals = { name, category: get(r, 'category'), variant: get(r, 'variant'), mrp: numv(get(r, 'mrp')), sellingPrice: numv(get(r, 'selling_price')), costPrice: allow('costs') ? numv(get(r, 'cost_price')) : undefined, packagingCost: numv(get(r, 'packaging_cost')), gstRate: numv(get(r, 'gst_rate')), hsn: get(r, 'hsn'), weight: numv(get(r, 'weight_g')), openingStock: numv(get(r, 'opening_stock')), reorderLevel: numv(get(r, 'reorder_level')), location: get(r, 'location'), status: (get(r, 'status') || '').toLowerCase() };
      for (const k in vals) if (vals[k] === '' || vals[k] === undefined || (typeof vals[k] === 'number' && !Number.isFinite(vals[k]))) delete vals[k];
      if (vals.status && !['active', 'draft', 'archived'].includes(vals.status)) delete vals.status;
      IMP.ok.push({ ex, sku, brandId: b ? b.id : ex.brandId, vals });
    } else {
      const date = normDate(get(r, 'date')); const pn = get(r, 'platform').toLowerCase(); const pl = platforms().find(p => p.key === pn || p.name.toLowerCase() === pn || String(p.code || '').toLowerCase() === pn);
      const p = S.products.find(x => String(x.sku || '').toUpperCase() === get(r, 'sku').toUpperCase()); const qty = Math.round(numv(get(r, 'qty')) || 0);
      const sm = { delivered: 'delivered', 'in transit': 'transit', transit: 'transit', shipped: 'transit', returned: 'returned', return: 'returned', rto: 'returned', cancelled: 'cancelled', canceled: 'cancelled' }; const st = sm[get(r, 'status').toLowerCase()] || (get(r, 'status') ? null : 'delivered');
      if (!date) return IMP.errs.push(`Row ${line}: date “${get(r, 'date')}” isn’t a date.`); if (!pl) return IMP.errs.push(`Row ${line}: platform “${get(r, 'platform')}” not found.`);
      if (!p) return IMP.errs.push(`Row ${line}: SKU “${get(r, 'sku')}” not in the catalogue.`); if (qty < 1) return IMP.errs.push(`Row ${line}: quantity must be 1 or more.`); if (!st) return IMP.errs.push(`Row ${line}: status “${get(r, 'status')}” not recognised.`);
      const up = numv(get(r, 'unit_price')); const unitPrice = Number.isFinite(up) && up > 0 ? up : (N(((p.listings || {})[pl.key] || {}).price) || N(p.sellingPrice)); const af = numv(get(r, 'actual_fees'));
      IMP.ok.push({ doc: { date, platform: pl.key, productId: p.id, brandId: p.brandId, qty, unitPrice, status: st, restocked: true, orderRef: get(r, 'order_ref'), actualFees: Number.isFinite(af) ? af : null, calc: saleSnapshot({ unitPrice }, p, pl) } });
    }
  });
  const upd = IMP.ok.filter(x => x.ex).length;
  $('#impOut').innerHTML = `<div class="banner ${IMP.errs.length ? 'warn' : 'acc'}"><span><b>${num(IMP.ok.length)} rows ready</b>${upd ? ` (${upd} update existing products)` : ''}${IMP.errs.length ? `, ${IMP.errs.length} skipped` : ''}.</span></div>${IMP.errs.length ? `<ul class="muted" style="font-size:12.5px;margin:10px 0 0;padding-left:18px">${IMP.errs.slice(0, 20).map(e => `<li>${esc(e)}</li>`).join('')}${IMP.errs.length > 20 ? `<li>…and ${IMP.errs.length - 20} more</li>` : ''}</ul>` : ''}`;
}
async function pool(items, n, fn, onProg) { let i = 0, done = 0; const workers = Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const it = items[i++]; await fn(it); done++; if (onProg) onProg(done, items.length); } }); await Promise.all(workers); }
async function runImport() {
  const kind = IMP.kind; const items = IMP.ok.slice(); const now = nowISO(); const counters = {};
  const docs = items.map(x => {
    if (kind === 'products') {
      if (x.ex) return ['products/' + x.ex.id, clean({ ...base(x.ex), ...x.vals, updatedAt: now, updatedBy: ME.id })];
      const bid = x.brandId; let sku = x.sku; if (!sku) { const b = brandOf(bid); const code = (b.code || 'SKU').toUpperCase(); counters[code] = counters[code] || +(nextSku(bid).split('-').pop()) - 1; counters[code]++; sku = code + '-' + String(counters[code]).padStart(4, '0'); }
      return ['products/' + newId('products'), clean({ status: 'active', gstRate: 18, reorderLevel: 10, ...x.vals, sku, brandId: bid, listings: {}, createdAt: now, createdBy: ME.id, updatedAt: now, updatedBy: ME.id })];
    }
    return ['sales/' + newId('sales'), clean({ ...x.doc, createdAt: now, createdBy: ME.id, updatedAt: now, updatedBy: ME.id })];
  });
  toast(`Importing ${docs.length} rows…`);
  await pool(docs, 3, ([path, d]) => dbWrite('set', path, d), (d, t) => { if (d % 10 === 0 || d === t) toast(`Importing… ${d} of ${t}`); });
  addLog('import', kind === 'products' ? 'catalogue' : 'finance', `Imported ${docs.length} ${kind === 'products' ? 'products' : 'sales entries'} from CSV`, `${items.filter(x => x.ex).length} updated, ${IMP.errs.length} rows skipped`);
  toast(`Imported ${docs.length} ${kind === 'products' ? 'products' : 'sales entries'}`);
}

/* ---------- demo data ---------- */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function demoData() {
  const R = rng(20261008); const pick = a => a[Math.floor(R() * a.length)]; const T = TODAY(); const D = n => addDays(T, -n);
  const brands = [
    { id: 'demo-b1', name: 'Hidecraft', code: 'HDC', category: 'Leather hides & sheets', status: 'Active', color: 'c7', tagline: 'Genuine leather for makers', launchDate: '2023-04-10', tmStatus: 'Registered', tmClass: '18' },
    { id: 'demo-b2', name: 'Clayroot', code: 'CLR', category: 'Pottery & ceramics', status: 'Active', color: 'c4', tagline: 'Clay, glaze and tools for studio potters', launchDate: '2024-01-15', tmStatus: 'Filed', tmClass: '21' },
    { id: 'demo-b3', name: 'Craftbench', code: 'CBT', category: 'Craft tools & kits', status: 'Active', color: 'c3', tagline: 'Tools that last a lifetime of projects', launchDate: '2024-08-01', tmStatus: 'Objected', tmClass: '8' },
    { id: 'demo-b4', name: 'Threadwise', code: 'TWS', category: 'Textile crafts', status: 'Launching', color: 'c5', tagline: 'Cords and threads for macramé and stitching', launchDate: D(40), tmStatus: 'Not filed', tmClass: '23' },
  ];
  const suppliers = [
    { id: 'demo-v1', name: 'Ambur Tanning Works', contact: 'Rafiq Ahmed', phone: '+91 90000 00101', email: 'sales@example.com', gstin: '33AAAAA0000A1Z5', city: 'Ambur', state: 'Tamil Nadu', terms: '30 days', leadTime: 7, categories: 'Vegetable-tanned hides, crust leather' },
    { id: 'demo-v2', name: 'Chennai Leather Exports', contact: 'S. Karthikeyan', phone: '+91 90000 00201', email: 'orders@example.com', gstin: '33BBBBB0000B1Z5', city: 'Chennai', state: 'Tamil Nadu', terms: '15 days', leadTime: 5, categories: 'Finished sheets, suede, scraps' },
    { id: 'demo-v3', name: 'Khurja Clay & Glaze Co.', contact: 'Anil Gupta', phone: '+91 90000 00301', email: 'clay@example.com', gstin: '09AAAAA0000A1Z5', city: 'Khurja', state: 'Uttar Pradesh', terms: 'Advance', leadTime: 12, categories: 'Stoneware clay, glazes, kiln shelves' },
    { id: 'demo-v4', name: 'Ningbo Toolsmith', contact: 'Kevin Zhou', phone: '+86 574 0000 0401', email: 'tools@example.com', city: 'Ningbo', state: 'Outside India', terms: 'Advance', leadTime: 28, categories: 'Leathercraft tools, punches, chisels' },
    { id: 'demo-v5', name: 'Coimbatore Cotton Cords', contact: 'Meena Rajan', phone: '+91 90000 00501', email: 'cords@example.com', gstin: '33CCCCC0000C1Z5', city: 'Coimbatore', state: 'Tamil Nadu', terms: '30 days', leadTime: 6, categories: 'Macramé cord, waxed thread' },
  ];
  const L = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, { status: v[0], id: v[1] || '', price: v[2] ?? null }]));
  const full = (t, b, d, k, im) => ({ title: t, bullets: b.join('\n'), description: d, keywords: k, images: im });
  const P = [
    ['demo-p1', 'demo-b1', 'HDC-0001', 'Veg-tanned leather sheet, A4', 'Tan / 2 mm', 'Leather sheet / panel', 799, 549, 165, 150, 5, '4107', L({ amazon: ['live', 'B0DEMO1001'], flipkart: ['live', 'LTHDEMO1001'], meesho: ['live', 'DM1001', 529], website: ['live', 'veg-tan-a4-2mm'] }), full('Hidecraft Vegetable Tanned Leather Sheet A4 Size, 2 mm Thick, Tan, Genuine Cowhide for Leathercraft, Wallets and Belts', ['Full-grain veg-tanned cowhide, 2 mm (5 oz)', 'A4 size, 21 × 29.7 cm, cut from the prime back', 'Takes tooling, stamping, dye and burnishing well', 'Ships flat in a rigid mailer, no folds'], 'A prime-cut vegetable-tanned leather sheet for wallets, card holders, straps and tooling practice. The firm temper holds edges for burnishing and darkens to a rich patina with use.', 'veg tan leather, leather sheet, leathercraft, cowhide, tooling leather, a4 leather', 7), 'demo-v1'],
    ['demo-p2', 'demo-b1', 'HDC-0002', 'Genuine leather hide, full side', 'Brown / 1.8 mm / ~20 sq ft', 'Leather hide', 6999, 4299, 2650, 2400, 5, '4107', L({ amazon: ['live', 'B0DEMO1002'], website: ['live', 'full-side-brown'], b2b: ['live', 'HIDE-FS-BR'] }), full('Hidecraft Genuine Leather Full Side Hide, Brown, 1.8 mm, About 20 sq ft', ['About 20 sq ft per side', 'Even 1.8 mm thickness', 'Semi-aniline finish'], 'A full side of brown semi-aniline leather for bags and upholstery projects.', 'leather hide, full side, cowhide, bag leather', 5), 'demo-v1'],
    ['demo-p3', 'demo-b1', 'HDC-0003', 'Crazy horse leather sheet, 12 × 12 in', 'Dark brown / 1.6 mm', 'Leather sheet / panel', 1299, 849, 260, 200, 5, '4107', L({ amazon: ['live', 'B0DEMO1003'], flipkart: ['inactive', 'LTHDEMO1003'], website: ['live', 'crazy-horse-12'] }), full('Hidecraft Crazy Horse Leather Sheet 12 x 12 inch, Dark Brown, 1.6 mm, Oil Pull-Up', ['Oil pull-up finish', 'Hand-picked, minimal scars', '12 × 12 inch square'], 'Waxy pull-up leather that lightens where it bends and scratches, then heals back with a rub. Popular for rugged wallets and notebook covers.', 'crazy horse leather, pull up leather, leather square, dark brown leather', 6), 'demo-v2'],
    ['demo-p4', 'demo-b1', 'HDC-0004', 'Suede leather scraps, 500 g', 'Assorted colours', 'Leather scraps', 699, 449, 90, 520, 5, '4115', L({ meesho: ['live', 'DM1004'], amazon: ['live', 'B0DEMO1004'], flipkart: ['suppressed', 'LTHDEMO1004'] }), full('Hidecraft Suede Leather Scraps 500g', ['Mixed colours'], '', 'leather scraps', 3), 'demo-v2'],
    ['demo-p5', 'demo-b1', 'HDC-0005', 'Leather dye, 100 ml', 'Black', 'Dye & finish', 599, 399, 95, 140, 18, '3204', L({ amazon: ['live', 'B0DEMO1005'], website: ['live', 'leather-dye-black'] }), {}, 'demo-v2'],
    ['demo-p6', 'demo-b2', 'CLR-0001', 'Stoneware pottery clay, 5 kg', 'White / cone 6', 'Pottery clay', 1199, 899, 310, 5200, 5, '2508', L({ amazon: ['live', 'B0DEMO2001'], flipkart: ['live', 'CLYDEMO2001'], website: ['live', 'stoneware-clay-5kg'], b2b: ['live', 'CLAY-SW-5'] }), full('Clayroot White Stoneware Pottery Clay 5 kg, Cone 6, for Wheel Throwing and Hand Building', ['Fires white at cone 6 (1220 °C)', 'Smooth, plastic body for wheel throwing', 'De-aired and ready to use', 'Vacuum-sealed 5 kg pack'], 'A smooth white stoneware body that throws tall and holds detail for hand building. De-aired and vacuum packed so it arrives ready to wedge and use.', 'pottery clay, stoneware clay, wheel throwing clay, ceramic clay, white clay', 6), 'demo-v3'],
    ['demo-p7', 'demo-b2', 'CLR-0002', 'Air-dry modelling clay, 1 kg', 'Terracotta', 'Pottery clay', 499, 349, 95, 1050, 5, '2508', L({ meesho: ['live', 'DM2002', 329], amazon: ['live', 'B0DEMO2002'] }), full('Clayroot Air Dry Clay 1kg Terracotta', ['No kiln needed'], 'Air-dry clay.', 'air dry clay, modelling clay', 4), 'demo-v3'],
    ['demo-p8', 'demo-b2', 'CLR-0003', 'Pottery glaze set, 6 colours', '6 × 100 ml', 'Glaze & colour', 1899, 1349, 420, 900, 18, '3207', L({ amazon: ['live', 'B0DEMO2003'], website: ['live', 'glaze-set-6'] }), full('Clayroot Pottery Glaze Set, 6 Colours x 100 ml, Food Safe, Cone 06 to 6', ['Six brushable glazes', 'Lead-free and food safe', 'Fires from cone 06 to 6'], 'Six brushable glazes in earthy and ocean tones. Lead-free, food safe and stable across a wide firing range.', 'pottery glaze, ceramic glaze, glaze set, food safe glaze', 5), 'demo-v3'],
    ['demo-p9', 'demo-b2', 'CLR-0004', 'Pottery tool kit, 11 pieces', 'Wood and steel', 'Pottery tool', 799, 549, 120, 300, 18, '8205', L({ amazon: ['live', 'B0DEMO2004'], meesho: ['live', 'DM2004'], flipkart: ['live', 'TLKDEMO2004'] }), {}, 'demo-v4'],
    ['demo-p10', 'demo-b3', 'CBT-0001', 'Leathercraft starter kit, 32 pieces', 'With stitching chisels', 'Leathercraft kit', 2999, 1899, 640, 1200, 18, '8205', L({ amazon: ['live', 'B0DEMO3001'], flipkart: ['live', 'KITDEMO3001'], website: ['live', 'leathercraft-starter-kit'] }), full('Craftbench Leathercraft Starter Kit, 32 Pieces, with Stitching Chisels, Edge Beveller, Needles and Waxed Thread', ['Everything to stitch your first wallet', 'Diamond chisels in 1, 2, 4 and 6 prong', 'Edge beveller, slicker and awl', 'Storage case included'], 'A complete starter kit for hand-stitched leatherwork: chisels, needles, thread, beveller, slicker and a cutting mat, packed in a sturdy case.', 'leathercraft kit, leather tools, stitching chisel, leather working kit, diy leather', 8), 'demo-v4'],
    ['demo-p11', 'demo-b3', 'CBT-0002', 'Diamond stitching chisel set, 4 mm', '1 / 2 / 4 / 6 prong', 'Leathercraft tool', 1199, 799, 210, 250, 18, '8205', L({ amazon: ['live', 'B0DEMO3002'], website: ['live', 'diamond-chisel-4mm'] }), full('Craftbench Diamond Stitching Chisels 4mm, Set of 4', ['Hardened steel'], 'Hardened steel chisels.', 'stitching chisel, pricking iron', 4), 'demo-v4'],
    ['demo-p12', 'demo-b3', 'CBT-0003', 'Edge beveller and slicker set', 'Size 1 to 3', 'Leathercraft tool', 899, 599, 150, 180, 18, '8205', L({ meesho: ['live', 'DM3003'], flipkart: ['live', 'TLKDEMO3003'], amazon: ['inactive', 'B0DEMO3003'] }), {}, 'demo-v4'],
    ['demo-p13', 'demo-b4', 'TWS-0001', 'Macramé cotton cord, 3 mm × 200 m', 'Natural', 'Craft supply', 999, 649, 220, 900, 5, '5607', L({ amazon: ['live', 'B0DEMO4001'], website: ['live', 'macrame-cord-3mm'] }), full('Threadwise Macrame Cotton Cord 3mm x 200m, Natural, Single Strand', ['Soft single-strand cotton', 'Combs out for fringe'], 'Soft single-strand cotton cord.', 'macrame cord, cotton cord', 5), 'demo-v5'],
    ['demo-p14', 'demo-b4', 'TWS-0002', 'Waxed polyester thread, 0.8 mm', '150 m / Black', 'Thread & needles', 399, 249, 55, 90, 5, '5401', L({ meesho: ['live', 'DM4002'], amazon: ['draft', ''] }), {}, 'demo-v5'],
  ];
  const products = P.map(([id, brandId, sku, name, variant, category, mrp, sp, cost, weight, gst, hsn, listings, content, supplierId]) => ({ id, brandId, sku, name, variant, category, mrp, sellingPrice: sp, costPrice: cost, packagingCost: weight > 1000 ? 35 : weight > 300 ? 20 : 12, weight, gstRate: gst, hsn, listings, supplierId, status: 'active', reorderLevel: sp > 1500 ? 6 : 15, location: 'Erode warehouse · Rack ' + 'ABCD'[(+id.slice(6)) % 4] + (1 + (+id.slice(6)) % 6), ...content }));
  const pr = id => products.find(p => p.id === id);
  const customers = [['Leatherline Studio', 'Bengaluru', 'Karnataka', 'b2b', 'Wholesale'], ['Arjun Mehta', 'Pune', 'Maharashtra', 'amazon', ''], ['Sneha Kulkarni', 'Bengaluru', 'Karnataka', 'website', 'Repeat'], ['Mohammed Irfan', 'Hyderabad', 'Telangana', 'amazon', ''], ['Kavya Nair', 'Kochi', 'Kerala', 'website', 'Workshop'], ['Mud & Fire Pottery', 'Auroville', 'Puducherry', 'b2b', 'Wholesale'], ['Divya Subramanian', 'Chennai', 'Tamil Nadu', 'website', 'Repeat'], ['Ankit Verma', 'Lucknow', 'Uttar Pradesh', 'flipkart', ''], ['Meera Iyer', 'Salem', 'Tamil Nadu', 'website', 'Workshop'], ['Farhan Qureshi', 'Mumbai', 'Maharashtra', 'amazon', ''], ['Lakshmi Prasad', 'Vijayawada', 'Andhra Pradesh', 'meesho', ''], ['Erode Craft School', 'Erode', 'Tamil Nadu', 'b2b', 'Wholesale, Institution']]
    .map(([name, city, state, source, tags], i) => ({ id: 'demo-c' + (i + 1), name, city, state, source, tags, phone: '+91 90000 001' + pad(i + 1), email: name.split(' ')[0].toLowerCase().replace(/[^a-z]/g, '') + '@example.com', notes: tags.includes('Wholesale') ? 'Buys in bulk for their studio and students.' : '' }));
  const sales = []; const plat = k => DEFAULT_PLATFORMS.find(p => p.key === k);
  const weights = { 'demo-p1': 10, 'demo-p2': 3, 'demo-p3': 5, 'demo-p4': 5, 'demo-p5': 3, 'demo-p6': 6, 'demo-p7': 5, 'demo-p8': 3, 'demo-p9': 4, 'demo-p10': 5, 'demo-p11': 3, 'demo-p12': 3, 'demo-p13': 3, 'demo-p14': 2 };
  const bag = []; Object.entries(weights).forEach(([k, w]) => { for (let i = 0; i < w; i++) bag.push(k); });
  for (let i = 0; i < 520; i++) {
    const days = i < 6 ? 0 : Math.floor(Math.pow(R(), 1.25) * 178); const p = pr(pick(bag)); if (p.brandId === 'demo-b4' && days > 38) continue;
    const lives = Object.entries(p.listings).filter(([, l]) => l.status === 'live').map(([k]) => k).filter(k => plat(k) && plat(k).on); if (!lives.length) continue;
    const pk = pick(lives); const lp = p.listings[pk].price || p.sellingPrice; const unitPrice = pk === 'b2b' ? Math.round(lp * .82) : days < 25 && R() < .5 ? Math.round(lp * .9) : lp;
    const qty = pk === 'website' ? 1 + Math.floor(R() * 3) : pk === 'b2b' ? 10 + Math.floor(R() * 30) : 2 + Math.floor(R() * 10); const x = R();
    const status = days < 6 && x < .35 ? 'transit' : x < .07 ? 'returned' : x < .1 ? 'cancelled' : 'delivered'; const cust = pk === 'b2b' ? pick(customers.filter(c => c.source === 'b2b')) : R() < .3 ? pick(customers) : null;
    const s = { id: 'demo-s' + (i + 1), date: D(days), platform: pk, productId: p.id, brandId: p.brandId, qty, unitPrice, status, restocked: status === 'returned' ? R() < .8 : true, orderRef: plat(pk).code + '-' + String(Math.floor(R() * 9e6 + 1e6)), customerId: cust ? cust.id : null };
    s.calc = saleSnapshot(s, p, plat(pk)); sales.push(s);
  }
  const PO = [
    { id: 'demo-po1', number: 'PO-' + fyShort() + '-0001', supplierId: 'demo-v1', date: D(80), expectedDate: D(73), status: 'received', lines: [{ productId: 'demo-p1', qty: 200, cost: 160, received: 200 }, { productId: 'demo-p2', qty: 20, cost: 2600, received: 20 }] },
    { id: 'demo-po2', number: 'PO-' + fyShort() + '-0002', supplierId: 'demo-v3', date: D(50), expectedDate: D(38), status: 'received', lines: [{ productId: 'demo-p6', qty: 80, cost: 300, received: 80 }, { productId: 'demo-p8', qty: 30, cost: 410, received: 30 }] },
    { id: 'demo-po3', number: 'PO-' + fyShort() + '-0003', supplierId: 'demo-v4', date: D(30), expectedDate: D(2), status: 'partial', lines: [{ productId: 'demo-p10', qty: 60, cost: 630, received: 35 }, { productId: 'demo-p11', qty: 40, cost: 205, received: 0 }] },
    { id: 'demo-po4', number: 'PO-' + fyShort() + '-0004', supplierId: 'demo-v2', date: D(9), expectedDate: D(-2), status: 'ordered', lines: [{ productId: 'demo-p3', qty: 80, cost: 255, received: 0 }, { productId: 'demo-p4', qty: 100, cost: 88, received: 0 }] },
    { id: 'demo-po5', number: 'PO-' + fyShort() + '-0005', supplierId: 'demo-v5', date: T, expectedDate: D(-6), status: 'draft', lines: [{ productId: 'demo-p13', qty: 60, cost: 215, received: 0 }, { productId: 'demo-p14', qty: 120, cost: 52, received: 0 }] },
  ];
  const moves = [];
  [['demo-po1', 72], ['demo-po2', 37], ['demo-po3', 0]].forEach(([poId, days]) => { const po = PO.find(x => x.id === poId); po.lines.forEach((l, i) => { if (l.received) moves.push({ id: poId + '-m' + i, productId: l.productId, brandId: pr(l.productId).brandId, type: 'purchase', qty: l.received, entered: l.received, date: D(days), unitCost: l.cost, supplier: suppliers.find(s => s.id === po.supplierId).name, ref: po.number, poId }); }); });
  moves.push({ id: 'demo-m4', productId: 'demo-p6', brandId: 'demo-b2', type: 'damaged', qty: -3, entered: 3, date: D(22), ref: 'QC write-off', note: 'Bags split in transit, clay dried out' }, { id: 'demo-m5', productId: 'demo-p1', brandId: 'demo-b1', type: 'adjust_remove', qty: -4, entered: 4, date: D(0), ref: 'Photo samples', note: 'Cut for new listing photos' });
  const targets = { 'demo-p1': 70, 'demo-p2': 4, 'demo-p3': 9, 'demo-p4': 30, 'demo-p5': 22, 'demo-p6': 26, 'demo-p7': 48, 'demo-p8': 3, 'demo-p9': 35, 'demo-p10': 18, 'demo-p11': 0, 'demo-p12': 14, 'demo-p13': 21, 'demo-p14': 60 };
  products.forEach(p => { const out = sum(sales.filter(s => s.productId === p.id), saleStockOut); const mv = sum(moves.filter(m => m.productId === p.id), m => m.qty); p.openingStock = Math.max(0, out - mv + targets[p.id]); });
  const recurring = [
    { id: 'demo-r1', name: 'Warehouse and office rent, Erode', category: 'Rent & utilities', vendor: 'Warehouse landlord', amount: 18000, gst: 0, frequency: 'monthly', day: 1, autoPost: true, paidVia: 'Bank transfer' },
    { id: 'demo-r2', name: 'Team salaries', category: 'Salaries & wages', vendor: 'Payroll', amount: 64000, gst: 0, frequency: 'monthly', day: 28, autoPost: false, paidVia: 'Bank transfer' },
    { id: 'demo-r3', name: 'Shiprocket, Canva and Zoho Books', category: 'Software & subscriptions', vendor: 'Various', amount: 3400, gst: 612, frequency: 'monthly', day: 3, autoPost: true, paidVia: 'Card' },
    { id: 'demo-r4', name: 'EB bill and broadband', category: 'Rent & utilities', vendor: 'TNEB, ACT Fibernet', amount: 5200, gst: 432, frequency: 'monthly', day: 10, autoPost: false, paidVia: 'UPI' },
    { id: 'demo-r5', name: 'Chartered accountant retainer', category: 'Professional fees', vendor: 'Sundaram & Co.', amount: 9000, gst: 1620, frequency: 'quarterly', day: 15, autoPost: false, paidVia: 'Bank transfer' },
    { id: 'demo-r6', name: 'Stock and fire insurance', category: 'Insurance', vendor: 'New India Assurance', amount: 14500, gst: 2610, frequency: 'yearly', day: 1, autoPost: false, paidVia: 'Bank transfer' },
  ];
  const start = monthsBack(6)[0] + '-01';
  const fyY = parseD(T).getMonth() >= 3 ? parseD(T).getFullYear() : parseD(T).getFullYear() - 1;
  recurring.forEach(r => { r.startDate = r.id === 'demo-r6' ? (+T.slice(0, 4) - 1) + '-10-01' : r.id === 'demo-r5' ? fyY + '-04-15' : start; r.active = true; });
  const expenses = []; let e = 0;
  recurring.forEach(r => { let ds = dueDates(r, r.startDate, T, 40); if (r.id === 'demo-r3') ds = ds.filter(d => d < addMonths(T, 0).slice(0, 8) + '01'); if (r.id === 'demo-r6') ds = ds.filter(d => d < String(+T.slice(0, 4)) + '-01-01'); ds.forEach(d => expenses.push({ id: 'rec-' + r.id + '-' + d, date: d, category: r.category, amount: r.amount, gst: r.gst, brandId: null, vendor: r.vendor, paidVia: r.paidVia, note: r.name + ' (' + freqOf(r.frequency)[1].toLowerCase() + ')', recurringId: r.id })); r.postedThrough = ds.length ? ds[ds.length - 1] : addDays(r.startDate, -1); });
  const ex = (date, category, amount, gst, brandId, vendor, paidVia, note) => { if (date <= T) expenses.push({ id: 'demo-e' + (++e), date, category, amount, gst, brandId: brandId || null, vendor, paidVia, ref: 'INV-' + date.replace(/-/g, '').slice(2) + '-' + e, note: note || '' }); };
  monthsBack(6).forEach((k, i) => {
    const [y, m] = k.split('-'); const d = dd => `${y}-${m}-${pad(dd)}`;
    ex(d(27), 'Advertising', 7000 + i * 500, 1260 + i * 90, 'demo-b1', 'Amazon Ads', 'Card'); ex(d(27), 'Advertising', 4500, 810, 'demo-b2', 'Meta Ads', 'Card'); ex(d(27), 'Advertising', 2500, 450, 'demo-b3', 'Flipkart Ads', 'Card');
    ex(d(15), 'Packaging material', 5200, 936, null, 'Erode Corrugated Boxes', 'UPI');
    if (i % 2 === 0) ex(d(18), 'Photography & content', 6500, 1170, i === 4 ? 'demo-b4' : 'demo-b2', 'Studio Frame, Erode', 'UPI');
    ex(d(20), 'Logistics & courier', 3100, 558, null, 'Delhivery (website and B2B orders)', 'Bank transfer');
  });
  ex(T, 'Office & misc', 1850, 0, null, 'Erode Stationers', 'UPI', 'Label rolls and packing tape');
  ex(T, 'Raw material & consumables', 4200, 210, 'demo-b2', 'Local kiln supplier', 'UPI', 'Kiln wash and stilts');
  const payouts = []; let pi = 0;
  const bySet = groupBy(sales, s => s.platform + '|' + s.date.slice(0, 7));
  monthsBack(4).slice(0, 3).forEach(k => { platforms().filter(pl => ['amazon', 'flipkart', 'meesho'].includes(pl.key)).forEach(pl => { const list = bySet[pl.key + '|' + k] || []; if (!list.length) return; const exp = finSum(list).settlement; const pay = addDays(monthRange(k)[1], 10); if (pay > T) return; const factor = pl.key === 'flipkart' && pi % 2 === 0 ? 0.93 : 0.985 + R() * .015; payouts.push({ id: 'demo-pay' + (++pi), date: pay, platform: pl.key, amount: Math.round(exp * factor), ref: 'UTR' + String(Math.floor(R() * 9e11 + 1e11)), periodFrom: monthRange(k)[0], periodTo: monthRange(k)[1] }); }); });
  const assets = [
    { id: 'demo-a1', tag: 'TV-AST-0001', name: 'Lenovo ThinkPad E14 (accounts)', category: 'it', serial: 'PF-DEMO001', purchaseDate: '2025-06-12', cost: 68900, gst: 12402, vendor: 'Lenovo Exclusive, Erode', status: 'in_use', assignedTo: ME.id, location: 'Erode office', method: 'wdv', rate: 40, salvage: 0, warrantyUntil: '2027-06-11', life: 3 },
    { id: 'demo-a2', tag: 'TV-AST-0002', name: 'TSC barcode label printer', category: 'office', purchaseDate: '2025-08-20', cost: 14500, gst: 2610, vendor: 'Barcode India', status: 'in_use', assignedName: 'Packing desk', location: 'Erode warehouse', method: 'wdv', rate: 15, salvage: 1000, warrantyUntil: addDays(T, 21) },
    { id: 'demo-a3', tag: 'TV-AST-0003', name: 'Leather skiving machine', category: 'plant', purchaseDate: '2025-03-04', cost: 46000, gst: 8280, vendor: 'Chennai Leather Machines', status: 'in_use', assignedName: 'Cutting bench', location: 'Erode workshop', method: 'wdv', rate: 15, salvage: 3000, warrantyUntil: addDays(T, 55) },
    { id: 'demo-a4', tag: 'TV-AST-0004', name: 'Electric pottery wheel', category: 'plant', purchaseDate: '2025-11-05', cost: 38000, gst: 6840, vendor: 'Studio Pottery Supplies', status: 'in_use', assignedName: 'Pottery studio', location: 'Erode workshop', method: 'wdv', rate: 15, salvage: 2000, warrantyUntil: '2027-11-04' },
    { id: 'demo-a5', tag: 'TV-AST-0005', name: 'Electric kiln, 60 litre', category: 'plant', purchaseDate: '2025-11-05', cost: 145000, gst: 26100, vendor: 'Kiln Craft India', status: 'in_use', location: 'Erode workshop', method: 'wdv', rate: 15, salvage: 10000, insuranceUntil: addDays(T, 26), insurer: 'ICICI Lombard' },
    { id: 'demo-a6', tag: 'TV-AST-0006', name: 'Storage racks (8 bays)', category: 'furniture', purchaseDate: '2024-12-02', cost: 62000, gst: 11160, vendor: 'Godrej Interio', status: 'in_use', location: 'Erode warehouse', method: 'wdv', rate: 10, salvage: 0 },
    { id: 'demo-a7', tag: 'TV-AST-0007', name: 'Packing table and weighing scale', category: 'plant', purchaseDate: '2024-12-02', cost: 23500, gst: 4230, vendor: 'Local fabricator', status: 'repair', location: 'Erode warehouse', method: 'wdv', rate: 15, salvage: 0, notes: 'Scale recalibration booked.' },
  ];
  const campaigns = [
    { id: 'demo-k1', name: 'Veg-tan sheets, Sponsored Products', channel: 'Amazon Sponsored Products', brandId: 'demo-b1', status: 'live', startDate: D(52), endDate: '', budget: 40000, spend: 26800, impressions: 388000, clicks: 4820, orders: 236, revenue: 121400 },
    { id: 'demo-k2', name: 'Throwing videos, Reels', channel: 'Meta Ads', brandId: 'demo-b2', status: 'live', startDate: D(20), endDate: D(-15), budget: 25000, spend: 14200, impressions: 251000, clicks: 3650, orders: 58, revenue: 52800 },
    { id: 'demo-k3', name: 'Starter kits, Product Listing Ads', channel: 'Flipkart Ads', brandId: 'demo-b3', status: 'paused', startDate: D(70), endDate: '', budget: 15000, spend: 12400, impressions: 142000, clicks: 1710, orders: 13, revenue: 20800 },
    { id: 'demo-k4', name: 'Saturday pottery workshop, Erode', channel: 'Workshop / event', brandId: 'demo-b2', status: 'planned', startDate: D(-9), endDate: D(-9), budget: 12000, spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0, notes: 'Twelve seats, clay and firing included.' },
    { id: 'demo-k5', name: 'Website, Google Shopping', channel: 'Google Ads', brandId: 'demo-b1', status: 'ended', startDate: D(120), endDate: D(60), budget: 20000, spend: 19400, impressions: 96000, clicks: 2380, orders: 47, revenue: 58900 },
    { id: 'demo-k6', name: 'Diwali maker deal', channel: 'Deal / coupon', brandId: 'demo-b3', status: 'planned', startDate: D(-12), endDate: D(-16), budget: 8000, spend: 0, impressions: 0, clicks: 0, orders: 0, revenue: 0, coupon: 'MAKER15' },
  ];
  const RV = [['demo-p1', 'amazon', 5, 'Proper veg tan', 'Firm, smells right and burnishes beautifully. Made two card wallets from one sheet.', 'Rahul K', 4, 'replied'], ['demo-p1', 'flipkart', 2, 'Scar in the middle', 'One deep scar right in the centre of the sheet. Usable but not for a visible panel.', 'Deepa', 6, 'new'], ['demo-p6', 'amazon', 4, '', 'Throws well, a little soft out of the bag. Wedged it and it was fine.', 'S. Kumar', 9, 'new'], ['demo-p10', 'amazon', 5, 'Great first kit', 'Everything I needed for my first wallet. The chisels are sharper than I expected.', 'Ananya', 15, 'replied'], ['demo-p8', 'website', 3, 'Colours differ', 'The blue came out greener than the photo after firing. Nice glazes otherwise.', 'Harini V', 2, 'new'], ['demo-p13', 'amazon', 5, '', 'Soft cord, combs out nicely for fringe.', 'Pooja', 11, 'resolved'], ['demo-p4', 'meesho', 4, '', 'Good mix of colours, enough for keychains and patches.', 'Kiran', 0, 'new']];
  const reviews = RV.map(([productId, platform, rating, title, text, reviewer, days, status], i) => ({ id: 'demo-rv' + (i + 1), productId, brandId: pr(productId).brandId, platform, rating, title, text, reviewer, date: D(days), status, response: status === 'new' ? '' : `Thank you, ${reviewer.split(' ')[0]}. ${rating >= 4 ? 'We’re glad it’s working well for your projects.' : 'We’re sorry about this and our team is looking into it. Please message us through the platform so we can help.'}\nTeam Triagon` }));
  // people and attendance
  const employees = [['Ravi Kumar', 'Warehouse & dispatch lead', 'Warehouse', '09:00', '18:00', 300], ['Priya Sundaram', 'Catalogue executive', 'Online sales', '', '', 260], ['Manoj Kannan', 'Packing associate', 'Warehouse', '09:00', '18:00', 200], ['Lakshmi Devi', 'Pottery studio assistant', 'Workshop', '', '', 400], ['Arun Prakash', 'Leather cutting & QC', 'Workshop', '', '', 500], ['Sneha M', 'Accounts assistant', 'Accounts', '', '', 10]]
    .map(([name, designation, department, shiftStart, shiftEnd, joined], i) => ({ id: 'demo-emp' + (i + 1), code: 'EMP-' + String(i + 1).padStart(4, '0'), name, designation, department, shiftStart, shiftEnd, phone: '+91 90000 002' + pad(i + 1), joinDate: D(joined), status: 'active', weeklyOff: [] }));
  const attendance = []; const st = attSettings(); const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const at = (d, mins) => { const x = parseD(d); x.setHours(0, mins, Math.floor(R() * 50), 0); return x.toISOString(); };
  const notes = ['Packed and dispatched Amazon and Flipkart orders, restacked rack B.', 'Listed 4 new leather sheet variants and fixed the suppressed suede listing.', 'Wedged 40 kg of stoneware, glazed 18 test tiles for the new colours.', 'Cut 30 wallet panels and QC-checked the Ambur hides.', 'Reconciled Amazon payout and posted supplier bills.', 'Followed up with the Ningbo supplier on the pending chisel sets.', 'Photographed the new glaze set for the website.', 'Dispatched the Erode Craft School bulk order.'];
  for (let i = 0; i <= 34; i++) {
    const d = D(i); const dow = parseD(d).getDay(); if (dow === 0) continue;
    employees.forEach((em, j) => {
      if (d < em.joinDate) return; const start = hm(em.shiftStart || st.start), end = hm(em.shiftEnd || st.end); const r = R();
      if (i > 0 && r < .04) { attendance.push({ id: em.id + '_' + d, employeeId: em.id, date: d, sessions: [], mark: 'leave', note: 'Casual leave', update: '' }); return; }
      if (i > 0 && r < .07) return; // absent
      const lateBy = R() < .16 ? 12 + Math.floor(R() * 35) : -Math.floor(R() * 14); const inM = start + lateBy; if (i === 0 && inM > nowM) return;
      const half = R() < .05; let outM = half ? inM + 200 + Math.floor(R() * 30) : end + Math.floor(R() * 40) - 10;
      const sess = [{ in: at(d, inM), inVia: 'kiosk' }];
      if (i === 0) { if (outM <= nowM) Object.assign(sess[0], { out: at(d, outM), outVia: 'kiosk' }); }
      else { if (R() < .03) { /* forgot to check out */ } else Object.assign(sess[0], { out: at(d, outM), outVia: 'kiosk' }); }
      attendance.push({ id: em.id + '_' + d, employeeId: em.id, date: d, sessions: sess, update: sess[0].out && R() < .45 ? pick(notes) : '' });
    });
  }
  const UP = [[0, 'Sales & orders', 'Erode Craft School confirmed a repeat order for 30 starter kits, dispatch on Monday.'], [0, 'Dispatch & stock', 'Ningbo chisel sets partly received (35 of 60 kits). Balance expected next week.'], [0, 'Issue / blocker', 'Packing scale still in repair, using the backup scale for all parcels today.'], [1, 'Catalogue & listings', 'Suede scraps listing back live on Flipkart after fixing the main image.'], [1, 'Marketing', 'Reels on wheel throwing crossed 10k views. Moving ₹3,000 more into that ad set.'], [2, 'Accounts', 'September Amazon payout reconciled. Flipkart short by about 7%, raised a ticket.'], [3, 'Production & workshop', 'Fired the first kiln load of the new glaze tiles. Blue needs a thinner coat.'], [5, 'Customers', 'Two complaints about the A4 sheet scar. Sending replacements and checking the current batch.']];
  const updates = UP.map(([days, category, text], i) => ({ id: 'demo-u' + (i + 1), date: D(days), category, text, by: ME.id, at: days === 0 ? at(T, Math.max(0, Math.min(nowM - 30, 10 * 60 + i * 47))) : at(D(days), 11 * 60 + i * 47) }));
  return { brands, suppliers, products, customers, pos: PO, moves, sales, recurring, expenses, payouts, assets, campaigns, reviews, employees, attendance, updates };
}

let demoBusy = false;
async function loadDemo() {
  if (demoBusy) return; demoBusy = true; let data; try { data = demoExtend(demoData()); } catch (e) { demoBusy = false; console.error(e); toast('Demo data couldn’t be built. Try again.', 'bad'); return; }
  const dpin = await hashPin('1234'); (data.employees || []).forEach(e => { e.pin = dpin; });
  const now = nowISO(); const jobs = [];
  for (const k of Object.keys(data).filter(k => COLS.includes(k))) for (const d of data[k]) { const { id, ...rest } = d; jobs.push([k + '/' + id, clean({ ...rest, demo: true, createdAt: now, createdBy: ME.id, updatedAt: now, updatedBy: ME.id })]); }
  toast(`Loading demo data… 0 of ${jobs.length}`);
  try { for (let i = 0; i < jobs.length; i += 400) { await dbBatch(jobs.slice(i, i + 400).map(([p, d]) => ({ op: 'set', path: p, data: d }))); toast(`Loading demo data… ${Math.min(jobs.length, i + 400)} of ${jobs.length}`); } if (data._settings) for (const [k, v] of Object.entries(data._settings)) if (!S.settings[k] || (k === 'attendance' && !(S.settings.attendance.holidays || []).length)) await dbWrite('set', 'settings/' + k, clean({ ...(S.settings[k] || {}), ...v, updatedAt: now, updatedBy: ME.id })); addLog('import', 'dashboard', `Loaded ${jobs.length} demo records`); toast('Demo data loaded. Demo employees use PIN 1234 at the kiosk. Remove it all from the banner at the top.'); }
  catch (e) { handleErr(e); } finally { demoBusy = false; }
}
async function clearDemo() {
  if (demoBusy) return; demoBusy = true; const jobs = []; for (const k of COLS) S[k].filter(x => x.demo || (k === 'deletions' && x.snapshot && x.snapshot.demo)).forEach(x => jobs.push(k + '/' + x.id));
  toast(`Removing ${jobs.length} demo records…`);
  try { for (let i = 0; i < jobs.length; i += 400) { await dbBatch(jobs.slice(i, i + 400).map(p => ({ op: 'delete', path: p }))); toast(`Removing demo data… ${Math.min(jobs.length, i + 400)} of ${jobs.length}`); } addLog('delete', 'dashboard', `Removed ${jobs.length} demo records`); toast('Demo data removed.'); }
  catch (e) { handleErr(e); } finally { demoBusy = false; }
}

