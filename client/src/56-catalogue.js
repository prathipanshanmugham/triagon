/* =====================================================================
   Catalogue & listings: units, per-channel listings, per-SKU platform fees,
   Drive folders, ticking many rows at once, add-many grids, stock in units
   ===================================================================== */
async function batchAll(ops) { for (let i = 0; i < ops.length; i += 450) await dbBatch(ops.slice(i, i + 450)); }
const stampOf = (prev, extra) => ({ createdAt: (prev && prev.createdAt) || nowISO(), createdBy: (prev && prev.createdBy) || ME.id || null, updatedAt: nowISO(), updatedBy: ME.id || null, ...(prev && prev.demo ? { demo: true } : {}), ...(extra || {}) });
const safeURL = u => { u = String(u || '').trim(); return /^https:\/\/[^\s<>"]+$/i.test(u) ? u : ''; };
const linkA = (url, lbl = 'Open', i = 'folder', cls = 'btn sm ghost') => safeURL(url) ? `<a class="${cls}" href="${esc(safeURL(url))}" target="_blank" rel="noopener noreferrer">${icon(i)}${esc(lbl)}</a>` : '';
const urlErr = (v, keys) => keys.filter(k => { const x = getPath(v, k); return x && !safeURL(x); }).map(k => ({ n: k, m: 'Paste a full link starting with https://' }));
const perU = u => `<span class="usuf" data-k="per">/ ${esc(u)}</span>`;
const inU = u => `<span class="usuf" data-k="qty">${esc(u)}</span>`;
const listingOf = (p, k) => ((p && p.listings) || {})[k] || {};
const chanSku = (p, k) => listingOf(p, k).sku || (p && p.sku) || '';
const chanPrice = (p, k) => N(listingOf(p, k).price) || N(p && p.sellingPrice);
Object.assign(IC, {
  idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.3"/><path d="M5.8 16.2c.5-1.6 1.7-2.4 3.2-2.4s2.7.8 3.2 2.4M14.5 10h4M14.5 13.5h3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/>',
  link: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 6.5 8.5 6.5 8.5-6.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  bot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9.5 16.5h5"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  wallet: '<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1z"/><path d="M4 7V6a2 2 0 0 1 2-2h10v3M16 13.5h.01"/>',
});
Object.assign(FL, { unit: 'Unit', purchaseUnit: 'Purchase unit', purchaseFactor: 'Units per purchase unit', driveLink: 'Drive link', badQty: 'Damaged qty', retCondition: 'Return condition', retQty: 'Returned qty' });

/* ---------- selection & bulk helpers (tick boxes in any table) ---------- */
const selCount = id => selOf(id).size;
const selIds = id => [...selOf(id)];
function selBar(id, acts) { const n = selCount(id); if (!n) return ''; return `<div class="selbar" role="region" aria-label="Selected rows"><b class="tnum">${num(n)} selected</b>${acts}<span class="sp"></span><button class="btn sm ghost" data-act="selclear:${id}">Clear selection</button></div>`; }
Object.assign(ACT, {
  sel(id, key) { const s = selOf(id); if (s.has(key)) s.delete(key); else s.add(key); schedule(); },
  selall(id) { const s = selOf(id); const keys = SELKEYS[id] || []; const all = keys.length && keys.every(k => s.has(k)); if (all) s.clear(); else keys.forEach(k => s.add(k)); schedule(); },
  selclear(id) { selOf(id).clear(); schedule(); },
});
// delete many records at once: approvers delete straight to the recycle bin, others send one request each
function bulkDelete(col, ids, mod, lblFn, guardFn, done) {
  const recs = ids.map(id => byId(col)[id]).filter(Boolean); const blocked = []; const ok = [];
  for (const r of recs) { const g = guardFn && guardFn(r); if (g) blocked.push([r, g]); else if (pendingDel()[col + '/' + r.id]) blocked.push([r, 'already waiting for approval']); else ok.push(r); }
  const direct = allow('approveDelete');
  openDrawer({
    title: `Delete ${num(ok.length)} record${ok.length === 1 ? '' : 's'}?`, sub: direct ? 'They go to the recycle bin in Approvals, where they can be restored this quarter.' : 'Deleting needs approval from a Manager or the CEO. One request is sent for each record.',
    html: `${ok.length ? `<div class="list bordered">${ok.slice(0, 40).map(r => `<div class="li"><span class="sev bad"></span><div class="grow"><b>${esc(lblFn(r))}</b></div></div>`).join('')}${ok.length > 40 ? `<div class="li muted">…and ${num(ok.length - 40)} more</div>` : ''}</div>` : '<p class="muted">Nothing here can be deleted.</p>'}
      ${blocked.length ? `<div class="subh">Skipped</div><div class="list">${blocked.map(([r, g]) => `<div class="li"><span class="sev warn"></span><div class="grow"><b>${esc(lblFn(r))}</b><small>${esc(g)}</small></div></div>`).join('')}</div>` : ''}
      ${ok.length ? form([{ n: 'reason', l: 'Reason', full: 1, ph: 'Helps the approver and shows in the recycle bin' }], {}) : ''}`,
    saveLabel: direct ? `Delete ${num(ok.length)}` : `Send ${num(ok.length)} request${ok.length === 1 ? '' : 's'}`, savedMsg: null,
    onSave: async v => {
      if (!ok.length) return; const ops = []; const now = nowISO();
      for (const r of ok) {
        const req = { col, docId: r.id, module: mod, label: lblFn(r), snapshot: base(r), reason: v.reason || '', requestedBy: ME.id, requestedAt: now };
        if (direct) { const cas = cascadeOf(col, r.id); ops.push({ op: 'delete', path: col + '/' + r.id }, ...cas.map(x => ({ op: 'delete', path: x.col + '/' + x.id })), { op: 'set', path: 'deletions/' + newId('deletions'), data: clean({ ...req, cascade: cas, status: 'approved', direct: true, decidedBy: ME.id, decidedAt: now }) }); }
        else ops.push({ op: 'set', path: 'deletions/' + newId('deletions'), data: clean({ ...req, status: 'pending' }) });
      }
      await batchAll(ops); selOf(done || col).clear();
      addLog(direct ? 'delete' : 'request', mod, `${direct ? 'Deleted' : 'Asked to delete'} ${ok.length} record${ok.length === 1 ? '' : 's'} from ${(MOD[mod] || {}).l || mod}`, ok.slice(0, 12).map(lblFn).join('; ') + (v.reason ? ' · Reason: ' + v.reason : ''));
      toast(direct ? `Deleted ${ok.length}. Restore from Approvals if needed.` : `${ok.length} delete request${ok.length === 1 ? '' : 's'} sent for approval.`);
    },
  });
}

/* ---------- product editor ---------- */
const LIST_FIELDS = ['status', 'id', 'sku', 'price', 'mrp', 'url', 'driveLink', 'title', 'bullets', 'description', 'keywords', 'ratingAvg', 'ratingCount', 'ratingAsOf'];
const FEE_F = [['commission', 'Commission', '%'], ['fixed', 'Fixed / closing fee', '₹'], ['ship', 'Shipping per order', '₹'], ['collection', 'Collection / payment fee', '%'], ['other', 'Other fee per unit', '₹'], ['returnCost', 'Return cost', '₹']];
const feeDefault = (pl, k) => k === 'ship' ? N(pl.shipBase) : k === 'other' ? 0 : N(pl[k]);
EDIT.product = (id, preset = {}) => {
  const p = id ? prodOf(id) : null; const can = canEdit('catalogue'); const costs = allow('costs');
  if (!S.brands.length) { toast('Add a brand first.', 'bad'); return; }
  const v0 = p ? { ...p, purchaseFactor: p.purchaseFactor ?? 1 } : { status: 'active', gstRate: 18, reorderLevel: 10, unit: 'pc', purchaseFactor: 1, brandId: (ui.brand !== 'all' ? ui.brand : (myBrands()[0] || {}).id), ...preset };
  const u = unitOf(v0); const on = p ? stockMap()[p.id] || 0 : 0; const bad = p ? badMap()[p.id] || 0 : 0;
  const fD = [
    { n: 'name', l: 'Product name', req: 1, full: 1, ph: 'e.g. Full-grain veg-tan leather, 2.0 mm, tan' },
    { n: 'brandId', l: 'Brand', t: 'select', req: 1, o: brandOpts },
    { n: 'sku', l: 'Master SKU', mono: 1, ph: 'Leave blank to auto-number', help: p ? 'Each channel can use its own SKU (Channels tab).' : 'Auto format: BRANDCODE-0001' },
    { n: 'category', l: 'Category', t: 'select', o: PROD_CATS, blank: 'Choose…' }, { n: 'variant', l: 'Variant', ph: 'e.g. Tan / 2.0 mm' },
    { n: 'unit', l: 'Stock & selling unit', t: 'select', o: UNITS, ch: 'produnit', help: 'Stock, prices and sales are counted in this unit. Leather is usually sold per sq ft.' },
    { n: 'hsn', l: 'HSN code', mono: 1, ph: 'e.g. 4107' }, { n: 'gstRate', l: 'GST rate', t: 'select', num: 1, o: GST_RATES.map(g => [g, g + '%']) },
    { n: 'weight', l: 'Packed weight', t: 'number', suf: 'g ' + perU(u), min: 0, help: 'Used for shipping slabs.' },
    { n: 'status', l: 'Status', t: 'select', o: [['active', 'Active'], ['draft', 'Draft'], ['archived', 'Archived']] },
    { n: 'driveLink', l: 'Drive folder for images & data', full: 1, ph: 'https://drive.google.com/drive/folders/…', help: 'One folder per SKU for photos, artwork, size charts and data sheets. Each channel can have its own folder too.' },
    { n: 'images', l: 'Images ready', t: 'number', min: 0, help: 'Main image plus gallery shots that meet platform specs.' },
  ];
  const fP = [
    { n: 'mrp', l: 'MRP', t: 'money', min: 0, suf: perU(u) }, { n: 'sellingPrice', l: 'Selling price (incl. GST)', t: 'money', req: 1, min: 0, suf: perU(u) },
    { n: 'costPrice', l: 'Cost price (ex-GST)', t: 'money', min: 0, suf: perU(u), help: 'Landed cost per stock unit. Receiving purchase orders updates it as a weighted average.', hide: !costs },
    { n: 'packagingCost', l: 'Packaging per unit', t: 'money', min: 0, suf: perU(u) },
    { raw: `<div class="subh" style="margin:2px 0 0">How you buy it</div><p class="help" style="margin:0">Example: you buy leather by the hide or in 100 sq ft lots and sell it per sq ft. Set the purchase unit to “100 sq ft lot” and units per purchase unit to 100. Purchase orders and stock-in can then be entered in lots, and stock is still counted in sq ft.</p>` },
    { n: 'purchaseUnit', l: 'Purchase unit', ph: 'e.g. hide, 100 sq ft lot, box of 12' },
    { n: 'purchaseFactor', l: 'Stock units in one purchase unit', t: 'number', min: 0, suf: inU(u), help: '1 if you buy and sell in the same unit.' },
    { n: 'openingStock', l: 'Opening stock', t: 'number', min: 0, suf: inU(u), help: p ? `On hand now: ${fmtQ(on, u)}${bad ? ` · damaged ${fmtQ(bad, u)}` : ''}. Change stock through Inventory.` : 'Quantity on hand when you start tracking.' },
    { n: 'reorderLevel', l: 'Reorder level', t: 'number', min: 0, suf: inU(u), help: 'Flagged as low stock at or below this.' },
    { n: 'supplierId', l: 'Preferred vendor', t: 'select', o: () => S.suppliers.map(s => [s.id, s.name]), blank: 'None' },
    { n: 'location', l: 'Storage location', ph: 'e.g. Erode store · Rack A3' },
  ];
  const cs = p ? contentScore(p) : null;
  const fC = [
    { raw: cs ? `<div class="score"><div class="big tnum">${cs.score}</div><ul>${cs.checks.map(c => `<li class="${c[1] ? 'ok' : 'no'}">${c[1] ? '✓' : '○'} ${esc(c[0])}</li>`).join('')}</ul></div>` : '<p class="muted" style="margin:0">A content score appears after you save, based on the fields below.</p>' },
    { raw: '<p class="help" style="margin:0">This is the master content. Each channel can override the title, bullets, description and keywords on the Channels tab.</p>' },
    { n: 'title', l: 'Master title', t: 'textarea', rows: 2, full: 1, help: 'Brand + product + key attributes. Aim for 80–150 characters.' },
    { n: 'bullets', l: 'Bullet points', t: 'textarea', rows: 5, full: 1, help: 'One per line. Lead each with the benefit.' },
    { n: 'description', l: 'Description', t: 'textarea', rows: 5, full: 1 }, { n: 'keywords', l: 'Search keywords', full: 1, help: 'Comma-separated back-end search terms.' },
  ];
  const lst = (p && p.listings) || {}; const pls = platforms().filter(x => x.on !== false || (lst[x.key] && (lst[x.key].status || 'none') !== 'none'));
  const LT = { live: 't-good', draft: 't-info', inactive: 't-warn', suppressed: 't-bad', none: 't-neu' };
  const chHTML = `<p class="muted" style="margin:0 0 10px">Each channel can have its own SKU, title, description, price and image folder. Blank fields use the master values.</p>` + pls.map(pl => {
    const l = lst[pl.key] || {}; const nm = k => `listings.${pl.key}.${k}`; const st = l.status || 'none';
    return `<details class="chl"${st !== 'none' ? ' open' : ''}><summary><span class="ldotc" style="background:var(--${pl.color || 'c8'})"></span><b>${esc(pl.name)}</b>${pill((LIST_STATUS.find(x => x[0] === st) || [, st])[1], LT[st], 1)}${l.sku ? `<span class="mono muted">${esc(l.sku)}</span>` : ''}${l.id ? `<span class="mono muted">${esc(pl.idLabel || 'ID')} ${esc(l.id)}</span>` : ''}<span class="sp"></span>${linkA(l.url, 'Listing', 'link')}${linkA(l.driveLink, 'Drive', 'folder')}</summary><div class="form">${[
      fld({ n: nm('status'), l: 'Status', t: 'select', o: LIST_STATUS }, st), fld({ n: nm('id'), l: pl.idLabel || 'Listing ID', mono: 1 }, l.id),
      fld({ n: nm('sku'), l: 'Channel SKU', mono: 1, ph: (p && p.sku) || 'Same as master' }, l.sku), fld({ n: nm('price'), l: 'Price on this channel', t: 'money', min: 0, ph: 'Same as master', suf: perU(u) }, l.price),
      fld({ n: nm('mrp'), l: 'MRP shown', t: 'money', min: 0, ph: 'Same as master', suf: perU(u) }, l.mrp), fld({ n: nm('url'), l: 'Listing link', ph: 'https://' }, l.url),
      fld({ n: nm('driveLink'), l: 'Drive folder for this channel', full: 1, ph: 'https://drive.google.com/…', help: 'Images and A+ content cut to this platform’s specs.' }, l.driveLink),
      fld({ n: nm('title'), l: 'Title on this channel', t: 'textarea', rows: 2, full: 1, ph: (p && p.title) || 'Uses the master title' }, l.title),
      fld({ n: nm('bullets'), l: 'Bullet points on this channel', t: 'textarea', rows: 4, full: 1, ph: 'Uses the master bullets' }, l.bullets),
      fld({ n: nm('description'), l: 'Description on this channel', t: 'textarea', rows: 4, full: 1, ph: 'Uses the master description' }, l.description),
      fld({ n: nm('keywords'), l: 'Keywords on this channel', full: 1, ph: 'Uses the master keywords' }, l.keywords),
    ].join('')}</div></details>`;
  }).join('');
  const feeHTML = `<p class="muted" style="margin:0 0 10px">Fees differ by SKU on each platform (category commission, weight slab, closing fee). Enter this SKU’s actual rates. Blank uses the platform default from Fee settings, shown as the placeholder.</p>
    <div class="tw"><table class="t ft"><thead><tr><th>Platform</th>${FEE_F.map(f => `<th class="num">${esc(f[1])} ${f[2]}</th>`).join('')}</tr></thead><tbody>${pls.map(pl => { const f = (lst[pl.key] || {}).fees || {}; return `<tr><td><b>${esc(pl.name)}</b></td>${FEE_F.map(([k, , s]) => `<td><input class="inp tnum" type="number" step="any" min="0" name="listings.${pl.key}.fees.${k}" data-t="num" data-in="pfee" value="${esc(f[k] ?? '')}" placeholder="${esc(feeDefault(pl, k))}" aria-label="${esc(pl.name)} ${k} ${s}"${can ? '' : ' disabled'}></td>`).join('')}</tr>`; }).join('')}</tbody></table></div>
    <div class="subh">What you keep per ${esc(u)}</div><div id="feeOut"></div><p class="help">Uses the channel price (or master price), this SKU’s fees, 18% GST on fees, TCS/TDS from Fee settings and your cost and packaging. Updates as you type.</p>`;
  const tabs = [{ l: 'Details', html: form(fD, v0) }, { l: 'Pricing & units', html: form(fP, v0) }, { l: 'Content', html: form(fC, v0) }, { l: 'Channels', html: chHTML }, { l: 'Fees & profit', html: feeHTML }];
  if (p) tabs.push({ l: 'Ratings', html: prodRatingsHTML(p, pls, can) });
  openDrawer({
    title: p ? p.name : 'New product', sub: p ? `${esc(p.sku || '')} · ${esc(brandName(p.brandId))} · ${fmtQ(on, u)} on hand` : 'Add the essentials now; channels and content can follow.', readOnly: !can, delKey: 'products/' + id, wide: true,
    tabs, onOpen: () => feeCalc(),
    validate: v => { const e = []; const sku = String(v.sku || '').trim(); if (sku && S.products.some(x => x.id !== id && String(x.sku || '').toLowerCase() === sku.toLowerCase())) e.push({ n: 'sku', m: 'Another product already uses this SKU.' }); if (N(v.sellingPrice) <= 0) e.push({ n: 'sellingPrice', m: 'Enter a price above zero.' }); if (v.mrp && N(v.mrp) < N(v.sellingPrice)) e.push({ n: 'mrp', m: 'MRP can’t be below the selling price.' }); if (v.purchaseFactor !== null && N(v.purchaseFactor) <= 0) e.push({ n: 'purchaseFactor', m: 'Enter how many stock units one purchase unit holds.' }); e.push(...urlErr(v, ['driveLink', ...pls.flatMap(pl => [`listings.${pl.key}.url`, `listings.${pl.key}.driveLink`])])); for (const pl of pls) { const cs = String(getPath(v, `listings.${pl.key}.sku`) || '').trim().toLowerCase(); if (cs && S.products.some(x => x.id !== id && String(chanSku(x, pl.key)).toLowerCase() === cs)) e.push({ n: `listings.${pl.key}.sku`, m: `Another product uses this SKU on ${pl.name}.` }); } return e; },
    onSave: async v => {
      if (!v.sku) v.sku = nextSku(v.brandId); v.sku = v.sku.toUpperCase();
      const listings = JSON.parse(JSON.stringify((p && p.listings) || {})); const snaps = [];
      for (const k in (v.listings || {})) {
        const l = v.listings[k]; const cur = listings[k] || {}; const nx = { ...cur };
        for (const f of LIST_FIELDS) if (l[f] !== undefined) nx[f] = l[f] === '' ? null : l[f];
        if (l.fees) { const fees = {}; for (const [fk] of FEE_F) if (l.fees[fk] !== null && l.fees[fk] !== undefined && l.fees[fk] !== '') fees[fk] = N(l.fees[fk]); nx.fees = fees; }
        nx.status = nx.status || 'none';
        if (l.ratingAvg !== undefined && (N(l.ratingAvg) !== N(cur.ratingAvg) || N(l.ratingCount) !== N(cur.ratingCount)) && N(l.ratingAvg) > 0) { nx.ratingAsOf = TODAY(); snaps.push({ platform: k, avg: N(l.ratingAvg), count: N(l.ratingCount) }); }
        listings[k] = nx;
      }
      const pid = await saveDoc('products', id, { ...base(p), ...v, unit: v.unit || 'pc', purchaseFactor: N(v.purchaseFactor) || 1, supplierId: v.supplierId || null, driveLink: safeURL(v.driveLink) || null, listings }, ['catalogue', `Product ${v.sku} · ${v.name}`]);
      if (snaps.length) await batchAll(snaps.map(s => ({ op: 'set', path: `ratingSnaps/${pid}_${s.platform}_${TODAY()}`, data: clean({ productId: pid, platform: s.platform, date: TODAY(), avg: s.avg, count: s.count, ...stampOf(null) }) })));
    },
    onDelete: p ? delFn('products', id, 'catalogue', `Product ${p.sku} · ${p.name}`, () => { const n = S.sales.filter(s => s.productId === id).length; return n ? `This product has ${n} sales entries. Archive it instead so your history stays intact.` : ''; }) : null,
  });
};
function feeCalc() {
  const out = $('#feeOut'); if (!out || !DRW.cfg) return; const { vals: v } = readForm($('#drForm')); const costs = allow('costs'); const u = v.unit || 'pc';
  const pr = { ...v, listings: v.listings || {} }; const rows = platforms().filter(pl => (v.listings || {})[pl.key]).map(pl => {
    const fees = ((v.listings[pl.key] || {}).fees) || {}; const fake = { listings: { [pl.key]: { fees } } };
    const price = N((v.listings[pl.key] || {}).price) || N(v.sellingPrice);
    const e = unitEcon({ price, gst: v.gstRate ?? 18, cost: v.costPrice, pack: v.packagingCost, weight: v.weight, plat: effPlat(pl, fake) });
    return { pl, price, e, custom: Object.values(fees).some(x => x !== null && x !== undefined && x !== '') };
  });
  out.innerHTML = rows.length ? `<div class="tw"><table class="t"><thead><tr><th>Platform</th><th class="num">Price</th><th class="num">Fees</th><th class="num">GST on fees</th><th class="num">TCS + TDS</th><th class="num">Settlement</th>${costs ? '<th class="num">Cost + pack</th><th class="num">Profit</th><th class="num">Margin</th>' : ''}</tr></thead><tbody>${rows.map(x => `<tr><td><b>${esc(x.pl.name)}</b>${x.custom ? ' ' + pill('SKU fees', 't-acc', 1) : ''}</td><td class="num">${inr(x.price, 2)}</td><td class="num" title="Commission ${inr(x.e.commission, 2)} · fixed ${inr(x.e.fixed, 2)} · shipping ${inr(x.e.shipping, 2)} · collection ${inr(x.e.collection, 2)}">${inr(x.e.fees, 2)}</td><td class="num">${inr(x.e.gstOnFees, 2)}</td><td class="num">${inr(x.e.tcs + x.e.tds, 2)}</td><td class="num"><b>${inr(x.e.settlement, 2)}</b></td>${costs ? `<td class="num">${inr(x.e.cost + x.e.pack, 2)}</td><td class="num ${x.e.profit < 0 ? 'neg' : 'pos'}"><b>${inr(x.e.profit, 2)}</b></td><td class="num">${pct(x.e.margin)}</td>` : ''}</tr>`).join('')}</tbody></table></div>` : '<p class="muted">Turn on platforms in Fee settings to see them here.</p>';
  void u; void pr;
}
function prodRatingsHTML(p, pls, can) {
  const rv = S.reviews.filter(r => r.productId === p.id);
  return `<p class="muted" style="margin:0 0 10px">Each listing has its own rating on its platform. Enter the current star rating and number of ratings from seller central; saving keeps a dated history so you can see the trend.</p>
  <div class="tw"><table class="t"><thead><tr><th>Platform</th><th>Channel SKU</th><th class="num">Stars (listing)</th><th class="num">Ratings</th><th>As of</th><th class="num">Reviews logged here</th><th>Trend</th></tr></thead><tbody>${pls.map(pl => {
    const l = listingOf(p, pl.key); const r = rv.filter(x => x.platform === pl.key); const ra = r.length ? sum(r, x => x.rating) / r.length : 0;
    const snaps = S.ratingSnaps.filter(s => s.productId === p.id && s.platform === pl.key).sort((a, b) => a.date < b.date ? -1 : 1); const tr = snaps.length >= 2 ? N(snaps[snaps.length - 1].avg) - N(snaps[0].avg) : 0;
    return `<tr><td><b>${esc(pl.name)}</b></td><td class="mono">${esc(chanSku(p, pl.key))}</td><td class="num" style="width:110px"><input class="inp tnum" type="number" step="0.1" min="0" max="5" name="listings.${pl.key}.ratingAvg" data-t="num" value="${esc(l.ratingAvg ?? '')}" aria-label="${esc(pl.name)} stars"${can ? '' : ' disabled'}></td><td class="num" style="width:110px"><input class="inp tnum" type="number" step="1" min="0" name="listings.${pl.key}.ratingCount" data-t="num" value="${esc(l.ratingCount ?? '')}" aria-label="${esc(pl.name)} rating count"${can ? '' : ' disabled'}></td><td>${esc(l.ratingAsOf ? fmtD(l.ratingAsOf) : '—')}</td><td class="num">${r.length ? `${ra.toFixed(1)}★ · ${num(r.length)}` : '—'}</td><td>${snaps.length >= 2 ? `<span class="${tr < 0 ? 'neg' : tr > 0 ? 'pos' : 'muted'}">${tr > 0 ? '▲' : tr < 0 ? '▼' : ''} ${Math.abs(tr).toFixed(2)} since ${esc(fmtDs(snaps[0].date))}</span>` : '<span class="muted">—</span>'}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}
Object.assign(IN, { pfee() { feeCalc(); } });
Object.assign(CH, {
  produnit(v) { $$('#dr .usuf').forEach(s => { s.textContent = s.dataset.k === 'per' ? '/ ' + (v || 'pc') : (v || 'pc'); }); },
});
{ const t0 = ACT.drtab; ACT.drtab = i => { t0(i); feeCalc(); }; }

/* ---------- catalogue view ---------- */
const LSC = { live: 'live', draft: 'draft', suppressed: 'bad', inactive: 'off' };
V.catalogue = () => {
  const can = canEdit('catalogue'); const tab = tabOf('cat2', 'products'); const all = S.products.filter(inBrand);
  const acts = tab === 'products' ? (can ? btn('Import CSV', 'import:products', { i: 'upload' }) : '') + exportBtn('exportcat', 'Export') + (can ? btn('Add many', 'prodgrid', { i: 'layers' }) + btn('Add product', 'new:product', { pri: true, i: 'plus' }) : '') : exportBtn('exportlist', 'Export listings');
  let html = ph('Catalogue & listings', 'Master product data with units, a separate listing for every channel (SKU, title, description, price, Drive folder), and each SKU’s own platform fees.', acts);
  if (!S.brands.length) return html + panel('', empty('Add a brand first', 'Every product belongs to a brand. Create your brands, then add products here.', canEdit('brands') ? btn('Add brand', 'new:brand', { pri: true }) : ''));
  const live = all.reduce((t, p) => t + liveCount(p), 0);
  html += tabsHTML('cat2', [['products', 'Products', all.length], ['listings', 'Channel listings', live ? live + ' live' : '']], tab);
  return html + (tab === 'listings' ? catListings(all, can) : catProducts(all, can));
};
function catProducts(all, can) {
  const st = filtOf('cat', 'active'); const pf = ui.filt.catplat || ''; const ap = activePlatforms();
  const cnt = k => all.filter(p => (p.status || 'active') === k).length;
  const rows = all.filter(p => (st === 'all' || (p.status || 'active') === st) && matchQ('cat', p.name, p.sku, p.variant, p.category, brandName(p.brandId), ...Object.values(p.listings || {}).map(l => l.sku)) && (() => { if (!pf) return true; const [m, k] = pf.split('|'); const s = listingOf(p, k).status || 'none'; return m === 'live' ? s === 'live' : s !== 'live'; })());
  let html = `<div class="toolbar">${searchHTML('cat', 'Search name, SKU, channel SKU, category…')}${chipsHTML('cat', [['active', 'Active', cnt('active')], ['draft', 'Draft', cnt('draft')], ['archived', 'Archived', cnt('archived')], ['all', 'All', all.length]], st)}<span class="sp"></span><label class="sr" for="catplat">Listing filter</label><select class="inp" id="catplat" data-ch="filtsel" data-key="catplat" style="width:auto"><option value="">Any listing status</option>${ap.map(p => `<option value="live|${p.key}"${pf === 'live|' + p.key ? ' selected' : ''}>Live on ${esc(p.name)}</option><option value="not|${p.key}"${pf === 'not|' + p.key ? ' selected' : ''}>Not live on ${esc(p.name)}</option>`).join('')}</select></div>`;
  if (can) html += selBar('cat', btn('Edit selected', 'bulkprod', { sm: true, i: 'edit' }) + btn('Delete selected', 'bulkdelprod', { sm: true, i: 'trash', cls: 'danger' }));
  html += panel('', table('cat', [
    { k: 'name', l: 'Product', render: p => prodCell(p) + delPill('products', p.id) },
    { k: 'brand', l: 'Brand', render: p => esc(brandName(p.brandId)), sort: p => brandName(p.brandId) },
    { k: 'unit', l: 'Unit', render: p => esc(unitOf(p)) + (p.purchaseUnit ? `<br><small class="muted">buy: ${esc(p.purchaseUnit)}${isPU(p.purchaseFactor) ? ' = ' + fmtQ(p.purchaseFactor, p) : ''}</small>` : ''), sort: p => unitOf(p) },
    { k: 'sellingPrice', l: 'Price', num: 1, render: p => `${inr(p.sellingPrice, N(p.sellingPrice) % 1 ? 2 : 0)}<small class="muted"> /${esc(unitOf(p))}</small>${N(p.mrp) > N(p.sellingPrice) ? `<br><small class="muted"><s>${inr(p.mrp)}</s> MRP</small>` : ''}`, sort: p => N(p.sellingPrice) },
    { k: 'costPrice', l: 'Cost', num: 1, cost: 1, render: p => N(p.costPrice) ? inr(p.costPrice, N(p.costPrice) % 1 ? 2 : 0) : '<span class="muted">—</span>', sort: p => N(p.costPrice) },
    { k: 'stock', l: 'On hand', num: 1, render: p => fmtQ(stockMap()[p.id] || 0, p), sort: p => stockMap()[p.id] || 0 },
    { k: 'score', l: 'Content', render: p => { const s = contentScore(p).score; return `<div class="mcell">${meter(s / 100, s >= 70 ? 'good' : s >= 40 ? 'warn' : 'bad')}<span class="tnum">${s}</span></div>`; }, sort: p => contentScore(p).score },
    { k: 'list', l: 'Listings', nosort: 1, render: p => `<div class="dotrow">${ap.map(pl => { const s = listingOf(p, pl.key).status || 'none'; const f = listingOf(p, pl.key).fees; return `<span class="ldot ${LSC[s] || ''}${f && Object.keys(f).length ? ' fee' : ''}" title="${esc(pl.name)}: ${esc((LIST_STATUS.find(x => x[0] === s) || [])[1] || s)}${f && Object.keys(f).length ? ' · own fees' : ''}">${esc((pl.code || pl.name).slice(0, 3))}</span>`; }).join('')}</div>` },
    { k: 'drive', l: 'Images', nosort: 1, render: p => p.driveLink ? linkA(p.driveLink, 'Drive', 'folder', 'lnk') : `<span class="muted">${N(p.images) ? num(p.images) + ' ready' : '—'}</span>` },
    { k: 'status', l: 'Status', render: p => pill(({ active: 'Active', draft: 'Draft', archived: 'Archived' })[p.status || 'active'], ({ active: 't-good', draft: 't-info', archived: 't-neu' })[p.status || 'active']) },
  ], rows, { select: can, key: p => p.id, open: p => 'open:product:' + p.id, empty: all.length ? undefined : empty('No products yet', 'Add products one at a time, many at once in a grid, or import a CSV.', can ? btn('Add many', 'prodgrid') + ' ' + btn('Add product', 'new:product', { pri: true }) : '') }), { flush: true });
  html += `<p class="muted" style="margin:0;font-size:12px">Listing codes: ${ap.map(p => `<b>${esc((p.code || p.name).slice(0, 3))}</b> ${esc(p.name)}`).join(' · ')}. Green is live, blue is draft, amber is inactive, red is suppressed. A dot with a corner mark has its own fees for that SKU.</p>`;
  return html;
}
function catListings(all, can) {
  const ap = activePlatforms(); const pk = ui.filt.lplat && ap.some(p => p.key === ui.filt.lplat) ? ui.filt.lplat : (ap[0] || {}).key; const pl = PL(pk); const costs = allow('costs');
  const sf = filtOf('lst', 'all');
  const rows = all.filter(p => p.status !== 'archived').map(p => { const l = listingOf(p, pk); const e = unitEcon({ price: chanPrice(p, pk), gst: p.gstRate ?? 18, cost: p.costPrice, pack: p.packagingCost, weight: p.weight, plat: effPlat(pl, p) }); return { p, l, st: l.status || 'none', e }; })
    .filter(x => (sf === 'all' || (sf === 'live' ? x.st === 'live' : sf === 'none' ? x.st === 'none' : x.st !== 'live' && x.st !== 'none')) && matchQ('lst', x.p.name, x.p.sku, x.l.sku, x.l.id, x.l.title));
  const base0 = all.filter(p => p.status !== 'archived'); const c = k => base0.filter(p => { const s = listingOf(p, pk).status || 'none'; return k === 'live' ? s === 'live' : k === 'none' ? s === 'none' : s !== 'live' && s !== 'none'; }).length;
  let html = `<div class="toolbar"><label class="sr" for="lplat">Channel</label><div class="seg" role="group" aria-label="Channel">${ap.map(p => `<button class="${p.key === pk ? 'on' : ''}" data-act="lplat:${p.key}">${esc(p.name)}</button>`).join('')}</div>${searchHTML('lst', 'Search SKU, title, listing ID…')}${chipsHTML('lst', [['all', 'All', base0.length], ['live', 'Live', c('live')], ['other', 'Draft / inactive', c('other')], ['none', 'Not listed', c('none')]], sf)}</div>`;
  if (can) html += selBar('lst', btn(`Set status on ${pl.name}`, 'bulklist:' + pk, { sm: true, i: 'edit' }));
  const LT = { live: 't-good', draft: 't-info', inactive: 't-warn', suppressed: 't-bad', none: 't-neu' };
  html += panel('', table('lst', [
    { k: 'p', l: 'Product', render: x => prodCell(x.p), sort: x => x.p.name },
    { k: 'sku', l: `${pl.name} SKU`, render: x => `<span class="mono">${esc(x.l.sku || x.p.sku || '')}</span>${x.l.sku && x.l.sku !== x.p.sku ? '' : '<br><small class="muted">master</small>'}`, sort: x => x.l.sku || x.p.sku },
    { k: 'id', l: pl.idLabel || 'Listing ID', render: x => x.l.id ? `<span class="mono">${esc(x.l.id)}</span>` : '<span class="muted">—</span>', sort: x => x.l.id || '' },
    { k: 'title', l: 'Title', cls: 'wrap', render: x => `${esc(String(x.l.title || x.p.title || x.p.name).slice(0, 90))}${x.l.title ? '' : ' <small class="muted">(master)</small>'}`, sort: x => x.l.title || x.p.title || '' },
    { k: 'price', l: 'Price', num: 1, render: x => `${inr(chanPrice(x.p, pk), chanPrice(x.p, pk) % 1 ? 2 : 0)}<small class="muted"> /${esc(unitOf(x.p))}</small>`, sort: x => chanPrice(x.p, pk) },
    { k: 'fee', l: 'Fees', num: 1, render: x => `${inr(x.e.fees + x.e.gstOnFees)}${x.p.listings && x.l.fees && Object.keys(x.l.fees).length ? '<br><small class="muted">SKU rates</small>' : ''}`, sort: x => x.e.fees },
    { k: 'profit', l: 'Profit / unit', num: 1, cost: 1, render: x => `<span class="${x.e.profit < 0 ? 'neg' : ''}">${inr(x.e.profit)}</span><br><small class="muted">${pct(x.e.margin, 0)}</small>`, sort: x => x.e.profit },
    { k: 'rating', l: 'Rating', num: 1, render: x => N(x.l.ratingAvg) ? `${N(x.l.ratingAvg).toFixed(1)}★<br><small class="muted">${num(x.l.ratingCount)} ratings</small>` : '—', sort: x => N(x.l.ratingAvg) },
    { k: 'links', l: 'Links', nosort: 1, render: x => [linkA(x.l.url, 'Listing', 'link', 'lnk'), linkA(x.l.driveLink || x.p.driveLink, 'Drive', 'folder', 'lnk')].filter(Boolean).join(' ') || '<span class="muted">—</span>' },
    { k: 'st', l: 'Status', render: x => pill((LIST_STATUS.find(s => s[0] === x.st) || [, x.st])[1], LT[x.st]), sort: x => x.st },
  ], rows, { select: can, key: x => x.p.id, open: x => 'open:product:' + x.p.id, sort: { k: 'st', dir: 'asc' }, empty: empty('No listings here', 'Open a product and fill its Channels tab to set this channel’s SKU, title and price.') }), { flush: true });
  void costs;
  return html;
}
Object.assign(ACT, {
  lplat(k) { ui.filt.lplat = k; selOf('lst').clear(); schedule(); },
  prodgrid() { prodGrid(); },
  bulkprod() { bulkProd(selIds('cat')); },
  bulkdelprod() { bulkDelete('products', selIds('cat'), 'catalogue', p => `Product ${p.sku} · ${p.name}`, p => S.sales.some(s => s.productId === p.id) ? 'Has sales entries. Archive it instead.' : '', 'cat'); },
  bulklist(pk) { bulkList(selIds('lst'), pk); },
  exportlist() { const ap = activePlatforms(); const rows = S.products.filter(p => inBrand(p) && p.status !== 'archived').flatMap(p => ap.map(pl => ({ p, pl, l: listingOf(p, pl.key) }))).filter(x => (x.l.status || 'none') !== 'none' || x.l.sku); exportCSV('Channel listings', [{ l: 'Master SKU', csv: x => x.p.sku }, { l: 'Product', csv: x => x.p.name }, { l: 'Channel', csv: x => x.pl.name }, { l: 'Channel SKU', csv: x => x.l.sku || x.p.sku }, { l: 'Listing ID', csv: x => x.l.id || '' }, { l: 'Status', csv: x => x.l.status || 'none' }, { l: 'Title', csv: x => x.l.title || x.p.title || '' }, { l: 'Price', csv: x => chanPrice(x.p, x.pl.key) }, { l: 'Unit', csv: x => unitOf(x.p) }, { l: 'Listing link', csv: x => x.l.url || '' }, { l: 'Drive folder', csv: x => x.l.driveLink || x.p.driveLink || '' }, { l: 'Stars', csv: x => x.l.ratingAvg ?? '' }, { l: 'Ratings', csv: x => x.l.ratingCount ?? '' }], rows, 'catalogue'); },
});
function bulkProd(ids) {
  const ps = ids.map(prodOf).filter(Boolean); if (!ps.length) return; const ap = activePlatforms();
  const f = [
    { raw: `<p class="muted" style="margin:0">Only the fields you fill in change. Everything left blank stays as it is on each of the ${num(ps.length)} products.</p>` },
    { n: 'status', l: 'Status', t: 'select', o: [['active', 'Active'], ['draft', 'Draft'], ['archived', 'Archived']], blank: 'Keep as is' },
    { n: 'brandId', l: 'Brand', t: 'select', o: brandOpts, blank: 'Keep as is' }, { n: 'category', l: 'Category', t: 'select', o: PROD_CATS, blank: 'Keep as is' },
    { n: 'unit', l: 'Unit', t: 'select', o: UNITS, blank: 'Keep as is' }, { n: 'gstRate', l: 'GST rate', t: 'select', num: 1, o: GST_RATES.map(g => [g, g + '%']), blank: 'Keep as is' },
    { n: 'hsn', l: 'HSN code', mono: 1, ph: 'Keep as is' }, { n: 'reorderLevel', l: 'Reorder level', t: 'number', min: 0, ph: 'Keep as is' },
    { n: 'location', l: 'Storage location', ph: 'Keep as is' }, { n: 'supplierId', l: 'Preferred vendor', t: 'select', o: () => S.suppliers.map(s => [s.id, s.name]), blank: 'Keep as is' },
    { n: 'priceChange', l: 'Change selling price by', t: 'pct', step: 'any', ph: 'e.g. 5 or -10', help: 'Percentage up or down, rounded to the rupee.' },
    { n: 'listPlat', l: 'Listing status on', t: 'select', o: ap.map(p => [p.key, p.name]), blank: 'No listing change' }, { n: 'listStatus', l: 'Set to', t: 'select', o: LIST_STATUS, blank: 'Choose…' },
  ];
  openDrawer({
    title: `Edit ${num(ps.length)} products`, sub: ps.slice(0, 4).map(p => esc(p.sku)).join(', ') + (ps.length > 4 ? ` and ${ps.length - 4} more` : ''), html: form(f, {}), saveLabel: `Update ${num(ps.length)}`, savedMsg: null,
    onSave: async v => {
      const ops = []; const ch = []; const keys = ['status', 'brandId', 'category', 'unit', 'hsn', 'location', 'supplierId']; for (const k of keys) if (v[k]) ch.push(`${label(k)} → ${fmtVal(k, v[k])}`); if (v.gstRate !== null && v.gstRate !== undefined && v.gstRate !== '') ch.push('GST → ' + v.gstRate + '%'); if (v.reorderLevel !== null) ch.push('Reorder level → ' + v.reorderLevel); if (N(v.priceChange)) ch.push(`Price ${N(v.priceChange) > 0 ? '+' : ''}${v.priceChange}%`); if (v.listPlat && v.listStatus) ch.push(`${PL(v.listPlat).name} listing → ${(LIST_STATUS.find(x => x[0] === v.listStatus) || [, v.listStatus])[1]}`);
      if (!ch.length) { toast('Fill in at least one field to change.', 'bad'); return false; }
      for (const p of ps) {
        const d = { ...base(p) }; for (const k of keys) if (v[k]) d[k] = v[k]; if (v.gstRate !== null && v.gstRate !== undefined && v.gstRate !== '') d.gstRate = N(v.gstRate); if (v.reorderLevel !== null) d.reorderLevel = N(v.reorderLevel);
        if (N(v.priceChange)) d.sellingPrice = Math.max(0, Math.round(N(p.sellingPrice) * (1 + N(v.priceChange) / 100)));
        if (v.listPlat && v.listStatus) d.listings = { ...(p.listings || {}), [v.listPlat]: { ...listingOf(p, v.listPlat), status: v.listStatus } };
        ops.push({ op: 'set', path: 'products/' + p.id, data: clean({ ...d, ...stampOf(p) }) });
      }
      await batchAll(ops); selOf('cat').clear(); addLog('update', 'catalogue', `Bulk edit of ${ps.length} products`, ch.join('; ') + ' · ' + ps.slice(0, 10).map(p => p.sku).join(', ')); toast(`Updated ${ps.length} products`);
    },
  });
}
function bulkList(ids, pk) {
  const ps = ids.map(prodOf).filter(Boolean); if (!ps.length) return; const pl = PL(pk);
  openDrawer({
    title: `${pl.name}: ${num(ps.length)} listings`, sub: 'Set the listing status, price change or Drive folder for every ticked product on this channel.',
    html: form([{ n: 'status', l: 'Listing status', t: 'select', o: LIST_STATUS, blank: 'Keep as is' }, { n: 'priceChange', l: `Change ${pl.name} price by`, t: 'pct', step: 'any', ph: 'e.g. -5' }, ...FEE_F.map(([k, l, s]) => ({ n: 'fees.' + k, l: `${l} (${s})`, t: 'number', min: 0, ph: 'Keep as is' }))], {}), saveLabel: 'Update listings', savedMsg: null,
    onSave: async v => {
      const fees = {}; for (const [k] of FEE_F) { const x = getPath(v, 'fees.' + k); if (x !== null && x !== undefined && x !== '') fees[k] = N(x); }
      if (!v.status && !N(v.priceChange) && !Object.keys(fees).length) { toast('Fill in at least one field.', 'bad'); return false; }
      const ops = ps.map(p => { const l = { ...listingOf(p, pk) }; if (v.status) l.status = v.status; if (N(v.priceChange)) l.price = Math.max(0, Math.round(chanPrice(p, pk) * (1 + N(v.priceChange) / 100))); if (Object.keys(fees).length) l.fees = { ...(l.fees || {}), ...fees }; return { op: 'set', path: 'products/' + p.id, data: clean({ ...base(p), listings: { ...(p.listings || {}), [pk]: l }, ...stampOf(p) }) }; });
      await batchAll(ops); selOf('lst').clear(); addLog('update', 'catalogue', `Updated ${ps.length} ${pl.name} listings`, [v.status ? 'Status → ' + v.status : '', N(v.priceChange) ? 'Price ' + v.priceChange + '%' : '', Object.keys(fees).length ? 'Fees: ' + Object.entries(fees).map(([k, x]) => k + ' ' + x).join(', ') : ''].filter(Boolean).join('; ')); toast(`Updated ${ps.length} listings`);
    },
  });
}

/* ---------- add many products in a grid (paste from Excel works) ---------- */
let GRID = [];
const GCOLS = [['name', 'Product name', 'text', 1], ['sku', 'SKU', 'text'], ['unit', 'Unit', 'unit'], ['sellingPrice', 'Price', 'num', 1], ['mrp', 'MRP', 'num'], ['costPrice', 'Cost', 'num'], ['gstRate', 'GST %', 'num'], ['openingStock', 'Opening stock', 'num'], ['reorderLevel', 'Reorder at', 'num'], ['category', 'Category', 'text'], ['hsn', 'HSN', 'text']];
const gridBlank = () => ({ unit: 'pc', gstRate: 18 });
function prodGrid() {
  if (!S.brands.length) { toast('Add a brand first.', 'bad'); return; }
  GRID = Array.from({ length: 6 }, gridBlank); const brand0 = ui.brand !== 'all' ? ui.brand : (myBrands()[0] || {}).id;
  const cols = GCOLS.filter(c => c[0] !== 'costPrice' || allow('costs'));
  const gridHTML = () => `<div class="tw grid-w"><table class="t grid"><thead><tr><th>#</th>${cols.map(c => `<th>${esc(c[1])}${c[3] ? ' <span class="req">*</span>' : ''}</th>`).join('')}<th></th></tr></thead><tbody>${GRID.map((r, i) => `<tr><td class="muted tnum">${i + 1}</td>${cols.map(([k, , t]) => `<td>${t === 'unit' ? `<select class="inp" name="g.${i}.${k}" data-t="str" aria-label="Row ${i + 1} unit">${UNITS.map(([u]) => `<option${(r[k] || 'pc') === u ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select>` : `<input class="inp${t === 'num' ? ' tnum' : ''}"${t === 'num' ? ' type="number" step="any" min="0"' : ''} name="g.${i}.${k}" data-t="${t === 'num' ? 'num' : 'str'}" value="${esc(r[k] ?? '')}" aria-label="Row ${i + 1} ${k}">`}</td>`).join('')}<td><button type="button" class="btn icon ghost sm" data-act="gridrm:${i}" aria-label="Remove row">${icon('x')}</button></td></tr>`).join('')}</tbody></table></div>`;
  openDrawer({
    title: 'Add many products', sub: 'Type into the grid, or paste rows copied from Excel or Google Sheets. Blank rows are ignored.', wide: true, saveLabel: 'Add products', savedMsg: null, noFocus: true,
    html: () => `<div class="form"><div class="fld"><label for="fi_gbrand">Brand for these products</label><select class="inp" id="fi_gbrand" name="gbrand" data-t="str">${brandOpts().map(([k, l]) => `<option value="${esc(k)}"${k === brand0 ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div><div class="fld"><label for="fi_gstatus">Status</label><select class="inp" id="fi_gstatus" name="gstatus" data-t="str"><option value="active">Active</option><option value="draft">Draft</option></select></div></div>
      <details class="paste"><summary>${icon('copy')} Paste from a spreadsheet</summary><p class="help">Copy cells from Excel or Sheets in this column order: ${cols.map(c => esc(c[1])).join(', ')}. Paste below and press Fill grid.</p><textarea class="inp mono" id="gridPaste" rows="5" placeholder="Veg-tan leather tan 2mm\tTVL-0101\tsq ft\t180\t220\t95\t5\t400\t50"></textarea><div style="margin-top:8px">${btn('Fill grid', 'gridpaste', { sm: true })}</div></details>
      <div id="gridBox">${gridHTML()}</div><div style="margin-top:10px;display:flex;gap:8px">${btn('Add 5 rows', 'gridadd', { sm: true, i: 'plus' })}</div>`,
    onSave: async v => {
      syncGrid(); const rows = GRID.filter(r => String(r.name || '').trim()); if (!rows.length) { toast('Enter at least one product name.', 'bad'); return false; }
      const errs = []; const used = new Set(S.products.map(p => String(p.sku || '').toLowerCase())); const b = brandOf(v.gbrand); const code = ((b && b.code) || 'SKU').toUpperCase();
      let mx = 0; S.products.forEach(p => { const m = String(p.sku || '').match(new RegExp('^' + code + '-(\\d+)$')); if (m) mx = Math.max(mx, +m[1]); });
      const ops = [];
      rows.forEach((r, i) => {
        if (N(r.sellingPrice) <= 0) errs.push(`Row “${r.name}”: enter a price.`);
        let sku = String(r.sku || '').trim().toUpperCase(); if (!sku) { mx++; sku = code + '-' + String(mx).padStart(4, '0'); }
        if (used.has(sku.toLowerCase())) errs.push(`SKU ${sku} is already used.`); used.add(sku.toLowerCase());
        const cat = PROD_CATS.find(c => c.toLowerCase() === String(r.category || '').trim().toLowerCase()) || (r.category ? 'Other' : '');
        ops.push({ op: 'set', path: 'products/' + newId('products'), data: clean({ name: String(r.name).trim(), sku, brandId: v.gbrand, status: v.gstatus || 'active', unit: UNITS.some(u => u[0] === r.unit) ? r.unit : 'pc', purchaseFactor: 1, sellingPrice: N(r.sellingPrice), mrp: r.mrp ? N(r.mrp) : null, costPrice: r.costPrice ? N(r.costPrice) : null, gstRate: r.gstRate === null || r.gstRate === undefined || r.gstRate === '' ? 18 : N(r.gstRate), openingStock: N(r.openingStock), reorderLevel: r.reorderLevel === null || r.reorderLevel === undefined || r.reorderLevel === '' ? 10 : N(r.reorderLevel), category: cat, hsn: r.hsn || '', listings: {}, ...stampOf(null) }) });
        void i;
      });
      if (errs.length) { toast(errs.slice(0, 2).join(' '), 'bad'); return false; }
      await batchAll(ops); addLog('create', 'catalogue', `Added ${ops.length} products in one go`, ops.slice(0, 12).map(o => o.data.sku).join(', ')); toast(`Added ${ops.length} products`);
    },
  });
  DRW_grid = { html: gridHTML };
}
let DRW_grid = null;
function syncGrid() { const { vals } = readForm($('#drForm')); const g = vals.g || {}; GRID = GRID.map((r, i) => ({ ...r, ...(g[i] || {}) })); }
function redrawGrid() { const el = $('#gridBox'); if (el && DRW_grid) el.innerHTML = DRW_grid.html(); }
// tab-separated (spreadsheet) or comma-separated rows → arrays
function parsePaste(text) { return String(text || '').replace(/\r/g, '').split('\n').filter(l => l.trim()).map(l => (l.includes('\t') ? l.split('\t') : parseCSV(l)[0] || []).map(x => String(x).trim())); }
Object.assign(ACT, {
  gridadd() { syncGrid(); for (let i = 0; i < 5; i++) GRID.push(gridBlank()); redrawGrid(); },
  gridrm(i) { syncGrid(); GRID.splice(+i, 1); if (!GRID.length) GRID.push(gridBlank()); redrawGrid(); },
  gridpaste() {
    syncGrid(); const lines = parsePaste(($('#gridPaste') || {}).value); if (!lines.length) { toast('Paste some rows first.', 'bad'); return; }
    const cols = GCOLS.filter(c => c[0] !== 'costPrice' || allow('costs')); const first = lines[0].map(x => x.toLowerCase()); const hasHead = first[0] && /name|product/.test(first[0]);
    const rows = (hasHead ? lines.slice(1) : lines).map(cells => { const r = gridBlank(); cols.forEach(([k, , t], j) => { const x = cells[j]; if (x === undefined || x === '') return; r[k] = t === 'num' ? N(String(x).replace(/[₹,\s%]/g, '')) : x; }); return r; });
    GRID = GRID.filter(r => String(r.name || '').trim()).concat(rows); redrawGrid(); toast(`${rows.length} rows filled. Check them, then press Add products.`);
  },
});
