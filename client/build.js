'use strict';
/* Builds client/public from client/src: one app.js (shared model + all parts), one app.css, index.html. */
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const SRC = path.join(__dirname, 'src'); const OUT = path.join(__dirname, 'public'); const ROOT = path.join(__dirname, '..');
fs.mkdirSync(OUT, { recursive: true });
const parts = fs.readdirSync(SRC).filter(f => f.endsWith('.js')).sort();
const js = ['/* Triagon ERP web — built ' + new Date().toISOString() + ' */', fs.readFileSync(path.join(ROOT, 'shared', 'model.js'), 'utf8'), ...parts.map(f => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(SRC, f), 'utf8'))].join('\n');
const css = fs.readdirSync(SRC).filter(f => f.endsWith('.css')).sort().map(f => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
const h = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(OUT, 'app.js'), js); fs.writeFileSync(path.join(OUT, 'app.css'), css);
const shell = fs.readFileSync(path.join(SRC, 'shell.html'), 'utf8');
const html = `<!doctype html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Triagon ERP</title><meta name="theme-color" content="#FFFFFF"><meta name="color-scheme" content="light"><meta name="robots" content="noindex,nofollow">
<link rel="icon" href="/assets/icon-256.png"><link rel="apple-touch-icon" href="/assets/icon-256.png"><link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/fonts/fonts.css"><link rel="stylesheet" href="/app.css?v=${h(css)}"></head><body>
${shell}<script src="/app.js?v=${h(js)}"></script>
</body></html>`;
fs.writeFileSync(path.join(OUT, 'index.html'), html);
const copyDir = (a, b) => { fs.mkdirSync(b, { recursive: true }); for (const f of fs.readdirSync(a)) { const s = path.join(a, f), d = path.join(b, f); if (fs.statSync(s).isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d); } };
for (const d of ['assets', 'fonts']) if (fs.existsSync(path.join(__dirname, d))) copyDir(path.join(__dirname, d), path.join(OUT, d));
fs.writeFileSync(path.join(OUT, 'manifest.webmanifest'), JSON.stringify({ name: 'Triagon ERP', short_name: 'Triagon ERP', start_url: '/', scope: '/', display: 'standalone', background_color: '#F7F6F2', theme_color: '#FFFFFF', icons: [{ src: '/assets/icon-256.png', sizes: '256x256', type: 'image/png' }, { src: '/assets/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }] }, null, 1));
fs.writeFileSync(path.join(OUT, 'sw.js'), `// Lets the ERP be installed as an app. Always uses the network; no data is cached.
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log(`built: app.js ${(js.length / 1024).toFixed(0)} KB, app.css ${(css.length / 1024).toFixed(0)} KB, ${parts.length} parts`);
