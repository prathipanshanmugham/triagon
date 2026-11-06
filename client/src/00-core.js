(() => {
'use strict';
/* =====================================================================
   Triagon ERP — core: helpers, data model, permissions, maths
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const N = v => { const n = +v; return Number.isFinite(n) ? n : 0; };
const inr = (n, d = 0) => { n = N(n); const s = n < 0 ? '−' : ''; return s + '₹' + (d ? nf2 : nf0).format(Math.abs(d ? n : Math.round(n))); };
const inrS = n => { n = N(n); const a = Math.abs(n), s = n < 0 ? '−' : ''; if (a >= 1e7) return s + '₹' + nf1.format(a / 1e7) + ' Cr'; if (a >= 1e5) return s + '₹' + nf1.format(a / 1e5) + ' L'; return s + '₹' + nf0.format(Math.round(a)); };
const num = n => nf0.format(Math.round(N(n)));
const nf3 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });
const qty = n => nf3.format(Math.round(N(n) * 1000) / 1000);
const UNITS = [['pc', 'Piece (pc)'], ['sq ft', 'Square foot (sq ft)'], ['sq m', 'Square metre (sq m)'], ['m', 'Metre (m)'], ['ft', 'Foot (ft)'], ['kg', 'Kilogram (kg)'], ['g', 'Gram (g)'], ['l', 'Litre (l)'], ['ml', 'Millilitre (ml)'], ['set', 'Set'], ['pair', 'Pair'], ['roll', 'Roll'], ['box', 'Box'], ['sheet', 'Sheet'], ['hide', 'Hide']];
const unitOf = p => (p && UNITS.some(u => u[0] === p.unit)) ? p.unit : 'pc';
const fmtQ = (n, p) => { const u = typeof p === 'string' ? (UNITS.some(x => x[0] === p) ? p : '') : unitOf(p); return qty(n) + (u && u !== 'pc' ? ' ' + esc(u) : ''); };
// a purchase unit differs from the stock unit whenever its factor isn't 1
// can the signed-in person delete records of this collection (they need write access to it)
const canDeleteCol = col => !perms() || (MODEL.writeMods(col) || []).some(m => m === '*' || canEdit(m));
const isPU = f => N(f) > 0 && N(f) !== 1;
// product choices for a line, keeping the line's own product even if it is archived or in another brand
const prodOptsWith = (...ids) => { const o = prodOpts(); for (const id of ids) { const p = id && prodOf(id); if (p && !o.some(x => x[0] === id)) o.unshift([id, (p.sku ? p.sku + ' · ' : '') + p.name + (p.status === 'archived' ? ' (archived)' : '')]); } return o; };
const pct = (f, d = 1) => (Number.isFinite(f) ? (f * 100).toFixed(d) : '0.0') + '%';
const ratio = (a, b) => (b ? a / b : 0);
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const TODAY = () => ymd(new Date());
const parseD = s => { const [y, m, d] = String(s || TODAY()).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
const addMonths = (s, n) => { const d = parseD(s); return ymd(new Date(d.getFullYear(), d.getMonth() + n, 1)); };
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const fmtD = s => s ? parseD(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDs = s => s ? parseD(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—';
const fmtT = iso => { const d = new Date(iso); return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); };
const monthLabel = k => { const [y, m] = k.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }); };
const rid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-5);
const nowISO = () => new Date().toISOString();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const sum = (arr, f) => arr.reduce((t, x) => t + N(f(x)), 0);
const groupBy = (arr, f) => arr.reduce((m, x) => { const k = f(x); (m[k] = m[k] || []).push(x); return m; }, {});
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- icons ---------- */
const IC = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  report: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9.5 17v-3M12.5 17v-6M15.5 17v-4"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.4"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><path d="M13.5 15h7M13.5 19h4.5"/>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  rupee: '<path d="M7 4.5h10M7 9h10M9.5 4.5c3.6 0 5 1.8 5 4.5s-2 4.5-5 4.5H8l6.5 6.5"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 7h7"/><circle cx="9" cy="12" r=".6"/><circle cx="12" cy="12" r=".6"/><circle cx="15" cy="12" r=".6"/><circle cx="9" cy="16" r=".6"/><circle cx="12" cy="16" r=".6"/><circle cx="15" cy="16" r=".6"/>',
  mega: '<path d="M3 10v4h3l7 4.5v-13L6 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4M17.5 14.8c2 .7 3.4 2.4 4 5.2"/>',
  log: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  check: '<path d="M12 3 4.5 6v5.5c0 4.4 3.1 8.2 7.5 9.5 4.4-1.3 7.5-5.1 7.5-9.5V6z"/><path d="m8.8 12 2.3 2.3 4.3-4.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h9"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
  upload: '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>',
  truck: '<path d="M3 6h11v10H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
  cart: '<path d="M3 4h2.5l2.2 11h10.6l2-8H6.6"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
  repeat: '<path d="M4 11V9a3 3 0 0 1 3-3h12M16 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H5M8 21l-3-3 3-3"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20.5h18"/>',
  asset: '<rect x="3" y="5" width="18" height="12" rx="1.5"/><path d="M8 21h8M12 17v4"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M5.5 7l1 13h11l1-13M9 7V4h6v3"/>',
};
const icon = (k, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k] || ''}</svg>`;

/* ---------- modules & reference lists ---------- */
const MODULES = MODEL.MODULES;
const MOD = Object.fromEntries(MODULES.map(m => [m.k, m]));
const FIN_SECTIONS = MODEL.FIN_SECTIONS;
const ABILITIES = MODEL.ABILITIES;
const DEFAULT_ROLE_DEFS = MODEL.DEFAULT_ROLE_DEFS;
const SWATCHES = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8'];
const BRAND_CATS = ['Leather hides & sheets', 'Leather craft', 'Pottery & ceramics', 'Craft tools & kits', 'Art & craft supplies', 'Textile crafts', 'Handicrafts & décor', 'Packaging & printing', 'Other'];
const PROD_CATS = ['Leather hide', 'Leather sheet / panel', 'Leather scraps', 'Leathercraft tool', 'Leathercraft kit', 'Thread & needles', 'Hardware & fittings', 'Dye & finish', 'Pottery clay', 'Glaze & colour', 'Pottery tool', 'Handmade pottery', 'Finished leather goods', 'Craft kit', 'Craft supply', 'Accessory', 'Other'];
const GST_RATES = [0, 3, 5, 12, 18, 28, 40];
const LIST_STATUS = [['none', 'Not listed'], ['draft', 'Draft'], ['live', 'Live'], ['inactive', 'Inactive'], ['suppressed', 'Suppressed']];
const SALE_STATUS = [['delivered', 'Delivered'], ['transit', 'In transit'], ['returned', 'Returned'], ['cancelled', 'Cancelled']];
const EXP_CATS = ['Advertising', 'Salaries & wages', 'Rent & utilities', 'Raw material & consumables', 'Logistics & courier', 'Packaging material', 'Software & subscriptions', 'Professional fees', 'Photography & content', 'Workshops & events', 'Insurance', 'Loan & EMI', 'Travel', 'Bank & payment charges', 'Office & misc', 'Other'];
const CHANNELS = ['Amazon Sponsored Products', 'Amazon Sponsored Brands', 'Flipkart Ads', 'Meesho Ads', 'Etsy Ads', 'Meta Ads', 'Google Ads', 'Influencer', 'Email / WhatsApp', 'Workshop / event', 'Deal / coupon', 'Other'];
const CAMP_STATUS = [['planned', 'Planned'], ['live', 'Live'], ['paused', 'Paused'], ['ended', 'Ended']];
const REV_STATUS = [['new', 'Needs reply'], ['replied', 'Replied'], ['escalated', 'Escalated'], ['resolved', 'Resolved']];
const MOVE_TYPES = [['purchase', 'Purchase / inward', 1], ['return_in', 'Customer return (manual)', 1], ['adjust_add', 'Adjustment: add', 1], ['adjust_remove', 'Adjustment: remove', -1], ['damaged', 'Damaged / write-off', -1], ['count', 'Physical count (set on-hand)', 0]];
const FREQ = [['monthly', 'Monthly', 1], ['quarterly', 'Quarterly', 3], ['halfyearly', 'Half-yearly', 6], ['yearly', 'Yearly', 12], ['weekly', 'Weekly', 0]];
const ASSET_CATS = [['it', 'Computers & IT', 'wdv', 40], ['furniture', 'Furniture & fixtures', 'wdv', 10], ['plant', 'Machinery & equipment', 'wdv', 15], ['photo', 'Photography equipment', 'wdv', 15], ['tools', 'Craft tools & workshop machines', 'wdv', 15], ['office', 'Office equipment', 'wdv', 15], ['vehicle', 'Vehicles', 'wdv', 15], ['software', 'Software & licences', 'wdv', 25], ['other', 'Other', 'slm', 20]];
const ASSET_STATUS = [['in_use', 'In use'], ['idle', 'Spare / idle'], ['repair', 'In repair'], ['disposed', 'Disposed']];
const PO_STATUS = [['draft', 'Draft'], ['ordered', 'Ordered'], ['partial', 'Partly received'], ['received', 'Received'], ['cancelled', 'Cancelled']];
const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Outside India', 'Other'];
const DEFAULT_PLATFORMS = [
  { key: 'amazon', name: 'Amazon', code: 'AMZ', idLabel: 'ASIN', commission: 15, fixed: 25, shipBase: 60, shipExtra: 25, collection: 0, gstOnFees: 18, tcs: 0.5, tds: 0.1, returnCost: 80, color: 'c2', on: true },
  { key: 'flipkart', name: 'Flipkart', code: 'FK', idLabel: 'FSN', commission: 14, fixed: 30, shipBase: 65, shipExtra: 25, collection: 1.5, gstOnFees: 18, tcs: 0.5, tds: 0.1, returnCost: 85, color: 'c6', on: true },
  { key: 'meesho', name: 'Meesho', code: 'MSH', idLabel: 'Catalog ID', commission: 0, fixed: 0, shipBase: 70, shipExtra: 30, collection: 0, gstOnFees: 18, tcs: 0.5, tds: 0.1, returnCost: 70, color: 'c4', on: true },
  { key: 'website', name: 'Own website', code: 'WEB', idLabel: 'URL slug', commission: 0, fixed: 0, shipBase: 70, shipExtra: 30, collection: 2, gstOnFees: 18, tcs: 0, tds: 0, returnCost: 100, color: 'c1', on: true },
  { key: 'b2b', name: 'Wholesale / B2B', code: 'B2B', idLabel: 'Item code', commission: 0, fixed: 0, shipBase: 0, shipExtra: 0, collection: 0, gstOnFees: 18, tcs: 0, tds: 0, returnCost: 0, color: 'c7', on: true },
  { key: 'direct', name: 'Direct & custom orders', code: 'DIR', idLabel: 'Item code', commission: 0, fixed: 0, shipBase: 0, shipExtra: 0, collection: 0, gstOnFees: 18, tcs: 0, tds: 0, returnCost: 0, color: 'c3', on: true },
  { key: 'etsy', name: 'Etsy (export)', code: 'ETSY', idLabel: 'Listing ID', commission: 6.5, fixed: 20, shipBase: 650, shipExtra: 250, collection: 3, gstOnFees: 18, tcs: 0, tds: 0, returnCost: 0, color: 'c5', on: false },
];

/* ---------- runtime state ---------- */
let DB = null, USER = null, DL = null, SAMPLE = null, MODE = 'connecting';
const ME = { id: null, name: '', avatar: '', isOwner: false, canEdit: false };
let WRITE_OK = true;
const COLS = ['brands', 'products', 'sales', 'expenses', 'moves', 'campaigns', 'customers', 'reviews', 'members', 'recurring', 'assets', 'payouts', 'suppliers', 'pos', 'deletions', 'employees', 'attendance', 'updates', 'pinvoices', 'orders', 'claims', 'accounts', 'txns', 'offers', 'ratingSnaps', 'candidates', 'hrprofiles', 'payroll', 'hradj', 'files'];
const S = { settings: { platforms: null, roles: null, company: null, audit: null, attendance: null, reports: null, security: null, hr: null, recon: null, purchase: null, listings: null, claims: null }, logDays: {}, loaded: {}, definitive: {} };
COLS.forEach(k => { S[k] = []; });
const ui = {
  view: 'dashboard', brand: 'all', period: '30d', from: '', to: '', viewAs: null, sel: {},
  q: {}, tab: {}, filt: {}, sort: {}, dashTab: null, report: 'sales_platform', navOpen: false, roleEdit: 'manager',
  calc: { productId: '', price: 699, cost: 210, pack: 12, weight: 120, gst: 18, ads: 25, ret: 8, target: 20 },
};
let VER = 0; const memoC = new Map(); const SELKEYS = {};
const memo = (k, fn) => { const c = memoC.get(k); if (c && c.v === VER) return c.r; const r = fn(); memoC.set(k, { v: VER, r }); return r; };
const persistUI = () => { try { localStorage.setItem('tv-erp-ui-' + ME.id, JSON.stringify({ view: ui.view, brand: ui.brand, period: ui.period, report: ui.report })); } catch (e) { } };
{ const h = (location.hash || '').slice(1); if (MOD[h]) ui.view = h; }

/* ---------- in-memory store (preview mode, same API as db) ---------- */
function memDB(seed, onWrite) {
  const docs = new Map(Object.entries(seed || {}).map(([p, d]) => [p, Object.freeze(d)])); const subs = new Set(); let pend = false;
  const snapDoc = (id, d) => ({ id, exists: d !== undefined, data: () => d, metadata: { fromCache: false, hasPendingWrites: false } });
  const colDocs = path => { const pre = path + '/'; const out = []; for (const [p, d] of docs) if (p.startsWith(pre) && !p.slice(pre.length).includes('/')) out.push({ id: p.slice(pre.length), d }); return out; };
  const cmp = (a, op, b) => op === '==' ? a === b : op === '!=' ? a !== b : op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : op === '>=' ? a >= b : op === 'in' ? b.includes(a) : op === 'array-contains' ? (a || []).includes(b) : true;
  const runQ = q => { let a = colDocs(q.path); for (const [f, op, v] of q.w) a = a.filter(x => cmp(x.d[f], op, v)); if (q.o) { const [f, dir] = q.o; a.sort((x, y) => ((x.d[f] > y.d[f]) ? 1 : (x.d[f] < y.d[f]) ? -1 : 0) * (dir === 'desc' ? -1 : 1)); } else a.sort((x, y) => x.id < y.id ? -1 : 1); if (q.l) a = a.slice(0, q.l); return a; };
  const deliver = s => { if (s.kind === 'doc') s.next(snapDoc(s.path.split('/').pop(), docs.get(s.path))); else { const ds = runQ(s.q).map(x => snapDoc(x.id, x.d)); s.next({ docs: ds, size: ds.length, empty: !ds.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }); } };
  const notify = () => { if (onWrite) onWrite(); if (pend) return; pend = true; setTimeout(() => { pend = false; subs.forEach(deliver); }, 0); };
  const clone = o => JSON.parse(JSON.stringify(o));
  const merge = (a, b) => { const o = { ...a }; for (const k in b) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') ? merge(a[k], b[k]) : b[k]; return o; };
  function docRef(path) {
    return {
      id: path.split('/').pop(), path,
      get: async () => snapDoc(path.split('/').pop(), docs.get(path)),
      set: async d => { docs.set(path, Object.freeze(clone(d))); notify(); },
      update: async d => { const c = docs.get(path); if (!c) throw { code: 'invalid_argument', message: 'missing' }; docs.set(path, Object.freeze(merge(c, clone(d)))); notify(); },
      delete: async () => { docs.delete(path); notify(); },
      onSnapshot(next) { const s = { kind: 'doc', path, next }; subs.add(s); setTimeout(() => deliver(s)); return () => subs.delete(s); },
      collection: p => colRef(path + '/' + p),
    };
  }
  function query(path, q) {
    return {
      where: (f, op, v) => query(path, { ...q, w: [...q.w, [f, op, v]] }),
      orderBy: (f, dir = 'asc') => query(path, { ...q, o: [f, dir] }),
      limit: n => query(path, { ...q, l: n }),
      get: async () => { const ds = runQ({ ...q, path }).map(x => snapDoc(x.id, x.d)); return { docs: ds, size: ds.length, empty: !ds.length }; },
      onSnapshot(next) { const s = { kind: 'col', q: { ...q, path }, next }; subs.add(s); setTimeout(() => deliver(s)); return () => subs.delete(s); },
    };
  }
  function colRef(path) { return Object.assign(query(path, { w: [], o: null, l: 0 }), { path, doc: id => docRef(path + '/' + (id || rid())), add: async d => { const r = docRef(path + '/' + rid()); await r.set(d); return r; } }); }
  return { doc: docRef, collection: colRef, _docs: docs };
}

/* ---------- data access ---------- */
const byId = key => memo('byId:' + key, () => Object.fromEntries(S[key].map(x => [x.id, x])));
const memberMap = () => byId('members');
const brandOf = id => byId('brands')[id];
const prodOf = id => byId('products')[id];
const custOf = id => byId('customers')[id];
const supOf = id => byId('suppliers')[id];
function platforms() { return memo('plats', () => { const l = S.settings.platforms && S.settings.platforms.list; const out = Array.isArray(l) && l.length ? l.slice() : DEFAULT_PLATFORMS.slice(); for (const d of DEFAULT_PLATFORMS) if (d.key === 'direct' && !out.some(x => x.key === 'direct')) out.push(d); return out; }); }
const PL = key => platforms().find(p => p.key === key) || { key, name: key || '—', code: '?', commission: 0, fixed: 0, shipBase: 0, shipExtra: 0, collection: 0, gstOnFees: 18, tcs: 0, tds: 0, returnCost: 0, color: 'c8', on: false };
const activePlatforms = () => platforms().filter(p => p.on !== false);
const company = () => Object.assign({ name: 'Triagon Ventures', legalName: '', gstin: '', state: 'Tamil Nadu', address: '' }, S.settings.company || {});
const audit = () => Object.assign({ retention: 'quarter' }, S.settings.audit || {});
const pendingDel = () => memo('pendel', () => { const m = {}; S.deletions.forEach(r => { if (r.status === 'pending') m[r.col + '/' + r.docId] = r; }); return m; });

/* ---------- roles & permissions (the CEO decides; enforced in the app) ---------- */
const mergeRole = MODEL.mergeRole;
function roleDefs() { return memo('roledefs', () => MODEL.roleDefs(S.settings.roles)); }
const roleLabel = r => r === 'ceo' ? 'CEO' : ((roleDefs()[r] || {}).label || 'Staff');
const roleKeys = () => ['ceo', ...Object.keys(roleDefs())];
const realRole = () => { if (MODE === 'preview') return 'ceo'; const m = memberMap()[ME.id]; if (m && m.role && (m.role === 'ceo' || roleDefs()[m.role])) return m.role; return ME.isOwner ? 'ceo' : 'staff'; };
const myRole = () => { const r = realRole(); return (r === 'ceo' && ui.viewAs && (ui.viewAs === 'ceo' || roleDefs()[ui.viewAs])) ? ui.viewAs : r; };
const myMember = () => memberMap()[ME.id] || null;
const isSuspended = () => { const m = myMember(); return MODE !== 'preview' && m && m.status === 'suspended' && !ME.isOwner; };
function perms() {
  return memo('perms', () => {
    const r = myRole(); if (r === 'ceo') return null;
    const def = roleDefs()[r] || roleDefs().staff; const ov = (!ui.viewAs && myMember() && myMember().perms) || {};
    return { modules: { ...def.modules, ...(ov.modules || {}) }, sections: { ...def.sections, ...(ov.sections || {}) }, abilities: { ...def.abilities, ...(ov.abilities || {}) } };
  });
}
function access(mod) { const p = perms(); if (!p) return 'edit'; const a = p.modules[mod] || 'none'; return (mod === 'dashboard' && a === 'none') ? 'view' : a; }
const canView = mod => access(mod) !== 'none';
const canEdit = mod => access(mod) === 'edit' && WRITE_OK;
const allow = ab => { const p = perms(); return !p || !!p.abilities[ab]; };
const secOK = s => { const p = perms(); return !p || p.sections[s] !== false; };
const finSecs = () => FIN_SECTIONS.filter(s => secOK(s[0]));
const canManageTeam = () => realRole() === 'ceo' && !ui.viewAs && (MODE === 'preview' || ME.canEdit) && WRITE_OK;
function myBrands() { const m = myMember(); if (myRole() === 'ceo' || ui.viewAs || !m || !Array.isArray(m.brands) || !m.brands.length) return S.brands; return S.brands.filter(b => m.brands.includes(b.id)); }
const restricted = () => myBrands().length !== S.brands.length;
function brandScope() { return memo('bscope:' + ui.brand, () => { const allowed = myBrands().map(b => b.id); if (ui.brand !== 'all' && allowed.includes(ui.brand)) return new Set([ui.brand]); return new Set(allowed); }); }
const brandAll = () => ui.brand === 'all' || !brandScope().has(ui.brand);
function inBrand(rec) { const b = rec.brandId || (rec.productId && (prodOf(rec.productId) || {}).brandId); if (!b) return brandAll() && !restricted(); return brandScope().has(b); }

/* ---------- periods & quarters (Indian financial year, April–March) ---------- */
const PERIODS = [['month', 'This month'], ['lastmonth', 'Last month'], ['30d', 'Last 30 days'], ['quarter', 'This quarter'], ['fy', 'This financial year'], ['lastfy', 'Last financial year'], ['all', 'All time'], ['custom', 'Custom range']];
const qStart = d => { const x = parseD(d); const m = x.getMonth(); const fm = (m - 3 + 12) % 12; return ymd(new Date(x.getFullYear(), m - (fm % 3), 1)); };
const qLabel = d => { const s = parseD(qStart(d)); const q = Math.floor(((s.getMonth() - 3 + 12) % 12) / 3) + 1; const fy = s.getMonth() >= 3 ? s.getFullYear() : s.getFullYear() - 1; return `Q${q} FY ${fy}–${String(fy + 1).slice(2)}`; };
function periodRange(key = ui.period) {
  const t = TODAY(); const d = parseD(t); const y = d.getFullYear(), m = d.getMonth(); const fy = m >= 3 ? y : y - 1;
  switch (key) {
    case 'month': return [ymd(new Date(y, m, 1)), t];
    case 'lastmonth': return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
    case '30d': return [addDays(t, -29), t];
    case 'quarter': return [qStart(t), t];
    case 'fy': return [fy + '-04-01', t];
    case 'lastfy': return [(fy - 1) + '-04-01', fy + '-03-31'];
    case 'custom': { const a = ui.from || addDays(t, -29), b = ui.to || t; return a <= b ? [a, b] : [b, a]; }
    default: return ['2000-01-01', '2999-12-31'];
  }
}
function prevRange() { if (ui.period === 'all') return null; const [a, b] = periodRange(); const len = daysBetween(a, b) + 1; return [addDays(a, -len), addDays(a, -1)]; }
const inRange = (d, r) => !!d && d >= r[0] && d <= r[1];
function rangeLabel(r = periodRange()) { if (ui.period === 'all') return 'All time'; const [a, b] = r; const sameY = a.slice(0, 4) === b.slice(0, 4); return (sameY ? fmtDs(a) : fmtD(a)) + ' – ' + fmtD(b); }
const fyLabel = d => { const x = parseD(d); const y = x.getMonth() >= 3 ? x.getFullYear() : x.getFullYear() - 1; return 'FY ' + y + '–' + String(y + 1).slice(2); };
const RETENTION = [['quarter', 'Current quarter only', 1], ['two', 'Current and previous quarter', 2], ['year', 'Last four quarters', 4]];
const keepQuarters = () => (RETENTION.find(r => r[0] === audit().retention) || RETENTION[0])[2];
const logCutoff = () => addMonths(qStart(TODAY()), -3 * (keepQuarters() - 1));
const nextClear = () => addMonths(qStart(TODAY()), 3);

/* ---------- unit economics ---------- */
function unitEcon({ price, gst, cost, pack, weight, plat, ads = 0, ret = 0 }) {
  price = N(price); gst = N(gst); cost = N(cost); pack = N(pack); weight = N(weight); ads = N(ads); ret = N(ret);
  const p = plat || PL('');
  const taxable = price / (1 + gst / 100), outGST = price - taxable;
  const commission = price * N(p.commission) / 100, fixed = N(p.fixed) + N(p.otherFee);
  const slabs = Math.max(0, Math.ceil(Math.max(weight, 1) / 500) - 1);
  const shipping = N(p.shipBase) + slabs * N(p.shipExtra);
  const collection = price * N(p.collection) / 100;
  const fees = commission + fixed + shipping + collection;
  const gstFeeRate = N(p.gstOnFees === undefined ? 18 : p.gstOnFees) / 100;
  const gstOnFees = fees * gstFeeRate;
  const tcs = taxable * N(p.tcs) / 100, tds = taxable * N(p.tds) / 100;
  const settlement = price - fees - gstOnFees - tcs - tds;
  const returnsLoss = ret / 100 * (N(p.returnCost) + shipping);
  const profit = taxable - cost - fees - pack - ads - returnsLoss;
  return { price, taxable, outGST, commission, fixed, shipping, collection, fees, gstOnFees, gstFeeRate, tcs, tds, settlement, cost, pack, ads, returnsLoss, returnCost: N(p.returnCost), profit, margin: ratio(profit, price) };
}
function solvePrice(args, targetMargin = 0) {
  const f = p => { const e = unitEcon({ ...args, price: p }); return e.profit - targetMargin * p; };
  let lo = 0, hi = 200000; if (f(hi) < 0) return null;
  for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (f(mid) >= 0) hi = mid; else lo = mid; }
  return hi;
}
// a listing can override the platform's fees for that one SKU
function effPlat(plat, prod) {
  const f = ((((prod || {}).listings || {})[plat.key] || {}).fees) || {}; const has = k => f[k] !== undefined && f[k] !== null && f[k] !== ''; if (!Object.keys(f).some(has)) return plat;
  const o = { ...plat, custom: true }; if (has('commission')) o.commission = N(f.commission); if (has('fixed')) o.fixed = N(f.fixed); if (has('ship')) { o.shipBase = N(f.ship); o.shipExtra = 0; } if (has('collection')) o.collection = N(f.collection); if (has('other')) o.otherFee = N(f.other); if (has('returnCost')) o.returnCost = N(f.returnCost); return o;
}
function saleSnapshot(s, prod, plat) {
  const p = prod || prodOf(s.productId) || {};
  const e = unitEcon({ price: s.unitPrice, gst: p.gstRate ?? 18, cost: p.costPrice, pack: p.packagingCost, weight: p.weight, plat: effPlat(plat || PL(s.platform), p) });
  return { taxable: e.taxable, outGST: e.outGST, cost: e.cost, pack: e.pack, fees: e.fees, gstOnFees: e.gstOnFees, gstFeeRate: e.gstFeeRate, shipping: e.shipping, returnCost: e.returnCost, tcs: e.tcs, tds: e.tds, gstRate: N(p.gstRate ?? 18) };
}
function saleFin(s) {
  const q = N(s.qty), price = N(s.unitPrice);
  const c = s.calc || saleSnapshot(s);
  const r = { units: 0, gross: 0, returns: 0, cancelled: 0, taxable: 0, outGST: 0, cogs: 0, fees: 0, gstOnFees: 0, pack: 0, tcs: 0, tds: 0, settlement: 0, profit: 0, retUnits: 0, gstRate: N(c.gstRate) };
  if (s.status === 'cancelled') { r.cancelled = price * q; return r; }
  r.gross = price * q; r.pack = N(c.pack) * q; const waste = N(c.cost) * N(s.wasteQty);
  if (s.status === 'returned') {
    r.returns = price * q; r.retUnits = q;
    r.fees = (N(c.shipping) + N(c.returnCost)) * q; r.gstOnFees = r.fees * N(c.gstFeeRate);
    r.cogs = (isRestocked(s) ? 0 : N(c.cost) * q) + waste;
    r.settlement = -(r.fees + r.gstOnFees); r.profit = -r.cogs - r.fees - r.pack; return r;
  }
  r.units = q; r.taxable = N(c.taxable) * q; r.outGST = N(c.outGST) * q; r.cogs = N(c.cost) * q + waste;
  if (s.actualFees !== undefined && s.actualFees !== null && s.actualFees !== '') { r.fees = N(s.actualFees); r.gstOnFees = r.fees * N(c.gstFeeRate); }
  else { r.fees = N(c.fees) * q; r.gstOnFees = N(c.gstOnFees) * q; }
  r.tcs = N(c.tcs) * q; r.tds = N(c.tds) * q;
  r.settlement = r.gross - r.fees - r.gstOnFees - r.tcs - r.tds;
  r.profit = r.taxable - r.cogs - r.fees - r.pack; return r;
}
const FIN_KEYS = ['units', 'gross', 'returns', 'cancelled', 'taxable', 'outGST', 'cogs', 'fees', 'gstOnFees', 'pack', 'tcs', 'tds', 'settlement', 'profit', 'retUnits'];
function finSum(list) { const t = Object.fromEntries(FIN_KEYS.map(k => [k, 0])); t.entries = list.length; for (const s of list) { const f = saleFin(s); for (const k of FIN_KEYS) t[k] += f[k]; } return t; }
const salesIn = (r, extra) => S.sales.filter(s => inRange(s.date, r) && inBrand(s) && (!extra || extra(s)));
const expensesIn = r => S.expenses.filter(e => inRange(e.date, r) && inBrand(e));

/* ---------- assets & depreciation ---------- */
const assetCat = k => ASSET_CATS.find(c => c[0] === k) || ASSET_CATS[ASSET_CATS.length - 1];
function accDep(a, at) {
  const cost = N(a.cost), salv = Math.min(N(a.salvage), cost); if (!a.purchaseDate || at < a.purchaseDate) return 0;
  const end = (a.status === 'disposed' && a.disposedOn && a.disposedOn < at) ? a.disposedOn : at;
  const yrs = (daysBetween(a.purchaseDate, end) + 1) / 365;
  if (a.method === 'slm') { const life = N(a.life) || 5; return Math.min(cost - salv, (cost - salv) / life * yrs); }
  const r = clamp(N(a.rate), 0, 100) / 100; return cost - Math.max(salv, cost * Math.pow(1 - r, yrs));
}
const bookValue = (a, at = TODAY()) => (a.status === 'disposed' && a.disposedOn && a.disposedOn <= at) ? 0 : N(a.cost) - accDep(a, at);
const depIn = (a, r) => Math.max(0, accDep(a, r[1] > TODAY() ? TODAY() : r[1]) - accDep(a, addDays(r[0], -1)));
const assetsIn = () => S.assets.filter(inBrand);

/* ---------- recurring expenses ---------- */
const freqOf = k => FREQ.find(f => f[0] === k) || FREQ[0];
function dueDates(r, from, to, cap = 60) {
  const out = []; if (!r.startDate) return out; const end = r.endDate && r.endDate < to ? r.endDate : to;
  if (r.frequency === 'weekly') { let d = r.startDate; let i = 0; while (d <= end && out.length < cap && i++ < 2000) { if (d >= from) out.push(d); d = addDays(d, 7); } return out; }
  const step = freqOf(r.frequency)[2]; const s = parseD(r.startDate); const day = clamp(N(r.day) || s.getDate(), 1, 31);
  for (let i = 0; i < 600 && out.length < cap; i++) { const y = s.getFullYear(), m = s.getMonth() + i * step; const last = new Date(y, m + 1, 0).getDate(); const d = ymd(new Date(y, m, Math.min(day, last))); if (d > end) break; if (d >= from && d >= r.startDate) out.push(d); }
  return out;
}
const monthlyEquiv = r => { const f = freqOf(r.frequency); return f[2] ? N(r.amount) / f[2] : N(r.amount) * 52 / 12; };
const nextDue = r => { const after = r.postedThrough ? addDays(r.postedThrough, 1) : r.startDate; return dueDates(r, after || TODAY(), addDays(TODAY(), 800), 1)[0] || null; };
// unpaid due dates up to and including today (what "Mark paid" and auto-posting settle)
const pendingDates = r => r.active === false ? [] : dueDates(r, r.postedThrough ? addDays(r.postedThrough, 1) : r.startDate, TODAY(), 24);
// overdue means the due date has passed; a bill due today is "due today", not overdue
const overdueDates = r => pendingDates(r).filter(d => d < TODAY());

/* ---------- profit & loss ---------- */
function pnl(r) {
  const t = finSum(salesIn(r)); const ex = expensesIn(r);
  const exByCat = groupBy(ex, e => e.category || 'Other');
  const expenses = sum(ex, e => e.amount), expGST = sum(ex, e => e.gst);
  const dep = sum(assetsIn(), a => depIn(a, r));
  const gp = t.taxable - t.cogs; const contribution = gp - t.fees - t.pack; const net = contribution - expenses - dep;
  return { ...t, expenses, expGST, exByCat, dep, gp, contribution, net, netSales: t.gross - t.returns, gstPayable: t.outGST - t.gstOnFees - expGST, returnRate: ratio(t.retUnits, t.units + t.retUnits) };
}

/* ---------- inventory maths ---------- */
const isRestocked = s => s.retCondition ? s.retCondition === 'good' : s.restocked !== false;
// wasteQty: extra stock used when cutting a custom size (leather offcuts); it is never restocked
const saleStockOut = s => { const q = N(s.qty); if (s.status === 'cancelled') return 0; const w = N(s.wasteQty); if (s.status === 'returned') return (isRestocked(s) ? 0 : q) + w; return q + w; };
const rq3 = n => Math.round(N(n) * 1000) / 1000;
function stockMap() { return memo('stock', () => { const m = {}; for (const p of S.products) m[p.id] = N(p.openingStock); for (const mv of S.moves) if (mv.productId in m) m[mv.productId] += N(mv.qty); for (const s of S.sales) if (s.productId in m) m[s.productId] -= saleStockOut(s); for (const k in m) m[k] = rq3(m[k]); return m; }); }
// damaged / rejected stock, kept apart from sellable stock
function badMap() { return memo('bad', () => { const m = {}; for (const mv of S.moves) if (N(mv.badQty)) m[mv.productId] = (m[mv.productId] || 0) + N(mv.badQty); for (const s of S.sales) if (s.status === 'returned' && s.retCondition === 'bad') m[s.productId] = (m[s.productId] || 0) + N(s.retQty || s.qty); for (const k in m) m[k] = rq3(m[k]); return m; }); }
function sold30() { return memo('sold30', () => { const r = [addDays(TODAY(), -29), TODAY()]; const m = {}; for (const s of S.sales) if (inRange(s.date, r) && s.status !== 'cancelled' && s.status !== 'returned') m[s.productId] = (m[s.productId] || 0) + N(s.qty); return m; }); }
const lineFactor = l => N(l.factor) || 1;
function onOrder() { return memo('onorder', () => { const m = {}; for (const po of S.pos) if (po.status === 'ordered' || po.status === 'partial') for (const l of (po.lines || [])) m[l.productId] = rq3((m[l.productId] || 0) + Math.max(0, N(l.qty) - N(l.received) - N(l.rejected)) * lineFactor(l)); return m; }); }
function stockState(p) {
  const on = stockMap()[p.id] || 0, rl = N(p.reorderLevel ?? 10), v = sold30()[p.id] || 0; const cover = on <= 0 ? 0 : v ? on / (v / 30) : Infinity;
  const st = on <= 0 ? 'out' : on <= rl ? 'low' : cover > 120 && on > rl * 3 ? 'over' : 'ok';
  return { on, rl, v, cover, st, ord: onOrder()[p.id] || 0 };
}
const STOCK_PILL = { out: ['Out of stock', 't-bad'], low: ['Low stock', 't-warn'], over: ['Overstock', 't-info'], ok: ['Healthy', 't-good'] };
const poValue = po => sum(po.lines || [], l => N(l.qty) * N(l.cost));
const poGST = po => sum(po.lines || [], l => N(l.qty) * N(l.cost) * N(l.gstRate) / 100);
const poReceivedPct = po => ratio(sum(po.lines || [], l => Math.min(N(l.received) + N(l.rejected), N(l.qty))), sum(po.lines || [], l => N(l.qty)));

/* ---------- catalogue content score ---------- */
function contentScore(p) {
  const bullets = String(p.bullets || '').split('\n').filter(x => x.trim()).length;
  const kw = String(p.keywords || '').split(',').filter(x => x.trim()).length;
  const checks = [
    ['Title 60+ characters', String(p.title || '').trim().length >= 60, 15],
    ['3+ bullet points', bullets >= 3, 20],
    ['Description 200+ characters', String(p.description || '').trim().length >= 200, 20],
    ['5+ search keywords', kw >= 5, 15],
    ['5+ images ready', N(p.images) >= 5, 20],
    ['HSN code', !!String(p.hsn || '').trim(), 10],
  ];
  return { score: sum(checks, c => c[1] ? c[2] : 0), checks };
}
const liveCount = p => activePlatforms().filter(pl => (p.listings || {})[pl.key]?.status === 'live').length;

/* ---------- marketing maths ---------- */
function campStats(list) { const spend = sum(list, c => c.spend), rev = sum(list, c => c.revenue), imp = sum(list, c => c.impressions), clk = sum(list, c => c.clicks), ord = sum(list, c => c.orders), budget = sum(list, c => c.budget); return { spend, rev, imp, clk, ord, budget, roas: ratio(rev, spend), acos: ratio(spend, rev), ctr: ratio(clk, imp), cpc: ratio(spend, clk), cvr: ratio(ord, clk) }; }
const campsIn = r => S.campaigns.filter(c => inBrand(c) && (c.startDate || '0000') <= r[1] && (c.endDate || '9999') >= r[0]);
const roasTone = r => r >= 4 ? 't-good' : r >= 2 ? 't-warn' : 't-bad';
/* =====================================================================
   Infra: writes with change tracking, delete approvals, activity log,
   people, rendering, shell, components, drawer and forms
   ===================================================================== */
let WRITE_KNOWN = false;
const QCH = new Map();
function chain(path, fn) { const prev = QCH.get(path) || Promise.resolve(); const p = prev.then(fn, fn); QCH.set(path, p.catch(() => { })); return p; }
const ERRMSG = {
  quota_exceeded: 'Storage is full. Remove old records or the demo data, then try again.',
  invalid_argument: 'That change wasn’t allowed. Check your role’s permissions with the CEO.',
  resource_exhausted: 'Too many changes at once. Wait a few seconds and try again.',
  revoked: 'Your access to this page changed. Reload to continue.',
  unavailable: 'The data file isn’t ready yet. Wait a moment and try again.',
};
function handleErr(e) {
  console.warn(e); const code = e && e.code; if (e && e.userMsg && code !== 'unavailable') { toast(e.userMsg, 'bad'); return; }
  if (code === 'invalid_argument' && !WRITE_KNOWN && MODE === 'live') { WRITE_OK = false; schedule(); }
  toast(ERRMSG[code] || (e && e.userMsg) || 'That didn’t save. Try again in a moment.', 'bad');
}
async function dbWrite(op, path, data) {
  if (!DB) throw { code: 'unavailable' };
  const ref = DB.doc(path);
  const run = () => op === 'set' ? ref.set(data) : op === 'update' ? ref.update(data) : ref.delete();
  return chain(path, async () => {
    for (let i = 0; ; i++) {
      try { return await run(); }
      catch (e) { const c = e && e.code; if ((c === 'unavailable' && i < 1) || (c === 'resource_exhausted' && i < 4)) { await sleep((c === 'resource_exhausted' ? 1200 * (i + 1) : 500) + Math.random() * 400); continue; } throw e; }
    }
  });
}
const clean = o => JSON.parse(JSON.stringify(o));
const newId = col => DB.collection(col).doc().id;
const base = rec => { if (!rec) return {}; const { id, ...rest } = rec; return { ...rest }; };

/* ---------- field-level change tracking for the activity log ---------- */
const META = new Set(['id', 'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'calc', 'demo', 'postedThrough']);
const FL = { name: 'Name', sku: 'SKU', brandId: 'Brand', productId: 'Product', supplierId: 'Supplier', customerId: 'Customer', sellingPrice: 'Selling price', mrp: 'MRP', costPrice: 'Cost price', packagingCost: 'Packaging', gstRate: 'GST rate', hsn: 'HSN', weight: 'Weight', status: 'Status', qty: 'Quantity', unitPrice: 'Unit price', amount: 'Amount', gst: 'GST', date: 'Date', platform: 'Platform', category: 'Category', variant: 'Variant', openingStock: 'Opening stock', reorderLevel: 'Reorder level', location: 'Location', title: 'Title', bullets: 'Bullets', description: 'Description', keywords: 'Keywords', images: 'Images', listings: 'Listings', code: 'Code', color: 'Colour', tagline: 'Tagline', managerId: 'Brand lead', tmStatus: 'Trademark status', budget: 'Budget', spend: 'Spend', revenue: 'Revenue', rating: 'Rating', response: 'Reply', role: 'Role', brands: 'Brands', perms: 'Permission overrides', cost: 'Cost', assignedTo: 'Assigned to', frequency: 'Frequency', autoPost: 'Auto-post', active: 'Active', lines: 'Order lines', orderRef: 'Order ref', actualFees: 'Actual fees', restocked: 'Restocked', vendor: 'Vendor', note: 'Note', notes: 'Notes', phone: 'Phone', email: 'Email', city: 'City', state: 'State', tags: 'Tags' };
const label = k => FL[k] || k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
function fmtVal(k, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (k === 'brandId') return brandName(v); if (k === 'productId') return (prodOf(v) || {}).sku || 'product'; if (k === 'supplierId') return (supOf(v) || {}).name || 'supplier';
  if (k === 'customerId') return (custOf(v) || {}).name || 'customer'; if (k === 'assignedTo' || k === 'managerId') return personName(v); if (k === 'platform') return PL(v).name; if (k === 'role') return roleLabel(v);
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'; if (Array.isArray(v)) return v.length + ' item' + (v.length === 1 ? '' : 's'); if (typeof v === 'object') return 'changed';
  const s = String(v).replace(/\s+/g, ' '); return s.length > 40 ? s.slice(0, 38) + '…' : s;
}
function diffText(prev, next) {
  if (!prev) return ''; const ch = []; const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    if (META.has(k)) continue; const a = prev[k], b = next[k];
    const empty = x => x === undefined || x === null || x === '' || (Array.isArray(x) && !x.length);
    if (empty(a) && empty(b)) continue; if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue;
    ch.push((a && b && typeof a === 'object' && !Array.isArray(a)) ? `${label(k)} changed` : `${label(k)}: ${fmtVal(k, a)} → ${fmtVal(k, b)}`);
  }
  return ch.slice(0, 8).join('; ') + (ch.length > 8 ? `; +${ch.length - 8} more` : '');
}
async function saveDoc(col, id, body, log) {
  const isNew = !id; id = id || newId(col);
  const prev = byId(col)[id];
  const doc = clean({ ...body, createdAt: (prev && prev.createdAt) || nowISO(), createdBy: (prev && prev.createdBy) || ME.id || null, updatedAt: nowISO(), updatedBy: ME.id || null, ...(prev && prev.demo ? { demo: true } : {}) });
  const d = prev ? diffText(base(prev), doc) : '';
  if (prev && !d) return id;
  await dbWrite('set', col + '/' + id, doc);
  if (log) addLog(isNew ? 'create' : 'update', log[0], log[1], d);
  return id;
}

/* ---------- deletes go through approval ---------- */
const CASCADE = { pos: id => S.moves.filter(m => m.poId === id).map(m => ({ col: 'moves', id: m.id })) };
const cascadeOf = (col, id) => (CASCADE[col] ? CASCADE[col](id) : []).filter(x => byId(x.col)[x.id]).map(x => ({ ...x, snapshot: base(byId(x.col)[x.id]) }));
async function deleteRecord(col, id, mod, lbl, reason) {
  const rec = byId(col)[id]; if (!rec) return false;
  const req = { col, docId: id, module: mod, label: lbl, snapshot: base(rec), reason: reason || '', requestedBy: ME.id, requestedAt: nowISO() };
  if (allow('approveDelete')) {
    const cas = cascadeOf(col, id);
    await dbBatch([{ op: 'delete', path: col + '/' + id }, ...cas.map(x => ({ op: 'delete', path: x.col + '/' + x.id })), { op: 'set', path: 'deletions/' + newId('deletions'), data: clean({ ...req, cascade: cas, status: 'approved', direct: true, decidedBy: ME.id, decidedAt: nowISO() }) }]);
    addLog('delete', mod, lbl, reason ? 'Reason: ' + reason : 'Moved to the recycle bin'); return 'deleted';
  }
  if (pendingDel()[col + '/' + id]) { toast('A delete request for this is already waiting for approval.'); return false; }
  await dbWrite('set', 'deletions/' + newId('deletions'), clean({ ...req, status: 'pending' }));
  addLog('request', mod, 'Asked to delete ' + lbl, reason ? 'Reason: ' + reason : ''); return 'requested';
}
async function decideDeletion(reqId, approve) {
  const r = S.deletions.find(x => x.id === reqId); if (!r || r.status !== 'pending' || !allow('approveDelete')) return;
  const cas = approve ? cascadeOf(r.col, r.docId) : [];
  await dbBatch([...(approve && byId(r.col)[r.docId] ? [{ op: 'delete', path: r.col + '/' + r.docId }] : []), ...cas.map(x => ({ op: 'delete', path: x.col + '/' + x.id })), { op: 'set', path: 'deletions/' + reqId, data: clean({ ...base(r), ...(cas.length ? { cascade: cas } : {}), status: approve ? 'approved' : 'rejected', decidedBy: ME.id, decidedAt: nowISO() }) }]);
  addLog(approve ? 'approve' : 'reject', r.module, `${approve ? 'Approved' : 'Rejected'} deleting ${r.label}`, `Requested by ${personName(r.requestedBy)}${r.reason ? ' · ' + r.reason : ''}`);
  toast(approve ? 'Deleted. It’s in the recycle bin if you need it back.' : 'Request rejected. The record stays.');
}
async function restoreDeletion(reqId) {
  const r = S.deletions.find(x => x.id === reqId); if (!r || r.status !== 'approved' || !allow('approveDelete')) return;
  const ops = []; if (!byId(r.col)[r.docId]) ops.push({ op: 'set', path: r.col + '/' + r.docId, data: clean({ ...r.snapshot, updatedAt: nowISO(), updatedBy: ME.id }) });
  for (const x of (r.cascade || [])) if (!byId(x.col)[x.id]) ops.push({ op: 'set', path: x.col + '/' + x.id, data: clean(x.snapshot) });
  ops.push({ op: 'set', path: 'deletions/' + reqId, data: clean({ ...base(r), status: 'restored', restoredBy: ME.id, restoredAt: nowISO() }) }); await dbBatch(ops);
  addLog('restore', r.module, 'Restored ' + r.label, ''); toast('Restored');
}

/* ---------- activity log: one doc per person per day, only that person writes it ---------- */
let logBuf = [], logT = null; const myLog = { day: '', entries: [] };
function addLog(a, m, s, d) { if (!ME.id || !DB) return; const e = { t: nowISO(), u: ME.id, a, m, s: String(s || '').slice(0, 200) }; if (d) e.d = String(d).slice(0, 600); logBuf.push(e); clearTimeout(logT); logT = setTimeout(flushLog, 500); }
async function flushLog() {
  if (!logBuf.length) return; const day = TODAY(); const path = 'logs/' + ME.id + '/days/' + day; const take = logBuf.splice(0);
  try {
    await chain(path, async () => {
      const sd = (S.logDays[ME.id] || []).find(d => d.id === day); const fromSnap = (sd && sd.entries) || [];
      const b = (myLog.day === day && myLog.entries.length >= fromSnap.length) ? myLog.entries : fromSnap;
      let entries = b.concat(take); if (entries.length > 900) entries = entries.slice(-900);
      await DB.doc(path).set({ date: day, uid: ME.id, entries });
      myLog.day = day; myLog.entries = entries;
    });
  } catch (e) { console.warn('activity log write failed', e); }
}
const logSubs = new Map();
function syncLogSubs() {
  if (!DB) return; const ids = new Set(S.members.map(m => m.id)); ids.add('kiosk'); if (ME.id) ids.add(ME.id);
  const lim = keepQuarters() * 95;
  for (const id of ids) {
    if (logSubs.has(id) || logSubs.size >= 36) continue;
    try { const un = DB.collection('logs/' + id + '/days').orderBy('date', 'desc').limit(lim).onSnapshot(sn => { S.logDays[id] = sn.docs.map(d => Object.assign({ id: d.id }, d.data())); bump(); }, e => console.warn('log subscription', e)); logSubs.set(id, un); } catch (e) { console.warn(e); }
  }
}
function allLogs() { return memo('logs', () => { const cut = logCutoff(); const out = []; for (const id in S.logDays) for (const d of S.logDays[id]) if (d.date >= cut) for (const e of (d.entries || [])) out.push(e); return out.sort((a, b) => a.t < b.t ? 1 : a.t > b.t ? -1 : 0); }); }
let purged = false;
async function purgeOld() {
  if (purged || !DB || !ME.id || !S.definitive.members || !S.definitive.deletions) return; purged = true;
  const cut = logCutoff(); const ids = new Set([ME.id]); if (ME.isOwner) { S.members.forEach(m => ids.add(m.id)); Object.keys(S.logDays).forEach(i => ids.add(i)); }
  let days = 0, reqs = 0;
  for (const id of ids) { try { const sn = await DB.collection('logs/' + id + '/days').where('date', '<', cut).get(); for (const d of sn.docs) { await dbWrite('delete', 'logs/' + id + '/days/' + d.id); days++; } } catch (e) { console.warn('log purge', e); } }
  if (allow('approveDelete') && WRITE_OK) for (const r of S.deletions) if (r.status !== 'pending' && String(r.decidedAt || r.restoredAt || r.requestedAt || '').slice(0, 10) < cut) { try { await dbWrite('delete', 'deletions/' + r.id); reqs++; } catch (e) { } }
  if (days || reqs) addLog('purge', 'logs', `Quarterly clean-up removed records from before ${fmtD(cut)}`, `${days} day log${days === 1 ? '' : 's'}, ${reqs} closed delete request${reqs === 1 ? '' : 's'}`);
}

/* ---------- people ---------- */
const PROF = {};
function refreshProfiles() { }
function personName(id) { if (!id) return 'Someone'; if (id === 'kiosk') return 'Check-in kiosk'; const m = memberMap()[id]; if (m && m.name) return m.name; if (id === ME.id && ME.name) return ME.name; const e = byId('employees')[id]; if (e) return e.name; return 'Former member'; }
function personHTML(id, you = true) { const n = personName(id); return `<span class="person">${avHTML(id, n)}<span>${esc(n)}</span>${you && id === ME.id ? '<span class="you">You</span>' : ''}</span>`; }

/* ---------- render loop ---------- */
let rq = false, lastSide = '', lastTop = '';
function bump() { VER++; schedule(); }
function schedule() { if (rq) return; rq = true; let done = false; const go = () => { if (done) return; done = true; rq = false; render(); }; requestAnimationFrame(go); setTimeout(go, 150); }
const V = {};
function render() {
  try {
    renderSide(); renderTop();
    const v = $('#view'); if (MODE !== 'live') return;
    let html;
    if (!COLS.every(k => S.loaded[k])) html = '<div class="loading"><div class="spin"></div>Loading your records…</div>';
    else if (isSuspended()) html = `<div class="empty"><h3>Your access is paused</h3><p>The CEO has suspended your account on this ERP. Ask them to reactivate it in Users & permissions.</p></div>`;
    else { if (!canView(ui.view)) ui.view = 'dashboard'; html = banners() + V[ui.view](); }
    const ae = document.activeElement; const fid = ae && ae.id && v.contains(ae) ? ae.id : null; let sel = null;
    try { if (fid && typeof ae.selectionStart === 'number') sel = [ae.selectionStart, ae.selectionEnd]; } catch (e) { }
    v.innerHTML = html; postRender();
    if (fid) { const n = document.getElementById(fid); if (n) { n.focus({ preventScroll: true }); if (sel) try { n.setSelectionRange(sel[0], sel[1]); } catch (e) { } } }
    refreshProfiles();
  } catch (e) {
    console.error(e);
    $('#view').innerHTML = `<div class="banner warn">This section hit an error (${esc(e.message)}). Pick another section from the menu, or reload the page.</div>`;
  }
}
function banners() {
  const b = [];
  if (ui.viewAs) b.push(`<div class="banner acc"><span>You’re previewing the ERP as <b>${esc(roleLabel(ui.viewAs))}</b>. Menus, columns and buttons match that role’s permissions.</span><span class="sp"></span><button class="btn sm" data-act="viewas:">Back to CEO view</button></div>`);
  const demo = COLS.reduce((t, k) => t + S[k].filter(x => x.demo).length, 0);
  if (demo && realRole() === 'ceo' && !ui.viewAs) b.push(`<div class="banner acc"><span><b>${demo} demo records</b> are loaded so you can explore. Remove them before you enter real data.</span><span class="sp"></span><button class="btn sm" data-act="democlear">Remove demo data</button></div>`);
  return b.join('');
}

/* ---------- shell ---------- */
const logoHTML = () => `<div class="logo"><img class="lmark" src="assets/mark.png" alt=""><div class="wm"><img src="assets/wordmark-triagon.png" alt="Triagon"><small>VENTURES</small></div></div>`;
function navBadges() {
  const b = {}; if (!COLS.every(k => S.loaded[k])) return b;
  const ps = S.products.filter(p => inBrand(p) && p.status !== 'archived');
  const low = ps.filter(p => ['low', 'out'].includes(stockState(p).st)).length; if (low) b.inventory = low;
  const nr = S.reviews.filter(r => inBrand(r) && (r.status || 'new') === 'new').length; if (nr) b.customers = nr;
  const pend = S.deletions.filter(r => r.status === 'pending' && (allow('approveDelete') || r.requestedBy === ME.id)).length; if (pend) b.approvals = pend;
  if (canView('finance') && secOK('recurring')) { const od = S.recurring.filter(r => inBrand(r) && r.active !== false && !r.autoPost && overdueDates(r).length).length; if (od) b.finance = od; }
  return b;
}
function renderSide() {
  const groups = groupBy(MODULES.filter(m => canView(m.k)), m => m.g); const badges = navBadges();
  const html = `${logoHTML()}
  <nav class="nav">${MODE !== 'live' ? '' : Object.entries(groups).map(([g, ms]) => `<div class="nav-g"><h6>${esc(g)}</h6>${ms.map(m => `<button class="nav-i" data-act="go:${m.k}"${ui.view === m.k ? ' aria-current="page"' : ''}>${icon(m.i)}<span>${esc(m.l)}</span>${badges[m.k] ? `<span class="badge">${badges[m.k]}</span>` : ''}</button>`).join('')}</div>`).join('')}</nav>
  <div class="side-foot">${MODE !== 'live' ? '' : `<div class="me">${personHTML(ME.id, false)}${btn('', 'myprofile', { ghost: true, cls: 'icon', i: 'key', title: 'My profile and password' })}${btn('', 'signout', { ghost: true, cls: 'icon', i: 'logout', title: 'Sign out' })}</div><div class="meta"><span>${esc(roleLabel(myRole()))}</span><span class="save-st" id="saveState"></span></div>`}</div>`;
  if (html !== lastSide) { $('#side').innerHTML = html; lastSide = html; }
  $('#side').classList.toggle('open', ui.navOpen); $('#navScrim').hidden = !ui.navOpen;
}
function renderTop() {
  if (MODE !== 'live') { if (lastTop !== 'c') { $('#top').innerHTML = ''; lastTop = 'c'; } return; }
  const bs = myBrands(); const r = periodRange();
  const html = `<button class="btn icon ghost menu-btn" data-act="nav" aria-label="Open menu">${icon('menu')}</button><span class="mob-brand"><img src="assets/mark.png" alt="" style="width:24px;height:auto"><b style="font:600 14px var(--f-display);letter-spacing:.22em">TRIAGON</b></span>
  <div class="where"><span class="muted">Showing</span><b class="tnum">${esc(rangeLabel(r))}</b>${!['all', 'lastfy'].includes(ui.period) ? `<span class="muted">· ${esc(fyLabel(r[1]))}</span>` : ''}</div>
  <div class="filters">${topCheckBtn()}
    <label class="sr" for="f-brand">Brand</label><select class="inp" id="f-brand" data-ch="brand"><option value="all">${restricted() ? 'All my brands' : 'All brands'}</option>${bs.map(b => `<option value="${esc(b.id)}"${ui.brand === b.id ? ' selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
    <label class="sr" for="f-period">Period</label><select class="inp" id="f-period" data-ch="period">${PERIODS.map(([k, l]) => `<option value="${k}"${ui.period === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
    ${ui.period === 'custom' ? `<input class="inp" type="date" id="f-from" data-ch="from" value="${r[0]}" aria-label="From date"><input class="inp" type="date" id="f-to" data-ch="to" value="${r[1]}" aria-label="To date">` : ''}
    ${realRole() === 'ceo' ? `<label class="sr" for="f-as">View as</label><select class="inp" id="f-as" data-ch="viewas" title="Preview another role"><option value="">View as CEO</option>${Object.entries(roleDefs()).map(([k, d]) => `<option value="${esc(k)}"${ui.viewAs === k ? ' selected' : ''}>View as ${esc(d.label)}</option>`).join('')}</select>` : ''}
  </div>`;
  if (html !== lastTop) { $('#top').innerHTML = html; lastTop = html; }
}

/* ---------- components ---------- */
const pill = (t, tone = 't-neu', nd) => `<span class="pill ${tone}${nd ? ' nd' : ''}">${esc(t)}</span>`;
const deltaOf = (cur, prev) => (prev === null || prev === undefined) ? undefined : (!prev ? (cur ? Infinity : 0) : (cur - prev) / Math.abs(prev));
function deltaHTML(d, inv) { if (d === undefined) return ''; if (!Number.isFinite(d)) return '<span class="delta flat">new</span>'; const up = d > 0.0005, down = d < -0.0005; const good = inv ? down : up; const cls = !up && !down ? 'flat' : good ? 'up' : 'down'; return `<span class="delta ${cls}" title="Change vs the previous period of the same length">${up ? '▲' : down ? '▼' : ''}${(Math.abs(d) * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0)}%</span>`; }
function kpis(items, cls = '') { return `<section class="kpis ${cls}">${items.map(k => `<div class="kpi"><div class="l" title="${esc(k.l)}">${esc(k.l)}</div><div class="v${k.tone ? ' ' + k.tone : ''}" title="${esc(k.title || '')}">${k.v}</div><div class="s">${deltaHTML(k.d, k.inv)}${k.s ? `<span>${k.s}</span>` : ''}</div></div>`).join('')}</section>`; }
const ph = (title, sub, acts = '') => `<div class="ph"><div><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${acts ? `<div class="acts">${acts}</div>` : ''}</div>`;
const btn = (lbl, act, o = {}) => `<button class="btn${o.pri ? ' pri' : ''}${o.sm ? ' sm' : ''}${o.ghost ? ' ghost' : ''}${o.cls ? ' ' + o.cls : ''}" data-act="${act}"${o.dis ? ' disabled' : ''}${o.title ? ` title="${esc(o.title)}"` : ''}>${o.i ? icon(o.i) : ''}${esc(lbl)}</button>`;
const exportBtn = (act, lbl = 'Export CSV', o = {}) => allow('export') ? btn(lbl, act, { i: 'dl', ...o }) : '';
const panel = (title, body, o = {}) => `<section class="panel"${o.id ? ` id="${o.id}"` : ''}>${title ? `<div class="panel-h"><h2 class="sec">${esc(title)}</h2>${o.right || (o.sub ? `<span class="sub">${o.sub}</span>` : '')}</div>` : ''}<div class="panel-b${o.flush ? ' flush' : ''}">${body}</div></section>`;
const empty = (title, body, action = '') => `<div class="empty"><h3>${esc(title)}</h3><p>${body}</p>${action}</div>`;
const tabsHTML = (group, items, active) => `<div class="tabs" role="tablist">${items.map(([k, l, n]) => `<button class="tab" role="tab" aria-selected="${k === active}" data-act="tab:${group}:${k}">${esc(l)}${n !== undefined && n !== '' ? ` <span class="muted">${n}</span>` : ''}</button>`).join('')}</div>`;
const chipsHTML = (group, items, active) => `<div class="chips" role="group">${items.map(([k, l, n]) => `<button class="chip" aria-pressed="${k === active}" data-act="filt:${group}:${k}">${esc(l)}${n !== undefined ? ` <span class="ct">${n}</span>` : ''}</button>`).join('')}</div>`;
const searchHTML = (key, phr) => `<div class="search">${icon('search')}<label class="sr" for="q-${key}">Search</label><input class="inp" id="q-${key}" data-in="q" data-key="${key}" value="${esc(ui.q[key] || '')}" placeholder="${esc(phr)}" autocomplete="off"></div>`;
const matchQ = (key, ...fields) => { const q = (ui.q[key] || '').trim().toLowerCase(); if (!q) return true; return fields.some(f => String(f ?? '').toLowerCase().includes(q)); };
const tabOf = (g, d) => ui.tab[g] || d;
const filtOf = (g, d) => ui.filt[g] || d;
const meter = (f, tone = '') => `<div class="meter ${tone}"><i style="width:${clamp(f * 100, 0, 100).toFixed(1)}%"></i></div>`;
const stars = n => { n = clamp(Math.round(N(n)), 0, 5); return `<span class="stars" aria-label="${n} out of 5 stars">${'★'.repeat(n)}<span class="off">${'★'.repeat(5 - n)}</span></span>`; };
const brandTile = (b, lg) => `<span class="tile${lg ? ' lg' : ''}" style="--bc:var(--${(b && b.color) || 'c8'})">${esc(((b && b.code) || '—').slice(0, 4))}</span>`;
const prodTile = p => { const b = brandOf(p.brandId); return `<span class="tile" style="--bc:var(--${(b && b.color) || 'c8'})">${esc(((b && b.code) || 'SKU').slice(0, 3))}</span>`; };
const prodCell = p => p ? `<div class="cell-main">${prodTile(p)}<div><b>${esc(p.name)}</b><small class="mono">${esc(p.sku || '')}${p.variant ? ' · ' + esc(p.variant) : ''}</small></div></div>` : '<span class="muted">Deleted product</span>';
const brandName = id => (brandOf(id) || {}).name || '—';
const platPill = key => { const p = PL(key); return `<span class="pill nd" style="background:var(--sunken);color:var(--ink-2)"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:var(--${p.color || 'c8'})"></span>${esc(p.name)}</span>`; };
const delPill = (col, id) => pendingDel()[col + '/' + id] ? ' ' + pill('Delete requested', 't-warn', 1) : '';
const selOf = id => (ui.sel[id] = ui.sel[id] || new Set());
function table(id, cols, rows, o = {}) {
  cols = cols.filter(c => !c.cost || allow('costs'));
  if (o.select) { const sel = selOf(id); const keys = rows.map(o.key); for (const k of [...sel]) if (!keys.includes(k)) sel.delete(k); const all = keys.length && keys.every(k => sel.has(k)); cols = [{ k: '_sel', l: '', nosort: 1, cls: 'selc', head: `<input type="checkbox" class="selbox" data-act="selall:${id}" aria-label="Select all"${all ? ' checked' : ''}>`, render: r => `<input type="checkbox" class="selbox" data-act="sel:${id}:${esc(o.key(r))}" aria-label="Select row"${sel.has(o.key(r)) ? ' checked' : ''}>` }, ...cols]; SELKEYS[id] = keys; }
  if (!rows.length) return o.empty || `<div class="empty"><p>Nothing matches these filters.</p></div>`;
  const st = ui.sort[id] || o.sort || null; let data = rows.slice();
  if (st) { const c = cols.find(c => c.k === st.k); if (c) { const f = c.sort || (r => r[c.k]); data.sort((a, b) => { const x = f(a), y = f(b); return ((x ?? '') > (y ?? '') ? 1 : (x ?? '') < (y ?? '') ? -1 : 0) * (st.dir === 'desc' ? -1 : 1); }); } }
  const lim = o.limit && !ui.q[id + ':all'] ? o.limit : 0; const shown = lim ? data.slice(0, lim) : data;
  const th = cols.map(c => { const on = st && st.k === c.k; const arrow = on ? (st.dir === 'asc' ? ' ↑' : ' ↓') : ''; const inner = c.head ? c.head : c.nosort ? esc(c.l) : `<button data-act="sort:${id}:${c.k}:${c.num ? 1 : 0}">${esc(c.l)}${arrow}</button>`; return `<th class="${c.num ? 'num' : ''}${c.cls === 'selc' ? ' selc' : ''}"${on ? ` aria-sort="${st.dir === 'asc' ? 'ascending' : 'descending'}"` : ''}>${inner}</th>`; }).join('');
  const body = shown.map(r => { const a = o.open && o.open(r); return `<tr${a ? ` class="click" data-act="${a}" tabindex="0"` : ''}>${cols.map(c => `<td class="${c.num ? 'num' : ''}${c.cls ? ' ' + c.cls : ''}">${c.render ? c.render(r) : esc(r[c.k] ?? '')}</td>`).join('')}</tr>`; }).join('');
  const foot = o.foot ? `<tfoot><tr>${cols.map(c => `<td class="${c.num ? 'num' : ''}">${o.foot[c.k] ?? ''}</td>`).join('')}</tr></tfoot>` : '';
  const more = lim && data.length > lim ? `<div style="padding:10px 12px;border-top:1px solid var(--line-2)"><button class="btn sm ghost" data-act="showall:${id}">Show all ${data.length}</button></div>` : '';
  return `<div class="tw"><table class="t"><thead><tr>${th}</tr></thead><tbody>${body}</tbody>${foot}</table></div>${more}`;
}
function hbars(items, fmt = inrS) {
  if (!items.length) return '<p class="muted" style="margin:0">No data for this period.</p>';
  const max = Math.max(...items.map(i => Math.abs(N(i.v))), 1); const total = sum(items, i => Math.max(0, N(i.v)));
  return `<div class="hb">${items.map(i => `<div class="hb-r" style="--bc:var(--${i.c || 'c1'})"><span class="lab" title="${esc(i.l)}"><i class="sw"></i>${esc(i.l)}</span><span class="bar"><i style="width:${(Math.max(0, N(i.v)) / max * 100).toFixed(1)}%"></i></span><span class="val">${fmt(i.v)}${i.noShare ? '' : `<small>${total ? pct(Math.max(0, N(i.v)) / total, 0) : ''}</small>`}</span></div>`).join('')}</div>`;
}
function niceStep(v) { if (!(v > 0)) return 1; const p = 10 ** Math.floor(Math.log10(v)); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
function trendChart(months, showProfit = true) {
  const W = 640, H = 236, L = 58, R = 10, T = 12, B = 28;
  const vals = months.flatMap(m => showProfit ? [m.rev, m.profit] : [m.rev]); let mx = Math.max(0, ...vals), mn = Math.min(0, ...vals);
  const step = niceStep((mx - mn) / 4 || 1); mx = Math.ceil(mx / step) * step || step; mn = Math.floor(mn / step) * step;
  const y = v => T + (mx - v) / (mx - mn) * (H - T - B); const bw = (W - L - R) / months.length;
  let g = '';
  for (let v = mn; v <= mx + step / 1000; v += step) g += `<line class="${Math.abs(v) < step / 1000 ? 'zl' : 'gl'}" x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="ax" x="${L - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${esc(inrS(v))}</text>`;
  const bars = months.map((m, i) => { const x = L + i * bw + bw * .2, w = bw * .6, y0 = y(0), y1 = y(Math.max(0, m.rev)); return `<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" rx="3" style="fill:var(--c1);opacity:${i === months.length - 1 ? 1 : .72}"><title>${esc(monthLabel(m.k))}: ${esc(inr(m.rev))} net revenue</title></rect><text class="ax" x="${(L + i * bw + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(monthLabel(m.k))}${i === months.length - 1 ? ' *' : ''}</text>`; }).join('');
  const pts = months.map((m, i) => [L + i * bw + bw / 2, y(m.profit)]);
  const line = !showProfit ? '' : `<polyline points="${pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ')}" fill="none" style="stroke:var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>` + pts.map((p, i) => `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i === pts.length - 1 ? 5 : 3.5}" style="fill:var(--accent);stroke:var(--surface)" stroke-width="2"><title>${esc(monthLabel(months[i].k))}: ${esc(inr(months[i].profit))} net profit</title></circle>`).join('');
  return `<div class="chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Net revenue by month${showProfit ? ' with net profit line' : ''}">${g}${bars}${line}</svg></div><div class="legend" style="margin-top:8px"><span style="--bc:var(--c1)"><i></i>Net revenue (ex-GST)</span>${showProfit ? '<span style="--bc:var(--accent)"><i></i>Net profit after expenses & depreciation</span>' : ''}<span class="muted">* month to date</span></div>`;
}
function monthsBack(n) { const d = parseD(TODAY()); const out = []; for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(ymd(x).slice(0, 7)); } return out; }
function monthRange(k) { const [y, m] = k.split('-').map(Number); return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))]; }

/* ---------- drawer & forms ---------- */
const DRW = { cfg: null, tab: 0, confirm: false, busy: false, lastFocus: null };
function openDrawer(cfg) {
  DRW.cfg = cfg; DRW.tab = cfg.tab || 0; DRW.confirm = false; DRW.busy = false; DRW.lastFocus = document.activeElement;
  const d = $('#dr'); d.className = 'dr' + (cfg.wide ? ' wide' : ''); d.innerHTML = drawerHTML(); d.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('open')));
  setTimeout(() => { if (cfg.noFocus) return; const f = $('.dr-b .drp:not([hidden]) .inp:not([disabled])', d); if (f) f.focus(); }, 80);
  if (cfg.onOpen) cfg.onOpen(d);
}
function redrawDrawer() { if (!DRW.cfg) return; const d = $('#dr'); d.innerHTML = drawerHTML(); d.classList.add('open'); if (DRW.cfg.onOpen) DRW.cfg.onOpen(d); }
function drawerHTML() {
  const c = DRW.cfg; const tabs = c.tabs || [{ l: '', html: c.html }];
  return `<div class="scrim" data-act="drclose"></div><div class="panelx">
  <div class="dr-h"><div class="grow"><h2 id="drTitle">${esc(c.title)}</h2>${c.sub ? `<p>${c.sub}</p>` : ''}</div><button type="button" class="btn icon ghost" data-act="drclose" aria-label="Close">${icon('x')}</button></div>
  ${tabs.length > 1 ? `<div class="tabs" role="tablist">${tabs.map((t, i) => `<button type="button" class="tab" role="tab" aria-selected="${i === DRW.tab}" data-act="drtab:${i}">${esc(t.l)}</button>`).join('')}</div>` : ''}
  <form class="dr-b" id="drForm" novalidate>${c.top || ''}${tabs.map((t, i) => `<div class="drp" data-tab="${i}"${i === DRW.tab ? '' : ' hidden'}>${typeof t.html === 'function' ? t.html() : t.html}</div>`).join('')}<button type="submit" hidden></button></form>
  <div class="dr-f" id="drFoot">${footHTML()}</div></div>`;
}
function footHTML() {
  const c = DRW.cfg; const ro = c.readOnly; const direct = c.directDelete || allow('approveDelete');
  if (DRW.confirm) return direct
    ? `<div class="confirm"><span>${esc(c.confirmText || 'Delete this? It goes to the recycle bin in Approvals, where it can be restored this quarter.')}</span><button type="button" class="btn sm" data-act="drnoconfirm">Keep it</button><button type="button" class="btn sm danger solid" data-act="drdelete">Delete</button></div>`
    : `<div class="confirm"><span>Deleting needs approval from a Manager or the CEO.</span><label class="sr" for="delReason">Reason</label><input class="inp" id="delReason" placeholder="Reason (helps the approver)" maxlength="160"><button type="button" class="btn sm" data-act="drnoconfirm">Cancel</button><button type="button" class="btn sm danger solid" data-act="drdelete">Send request</button></div>`;
  const pend = c.delKey && pendingDel()[c.delKey];
  return `${c.onDelete && !ro ? (pend ? pill('Delete requested · waiting for approval', 't-warn', 1) : `<button type="button" class="btn ghost danger" data-act="drconfirm">${direct ? 'Delete' : 'Request delete'}</button>`) : ''}${c.footExtra || ''}<span class="sp"></span><button type="button" class="btn" data-act="drclose">${c.onSave && !ro ? 'Cancel' : 'Close'}</button>${c.onSave && !ro ? `<button type="button" class="btn pri" id="drSaveBtn" data-act="drsave">${esc(c.saveLabel || 'Save')}</button>` : ''}`;
}
function closeDrawer() { const d = $('#dr'); d.classList.remove('open'); DRW.cfg = null; setTimeout(() => { if (!DRW.cfg) { d.hidden = true; d.innerHTML = ''; } }, 220); try { DRW.lastFocus && DRW.lastFocus.focus && DRW.lastFocus.focus({ preventScroll: true }); } catch (e) { } }
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function setPath(o, p, v) { const ks = p.split('.'); let c = o; ks.slice(0, -1).forEach(k => { c[k] = c[k] && typeof c[k] === 'object' ? c[k] : {}; c = c[k]; }); c[ks[ks.length - 1]] = v; }
function fld(f, v) {
  const id = 'fi_' + f.n.replace(/[^a-z0-9]/gi, '_'); const val = (v === undefined || v === null) ? (f.d ?? '') : v;
  const dis = (f.ro || (DRW.cfg && DRW.cfg.readOnly)) ? ' disabled' : ''; const req = f.req ? ' data-req="1"' : ''; const t = f.t || 'text';
  let input;
  if (t === 'select') { const opts = (typeof f.o === 'function' ? f.o() : f.o) || []; input = `<select class="inp" id="${id}" name="${f.n}" data-t="${f.num ? 'num' : 'str'}"${req}${dis}${f.ch ? ` data-ch="${f.ch}"` : ''}>${f.blank !== undefined ? `<option value="">${esc(f.blank)}</option>` : ''}${opts.map(o => { const [ov, ol] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(ov)}"${String(ov) === String(val) ? ' selected' : ''}>${esc(ol)}</option>`; }).join('')}</select>`; }
  else if (t === 'textarea') input = `<textarea class="inp" id="${id}" name="${f.n}" data-t="str" rows="${f.rows || 4}" placeholder="${esc(f.ph || '')}"${req}${dis}>${esc(val)}</textarea>`;
  else if (t === 'check') input = `<label class="chk"><input type="checkbox" id="${id}" name="${f.n}" data-t="check"${val === true ? ' checked' : ''}${dis}> ${esc(f.cl || '')}</label>`;
  else if (t === 'multi') { const opts = (typeof f.o === 'function' ? f.o() : f.o) || []; const arr = Array.isArray(val) ? val : []; input = `<div class="checks" id="${id}">${opts.length ? opts.map(([ov, ol]) => `<label class="chk"><input type="checkbox" name="${f.n}" data-t="multi" value="${esc(ov)}"${arr.includes(ov) ? ' checked' : ''}${dis}> ${esc(ol)}</label>`).join('') : `<span class="muted">${esc(f.none || 'Nothing to choose yet')}</span>`}</div>`; }
  else if (t === 'swatch') input = `<div class="swatches" id="${id}">${SWATCHES.map(s => `<label style="--bc:var(--${s})"><input type="radio" name="${f.n}" data-t="str" value="${s}"${s === (val || 'c1') ? ' checked' : ''}${dis} aria-label="Colour ${s.slice(1)}"><i></i></label>`).join('')}</div>`;
  else if (t === 'money' || t === 'pct' || t === 'number') { const pre = t === 'money' ? '₹' : (f.pre || ''); const suf = t === 'pct' ? '%' : (f.suf || ''); input = `<div class="affix${pre ? ' hp' : ''}${suf ? ' hs' : ''}">${pre ? `<span class="pre">${pre}</span>` : ''}<input class="inp tnum" type="number" inputmode="decimal" id="${id}" name="${f.n}" data-t="num" value="${esc(val)}" step="${f.step || 'any'}"${f.min !== undefined ? ` min="${f.min}"` : ''} placeholder="${esc(f.ph || '')}"${req}${dis}>${suf ? `<span class="suf">${suf}</span>` : ''}</div>`; }
  else input = `<input class="inp${f.mono ? ' mono' : ''}" type="${t === 'date' ? 'date' : t === 'time' ? 'time' : t === 'password' || t === 'pw' ? 'password' : t === 'email' ? 'email' : t === 'tel' ? 'tel' : 'text'}"${t === 'password' ? ' inputmode="numeric" maxlength="8"' : t === 'pw' ? ' autocomplete="new-password"' : ''} id="${id}" name="${f.n}" data-t="str" value="${esc(val)}" placeholder="${esc(f.ph || '')}"${f.max ? ` maxlength="${f.max}"` : ''}${req}${dis} autocomplete="off">`;
  const star = f.req ? ' <span class="req">*</span>' : '';
  const lab = ['check', 'multi', 'swatch'].includes(t) ? `<span class="lab">${esc(f.l)}${star}</span>` : `<label for="${id}">${esc(f.l)}${star}</label>`;
  return `<div class="fld${f.full ? ' full' : ''}" data-fld="${esc(f.n)}">${f.l ? lab : ''}${input}${f.help ? `<div class="help">${f.help}</div>` : ''}<div class="err" hidden></div></div>`;
}
const form = (fields, vals = {}) => `<div class="form">${fields.filter(f => !f.hide).map(f => f.raw ? `<div class="fld full">${f.raw}</div>` : fld(f, getPath(vals, f.n))).join('')}</div>`;
function readForm(root) {
  const vals = {}; const errs = [];
  if (!root) return { vals, errs };
  root.querySelectorAll('[name]').forEach(el => {
    const t = el.dataset.t, n = el.name; if (!t) return;
    if (t === 'multi') { const cur = getPath(vals, n) || []; if (el.checked) cur.push(el.value); setPath(vals, n, cur); return; }
    if (el.type === 'radio') { if (el.checked) setPath(vals, n, el.value); return; }
    let v; if (t === 'check') v = el.checked; else if (t === 'num') v = el.value === '' ? null : Number(el.value); else v = el.value.trim();
    setPath(vals, n, v); if (el.dataset.req && (v === '' || v === null)) errs.push({ n, m: 'Required' });
  });
  return { vals, errs };
}
function showErrs(list) {
  const root = $('#drForm'); if (!root) return;
  root.querySelectorAll('.fld.bad').forEach(f => { f.classList.remove('bad'); const e = $('.err', f); if (e) e.hidden = true; });
  let firstTab = null, firstEl = null;
  for (const { n, m } of list) {
    const f = root.querySelector(`.fld[data-fld="${CSS.escape(n)}"]`);
    if (f) { f.classList.add('bad'); const e = $('.err', f); if (e) { e.textContent = m; e.hidden = false; } if (!firstEl) { firstEl = f; const p = f.closest('.drp'); firstTab = p ? +p.dataset.tab : null; } }
    else toast(m, 'bad');
  }
  if (firstTab !== null && firstTab !== DRW.tab) ACT.drtab(String(firstTab));
  if (firstEl) { const i = $('.inp,input', firstEl); if (i) i.focus(); }
}
async function drSave() {
  const c = DRW.cfg; if (!c || !c.onSave || DRW.busy) return;
  const { vals, errs } = readForm($('#drForm')); const list = errs.slice(); if (c.validate) list.push(...(c.validate(vals) || []));
  if (list.length) return showErrs(list);
  DRW.busy = true; const b = $('#drSaveBtn'); if (b) { b.disabled = true; b.textContent = 'Saving…'; }
  try { const r = await c.onSave(vals); if (r !== false && DRW.cfg === c) { closeDrawer(); if (c.savedMsg !== null) toast(c.savedMsg || 'Saved'); } }
  catch (e) { handleErr(e); }
  finally { DRW.busy = false; const b2 = $('#drSaveBtn'); if (b2) { b2.disabled = false; b2.textContent = c.saveLabel || 'Save'; } }
}
let toastT;
function toast(msg, tone) { const t = $('#toast'); t.textContent = msg; t.className = tone === 'bad' ? 'bad' : ''; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, tone === 'bad' ? 6500 : 3200); }

/* ---------- export / copy (logged) ---------- */
function toCSV(cols, rows) { const q = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }; return [cols.map(c => q(c.l)).join(','), ...rows.map(r => cols.map(c => q(c.csv ? c.csv(r) : r[c.k])).join(','))].join('\n'); }
async function exportCSV(name, cols, rows, mod) {
  if (!allow('export')) { toast('Your role can’t export data.', 'bad'); return; }
  const data = toCSV(cols, rows); const filename = name.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() + '-' + TODAY() + '.csv';
  addLog('export', mod || ui.view, `Exported ${name} (${rows.length} rows)`);
  try { const p = await HOST.saveFile({ filename, data, bom: true }); if (p) toast('Saved ' + String(p).split(/[\\/]/).pop()); } catch (e) { console.warn(e); copyText(data, 'The file couldn’t be saved, so the CSV was copied to your clipboard.'); }
}
async function copyText(text, okMsg = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(okMsg); }
  catch (e) { openDrawer({ title: 'Copy this text', sub: 'Your browser blocked automatic copying. Select all and copy it yourself.', html: `<textarea class="inp mono" id="copyBox" rows="16" readonly>${esc(text)}</textarea>`, noFocus: true, onOpen: d => { const t = $('#copyBox', d); setTimeout(() => { t.focus(); t.select(); }, 100); } }); }
}
