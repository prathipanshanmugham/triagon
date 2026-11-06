'use strict';
/* PDF rendering with a headless Chromium that is started on demand and closed when idle. */
let chromium = null; try { ({ chromium } = require('playwright-core')); } catch (e) { }
let browser = null, idleT = null, launching = null, queue = Promise.resolve();
async function getBrowser() {
  if (!chromium) throw new Error('PDF engine not installed (playwright-core missing)');
  if (browser && browser.isConnected()) return browser;
  if (!launching) launching = chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'] }).then(b => { browser = b; launching = null; b.on('disconnected', () => { browser = null; }); return b; }, e => { launching = null; throw e; });
  return launching;
}
function touch() { clearTimeout(idleT); idleT = setTimeout(async () => { const b = browser; browser = null; if (b) { try { await b.close(); } catch (e) { } } }, 5 * 60 * 1000); }
const FOOT = label => `<div style="width:100%;font:8px Arial,sans-serif;color:#8a8478;padding:0 12mm;display:flex;justify-content:space-between"><span>${label}</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`;
function run(fn) { const p = queue.then(fn, fn); queue = p.catch(() => { }); return p; }
// html: full document. baseURL: where assets/fonts are served from.
function render(html, { baseURL, landscape = false, footer = '', margins } = {}) {
  return run(async () => {
    const b = await getBrowser(); touch();
    const ctx = await b.newContext({ baseURL, javaScriptEnabled: true });
    try {
      const page = await ctx.newPage();
      const doc = html.includes('<base ') ? html : html.replace(/<head>/i, `<head><base href="${baseURL}/">`);
      await page.setContent(doc, { waitUntil: 'load', timeout: 30000 });
      try { await page.evaluate(() => document.fonts.ready.then(() => true)); } catch (e) { }
      const m = margins || { top: '11mm', bottom: '14mm', left: '11mm', right: '11mm' };
      return await page.pdf({ format: 'A4', landscape, printBackground: true, preferCSSPageSize: true, displayHeaderFooter: !!footer, headerTemplate: '<div></div>', footerTemplate: footer ? FOOT(footer) : '<div></div>', margin: m });
    } finally { try { await ctx.close(); } catch (e) { } touch(); }
  });
}
// Opens the app itself (as the system user) and asks it for an HTML document, then prints it.
function renderFromApp(url, cookie, evalExpr, opts = {}) {
  return run(async () => {
    const b = await getBrowser(); touch();
    const ctx = await b.newContext({ baseURL: opts.baseURL });
    try {
      await ctx.addCookies([cookie]);
      const page = await ctx.newPage();
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction(() => window.__TV_READY === true, null, { timeout: 60000 });
      const html = await page.evaluate(evalExpr);
      if (!html) return null;
      const p2 = await ctx.newPage();
      await p2.setContent(html.replace(/<head>/i, `<head><base href="${opts.baseURL}/">`), { waitUntil: 'load', timeout: 30000 });
      try { await p2.evaluate(() => document.fonts.ready.then(() => true)); } catch (e) { }
      return await p2.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: !!opts.footer, headerTemplate: '<div></div>', footerTemplate: opts.footer ? FOOT(opts.footer) : '<div></div>', margin: { top: '11mm', bottom: '14mm', left: '11mm', right: '11mm' } });
    } finally { try { await ctx.close(); } catch (e) { } touch(); }
  });
}
async function shutdown() { clearTimeout(idleT); if (browser) { try { await browser.close(); } catch (e) { } } }
module.exports = { render, renderFromApp, shutdown, available: () => !!chromium };
