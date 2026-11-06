/* ---------- boot ---------- */
const subFns = {}; let sessionLogged = false;
const SETTING_KEYS = ['platforms', 'roles', 'company', 'audit', 'attendance', 'reports', 'security', 'hr', 'recon', 'purchase', 'listings', 'claims'];
function afterSnapshot() {
  if (!COLS.every(k => S.definitive[k])) return;
  if (MODE === 'live' && ME.id && !SVC) autoPostRecurring();
}
function subscribeAll() {
  for (const key of COLS) {
    subFns[key] = () => DB.collection(key).onSnapshot(sn => { S[key] = sn.docs.map(d => Object.assign({ id: d.id }, d.data())); S.loaded[key] = true; S.definitive[key] = true; if (key === 'members') syncLogSubs(); bump(); afterSnapshot(); }, err => subErr(key, err));
    subFns[key]();
  }
  for (const k of SETTING_KEYS) { subFns['s_' + k] = () => DB.doc('settings/' + k).onSnapshot(sn => { S.settings[k] = sn.exists ? sn.data() : null; bump(); }, err => subErr('s_' + k, err)); subFns['s_' + k](); }
}
function subErr(key, err) { console.warn('subscription', key, err); S.loaded[key] = true; S.definitive[key] = true; schedule(); }
function postRender() { paintSaveState(); }
async function boot() {
  { const m = (location.hash || '').match(/k=(tvq_[\w-]+)/); if (m) { try { localStorage.setItem('tv-kiosk', m[1]); } catch (e) { } try { history.replaceState(null, '', '/kiosk'); } catch (e) { } } }
  render(); renderGate();
  if (SVC) { // the server opens the app headless to print the daily report
    try { const snap = await api('GET', '/api/snapshot'); ME.id = null; ME.isOwner = true; DB = remoteDB(snap); subscribeAll(); syncLogSubs(); MODE = 'svc'; await sleep(250); window.__TV_REPORT = d => reportDoc(d, true, ''); window.__TV_READY = true; } catch (e) { console.error(e); }
    return;
  }
  try { GATE.status = await api('GET', '/api/status', undefined, { noAuthRedirect: true }); } catch (e) { GATE.status = { setup: false, company: 'Triagon ERP' }; GATE.err = e.userMsg || ''; }
  if (location.pathname === '/kiosk' && KIOSK_TOKEN()) { MODE = 'locked'; openKiosk(); return; }
  if (GATE.status.signedIn) { try { await startSession(); return; } catch (e) { console.warn(e); } }
  MODE = 'locked'; renderGate();
}
setInterval(() => { if (MODE === 'live' && ui.view === 'attendance') schedule(); }, 60000);
window.addEventListener('pagehide', () => { if (logBuf.length) flushLog(); });
if ('serviceWorker' in navigator && !SVC) window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => { }); });
boot();
})();
