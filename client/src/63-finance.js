/* =====================================================================
   Finance: bank / cash accounts with starting balances and statement
   reconciliation, platform settlement balances, corrected recurring bills
   ===================================================================== */
const ACC_TYPES = [['bank', 'Bank account'], ['cash', 'Cash'], ['upi', 'UPI / payment gateway'], ['wallet', 'Marketplace wallet'], ['card', 'Credit card']];
const TXN_CATS = [['order_payment', 'Customer payment'], ['vendor_payment', 'Vendor payment'], ['transfer', 'Transfer between accounts'], ['capital', 'Owner’s capital'], ['drawings', 'Owner’s drawings'], ['loan', 'Loan received / repaid'], ['other_income', 'Other income'], ['other_expense', 'Other payment'], ['salary', 'Salary payout'], ['adjustment', 'Balance adjustment']];
const acctOpts = () => S.accounts.filter(a => a.active !== false).map(a => [a.id, a.name]);
const recSet = () => Object.assign({ opening: {} }, S.settings.recon || {});
// every money movement that touches an account, newest last
function acctFlows(id) {
  return memo('flows:' + id, () => {
    const out = [];
    for (const p of S.payouts) if (p.accountId === id) out.push({ d: p.date, amt: N(p.amount), t: `Payout · ${PL(p.platform).name}${p.ref ? ' · ' + p.ref : ''}`, open: 'payout:' + p.id });
    for (const e of S.expenses) if (e.accountId === id) out.push({ d: e.date, amt: -(N(e.amount) + N(e.gst)), t: `${e.category}${e.vendor ? ' · ' + e.vendor : ''}`, open: 'expense:' + e.id });
    for (const x of S.txns) { if (x.accountId === id) out.push({ d: x.date, amt: x.type === 'in' ? N(x.amount) : -N(x.amount), t: txnLabel(x), open: 'txn:' + x.id }); if (x.type === 'transfer' && x.toAccountId === id) out.push({ d: x.date, amt: N(x.amount), t: 'Transfer from ' + ((S.accounts.find(a => a.id === x.accountId) || {}).name || 'account'), open: 'txn:' + x.id }); }
    return out.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  });
}
const txnLabel = x => { const c = (TXN_CATS.find(k => k[0] === x.category) || [, x.category || 'Entry'])[1]; const lk = x.link && x.link.col === 'orders' ? (S.orders.find(o => o.id === x.link.id) || {}).number : x.link && x.link.col === 'pinvoices' ? 'bill ' + ((S.pinvoices.find(b => b.id === x.link.id) || {}).number || '') : x.supplierId ? (supOf(x.supplierId) || {}).name : ''; return x.type === 'transfer' ? 'Transfer to ' + ((S.accounts.find(a => a.id === x.toAccountId) || {}).name || 'account') : c + (lk ? ' · ' + lk : '') + (x.ref ? ' · ' + x.ref : ''); };
const acctBal = (a, at = '9999-12-31') => N(a.opening) + sum(acctFlows(a.id).filter(f => f.d >= (a.openingDate || '0000') && f.d <= at), f => f.amt);

V.finance = () => {
  const can = canEdit('finance'); const secs = finSecs();
  if (!secs.length) return ph('Finance & accounts', '') + panel('', empty('No finance sections for your role', 'Ask the CEO to turn on the finance sections you need in Users & permissions.'));
  const keys = secs.map(s => s[0]); const tab = keys.includes(ui.tab.fin) ? ui.tab.fin : keys[0];
  const A = {
    pnl: '', sales: (can ? btn('Import sales CSV', 'import:sales', { i: 'upload' }) + btn('Record sale', 'new:sale', { pri: true, i: 'plus' }) : ''),
    expenses: can ? btn('Add expense', 'new:expense', { pri: true, i: 'plus' }) : '', recurring: can ? btn('Add recurring expense', 'new:recurring', { pri: true, i: 'plus' }) : '',
    payouts: can ? btn('Starting balances', 'reconopen', { i: 'wallet' }) + btn('Record payout', 'new:payout', { pri: true, i: 'plus' }) : '', assets: can ? btn('Add asset', 'new:asset', { pri: true, i: 'plus' }) : '',
    accounts: can ? btn('Record money in / out', 'new:txn', { i: 'plus' }) + btn('Add account', 'new:account', { pri: true, i: 'bank' }) : '',
  };
  let html = ph('Finance & accounts', 'Sales, expenses, recurring bills, platform payouts, bank and cash accounts with their balances, fixed assets and a profit & loss statement with a GST view.', A[tab] || '');
  const od = S.recurring.filter(x => inBrand(x) && x.active !== false && !x.autoPost && overdueDates(x).length).length;
  html += tabsHTML('fin', secs.map(([k, l]) => [k, k === 'pnl' ? 'Profit & loss' : l, k === 'recurring' && od ? od + ' overdue' : undefined]), tab);
  return html + ({ pnl: finPnl, sales: finSales, expenses: finExpenses, recurring: finRecurring2, payouts: finPayouts2, assets: finAssets, accounts: finAccounts }[tab] || finPnl)();
};

/* ---------- recurring bills: "due in 30 days" counts unpaid bills from today, overdue only once the date has passed ---------- */
function finRecurring2() {
  const T = TODAY(); const list = S.recurring.filter(inBrand); const act = list.filter(x => x.active !== false && (!x.endDate || x.endDate >= T));
  const unpaidFrom = x => { const a = x.postedThrough ? addDays(x.postedThrough, 1) : x.startDate; return a > T ? a : T; };
  const in30 = act.flatMap(x => dueDates(x, unpaidFrom(x), addDays(T, 30)).map(d => ({ x, d })));
  const today = act.filter(x => !x.autoPost && pendingDates(x).includes(T));
  const od = act.filter(x => !x.autoPost && overdueDates(x).length);
  const amt = x => N(x.amount) + N(x.gst);
  let html = kpis([
    { l: 'Active schedules', v: num(act.length), s: num(act.filter(x => x.autoPost).length) + ' post automatically' },
    { l: 'Monthly commitment', v: inrS(sum(act, monthlyEquiv)), s: inrS(sum(act, monthlyEquiv) * 12) + ' a year', title: inr(sum(act, monthlyEquiv)) + ' ex-GST' },
    { l: 'Due in the next 30 days', v: inrS(sum(in30, y => amt(y.x))), s: `${num(in30.length)} bill${in30.length === 1 ? '' : 's'} · ${esc(fmtDs(T))} to ${esc(fmtDs(addDays(T, 30)))}`, title: inr(sum(in30, y => amt(y.x))) + ' incl. GST, not yet paid' },
    { l: 'Overdue', v: num(od.length), tone: od.length ? 'neg' : '', s: od.length ? inrS(sum(od, x => amt(x) * overdueDates(x).length)) + ' unpaid' : (today.length ? num(today.length) + ' due today' : 'nothing overdue') },
  ], 'k4');
  const RS = x => x.active === false ? ['Paused', 't-neu'] : (x.endDate && x.endDate < T) ? ['Ended', 't-neu'] : (!x.autoPost && overdueDates(x).length) ? ['Overdue', 't-bad'] : (!x.autoPost && pendingDates(x).includes(T)) ? ['Due today', 't-warn'] : ['Active', 't-good'];
  const nextOf = x => { if (!x.autoPost) { const p = pendingDates(x); if (p.length) return p[0]; } return nextDue(x); };
  const tbl = table('rec', [
    { k: 'name', l: 'Bill', render: x => `<b>${esc(x.name)}</b>${delPill('recurring', x.id)}<br><small class="muted">${esc(x.category || '')}${x.vendor ? ' · ' + esc(x.vendor) : ''}</small>`, sort: x => x.name },
    { k: 'freq', l: 'Repeats', render: x => esc(freqOf(x.frequency)[1]) + (x.frequency !== 'weekly' ? `<br><small class="muted">on day ${N(x.day) || parseD(x.startDate).getDate()}</small>` : ''), sort: x => freqOf(x.frequency)[2] },
    { k: 'amount', l: 'Amount', num: 1, render: x => inr(x.amount) + (N(x.gst) ? `<br><small class="muted">+ GST ${inr(x.gst)}</small>` : ''), sort: x => N(x.amount) },
    { k: 'm', l: 'Per month', num: 1, render: x => inr(monthlyEquiv(x)), sort: x => monthlyEquiv(x) },
    { k: 'next', l: 'Next due', render: x => { const o = !x.autoPost ? overdueDates(x) : []; const n = nextOf(x); return o.length ? `<span class="neg"><b>${esc(fmtD(o[0]))}</b></span>${o.length > 1 ? ` <small class="muted">+${o.length - 1} more</small>` : ''}` : n === T ? '<b>Today</b>' : esc(fmtD(n)); }, sort: x => nextOf(x) || '9' },
    { k: 'paid', l: 'Paid through', render: x => esc(x.postedThrough ? fmtD(x.postedThrough) : '—'), sort: x => x.postedThrough || '' },
    { k: 'auto', l: 'Posting', render: x => x.autoPost ? pill('Automatic', 't-info', 1) : pill('Manual', 't-neu', 1), sort: x => x.autoPost ? 0 : 1 },
    { k: 'st', l: 'Status', render: x => pill(...RS(x)), sort: x => RS(x)[0] },
    { k: 'a', l: '', nosort: 1, render: x => (canEdit('finance') && !x.autoPost && x.active !== false && pendingDates(x).length) ? btn('Mark paid', 'recpost:' + x.id, { sm: true }) : '' },
  ], list, { sort: { k: 'next', dir: 'asc' }, open: x => 'open:recurring:' + x.id, empty: empty('No recurring expenses yet', 'Add rent, salaries, software subscriptions, insurance and EMIs once. Automatic ones post to Expenses on their due date; manual ones wait for you to mark them paid.', canEdit('finance') ? btn('Add recurring expense', 'new:recurring', { pri: true }) : '') });
  const up = act.flatMap(x => dueDates(x, unpaidFrom(x), addDays(T, 60)).map(d => ({ x, d }))).sort((a, b) => a.d < b.d ? -1 : 1).slice(0, 14);
  const upList = up.length ? `<div class="list">${up.map(y => `<div class="li"><span class="tnum ${y.d === T ? '' : 'muted'}" style="width:62px;flex:none">${y.d === T ? '<b>Today</b>' : esc(fmtDs(y.d))}</span><div class="grow"><b>${esc(y.x.name)}</b><small>${esc(y.x.category || '')}${y.x.autoPost ? ' · posts automatically' : ''}</small></div><span class="tnum" style="font-weight:600">${inr(amt(y.x))}</span></div>`).join('')}</div>` : empty('Nothing due', 'No unpaid recurring bills fall in the next 60 days.');
  return html + panel('', tbl, { flush: true }) + panel('Coming up, next 60 days (unpaid)', upList, { flush: true });
}

/* ---------- payouts with a starting balance per platform ---------- */
// payouts aren't split by brand, so every brand's sales count here
function finPayouts2() {
  const base0 = (() => { const r = periodRange(); const pays = S.payouts.filter(p => inRange(p.date, r)); const exp = {}; for (const s of S.sales) if (inRange(s.date, r)) (exp[s.platform] = exp[s.platform] || []).push(s); for (const k in exp) exp[k] = finSum(exp[k]).settlement; const keys = Array.from(new Set([...Object.keys(exp), ...pays.map(p => p.platform)])); return { r, pays, rows: keys.map(k => { const rec = sum(pays.filter(p => p.platform === k), p => p.amount); const e = exp[k] || 0; return { k, e, rec, gap: e - rec, gp: ratio(e - rec, e) }; }).sort((a, b) => b.e - a.e) }; })();
  const { r, pays, rows } = base0; const E = sum(rows, x => x.e), Rv = sum(rows, x => x.rec);
  const op = recSet().opening || {};
  const run = platforms().filter(p => op[p.key] || S.payouts.some(x => x.platform === p.key) || (!['direct', 'b2b'].includes(p.key) && S.sales.some(s => s.platform === p.key))).map(p => { const o = op[p.key] || {}; const from = o.asOf || '0000-00-00'; const exp = finSum(S.sales.filter(s => s.platform === p.key && s.date >= from)).settlement; const rec = sum(S.payouts.filter(x => x.platform === p.key && x.date >= from), x => x.amount); return { p, open: N(o.amount), asOf: o.asOf || '', exp, rec, bal: N(o.amount) + exp - rec }; });
  let html = kpis([
    { l: 'Expected settlement', v: inrS(E), s: 'from sales in the period', title: inr(E) },
    { l: 'Received', v: inrS(Rv), s: num(pays.length) + ' payouts', title: inr(Rv) },
    { l: 'Difference', v: inrS(E - Rv), tone: E - Rv > 0.02 * E ? 'neg' : '', s: pct(ratio(E - Rv, E)) + ' of expected', title: inr(E - Rv) },
    { l: 'Owed by platforms now', v: inrS(sum(run, x => x.bal)), s: 'starting balance + expected − received', title: inr(sum(run, x => x.bal)) },
  ], 'k4');
  const runT = table('recrun', [
    { k: 'p', l: 'Platform', render: x => platPill(x.p.key), sort: x => x.p.name },
    { k: 'open', l: 'Starting balance', num: 1, render: x => x.asOf ? `${inr(x.open)}<br><small class="muted">on ${esc(fmtD(x.asOf))}</small>` : '<span class="muted">not set</span>', sort: x => x.open },
    { k: 'exp', l: 'Expected since', num: 1, render: x => inr(x.exp) }, { k: 'rec', l: 'Received since', num: 1, render: x => inr(x.rec) },
    { k: 'bal', l: 'Still owed', num: 1, render: x => `<b class="${x.bal < -1 ? 'pos' : ''}">${inr(x.bal)}</b>`, sort: x => x.bal },
  ], run, { empty: empty('Nothing yet', 'Platforms with sales or payouts appear here.') });
  const recon = table('recon', [
    { k: 'k', l: 'Platform', render: x => platPill(x.k), sort: x => PL(x.k).name },
    { k: 'e', l: 'Expected', num: 1, render: x => inr(x.e) }, { k: 'rec', l: 'Received', num: 1, render: x => inr(x.rec) },
    { k: 'gap', l: 'Difference', num: 1, render: x => `<span class="${x.gap > 0.02 * x.e ? 'neg' : ''}">${inr(x.gap)}</span>` },
    { k: 'st', l: 'Check', render: x => !x.e ? pill('No sales', 't-neu', 1) : Math.abs(x.gp) <= 0.02 ? pill('Matches', 't-good', 1) : x.gap > 0 ? pill('Short ' + pct(x.gp, 0), 't-bad', 1) : pill('Over ' + pct(-x.gp, 0), 't-info', 1), sort: x => x.gp },
  ], rows, { empty: empty('Nothing to reconcile', 'Record sales and the payouts that hit your bank to compare them.') });
  const list = table('payouts', [
    { k: 'date', l: 'Date', render: p => esc(fmtD(p.date)) }, { k: 'pl', l: 'Platform', render: p => platPill(p.platform), sort: p => PL(p.platform).name },
    { k: 'ref', l: 'UTR / reference', render: p => `<span class="mono">${esc(p.ref || '—')}</span>${delPill('payouts', p.id)}` },
    { k: 'acc', l: 'Into', render: p => esc((S.accounts.find(a => a.id === p.accountId) || {}).name || '—') },
    { k: 'amount', l: 'Amount', num: 1, render: p => inr(p.amount), sort: p => N(p.amount) },
  ], pays, { sort: { k: 'date', dir: 'desc' }, open: p => 'open:payout:' + p.id, foot: { date: 'Total', amount: inr(Rv) }, empty: empty('No payouts recorded', 'Add each settlement that lands in your bank account, with its UTR, to reconcile it against your sales.', canEdit('finance') ? btn('Record payout', 'new:payout', { pri: true }) : '') });
  if (!brandAll()) html += `<div class="callout"><span>Platforms pay out for all brands together, so this page always shows every brand.</span></div>`;
  return html + panel('Running balance with each platform', runT, { flush: true, sub: 'From each platform’s starting balance date to today', right: canEdit('finance') ? btn('Set starting balances', 'reconopen', { sm: true }) : '' }) + `<div class="g2">${panel('Reconciliation by platform', recon, { flush: true, sub: rangeLabel() })}${panel('Payouts received', list, { flush: true })}</div><p class="muted" style="margin:0;font-size:12px;max-width:90ch">Set a starting balance for each platform (what it owed you on the day you started using the ERP, from its payments report). The running balance then adds the settlement expected from every sale since that date and subtracts every payout received.</p>`;
}
Object.assign(ACT, {
  reconopen() {
    const rs = recSet(); const pls = platforms().filter(p => p.on !== false || (rs.opening || {})[p.key]);
    openDrawer({ title: 'Platform starting balances', sub: 'What each marketplace owed you on a given date: unsettled orders minus pending deductions, from its payments or reserve report.', readOnly: !canEdit('finance'),
      html: `<div class="tw"><table class="t grid"><thead><tr><th>Platform</th><th>Amount owed to you</th><th>As of</th></tr></thead><tbody>${pls.map(p => { const o = (rs.opening || {})[p.key] || {}; return `<tr><td><b>${esc(p.name)}</b></td><td><div class="affix hp"><span class="pre">₹</span><input class="inp tnum" type="number" step="any" name="o.${p.key}.amount" data-t="num" value="${esc(o.amount ?? '')}" aria-label="${esc(p.name)} amount"></div></td><td><input class="inp" type="date" name="o.${p.key}.asOf" data-t="str" value="${esc(o.asOf || '')}" aria-label="${esc(p.name)} date"></td></tr>`; }).join('')}</tbody></table></div><p class="help">Enter a negative amount if you owed the platform. Leave a row blank to start from zero with all past sales.</p>`,
      onSave: async v => { const opening = {}; for (const k in (v.o || {})) { const x = v.o[k]; if ((x.amount !== null && x.amount !== undefined) || x.asOf) opening[k] = { amount: N(x.amount), asOf: x.asOf || TODAY() }; } await dbWrite('set', 'settings/recon', clean({ ...recSet(), opening, updatedAt: nowISO(), updatedBy: ME.id })); addLog('settings', 'finance', 'Platform starting balances updated', Object.entries(opening).map(([k, o]) => `${PL(k).name} ${inr(o.amount)} on ${fmtD(o.asOf)}`).join('; ')); } });
  },
});

/* ---------- bank & cash accounts ---------- */
function finAccounts() {
  const acc = S.accounts.slice().sort((a, b) => (a.active === false) - (b.active === false) || String(a.name).localeCompare(String(b.name))); const T = TODAY();
  const rows = acc.map(a => { const fl = acctFlows(a.id).filter(f => f.d >= (a.openingDate || '0000')); const r = periodRange(); const inP = fl.filter(f => inRange(f.d, r)); const last = (a.recon || [])[0]; return { a, bal: acctBal(a), inn: sum(inP.filter(f => f.amt > 0), f => f.amt), out: -sum(inP.filter(f => f.amt < 0), f => f.amt), n: fl.length, last }; });
  const unl = { pay: S.payouts.filter(p => !p.accountId).length, exp: S.expenses.filter(e => !e.accountId && e.date >= addDays(T, -90)).length };
  let html = kpis([{ l: 'Total balance', v: inrS(sum(rows.filter(x => x.a.active !== false), x => x.bal)), title: inr(sum(rows.filter(x => x.a.active !== false), x => x.bal)) }, { l: 'Money in', v: inrS(sum(rows, x => x.inn)), s: rangeLabel() }, { l: 'Money out', v: inrS(sum(rows, x => x.out)), s: rangeLabel() }, { l: 'Not linked to an account', v: num(unl.pay + unl.exp), s: `${num(unl.pay)} payouts · ${num(unl.exp)} expenses (90 days)` }], 'k4');
  html += panel('', table('accts', [
    { k: 'name', l: 'Account', render: x => `<b>${esc(x.a.name)}</b>${x.a.active === false ? ' ' + pill('Closed', 't-neu', 1) : ''}${delPill('accounts', x.a.id)}<br><small class="muted">${esc((ACC_TYPES.find(t => t[0] === x.a.type) || [, ''])[1])}${x.a.bankName ? ' · ' + esc(x.a.bankName) : ''}${x.a.number ? ' ··' + esc(String(x.a.number).slice(-4)) : ''}</small>`, sort: x => x.a.name },
    { k: 'open', l: 'Starting balance', num: 1, render: x => `${inr(x.a.opening)}<br><small class="muted">on ${esc(fmtD(x.a.openingDate))}</small>`, sort: x => N(x.a.opening) },
    { k: 'inn', l: 'In (period)', num: 1, render: x => inr(x.inn) }, { k: 'out', l: 'Out (period)', num: 1, render: x => inr(x.out) },
    { k: 'bal', l: 'Balance now', num: 1, render: x => `<b class="${x.bal < 0 ? 'neg' : ''}">${inr(x.bal)}</b>`, sort: x => x.bal },
    { k: 'rec', l: 'Last reconciled', render: x => x.last ? `${esc(fmtD(x.last.date))}<br>${Math.abs(N(x.last.diff)) < 1 ? pill('Matched', 't-good', 1) : pill('Off by ' + inr(x.last.diff), 't-bad', 1)}` : '<span class="muted">Never</span>', sort: x => x.last ? x.last.date : '' },
    { k: 'a', l: '', nosort: 1, render: x => `<span style="display:inline-flex;gap:6px">${btn('Statement', 'acctstmt:' + x.a.id, { sm: true })}${canEdit('finance') ? btn('Reconcile', 'acctrec:' + x.a.id, { sm: true }) : ''}</span>` },
  ], rows, { open: x => 'open:account:' + x.a.id, empty: empty('No accounts yet', 'Add each bank account, cash box and UPI or gateway account with its balance on a starting date. Payouts, expenses, customer and vendor payments then keep the balance up to date.', canEdit('finance') ? btn('Add account', 'new:account', { pri: true }) : '') }), { flush: true });
  const tx = S.txns.slice().sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 60);
  html += panel('Other money in and out', table('txns', [
    { k: 'date', l: 'Date', render: x => esc(fmtD(x.date)) }, { k: 't', l: 'Entry', render: x => `${esc(txnLabel(x))}${delPill('txns', x.id)}`, sort: x => txnLabel(x) },
    { k: 'acc', l: 'Account', render: x => esc((S.accounts.find(a => a.id === x.accountId) || {}).name || '—') },
    { k: 'amt', l: 'Amount', num: 1, render: x => `<span class="${x.type === 'out' ? 'neg' : x.type === 'in' ? 'pos' : ''}">${x.type === 'out' ? '−' : x.type === 'in' ? '+' : '⇄ '}${inr(x.amount)}</span>`, sort: x => N(x.amount) },
  ], tx, { sort: { k: 'date', dir: 'desc' }, open: x => 'open:txn:' + x.id, empty: empty('Nothing yet', 'Customer payments on orders, vendor payments on bills, transfers, capital and loans appear here.') }), { flush: true });
  return html;
}
EDIT.account = id => {
  const a = id ? S.accounts.find(x => x.id === id) : null; const can = canEdit('finance');
  const f = [{ n: 'name', l: 'Account name', req: 1, full: 1, ph: 'e.g. HDFC current account, Shop cash' }, { n: 'type', l: 'Type', t: 'select', o: ACC_TYPES }, { n: 'bankName', l: 'Bank / provider' }, { n: 'number', l: 'Last 4 digits', mono: 1, max: 4, help: 'Only the last four digits, for reference.' }, { n: 'ifsc', l: 'IFSC', mono: 1, max: 11 },
    { n: 'opening', l: 'Starting balance', t: 'money', req: 1, help: 'The balance at the start of the starting date, from your passbook or statement.' }, { n: 'openingDate', l: 'Starting date', t: 'date', req: 1, help: 'Entries dated on or after this are added to the balance.' }, { n: 'active', l: '', t: 'check', cl: 'Active', full: 1 }, { n: 'notes', l: 'Notes', t: 'textarea', rows: 2, full: 1 }];
  openDrawer({
    title: a ? a.name : 'New account', sub: a ? `Balance now ${inr(acctBal(a))}` : 'Bank, cash, UPI or a payment gateway. Set its starting balance once.', readOnly: !can, delKey: 'accounts/' + id,
    top: a ? kvHTML([['Starting', inr(a.opening)], ['Since', esc(fmtD(a.openingDate))], ['Entries', num(acctFlows(a.id).filter(x => x.d >= (a.openingDate || '0000')).length)], ['Balance', inr(acctBal(a))]]) : '',
    html: form(f, a || { type: 'bank', opening: 0, openingDate: TODAY().slice(0, 8) + '01', active: true }),
    validate: v => /^\d{0,4}$/.test(String(v.number || '')) ? [] : [{ n: 'number', m: 'Up to 4 digits only.' }],
    onSave: async v => { await saveDoc('accounts', id, { ...base(a), ...v, opening: N(v.opening), active: v.active !== false }, ['finance', `Account ${v.name} · starting ${inr(v.opening)} on ${fmtD(v.openingDate)}`]); },
    onDelete: a ? delFn('accounts', id, 'finance', 'Account ' + a.name, () => acctFlows(a.id).length ? 'Entries are linked to this account. Mark it inactive instead.' : '') : null,
  });
};
EDIT.txn = (id, preset = {}) => {
  const x = id ? S.txns.find(t => t.id === id) : null; const can = canEdit('finance') || (x && x.category === 'order_payment' && canEdit('orders')) || (x && x.category === 'vendor_payment' && canEdit('inventory'));
  const f = [{ n: 'type', l: 'Direction', t: 'select', req: 1, o: [['in', 'Money in'], ['out', 'Money out'], ['transfer', 'Transfer between accounts']] }, { n: 'category', l: 'What for', t: 'select', o: TXN_CATS }, { n: 'amount', l: 'Amount', t: 'money', req: 1, min: 0 }, { n: 'date', l: 'Date', t: 'date', req: 1 }, { n: 'accountId', l: 'Account (from)', t: 'select', req: 1, o: acctOpts, blank: 'Choose…' }, { n: 'toAccountId', l: 'To account (transfers)', t: 'select', o: acctOpts, blank: '—' }, { n: 'mode', l: 'Mode', t: 'select', o: ['Bank transfer', 'UPI', 'Cash', 'Cheque', 'Card', 'Marketplace'] }, { n: 'ref', l: 'Reference', mono: 1 }, { n: 'note', l: 'Note', t: 'textarea', rows: 2, full: 1 }];
  openDrawer({ title: x ? txnLabel(x) : 'Record money in or out', sub: x ? esc(fmtD(x.date)) : 'Capital, loans, transfers, other income or payments not entered as an expense.', readOnly: !can, delKey: 'txns/' + id,
    html: form(f, x || { type: 'in', category: 'other_income', date: TODAY(), mode: 'Bank transfer', ...preset }),
    validate: v => { const e = []; if (N(v.amount) <= 0) e.push({ n: 'amount', m: 'Enter the amount.' }); if (v.type === 'transfer' && (!v.toAccountId || v.toAccountId === v.accountId)) e.push({ n: 'toAccountId', m: 'Pick a different account to transfer into.' }); return e; },
    onSave: async v => { await saveDoc('txns', id, { ...base(x), ...v, amount: N(v.amount), category: v.type === 'transfer' ? 'transfer' : v.category, toAccountId: v.type === 'transfer' ? v.toAccountId : null }, ['finance', `${v.type === 'in' ? 'Money in' : v.type === 'out' ? 'Money out' : 'Transfer'} ${inr(v.amount)}`]); },
    onDelete: x ? delFn('txns', id, 'finance', `${txnLabel(x)} ${inr(x.amount)} on ${fmtD(x.date)}`) : null });
};
Object.assign(ACT, {
  acctstmt(id) {
    const a = S.accounts.find(x => x.id === id); if (!a) return; let run = N(a.opening); const fl = acctFlows(id).filter(f => f.d >= (a.openingDate || '0000')).map(f => { run += f.amt; return { ...f, bal: run }; }).reverse();
    openDrawer({ title: a.name + ' statement', sub: `From ${fmtD(a.openingDate)} · balance now ${inr(acctBal(a))}`, wide: true,
      html: `<div class="tw"><table class="t"><thead><tr><th>Date</th><th>Entry</th><th class="num">In</th><th class="num">Out</th><th class="num">Balance</th></tr></thead><tbody>${fl.map(f => `<tr class="click" data-act="stmtopen:${f.open}"><td>${esc(fmtD(f.d))}</td><td>${esc(f.t)}</td><td class="num pos">${f.amt > 0 ? inr(f.amt, 2) : ''}</td><td class="num neg">${f.amt < 0 ? inr(-f.amt, 2) : ''}</td><td class="num"><b>${inr(f.bal, 2)}</b></td></tr>`).join('')}<tr><td>${esc(fmtD(a.openingDate))}</td><td><b>Starting balance</b></td><td></td><td></td><td class="num"><b>${inr(a.opening, 2)}</b></td></tr></tbody></table></div>`,
      footExtra: allow('export') ? btn('Export CSV', 'acctcsv:' + id, { i: 'dl' }) : '' });
  },
  stmtopen(kind, rid1) { closeDrawer(); setTimeout(() => EDIT[kind] && EDIT[kind](rid1), 230); },
  acctcsv(id) { const a = S.accounts.find(x => x.id === id); let run = N(a.opening); const fl = acctFlows(id).filter(f => f.d >= (a.openingDate || '0000')).map(f => { run += f.amt; return { ...f, bal: run }; }); exportCSV(a.name + ' statement', [{ l: 'Date', csv: f => f.d }, { l: 'Entry', csv: f => f.t }, { l: 'In', csv: f => f.amt > 0 ? f.amt.toFixed(2) : '' }, { l: 'Out', csv: f => f.amt < 0 ? (-f.amt).toFixed(2) : '' }, { l: 'Balance', csv: f => f.bal.toFixed(2) }], fl, 'finance'); },
  acctrec(id) {
    const a = S.accounts.find(x => x.id === id); if (!a) return; const hist = a.recon || [];
    openDrawer({ title: 'Reconcile ' + a.name, sub: 'Compare the balance on your bank statement with the ERP balance on the same date.', saveLabel: 'Save reconciliation',
      html: form([{ n: 'date', l: 'Statement date', t: 'date', req: 1, ch: 'recdate' }, { n: 'stmt', l: 'Balance on the statement', t: 'money', req: 1 }, { raw: `<div class="callout" id="recErp"><span>ERP balance at end of ${esc(fmtD(TODAY()))}: <b>${inr(acctBal(a, TODAY()), 2)}</b></span></div>` }, { n: 'note', l: 'Note', full: 1, ph: 'e.g. bank charges not entered yet' }], { date: TODAY() })
        + (hist.length ? `<div class="subh">Earlier reconciliations</div><div class="list">${hist.map(h => `<div class="li"><span class="sev ${Math.abs(N(h.diff)) < 1 ? 'good' : 'bad'}"></span><div class="grow"><b>${esc(fmtD(h.date))}</b><small>Statement ${inr(h.stmt, 2)} · ERP ${inr(h.erp, 2)}${h.note ? ' · ' + esc(h.note) : ''}</small></div><span class="tnum ${Math.abs(N(h.diff)) < 1 ? '' : 'neg'}">${Math.abs(N(h.diff)) < 1 ? 'Matched' : inr(h.diff, 2)}</span></div>`).join('')}</div>` : ''),
      onSave: async v => { const erp = Math.round(acctBal(a, v.date) * 100) / 100; const diff = Math.round((N(v.stmt) - erp) * 100) / 100; await saveDoc('accounts', id, { ...base(a), recon: [{ date: v.date, stmt: N(v.stmt), erp, diff, note: v.note, by: ME.id, at: nowISO() }, ...hist].slice(0, 24) }, ['finance', `Reconciled ${a.name} on ${fmtD(v.date)}`]); toast(Math.abs(diff) < 1 ? 'Balances match' : `Off by ${inr(diff, 2)}. Look for missing entries before ${fmtD(v.date)}.`, Math.abs(diff) < 1 ? '' : 'bad'); }, savedMsg: null });
    DRW_rec = a;
  },
});
let DRW_rec = null;
Object.assign(CH, { recdate(v) { const b = $('#recErp'); if (b && DRW_rec && v) b.innerHTML = `<span>ERP balance at end of ${esc(fmtD(v))}: <b>${inr(acctBal(DRW_rec, v), 2)}</b></span>`; } });
