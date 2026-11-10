/* ---------- responsive helpers ----------
   Tables that don't fit their box are shown as cards, one per row (CSS in app3.css): on phones any table with 4+ columns,
   on tablets and small laptops (up to 1100px) a table whose box is narrower than its columns need. For that, each cell
   carries its column name in data-l. Tables are checked after every redraw and resize, so view code needn't know.
   Dropdowns: hovering or focusing one shows its full chosen text as a tooltip, for boxes too narrow to show it all. */
function labelTables(root) {
  for (const t of root.querySelectorAll('table.t')) {
    const head = t.tHead && t.tHead.rows[0]; if (!head) continue;
    const labs = []; for (const th of head.cells) { labs.push(th.textContent.replace(/[↑↓*]/g, '').replace(/\s+/g, ' ').trim()); for (let k = 1; k < th.colSpan; k++) labs.push(''); }
    const grid = t.classList.contains('grid'); const box = t.parentElement; const bw = box ? box.clientWidth : 0;
    if (!bw) continue; // in a hidden tab: decided when it is shown
    const vw = window.innerWidth; const n = labs.length;
    const stack = n >= 4 && !t.classList.contains('reg') && !t.classList.contains('keep') && (vw <= 640 || (vw <= 1100 && bw < n * (grid ? 125 : 92)));
    if (t.classList.contains('cardt') !== stack) t.classList.toggle('cardt', stack);
    const two = stack && bw >= 600; if (t.classList.contains('c2') !== two) t.classList.toggle('c2', two);
    if (!stack) continue;
    for (const sec of [...t.tBodies, t.tFoot]) {
      if (!sec) continue;
      for (const tr of sec.rows) {
        if (tr.dataset.lab) continue; tr.dataset.lab = '1'; let ci = 0, titled = false;
        for (const td of tr.cells) {
          const span = td.colSpan > 1; const l = span ? '' : (labs[ci] || ''); ci += td.colSpan || 1;
          td.dataset.l = l;
          if (span) { td.classList.add('span'); continue; }
          if (td.classList.contains('selc')) { tr.classList.add('has-sel'); continue; }
          if (!l && td.children.length === 1 && td.firstElementChild.matches('.btn.icon')) { td.classList.add('cact'); continue; }
          if (!titled && !grid) { td.classList.add('c1'); titled = true; }
          if (grid && td.querySelector('.dimrow, input[name$=".name"], select[name$="productId"]')) td.classList.add('wide');
        }
      }
    }
  }
}
let labRAF = 0;
// Fields that only apply to one choice of another field (data-when="status:returned", "type:!transfer") are shown only then,
// so nobody fills in a dropdown that wouldn't be saved.
function applyWhen(root) {
  const form = root.querySelector('#drForm'); if (!form) return;
  for (const f of form.querySelectorAll('.fld[data-when]')) {
    const [n, rule] = f.dataset.when.split(':'); const ctl = form.querySelector(`[name="${n}"]`); if (!ctl) continue;
    const neg = rule.startsWith('!'); const hit = rule.replace(/^!/, '').split('|').includes(ctl.value); const show = neg ? !hit : hit;
    if (f.hidden === show) f.hidden = !show;
  }
}
const relabel = () => { if (labRAF) return; labRAF = requestAnimationFrame(() => { labRAF = 0; try { labelTables(document); applyWhen(document); } catch (e) { console.warn(e); } }); };
document.addEventListener('change', e => { if (e.target && e.target.closest && e.target.closest('#drForm')) applyWhen(document); });
new MutationObserver(relabel).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
window.addEventListener('resize', relabel);

function selectTip(e) {
  const s = e.target && e.target.closest ? e.target.closest('select.inp') : null; if (!s) return;
  if (s.title && !s.dataset.tip) return; // keeps a title written into the markup
  const o = s.options[s.selectedIndex]; const txt = o ? o.textContent.trim() : '';
  s.dataset.tip = '1'; s.title = txt;
}
document.addEventListener('pointerover', selectTip, true);
document.addEventListener('focusin', selectTip, true);
document.addEventListener('change', selectTip, true);
