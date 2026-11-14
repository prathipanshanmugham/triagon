/* =====================================================================
   Master stock: raw materials (leather in sq ft, paint and dye in ml / L / g / kg, thread in metres…) that many
   sellable products draw on. A product linked to a master holds no stock of its own: each unit sold deducts a fixed
   amount (50 ml, 100 g), a size (12 × 18 in = 1.5 sq ft) or the size the customer ordered from the master.
   The numbers come from shared/stock.js, the same engine the server uses.
   ===================================================================== */
const MAT_TYPES = [['Leather', 'sq ft'], ['Paint', 'ml'], ['Dye', 'ml'], ['Finish & sealant', 'ml'], ['Adhesive', 'ml'], ['Thread & lace', 'm'], ['Hardware', 'pc'], ['Packaging', 'pc'], ['Other', 'pc']];
const MOVE_EXTRA = [['link_in', 'Moved in from a linked product', 1, 0, 'in'], ['link_out', 'Moved to its master stock', -1, 0, 'out']];
MV.push(...MOVE_EXTRA);
const matLine = p => [p.matType, p.colour, p.grade, p.spec].filter(Boolean).join(' · ');
const matName = v => [v.matType, v.colour, v.grade, v.spec].filter(Boolean).join(' · ') || 'Master material';
const unitTxt = (n, u) => `${qty(n)} ${u}`;
// stock taken from one master in a date range: by sales and orders (net of good returns)
function masterUse(id, r) { let u = 0; for (const e of stockEngine().ev[id] || []) if ((e.k === 'sale' || e.k === 'order' || e.k === 'return') && (!r || inRange(e.d, r))) u -= e.q; return rq3(u); }
const DIMU = [['in', 'in'], ['cm', 'cm'], ['mm', 'mm'], ['ft', 'ft']];

/* ---------- Inventory › Master stock ---------- */
function invMasters(can) {
  const r = periodRange(); const E = stockEngine(); const costs = allow('costs'); const set = stockSet();
  const all = S.products.filter(p => isMaterial(p) && p.status !== 'archived' && (inBrand(p) || usersOf(p.id).some(inBrand)));
  const rows = all.map(p => { const st = stockState(p); const own = E.on[p.id] || 0, com = E.open[p.id] || 0; return { p, ...st, own, com, avail: rq3(own - com), used: masterUse(p.id, r), users: usersOf(p.id) }; });
  const c = k => rows.filter(x => x.st === k).length; const val = sum(rows, x => Math.max(0, x.own) * N(x.p.costPrice)); const usedV = sum(rows, x => Math.max(0, x.used) * N(x.p.costPrice));
  let html = kpis([
    { l: 'Master materials', v: num(rows.length), s: num(new Set(rows.map(x => x.p.matType || 'Other')).size) + ' types' },
    costs ? { l: 'Master stock at cost', v: inrS(val), title: inr(val) } : { l: 'Products linked', v: num(sum(rows, x => x.users.length)) },
    costs ? { l: 'Used this period', v: inrS(usedV), s: 'at cost, by sales and orders', title: inr(usedV) } : { l: 'Used this period', v: num(rows.filter(x => x.used > 0).length), s: 'materials used' },
    { l: 'Products linked', v: num(sum(rows, x => x.users.length)), s: 'SKUs drawing on masters' },
    { l: 'Low stock', v: num(c('low')), tone: c('low') ? 'warn' : '' },
    { l: 'Out of stock', v: num(c('out')), tone: c('out') ? 'neg' : '' },
  ]);
  const ledg = STOCK.LEDGER_STAGES.find(x => x[0] === set.ledgerStage)[1].toLowerCase(), ord = STOCK.ORDER_STAGES.find(x => x[0] === set.orderStage)[1].toLowerCase();
  html += `<div class="banner acc"><span>Marketplace and ledger sales take master stock <b>${esc(ledg)}</b>; sales orders <b>${esc(ord)}</b>. Before that they show as committed. Cancelled orders take nothing; good returns go back.</span>${canEdit('inventory') ? btn('Stock settings', 'stockset', { sm: true, i: 'box' }) : ''}</div>`;
  const types = MAT_TYPES.map(t => t[0]).filter(t => rows.some(x => (x.p.matType || 'Other') === t)); const f = filtOf('mtype', 'all');
  const shown = rows.filter(x => (f === 'all' || (f === 'low' ? x.st === 'low' || x.st === 'out' : (x.p.matType || 'Other') === f)) && matchQ('mat', x.p.name, x.p.sku, matLine(x.p), x.p.location, ...x.users.flatMap(u => [u.sku, u.name])));
  html += `<div class="toolbar">${searchHTML('mat', 'Search material, colour, grade, linked SKU…')}${chipsHTML('mtype', [['all', 'All', rows.length], ['low', 'Low or out', c('low') + c('out')], ...types.map(t => [t, t, rows.filter(x => (x.p.matType || 'Other') === t).length])], f)}<span class="sp"></span>${exportBtn('exportmasters', 'Export')}</div>`;
  html += panel('', table('masters', [
    { k: 'p', l: 'Master material', render: x => `<div class="cell-main mat-name">${prodTile(x.p)}<div><b>${esc(x.p.name)}</b><small>${esc([x.p.sku, x.p.colour, x.p.grade].filter(Boolean).join(' · '))}</small></div></div>`, sort: x => x.p.name },
    { k: 'on', l: 'On hand', num: 1, render: x => `<b class="${x.own <= 0 ? 'neg' : ''}">${qty(x.own)}</b> <small class="muted">${esc(unitOf(x.p))}</small>${isPU(x.p.purchaseFactor) && x.p.purchaseUnit ? `<br><small class="muted">≈ ${qty(x.own / N(x.p.purchaseFactor))} ${esc(x.p.purchaseUnit)}</small>` : ''}`, sort: x => x.own },
    { k: 'av', l: 'Available', num: 1, render: x => `<b class="${x.avail <= 0 ? 'neg' : ''}">${qty(x.avail)}</b>${x.com ? `<br><small class="muted">${qty(x.com)} committed</small>` : ''}`, sort: x => x.avail },
    { k: 'used', l: 'Used in period', num: 1, render: x => x.used ? `${qty(x.used)} <small class="muted">${esc(unitOf(x.p))}</small>` : '—', sort: x => x.used },
    { k: 'cover', l: 'Days left', num: 1, render: x => Number.isFinite(x.cover) ? num(x.cover) : '—', sort: x => Number.isFinite(x.cover) ? x.cover : 1e9 },
    { k: 'n', l: 'Linked', num: 1, render: x => x.users.length ? `<span title="${esc(x.users.slice(0, 12).map(u => u.sku + ' · ' + u.name).join('\n'))}">${num(x.users.length)} SKUs</span>` : '<span class="muted">none</span>', sort: x => x.users.length },
    { k: 'st', l: 'Status', render: x => `${pill(...STOCK_PILL[x.st])}<br><small class="muted">reorder at ${qty(x.rl)}</small>`, sort: x => ({ out: 0, low: 1, ok: 2, over: 3 })[x.st] },
    { k: 'a', l: '', nosort: 1, render: x => `<span class="mat-acts">${can && (x.st === 'low' || x.st === 'out') ? btn('Order', 'poprod:' + x.p.id, { sm: true, pri: true }) : ''}${can ? btn('Count', 'matcount:' + x.p.id, { sm: true }) : ''}${canEdit('catalogue') ? btn('Link', 'matlink:' + x.p.id, { sm: true }) : ''}</span>` },
  ], shown, { key: x => x.p.id, open: x => 'open:product:' + x.p.id, sort: { k: 'st', dir: 'asc' }, empty: empty('No master materials yet', 'Add leather, paint, dye or any raw material you stock in bulk, then link the products that use it. Each sale then deducts the right amount automatically.', canEdit('catalogue') ? btn('New master material', 'newmat', { pri: true, i: 'plus' }) : '') }), { flush: true });
  html += `<p class="muted" style="margin:0;font-size:12px;max-width:95ch">Leather sold by size uses (length × width × quantity) ÷ 144 sq ft for inches. Paint and dye packs use their pack size, converted between ml and L or g and kg. Click a master to see the products that use it and every deduction. Physical counts set the on-hand quantity without deducting earlier sales again.</p>`;
  return html;
}

/* ---------- product editor: stock source (for products) and linked products / usage (for masters) ---------- */
let LNK = [];
const matOpts = cur => S.products.filter(m => isMaterial(m) && (m.status !== 'archived' || m.id === cur)).sort((a, b) => (a.name > b.name ? 1 : -1));
function lnkRowHTML(x, i, can) {
  const dis = can ? '' : ' disabled'; const m = prodOf(x.id); const mu = m ? unitOf(m) : ''; const area = STOCK.famOf(mu) === 'area';
  const units = m ? STOCK.compat(mu) : [];
  return `<tr><td style="min-width:230px"><select class="inp" name="link.parts.${i}.id" data-t="str" data-ch="lnkmaster" aria-label="Master ${i + 1}"${dis}><option value="">Choose a master…</option>${matOpts(x.id).map(o => `<option value="${esc(o.id)}"${o.id === x.id ? ' selected' : ''}>${esc(o.name)} (${esc(unitOf(o))})</option>`).join('')}</select></td>
    <td style="min-width:160px"><div class="dimrow"><input class="inp tnum" type="number" step="any" min="0" name="link.parts.${i}.qty" data-t="num" data-in="lnkprev" value="${esc(x.qty ?? '')}" placeholder="${area ? 'or a size' : 'Amount'}" aria-label="Amount per unit"${dis}><select class="inp" name="link.parts.${i}.unit" data-t="str" data-ch="lnkprev" aria-label="Unit"${dis}>${units.map(u => `<option${(x.unit || mu) === u ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select></div></td>
    <td style="min-width:220px">${area ? `<div class="dimrow"><input class="inp tnum" type="number" step="any" min="0" name="link.parts.${i}.l" data-t="num" data-in="lnkprev" value="${esc(x.l ?? '')}" placeholder="L" aria-label="Length"${dis}><span>×</span><input class="inp tnum" type="number" step="any" min="0" name="link.parts.${i}.w" data-t="num" data-in="lnkprev" value="${esc(x.w ?? '')}" placeholder="W" aria-label="Width"${dis}><select class="inp" name="link.parts.${i}.dimUnit" data-t="str" data-ch="lnkprev" aria-label="Size unit"${dis}>${DIMU.map(([k]) => `<option${(x.dimUnit || 'in') === k ? ' selected' : ''}>${k}</option>`).join('')}</select></div>` : '<span class="muted">—</span>'}</td>
    <td>${area ? `<label class="chk"><input type="checkbox" name="link.parts.${i}.sized" data-t="check" data-ch="lnkprev"${x.sized ? ' checked' : ''}${dis}> Cut to the customer’s size</label>` : ''}</td>
    <td>${can ? `<button type="button" class="btn icon ghost sm" data-act="lnkrm:${i}" aria-label="Remove master">${icon('x')}</button>` : ''}</td></tr>`;
}
function lnkBoxHTML(can) { return `<div class="tw"><table class="t grid"><thead><tr><th>Master material</th><th>Uses per unit sold</th><th>Or a size (L × W)</th><th>Size</th><th></th></tr></thead><tbody>${LNK.map((x, i) => lnkRowHTML(x, i, can)).join('')}</tbody></table></div>`; }
function stockSourceHTML(p, can) {
  LNK = (p && p.link && Array.isArray(p.link.parts) ? p.link.parts : []).map(x => ({ ...x })); if (!LNK.length) LNK = [{ id: '', qty: null, unit: '' }];
  const own = p ? stockMap()[p.id] || 0 : 0; const linkedNow = p && isLinked(p);
  return `<p class="muted" style="margin:0 0 12px">Products cut, filled or packed from bulk stock — leather pieces, 50 ml paint bottles, 100 g dye packs — should take their stock from a master material. Each unit sold then deducts the right amount from the master, and the master’s low-stock alert covers all of them.</p>`
    + form([{ n: 'link.mode', l: 'Where its stock comes from', t: 'select', o: [['own', 'Its own stock, counted on this product'], ['master', 'A master material, deducted when this sells']], full: 1, when: 'kind:!material' }], { link: { mode: linkedNow ? 'master' : 'own' } })
    + `<div class="fld full" data-fld="link.parts" data-when="kind:!material;link.mode:master"><div id="lnkBox">${lnkBoxHTML(can)}</div>
      ${can ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 4px">${btn('Add another master (kit)', 'lnkadd', { sm: true, i: 'plus' })}${btn('Read the amount from the name', 'lnkguess', { sm: true })}</div>` : ''}
      <p class="help">For a fixed pack, enter the amount (50 ml, 100 g, 0.25 L). For a leather piece, enter its size, or tick “Cut to the customer’s size” to use the size on each order: (L × W × quantity) ÷ 144 sq ft for inches.</p>
      ${linkedNow ? `<p class="help">Linked ${esc(p.link.at ? fmtD(String(p.link.at).slice(0, 10)) : p.link.since ? 'from ' + fmtD(p.link.since) : '')}. Sales recorded since then use the master; earlier ones stayed on this product’s own stock.</p>` : `<p class="help">Sales recorded from now on use the master — including orders imported later for earlier days. Sales already recorded stay on this product’s own stock, so nothing is deducted twice.</p>`}
      ${own > 0 && !linkedNow ? `<div class="form">${fld({ n: 'link.moveOwn', l: '', t: 'check', cl: `Move its current stock (${fmtQ(own, p)}) into the master` }, true)}</div>` : ''}
      <div class="callout" id="lnkPrev"></div></div>`;
}
function syncLnk() { const f = $('#drForm'); if (!f) return; const { vals } = readForm(f); const raw = ((vals.link || {}).parts) || {}; LNK = LNK.map((x, i) => ({ ...x, ...(raw[i] || {}) })); }
function lnkPrev() {
  const box = $('#lnkPrev'); if (!box) return; syncLnk(); const f = $('#drForm'); const v = readForm(f).vals || {}; const u = v.unit || 'pc';
  const parts = STOCK.partsOf({ id: '_', link: { parts: LNK.filter(x => x.id) } }, stockEngine().P);
  if (!parts) { box.innerHTML = '<span class="muted">Pick a master and enter how much one unit uses.</span>'; return; }
  const R = stockEngine(); const n = STOCK.canMake({ id: '_', unit: u, link: { parts: LNK.filter(x => x.id) } }, R);
  box.innerHTML = `<b>Each ${esc(u)} sold uses</b><span>${parts.map(x => { const m = prodOf(x.id); return `${esc(qty(x.per))} ${esc(unitOf(m))} of ${esc(m.name)}${x.sized ? ' (or the size ordered)' : ''}`; }).join(' + ')}. The master stock on hand covers <b class="tnum">${num(n)}</b> ${esc(u)}.</span>`;
}
function lnkRedraw() { const el = $('#lnkBox'); if (el) el.innerHTML = lnkBoxHTML(!DRW.cfg.readOnly); lnkPrev(); }
// what the product editor saves for link fields
function lnkFromForm(v, p) {
  if (v.kind === 'material' || !v.link || v.link.mode !== 'master') return { link: null, moves: [] };
  syncLnk(); const parts = LNK.filter(x => x.id).map(x => clean({ id: x.id, qty: N(x.qty) || null, unit: x.unit || unitOf(prodOf(x.id)), l: N(x.l) || null, w: N(x.w) || null, dimUnit: N(x.l) && N(x.w) ? x.dimUnit || 'in' : null, sized: !!x.sized || null }));
  if (!parts.length) return { link: null, moves: [] };
  const prevL = p && isLinked(p) ? p.link : null; const link = clean({ at: prevL ? prevL.at || null : nowISO(), since: prevL && !prevL.at ? prevL.since || null : null, parts }); const since = TODAY();
  const moves = []; const own = p ? stockMap()[p.id] || 0 : 0;
  if (p && !isLinked(p) && own > 0 && v.link.moveOwn) {
    const got = STOCK.partsOf({ id: p.id, link }, stockEngine().P) || [];
    moves.push({ op: 'set', path: 'moves/' + newId('moves'), data: clean({ productId: p.id, brandId: p.brandId, type: 'link_out', qty: -rq3(own), date: since, note: 'Moved into master stock when linked', ...stampOf(null) }) });
    for (const x of got) { const m = prodOf(x.id); moves.push({ op: 'set', path: 'moves/' + newId('moves'), data: clean({ productId: m.id, brandId: m.brandId, type: 'link_in', qty: rq3(own * x.per), date: since, unitCost: N(p.costPrice) && x.per ? Math.round(N(p.costPrice) / x.per * 100) / 100 : null, note: `From ${p.sku} (${qty(own)} ${unitOf(p)}) when it was linked`, ...stampOf(null) }) }); }
  }
  return { link, moves };
}
function lnkErrs(v, id) {
  const e = []; if (v.kind === 'material') return e;
  if (!v.link || v.link.mode !== 'master') return e; syncLnk(); const parts = LNK.filter(x => x.id);
  if (!parts.length) e.push({ n: 'link.parts', m: 'Pick the master material this product uses, or choose “Its own stock”.' });
  parts.forEach(x => { const m = prodOf(x.id); if (!m) return; if (x.id === id) e.push({ n: 'link.parts', m: 'A product can’t take stock from itself.' }); const ok = (N(x.l) > 0 && N(x.w) > 0) || N(x.qty) > 0 || x.sized; if (!ok) e.push({ n: 'link.parts', m: `Enter how much of ${m.name} one unit uses (an amount or a size).` }); if (N(x.qty) > 0 && STOCK.conv(x.qty, x.unit || unitOf(m), unitOf(m)) === null) e.push({ n: 'link.parts', m: `${x.unit} can’t be converted to ${unitOf(m)}.` }); });
  if (id && usersOf(id).length) e.push({ n: 'link.mode', m: `${usersOf(id).length} products take their stock from this one, so it can’t take stock from a master itself. Make it a master material instead.` });
  return e;
}
function masterTabs(p) {
  const users = usersOf(p.id); const R = stockEngine(); const r = periodRange(); const u = unitOf(p); const can = canEdit('catalogue');
  const usersHTML = `<p class="muted" style="margin:0 0 10px">These products take their stock from ${esc(p.name)}. Each unit sold deducts the amount shown.</p>`
    + (users.length ? `<div class="tw"><table class="t"><thead><tr><th>Product</th><th>Uses per unit</th><th class="num">Can make now</th><th class="num">Sold, 30 days</th><th class="num">Used in period</th></tr></thead><tbody>${users.map(x => { const part = x.link.parts.find(y => y.id === p.id); const used = rq3(-sum((R.ev[p.id] || []).filter(e => e.pid === x.id && ['sale', 'order', 'return'].includes(e.k) && inRange(e.d, r)), e => e.q)); return `<tr data-act="open:product:${esc(x.id)}" class="click"><td>${prodCell(x)}</td><td>${esc(STOCK.partText(part, p))}</td><td class="num tnum">${num(availOf(x))} <small class="muted">${esc(unitOf(x))}</small></td><td class="num tnum">${qty(sold30()[x.id] || 0)}</td><td class="num tnum">${used ? unitTxt(used, u) : '—'}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">No products are linked yet.</p>')
    + (can ? `<div style="margin-top:10px">${btn('Link products', 'matlink:' + p.id, { sm: true, i: 'plus' })}</div>` : '');
  const ev = (R.ev[p.id] || []).filter(e => inRange(e.d, r) && e.k !== 'opening').sort((a, b) => a.d < b.d ? 1 : -1).slice(0, 200);
  const st = stockState(p); const base = R.base[p.id];
  const useHTML = kvHTML([['On hand', `<b>${unitTxt(R.on[p.id] || 0, u)}</b>`], ['Committed to open orders', unitTxt(R.open[p.id] || 0, u)], ['Available', unitTxt(rq3((R.on[p.id] || 0) - (R.open[p.id] || 0)), u)], ['Used this period', unitTxt(masterUse(p.id, r), u)], ['Used, last 30 days', unitTxt(R.use30[p.id] || 0, u)], ['Days left at that rate', Number.isFinite(st.cover) ? num(st.cover) : '—'], ['Last physical count', base ? `${unitTxt(base.setTo, u)} on ${fmtD(base.date)} (${base.countAt === 'start' ? 'start' : 'end'} of day)` : 'None yet']])
    + `<div class="subh">Every change this period</div>` + (ev.length ? `<div class="tw"><table class="t"><thead><tr><th>Date</th><th>What</th><th>For</th><th class="num">Change</th></tr></thead><tbody>${ev.map(e => { const s = e.src || {}; const sold = prodOf(e.pid); const what = e.k === 'move' ? mvLabel(s) : e.k === 'count' ? `Physical count → ${unitTxt(s.setTo, u)}` : e.k === 'order' ? `Order ${s.number || ''}` : e.k === 'return' ? 'Return, restocked' : e.k === 'bad' ? 'Return, damaged' : s.orderId ? `Order ${s.orderRef || ''}` : `Sale · ${PL(s.platform).name}${s.orderRef ? ' · ' + s.orderRef : ''}`; return `<tr><td class="tnum">${esc(fmtD(e.d))}</td><td>${esc(what)}${e.counted ? ' <small class="muted">· before the count</small>' : ''}</td><td>${sold && sold.id !== p.id ? `${esc(sold.sku || '')} · ${esc(sold.name)}${s.l && s.w ? ` <small class="muted">${qty(s.l)} × ${qty(s.w)} ${esc(s.dimUnit || 'in')}${N(s.qty) > 1 ? ' × ' + qty(s.qty) : ''}</small>` : ''}` : 'Sold as is'}</td><td class="num tnum ${e.k === 'bad' ? 'neg' : e.q < 0 ? 'neg' : e.q > 0 ? 'pos' : ''}">${e.k === 'bad' ? `${qty(e.b)} damaged` : e.k === 'count' ? '—' : (e.q > 0 ? '+' : '') + qty(e.q)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">Nothing in this period.</p>');
  return [{ l: `Linked products (${users.length})`, html: usersHTML }, { l: 'Usage', html: useHTML }];
}

/* ---------- link many products to one master at once ---------- */
function matLink(mid) {
  const m = prodOf(mid); if (!m) return; if (!canEdit('catalogue')) { toast('Linking products needs edit access to the Catalogue.', 'bad'); return; }
  const mu = unitOf(m); const area = STOCK.famOf(mu) === 'area';
  const cands = S.products.filter(p => !isMaterial(p) && p.status !== 'archived' && p.id !== mid && inBrand(p));
  const rows = cands.map(p => {
    const cur = isLinked(p) ? p.link.parts.find(x => x.id === mid) : null; const other = isLinked(p) && !cur;
    const g = cur ? null : STOCK.guess([p.name, p.variant, ...Object.values(p.listings || {}).map(l => l && l.title)].filter(Boolean).join(' '), mu);
    const txt = [p.name, p.variant, p.category].filter(Boolean).join(' '); const word = w => new RegExp(String(w).split(/\W/)[0].replace(/[^\w]/g, ''), 'i');
    const sameType = !!m.matType && word(m.matType).test(txt) && (!m.colour || word(m.colour).test(txt));
    return { p, cur, other, g, rank: cur ? 0 : g && sameType && !other ? 1 : g ? 2 : sameType ? 3 : 4 };
  }).sort((a, b) => a.rank - b.rank || (a.p.name > b.p.name ? 1 : -1));
  const row = x => { const v = x.cur || (x.g ? { qty: x.g.l ? null : x.g.qty, unit: x.g.unit, l: x.g.l, w: x.g.w, dimUnit: x.g.dimUnit } : {}); const id = x.p.id;
    return `<tr${x.rank === 1 ? ' data-sug="1"' : ''} data-lnk="${esc([x.p.name, x.p.sku, x.p.variant, ...Object.values(x.p.listings || {}).flatMap(l => l ? [l.sku, l.id] : [])].filter(Boolean).join(' ').toLowerCase())}"><td><label class="chk"><input type="checkbox" name="pick.${esc(id)}" data-t="check"${x.cur ? ' checked' : ''}> </label></td><td>${prodCell(x.p)}${x.other ? `<small class="muted">now uses ${esc(mastersOf(x.p).map(y => y.m.name).join(', '))}; ticking adds this master as well (a kit)</small>` : ''}${x.g && !x.cur ? `<small class="pos">amount read from the name${x.rank === 1 ? ' · suggested' : ''}</small>` : ''}</td>
      <td><div class="dimrow"><input class="inp tnum" type="number" step="any" min="0" name="amt.${esc(id)}" data-t="num" value="${esc(v.qty ?? '')}" aria-label="Amount"><select class="inp" name="unit.${esc(id)}" data-t="str" aria-label="Unit">${STOCK.compat(mu).map(u => `<option${(v.unit || mu) === u ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select></div></td>
      ${area ? `<td><div class="dimrow"><input class="inp tnum" type="number" step="any" min="0" name="l.${esc(id)}" data-t="num" value="${esc(v.l ?? '')}" placeholder="L" aria-label="Length"><span>×</span><input class="inp tnum" type="number" step="any" min="0" name="w.${esc(id)}" data-t="num" value="${esc(v.w ?? '')}" placeholder="W" aria-label="Width"><select class="inp" name="du.${esc(id)}" data-t="str" aria-label="Size unit">${DIMU.map(([k]) => `<option${(v.dimUnit || 'in') === k ? ' selected' : ''}>${k}</option>`).join('')}</select></div></td><td><label class="chk"><input type="checkbox" name="sz.${esc(id)}" data-t="check"${v.sized ? ' checked' : ''}> Customer’s size</label></td>` : ''}</tr>`; };
  openDrawer({
    title: `Link products to ${m.name}`, sub: `Tick the products that use this master and how much one unit takes, in ${mu}${area ? ' or as a size' : ''}. Amounts already read from product names are filled in for you.`, wide: true, saveLabel: 'Save links', noFocus: true,
    html: `<div class="toolbar" style="margin:0 0 10px"><input class="inp" id="lnkQ" data-in="lnkfilter" placeholder="Filter by name, SKU, channel SKU or ASIN" aria-label="Filter products" style="max-width:360px"><span class="sp"></span>${rows.some(x => x.rank === 1) ? btn(`Tick the ${rows.filter(x => x.rank === 1).length} suggested`, 'lnkpickall', { sm: true }) : ''}</div>
      <div class="tw"><table class="t grid keep" id="lnkTable"><thead><tr><th></th><th>Product</th><th>Uses per unit</th>${area ? '<th>Or a size</th><th></th>' : ''}</tr></thead><tbody>${rows.map(row).join('') || `<tr><td colspan="5" class="muted">No products to link yet.</td></tr>`}</tbody></table></div>
      <div class="form" style="margin-top:12px">${fld({ n: 'moveOwn', l: '', t: 'check', cl: 'Move any stock the newly linked products still hold into this master' }, true)}</div><p class="help">Sales recorded from now on use the master, including orders imported later for earlier days. Sales already recorded stay on each product’s own stock.</p>`,
    validate: v => { const e = []; for (const x of rows) { if (!getPath(v, 'pick.' + x.p.id)) continue; const ok = N(getPath(v, 'amt.' + x.p.id)) > 0 || (N(getPath(v, 'l.' + x.p.id)) > 0 && N(getPath(v, 'w.' + x.p.id)) > 0) || getPath(v, 'sz.' + x.p.id); if (!ok) e.push({ n: 'moveOwn', m: `${x.p.sku || x.p.name}: enter how much of ${m.name} one unit uses.` }); if (usersOf(x.p.id).length) e.push({ n: 'moveOwn', m: `${x.p.sku || x.p.name} is itself a master for other products.` }); } return e.slice(0, 3); },
    onSave: async v => {
      const ops = []; let added = 0, changed = 0, removed = 0; const E = stockEngine();
      for (const x of rows) {
        const id = x.p.id; const pick = !!getPath(v, 'pick.' + id); const parts = isLinked(x.p) ? x.p.link.parts.filter(y => y.id !== mid) : [];
        if (!pick && !x.cur) continue;
        if (!pick) { removed++; ops.push({ op: 'set', path: 'products/' + id, data: clean({ ...base(x.p), link: parts.length ? { ...x.p.link, parts } : null, ...stampOf(x.p) }) }); continue; }
        const l = N(getPath(v, 'l.' + id)), w = N(getPath(v, 'w.' + id)); const part = clean({ id: mid, qty: N(getPath(v, 'amt.' + id)) || null, unit: getPath(v, 'unit.' + id) || mu, l: l && w ? l : null, w: l && w ? w : null, dimUnit: l && w ? getPath(v, 'du.' + id) || 'in' : null, sized: !!getPath(v, 'sz.' + id) || null });
        const pl = isLinked(x.p) ? x.p.link : null; const link = clean({ at: pl ? pl.at || null : nowISO(), since: pl && !pl.at ? pl.since || null : null, parts: [...parts, part] });
        if (x.cur && JSON.stringify(clean(x.cur)) === JSON.stringify(part)) continue; x.cur ? changed++ : added++;
        ops.push({ op: 'set', path: 'products/' + id, data: clean({ ...base(x.p), link, ...stampOf(x.p) }) });
        const own = E.on[id] || 0;
        if (!isLinked(x.p) && own > 0 && v.moveOwn) {
          const per = (STOCK.partsOf({ id, link: { parts: [part] } }, E.P) || [])[0]; if (per) {
            ops.push({ op: 'set', path: 'moves/' + newId('moves'), data: clean({ productId: id, brandId: x.p.brandId, type: 'link_out', qty: -rq3(own), date: TODAY(), note: 'Moved into master stock when linked', ...stampOf(null) }) });
            ops.push({ op: 'set', path: 'moves/' + newId('moves'), data: clean({ productId: mid, brandId: m.brandId, type: 'link_in', qty: rq3(own * per.per), date: TODAY(), note: `From ${x.p.sku} (${qty(own)} ${unitOf(x.p)}) when it was linked`, ...stampOf(null) }) });
          }
        }
      }
      if (!ops.length) { toast('Nothing changed.'); return; }
      await batchAll(ops); addLog('update', 'catalogue', `Linked products to master ${m.name}`, `${added} linked, ${changed} changed, ${removed} unlinked`);
      toast(`${added} linked${changed ? `, ${changed} changed` : ''}${removed ? `, ${removed} unlinked` : ''}. Their sales now deduct from ${m.name}.`);
    },
    savedMsg: null,
  });
}

/* ---------- actions ---------- */
Object.assign(ACT, {
  newmat() { EDIT.product(null, { kind: 'material', matType: 'Leather', unit: 'sq ft', sellingPrice: null, reorderLevel: 50, status: 'active', category: 'Raw material' }); },
  matlink(id) { const was = !!DRW.cfg; if (was) closeDrawer(); setTimeout(() => matLink(id), was ? 240 : 0); },
  matcount(id) { EDIT.move(null, { productId: id, type: 'count', countAt: 'end' }); },
  lnkadd() { syncLnk(); LNK.push({ id: '', qty: null, unit: '' }); lnkRedraw(); },
  lnkrm(i) { syncLnk(); LNK.splice(+i, 1); if (!LNK.length) LNK.push({ id: '', qty: null, unit: '' }); lnkRedraw(); },
  lnkguess() { syncLnk(); const v = readForm($('#drForm')).vals || {}; let n = 0; LNK = LNK.map(x => { const m = prodOf(x.id); if (!m) return x; const g = STOCK.guess([v.name, v.variant, v.title].filter(Boolean).join(' '), unitOf(m)); if (!g) return x; n++; return { ...x, qty: g.l ? null : g.qty, unit: g.unit, l: g.l || null, w: g.w || null, dimUnit: g.dimUnit || x.dimUnit }; }); lnkRedraw(); toast(n ? 'Amount read from the product name. Check it before saving.' : 'No size or amount found in the name. Enter it by hand.', n ? '' : 'bad'); },
  lnkpickall() { $$('#lnkTable tbody tr[data-sug]').forEach(tr => { if (tr.hidden) return; const c = tr.querySelector('input[type=checkbox][name^="pick."]'); if (c) c.checked = true; }); },
  stockset() {
    const can = canEdit('inventory'); const set = stockSet();
    openDrawer({
      title: 'Stock settings', sub: 'When orders take stock. Until then they show as committed, so the stock you can promise is always clear.', readOnly: !can,
      html: form([
        { n: 'ledgerStage', l: 'Marketplace and ledger sales take stock', t: 'select', o: STOCK.LEDGER_STAGES, full: 1, help: 'Imported Amazon / Flipkart orders and sales entries. “When it ships” suits most sellers: unshipped orders are committed, shipped ones deducted.' },
        { n: 'orderStage', l: 'Sales orders take stock', t: 'select', o: STOCK.ORDER_STAGES, full: 1, help: 'Your own orders (custom sizes, wholesale). Choose “When cutting starts” if leather is cut as soon as the order goes to production.' },
        { raw: '<p class="help" style="margin:0">Changing this re-works stock from your records straight away. Orders are never deducted twice: each counts once, by the state it is in now. Cancelled orders take nothing; good returns go back to stock.</p>' },
      ], set),
      onSave: async v => { await dbWrite('set', 'settings/stock', clean({ ...(S.settings.stock || {}), ledgerStage: v.ledgerStage, orderStage: v.orderStage, updatedAt: nowISO(), updatedBy: ME.id })); addLog('settings', 'inventory', 'Stock deduction stages updated', `Sales: ${v.ledgerStage} · orders: ${v.orderStage}`); },
      savedMsg: 'Stock settings saved.',
    });
  },
  exportmasters() {
    const r = periodRange(); const E = stockEngine();
    exportCSV('Master stock', [{ l: 'SKU', k: 'sku' }, { l: 'Master material', k: 'name' }, { l: 'Type', k: 'matType' }, { l: 'Colour', k: 'colour' }, { l: 'Grade', k: 'grade' }, { l: 'Specification', k: 'spec' }, { l: 'Unit', csv: p => unitOf(p) }, { l: 'On hand', csv: p => rq3(E.on[p.id] || 0) }, { l: 'Committed', csv: p => rq3(E.open[p.id] || 0) }, { l: 'Available', csv: p => rq3((E.on[p.id] || 0) - (E.open[p.id] || 0)) }, { l: 'Used in period', csv: p => masterUse(p.id, r) }, { l: 'Used, 30 days', csv: p => E.use30[p.id] || 0 }, { l: 'Reorder level', csv: p => N(p.reorderLevel ?? 10) }, { l: 'Linked SKUs', csv: p => usersOf(p.id).map(x => x.sku).join(' ') }, ...(allow('costs') ? [{ l: 'Value at cost', csv: p => (Math.max(0, E.on[p.id] || 0) * N(p.costPrice)).toFixed(2) }] : [])], S.products.filter(p => isMaterial(p) && p.status !== 'archived'), 'inventory');
  },
});
// a product that uses a master is reordered through its master
{ const po0 = ACT.poprod; ACT.poprod = pid => { const p = prodOf(pid); if (p && isLinked(p) && mastersOf(p).length) return po0(mastersOf(p)[0].id); return po0(pid); }; }
Object.assign(CH, {
  lnkmaster() { syncLnk(); LNK = LNK.map(x => { const m = prodOf(x.id); return m && !STOCK.compat(unitOf(m)).includes(x.unit) ? { ...x, unit: unitOf(m) } : x; }); lnkRedraw(); },
  lnkprev() { lnkPrev(); },
  mattype(v) { const t = MAT_TYPES.find(x => x[0] === v); const u = $('#drForm [name="unit"]'); if (t && u) { u.value = t[1]; u.dispatchEvent(new Event('change', { bubbles: true })); } },
});
Object.assign(IN, {
  lnkprev() { lnkPrev(); },
  lnkfilter(v) { const q = String(v || '').toLowerCase().trim(); $$('#lnkTable tbody tr[data-lnk]').forEach(tr => { tr.hidden = !!q && !tr.dataset.lnk.includes(q); }); },
});
