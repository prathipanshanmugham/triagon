/* =====================================================================
   AI agents & API: keys that let Claude (MCP) or any script read and
   write ERP data as a chosen team member, with every change logged
   ===================================================================== */
const AIK = { loaded: false, busy: false, list: [], err: '' };
async function loadKeys() { if (realRole() !== 'ceo') return; AIK.busy = true; try { AIK.list = await api('GET', '/api/keys'); AIK.err = ''; } catch (e) { AIK.err = e.userMsg || 'Couldn’t load keys'; } AIK.loaded = true; AIK.busy = false; schedule(); }
const baseURL = () => { if (!APPINFO.v) loadAppInfo(); return ((APPINFO.v && APPINFO.v.publicUrl) || location.origin).replace(/\/$/, ''); };
{
  const us0 = V.users;
  V.users = () => {
    if (tabOf('usr', 'team') !== 'ai') return us0().replace(/(data-act="tab:usr:company">[^<]*<\/button>)/, '$1<button class="tab" role="tab" aria-selected="false" data-act="tab:usr:ai">AI & API access</button>');
    const manage = canManageTeam();
    let html = ph('Users & permissions', 'Connect Claude or other AI agents and scripts to the ERP. Each key works as one team member, so their role and brand limits apply, and every change is recorded in the activity log.', manage ? btn('Create key', 'aikeynew', { pri: true, i: 'key' }) : '');
    html += tabsHTML('usr', [['team', 'Team', liveMembers().length], ['roles', 'Roles & permissions', Object.keys(roleDefs()).length + 1], ['company', 'Company & audit'], ['ai', 'AI & API access', AIK.list.length || '']], 'ai');
    if (realRole() !== 'ceo') return html + panel('', empty('CEO only', 'Only the CEO can create and manage AI and API keys.'));
    if (!AIK.loaded && !AIK.busy) loadKeys();
    const mcp = baseURL() + '/mcp';
    html += panel('', table('aikeys', [
      { k: 'name', l: 'Key', render: k => `<b>${esc(k.name)}</b><br><small class="muted mono">${esc(k.prefix)}…</small>`, sort: k => k.name },
      { k: 'uid', l: 'Acts as', render: k => personHTML(k.uid, false), sort: k => personName(k.uid) },
      { k: 'access', l: 'Access', render: k => k.access === 'write' ? pill('Read & write', 't-warn') : pill('Read only', 't-info') },
      { k: 'created', l: 'Created', render: k => `${esc(fmtD(String(k.created).slice(0, 10)))}<br><small class="muted">by ${esc(personName(k.createdBy))}</small>`, sort: k => k.created },
      { k: 'lastUsed', l: 'Last used', render: k => k.lastUsed ? `${esc(fmtD(String(k.lastUsed).slice(0, 10)))} <small class="muted">${esc(fmtT(k.lastUsed))}</small><br><small class="muted">${num(k.uses || 0)} calls</small>` : '<span class="muted">Never</span>', sort: k => k.lastUsed || '' },
      { k: 'a', l: '', nosort: 1, render: k => manage ? btn('Revoke', 'aikeyrm:' + k.id, { sm: true, ghost: true, cls: 'danger' }) : '' },
    ], AIK.list, { empty: AIK.loaded ? empty('No keys yet', 'Create a key for each AI agent or script. Use a read-only key for reporting and a read & write key for agents that update records.', manage ? btn('Create key', 'aikeynew', { pri: true }) : '') : '<div class="loading"><div class="spin"></div>Loading keys…</div>' }), { flush: true });
    const steps = `<div class="aisteps">
      <div class="ais"><h3>${icon('bot')} Claude (web, desktop, mobile)</h3><ol><li>Create a key here and copy its connector link.</li><li>In Claude, open Settings › Connectors › Add custom connector.</li><li>Name it “Triagon ERP” and paste the link: <code>${esc(mcp)}/&lt;your key&gt;</code></li><li>Ask Claude things like “What sold on Flipkart yesterday?” or “Raise a PO to the Ambur vendor for 5 hides”.</li></ol></div>
      <div class="ais"><h3>${icon('code')} Claude Code or other MCP clients</h3><pre class="mono">claude mcp add --transport http triagon-erp \\
  ${esc(mcp)} \\
  --header "Authorization: Bearer &lt;your key&gt;"</pre><p class="help">Any client that supports MCP over Streamable HTTP works with the same URL and a Bearer header.</p></div>
      <div class="ais"><h3>${icon('layers')} REST API for scripts</h3><pre class="mono">curl -H "Authorization: Bearer &lt;key&gt;" \\
  "${esc(baseURL())}/api/v1/products?limit=50"

curl -X POST -H "Authorization: Bearer &lt;key&gt;" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Office rent","category":"Rent &amp; utilities","amount":25000,"date":"${TODAY()}"}' \\
  "${esc(baseURL())}/api/v1/expenses"</pre><p class="help">GET /api/v1/&lt;collection&gt; lists, GET …/&lt;id&gt; reads one, POST creates, PATCH updates, DELETE sends it to the recycle bin (or a delete request, by role).</p></div>
    </div>`;
    html += panel('How to connect', steps);
    html += panel('What agents can do', `<div class="list">${[['Read anything their role can see', 'Catalogue, listings, stock, orders, sales, returns, claims, finance, attendance and HR, filtered by the member’s brands and permissions. Cost prices are hidden unless the role can see costs.'], ['Search and report', 'Filter any collection, and run the same summaries the ERP shows: sales, stock levels, attendance for a day, payables and receivables, payroll for a month, the daily summary.'], ['Create and edit records', 'With a read & write key: products and channel listings, stock movements, purchase orders, vendor bills, sales orders, sales, returns and claims, expenses, offers, reviews, employees’ pay items and more.'], ['Deletes stay safe', 'A delete from an agent goes to the recycle bin, or becomes a delete request when the member can’t approve deletes.'], ['Everything is logged', 'Each change shows in the activity log as “Name via AI (key name)”.']].map(([a, b]) => `<div class="li"><span class="sev good"></span><div class="grow"><b>${esc(a)}</b><small>${esc(b)}</small></div></div>`).join('')}</div>`);
    return html;
  };
}
Object.assign(IC, { code: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 4l-4 16"/>' });
Object.assign(ACT, {
  aikeynew() {
    openDrawer({ title: 'Create an AI / API key', sub: 'The key works as the team member you choose: their role, brands and permissions apply.', saveLabel: 'Create key', savedMsg: null,
      html: form([{ n: 'name', l: 'Key name', req: 1, ph: 'e.g. Claude — Prathipan, Stock sync script' }, { n: 'uid', l: 'Acts as', t: 'select', req: 1, o: () => liveMembers().filter(m => m.status !== 'suspended').map(m => [m.id, `${m.name} · ${roleLabel(m.role)}`]) }, { n: 'access', l: 'Access', t: 'select', o: [['read', 'Read only'], ['write', 'Read & write']], help: 'Read & write lets the agent create and change records within that member’s permissions.' }], { uid: ME.id, access: 'read' }),
      onSave: async v => { const r = await api('POST', '/api/keys', { name: v.name, uid: v.uid, access: v.access }); AIK.loaded = false; loadKeys(); const link = baseURL() + '/mcp/' + r.token; setTimeout(() => openDrawer({ title: 'Key created', sub: 'Copy it now. For safety it is shown only once.', html: `<div class="fld full"><label for="aiTok">API key (for scripts and the Authorization header)</label><textarea class="inp mono" id="aiTok" rows="2" readonly>${esc(r.token)}</textarea></div><div style="margin:8px 0 16px">${btn('Copy key', 'aicopy:aiTok', { sm: true, i: 'copy' })}</div><div class="fld full"><label for="aiLink">Connector link for Claude</label><textarea class="inp mono" id="aiLink" rows="3" readonly>${esc(link)}</textarea></div><div style="margin-top:8px">${btn('Copy connector link', 'aicopy:aiLink', { sm: true, pri: true, i: 'copy' })}</div><p class="help">Anyone with this key can use the ERP as ${esc(personName(v.uid))}. Keep it private; revoke it here if it leaks.${location.protocol !== 'https:' ? ' Claude connectors need an https address; finish the HTTPS setup on the server first.' : ''}</p>` }), 240); },
    });
  },
  aicopy(id) { const t = $('#' + id); if (t) copyText(t.value, 'Copied'); },
  aikeyrm(id) { const k = AIK.list.find(x => x.id === id); openDrawer({ title: 'Revoke “' + ((k && k.name) || 'key') + '”?', sub: 'Agents and scripts using it stop working immediately.', saveLabel: 'Revoke key', html: '<p class="muted">This can’t be undone. Create a new key if you need access again.</p>', onSave: async () => { await api('DELETE', '/api/keys/' + encodeURIComponent(id)); AIK.loaded = false; loadKeys(); toast('Key revoked'); }, savedMsg: null }); },
});
