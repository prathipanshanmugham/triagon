/* =====================================================================
   Growth: sales offers tracked against sales, and ratings per listing
   ===================================================================== */
const OFFER_KINDS = [['deal', 'Deal / lightning deal'], ['coupon', 'Coupon'], ['discount', 'Price discount'], ['bundle', 'Bundle / combo'], ['bogo', 'Buy X get Y'], ['freeship', 'Free shipping'], ['other', 'Other']];
const offerState = o => o.cancelled ? 'cancelled' : (o.start || '') > TODAY() ? 'upcoming' : (o.end || '9999') < TODAY() ? 'ended' : 'live';
const OF_TONE = { upcoming: 't-info', live: 't-good', ended: 't-neu', cancelled: 't-neu' };
const offerPrice = (o, p) => { const base0 = chanPrice(p, o.platform); return o.discType === 'price' ? N(o.value) : o.discType === 'flat' ? Math.max(0, base0 - N(o.value)) : base0 * (1 - N(o.value) / 100); };
// sales of the offer's products on its platform inside the window, against the same number of days just before it
function offerStats(o) {
  return memo('offer:' + o.id + ':' + (o.updatedAt || ''), () => {
    const ids = new Set(o.productIds || []); const a = o.start || TODAY(); const b = (o.end && o.end < TODAY() ? o.end : TODAY()); const days = Math.max(1, daysBetween(a, b) + 1);
    const m = s => ids.has(s.productId) && (!o.platform || o.platform === 'all' || s.platform === o.platform) && s.status !== 'cancelled';
    const cur = S.sales.filter(s => m(s) && inRange(s.date, [a, b])); const pre = S.sales.filter(s => m(s) && inRange(s.date, [addDays(a, -days), addDays(a, -1)]));
    const fc = finSum(cur), fp = finSum(pre); const live = offerState(o) !== 'upcoming';
    return { days, units: fc.units, rev: fc.gross - fc.returns, profit: fc.profit - N(o.fee), preUnits: fp.units, preRev: fp.gross - fp.returns, preProfit: fp.profit, upl: live ? deltaOf(fc.units / days, fp.units / days) : undefined, avg: ratio(fc.gross, fc.units + fc.retUnits), orders: cur.length };
  });
}
{
  const mk0 = V.marketing;
  V.marketing = () => {
    if (tabOf('mkt', 'camps') !== 'offers') { return mk0().replace(/(data-act="tab:mkt:chan">[^<]*<\/button>)/, `$1<button class="tab" role="tab" aria-selected="false" data-act="tab:mkt:offers">Offers <span class="muted">${S.offers.filter(o => offerState(o) === 'live').length || ''}</span></button>`); }
    const can = canEdit('marketing'); const all = S.offers.filter(o => brandAll() || (o.productIds || []).some(id => inBrand({ productId: id })));
    let html = ph('Marketing & offers', 'Deals, coupons and discounts per platform and product, with the sales they brought in compared with the same number of days before.', can ? btn('Add offer', 'new:offer', { pri: true, i: 'plus' }) : '');
    const live = all.filter(o => offerState(o) === 'live'); const st = all.map(o => ({ o, ...offerStats(o) }));
    html += kpis([{ l: 'Live offers', v: num(live.length), s: num(all.filter(o => offerState(o) === 'upcoming').length) + ' upcoming' }, { l: 'Units on offer', v: num(sum(st.filter(x => offerState(x.o) === 'live'), x => x.units)), s: 'live offers, so far' }, { l: 'Offer revenue', v: inrS(sum(st, x => x.rev)), title: inr(sum(st, x => x.rev)), s: 'all offers' }, { l: 'Deal fees', v: inrS(sum(all, o => o.fee)), s: 'paid to platforms' }], 'k4');
    html += tabsHTML('mkt', [['camps', 'Campaigns'], ['chan', 'By channel'], ['offers', 'Offers', live.length || '']], 'offers');
    const f = filtOf('off', 'active'); const rows = st.filter(x => (f === 'all' || (f === 'active' ? ['live', 'upcoming'].includes(offerState(x.o)) : offerState(x.o) === f)) && matchQ('off', x.o.name, x.o.code, ...(x.o.productIds || []).map(id => (prodOf(id) || {}).sku)));
    html += `<div class="toolbar">${searchHTML('off', 'Search offer, coupon code, SKU…')}${chipsHTML('off', [['active', 'Live & upcoming'], ['ended', 'Ended'], ['cancelled', 'Cancelled'], ['all', 'All', all.length]], f)}</div>`;
    html += panel('', table('offers', [
      { k: 'name', l: 'Offer', render: x => `<b>${esc(x.o.name)}</b>${delPill('offers', x.o.id)}<br><small class="muted">${esc((OFFER_KINDS.find(k => k[0] === x.o.kind) || [, x.o.kind || ''])[1])}${x.o.code ? ' · code ' + esc(x.o.code) : ''}</small>`, sort: x => x.o.name },
      { k: 'pl', l: 'Platform', render: x => x.o.platform && x.o.platform !== 'all' ? platPill(x.o.platform) : 'All platforms', sort: x => x.o.platform || '' },
      { k: 'disc', l: 'Discount', render: x => x.o.discType === 'price' ? 'at ' + inr(x.o.value) : x.o.discType === 'flat' ? inr(x.o.value) + ' off' : N(x.o.value) + '% off', sort: x => N(x.o.value) },
      { k: 'items', l: 'Products', render: x => { const ps = (x.o.productIds || []).map(prodOf).filter(Boolean); return ps.slice(0, 2).map(p => `<span class="mono">${esc(p.sku)}</span>`).join(', ') + (ps.length > 2 ? ` +${ps.length - 2}` : '') || '—'; }, sort: x => (x.o.productIds || []).length },
      { k: 'dates', l: 'Dates', render: x => `<span class="tnum">${esc(fmtDs(x.o.start))} – ${esc(fmtDs(x.o.end))}</span><br><small class="muted">${num(x.days)} days</small>`, sort: x => x.o.start || '' },
      { k: 'units', l: 'Units sold', num: 1, render: x => `${qty(x.units)}<br><small class="muted">before ${qty(x.preUnits)}</small>` },
      { k: 'upl', l: 'Uplift / day', num: 1, render: x => x.upl === undefined ? '—' : deltaHTML(x.upl), sort: x => x.upl === undefined ? -9 : Number.isFinite(x.upl) ? x.upl : 99 },
      { k: 'rev', l: 'Revenue', num: 1, render: x => inr(x.rev), sort: x => x.rev },
      { k: 'profit', l: 'Profit after fee', num: 1, cost: 1, render: x => `<span class="${x.profit < 0 ? 'neg' : ''}">${inr(x.profit)}</span><br><small class="muted">before ${inr(x.preProfit)}</small>`, sort: x => x.profit },
      { k: 'st', l: 'Status', render: x => pill(({ upcoming: 'Upcoming', live: 'Live', ended: 'Ended', cancelled: 'Cancelled' })[offerState(x.o)], OF_TONE[offerState(x.o)]), sort: x => offerState(x.o) },
    ], rows, { sort: { k: 'dates', dir: 'desc' }, open: x => 'open:offer:' + x.o.id, empty: empty('No offers here', 'Add each deal, coupon or discount with its products, platform and dates. Sales in the window are compared with the days just before it.', can ? btn('Add offer', 'new:offer', { pri: true }) : '') }), { flush: true });
    return html + `<p class="muted" style="margin:0;font-size:12px;max-width:90ch">Uplift compares units sold per day during the offer with the same number of days just before it started, for the same products on the same platform. Seasonality and other campaigns also move sales, so read it as a guide.</p>`;
  };
}
EDIT.offer = id => {
  const o = id ? S.offers.find(x => x.id === id) : null; const can = canEdit('marketing');
  const v0 = o || { kind: 'deal', discType: 'pct', value: 10, start: TODAY(), end: addDays(TODAY(), 6), platform: (activePlatforms()[0] || {}).key, productIds: [] };
  const f = [
    { n: 'name', l: 'Offer name', req: 1, full: 1, ph: 'e.g. Diwali lightning deal, leather sheets' },
    { n: 'platform', l: 'Platform', t: 'select', o: () => [['all', 'All platforms'], ...platOpts(v0.platform)] }, { n: 'kind', l: 'Type', t: 'select', o: OFFER_KINDS },
    { n: 'discType', l: 'Discount as', t: 'select', o: [['pct', 'Percent off'], ['flat', '₹ off per unit'], ['price', 'Offer price']] }, { n: 'value', l: 'Discount value', t: 'number', min: 0, step: 'any' },
    { n: 'start', l: 'Starts', t: 'date', req: 1 }, { n: 'end', l: 'Ends', t: 'date', req: 1 },
    { n: 'fee', l: 'Deal fee paid to the platform', t: 'money', min: 0 }, { n: 'code', l: 'Coupon code', mono: 1 },
    { n: 'productIds', l: 'Products in the offer', t: 'multi', full: 1, o: () => S.products.filter(p => (inBrand(p) && p.status !== 'archived') || (v0.productIds || []).includes(p.id)).sort((a, b) => a.name > b.name ? 1 : -1).map(p => [p.id, `${p.sku} · ${p.name}${p.status === 'archived' ? ' (archived)' : ''}`]), none: 'No products yet' },
    { n: 'cancelled', l: '', t: 'check', cl: 'Cancelled', full: 1 }, { n: 'notes', l: 'Notes', t: 'textarea', rows: 2, full: 1 },
  ];
  const st = o ? offerStats(o) : null;
  const preview = o ? `<div class="subh">Price check</div><div class="tw"><table class="t"><thead><tr><th>Product</th><th class="num">Normal price</th><th class="num">Offer price</th>${allow('costs') ? '<th class="num">Profit / unit at offer</th>' : ''}</tr></thead><tbody>${(o.productIds || []).map(prodOf).filter(Boolean).map(p => { const pl = PL(o.platform && o.platform !== 'all' ? o.platform : 'direct'); const op = offerPrice(o, p); const e = unitEcon({ price: op, gst: p.gstRate ?? 18, cost: p.costPrice, pack: p.packagingCost, weight: p.weight, plat: effPlat(pl, p) }); return `<tr><td>${esc(p.sku)} · ${esc(p.name)}</td><td class="num">${inr(chanPrice(p, pl.key), 2)}</td><td class="num"><b>${inr(op, 2)}</b></td>${allow('costs') ? `<td class="num ${e.profit < 0 ? 'neg' : ''}">${inr(e.profit, 2)} · ${pct(e.margin, 0)}</td>` : ''}</tr>`; }).join('')}</tbody></table></div>` : '';
  openDrawer({
    title: o ? o.name : 'New offer', sub: o ? `${esc(o.platform === 'all' ? 'All platforms' : PL(o.platform).name)} · ${esc(fmtDs(o.start))} – ${esc(fmtDs(o.end))}` : 'Sales of these products in the window are tracked automatically.', readOnly: !can, delKey: 'offers/' + id, wide: true,
    top: st ? kvHTML([['Units sold', `${qty(st.units)} <small class="muted">vs ${qty(st.preUnits)} before</small>`], ['Uplift / day', st.upl === undefined ? '—' : deltaHTML(st.upl) || '0%'], ['Revenue', inr(st.rev)], allow('costs') ? ['Profit after fee', inr(st.profit)] : ['Orders', num(st.orders)]]) : '',
    html: form(f, v0) + preview,
    validate: v => { const e = []; if (v.end < v.start) e.push({ n: 'end', m: 'Ends before it starts.' }); if (!(v.productIds || []).length) e.push({ n: 'productIds', m: 'Pick at least one product.' }); if (v.discType === 'pct' && N(v.value) > 90) e.push({ n: 'value', m: 'Over 90% off? Check the value.' }); return e; },
    onSave: async v => { await saveDoc('offers', id, { ...base(o), ...v, value: N(v.value), fee: N(v.fee), cancelled: !!v.cancelled }, ['marketing', `Offer ${v.name} · ${(v.productIds || []).length} products`]); },
    onDelete: o ? delFn('offers', id, 'marketing', 'Offer ' + o.name) : null,
  });
};

/* ---------- ratings per listing (product × platform) ---------- */
function curRating(p, k) {
  const l = listingOf(p, k); const sn = S.ratingSnaps.filter(s => s.productId === p.id && s.platform === k).sort((a, b) => a.date < b.date ? -1 : 1); const last = sn[sn.length - 1];
  const fromL = N(l.ratingAvg) ? { avg: N(l.ratingAvg), count: N(l.ratingCount), date: l.ratingAsOf || '' } : null; const fromS = last ? { avg: N(last.avg), count: N(last.count), date: last.date } : null;
  const cur = fromS && (!fromL || fromS.date >= fromL.date) ? fromS : fromL; const first = sn[0]; const back = sn.filter(s => s.date <= addDays(TODAY(), -30)).pop() || first;
  return { cur, trend: cur && back && back !== last ? cur.avg - N(back.avg) : null, since: back ? back.date : '', snaps: sn };
}
{
  const cu0 = V.customers;
  V.customers = () => {
    if (tabOf('cus', 'customers') !== 'ratings') return cu0().replace(/(data-act="tab:cus:reviews">.*?<\/button>)/, '$1<button class="tab" role="tab" aria-selected="false" data-act="tab:cus:ratings">Listing ratings</button>');
    const can = canEdit('customers') || canEdit('catalogue');
    let html = ph('Customers & ratings', 'Star rating and review count of every listing, SKU by SKU and platform by platform, with the trend and the reviews logged here.', can ? btn('Update ratings', 'ratingupd', { pri: true, i: 'star' }) : '');
    const nr = S.reviews.filter(x => inBrand(x) && (x.status || 'new') === 'new').length;
    html += tabsHTML('cus', [['customers', 'Customers', S.customers.length], ['reviews', 'Reviews', nr ? nr + ' new' : undefined], ['ratings', 'Listing ratings']], 'ratings');
    const pk = ui.filt.rtplat || ''; const ap = activePlatforms();
    const rows = []; for (const p of S.products.filter(x => inBrand(x) && x.status !== 'archived')) for (const pl of ap) { if (pk && pl.key !== pk) continue; const l = listingOf(p, pl.key); const rv = S.reviews.filter(r => r.productId === p.id && r.platform === pl.key); const R = curRating(p, pl.key); if ((l.status || 'none') === 'none' && !rv.length && !R.cur) continue; const neg = rv.filter(r => N(r.rating) <= 3 && r.date >= addDays(TODAY(), -90)).length; rows.push({ p, pl, l, rv, R, neg, ra: rv.length ? sum(rv, r => r.rating) / rv.length : 0 }); }
    const rated = rows.filter(x => x.R.cur); const wavg = ratio(sum(rated, x => x.R.cur.avg * Math.max(1, x.R.cur.count)), sum(rated, x => Math.max(1, x.R.cur.count)));
    html += kpis([{ l: 'Listings tracked', v: num(rows.length), s: num(rated.length) + ' with a rating' }, { l: 'Weighted rating', v: rated.length ? wavg.toFixed(2) + '★' : '—', s: num(sum(rated, x => x.R.cur.count)) + ' ratings' }, { l: 'Below 4★', v: num(rated.filter(x => x.R.cur.avg < 4).length), tone: rated.some(x => x.R.cur.avg < 4) ? 'neg' : '' }, { l: 'Not updated in 30 days', v: num(rated.filter(x => x.R.cur.date < addDays(TODAY(), -30)).length) }], 'k4');
    const sf = filtOf('rtf', 'all'); const shown = rows.filter(x => (sf === 'all' || (sf === 'low' ? x.R.cur && x.R.cur.avg < 4 : sf === 'none' ? !x.R.cur : sf === 'down' ? x.R.trend !== null && x.R.trend < 0 : true)) && matchQ('rt', x.p.name, x.p.sku, chanSku(x.p, x.pl.key)));
    html += `<div class="toolbar">${searchHTML('rt', 'Search product, SKU…')}${chipsHTML('rtf', [['all', 'All', rows.length], ['low', 'Below 4★'], ['down', 'Falling'], ['none', 'No rating yet']], sf)}<span class="sp"></span><label class="sr" for="rtplat">Platform</label><select class="inp" id="rtplat" data-ch="filtsel" data-key="rtplat" style="width:auto"><option value="">All platforms</option>${ap.map(p => `<option value="${esc(p.key)}"${pk === p.key ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>`;
    html += panel('', table('ratings', [
      { k: 'p', l: 'Product', render: x => prodCell(x.p), sort: x => x.p.name },
      { k: 'pl', l: 'Platform', render: x => platPill(x.pl.key), sort: x => x.pl.name },
      { k: 'sku', l: 'Listing SKU', render: x => `<span class="mono">${esc(chanSku(x.p, x.pl.key))}</span>${x.l.id ? `<br><small class="muted mono">${esc(x.l.id)}</small>` : ''}`, sort: x => chanSku(x.p, x.pl.key) },
      { k: 'avg', l: 'Stars', num: 1, render: x => x.R.cur ? `<b class="${x.R.cur.avg < 4 ? 'neg' : ''}">${x.R.cur.avg.toFixed(1)}★</b>` : '<span class="muted">—</span>', sort: x => x.R.cur ? x.R.cur.avg : -1 },
      { k: 'count', l: 'Ratings', num: 1, render: x => x.R.cur ? num(x.R.cur.count) : '—', sort: x => x.R.cur ? x.R.cur.count : -1 },
      { k: 'trend', l: 'Trend', num: 1, render: x => x.R.trend === null ? '<span class="muted">—</span>' : `<span class="${x.R.trend < 0 ? 'neg' : x.R.trend > 0 ? 'pos' : 'muted'}">${x.R.trend > 0 ? '▲' : x.R.trend < 0 ? '▼' : ''}${Math.abs(x.R.trend).toFixed(2)}</span><br><small class="muted">since ${esc(fmtDs(x.R.since))}</small>`, sort: x => x.R.trend ?? 0 },
      { k: 'asof', l: 'As of', render: x => x.R.cur ? `<span class="${x.R.cur.date < addDays(TODAY(), -30) ? 'neg' : ''}">${esc(fmtD(x.R.cur.date))}</span>` : '—', sort: x => x.R.cur ? x.R.cur.date : '' },
      { k: 'rv', l: 'Reviews logged', num: 1, render: x => x.rv.length ? `${x.ra.toFixed(1)}★ · ${num(x.rv.length)}${x.neg ? `<br><small class="neg">${num(x.neg)} at 3★ or less, 90 days</small>` : ''}` : '—', sort: x => x.rv.length },
      { k: 'l', l: '', nosort: 1, render: x => linkA(x.l.url, 'Listing', 'link', 'lnk') },
    ], shown, { sort: { k: 'avg', dir: 'asc' }, open: x => canView('catalogue') ? 'open:product:' + x.p.id : '', empty: empty('No listings to rate yet', 'Mark products live on a platform in the Catalogue, then update their ratings here.') }), { flush: true });
    return html;
  };
}
Object.assign(ACT, {
  ratingupd() {
    const ap = activePlatforms(); const pk0 = ui.filt.rtplat || (ap[0] || {}).key;
    const html = () => { const pk = RTU.pk; const ps = S.products.filter(p => inBrand(p) && p.status !== 'archived' && ((listingOf(p, pk).status || 'none') !== 'none' || curRating(p, pk).cur)); return `<div class="form"><div class="fld"><label for="fi_rtp">Platform</label><select class="inp" id="fi_rtp" data-ch="rtpk">${ap.map(p => `<option value="${esc(p.key)}"${p.key === pk ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div><div class="fld"><label for="fi_rtd">As of</label><input class="inp" type="date" id="fi_rtd" name="date" data-t="str" value="${TODAY()}"></div></div>${ps.length ? `<div class="tw"><table class="t grid"><thead><tr><th>Product</th><th>Listing SKU</th><th class="num">Last</th><th>Stars now</th><th>Ratings now</th></tr></thead><tbody>${ps.map(p => { const R = curRating(p, pk); return `<tr><td>${esc(p.name)}</td><td class="mono">${esc(chanSku(p, pk))}</td><td class="num muted">${R.cur ? R.cur.avg.toFixed(1) + '★ · ' + num(R.cur.count) : '—'}</td><td style="width:100px"><input class="inp tnum" type="number" step="0.1" min="0" max="5" name="r.${p.id}.avg" data-t="num" aria-label="Stars for ${esc(p.sku)}"></td><td style="width:110px"><input class="inp tnum" type="number" step="1" min="0" name="r.${p.id}.count" data-t="num" aria-label="Ratings for ${esc(p.sku)}"></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted">No listings on this platform yet.</p>'}<p class="help">Fill in only the listings you checked; blanks are skipped. Each entry is saved with its date so the trend builds up.</p>`; };
    RTU.pk = pk0; RTU.html = html;
    openDrawer({ title: 'Update listing ratings', sub: 'Copy the star rating and number of ratings from each listing page or seller central.', wide: true, saveLabel: 'Save ratings', noFocus: true, html: () => `<div id="rtuBox">${html()}</div>`,
      onSave: async v => { const pk = RTU.pk; const d = v.date || TODAY(); const ops = []; const n = []; for (const pid in (v.r || {})) { const x = v.r[pid]; if (x.avg === null || x.avg === undefined) continue; if (N(x.avg) < 0 || N(x.avg) > 5) { toast('Stars must be between 0 and 5.', 'bad'); return false; } const p = prodOf(pid); if (x.count === null || x.count === undefined) x.count = p ? ((curRating(p, pk).cur || {}).count || 0) : 0; ops.push({ op: 'set', path: `ratingSnaps/${pid}_${pk}_${d}`, data: clean({ productId: pid, platform: pk, date: d, avg: N(x.avg), count: N(x.count), brandId: p && p.brandId, ...stampOf(null) }) }); if (canEdit('catalogue') && p) ops.push({ op: 'set', path: 'products/' + pid, data: clean({ ...base(p), listings: { ...(p.listings || {}), [pk]: { ...listingOf(p, pk), ratingAvg: N(x.avg), ratingCount: N(x.count), ratingAsOf: d } }, ...stampOf(p) }) }); n.push(p ? p.sku : pid); }
        if (!n.length) { toast('Enter at least one rating.', 'bad'); return false; } await batchAll(ops); addLog('update', 'customers', `Updated ${n.length} ${PL(pk).name} listing ratings`, n.slice(0, 12).join(', ')); },
    });
  },
});
const RTU = { pk: '', html: null };
Object.assign(CH, { rtpk(v) { RTU.pk = v; const b = $('#rtuBox'); if (b && RTU.html) b.innerHTML = RTU.html(); } });
