/* Triagon ERP — shared data model: modules, roles, and which module owns each collection.
   Loaded by the server (require) and bundled into the browser app (as MODEL). */
const MODEL = (() => {
  const MODULES = [
    { k: 'dashboard', l: 'Dashboard', g: 'Overview', i: 'dash' },
    { k: 'daily', l: 'Daily report', g: 'Overview', i: 'pdf' },
    { k: 'reports', l: 'Reports', g: 'Overview', i: 'report' },
    { k: 'brands', l: 'Brands', g: 'Catalogue & stock', i: 'tag' },
    { k: 'catalogue', l: 'Catalogue & listings', g: 'Catalogue & stock', i: 'grid' },
    { k: 'inventory', l: 'Inventory & purchasing', g: 'Catalogue & stock', i: 'box' },
    { k: 'orders', l: 'Sales orders', g: 'Sales', i: 'cart' },
    { k: 'returns', l: 'Returns & claims', g: 'Sales', i: 'undo' },
    { k: 'finance', l: 'Finance & accounts', g: 'Money', i: 'rupee' },
    { k: 'calculator', l: 'Revenue calculator', g: 'Money', i: 'calc' },
    { k: 'marketing', l: 'Marketing & offers', g: 'Growth', i: 'mega' },
    { k: 'customers', l: 'Customers & ratings', g: 'Growth', i: 'star' },
    { k: 'attendance', l: 'Attendance', g: 'People', i: 'people' },
    { k: 'hr', l: 'HR & payroll', g: 'People', i: 'idcard' },
    { k: 'approvals', l: 'Approvals & recycle bin', g: 'Admin', i: 'check' },
    { k: 'users', l: 'Users & permissions', g: 'Admin', i: 'users' },
    { k: 'logs', l: 'Activity log', g: 'Admin', i: 'log' },
  ];
  const FIN_SECTIONS = [['pnl', 'Profit & loss and GST'], ['sales', 'Sales ledger'], ['expenses', 'Expenses'], ['recurring', 'Recurring expenses'], ['payouts', 'Payouts & reconciliation'], ['accounts', 'Bank & cash accounts'], ['assets', 'Assets']];
  const ABILITIES = [
    ['overview', 'Company overview dashboard', 'Revenue, profit and stock value for the whole company.'],
    ['costs', 'Cost prices, margins and profit', 'When off, cost and profit columns are hidden everywhere.'],
    ['export', 'Export and copy data', 'CSV exports and copying tables.'],
    ['approveDelete', 'Delete directly and approve deletions', 'Others send a delete request that needs approval.'],
  ];
  const ALL_EDIT = Object.fromEntries(MODULES.map(m => [m.k, 'edit']));
  const DEFAULT_ROLE_DEFS = {
    manager: { label: 'Manager', modules: { ...ALL_EDIT, hr: 'none', users: 'view', logs: 'view' }, sections: Object.fromEntries(FIN_SECTIONS.map(s => [s[0], true])), abilities: { overview: true, costs: true, export: true, approveDelete: true } },
    staff: { label: 'Staff', modules: { dashboard: 'view', daily: 'edit', reports: 'none', brands: 'view', catalogue: 'edit', inventory: 'edit', orders: 'edit', returns: 'edit', finance: 'none', calculator: 'view', marketing: 'view', customers: 'edit', attendance: 'view', hr: 'none', approvals: 'view', users: 'none', logs: 'none' }, sections: { pnl: false, sales: true, expenses: false, recurring: false, payouts: false, accounts: false, assets: false }, abilities: { overview: false, costs: false, export: false, approveDelete: false } },
  };
  // Which modules may write a collection (any one is enough) and which may read it.
  const W = {
    brands: ['brands'], products: ['catalogue', 'inventory'], ratingSnaps: ['customers', 'catalogue'],
    moves: ['inventory', 'returns'], pos: ['inventory'], suppliers: ['inventory'], pinvoices: ['inventory', 'finance'],
    orders: ['orders'], claims: ['returns', 'finance'], sales: ['finance', 'orders', 'returns'],
    expenses: ['finance', 'hr'], recurring: ['finance'], payouts: ['finance'], assets: ['finance'], accounts: ['finance'], txns: ['finance', 'orders', 'inventory', 'hr'],
    campaigns: ['marketing'], offers: ['marketing'], customers: ['customers', 'orders'], reviews: ['customers'],
    employees: ['attendance', 'hr'], attendance: ['attendance'], updates: ['daily'],
    candidates: ['hr'], hrprofiles: ['hr'], payroll: ['hr'], hradj: ['hr'],
    deletions: ['approvals'], members: ['users'], files: ['*'],
  };
  const R = {
    expenses: ['finance', 'hr'], recurring: ['finance'], payouts: ['finance'], assets: ['finance'], accounts: ['finance', 'orders', 'inventory', 'hr'], txns: ['finance', 'orders', 'inventory', 'hr'], pinvoices: ['inventory', 'finance'],
    candidates: ['hr'], hrprofiles: ['hr'], payroll: ['hr'], hradj: ['hr'], claims: ['returns', 'finance'], orders: ['orders', 'finance', 'returns', 'dashboard'],
  };
  const SETTINGS_W = { platforms: ['finance', 'calculator'], attendance: ['attendance'], reports: ['daily'], hr: ['hr'], recon: ['finance'], purchase: ['inventory', 'finance'], listings: ['catalogue'], claims: ['returns'] };
  const COLLECTIONS = Object.keys(W);
  const mergeRole = (d, x) => ({ label: x.label || d.label, custom: !!x.custom, modules: { ...d.modules, ...(x.modules || {}) }, sections: { ...d.sections, ...(x.sections || {}) }, abilities: { ...d.abilities, ...(x.abilities || {}) } });
  function roleDefs(rolesSetting) {
    const s = rolesSetting || {}; const saved = s.roles || {}; const out = {};
    const legacy = k => (s[k] && typeof s[k].dashboard === 'string') ? { modules: s[k] } : null;
    for (const k of ['manager', 'staff']) out[k] = mergeRole(DEFAULT_ROLE_DEFS[k], saved[k] || legacy(k) || {});
    for (const k in saved) if (!out[k] && saved[k] && saved[k].custom) out[k] = mergeRole(DEFAULT_ROLE_DEFS.staff, saved[k]);
    return out;
  }
  // null means full access (CEO)
  function permsFor(member, rolesSetting) {
    if (!member || member.status === 'removed') return { none: true, modules: {}, sections: {}, abilities: {} };
    if (member.role === 'ceo') return null;
    const defs = roleDefs(rolesSetting); const def = defs[member.role] || defs.staff; const ov = member.perms || {};
    return { modules: { ...def.modules, ...(ov.modules || {}) }, sections: { ...def.sections, ...(ov.sections || {}) }, abilities: { ...def.abilities, ...(ov.abilities || {}) } };
  }
  function access(p, mod) { if (!p) return 'edit'; if (p.none) return 'none'; const a = (p.modules || {})[mod] || 'none'; return (mod === 'dashboard' && a === 'none') ? 'view' : a; }
  const canView = (p, mod) => access(p, mod) !== 'none';
  const canEdit = (p, mod) => access(p, mod) === 'edit';
  const ability = (p, ab) => !p || (!p.none && !!(p.abilities || {})[ab]);
  const writeMods = col => W[col] || null;
  const readMods = col => R[col] || null;
  return { MODULES, FIN_SECTIONS, ABILITIES, DEFAULT_ROLE_DEFS, COLLECTIONS, SETTINGS_W, mergeRole, roleDefs, permsFor, access, canView, canEdit, ability, writeMods, readMods };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = MODEL;
