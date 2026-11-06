/* =====================================================================
   Attendance: employees, check-in / check-out, monthly register, kiosk
   ===================================================================== */
const WEEKDAYS = [['1', 'Mon'], ['2', 'Tue'], ['3', 'Wed'], ['4', 'Thu'], ['5', 'Fri'], ['6', 'Sat'], ['0', 'Sun']];
const ATT_MARKS = [['', 'Automatic, from check-in times'], ['present', 'Present, full day'], ['half', 'Half day'], ['wfh', 'On duty / work from home'], ['leave', 'Leave'], ['holiday', 'Holiday'], ['absent', 'Absent']];
const REG_CODE = { present: 'P', late: 'L', in: 'P', noout: 'P', wfh: 'OD', half: '½', absent: 'A', notin: 'A', leave: 'LV', holiday: 'H', off: 'W', notyet: '·', future: '', na: '' };
const attSettings = () => Object.assign({ start: '09:30', end: '18:30', grace: 10, halfDay: 4, weeklyOff: ['0'], holidays: [], requirePin: true }, S.settings.attendance || {});
const empOf = id => byId('employees')[id];
const activeEmps = () => S.employees.filter(e => e.status !== 'inactive').sort((a, b) => String(a.name).localeCompare(String(b.name)));
const attKey = (empId, d) => empId + '_' + d;
const attOf = (empId, d) => byId('attendance')[attKey(empId, d)] || null;
const hm = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
const minsOf = iso => { const d = new Date(iso); return d.getHours() * 60 + d.getMinutes(); };
const lateTxt = m => (m = Math.round(N(m))) >= 60 ? fmtHrs(m) : m + ' min';
const fmtHrs = m => { m = Math.max(0, Math.round(N(m))); return Math.floor(m / 60) + 'h ' + pad(m % 60) + 'm'; };
const isoAt = (d, t) => { const [y, mo, dd] = d.split('-').map(Number); const [h, mi] = String(t).split(':').map(Number); return new Date(y, mo - 1, dd, h || 0, mi || 0).toISOString(); };
const hhmm = iso => { const d = new Date(iso); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };
const t12 = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return ((h % 12) || 12) + ':' + pad(m || 0) + (h < 12 ? ' am' : ' pm'); };
const localDay = iso => ymd(new Date(iso));
function empShift(e) { const s = attSettings(); return { start: (e && e.shiftStart) || s.start, end: (e && e.shiftEnd) || s.end, grace: N(s.grace), weeklyOff: (e && Array.isArray(e.weeklyOff) && e.weeklyOff.length) ? e.weeklyOff : (s.weeklyOff || []) }; }
const holidayOn = d => (attSettings().holidays || []).find(h => h.date === d);
function attDay(e, d) {
  const sh = empShift(e); const rec = attOf(e.id, d); const sess = ((rec && rec.sessions) || []).filter(s => s && s.in); const t = TODAY(); const now = Date.now();
  let mins = 0, open = null;
  for (const s of sess) { const a = Date.parse(s.in); const b = s.out ? Date.parse(s.out) : (d === t ? now : a); if (!s.out) open = s; mins += Math.max(0, b - a) / 6e4; }
  const first = sess.length ? sess[0].in : null; const last = sess.length ? sess[sess.length - 1] : null; const lastOut = last && last.out ? last.out : null;
  const lateMin = first ? Math.max(0, minsOf(first) - hm(sh.start)) : 0; const late = !!first && lateMin > sh.grace;
  const off = sh.weeklyOff.includes(String(parseD(d).getDay())); const hol = holidayOn(d);
  const b = { rec, sess, first, lastOut, mins, open, late, lateMin, off, hol, update: (rec && rec.update) || '', note: (rec && rec.note) || '' };
  const R = (code, label, tone, credit) => ({ ...b, code, label, tone, credit });
  const mk = rec && rec.mark;
  if (e.joinDate && d < e.joinDate) return R('na', 'Not joined yet', 't-neu', 0);
  if (mk === 'leave') return R('leave', 'Leave', 't-info', 0);
  if (mk === 'holiday') return R('holiday', 'Holiday', 't-acc', 0);
  if (mk === 'absent') return R('absent', 'Absent', 't-bad', 0);
  if (mk === 'half') return R('half', 'Half day', 't-warn', .5);
  if (mk === 'wfh') return R('wfh', 'On duty', 't-good', 1);
  if (mk === 'present') return R(late ? 'late' : 'present', late ? 'Late' : 'Present', late ? 't-warn' : 't-good', 1);
  if (sess.length) {
    if (open && d === t) return R('in', late ? 'In · late' : 'In', late ? 't-warn' : 't-good', 1);
    if (open) return R('noout', 'No check-out', 't-warn', 1);
    if (mins < N(attSettings().halfDay) * 60) return R('half', 'Half day', 't-warn', .5);
    return R(late ? 'late' : 'present', late ? 'Late' : 'Present', late ? 't-warn' : 't-good', 1);
  }
  if (d > t) return R('future', '—', 't-neu', 0);
  if (hol) return R('holiday', hol.name || 'Holiday', 't-acc', 0);
  if (off) return R('off', 'Weekly off', 't-neu', 0);
  if (d === t) { const n = new Date(); return (n.getHours() * 60 + n.getMinutes()) <= hm(sh.start) + sh.grace ? R('notyet', 'Not in yet', 't-neu', 0) : R('notin', 'Not checked in', 't-bad', 0); }
  return R('absent', 'Absent', 't-bad', 0);
}
const empCell = e => e ? `<div class="cell-main">${avHTML(e.id, e.name, 'md')}<div><b>${esc(e.name)}</b><small>${esc([e.designation, e.code].filter(Boolean).join(' · '))}</small></div></div>` : '<span class="muted">Removed employee</span>';
const empCellC = e => `<div class="cell-c">${avHTML(e.id, e.name)}<div><b>${esc(e.name)}</b><small>${esc(e.code || e.designation || '')}</small></div></div>`;
const myEmp = () => (ME.id && S.employees.find(e => e.memberId === ME.id && e.status !== 'inactive')) || null;

/* ---------- punching in and out ---------- */
async function appendLog(uid, entry) {
  const day = TODAY(); const path = 'logs/' + uid + '/days/' + day;
  await chain(path, async () => { const sn = await DB.doc(path).get(); const entries = ((sn.exists && sn.data().entries) || []).concat([entry]).slice(-900); await DB.doc(path).set({ date: day, uid, entries }); });
}
const VIA = { kiosk: 'on the kiosk', self: 'from the ERP', manual: 'entered by a manager', edit: 'corrected' };
async function punch(empId, kind, o = {}) {
  const e = empOf(empId); if (!e) throw { userMsg: 'That employee no longer exists.' };
  const d = TODAY(); const rec = attOf(empId, d); const sess = ((rec && rec.sessions) || []).map(s => ({ ...s })); const t = nowISO();
  const open = sess.find(s => !s.out);
  if (kind === 'in') { if (open) throw { userMsg: `${e.name} is already checked in.` }; sess.push(clean({ in: t, inVia: o.via || 'self', inBy: ME.id || null })); }
  else { if (!open) throw { userMsg: `${e.name} isn’t checked in.` }; open.out = t; open.outVia = o.via || 'self'; open.outBy = ME.id || null; }
  const upd = String(o.update || '').trim(); const update = kind === 'out' && upd ? [rec && rec.update, upd].filter(Boolean).join('\n') : ((rec && rec.update) || '');
  await dbWrite('set', 'attendance/' + attKey(empId, d), clean({ ...(rec ? base(rec) : {}), employeeId: empId, date: d, sessions: sess, update, createdAt: (rec && rec.createdAt) || t, updatedAt: t, updatedBy: ME.id || 'kiosk' }));
  const sh = empShift(e); const firstIn = kind === 'in' && sess.length === 1; const lateMin = firstIn ? Math.max(0, minsOf(t) - hm(sh.start)) : 0;
  const mins = sum(sess, s => Math.max(0, Date.parse(s.out || t) - Date.parse(s.in)) / 6e4);
  const s = `${e.name} checked ${kind}`; const det = `${fmtT(t)}${lateMin > sh.grace ? ` · late by ${lateTxt(lateMin)}` : ''}${kind === 'out' ? ' · ' + fmtHrs(mins) + ' today' : ''} · ${VIA[o.via] || ''}${upd ? ' · ' + upd.slice(0, 120) : ''}`;
  if (MODE === 'live' && ME.id && o.via !== 'kiosk') addLog(kind === 'in' ? 'checkin' : 'checkout', 'attendance', s, det);
  else await appendLog('kiosk', { t, u: 'kiosk', a: kind === 'in' ? 'checkin' : 'checkout', m: 'attendance', s, d: det });
  return { t, lateMin, late: lateMin > sh.grace, mins };
}

/* ---------- views ---------- */
V.attendance = () => {
  const can = canEdit('attendance'); const tab = tabOf('att', 'today');
  const tabs = [['today', 'Day view'], ['register', 'Monthly register'], ['records', 'Records'], ['employees', 'Employees', activeEmps().length]]; if (can) tabs.push(['settings', 'Office hours & holidays']);
  let html = ph('Attendance', 'Check-in and check-out times, late marks and working hours. Employees punch in on the check-in kiosk with their own PIN; managers can correct any entry.', [can && tab === 'employees' ? btn('Add employee', 'new:employee', { i: 'plus' }) : '', btn('Open check-in kiosk', 'kiosk', { pri: true, i: 'clock' })].join(''));
  html += tabsHTML('att', tabs, tab);
  if (!S.employees.length && tab !== 'settings') return html + panel('', empty('No employees yet', 'Add the people who should check in and out. Each gets a PIN for the kiosk, and can be linked to their ERP login.', can ? btn('Add employee', 'new:employee', { pri: true, i: 'plus' }) : ''));
  if (tab === 'register') return html + attRegister();
  if (tab === 'records') return html + attRecords();
  if (tab === 'employees') return html + attEmployees(can);
  if (tab === 'settings' && can) return html + attSettingsView();
  return html + attDayView(can);
};
function attDayView(can) {
  const d = ui.attDate && ui.attDate <= TODAY() ? ui.attDate : TODAY(); const isToday = d === TODAY();
  const list = S.employees.filter(e => e.status !== 'inactive' || attOf(e.id, d)).map(e => ({ e, a: attDay(e, d) })).filter(x => x.a.code !== 'na').sort((x, y) => String(x.e.name).localeCompare(String(y.e.name)));
  const c = k => list.filter(x => k.includes(x.a.code)).length;
  const working = list.filter(x => !['off', 'holiday', 'future'].includes(x.a.code));
  let html = `<div class="toolbar"><div class="daypick">${btn('', 'attday:-1', { i: 'back', cls: 'icon', title: 'Previous day' })}<input class="inp" type="date" id="attDate" data-ch="attdate" value="${d}" max="${TODAY()}" aria-label="Day">${btn('', 'attday:1', { i: 'chev', cls: 'icon', title: 'Next day', dis: isToday })}${isToday ? '' : btn('Today', 'attday:0', { sm: true, ghost: true })}</div><b class="dayname">${esc(parseD(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }))}</b>${holidayOn(d) ? pill(holidayOn(d).name || 'Holiday', 't-acc') : ''}<span class="sp"></span>${allow('export') ? btn('Export day', 'attexportday', { sm: true, i: 'dl' }) : ''}</div>`;
  html += kpis([
    { l: 'Employees', v: num(working.length), s: 'expected today' },
    { l: 'Present', v: num(c(['in', 'present', 'late', 'noout', 'half', 'wfh'])), s: working.length ? pct(ratio(c(['in', 'present', 'late', 'noout', 'half', 'wfh']), working.length), 0) + ' turnout' : '' },
    { l: isToday ? 'In right now' : 'No check-out', v: num(isToday ? c(['in']) : c(['noout'])), s: isToday ? 'checked in, not out' : 'forgot to punch out' },
    { l: 'Late', v: num(list.filter(x => x.a.late).length), tone: list.some(x => x.a.late) ? 'neg' : '', s: `after ${t12(attSettings().start)} + ${attSettings().grace} min` },
    { l: isToday ? 'Not in' : 'Absent', v: num(c(['notin', 'absent', 'notyet'])), s: num(c(['leave'])) + ' on leave' },
    { l: 'Hours worked', v: fmtHrs(sum(list, x => x.a.mins)), s: 'all sessions' },
  ]);
  const rows = table('attday', [
    { k: 'e', l: 'Employee', render: x => empCell(x.e), sort: x => x.e.name },
    { k: 'st', l: 'Status', render: x => pill(x.a.label, x.a.tone) + (x.a.late && !/late/i.test(x.a.label) ? ' ' + pill('Late ' + lateTxt(x.a.lateMin), 't-warn', 1) : x.a.late ? ` <small class="muted">${lateTxt(x.a.lateMin)}</small>` : ''), sort: x => x.a.code },
    { k: 'in', l: 'In', num: 1, render: x => x.a.first ? `<span class="tnum">${esc(fmtT(x.a.first))}</span>` : '—', sort: x => x.a.first || '' },
    { k: 'out', l: 'Out', num: 1, render: x => x.a.lastOut ? `<span class="tnum">${esc(fmtT(x.a.lastOut))}</span>` : x.a.open && isToday ? '<span class="muted">in</span>' : '—', sort: x => x.a.lastOut || '' },
    { k: 'h', l: 'Hours', num: 1, render: x => x.a.mins ? fmtHrs(x.a.mins) + (x.a.sess.length > 1 ? `<small class="muted"> · ${x.a.sess.length} sessions</small>` : '') : '—', sort: x => x.a.mins },
    { k: 'u', l: 'Work update', cls: 'wrap', nosort: 1, render: x => x.a.update ? `<span class="upd">${esc(x.a.update)}</span>` : (x.a.note ? `<small class="muted">${esc(x.a.note)}</small>` : '<span class="muted">—</span>') },
    { k: 'a', l: '', nosort: 1, render: x => `<div class="rowacts">${can && isToday && x.e.status !== 'inactive' ? (x.a.open ? btn('Check out', 'attpunch:' + x.e.id + ':out', { sm: true }) : btn('Check in', 'attpunch:' + x.e.id + ':in', { sm: true })) : ''}${btn(can ? 'Edit' : 'View', 'open:att:' + x.e.id + '|' + d, { sm: true, ghost: true })}</div>` },
  ], list, { empty: empty('Nobody to show', 'No active employees on this day.') });
  return html + panel('', rows, { flush: true });
}
function attMonth() { const m = ui.attMonth && /^\d{4}-\d{2}$/.test(ui.attMonth) ? ui.attMonth : TODAY().slice(0, 7); return m; }
function attRegisterData(m) {
  const [a, b] = monthRange(m); const days = []; for (let d = a; d <= b; d = addDays(d, 1)) days.push(d);
  const emps = S.employees.filter(e => e.status !== 'inactive' || S.attendance.some(r => r.employeeId === e.id && r.date >= a && r.date <= b)).sort((x, y) => String(x.name).localeCompare(String(y.name)));
  return { days, rows: emps.map(e => { const cells = days.map(d => attDay(e, d)); const t = { p: 0, half: 0, a: 0, lv: 0, late: 0, off: 0, mins: 0 }; cells.forEach(c => { if (['present', 'late', 'in', 'noout', 'wfh'].includes(c.code)) t.p++; if (c.code === 'half') t.half++; if (['absent', 'notin'].includes(c.code)) t.a++; if (c.code === 'leave') t.lv++; if (c.late) t.late++; if (['off', 'holiday'].includes(c.code)) t.off++; t.mins += c.mins; }); t.paid = t.p + t.half / 2 + t.off; return { e, cells, t }; }) };
}
function attRegister() {
  const m = attMonth(); const { days, rows } = attRegisterData(m); const can = canEdit('attendance'); const T = TODAY();
  let html = `<div class="toolbar"><div class="daypick">${btn('', 'attmon:-1', { i: 'back', cls: 'icon', title: 'Previous month' })}<b class="dayname" style="min-width:120px;text-align:center">${esc(parseD(m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }))}</b>${btn('', 'attmon:1', { i: 'chev', cls: 'icon', title: 'Next month', dis: m >= T.slice(0, 7) })}</div><span class="sp"></span><div class="legend reg-legend"><span><b>P</b> present</span><span><b class="lt">L</b> late</span><span><b class="hf">½</b> half day</span><span><b class="ab">A</b> absent</span><span><b class="lv">LV</b> leave</span><span><b class="ho">H</b> holiday</span><span><b class="wo">W</b> weekly off</span></div>${allow('export') ? btn('Export', 'attexportreg', { sm: true, i: 'dl' }) : ''}</div>`;
  const head = `<tr><th class="sticky">Employee</th>${days.map(d => { const x = parseD(d); return `<th class="d${d === T ? ' today' : ''}${[0].includes(x.getDay()) ? ' wk' : ''}"><span>${x.getDate()}</span><small>${'SMTWTFS'[x.getDay()]}</small></th>`; }).join('')}<th class="num">Present</th><th class="num">½</th><th class="num">Absent</th><th class="num">Leave</th><th class="num">Late</th><th class="num">Paid days</th><th class="num">Hours</th></tr>`;
  const body = rows.map(r => `<tr><td class="sticky">${empCellC(r.e)}</td>${r.cells.map((c, i) => { const code = c.code === 'late' ? 'L' : (c.late && ['in', 'present', 'noout'].includes(c.code) ? 'L' : REG_CODE[c.code]); const cls = { L: 'lt', '½': 'hf', A: 'ab', LV: 'lv', H: 'ho', W: 'wo', OD: 'od' }[code] || ''; const tip = `${fmtD(days[i])} · ${c.label}${c.first ? ' · in ' + fmtT(c.first) : ''}${c.lastOut ? ' · out ' + fmtT(c.lastOut) : ''}${c.mins ? ' · ' + fmtHrs(c.mins) : ''}`; return `<td class="d ${cls}"${code !== '' && code !== '·' ? ` data-act="open:att:${r.e.id}|${days[i]}" role="button" tabindex="0"` : ''} title="${esc(tip)}">${esc(code)}</td>`; }).join('')}<td class="num"><b>${num(r.t.p)}</b></td><td class="num">${num(r.t.half)}</td><td class="num${r.t.a ? ' neg' : ''}">${num(r.t.a)}</td><td class="num">${num(r.t.lv)}</td><td class="num${r.t.late ? ' neg' : ''}">${num(r.t.late)}</td><td class="num"><b>${nf1.format(r.t.paid)}</b></td><td class="num">${fmtHrs(r.t.mins)}</td></tr>`).join('');
  return html + panel('', rows.length ? `<div class="tw"><table class="t reg"><thead>${head}</thead><tbody>${body}</tbody></table></div>` : empty('No employees', 'Add employees to see the register.'), { flush: true, sub: can ? 'Click a day to correct it' : '' }) + `<p class="muted" style="font-size:12px;margin:-6px 0 0">Paid days = present + half days ÷ 2 + weekly offs and holidays. Half day = fewer than ${attSettings().halfDay} hours worked.</p>`;
}
function attRecordRows() {
  const r = periodRange(); const ef = ui.filt.attemp || '';
  return S.attendance.filter(x => inRange(x.date, r) && (!ef || x.employeeId === ef)).map(x => { const e = empOf(x.employeeId) || { id: x.employeeId, name: 'Removed employee' }; return { x, e, a: attDay(e, x.date) }; }).filter(o => matchQ('att', o.e.name, o.a.update, o.a.note)).sort((p, q) => p.x.date < q.x.date ? 1 : p.x.date > q.x.date ? -1 : String(p.e.name).localeCompare(String(q.e.name)));
}
function attRecords() {
  const rows = attRecordRows(); const ef = ui.filt.attemp || '';
  let html = `<div class="toolbar">${searchHTML('att', 'Search name or update…')}<label class="sr" for="attemp">Employee</label><select class="inp" id="attemp" data-ch="filtsel" data-key="attemp" style="width:auto"><option value="">All employees</option>${S.employees.map(e => `<option value="${esc(e.id)}"${ef === e.id ? ' selected' : ''}>${esc(e.name)}</option>`).join('')}</select><span class="sp"></span><span class="muted">${esc(rangeLabel())}</span>${allow('export') ? btn('Export CSV', 'attexport', { sm: true, i: 'dl' }) : ''}</div>`;
  html += panel('', table('attrec', [
    { k: 'date', l: 'Date', render: o => `<b class="tnum">${esc(fmtD(o.x.date))}</b><br><small class="muted">${esc(parseD(o.x.date).toLocaleDateString('en-IN', { weekday: 'long' }))}</small>`, sort: o => o.x.date },
    { k: 'e', l: 'Employee', render: o => empCell(o.e), sort: o => o.e.name },
    { k: 'st', l: 'Status', render: o => pill(o.a.label, o.a.tone) + (o.a.late ? ` <small class="muted">late ${lateTxt(o.a.lateMin)}</small>` : ''), sort: o => o.a.code },
    { k: 'in', l: 'In', num: 1, render: o => o.a.first ? esc(fmtT(o.a.first)) : '—' },
    { k: 'out', l: 'Out', num: 1, render: o => o.a.lastOut ? esc(fmtT(o.a.lastOut)) : '—' },
    { k: 'h', l: 'Hours', num: 1, render: o => o.a.mins ? fmtHrs(o.a.mins) : '—', sort: o => o.a.mins },
    { k: 'u', l: 'Work update', cls: 'wrap', nosort: 1, render: o => esc(o.a.update || o.a.note || '') || '<span class="muted">—</span>' },
    { k: 'ed', l: '', nosort: 1, render: o => o.x.edited ? pill('Corrected', 't-info', 1) : '' },
  ], rows, { limit: 200, open: o => 'open:att:' + o.x.employeeId + '|' + o.x.date, empty: empty('No attendance in this period', 'Change the period at the top, or pick another employee.') }), { flush: true, sub: num(rows.length) + ' days' });
  return html;
}
function attEmployees(can) {
  const f = filtOf('empst', 'active'); const list = S.employees.filter(e => f === 'all' || (f === 'active' ? e.status !== 'inactive' : e.status === 'inactive')).filter(e => matchQ('emp', e.name, e.code, e.designation, e.department, e.phone));
  let html = `<div class="toolbar">${searchHTML('emp', 'Search employees…')}${chipsHTML('empst', [['active', 'Active', S.employees.filter(e => e.status !== 'inactive').length], ['inactive', 'Inactive', S.employees.filter(e => e.status === 'inactive').length], ['all', 'All']], f)}</div>`;
  html += panel('', table('emps', [
    { k: 'code', l: 'Code', render: e => `<span class="mono">${esc(e.code || '—')}</span>` },
    { k: 'name', l: 'Employee', render: e => empCell(e), sort: e => e.name },
    { k: 'department', l: 'Department', render: e => esc(e.department || '—') },
    { k: 'phone', l: 'Phone', render: e => `<span class="tnum">${esc(e.phone || '—')}</span>` },
    { k: 'shift', l: 'Shift', nosort: 1, render: e => { const s = empShift(e); return `<span class="tnum">${esc(t12(s.start))} – ${esc(t12(s.end))}</span>${e.shiftStart || e.shiftEnd ? '' : ' <small class="muted">default</small>'}`; } },
    { k: 'off', l: 'Weekly off', nosort: 1, render: e => esc(empShift(e).weeklyOff.map(k => (WEEKDAYS.find(w => w[0] === k) || [, k])[1]).join(', ') || 'None') },
    { k: 'pin', l: 'Kiosk PIN', nosort: 1, render: e => (e.hasPin || (e.pin && e.pin.hash)) ? pill('Set', 't-good', 1) : pill('Not set', 't-warn', 1) },
    { k: 'login', l: 'ERP login', nosort: 1, render: e => e.memberId && memberMap()[e.memberId] ? personHTML(e.memberId) : '<span class="muted">—</span>' },
    { k: 'status', l: 'Status', render: e => pill(e.status === 'inactive' ? 'Inactive' : 'Active', e.status === 'inactive' ? 't-neu' : 't-good') },
  ], list, { open: e => 'open:employee:' + e.id, empty: empty('No employees match', 'Try another search or filter.') }), { flush: true });
  return html;
}
function attSettingsView() {
  const s = attSettings(); const hol = (s.holidays || []).slice().sort((a, b) => a.date < b.date ? -1 : 1); const T = TODAY();
  const f = [
    { n: 'start', l: 'Office starts', t: 'time', req: 1 }, { n: 'end', l: 'Office ends', t: 'time', req: 1 },
    { n: 'grace', l: 'Grace period', t: 'number', suf: 'min', min: 0, help: 'Check-ins after start + grace are marked late.' },
    { n: 'halfDay', l: 'Half day below', t: 'number', suf: 'hrs', min: 0, step: '0.5', help: 'Days with fewer hours worked count as half days.' },
    { n: 'weeklyOff', l: 'Weekly off', t: 'multi', full: 1, o: WEEKDAYS },
    { n: 'requirePin', l: 'Kiosk', t: 'check', cl: 'Employees must enter their PIN at the check-in kiosk', full: 1 },
  ];
  const hours = panel('Office hours', `<div id="attSetForm">${form(f, s)}</div><div style="display:flex;justify-content:flex-end;margin-top:14px">${btn('Save office hours', 'attsetsave', { pri: true })}</div>`, { sub: 'Each employee can have their own shift and weekly off' });
  const holHTML = `<div class="holadd"><input class="inp" type="date" id="holD" aria-label="Holiday date" value="${T}"><input class="inp" id="holN" placeholder="Holiday name, e.g. Pongal" maxlength="60" aria-label="Holiday name">${btn('Add holiday', 'holadd', { i: 'plus' })}</div>
  ${hol.length ? `<div class="list" style="margin-top:12px">${hol.map(h => `<div class="li"><span class="tnum" style="width:110px">${esc(fmtD(h.date))}</span><div class="grow"><b>${esc(h.name || 'Holiday')}</b><small>${esc(parseD(h.date).toLocaleDateString('en-IN', { weekday: 'long' }))}${h.date < T ? ' · past' : ''}</small></div>${btn('Remove', 'holrm:' + h.date, { sm: true, ghost: true })}</div>`).join('')}</div>` : '<p class="muted" style="margin:12px 0 0">No holidays added yet.</p>'}`;
  return `<div class="g2">${hours}${panel('Company holidays', holHTML, { sub: 'Counted as paid days in the register' })}</div>`;
}

/* ---------- editors ---------- */
EDIT.employee = id => {
  const e = id ? empOf(id) : null; const can = canEdit('attendance'); const sh = attSettings();
  const f = [
    { n: 'name', l: 'Full name', req: 1 }, { n: 'code', l: 'Employee code', mono: 1, req: 1 },
    { n: 'designation', l: 'Designation', ph: 'e.g. Packing associate' }, { n: 'department', l: 'Department', ph: 'e.g. Warehouse' },
    { n: 'phone', l: 'Phone', t: 'tel' }, { n: 'joinDate', l: 'Joining date', t: 'date' },
    { n: 'shiftStart', l: 'Shift starts', t: 'time', help: `Blank uses office hours (${t12(sh.start)})` }, { n: 'shiftEnd', l: 'Shift ends', t: 'time', help: `Blank uses office hours (${t12(sh.end)})` },
    { n: 'weeklyOff', l: 'Weekly off', t: 'multi', full: 1, o: WEEKDAYS, help: 'Leave all unticked to use the company weekly off.' },
    { n: 'newPin', l: e && (e.hasPin || (e.pin && e.pin.hash)) ? 'New kiosk PIN' : 'Kiosk PIN', t: 'password', help: e && (e.hasPin || (e.pin && e.pin.hash)) ? 'A PIN is set. Leave blank to keep it.' : '4 to 8 digits, used at the check-in kiosk.' },
    { n: 'memberId', l: 'ERP login', t: 'select', blank: 'No ERP login', o: () => liveMembers().map(m => [m.id, m.name]), help: 'Linked people can check in from the top bar of the ERP.' },
    { n: 'status', l: 'Status', t: 'select', o: [['active', 'Active'], ['inactive', 'Inactive (left the company)']] },
    { n: 'notes', l: 'Notes', t: 'textarea', rows: 2, full: 1 },
  ];
  openDrawer({
    title: e ? e.name : 'Add employee', sub: e ? esc([e.designation, e.code].filter(Boolean).join(' · ')) : 'Employees check in and out on the kiosk with their PIN.', readOnly: !can, delKey: 'employees/' + id,
    html: form(f, e || { code: nextNum(S.employees, 'code', 'EMP-'), status: 'active', joinDate: TODAY(), weeklyOff: [] }),
    validate: v => { const x = []; if (v.newPin && !pinOK(v.newPin)) x.push({ n: 'newPin', m: 'Use 4 to 8 digits' }); if (!e && !v.newPin && attSettings().requirePin) x.push({ n: 'newPin', m: 'Set a PIN for the kiosk' }); if (S.employees.some(o => o.id !== id && String(o.code || '').toUpperCase() === String(v.code || '').toUpperCase())) x.push({ n: 'code', m: 'Another employee has this code' }); if (v.memberId && S.employees.some(o => o.id !== id && o.memberId === v.memberId && o.status !== 'inactive')) x.push({ n: 'memberId', m: 'Already linked to another employee' }); return x; },
    onSave: async v => { const { newPin, ...rest } = v; const doc = { ...base(e), ...rest, code: String(v.code || '').toUpperCase() }; if (newPin) doc.pin = await hashPin(newPin); await saveDoc('employees', id, doc, ['attendance', `Employee ${v.name}${newPin && e ? ' (new PIN)' : ''}`]); },
    onDelete: e ? delFn('employees', id, 'attendance', 'Employee ' + e.name) : null,
    confirmText: 'Delete this employee? Their attendance history stays. Marking them Inactive is usually better.',
  });
};
EDIT.att = key => {
  const [empId, d] = String(key).split('|'); const e = empOf(empId) || { id: empId, name: 'Removed employee' }; const rec = attOf(empId, d); const a = attDay(e, d); const can = canEdit('attendance');
  const v0 = { mark: (rec && rec.mark) || '', inTime: a.first ? hhmm(a.first) : '', outTime: a.lastOut ? hhmm(a.lastOut) : '', update: (rec && rec.update) || '', note: (rec && rec.note) || '' };
  const sessHTML = a.sess.length ? `<div class="subh" style="margin-top:4px">Punches</div><div class="list bordered">${a.sess.map((s, i) => `<div class="li"><span class="sev ${s.out ? 'good' : 'warn'}"></span><div class="grow"><b class="tnum">${esc(fmtT(s.in))} → ${s.out ? esc(fmtT(s.out)) : 'still in'}</b><small>Session ${i + 1} · in ${esc(VIA[s.inVia] || s.inVia || '')}${s.out ? ' · out ' + esc(VIA[s.outVia] || s.outVia || '') : ''}</small></div><span class="tnum muted">${fmtHrs((Date.parse(s.out || (d === TODAY() ? nowISO() : s.in)) - Date.parse(s.in)) / 6e4)}</span></div>`).join('')}</div>` : '';
  const f = [
    { n: 'mark', l: 'Mark the day as', t: 'select', o: ATT_MARKS, full: 1 },
    { n: 'inTime', l: 'Checked in at', t: 'time' }, { n: 'outTime', l: 'Checked out at', t: 'time', help: a.sess.length > 1 ? 'Changing either time replaces all punches with one session.' : '' },
    { n: 'update', l: 'Work update', t: 'textarea', rows: 3, full: 1, ph: 'What they worked on. Shows in the daily PDF report.' },
    { n: 'note', l: 'Manager note', full: 1, ph: 'e.g. Sick leave approved, forgot to punch out' },
  ];
  openDrawer({
    title: e.name, sub: `${esc(parseD(d).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · ${esc(a.label)}`, readOnly: !can, delKey: rec ? 'attendance/' + rec.id : '',
    top: kvHTML([['Status', esc(a.label)], ['First in', a.first ? esc(fmtT(a.first)) : '—'], ['Last out', a.lastOut ? esc(fmtT(a.lastOut)) : '—'], ['Hours', a.mins ? fmtHrs(a.mins) : '—']]) + sessHTML,
    html: form(f, v0),
    validate: v => { const x = []; if (v.outTime && !v.inTime) x.push({ n: 'inTime', m: 'Add the check-in time too' }); if (v.inTime && v.outTime && v.outTime <= v.inTime) x.push({ n: 'outTime', m: 'Must be after check-in' }); if (d === TODAY() && v.inTime && isoAt(d, v.inTime) > nowISO()) x.push({ n: 'inTime', m: 'That time hasn’t happened yet' }); return x; },
    onSave: async v => {
      let sessions = (rec && rec.sessions) || [];
      if (v.inTime !== v0.inTime || v.outTime !== v0.outTime) sessions = v.inTime ? [clean({ in: isoAt(d, v.inTime), inVia: 'edit', out: v.outTime ? isoAt(d, v.outTime) : undefined, outVia: v.outTime ? 'edit' : undefined })] : [];
      const doc = clean({ ...(rec ? base(rec) : {}), employeeId: empId, date: d, sessions, mark: v.mark || null, update: v.update, note: v.note, edited: true, editedBy: ME.id, editedAt: nowISO(), createdAt: (rec && rec.createdAt) || nowISO(), updatedAt: nowISO(), updatedBy: ME.id });
      const ch = []; if (v.mark !== v0.mark) ch.push(`Mark: ${(ATT_MARKS.find(m => m[0] === v0.mark) || [, 'Automatic'])[1]} → ${(ATT_MARKS.find(m => m[0] === v.mark) || [, 'Automatic'])[1]}`); if (v.inTime !== v0.inTime) ch.push(`In: ${v0.inTime ? t12(v0.inTime) : '—'} → ${v.inTime ? t12(v.inTime) : '—'}`); if (v.outTime !== v0.outTime) ch.push(`Out: ${v0.outTime ? t12(v0.outTime) : '—'} → ${v.outTime ? t12(v.outTime) : '—'}`); if (v.update !== v0.update) ch.push('Work update edited'); if (v.note !== v0.note) ch.push('Note: ' + (v.note || '—'));
      if (!ch.length) return;
      await dbWrite('set', 'attendance/' + attKey(empId, d), doc);
      addLog('update', 'attendance', `Attendance for ${e.name} on ${fmtD(d)}`, ch.join('; '));
    },
    onDelete: rec ? delFn('attendance', rec.id, 'attendance', `Attendance of ${e.name} on ${fmtD(d)}`) : null,
  });
};
function selfCheckout(empId) {
  const e = empOf(empId); if (!e) return; const a = attDay(e, TODAY());
  openDrawer({
    title: 'Check out', sub: `${esc(e.name)} · in since ${a.first ? esc(fmtT(a.sess.find(s => !s.out) ? a.sess.find(s => !s.out).in : a.first)) : '—'} · ${fmtHrs(a.mins)} so far`, saveLabel: 'Check out', savedMsg: null,
    html: form([{ n: 'update', l: 'What did you work on today?', t: 'textarea', rows: 5, full: 1, ph: 'e.g. Packed and dispatched 42 Amazon orders, listed 6 new leather sheets, followed up with the Ambur supplier.', help: 'Goes into today’s daily PDF report.' }], {}),
    onSave: async v => { const r = await punch(empId, 'out', { via: ME.id && e.memberId === ME.id ? 'self' : 'manual', update: v.update }); toast(`${e.name} checked out at ${fmtT(r.t)} · ${fmtHrs(r.mins)} today`); },
  });
}

/* ---------- check-in kiosk (runs against the server, so it works signed out on a kiosk device) ---------- */
const KIOSK = { open: false, from: 'gate', step: 'grid', empId: null, pin: '', err: '', busy: false, res: null, q: '', timer: null, clock: null, st: null, poll: null };
const kioskHeaders = () => { const t = KIOSK_TOKEN(); return t ? { 'X-Kiosk': t } : {}; };
async function kioskLoad() { try { KIOSK.st = await api('GET', '/api/kiosk/state', undefined, { headers: kioskHeaders(), noAuthRedirect: true }); KIOSK.err = KIOSK.step === 'grid' ? '' : KIOSK.err; } catch (e) { KIOSK.st = KIOSK.st || null; KIOSK.loadErr = e.userMsg; } if (KIOSK.open) renderKioskKeepText(); }
function openKiosk() {
  KIOSK.open = true; KIOSK.from = MODE === 'live' ? 'app' : 'gate'; KIOSK.step = 'grid'; KIOSK.empId = null; KIOSK.pin = ''; KIOSK.err = ''; KIOSK.q = ''; KIOSK.loadErr = '';
  if (DRW.cfg) closeDrawer(); renderGate(); renderKiosk(); kioskLoad();
  clearInterval(KIOSK.clock); KIOSK.clock = setInterval(() => { const c = $('#kclock'); if (c) c.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }, 1000);
  clearInterval(KIOSK.poll); KIOSK.poll = setInterval(() => { if (KIOSK.step === 'grid') kioskLoad(); }, 30000);
}
function closeKiosk() { KIOSK.open = false; clearInterval(KIOSK.clock); clearInterval(KIOSK.poll); clearTimeout(KIOSK.timer); const k = $('#kiosk'); k.hidden = true; k.innerHTML = ''; if (location.pathname === '/kiosk') history.replaceState(null, '', '/'); renderGate(); if (MODE === 'live') bump(); }
function kioskHome() { clearTimeout(KIOSK.timer); KIOSK.step = 'grid'; KIOSK.empId = null; KIOSK.pin = ''; KIOSK.err = ''; KIOSK.res = null; renderKiosk(); kioskLoad(); }
const kEmp = id => ((KIOSK.st && KIOSK.st.employees) || []).find(e => e.id === id);
function renderKiosk() {
  const k = $('#kiosk'); if (!KIOSK.open) { k.hidden = true; return; } k.hidden = false;
  const now = new Date(); const st = KIOSK.st;
  const hol = st && st.holidays && st.holidays.length ? `<div class="k-hol">${icon('calendar')}<span>Upcoming holidays:</span>${st.holidays.slice(0, 4).map(h => `<b>${esc(h.name || 'Holiday')}</b><small>${esc(fmtDs(h.date))}</small>`).join('<i>·</i>')}</div>` : '';
  const head = `<header class="k-head"><div class="k-brand"><img src="assets/mark.png" alt=""><div><b>Attendance</b><small>${esc((st && st.company) || company().name)}</small></div></div><div class="k-clock"><b id="kclock" class="tnum">${esc(now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))}</b><small>${esc(now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</small></div><button class="btn" data-act="kclose">${icon('x')}${KIOSK.from === 'app' ? 'Back to ERP' : 'Close'}</button></header>`;
  let body = '';
  const e = KIOSK.empId ? kEmp(KIOSK.empId) : null;
  if (!st) body = KIOSK.loadErr ? `<div class="k-panel"><div class="gate-err">${esc(KIOSK.loadErr)}</div><p class="muted" style="margin:0">A manager can set this device up as a kiosk in Attendance → Office hours & kiosks.</p></div>` : '<div class="loading"><div class="spin"></div>Loading…</div>';
  else if (KIOSK.step === 'grid' || !e) {
    const emps = st.employees.filter(x => !KIOSK.q || String(x.name + ' ' + (x.code || '')).toLowerCase().includes(KIOSK.q.toLowerCase()));
    body = `<div class="k-intro"><h1>Tap your name</h1><p>Then enter your PIN to check in or out.</p>${st.employees.length > 10 ? `<div class="search k-search">${icon('search')}<input class="inp" id="kq" placeholder="Find your name" value="${esc(KIOSK.q)}" autocomplete="off"></div>` : ''}</div>${hol}
    <div class="k-grid">${emps.map(x => { const s = x.open ? `<span class="k-st in">In since ${esc(fmtT(x.open))}</span>` : x.lastOut ? `<span class="k-st out">Out at ${esc(fmtT(x.lastOut))}</span>` : x.mark === 'leave' ? '<span class="k-st">On leave</span>' : '<span class="k-st">Not checked in</span>'; return `<button class="k-tile${x.open ? ' is-in' : ''}" data-act="kpick:${esc(x.id)}">${avHTML(x.id, x.name, 'xl')}<b>${esc(x.name)}</b><small>${esc(x.designation || x.code || '')}</small>${s}</button>`; }).join('') || `<div class="empty"><h3>No employees${KIOSK.q ? ' match' : ' yet'}</h3><p>${KIOSK.q ? 'Try another spelling.' : 'A manager can add employees in Attendance → Employees.'}</p></div>`}</div>`;
  } else if (KIOSK.step === 'pin') {
    body = `<div class="k-panel"><button class="gate-back" data-act="khome">${icon('back')}Not you?</button><div class="k-who">${avHTML(e.id, e.name, 'xxl')}<div><h2>${esc(e.name)}</h2><small>${esc(e.designation || '')}</small></div></div>
    ${!e.hasPin ? `<div class="gate-err">No PIN is set for you yet. Ask a manager to set one in Attendance → Employees.</div>` : `<div class="k-dots" aria-label="PIN entered">${Array.from({ length: Math.max(4, KIOSK.pin.length) }, (_, i) => `<i class="${i < KIOSK.pin.length ? 'on' : ''}"></i>`).join('')}</div>
    ${KIOSK.err ? `<div class="gate-err">${esc(KIOSK.err)}</div>` : '<p class="k-hint">Enter your PIN</p>'}
    <div class="k-pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map(x => `<button data-act="kkey:${x === '⌫' ? 'bk' : x === 'C' ? 'clr' : x}" class="${/\d/.test(x) ? '' : 'fn'}">${x === 'C' ? 'Clear' : x}</button>`).join('')}</div>
    <button class="btn pri block lg" data-act="kpin"${KIOSK.busy || KIOSK.pin.length < 4 ? ' disabled' : ''}>${KIOSK.busy ? 'Checking…' : 'Continue'}</button>`}</div>`;
  } else if (KIOSK.step === 'act') {
    const status = e.open ? `Checked in at <b>${esc(fmtT(e.open))}</b> · ${fmtHrs(e.mins)} so far` : e.lastOut ? `Checked out at <b>${esc(fmtT(e.lastOut))}</b> · ${fmtHrs(e.mins)} today` : 'Not checked in yet today';
    body = `<div class="k-panel wide"><button class="gate-back" data-act="khome">${icon('back')}Done</button><div class="k-who">${avHTML(e.id, e.name, 'xxl')}<div><h2>${esc(e.name)}</h2><small>${status}</small></div></div>
    ${e.open ? `<div class="fld"><label for="kupd">What did you work on today? <span class="muted">(goes into the daily report)</span></label><textarea class="inp" id="kupd" rows="4" placeholder="e.g. Packed 40 orders, cut 20 leather panels, cleaned the kiln room"></textarea></div><button class="btn block xl out" data-act="kgo:out"${KIOSK.busy ? ' disabled' : ''}>${icon('logout')}Check out</button>`
      : `<button class="btn pri block xl" data-act="kgo:in"${KIOSK.busy ? ' disabled' : ''}>${icon('login')}${e.lastOut ? 'Check in again' : 'Check in'}</button>${e.lastOut ? '<p class="k-hint">Use this if you are back after a break.</p>' : ''}`}
    ${KIOSK.err ? `<div class="gate-err">${esc(KIOSK.err)}</div>` : ''}</div>`;
  } else if (KIOSK.step === 'done') {
    const r = KIOSK.res || {}; const hr = new Date().getHours();
    body = `<div class="k-panel k-done"><div class="k-ok ${r.kind}">${icon(r.kind === 'in' ? 'check' : 'logout')}</div><h2>${r.kind === 'in' ? (hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening') : 'Thank you'}, ${esc(String(r.name || '').split(' ')[0])}</h2><p class="k-big tnum">${r.kind === 'in' ? 'Checked in' : 'Checked out'} at ${esc(fmtT(r.t))}</p>${r.kind === 'in' && r.late ? `<p>${pill('Late by ' + lateTxt(r.lateMin), 't-warn')}</p>` : ''}${r.kind === 'out' ? `<p class="muted">${fmtHrs(r.mins)} worked today</p>` : ''}<button class="btn" data-act="khome">Done</button></div>`;
  }
  k.innerHTML = `<div class="k-wrap">${head}<main class="k-body">${body}</main></div>`;
  const q = $('#kq'); if (q) { q.oninput = () => { KIOSK.q = q.value; const p = q.selectionStart; renderKiosk(); const n = $('#kq'); if (n) { n.focus(); n.setSelectionRange(p, p); } }; }
  const u = $('#kupd'); if (u && document.activeElement !== u) setTimeout(() => u.focus(), 40);
}
async function kioskPin() {
  const e = kEmp(KIOSK.empId); if (!e || KIOSK.busy) return; KIOSK.busy = true; renderKiosk();
  try { await api('POST', '/api/kiosk/verify', { employeeId: e.id, pin: KIOSK.pin }, { headers: kioskHeaders(), noAuthRedirect: true }); KIOSK.verified = KIOSK.pin; KIOSK.err = ''; KIOSK.step = 'act'; }
  catch (x) { KIOSK.err = x.userMsg || 'That PIN isn’t right.'; }
  finally { KIOSK.pin = ''; KIOSK.busy = false; renderKiosk(); }
}
async function kioskGo(kind) {
  const e = kEmp(KIOSK.empId); if (!e || KIOSK.busy) return; const upd = (($('#kupd') || {}).value || ''); KIOSK.busy = true; renderKioskKeepText();
  try { const r = await api('POST', '/api/kiosk/punch', { employeeId: e.id, pin: KIOSK.verified || '', kind, update: upd }, { headers: kioskHeaders(), noAuthRedirect: true }); KIOSK.res = r; KIOSK.step = 'done'; KIOSK.err = ''; KIOSK.verified = ''; clearTimeout(KIOSK.timer); KIOSK.timer = setTimeout(kioskHome, 6000); }
  catch (x) { KIOSK.err = x.userMsg || 'That didn’t save. Try again.'; }
  finally { KIOSK.busy = false; renderKiosk(); }
}
function renderKioskKeepText() { const u = $('#kupd'); const t = u ? u.value : null; renderKiosk(); const n = $('#kupd'); if (n && t !== null) n.value = t; }
document.addEventListener('keydown', ev => {
  if (!KIOSK.open) return;
  if (ev.key === 'Escape') { if (KIOSK.step === 'grid') closeKiosk(); else kioskHome(); ev.preventDefault(); return; }
  if (KIOSK.step !== 'pin') return;
  if (/^\d$/.test(ev.key)) { if (KIOSK.pin.length < 8) { KIOSK.pin += ev.key; KIOSK.err = ''; renderKiosk(); } ev.preventDefault(); }
  else if (ev.key === 'Backspace') { KIOSK.pin = KIOSK.pin.slice(0, -1); renderKiosk(); ev.preventDefault(); }
  else if (ev.key === 'Enter' && KIOSK.pin.length >= 4) { kioskPin(); ev.preventDefault(); }
}, true);
function kioskPick(id) {
  const e = kEmp(id); if (!e) return; KIOSK.empId = id; KIOSK.pin = ''; KIOSK.err = ''; KIOSK.verified = '';
  KIOSK.step = (KIOSK.st.requirePin || e.hasPin) ? 'pin' : 'act'; renderKiosk();
}

/* ---------- attendance for the dashboard and top bar ---------- */
function attTodayPanel() {
  if (!canView('attendance') || !S.employees.length) return '';
  const list = activeEmps().map(e => ({ e, a: attDay(e, TODAY()) })).filter(x => !['na', 'off', 'holiday'].includes(x.a.code));
  const inN = list.filter(x => x.a.open).length, pres = list.filter(x => x.a.credit > 0).length, late = list.filter(x => x.a.late).length, out = list.filter(x => ['notin', 'notyet'].includes(x.a.code)).length;
  const body = `<div class="attmini"><div><b>${num(pres)}<small>/${num(list.length)}</small></b><span>present</span></div><div><b>${num(inN)}</b><span>in now</span></div><div><b class="${late ? 'neg' : ''}">${num(late)}</b><span>late</span></div><div><b>${num(out)}</b><span>not in</span></div></div>
  <div class="list">${list.slice(0, 7).map(x => `<div class="li">${avHTML(x.e.id, x.e.name)}<div class="grow"><b>${esc(x.e.name)}</b><small>${x.a.first ? 'In ' + esc(fmtT(x.a.first)) : esc(x.a.label)}${x.a.lastOut ? ' · out ' + esc(fmtT(x.a.lastOut)) : ''}</small></div>${pill(x.a.label, x.a.tone, 1)}</div>`).join('')}</div>`;
  return panel('Attendance today', body, { flush: true, right: btn('Attendance', 'go:attendance', { sm: true, ghost: true }) });
}
function topCheckBtn() {
  const e = myEmp(); if (!e) return '';
  const a = attDay(e, TODAY());
  return a.open ? `<button class="btn chk-btn in" data-act="selfout" title="Checked in at ${esc(fmtT(a.open.in))}"><span class="dot"></span>In since ${esc(fmtT(a.open.in))}<span class="sep"></span>Check out</button>` : `<button class="btn chk-btn" data-act="selfin">${icon('login')}${a.lastOut ? 'Check in again' : 'Check in'}</button>`;
}
function attRegisterCSV() {
  const m = attMonth(); const { days, rows } = attRegisterData(m);
  const cols = [{ l: 'Code', csv: r => r.e.code || '' }, { l: 'Employee', csv: r => r.e.name }, ...days.map((d, i) => ({ l: String(parseD(d).getDate()), csv: r => { const c = r.cells[i]; return c.late && ['in', 'present', 'noout', 'late'].includes(c.code) ? 'L' : REG_CODE[c.code]; } })), { l: 'Present', csv: r => r.t.p }, { l: 'Half days', csv: r => r.t.half }, { l: 'Absent', csv: r => r.t.a }, { l: 'Leave', csv: r => r.t.lv }, { l: 'Late', csv: r => r.t.late }, { l: 'Paid days', csv: r => r.t.paid }, { l: 'Hours', csv: r => (r.t.mins / 60).toFixed(2) }];
  return { name: 'Attendance register ' + m, cols, rows };
}
Object.assign(ACT, {
  kiosk() { openKiosk(); }, kclose() { closeKiosk(); }, khome() { kioskHome(); }, kpick(id) { kioskPick(id); }, kpin() { kioskPin(); }, kgo(kind) { kioskGo(kind); },
  kkey(x) { if (x === 'bk') KIOSK.pin = KIOSK.pin.slice(0, -1); else if (x === 'clr') KIOSK.pin = ''; else if (KIOSK.pin.length < 8) KIOSK.pin += x; KIOSK.err = ''; renderKiosk(); },
  attday(n) { const cur = ui.attDate && ui.attDate <= TODAY() ? ui.attDate : TODAY(); ui.attDate = +n === 0 ? TODAY() : addDays(cur, +n); if (ui.attDate > TODAY()) ui.attDate = TODAY(); schedule(); },
  attmon(n) { const m = attMonth(); const x = addMonths(m + '-01', +n).slice(0, 7); ui.attMonth = x > TODAY().slice(0, 7) ? TODAY().slice(0, 7) : x; schedule(); },
  attpunch(id, kind) { if (!canEdit('attendance')) return; if (kind === 'out') { selfCheckout(id); return; } guarded(async () => { const e = empOf(id); const r = await punch(id, 'in', { via: e && e.memberId === ME.id ? 'self' : 'manual' }); toast(`${e.name} checked in at ${fmtT(r.t)}${r.late ? ' · late by ' + lateTxt(r.lateMin) : ''}`); }); },
  selfin() { const e = myEmp(); if (!e) return; guarded(async () => { const r = await punch(e.id, 'in', { via: 'self' }); toast(`Checked in at ${fmtT(r.t)}${r.late ? ' · late by ' + lateTxt(r.lateMin) : ''}`); }); },
  selfout() { const e = myEmp(); if (e) selfCheckout(e.id); },
  attsetsave() { const { vals, errs } = readForm($('#attSetForm')); if (errs.length) { toast('Office start and end times are required.', 'bad'); return; } if (vals.end <= vals.start) { toast('Office must end after it starts.', 'bad'); return; } guarded(async () => { const prev = attSettings(); const next = { ...prev, ...vals, grace: N(vals.grace), halfDay: N(vals.halfDay), weeklyOff: vals.weeklyOff || [] }; await dbWrite('set', 'settings/attendance', clean({ ...next, updatedAt: nowISO(), updatedBy: ME.id })); addLog('settings', 'attendance', 'Office hours updated', diffText({ start: prev.start, end: prev.end, grace: prev.grace, halfDay: prev.halfDay, requirePin: prev.requirePin }, { start: next.start, end: next.end, grace: next.grace, halfDay: next.halfDay, requirePin: next.requirePin })); toast('Office hours saved'); }); },
  holadd() { const d = ($('#holD') || {}).value, n = (($('#holN') || {}).value || '').trim(); if (!d) { toast('Pick a date for the holiday.', 'bad'); return; } const s = attSettings(); if ((s.holidays || []).some(h => h.date === d)) { toast('That date is already a holiday.', 'bad'); return; } guarded(async () => { await dbWrite('set', 'settings/attendance', clean({ ...s, holidays: [...(s.holidays || []), { date: d, name: n || 'Holiday' }], updatedAt: nowISO(), updatedBy: ME.id })); addLog('settings', 'attendance', `Holiday added: ${n || 'Holiday'} on ${fmtD(d)}`); }); },
  holrm(d) { const s = attSettings(); const h = (s.holidays || []).find(x => x.date === d); guarded(async () => { await dbWrite('set', 'settings/attendance', clean({ ...s, holidays: (s.holidays || []).filter(x => x.date !== d), updatedAt: nowISO(), updatedBy: ME.id })); addLog('settings', 'attendance', `Holiday removed: ${(h && h.name) || ''} on ${fmtD(d)}`); }); },
  attexport() { const rows = attRecordRows(); exportCSV('Attendance', [{ l: 'Date', csv: o => o.x.date }, { l: 'Code', csv: o => o.e.code || '' }, { l: 'Employee', csv: o => o.e.name }, { l: 'Status', csv: o => o.a.label }, { l: 'Late (min)', csv: o => o.a.late ? o.a.lateMin : '' }, { l: 'In', csv: o => o.a.first ? fmtT(o.a.first) : '' }, { l: 'Out', csv: o => o.a.lastOut ? fmtT(o.a.lastOut) : '' }, { l: 'Hours', csv: o => (o.a.mins / 60).toFixed(2) }, { l: 'Work update', csv: o => o.a.update }, { l: 'Note', csv: o => o.a.note }, { l: 'Corrected', csv: o => o.x.edited ? 'Yes' : '' }], rows, 'attendance'); },
  attexportday() { const d = ui.attDate && ui.attDate <= TODAY() ? ui.attDate : TODAY(); const rows = S.employees.map(e => ({ e, a: attDay(e, d) })).filter(x => x.a.code !== 'na' && (x.e.status !== 'inactive' || x.a.rec)); exportCSV('Attendance ' + d, [{ l: 'Code', csv: x => x.e.code || '' }, { l: 'Employee', csv: x => x.e.name }, { l: 'Status', csv: x => x.a.label }, { l: 'In', csv: x => x.a.first ? fmtT(x.a.first) : '' }, { l: 'Out', csv: x => x.a.lastOut ? fmtT(x.a.lastOut) : '' }, { l: 'Hours', csv: x => (x.a.mins / 60).toFixed(2) }, { l: 'Late (min)', csv: x => x.a.late ? x.a.lateMin : '' }, { l: 'Work update', csv: x => x.a.update }], rows, 'attendance'); },
  attexportreg() { const x = attRegisterCSV(); exportCSV(x.name, x.cols, x.rows, 'attendance'); },
});
Object.assign(CH, { attdate(v) { if (v) { ui.attDate = v > TODAY() ? TODAY() : v; schedule(); } } });
