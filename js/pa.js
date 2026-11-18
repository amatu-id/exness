/* Amatu Trade — Personal Area: my accounts, create account, account information & settings, deposit, withdrawal,
   transfer, transaction history, order history, performance */
(function () {
'use strict';
const AT = window.AT, U = AT.U, S = AT.S, F = AT.F, E = AT.E;
const PA = AT.PA = {};
let root = null, page = 'accounts';

PA.mount = function (el) {
  root = el;
  el.innerHTML = `
  <header class="pa-head">
    <a class="logo" href="#/pa/accounts" aria-label="Amatu Trade">${AT.logoSVG(true)}</a>
    <div class="grow"></div>
    <button class="pa-wallet" id="pa-wallet" type="button">${U.icon('wallet')}<span></span></button>
    <button class="icon-btn" id="pa-theme" type="button" title="Theme">${U.icon('sun')}</button>
    <button class="icon-btn" id="pa-help" type="button" title="Help">${U.icon('help')}</button>
    <button class="icon-btn" id="pa-bell" type="button" title="Notifications">${U.icon('bell')}</button>
    <button class="icon-btn" id="pa-apps" type="button" title="Apps">${U.icon('apps')}</button>
    <button class="icon-btn" id="pa-prof" type="button" title="Profile">${U.icon('user')}</button>
  </header>
  <nav class="pa-mnav" id="pa-mnav"><a href="#/" data-p="term">${U.icon('arrow-left')} Terminal</a><a href="#/pa/accounts" data-p="accounts">Accounts</a><a href="#/pa/deposit" data-p="deposit">Deposit</a><a href="#/pa/withdrawal" data-p="withdrawal">Withdrawal</a><a href="#/pa/transfer" data-p="transfer">Transfer</a><a href="#/pa/history" data-p="history">Order history</a><a href="#/pa/performance" data-p="performance">Performance</a><a href="#/pa/transactions" data-p="transactions">Transactions</a><a href="#/pa/calendar" data-p="calendar">Calendar</a></nav>
  <div class="pa-main">
    <nav class="pa-nav" id="pa-nav">
      <div class="pn-g"><div class="pn-h">${U.icon('trade')}<span>Trading</span>${U.icon('chev-up')}</div>
        <a href="#/pa/accounts" data-p="accounts">Accounts</a><a href="#/pa/performance" data-p="performance">Performance</a><a href="#/pa/history" data-p="history">Order history</a><a href="#/" data-p="term">Amatu Terminal ${U.icon('external')}</a></div>
      <div class="pn-g"><div class="pn-h">${U.icon('wallet')}<span>Payments &amp; wallet</span>${U.icon('chev-up')}</div>
        <a href="#/pa/deposit" data-p="deposit">Deposit</a><a href="#/pa/withdrawal" data-p="withdrawal">Withdrawal</a><a href="#/pa/transfer" data-p="transfer">Transfer <i class="new">New</i></a><a href="#/pa/transactions" data-p="transactions">Transaction history</a></div>
      <div class="pn-g"><div class="pn-h">${U.icon('chart')}<span>Insights</span>${U.icon('chev-up')}</div>
        <a href="#/pa/calendar" data-p="calendar">Economic Calendar</a></div>
      <div class="grow"></div>
      <a class="pn-portal" href="/">${U.icon('arrow-left')}<span>Back to Portal</span></a>
    </nav>
    <section class="pa-page" id="pa-page"></section>
  </div>
  <div class="pa-drawer hidden" id="pa-drawer"></div>`;
  U.$('#pa-theme').onclick = () => { AT.setPref('paTheme', (AT.prefs.paTheme || 'light') === 'light' ? 'dark' : 'light'); AT.applyTheme(); };
  U.$('#pa-wallet').onclick = () => AT.go('#/pa/accounts');
  U.$('#pa-help').onclick = () => U.modal({ title: 'Help', body: '<p class="muted">Amatu Trade is a practice trading terminal with live market prices. Balances are virtual: use <b>Deposit</b> to add funds to any account, open as many accounts as you like, and trade every instrument exactly like on a real terminal.</p>', width: 420 });
  U.$('#pa-bell').onclick = e => U.menu(e.currentTarget, [{ header: 'Notifications' }].concat(E.notifs.slice(0, 30).map(n => ({ node: U.el('div.notif-row', { html: '<b>' + U.esc(n.title) + '</b><span>' + U.esc(n.text || '') + '</span><small>' + U.fmtTime(n.t, 'full') + '</small>' }) }))).concat(E.notifs.length ? [] : [{ node: U.el('div.empty-sm', { text: 'No notifications yet' }) }]), { alignRight: true, minWidth: 320, cls: 'menu-notif' });
  U.$('#pa-apps').onclick = e => U.menu(e.currentTarget, [{ label: 'Amatu Terminal', icon: 'ct-candles', onClick: () => AT.go('#/') }, { label: 'Personal Area', icon: 'home', onClick: () => AT.go('#/pa/accounts') }, { sep: true }, { label: 'Portal AMATU', icon: 'apps', onClick: () => { location.href = '/'; } }], { alignRight: true, minWidth: 220 });
  U.$('#pa-prof').onclick = e => U.menu(e.currentTarget, [{ label: 'Transaction history', icon: 'history', onClick: () => AT.go('#/pa/transactions') }, { label: 'Back to Portal', icon: 'arrow-left', onClick: () => { location.href = '/'; } }], { alignRight: true, minWidth: 220 });
  U.$('#pa-nav').addEventListener('click', e => { const h = e.target.closest('.pn-h'); if (h) h.parentElement.classList.toggle('shut'); });
  U.on('state', () => { if (AT.route === 'pa') render(); });
  U.on('tx', () => { if (AT.route === 'pa' && (page === 'transactions')) render(); });
};
PA.show = function (p) { page = p || 'accounts'; closeDrawer(); render(); window.scrollTo(0, 0); };
function render() {
  if (!root) return;
  U.$$('#pa-nav a[data-p], #pa-mnav a[data-p]').forEach(a => a.classList.toggle('on', a.dataset.p === page));
  const tot = E.st.accounts.filter(a => !a.archived).reduce((s, a) => s + (F.convert(E.metrics(a).eq, a.cur, 'USD') || 0), 0);
  U.$('#pa-wallet span').textContent = U.fmt(tot, 2) + ' USD';
  const el = U.$('#pa-page');
  el.innerHTML = '';
  ({ accounts, new: newAccount, performance, history, deposit: () => money('deposit'), withdrawal: () => money('withdraw'), transfer: () => money('transfer'), transactions, calendar })[page] ? ({ accounts, new: newAccount, performance, history, deposit: () => money('deposit'), withdrawal: () => money('withdraw'), transfer: () => money('transfer'), transactions, calendar })[page](el) : accounts(el);
}
PA.render = render;

/* ---------- accounts ---------- */
function accounts(el) {
  el.append(U.el('div.pa-banner', { html: '<div><b>Practice trading with live market prices</b><span>Open accounts, deposit virtual funds and trade forex, metals, indices, energies, stocks and crypto.</span></div><button class="icon-btn" type="button" aria-label="Close">' + U.icon('x') + '</button>' }));
  el.querySelector('.pa-banner button').onclick = e => e.currentTarget.parentElement.remove();
  const top = U.el('div.pa-h1row', null, U.el('h1', { text: 'My accounts' }), U.el('button.btn.btn-light', { type: 'button', html: U.icon('plus') + ' Create account', onclick: () => AT.go('#/pa/new') }));
  el.append(top);
  const sort = AT.prefs.paSort || 'new';
  const view = AT.prefs.paView || 'list';
  const sb = U.el('button.btn.btn-light.sm', { type: 'button', html: U.icon('sort') + ' ' + ({ new: 'Newest', old: 'Oldest', bal: 'Balance', name: 'Nickname' })[sort] + ' ' + U.icon('chev-down') });
  sb.onclick = () => U.menu(sb, [['new', 'Newest'], ['old', 'Oldest'], ['bal', 'Balance'], ['name', 'Nickname']].map(([k, l]) => ({ label: l, active: k === sort, onClick: () => { AT.setPref('paSort', k); render(); } })));
  const vt = U.el('div.vtog', null, U.el('button' + (view === 'list' ? '.on' : ''), { type: 'button', html: U.icon('list'), onclick: () => { AT.setPref('paView', 'list'); render(); } }), U.el('button' + (view === 'grid' ? '.on' : ''), { type: 'button', html: U.icon('layout'), onclick: () => { AT.setPref('paView', 'grid'); render(); } }));
  el.append(U.el('div.pa-tools', null, U.el('span.grow'), sb, vt));
  let list = E.st.accounts.filter(a => !a.archived);
  if (sort === 'old') list.sort((a, b) => a.created - b.created); else if (sort === 'bal') list.sort((a, b) => (F.convert(b.bal, b.cur, 'USD') || 0) - (F.convert(a.bal, a.cur, 'USD') || 0)); else if (sort === 'name') list.sort((a, b) => (a.nick || '').localeCompare(b.nick || '')); else list.sort((a, b) => b.created - a.created);
  const wrap = U.el('div.acc-list' + (view === 'grid' ? '.grid' : ''));
  for (const a of list) wrap.append(card(a));
  if (!list.length) wrap.append(U.el('div.pa-empty', { html: '<b>No accounts yet</b><span>Create an account to start trading.</span>' }));
  el.append(wrap);
  const arch = E.st.accounts.filter(a => a.archived);
  if (arch.length) {
    const hide = AT.prefs.paHideArch;
    const h = U.el('div.pa-h2row', null, U.el('h2', { text: 'Archived accounts' }), U.el('button.lnk', { type: 'button', html: (hide ? 'Show accounts ' + U.icon('chev-down') : 'Hide accounts ' + U.icon('chev-up')), onclick: () => { AT.setPref('paHideArch', !hide); render(); } }));
    el.append(h);
    if (!hide) for (const a of arch) {
      const c = U.el('div.acc-card.arch', { html: '<div class="ac-top"><span class="badge">Amatu</span><span class="badge">' + S.ACCOUNT_TYPES[a.type].name + '</span><b># ' + a.id + '</b> <span>' + U.esc(a.nick || '') + '</span></div><div class="ac-row"><div class="ac-bal arch"><b>' + U.money(a.bal, a.cur) + '</b><span class="muted">This account was archived</span></div><div class="ac-btns"></div></div>' });
      const btns = c.querySelector('.ac-btns');
      btns.append(U.el('button.btn.btn-light', { type: 'button', html: U.icon('restore') + ' Restore', onclick: () => { E.restore(a.id); U.toast('Account restored', '#' + a.id, 'ok'); } }), U.el('button.btn.btn-light', { type: 'button', html: U.icon('download') + ' Manage statements', onclick: () => statements(a) }), U.el('button.btn.btn-light', { type: 'button', html: U.icon('trash') + ' Delete', onclick: async () => { if (await U.confirm('Delete account #' + a.id + '?', 'The account and its trading history will be removed permanently from this practice terminal.', 'Delete', true)) E.remove(a.id); } }));
      el.append(c);
    }
  }
}
function card(a) {
  const m = E.metrics(a);
  const c = U.el('div.acc-card' + (a.id === E.st.active ? '.active' : ''));
  const big = U.fmt(m.eq, 2); const [ip, dp] = big.split('.');
  c.innerHTML = '<div class="ac-top"><span class="badge">Amatu</span><span class="badge">' + S.ACCOUNT_TYPES[a.type].name + '</span><b># ' + a.id + '</b> <span>' + U.esc(a.nick || '') + '</span><span class="grow"></span><button class="icon-btn ac-exp" type="button" aria-label="Details">' + U.icon('chev-down') + '</button></div>' +
    '<div class="ac-row"><div class="ac-bal"><span class="ac-int">' + ip + '</span><span class="ac-dec">.' + dp + ' ' + a.cur + '</span></div><div class="ac-btns"></div></div><div class="ac-more hidden"></div>';
  const btns = c.querySelector('.ac-btns');
  btns.append(
    U.el('button.btn.btn-yellow', { type: 'button', html: U.icon('trade') + ' Trade', onclick: () => { E.setActive(a.id); AT.go('#/'); } }),
    U.el('button.btn.btn-light', { type: 'button', html: U.icon('deposit') + ' Deposit', onclick: () => AT.T.money('deposit', a.id) }),
    U.el('button.btn.btn-light', { type: 'button', html: U.icon('withdraw') + ' Withdraw', onclick: () => AT.T.money('withdraw', a.id) }),
    U.el('button.btn.btn-light', { type: 'button', html: U.icon('transfer') + ' Transfer', onclick: () => AT.T.money('transfer', a.id) }));
  const more = U.el('button.btn.btn-light.icon', { type: 'button', html: U.icon('more-v') });
  more.onclick = () => U.menu(more, [{ label: 'Account information', icon: 'info', onClick: () => info(a) }, { label: 'Settings', icon: 'gear', onClick: () => settings(a) }, { label: 'Change max leverage', icon: 'leverage', onClick: () => leverage(a) }, { label: 'Rename account', icon: 'edit', onClick: () => rename(a) }, { label: 'Statements', icon: 'download', onClick: () => statements(a) }, { sep: true }, { label: 'Archive account', icon: 'archive', onClick: () => archive(a) }], { alignRight: true, minWidth: 220 });
  btns.append(more);
  const exp = c.querySelector('.ac-exp'), mo = c.querySelector('.ac-more');
  exp.onclick = () => { mo.classList.toggle('hidden'); exp.classList.toggle('open'); };
  mo.innerHTML = '<div class="ac-grid"><span>Equity</span><b>' + U.money(m.eq, a.cur) + '</b><span>Balance</span><b>' + U.money(a.bal, a.cur) + '</b><span>Floating P/L</span><b class="' + (m.fl >= 0 ? 'pos' : 'neg') + '">' + U.money(m.fl, a.cur, true) + '</b><span>Margin</span><b>' + U.money(m.margin, a.cur) + '</b><span>Free margin</span><b>' + U.money(m.free, a.cur) + '</b><span>Margin level</span><b>' + (m.ml == null ? '-' : U.pct(m.ml)) + '</b><span>Leverage</span><b>' + S.levLabel(a.lev) + '</b><span>Open positions</span><b>' + a.pos.length + '</b><span>Pending orders</span><b>' + a.ord.length + '</b><span>Platform</span><b>Amatu Terminal</b></div>';
  return c;
}
function drawer(title, body, back) {
  const d = U.$('#pa-drawer'); d.classList.remove('hidden');
  d.innerHTML = '';
  const panel = U.el('div.pd-panel');
  const h = U.el('div.pd-head', null, back ? U.el('button.icon-btn', { type: 'button', html: U.icon('chev-left'), onclick: back }) : '', U.el('div', null, U.el('h3', { text: title.t }), title.s ? U.el('div.muted', { text: title.s }) : ''), U.el('span.grow'), U.el('button.icon-btn', { type: 'button', html: U.icon('x'), onclick: closeDrawer }));
  panel.append(h, body); d.append(U.el('div.pd-back', { onclick: closeDrawer }), panel);
}
function closeDrawer() { const d = U.$('#pa-drawer'); if (d) { d.classList.add('hidden'); d.innerHTML = ''; } }
function info(a) {
  const t = S.ACCOUNT_TYPES[a.type];
  const rows = [['Type', '<b>' + t.name + '</b>'], ['Min deposit', t.min + ' USD'], ['Min spread', t.spread], ['Max leverage', '1:Unlimited'], ['Commission', t.comm], ['Margin call', t.mc + '%'], ['Stop out', t.so + '%'], ['Currency', a.cur], ['Created', U.fmtTime(a.created, 'long')]];
  const body = U.el('div.pd-body', { html: rows.map(r => '<div class="dl"><span>' + r[0] + '</span><i></i><b>' + r[1] + '</b></div>').join('') + '<button class="lnk blue" type="button">Contract specifications ' + U.icon('external') + '</button>' });
  body.querySelector('.lnk').onclick = () => { closeDrawer(); AT.Pn.spec(AT.prefs.tab || 'XAUUSD'); };
  drawer({ t: 'Account information', s: 'Account: #' + a.id }, body, () => settings(a));
}
function settings(a) {
  const body = U.el('div.pd-body');
  const row = (ic, l, sub, v, fn) => { const r = U.el('button.set-item', { type: 'button', html: '<i class="si-ic">' + U.icon(ic) + '</i><span class="si-l">' + l + (sub ? '<small>' + sub + '</small>' : '') + '</span><span class="si-v">' + v + '</span>' + (fn ? U.icon('chev-right') : '') }); if (fn) r.onclick = fn; body.append(r); };
  row('logo-mini', 'Platform', '', 'Amatu Terminal', null);
  body.append(U.el('div.pd-note', { html: 'This account works on the Amatu Terminal (web &amp; phone).' }));
  row('cube', S.ACCOUNT_TYPES[a.type].name + ' account', '', '', () => info(a));
  row('leverage', 'Max leverage', '', S.levLabel(a.lev), () => leverage(a));
  row('text', 'Nickname', 'Optional', U.esc(a.nick || ''), () => rename(a));
  body.append(U.el('div.pd-sep'));
  row('download', 'Statements', '', '', () => statements(a));
  const foot = U.el('div.pd-foot', null, U.el('button.btn.btn-light', { type: 'button', html: U.icon('archive') + ' Archive', onclick: () => archive(a) }), U.el('button.btn.btn-light', { type: 'button', html: U.icon('transfer') + ' Transfer', onclick: () => AT.T.money('transfer', a.id) }));
  body.append(foot);
  drawer({ t: 'Settings', s: 'Account: #' + a.id }, body);
}
function leverage(a) {
  const body = U.el('div.pd-body');
  body.append(U.el('p.muted', { text: 'Higher leverage lowers the margin required for positions. Instruments with fixed leverage (stocks, indices, energies, some crypto) keep their own limits.' }));
  for (const l of S.LEVERAGES) {
    const r = U.el('label.radio-row' + (a.lev === l ? '.on' : ''), { html: '<input type="radio" name="lev" ' + (a.lev === l ? 'checked' : '') + '><span>' + S.levLabel(l) + '</span>' });
    r.onclick = () => { const res = E.setLeverage(a.id, l); if (res.err) U.toast('Request rejected', U.esc(res.err), 'error'); else { U.toast('Leverage changed', S.levLabel(l), 'ok'); settings(E.acc(a.id)); } };
    body.append(r);
  }
  drawer({ t: 'Max leverage', s: 'Account: #' + a.id }, body, () => settings(a));
}
function rename(a) {
  const body = U.el('div.pd-body'); const inp = U.el('input.inp', { type: 'text', value: a.nick || '', maxlength: 36 });
  const ok = U.el('button.btn.btn-yellow.wide', { type: 'button', text: 'Save' });
  body.append(U.el('label.fl', { text: 'Nickname' }), inp, ok);
  ok.onclick = () => { E.rename(a.id, inp.value.trim()); settings(E.acc(a.id)); };
  drawer({ t: 'Nickname', s: 'Account: #' + a.id }, body, () => settings(a));
  setTimeout(() => inp.focus(), 30);
}
async function archive(a) {
  if (!(await U.confirm('Archive account #' + a.id + '?', 'Archived accounts stop trading. You can restore them at any time.', 'Archive'))) return;
  const r = E.archive(a.id); if (r.err) U.toast('Request rejected', U.esc(r.err), 'error'); else { closeDrawer(); U.toast('Account archived', '#' + a.id, 'ok'); }
}
function statements(a) {
  const body = U.el('div.pd-body');
  const from = U.el('input.inp', { type: 'date', value: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10) }), to = U.el('input.inp', { type: 'date', value: new Date().toISOString().slice(0, 10) });
  const csv = U.el('button.btn.btn-light.wide', { type: 'button', html: U.icon('download') + ' Download CSV' }), html = U.el('button.btn.btn-yellow.wide', { type: 'button', html: U.icon('doc') + ' Open statement (print / PDF)' });
  body.append(U.el('label.fl', { text: 'From' }), from, U.el('label.fl', { text: 'To' }), to, html, csv);
  const range = () => [Date.parse(from.value + 'T00:00:00Z'), Date.parse(to.value + 'T23:59:59Z')];
  csv.onclick = () => { const [t0, t1] = range(); const rows = [['Position', 'Symbol', 'Type', 'Volume', 'Open time', 'Open price', 'Close time', 'Close price', 'T/P', 'S/L', 'Swap', 'Commission', 'Profit', 'Reason']]; for (const h of E.history(a.id)) { if (h.ord || h.t1 < t0 || h.t1 > t1) continue; rows.push([h.id, (S.map[h.sym] || {}).n || h.sym, h.side, h.vol, new Date(h.t0).toISOString(), h.open, new Date(h.t1).toISOString(), h.close, h.tp || '', h.sl || '', h.swap, h.comm, h.pl, h.reason || '']); } U.download('statement_' + a.id + '_' + from.value + '_' + to.value + '.csv', U.csv(rows), 'text/csv'); };
  html.onclick = () => { const [t0, t1] = range(); statementWindow(a, t0, t1); };
  drawer({ t: 'Statements', s: 'Account: #' + a.id }, body, () => settings(a));
}
function statementWindow(a, t0, t1) {
  const deals = E.history(a.id).filter(h => !h.ord && h.t1 >= t0 && h.t1 <= t1).sort((x, y) => x.t1 - y.t1);
  const tx = E.tx.filter(t => t.acc === a.id && t.t >= t0 && t.t <= t1);
  const pl = deals.reduce((s, h) => s + h.pl, 0), sw = deals.reduce((s, h) => s + (h.swap || 0), 0), cm = deals.reduce((s, h) => s + (h.comm || 0), 0);
  const dep = tx.filter(t => t.amt > 0).reduce((s, t) => s + t.amt, 0), wd = tx.filter(t => t.amt < 0).reduce((s, t) => s + t.amt, 0);
  const win = deals.filter(h => h.pl > 0).length;
  const m = E.metrics(a);
  const row = h => '<tr><td>' + h.id + '</td><td>' + U.fmtTime(h.t0, 'full') + '</td><td>' + U.esc((S.map[h.sym] || {}).n || h.sym) + '</td><td>' + h.side + '</td><td>' + U.fmt(h.vol, 2) + '</td><td>' + U.fmt(h.open, (S.map[h.sym] || {}).dg || 2) + '</td><td>' + (h.sl || '') + '</td><td>' + (h.tp || '') + '</td><td>' + U.fmtTime(h.t1, 'full') + '</td><td>' + U.fmt(h.close, (S.map[h.sym] || {}).dg || 2) + '</td><td>' + U.fmt(h.comm || 0, 2) + '</td><td>' + U.fmt(h.swap || 0, 2) + '</td><td class="' + (h.pl >= 0 ? 'p' : 'n') + '">' + U.fmt(h.pl, 2) + '</td></tr>';
  const w = window.open('', '_blank');
  if (!w) { U.toast('Pop-up blocked', 'Allow pop-ups to open the statement.', 'error'); return; }
  w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Statement #' + a.id + '</title><style>body{font:12px/1.45 Inter,Arial,sans-serif;color:#141d22;margin:28px}h1{font-size:20px;margin:0 0 4px}table{border-collapse:collapse;width:100%;margin:12px 0 22px}th,td{border-bottom:1px solid #e3e6e8;padding:5px 6px;text-align:right}th:nth-child(-n+4),td:nth-child(-n+4){text-align:left}th{background:#f4f5f6;font-weight:600}.p{color:#15803d}.n{color:#c2312a}.sum td{text-align:left;border:0;padding:3px 10px 3px 0}.muted{color:#6b7780}@media print{button{display:none}}</style></head><body>' +
    '<button onclick="print()" style="float:right;padding:8px 14px;border:0;background:#ffde02;border-radius:6px;font-weight:600;cursor:pointer">Print / Save PDF</button><h1>Trading statement</h1><div class="muted">Account #' + a.id + ' · ' + S.ACCOUNT_TYPES[a.type].name + ' · ' + U.esc(a.nick || '') + ' · ' + a.cur + ' · ' + S.levLabel(a.lev) + '</div><div class="muted">Period: ' + U.fmtTime(t0, 'date') + ' – ' + U.fmtTime(t1, 'date') + ' · Generated ' + U.fmtTime(Date.now(), 'long') + '</div>' +
    '<table class="sum"><tr><td>Closed trade P/L</td><td><b>' + U.money(pl, a.cur, true) + '</b></td><td>Deposits</td><td><b>' + U.money(dep, a.cur) + '</b></td></tr><tr><td>Swap</td><td>' + U.money(sw, a.cur) + '</td><td>Withdrawals &amp; transfers out</td><td>' + U.money(wd, a.cur) + '</td></tr><tr><td>Commission</td><td>' + U.money(cm, a.cur) + '</td><td>Trades</td><td>' + deals.length + ' (' + (deals.length ? U.fmt(win / deals.length * 100, 1) : '0') + '% profitable)</td></tr><tr><td>Balance now</td><td>' + U.money(a.bal, a.cur) + '</td><td>Equity now</td><td>' + U.money(m.eq, a.cur) + '</td></tr></table>' +
    '<h3>Closed transactions</h3><table><tr><th>Position</th><th>Open time</th><th>Symbol</th><th>Type</th><th>Volume</th><th>Price</th><th>S/L</th><th>T/P</th><th>Close time</th><th>Price</th><th>Commission</th><th>Swap</th><th>Profit</th></tr>' + (deals.map(row).join('') || '<tr><td colspan="13" class="muted">No trades in this period</td></tr>') + '</table>' +
    '<h3>Deposits, withdrawals &amp; transfers</h3><table><tr><th>ID</th><th>Time</th><th>Type</th><th>Method</th><th>Amount</th></tr>' + (tx.map(t => '<tr><td>' + t.id + '</td><td>' + U.fmtTime(t.t, 'full') + '</td><td>' + t.type + '</td><td>' + U.esc(t.method || '') + '</td><td>' + U.money(t.amt, t.cur, true) + '</td></tr>').join('') || '<tr><td colspan="5" class="muted">None</td></tr>') + '</table></body></html>');
  w.document.close();
}

/* ---------- create account ---------- */
let newSel = 'standard', newStep = 1;
function newAccount(el) {
  if (newStep === 2) return newAccount2(el);
  const box = U.el('div.na');
  box.append(U.el('div.pa-h1row', null, U.el('h1', { text: 'Create account' }), U.el('button.lnk.blue', { type: 'button', html: 'Contract specifications ' + U.icon('external'), onclick: () => AT.Pn.spec('XAUUSD') })));
  for (const grp of ['Standard accounts', 'Professional accounts']) {
    box.append(U.el('div.na-hrow', { html: '<span>' + grp + '</span><span>Min deposit</span><span>Min spread</span><span>Max leverage</span><span>Commission</span>' }));
    for (const k in S.ACCOUNT_TYPES) {
      const t = S.ACCOUNT_TYPES[k]; if (t.group !== grp) continue;
      const r = U.el('label.na-row' + (newSel === k ? '.on' : ''), { html: '<span class="na-name"><input type="radio" name="atype" ' + (newSel === k ? 'checked' : '') + '><i class="na-ic">' + U.icon(t.icon) + '</i><span><b>' + t.name + (t.badge ? ' <em>' + t.badge + '</em>' : '') + '</b><small>' + t.desc + '</small></span></span><span>' + t.min + ' USD</span><span>' + t.spread + '</span><span>1:Unlimited</span><span>' + t.comm + '</span>' });
      r.onclick = () => { newSel = k; render(); };
      box.append(r);
    }
  }
  box.append(U.el('div.na-foot', null, U.el('button.btn.btn-light', { type: 'button', text: 'Cancel', onclick: () => { newStep = 1; AT.go('#/pa/accounts'); } }), U.el('button.btn.btn-yellow', { type: 'button', text: 'Continue', onclick: () => { newStep = 2; render(); } })));
  el.append(box);
}
function newAccount2(el) {
  const t = S.ACCOUNT_TYPES[newSel];
  const box = U.el('div.na.na2');
  box.append(U.el('button.lnk', { type: 'button', html: U.icon('chev-left') + ' Back', onclick: () => { newStep = 1; render(); } }), U.el('h1', { text: 'Set up your ' + t.name + ' account' }));
  const cur = U.el('select.inp'); for (const c of newSel === 'cent' ? ['USC'] : S.ACC_CURRENCIES) cur.append(U.el('option', { value: c, text: c + ' — ' + ((S.CUR[c] || [])[0] || c), selected: c === (newSel === 'cent' ? 'USC' : 'USD') ? true : null }));
  const lev = U.el('select.inp'); for (const l of S.LEVERAGES) lev.append(U.el('option', { value: l, text: S.levLabel(l), selected: l === 200 ? true : null }));
  const nick = U.el('input.inp', { type: 'text', placeholder: 'Optional', maxlength: 36 });
  const dep = U.el('input.inp', { type: 'text', inputmode: 'decimal', value: newSel === 'cent' ? '100' : '10000' });
  const depCur = U.el('span.amt-cur', { text: newSel === 'cent' ? 'USD' : 'USD' });
  const hint = U.el('div.muted.sm');
  const upd = () => { const v = U.parseNum(dep.value); const c = cur.value; const conv = F.convert(v || 0, 'USD', c); hint.textContent = v > 0 && c !== 'USD' ? '≈ ' + U.money(conv || 0, c) + ' will be credited' : ''; };
  dep.oninput = upd; cur.onchange = upd;
  const grid = U.el('div.form-grid.na-form');
  for (const [l, n] of [['Account currency', cur], ['Max leverage', lev], ['Nickname', nick], ['Initial virtual deposit', U.el('div.amt-row', null, dep, depCur)]]) grid.append(U.el('label.fg-l', { text: l }), n);
  grid.append(U.el('span'), hint);
  box.append(grid);
  const go = U.el('button.btn.btn-yellow', { type: 'button', text: 'Create account' });
  box.append(U.el('div.na-foot', null, U.el('button.btn.btn-light', { type: 'button', text: 'Cancel', onclick: () => { newStep = 1; AT.go('#/pa/accounts'); } }), go));
  go.onclick = () => {
    const v = U.parseNum(dep.value);
    const a = E.createAccount({ type: newSel, cur: cur.value, lev: +lev.value, nick: nick.value.trim() || t.name, deposit: v > 0 ? v : 0, depositCur: 'USD' });
    newStep = 1;
    U.toast('Account created', '#' + a.id + ' · ' + t.name + ' · ' + U.money(a.bal, a.cur), 'ok');
    AT.go('#/pa/accounts');
  };
  el.append(box); upd();
}

/* ---------- money pages ---------- */
function money(kind) {
  const el = U.$('#pa-page');
  const title = kind === 'deposit' ? 'Deposit' : kind === 'withdraw' ? 'Withdrawal' : 'Transfer';
  el.append(U.el('div.pa-h1row', null, U.el('h1', { text: title })));
  const methods = kind === 'transfer' ? [['transfer', 'Between your accounts', 'Instant', '0%', 'No limit']] : [['virtual', kind === 'deposit' ? 'Virtual deposit' : 'Virtual withdrawal', 'Instant', '0%', 'No limit']];
  const grid = U.el('div.pm-grid');
  for (const [k, name, time, fee, lim] of methods) {
    const c = U.el('button.pm-card', { type: 'button', html: '<i class="pm-logo">' + U.icon(kind === 'transfer' ? 'transfer' : kind === 'deposit' ? 'deposit' : 'withdraw') + '</i><b>' + name + '</b><div class="pm-meta"><span>Processing time</span><b>' + time + '</b><span>Fee</span><b>' + fee + '</b><span>Limits</span><b>' + lim + '</b></div>' });
    c.onclick = () => AT.T.money(kind);
    grid.append(c);
  }
  el.append(U.el('p.muted', { text: kind === 'deposit' ? 'Add virtual funds to any of your accounts. Funds are credited immediately.' : kind === 'withdraw' ? 'Remove virtual funds from an account. Only free margin can be withdrawn.' : 'Move funds between your accounts. Different currencies are converted at the live rate.' }), grid);
  el.append(U.el('h2', { text: 'Recent ' + title.toLowerCase() + 's' }));
  txTable(el, t => kind === 'deposit' ? t.type === 'Deposit' : kind === 'withdraw' ? t.type === 'Withdrawal' : t.type === 'Transfer', 10);
}
function txTable(el, filter, limit) {
  const rows = E.tx.filter(filter || (() => true)).slice(0, limit || 500);
  if (!rows.length) { el.append(U.el('div.pa-empty', { html: '<b>No transactions yet</b>' })); return; }
  const t = U.el('table.ptable');
  t.innerHTML = '<thead><tr><th>Date</th><th>Type</th><th>Account</th><th>Method</th><th>Status</th><th class="r">Amount</th></tr></thead><tbody>' + rows.map(x => '<tr><td>' + U.fmtTime(x.t, 'full') + '</td><td>' + x.type + '</td><td>#' + x.acc + (x.to ? ' → #' + x.to : x.from ? ' ← #' + x.from : '') + '</td><td>' + U.esc(x.method || '') + '</td><td><span class="st-done">' + (x.status || 'Done') + '</span></td><td class="r ' + (x.amt >= 0 ? 'pos' : 'neg') + '">' + U.money(x.amt, x.cur, true) + '</td></tr>').join('') + '</tbody>';
  el.append(U.el('div.ptable-wrap', null, t));
}
function transactions(el) {
  el.append(U.el('div.pa-h1row', null, U.el('h1', { text: 'Transaction history' })));
  const f = AT.prefs.txF || 'all';
  const seg = U.el('div.seg-light'); for (const [k, l] of [['all', 'All'], ['Deposit', 'Deposits'], ['Withdrawal', 'Withdrawals'], ['Transfer', 'Transfers'], ['Adjustment', 'Adjustments']]) seg.append(U.el('button' + (k === f ? '.on' : ''), { type: 'button', text: l, onclick: () => { AT.setPref('txF', k); render(); } }));
  el.append(seg);
  txTable(el, t => f === 'all' || t.type === f);
}
/* ---------- order history ---------- */
function history(el) {
  el.append(U.el('div.pa-h1row', null, U.el('h1', { text: 'Order history' })));
  const st = PA.hst = PA.hst || { acc: E.st.active, per: 'month', sym: '' };
  const accSel = U.el('select.inp'); for (const a of E.st.accounts) accSel.append(U.el('option', { value: a.id, text: '#' + a.id + ' · ' + S.ACCOUNT_TYPES[a.type].name + (a.archived ? ' (archived)' : ''), selected: a.id === st.acc ? true : null }));
  const per = U.el('select.inp'); for (const [k, l] of [['day', 'Today'], ['week', 'Last 7 days'], ['month', 'Last 30 days'], ['q', 'Last 3 months'], ['all', 'All time']]) per.append(U.el('option', { value: k, text: l, selected: st.per === k ? true : null }));
  const sym = U.el('input.inp', { type: 'search', placeholder: 'Symbol', value: st.sym });
  const exp = U.el('button.btn.btn-light', { type: 'button', html: U.icon('download') + ' Export CSV' });
  el.append(U.el('div.pa-filters', null, accSel, per, sym, U.el('span.grow'), exp));
  accSel.onchange = () => { st.acc = accSel.value; render(); }; per.onchange = () => { st.per = per.value; render(); }; sym.onchange = () => { st.sym = sym.value.trim(); render(); };
  const a = E.acc(st.acc) || E.active();
  const now = Date.now(); const since = st.per === 'day' ? new Date().setUTCHours(0, 0, 0, 0) : st.per === 'week' ? now - 7 * 864e5 : st.per === 'month' ? now - 30 * 864e5 : st.per === 'q' ? now - 91 * 864e5 : 0;
  const rows = E.history(a.id).filter(h => h.t1 >= since && (!st.sym || ((S.map[h.sym] || {}).n || h.sym).toLowerCase().includes(st.sym.toLowerCase())));
  exp.onclick = () => { const out = [['Order/Position', 'Symbol', 'Type', 'Volume', 'Open time', 'Open price', 'Close time', 'Close price', 'T/P', 'S/L', 'Swap', 'Commission', 'P/L', 'Reason']]; for (const h of rows) out.push([h.id, (S.map[h.sym] || {}).n || h.sym, h.ord ? E.typeLabel(h) : h.side, h.vol, new Date(h.t0).toISOString(), h.open, new Date(h.t1).toISOString(), h.close == null ? '' : h.close, h.tp || '', h.sl || '', h.swap, h.comm, h.ord ? '' : h.pl, h.reason || '']); U.download('order_history_' + a.id + '.csv', U.csv(out), 'text/csv'); };
  if (!rows.length) { el.append(U.el('div.pa-empty', { html: '<b>No orders in this period</b>' })); return; }
  const t = U.el('table.ptable');
  t.innerHTML = '<thead><tr><th>Symbol</th><th>Type</th><th class="r">Volume</th><th class="r">Open price</th><th class="r">Close price</th><th class="r">T/P</th><th class="r">S/L</th><th>ID</th><th>Open time</th><th>Close time</th><th>Reason</th><th class="r">P/L, ' + a.cur + '</th></tr></thead><tbody>' +
    rows.slice(0, 1000).map(h => { const s = S.map[h.sym] || { n: h.sym, dg: 2 }; return '<tr><td>' + (s.s ? S.iconHTML(s, 16) : '') + ' ' + U.esc(s.n) + '</td><td>' + (h.ord ? E.typeLabel(h) : (h.side === 'buy' ? 'Buy' : 'Sell')) + '</td><td class="r">' + U.fmt(h.vol, 2) + '</td><td class="r">' + U.fmt(h.open, s.dg) + '</td><td class="r">' + (h.close == null ? '-' : U.fmt(h.close, s.dg)) + '</td><td class="r">' + (h.tp ? U.fmt(h.tp, s.dg) : '-') + '</td><td class="r">' + (h.sl ? U.fmt(h.sl, s.dg) : '-') + '</td><td>' + h.id + '</td><td>' + U.fmtTime(h.t0, 'full') + '</td><td>' + U.fmtTime(h.t1, 'full') + '</td><td>' + U.esc(h.reason || '') + '</td><td class="r ' + (h.ord ? '' : h.pl >= 0 ? 'pos' : 'neg') + '">' + (h.ord ? '-' : U.fmtSignedAscii(h.pl, 2)) + '</td></tr>'; }).join('') + '</tbody>';
  el.append(U.el('div.ptable-wrap', null, t));
}
/* ---------- performance ---------- */
function performance(el) {
  el.append(U.el('div.pa-h1row', null, U.el('h1', { text: 'Performance' })));
  const st = PA.pst = PA.pst || { acc: E.st.active, per: 'month' };
  const accSel = U.el('select.inp'); for (const a of E.st.accounts) accSel.append(U.el('option', { value: a.id, text: '#' + a.id + ' · ' + S.ACCOUNT_TYPES[a.type].name, selected: a.id === st.acc ? true : null }));
  const per = U.el('div.seg-light'); for (const [k, l] of [['week', '7 days'], ['month', '30 days'], ['q', '90 days'], ['year', '365 days'], ['all', 'All']]) per.append(U.el('button' + (st.per === k ? '.on' : ''), { type: 'button', text: l, onclick: () => { st.per = k; render(); } }));
  accSel.onchange = () => { st.acc = accSel.value; render(); };
  el.append(U.el('div.pa-filters', null, accSel, per));
  const a = E.acc(st.acc) || E.active();
  const now = Date.now(); const days = { week: 7, month: 30, q: 90, year: 365, all: 36500 }[st.per]; const since = now - days * 864e5;
  const deals = E.history(a.id).filter(h => !h.ord && h.t1 >= since).sort((x, y) => x.t1 - y.t1);
  const net = deals.reduce((s, h) => s + h.pl + (h.swap || 0) + (h.comm || 0), 0);
  const prof = deals.filter(h => h.pl > 0), loss = deals.filter(h => h.pl < 0);
  const gp = prof.reduce((s, h) => s + h.pl, 0), gl = loss.reduce((s, h) => s + h.pl, 0);
  const vol = deals.reduce((s, h) => s + h.vol, 0);
  const kpi = (l, v, cls) => '<div class="kpi"><span>' + l + '</span><b class="' + (cls || '') + '">' + v + '</b></div>';
  el.append(U.el('div.kpis', { html: kpi('Net profit', U.money(net, a.cur, true), net >= 0 ? 'pos' : 'neg') + kpi('Profit', U.money(gp, a.cur)) + kpi('Loss', U.money(gl, a.cur), 'neg') + kpi('Closed orders', deals.length) + kpi('Profitable', deals.length ? U.pct(prof.length / deals.length * 100, 1) : '-') + kpi('Profit factor', gl ? U.fmt(gp / -gl, 2) : '-') + kpi('Trading volume', U.fmt(vol, 2) + ' lots') + kpi('Average trade', deals.length ? U.money(net / deals.length, a.cur, true) : '-') }));
  const cv = U.el('canvas.perf-chart'); el.append(U.el('div.perf-box', null, U.el('h3', { text: 'Net profit over time' }), cv));
  requestAnimationFrame(() => drawCurve(cv, deals, a));
  const by = {};
  for (const h of deals) { const k = h.sym; const b = by[k] = by[k] || { n: 0, pl: 0, win: 0, vol: 0 }; b.n++; b.pl += h.pl + (h.swap || 0) + (h.comm || 0); b.vol += h.vol; if (h.pl > 0) b.win++; }
  const keys = Object.keys(by).sort((x, y) => by[y].pl - by[x].pl);
  if (keys.length) {
    const t = U.el('table.ptable');
    t.innerHTML = '<thead><tr><th>Instrument</th><th class="r">Orders</th><th class="r">Profitable</th><th class="r">Volume</th><th class="r">Net P/L, ' + a.cur + '</th></tr></thead><tbody>' + keys.map(k => { const s = S.map[k] || { n: k }; const b = by[k]; return '<tr><td>' + (s.s ? S.iconHTML(s, 16) : '') + ' ' + U.esc(s.n) + '</td><td class="r">' + b.n + '</td><td class="r">' + U.pct(b.win / b.n * 100, 1) + '</td><td class="r">' + U.fmt(b.vol, 2) + '</td><td class="r ' + (b.pl >= 0 ? 'pos' : 'neg') + '">' + U.fmtSignedAscii(b.pl, 2) + '</td></tr>'; }).join('') + '</tbody>';
    el.append(U.el('h3', { text: 'By instrument' }), U.el('div.ptable-wrap', null, t));
  }
}
function drawCurve(cv, deals, a) {
  const dpr = window.devicePixelRatio || 1; const w = cv.clientWidth || 600, h = cv.clientHeight || 220;
  cv.width = w * dpr; cv.height = h * dpr; const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement);
  const fg = css.getPropertyValue('--pa-text2').trim() || '#6b7780', line = css.getPropertyValue('--pa-line').trim() || '#e3e6e8';
  g.clearRect(0, 0, w, h);
  if (!deals.length) { g.fillStyle = fg; g.font = '13px Inter, sans-serif'; g.fillText('No closed orders in this period', 16, h / 2); return; }
  let cum = 0; const pts = [[deals[0].t0, 0]].concat(deals.map(d => [d.t1, cum += d.pl + (d.swap || 0) + (d.comm || 0)]));
  const t0 = pts[0][0], t1 = pts[pts.length - 1][0] || t0 + 1; const vmin = Math.min(0, ...pts.map(p => p[1])), vmax = Math.max(0, ...pts.map(p => p[1]));
  const X = t => 48 + (w - 60) * ((t - t0) / Math.max(1, t1 - t0)), Y = v => 12 + (h - 34) * (1 - (v - vmin) / Math.max(1e-9, vmax - vmin));
  g.strokeStyle = line; g.lineWidth = 1; for (let i = 0; i <= 4; i++) { const v = vmin + (vmax - vmin) * i / 4; const y = Y(v); g.beginPath(); g.moveTo(48, y); g.lineTo(w - 8, y); g.stroke(); g.fillStyle = fg; g.font = '11px Inter, sans-serif'; g.textAlign = 'right'; g.fillText(U.fmt(v, Math.abs(v) >= 1000 ? 0 : 2), 44, y + 4); }
  const grad = g.createLinearGradient(0, 0, 0, h); const up = cum >= 0; grad.addColorStop(0, up ? 'rgba(47,180,124,0.28)' : 'rgba(239,109,101,0.28)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.beginPath(); g.moveTo(X(pts[0][0]), Y(0)); for (const p of pts) g.lineTo(X(p[0]), Y(p[1])); g.lineTo(X(pts[pts.length - 1][0]), Y(0)); g.closePath(); g.fillStyle = grad; g.fill();
  g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1]))); g.strokeStyle = up ? '#2FB47C' : '#EF6D65'; g.lineWidth = 2; g.stroke();
  g.textAlign = 'left'; g.fillStyle = fg; g.fillText(U.fmtTime(t0, 'date'), 48, h - 6); g.textAlign = 'right'; g.fillText(U.fmtTime(t1, 'date'), w - 8, h - 6);
}
/* ---------- calendar page ---------- */
async function calendar(el) {
  el.append(U.el('div.pa-h1row', null, U.el('h1', { text: 'Economic Calendar' })));
  const box = U.el('div.ptable-wrap', { html: '<div class="pa-empty">Loading…</div>' }); el.append(box);
  const ev = await AT.Pn.loadCal();
  if (!ev.length) { box.innerHTML = '<div class="pa-empty"><b>Calendar is unavailable right now</b></div>'; return; }
  const imp = { High: 3, Medium: 2, Low: 1, Holiday: 0 };
  box.innerHTML = '<table class="ptable"><thead><tr><th>Time</th><th>Currency</th><th>Impact</th><th>Event</th><th class="r">Actual</th><th class="r">Forecast</th><th class="r">Previous</th></tr></thead><tbody>' + ev.map(e => { const t = Date.parse(e.date); return '<tr class="' + (t < Date.now() ? 'past' : '') + '"><td>' + U.fmtTime(t, 'full') + '</td><td><span class="flg">' + ((S.CUR[e.country] || [])[1] || '') + '</span> ' + U.esc(e.country) + '</td><td><i class="imp i' + (imp[e.impact] || 0) + '"><b></b><b></b><b></b></i></td><td>' + U.esc(e.title) + '</td><td class="r">' + U.esc(e.actual || '-') + '</td><td class="r">' + U.esc(e.forecast || '-') + '</td><td class="r">' + U.esc(e.previous || '-') + '</td></tr>'; }).join('') + '</tbody></table>';
}
})();
