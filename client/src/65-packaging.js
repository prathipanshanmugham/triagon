/* =====================================================================
   Consumables / packaging materials: boxes, poly bags, bubble wrap, bottles, cello tape, stickers…
   One record per size (Poly bag 6 × 8 in and Poly bag 8 × 10 in are two records), with its dimensions,
   supplier and, optionally, how many are in stock. No costs here — just what we use and who sells it.
   ===================================================================== */
Object.assign(IC, { pack: '<path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9"/><path d="m7.6 5.3 8.6 4.6"/>' });
// categories: { k, l (name), name (new items start as), unit (stock counted in), extra ('' | roll | capacity) }.
// The CEO (or a role with "Manage packaging categories") keeps the list in settings/packaging; k never changes.
const pkCats = () => MODEL.packCats(S.settings.packaging);
const pkCat = k => pkCats().find(c => c.k === k) || { k: k || '', l: 'Uncategorised', name: '', unit: 'pcs', extra: '', none: true };
const pkCatIdx = k => { const i = pkCats().findIndex(c => c.k === k); return i < 0 ? 9999 : i; };
const canPackCats = () => allow('packCats') && canEdit('packaging');
const PK_EXTRA = [['', 'None — length, width, height and thickness'], ['roll', 'Roll length (tape, wrap, anything on a roll)'], ['capacity', 'Capacity (bottles, jars, tins)']];
const PK_DIM = [['in', 'inches'], ['cm', 'cm'], ['mm', 'mm'], ['m', 'metres']];
const PK_THICK = [['micron', 'micron'], ['gauge', 'gauge'], ['mm', 'mm'], ['cm', 'cm'], ['in', 'inches'], ['ply', 'ply'], ['gsm', 'gsm']];
const PK_STOCKU = [['pcs', 'pieces'], ['rolls', 'rolls'], ['packs', 'packs'], ['sheets', 'sheets'], ['boxes', 'boxes'], ['bundles', 'bundles'], ['kg', 'kg'], ['m', 'metres']];
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
const pkTitle = x => [x.name || pkCat(x.category).name || 'Packaging material', pkSize(x, false)].filter(Boolean).join(' ');
const pkStock = x => x.stock === null || x.stock === undefined || x.stock === '' ? null : N(x.stock);
// the same material, size and thickness entered twice
const pkKey = x => [x.category, String(x.name || '').trim().toLowerCase(), pkNum(x.l), pkNum(x.w), pkNum(x.h), x.dimUnit || 'in', pkNum(x.thick), N(x.thick) ? x.thickUnit || 'micron' : '', pkNum(x.rollLen), pkNum(x.capacity), N(x.capacity) ? x.capUnit || 'ml' : ''].join('|');
const pkArea = x => { const k = { mm: 0.1, cm: 1, in: 2.54, m: 100 }[x.dimUnit || 'in'] || 1; return (N(x.l) || 1) * (N(x.w) || 1) * (N(x.h) || 1) * k * k * k + N(x.capacity); };

V.packaging = () => {
  const can = canEdit('packaging'); const cats = pkCats(); const tab = tabOf('pk', 'items');
  const all = S.packaging.slice().sort((a, b) => pkCatIdx(a.category) - pkCatIdx(b.category) || String(a.name).localeCompare(String(b.name)) || pkArea(a) - pkArea(b));
  const sup = new Set(all.map(pkSupplier).filter(Boolean)).size;
  let html = ph('Consumables / packaging materials', `Boxes, poly bags, bubble wrap, bottles, tape and stickers — one entry for each size, with its supplier and stock.${all.length ? ` ${num(all.length)} materials from ${num(sup)} supplier${sup === 1 ? '' : 's'}.` : ''}`, tab === 'cats' ? (canPackCats() ? btn('Add category', 'pkcatnew', { pri: true, i: 'plus' }) : '') : (can ? btn('Add material', 'new:packaging', { pri: true, i: 'plus' }) : ''));
  html += tabsHTML('pk', [['items', 'Materials', all.length], ['cats', 'Categories', cats.length]], tab);
  if (tab === 'cats') return html + pkCatsView();
  let f = filtOf('pk', 'all'); const orphan = all.filter(x => pkCat(x.category).none); if (f !== 'all' && f !== '__none' && !cats.some(c => c.k === f)) f = 'all';
  const rows = all.filter(x => (f === 'all' || (f === '__none' ? pkCat(x.category).none : x.category === f)) && matchQ('pk', x.name, pkCat(x.category).l, pkSize(x), pkSupplier(x), x.note));
  const chips = [['all', 'All', all.length], ...cats.map(c => [c.k, c.l, all.filter(x => x.category === c.k).length]).filter(c => c[2] || c[0] === f), ...(orphan.length ? [['__none', 'Uncategorised', orphan.length]] : [])];
  html += `<div class="toolbar">${searchHTML('pk', 'Search material, size or supplier…')}<span class="sp"></span>${exportBtn('exportpack', 'Export')}</div><div class="toolbar pk-chips">${chipsHTML('pk', chips, f)}</div>`;
  if (can) html += selBar('packaging', btn('Move to category', 'bulkmovepk', { sm: true, i: 'layers' }) + btn('Delete selected', 'bulkdelpack', { sm: true, i: 'trash', cls: 'danger' }));
  html += panel('', table('packaging', [
    { k: 'name', l: 'Material', render: x => `<b>${esc(x.name || pkCat(x.category).name || '—')}</b>${x.note ? `<small class="muted" style="display:block">${esc(x.note)}</small>` : ''}`, sort: x => String(x.name || '').toLowerCase() },
    { k: 'cat', l: 'Category', render: x => pkCat(x.category).none ? '<span class="muted">Uncategorised</span>' : esc(pkCat(x.category).l), sort: x => pkCatIdx(x.category) },
    { k: 'size', l: 'Size', render: x => pkSize(x, false) ? `<span class="tnum">${esc(pkSize(x, false))}</span>` : '<span class="muted">—</span>', sort: pkArea },
    { k: 'thick', l: 'Thickness', render: x => pkThick(x) ? esc(pkThick(x)) : '<span class="muted">—</span>', sort: x => N(x.thick) },
    { k: 'sup', l: 'Supplier', render: x => pkSupplier(x) ? esc(pkSupplier(x)) : '<span class="muted">—</span>', sort: x => pkSupplier(x).toLowerCase() },
    { k: 'stock', l: 'Available stock', num: 1, render: x => pkStock(x) === null ? '<span class="muted">—</span>' : `<b class="${pkStock(x) <= 0 ? 'neg' : ''}">${num(pkStock(x))}</b> <small class="muted">${esc(x.stockUnit || 'pcs')}</small>`, sort: x => pkStock(x) ?? -1 },
  ], rows, { select: can, key: x => x.id, open: x => 'open:packaging:' + x.id, sort: { k: 'cat', dir: 'asc' }, empty: S.packaging.length ? empty('Nothing matches', 'Try another search or category.') : empty('No packaging materials yet', 'Add each box, poly bag, bottle, tape or sticker you use — one entry for each size — with its supplier and stock.', can ? btn('Add material', 'new:packaging', { pri: true, i: 'plus' }) : '') }), { flush: true });
  return html;
};
// the Categories tab: everyone sees the list; the CEO (or a role allowed to) adds, renames and deletes
function pkCatsView() {
  const cats = pkCats(); const man = canPackCats(); const n = k => S.packaging.filter(x => x.category === k).length; const ex = { roll: 'Roll length', capacity: 'Capacity' };
  const unitL = u => ((PK_STOCKU.find(x => x[0] === u) || [u, u])[1]);
  let h = panel('', table('pkcats', [
    { k: 'l', l: 'Category', render: c => `<b>${esc(c.l)}</b>`, sort: c => String(c.l).toLowerCase() },
    { k: 'n', l: 'Items', num: 1, render: c => n(c.k) ? `<button type="button" class="btn sm ghost" data-act="pkcatgo:${esc(c.k)}">${num(n(c.k))} item${n(c.k) === 1 ? '' : 's'}</button>` : '<span class="muted">None</span>', sort: c => n(c.k) },
    { k: 'name', l: 'New items start as', render: c => c.name ? esc(c.name) : '<span class="muted">—</span>', sort: c => String(c.name || '') },
    { k: 'unit', l: 'Stock counted in', render: c => esc(unitL(c.unit || 'pcs')), sort: c => c.unit || '' },
    { k: 'extra', l: 'Extra size field', render: c => ex[c.extra] ? esc(ex[c.extra]) : '<span class="muted">—</span>', sort: c => c.extra || '' },
    ...(man ? [{ k: 'a', l: '', nosort: 1, render: c => `<span class="pk-ca">${btn('Edit', 'pkcatedit:' + c.k, { sm: true, ghost: true })}${cats.length > 1 ? btn('Delete', 'pkcatdel:' + c.k, { sm: true, ghost: true, cls: 'danger' }) : ''}</span>` }] : []),
  ], cats, { key: c => c.k, open: man ? c => 'pkcatedit:' + c.k : undefined }), { flush: true });
  h += `<p class="help" style="margin:10px 2px">${man ? 'Renaming a category keeps its items in it. Deleting one moves its items to the category you choose. Either way only the category changes — stock, sizes, suppliers and notes stay as they are. To group existing items, select them under Materials and use <b>Move to category</b>.' : 'Only the CEO, or a role allowed to manage packaging categories, can add, rename or delete categories.'}</p>`;
  return h;
}
async function pkSaveCats(list, msg, detail) {
  await dbWrite('set', 'settings/packaging', clean({ ...(S.settings.packaging || {}), cats: list.map(c => ({ k: c.k, l: c.l, name: c.name || '', unit: c.unit || 'pcs', extra: c.extra || '' })), updatedAt: nowISO(), updatedBy: ME.id }));
  addLog('settings', 'packaging', msg, detail || '');
}
// moving items between categories: only category changes; the same material and size can't end up twice in one category
function pkMoveClash(items, to) {
  const ids = new Set(items.map(x => x.id)); const keys = new Map(S.packaging.filter(p => !ids.has(p.id) && p.category === to).map(p => [pkKey(p), p])); const out = [];
  for (const x of items) { const k = pkKey({ ...x, category: to }); if (keys.has(k)) out.push(`${pkTitle(x)} is already in ${pkCat(to).l}`); else keys.set(k, x); }
  return out;
}
async function pkMove(items, to) {
  const now = nowISO(); await batchAll(items.filter(x => x.category !== to).map(x => ({ op: 'set', path: 'packaging/' + x.id, data: clean({ ...base(x), category: to, updatedAt: now, updatedBy: ME.id }) })));
}
function pkCatEdit(k) {
  if (!canPackCats()) { toast('Only the CEO, or a role allowed to manage packaging categories, can change categories.', 'bad'); return; }
  const cats = pkCats(); const c = k ? cats.find(x => x.k === k) : null; if (k && !c) return; const cnt = c ? S.packaging.filter(x => x.category === c.k).length : 0;
  openDrawer({
    title: c ? 'Edit category' : 'New category', sub: c ? `${esc(c.l)} · ${num(cnt)} item${cnt === 1 ? '' : 's'}. Renaming keeps ${cnt === 1 ? 'it' : 'them'} in this category.` : 'After saving, select items under Materials and use Move to category to group them here.',
    html: form([
      { n: 'l', l: 'Category name', req: 1, max: 60, full: 1, ph: 'e.g. Corrugated Box' },
      { n: 'name', l: 'New items start as', max: 60, ph: 'e.g. Corrugated box', help: 'Material name filled in when you add an item to this category. Optional.' },
      { n: 'unit', l: 'Stock counted in', t: 'select', o: PK_STOCKU },
      { n: 'extra', l: 'Extra size field', t: 'select', o: PK_EXTRA, full: 1, help: 'Every category has length, width, height and thickness.' },
    ], c || { unit: 'pcs', extra: '' }),
    footExtra: c && cats.length > 1 ? btn('Delete category', 'pkcatdel:' + c.k, { i: 'trash', cls: 'danger', ghost: true }) : '',
    validate: v => { const l = String(v.l || '').trim().toLowerCase(); return cats.some(x => x.k !== k && String(x.l).trim().toLowerCase() === l) ? [{ n: 'l', m: 'There is already a category with this name.' }] : []; },
    onSave: async v => {
      const d = { k: c ? c.k : 'c' + String(newId('packaging')).replace(/[^A-Za-z0-9]/g, '').slice(-10), l: String(v.l).trim(), name: String(v.name || '').trim(), unit: v.unit || 'pcs', extra: v.extra || '' };
      await pkSaveCats(c ? cats.map(x => x.k === c.k ? d : x) : [...cats, d], c ? (c.l !== d.l ? `Renamed packaging category ${c.l} to ${d.l}` : `Packaging category ${d.l} updated`) : `Packaging category ${d.l} added`, c && cnt ? `${cnt} item(s) stay in it` : '');
    },
    savedMsg: c ? 'Category saved.' : 'Category added. Select items under Materials and use Move to category to group them.',
  });
}
function pkCatDel(k) {
  if (!canPackCats()) return; const cats = pkCats(); const c = cats.find(x => x.k === k); if (!c) return;
  if (cats.length < 2) { toast('Keep at least one category.', 'bad'); return; }
  const items = S.packaging.filter(x => x.category === k); const others = cats.filter(x => x.k !== k); const to0 = (others.find(x => x.k === 'other') || others[0]).k;
  openDrawer({
    title: `Delete category ${c.l}?`, sub: items.length ? `${num(items.length)} item${items.length === 1 ? ' is' : 's are'} in it. Choose where ${items.length === 1 ? 'it goes' : 'they go'}: only the category changes; stock, sizes, suppliers and notes stay as they are.` : 'No items are in this category.',
    html: items.length ? form([{ n: 'to', l: `Move ${items.length === 1 ? 'its item' : `its ${num(items.length)} items`} to`, t: 'select', req: 1, full: 1, o: others.map(x => [x.k, x.l]) }], { to: to0 }) + `<div class="list bordered" style="margin-top:12px">${items.slice(0, 30).map(x => `<div class="li"><span class="sev info"></span><div class="grow"><b>${esc(pkTitle(x))}</b><small>${esc([pkSupplier(x), pkStock(x) !== null ? `${num(pkStock(x))} ${x.stockUnit || 'pcs'}` : ''].filter(Boolean).join(' · '))}</small></div></div>`).join('')}${items.length > 30 ? `<div class="li muted">…and ${num(items.length - 30)} more</div>` : ''}</div>` : '<p class="muted">Deleting it only removes the category.</p>',
    saveLabel: 'Delete category', savedMsg: null,
    validate: v => items.length ? pkMoveClash(items, v.to).slice(0, 6).map(m => ({ n: 'to', m: m + '. Pick another category, or delete or change the duplicate first.' })) : [],
    onSave: async v => {
      if (items.length) await pkMove(items, v.to);
      await pkSaveCats(others, `Packaging category ${c.l} deleted`, items.length ? `${items.length} item(s) moved to ${pkCat(v.to).l}` : '');
      toast(items.length ? `${c.l} deleted. ${items.length} item${items.length === 1 ? '' : 's'} moved to ${pkCat(v.to).l}.` : `${c.l} deleted.`);
    },
  });
}

EDIT.packaging = (id, preset) => {
  const x = id ? pkOf(id) : null; const can = canEdit('packaging'); if (id && !x) return;
  const vend = S.suppliers.filter(s => s.status !== 'inactive' || (x && x.supplierId === s.id)).sort((a, b) => String(a.name).localeCompare(String(b.name)));
  const supSel = x ? (x.supplierId && supOf(x.supplierId) ? x.supplierId : (x.supplierName ? '__other' : '')) : (preset && preset.supplierId) || '';
  const cats = pkCats(); const f0 = filtOf('pk', 'all');
  const cat0 = (x && x.category) || (preset && preset.category) || (cats.some(c => c.k === f0) ? f0 : (cats.find(c => c.k === 'polybag') || cats[0]).k);
  const v0 = x ? { ...x, supplierId: supSel, dimUnit: x.dimUnit || 'in', thickUnit: x.thickUnit || 'micron', stockUnit: x.stockUnit || pkCat(x.category).unit } : { category: cat0, name: pkCat(cat0).name, dimUnit: 'in', thickUnit: 'micron', rollUnit: 'm', capUnit: 'ml', stockUnit: pkCat(cat0).unit, ...(preset || {}), supplierId: supSel };
  // roll length and capacity show for categories that use them, and always when the item already has one
  const whenEx = (ex, has) => has ? undefined : 'category:' + (cats.filter(c => c.extra === ex).map(c => c.k).join('|') || '__none');
  const rollWhen = whenEx('roll', x && N(x.rollLen) > 0), capWhen = whenEx('capacity', x && N(x.capacity) > 0);
  const catOpts = [...cats.map(c => [c.k, c.l]), ...(x && pkCat(x.category).none ? [[x.category, 'Uncategorised — choose a category']] : [])];
  const fields = [
    { n: 'category', l: 'Category', t: 'select', req: 1, o: catOpts, ch: x ? '' : 'pkcat', help: canPackCats() ? 'Add or rename categories in the Categories tab.' : '' },
    { n: 'name', l: 'Material name', req: 1, ph: 'e.g. Poly bag, Box, Bottle, Cello tape', list: 'pkNames' },
    { raw: '<div class="subh full" style="margin:4px 0 0">Size</div>' },
    { n: 'l', l: 'Length', t: 'number', min: 0, step: 'any' }, { n: 'w', l: 'Width', t: 'number', min: 0, step: 'any' },
    { n: 'h', l: 'Height', t: 'number', min: 0, step: 'any', help: 'For boxes and bottles.' }, { n: 'dimUnit', l: 'Size in', t: 'select', o: PK_DIM },
    { n: 'thick', l: 'Thickness', t: 'number', min: 0, step: 'any', help: 'Where it applies: poly bags, bubble wrap, boxes (ply).' }, { n: 'thickUnit', l: 'Thickness in', t: 'select', o: PK_THICK },
    { n: 'rollLen', l: 'Roll length', t: 'number', min: 0, step: 'any', when: rollWhen }, { n: 'rollUnit', l: 'Roll length in', t: 'select', o: [['m', 'metres'], ['ft', 'feet']], when: rollWhen },
    { n: 'capacity', l: 'Capacity', t: 'number', min: 0, step: 'any', when: capWhen }, { n: 'capUnit', l: 'Capacity in', t: 'select', o: [['ml', 'ml'], ['l', 'litres'], ['g', 'grams']], when: capWhen },
    { raw: '<div class="subh full" style="margin:4px 0 0">Supplier and stock</div>' },
    { n: 'supplierId', l: 'Supplier', t: 'select', o: [...vend.map(s => [s.id, s.name]), ['__other', 'Another supplier (type the name)']], blank: 'Not set', full: 1, help: vend.length ? 'Pick one of your vendors (Inventory & purchasing › Vendors), or choose Another supplier and type the name.' : 'No vendors yet: choose Another supplier and type the name, or add vendors in Inventory & purchasing › Vendors.' },
    { n: 'supplierName', l: 'Supplier name', full: 1, when: 'supplierId:__other', ph: 'e.g. Sri Murugan Packaging, Erode' },
    { n: 'stock', l: 'Available stock (optional)', t: 'number', min: 0, step: 'any' }, { n: 'stockUnit', l: 'Counted in', t: 'select', o: PK_STOCKU },
    { n: 'note', l: 'Notes', t: 'textarea', rows: 2, full: 1, ph: 'Colour, print, material, which products it is for…' },
  ];
  const names = [...new Set([...cats.map(c => c.name).filter(Boolean), 'Corrugated box', 'Mailer box', 'Kraft box', 'Zip-lock bag', 'Courier bag', 'Bubble mailer', 'Jar', 'Tin', 'Brand sticker', 'Fragile sticker', 'Label', 'Tissue paper', 'Thank-you card', ...S.packaging.map(p => p.name).filter(Boolean)])];
  openDrawer({
    title: x ? pkTitle(x) : 'New packaging material', sub: x ? `${esc(pkCat(x.category).l)}${pkSupplier(x) ? ' · ' + esc(pkSupplier(x)) : ''}${pkStock(x) !== null ? ` · ${num(pkStock(x))} ${esc(x.stockUnit || 'pcs')} in stock` : ''}` : 'One entry for each size: Poly bag 6 × 8 in and Poly bag 8 × 10 in are two entries.', readOnly: !can, delKey: 'packaging/' + id,
    html: form(fields, v0) + `<datalist id="pkNames">${names.map(n => `<option value="${esc(n)}"></option>`).join('')}</datalist>`,
    footExtra: x && can ? btn('Add another size', 'pkcopy:' + x.id, { i: 'plus' }) : '',
    validate: v => {
      const e = []; const has = [v.l, v.w, v.h, v.rollLen, v.capacity].some(n => N(n) > 0);
      if (!has) e.push({ n: 'l', m: 'Enter the size: at least a length, width, height' + (pkCat(v.category).extra === 'capacity' ? ' or capacity' : pkCat(v.category).extra === 'roll' ? ' or roll length' : '') + '.' });
      if (pkCat(v.category).none && !(x && x.category === v.category)) e.push({ n: 'category', m: 'Choose a category.' });
      for (const k of ['l', 'w', 'h', 'thick', 'rollLen', 'capacity', 'stock']) if (v[k] !== null && v[k] !== '' && v[k] !== undefined && N(v[k]) < 0) e.push({ n: k, m: 'Can’t be negative.' });
      if (v.supplierId === '__other' && !String(v.supplierName || '').trim()) e.push({ n: 'supplierName', m: 'Type the supplier’s name, or choose one from the list.' });
      const k = pkKey(pkClean(v, x)); const dup = S.packaging.find(p => p.id !== id && pkKey(p) === k); if (dup) e.push({ n: 'name', m: `${pkTitle(dup)} is already saved. Open it to change it, or enter a different size.` });
      return e;
    },
    onSave: async v => { const d = pkClean(v, x); await saveDoc('packaging', id, { ...base(x), ...d }, ['packaging', `Packaging ${pkTitle(d)}`]); },
    onDelete: x ? delFn('packaging', id, 'packaging', `Packaging ${pkTitle(x)}`) : null,
  });
};
// what gets stored: numbers as numbers, units only where a value uses them, supplier as a vendor or a name.
// Roll length and capacity are kept when the category uses them or the item already had one (moving categories never loses data).
function pkClean(v, x) {
  const n = k => (v[k] === '' || v[k] === null || v[k] === undefined || !Number.isFinite(Number(v[k])) ? null : Number(v[k]));
  const c = pkCat(v.category); const roll = c.extra === 'roll' || !!(x && N(x.rollLen) > 0), bottle = c.extra === 'capacity' || !!(x && N(x.capacity) > 0);
  const d = { category: v.category || (pkCats()[0] || {}).k || 'other', name: String(v.name || '').trim(), l: n('l'), w: n('w'), h: n('h'), dimUnit: v.dimUnit || 'in', thick: n('thick'), rollLen: roll ? n('rollLen') : null, capacity: bottle ? n('capacity') : null, stock: n('stock'), note: String(v.note || '').trim() || null };
  // units are kept as chosen, even before a value is entered, so the form reopens the way it was left
  d.thickUnit = v.thickUnit || 'micron'; d.rollUnit = roll ? v.rollUnit || 'm' : null; d.capUnit = bottle ? v.capUnit || 'ml' : null; d.stockUnit = v.stockUnit || pkCat(d.category).unit || 'pcs';
  // the vendor's name is kept with the entry too, so it still shows if the vendor is ever removed
  if (v.supplierId === '__other') { d.supplierId = null; d.supplierName = String(v.supplierName || '').trim() || null; } else { d.supplierId = v.supplierId || null; d.supplierName = d.supplierId && supOf(d.supplierId) ? supOf(d.supplierId).name : null; }
  return d;
}
Object.assign(CH, {
  // a new entry follows its category: material name and stock unit
  pkcat(v) { const c = pkCat(v); const f = $('#drForm'); if (!f) return; const nm = f.querySelector('[name="name"]'); const known = pkCats().map(x => x.name); if (nm && (!nm.value || known.includes(nm.value)) && c.name) nm.value = c.name; const su = f.querySelector('[name="stockUnit"]'); if (su && c.unit) su.value = c.unit; },
});
Object.assign(ACT, {
  pkcopy(id) { const x = pkOf(id); if (!x) return; closeDrawer(); setTimeout(() => EDIT.packaging(null, { category: x.category, name: x.name, dimUnit: x.dimUnit || 'in', thick: x.thick, thickUnit: x.thickUnit || 'micron', rollUnit: x.rollUnit || 'm', capUnit: x.capUnit || 'ml', supplierId: x.supplierId && supOf(x.supplierId) ? x.supplierId : (x.supplierName ? '__other' : ''), supplierName: x.supplierName || '', stockUnit: x.stockUnit || pkCat(x.category).unit }), 240); },
  pkcatnew() { pkCatEdit(null); },
  pkcatedit(k) { pkCatEdit(k); },
  pkcatdel(k) { pkCatDel(k); },
  pkcatgo(k) { ui.filt.pk = k; ui.tab.pk = 'items'; schedule(); },
  bulkmovepk() {
    const items = selIds('packaging').map(id => pkOf(id)).filter(Boolean); if (!items.length) return; const cats = pkCats();
    openDrawer({
      title: `Move ${num(items.length)} item${items.length === 1 ? '' : 's'} to a category`, sub: 'Only the category changes. Stock, sizes, suppliers and notes stay as they are.',
      html: form([{ n: 'to', l: 'Category', t: 'select', req: 1, full: 1, o: cats.map(c => [c.k, c.l]), help: canPackCats() ? 'Need a new one? Add it in the Categories tab first.' : '' }], { to: items.every(x => x.category === items[0].category) && cats.some(c => c.k === items[0].category) ? items[0].category : cats[0].k })
        + `<div class="list bordered" style="margin-top:12px">${items.slice(0, 30).map(x => `<div class="li"><span class="sev info"></span><div class="grow"><b>${esc(pkTitle(x))}</b><small>${esc(pkCat(x.category).l)}</small></div></div>`).join('')}${items.length > 30 ? `<div class="li muted">…and ${num(items.length - 30)} more</div>` : ''}</div>`,
      saveLabel: 'Move', savedMsg: null,
      validate: v => pkMoveClash(items, v.to).slice(0, 6).map(m => ({ n: 'to', m: m + '. Leave that one out, or change it first.' })),
      onSave: async v => {
        const mv = items.filter(x => x.category !== v.to); if (mv.length) await pkMove(mv, v.to); selOf('packaging').clear();
        if (mv.length) addLog('update', 'packaging', `Moved ${mv.length} packaging item${mv.length === 1 ? '' : 's'} to ${pkCat(v.to).l}`, mv.slice(0, 12).map(pkTitle).join('; '));
        toast(mv.length ? `${mv.length} item${mv.length === 1 ? '' : 's'} moved to ${pkCat(v.to).l}.` : `Already in ${pkCat(v.to).l}.`);
      },
    });
  },
  bulkdelpack() { bulkDelete('packaging', selIds('packaging'), 'packaging', x => `Packaging ${pkTitle(x)}`, null, 'packaging'); },
  exportpack() { exportCSV('Packaging materials', [{ l: 'Category', csv: x => pkCat(x.category).l }, { l: 'Material', k: 'name' }, { l: 'Length', k: 'l' }, { l: 'Width', k: 'w' }, { l: 'Height', k: 'h' }, { l: 'Size unit', k: 'dimUnit' }, { l: 'Thickness', k: 'thick' }, { l: 'Thickness unit', csv: x => N(x.thick) > 0 ? x.thickUnit || 'micron' : '' }, { l: 'Roll length', k: 'rollLen' }, { l: 'Roll unit', csv: x => N(x.rollLen) > 0 ? x.rollUnit || 'm' : '' }, { l: 'Capacity', k: 'capacity' }, { l: 'Capacity unit', csv: x => N(x.capacity) > 0 ? x.capUnit || 'ml' : '' }, { l: 'Supplier', csv: pkSupplier }, { l: 'Available stock', k: 'stock' }, { l: 'Stock unit', csv: x => pkStock(x) === null ? '' : x.stockUnit || 'pcs' }, { l: 'Notes', k: 'note' }], S.packaging, 'packaging'); },
});
