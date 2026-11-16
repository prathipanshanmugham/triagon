/* =====================================================================
   Consumables / packaging materials: boxes, poly bags, bubble wrap, bottles, cello tape, stickers…
   One record per size (Poly bag 6 × 8 in and Poly bag 8 × 10 in are two records), with its dimensions,
   supplier and, optionally, how many are in stock. No costs here — just what we use and who sells it.
   ===================================================================== */
Object.assign(IC, { pack: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9"/><path d="m7.6 5.3 8.6 4.6"/>' });
// key, label, default material name, default stock unit
const PK_CATS = [['leatherbox', 'Leather packaging boxes', 'Box', 'pcs'], ['paintbox', 'Paint packaging boxes', 'Box', 'pcs'], ['polybag', 'Poly bags', 'Poly bag', 'pcs'], ['bubble', 'Bubble wrap', 'Bubble wrap', 'rolls'], ['bottle', 'Bottles', 'Bottle', 'pcs'], ['tape', 'Cello tape', 'Cello tape', 'rolls'], ['sticker', 'Stickers', 'Sticker', 'pcs'], ['other', 'Other packaging materials', '', 'pcs']];
const PK_DIM = [['in', 'inches'], ['cm', 'cm'], ['mm', 'mm'], ['m', 'metres']];
const PK_THICK = [['micron', 'micron'], ['gauge', 'gauge'], ['mm', 'mm'], ['cm', 'cm'], ['in', 'inches'], ['ply', 'ply'], ['gsm', 'gsm']];
const PK_STOCKU = [['pcs', 'pieces'], ['rolls', 'rolls'], ['packs', 'packs'], ['sheets', 'sheets'], ['boxes', 'boxes'], ['bundles', 'bundles'], ['kg', 'kg'], ['m', 'metres']];
const pkCat = k => PK_CATS.find(c => c[0] === k) || PK_CATS[PK_CATS.length - 1];
const pkOf = id => byId('packaging')[id];
const pkNum = n => String(Math.round(N(n) * 1000) / 1000);
// "6 × 8 in", "30 × 20 × 10 cm", "48 mm wide · 65 m roll", "· 50 ml", "· 50 micron"
function pkSize(x, withThick = true) {
  const d = [x.l, x.w, x.h].filter(v => N(v) > 0).map(pkNum); const u = x.dimUnit || 'in'; const out = [];
  if (d.length) out.push(`${d.join(' × ')} ${u}${d.length === 1 && N(x.rollLen) > 0 ? ' wide' : ''}`);
  if (N(x.rollLen) > 0) out.push(`${pkNum(x.rollLen)} ${x.rollUnit || 'm'} roll`);
  if (N(x.capacity) > 0) out.push(`${pkNum(x.capacity)} ${x.capUnit || 'ml'}`);
  if (withThick && N(x.thick) > 0) out.push(`${pkNum(x.thick)} ${x.thickUnit || 'micron'}`);
  return out.join(' · ');
}
const pkThick = x => N(x.thick) > 0 ? `${pkNum(x.thick)} ${x.thickUnit || 'micron'}` : '';
const pkSupplier = x => (x.supplierId && supOf(x.supplierId) ? supOf(x.supplierId).name : '') || x.supplierName || '';
const pkTitle = x => [x.name || pkCat(x.category)[2] || 'Packaging material', pkSize(x, false)].filter(Boolean).join(' ');
const pkStock = x => x.stock === null || x.stock === undefined || x.stock === '' ? null : N(x.stock);
// the same material, size and thickness entered twice
const pkKey = x => [x.category, String(x.name || '').trim().toLowerCase(), pkNum(x.l), pkNum(x.w), pkNum(x.h), x.dimUnit || 'in', pkNum(x.thick), N(x.thick) ? x.thickUnit || 'micron' : '', pkNum(x.rollLen), pkNum(x.capacity), N(x.capacity) ? x.capUnit || 'ml' : ''].join('|');
const pkArea = x => { const k = { mm: 0.1, cm: 1, in: 2.54, m: 100 }[x.dimUnit || 'in'] || 1; return (N(x.l) || 1) * (N(x.w) || 1) * (N(x.h) || 1) * k * k * k + N(x.capacity); };

V.packaging = () => {
  const can = canEdit('packaging'); const f = filtOf('pk', 'all');
  const all = S.packaging.slice().sort((a, b) => PK_CATS.findIndex(c => c[0] === a.category) - PK_CATS.findIndex(c => c[0] === b.category) || String(a.name).localeCompare(String(b.name)) || pkArea(a) - pkArea(b));
  const rows = all.filter(x => (f === 'all' || x.category === f) && matchQ('pk', x.name, pkCat(x.category)[1], pkSize(x), pkSupplier(x), x.note));
  const sup = new Set(all.map(pkSupplier).filter(Boolean)).size;
  let html = ph('Consumables / packaging materials', `Boxes, poly bags, bubble wrap, bottles, tape and stickers — one entry for each size, with its supplier and stock.${all.length ? ` ${num(all.length)} materials from ${num(sup)} supplier${sup === 1 ? '' : 's'}.` : ''}`, can ? btn('Add material', 'new:packaging', { pri: true, i: 'plus' }) : '');
  const chips = [['all', 'All', all.length], ...PK_CATS.map(c => [c[0], c[1], all.filter(x => x.category === c[0]).length]).filter(c => c[2] || c[0] === f)];
  html += `<div class="toolbar">${searchHTML('pk', 'Search material, size or supplier…')}<span class="sp"></span>${exportBtn('exportpack', 'Export')}</div><div class="toolbar pk-chips">${chipsHTML('pk', chips, f)}</div>`;
  if (can) html += selBar('packaging', btn('Delete selected', 'bulkdelpack', { sm: true, i: 'trash', cls: 'danger' }));
  html += panel('', table('packaging', [
    { k: 'name', l: 'Material', render: x => `<b>${esc(x.name || pkCat(x.category)[2] || '—')}</b>${x.note ? `<small class="muted" style="display:block">${esc(x.note)}</small>` : ''}`, sort: x => String(x.name || '').toLowerCase() },
    { k: 'cat', l: 'Category', render: x => esc(pkCat(x.category)[1]), sort: x => PK_CATS.findIndex(c => c[0] === x.category) },
    { k: 'size', l: 'Size', render: x => pkSize(x, false) ? `<span class="tnum">${esc(pkSize(x, false))}</span>` : '<span class="muted">—</span>', sort: pkArea },
    { k: 'thick', l: 'Thickness', render: x => pkThick(x) ? esc(pkThick(x)) : '<span class="muted">—</span>', sort: x => N(x.thick) },
    { k: 'sup', l: 'Supplier', render: x => pkSupplier(x) ? esc(pkSupplier(x)) : '<span class="muted">—</span>', sort: x => pkSupplier(x).toLowerCase() },
    { k: 'stock', l: 'Available stock', num: 1, render: x => pkStock(x) === null ? '<span class="muted">—</span>' : `<b class="${pkStock(x) <= 0 ? 'neg' : ''}">${num(pkStock(x))}</b> <small class="muted">${esc(x.stockUnit || 'pcs')}</small>`, sort: x => pkStock(x) ?? -1 },
  ], rows, { select: can, key: x => x.id, open: x => 'open:packaging:' + x.id, sort: { k: 'cat', dir: 'asc' }, empty: S.packaging.length ? empty('Nothing matches', 'Try another search or category.') : empty('No packaging materials yet', 'Add each box, poly bag, bottle, tape or sticker you use — one entry for each size — with its supplier and stock.', can ? btn('Add material', 'new:packaging', { pri: true, i: 'plus' }) : '') }), { flush: true });
  return html;
};

EDIT.packaging = (id, preset) => {
  const x = id ? pkOf(id) : null; const can = canEdit('packaging'); if (id && !x) return;
  const vend = S.suppliers.filter(s => s.status !== 'inactive' || (x && x.supplierId === s.id)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const supSel = x ? (x.supplierId && supOf(x.supplierId) ? x.supplierId : (x.supplierName ? '__other' : '')) : (preset && preset.supplierId) || '';
  const cat0 = (x && x.category) || (preset && preset.category) || 'polybag';
  const v0 = x ? { ...x, supplierId: supSel, dimUnit: x.dimUnit || 'in', thickUnit: x.thickUnit || 'micron', stockUnit: x.stockUnit || pkCat(x.category)[3] } : { category: cat0, name: pkCat(cat0)[2], dimUnit: 'in', thickUnit: 'micron', rollUnit: 'm', capUnit: 'ml', stockUnit: pkCat(cat0)[3], ...(preset || {}), supplierId: supSel };
  const rollWhen = 'category:tape|bubble|other';
  const fields = [
    { n: 'category', l: 'Category', t: 'select', req: 1, o: PK_CATS.map(c => [c[0], c[1]]), ch: x ? '' : 'pkcat' },
    { n: 'name', l: 'Material name', req: 1, ph: 'e.g. Poly bag, Box, Bottle, Cello tape', list: 'pkNames' },
    { raw: '<div class="subh full" style="margin:4px 0 0">Size</div>' },
    { n: 'l', l: 'Length', t: 'number', min: 0, step: 'any' }, { n: 'w', l: 'Width', t: 'number', min: 0, step: 'any' },
    { n: 'h', l: 'Height', t: 'number', min: 0, step: 'any', help: 'For boxes and bottles.' }, { n: 'dimUnit', l: 'Size in', t: 'select', o: PK_DIM },
    { n: 'thick', l: 'Thickness', t: 'number', min: 0, step: 'any', help: 'Where it applies: poly bags, bubble wrap, boxes (ply).' }, { n: 'thickUnit', l: 'Thickness in', t: 'select', o: PK_THICK },
    { n: 'rollLen', l: 'Roll length', t: 'number', min: 0, step: 'any', when: rollWhen }, { n: 'rollUnit', l: 'Roll length in', t: 'select', o: [['m', 'metres'], ['ft', 'feet']], when: rollWhen },
    { n: 'capacity', l: 'Capacity', t: 'number', min: 0, step: 'any', when: 'category:bottle' }, { n: 'capUnit', l: 'Capacity in', t: 'select', o: [['ml', 'ml'], ['l', 'litres'], ['g', 'grams']], when: 'category:bottle' },
    { raw: '<div class="subh full" style="margin:4px 0 0">Supplier and stock</div>' },
    { n: 'supplierId', l: 'Supplier', t: 'select', o: [...vend.map(s => [s.id, s.name]), ['__other', 'Another supplier (type the name)']], blank: 'Not set', full: 1, help: vend.length ? 'Pick one of your vendors (Inventory & purchasing › Vendors), or choose Another supplier and type the name.' : 'No vendors yet: choose Another supplier and type the name, or add vendors in Inventory & purchasing › Vendors.' },
    { n: 'supplierName', l: 'Supplier name', full: 1, when: 'supplierId:__other', ph: 'e.g. Sri Murugan Packaging, Erode' },
    { n: 'stock', l: 'Available stock (optional)', t: 'number', min: 0, step: 'any' }, { n: 'stockUnit', l: 'Counted in', t: 'select', o: PK_STOCKU },
    { n: 'note', l: 'Notes', t: 'textarea', rows: 2, full: 1, ph: 'Colour, print, material, which products it is for…' },
  ];
  const names = [...new Set([...PK_CATS.map(c => c[2]).filter(Boolean), 'Corrugated box', 'Mailer box', 'Kraft box', 'Zip-lock bag', 'Courier bag', 'Bubble mailer', 'Jar', 'Tin', 'Brand sticker', 'Fragile sticker', 'Label', 'Tissue paper', 'Thank-you card', ...S.packaging.map(p => p.name).filter(Boolean)])];
  openDrawer({
    title: x ? pkTitle(x) : 'New packaging material', sub: x ? `${esc(pkCat(x.category)[1])}${pkSupplier(x) ? ' · ' + esc(pkSupplier(x)) : ''}${pkStock(x) !== null ? ` · ${num(pkStock(x))} ${esc(x.stockUnit || 'pcs')} in stock` : ''}` : 'One entry for each size: Poly bag 6 × 8 in and Poly bag 8 × 10 in are two entries.', readOnly: !can, delKey: 'packaging/' + id,
    html: form(fields, v0) + `<datalist id="pkNames">${names.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>`,
    footExtra: x && can ? btn('Add another size', 'pkcopy:' + x.id, { i: 'plus' }) : '',
    validate: v => {
      const e = []; const has = [v.l, v.w, v.h, v.rollLen, v.capacity].some(n => N(n) > 0);
      if (!has) e.push({ n: 'l', m: 'Enter the size: at least a length, width, height' + (v.category === 'bottle' ? ' or capacity' : '') + '.' });
      for (const k of ['l', 'w', 'h', 'thick', 'rollLen', 'capacity', 'stock']) if (v[k] !== null && v[k] !== '' && v[k] !== undefined && N(v[k]) < 0) e.push({ n: k, m: 'Can’t be negative.' });
      if (v.supplierId === '__other' && !String(v.supplierName || '').trim()) e.push({ n: 'supplierName', m: 'Type the supplier’s name, or choose one from the list.' });
      const k = pkKey(pkClean(v)); const dup = S.packaging.find(p => p.id !== id && pkKey(p) === k); if (dup) e.push({ n: 'name', m: `${pkTitle(dup)} is already saved. Open it to change it, or enter a different size.` });
      return e;
    },
    onSave: async v => { const d = pkClean(v); await saveDoc('packaging', id, { ...base(x), ...d }, ['packaging', `Packaging ${pkTitle(d)}`]); },
    onDelete: x ? delFn('packaging', id, 'packaging', `Packaging ${pkTitle(x)}`) : null,
  });
};
// what gets stored: numbers as numbers, units only where a value uses them, supplier as a vendor or a name
function pkClean(v) {
  const n = k => (v[k] === '' || v[k] === null || v[k] === undefined || !Number.isFinite(Number(v[k])) ? null : Number(v[k]));
  const roll = ['tape', 'bubble', 'other'].includes(v.category), bottle = v.category === 'bottle';
  const d = { category: v.category || 'other', name: String(v.name || '').trim(), l: n('l'), w: n('w'), h: n('h'), dimUnit: v.dimUnit || 'in', thick: n('thick'), rollLen: roll ? n('rollLen') : null, capacity: bottle ? n('capacity') : null, stock: n('stock'), note: String(v.note || '').trim() || null };
  // units are kept as chosen, even before a value is entered, so the form reopens the way it was left
  d.thickUnit = v.thickUnit || 'micron'; d.rollUnit = roll ? v.rollUnit || 'm' : null; d.capUnit = bottle ? v.capUnit || 'ml' : null; d.stockUnit = v.stockUnit || pkCat(d.category)[3];
  // the vendor's name is kept with the entry too, so it still shows if the vendor is ever removed
  if (v.supplierId === '__other') { d.supplierId = null; d.supplierName = String(v.supplierName || '').trim() || null; } else { d.supplierId = v.supplierId || null; d.supplierName = d.supplierId && supOf(d.supplierId) ? supOf(d.supplierId).name : null; }
  return d;
}
Object.assign(CH, {
  // a new entry follows its category: material name and stock unit
  pkcat(v) { const c = pkCat(v); const f = $('#drForm'); if (!f) return; const nm = f.querySelector('[name="name"]'); const known = PK_CATS.map(x => x[2]); if (nm && (!nm.value || known.includes(nm.value))) nm.value = c[2]; const su = f.querySelector('[name="stockUnit"]'); if (su) su.value = c[3]; },
});
Object.assign(ACT, {
  pkcopy(id) { const x = pkOf(id); if (!x) return; closeDrawer(); setTimeout(() => EDIT.packaging(null, { category: x.category, name: x.name, dimUnit: x.dimUnit || 'in', thick: x.thick, thickUnit: x.thickUnit || 'micron', rollUnit: x.rollUnit || 'm', capUnit: x.capUnit || 'ml', supplierId: x.supplierId && supOf(x.supplierId) ? x.supplierId : (x.supplierName ? '__other' : ''), supplierName: x.supplierName || '', stockUnit: x.stockUnit || pkCat(x.category)[3] }), 240); },
  bulkdelpack() { bulkDelete('packaging', selIds('packaging'), 'packaging', x => `Packaging ${pkTitle(x)}`, null, 'packaging'); },
  exportpack() { exportCSV('Packaging materials', [{ l: 'Category', csv: x => pkCat(x.category)[1] }, { l: 'Material', k: 'name' }, { l: 'Length', k: 'l' }, { l: 'Width', k: 'w' }, { l: 'Height', k: 'h' }, { l: 'Size unit', k: 'dimUnit' }, { l: 'Thickness', k: 'thick' }, { l: 'Thickness unit', csv: x => N(x.thick) > 0 ? x.thickUnit || 'micron' : '' }, { l: 'Roll length', k: 'rollLen' }, { l: 'Roll unit', csv: x => N(x.rollLen) > 0 ? x.rollUnit || 'm' : '' }, { l: 'Capacity', k: 'capacity' }, { l: 'Capacity unit', csv: x => N(x.capacity) > 0 ? x.capUnit || 'ml' : '' }, { l: 'Supplier', csv: pkSupplier }, { l: 'Available stock', k: 'stock' }, { l: 'Stock unit', csv: x => pkStock(x) === null ? '' : x.stockUnit || 'pcs' }, { l: 'Notes', k: 'note' }], S.packaging, 'packaging'); },
});
