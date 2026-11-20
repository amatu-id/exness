/* Amatu Trade — web terminal shell: header, symbol tabs, chart toolbars, orders panel, status bar, money dialogs */
(function () {
'use strict';
const AT = window.AT, U = AT.U, S = AT.S, F = AT.F, E = AT.E, C = AT.C;
const T = AT.T = {};
let $root = null, chart = null;

/* ---------- undo manager ---------- */
AT.undo = { stack: [], redoStack: [], push(x) { this.stack.push(x); if (this.stack.length > 80) this.stack.shift(); this.redoStack = []; U.emit('undo'); }, undo() { const x = this.stack.pop(); if (!x) return; x.undo(); this.redoStack.push(x); U.emit('undo'); }, redo() { const x = this.redoStack.pop(); if (!x) return; x.redo(); this.stack.push(x); U.emit('undo'); } };

/* ---------- layout ---------- */
T.mount = function (root) {
  $root = root;
  root.innerHTML = `
  <header class="t-head">
    <a class="logo" href="#/" aria-label="Amatu Trade">${AT.logoSVG()}</a>
    <div class="grow"></div>
    <div class="acc-pill"><button class="acc-btn" id="acc-btn" type="button"></button><button class="bal-btn" id="bal-btn" type="button"></button></div>
    <button class="btn-dep" id="dep-btn" type="button">${U.icon('deposit')}<span>Deposit</span></button>
    <button class="icon-btn hb" id="theme-btn" type="button" title="Theme">${U.icon('moon')}</button>
    <button class="icon-btn hb" id="notif-btn" type="button" title="Notifications">${U.icon('bell')}<i class="ndot hidden"></i></button>
    <button class="icon-btn hb" id="apps-btn" type="button" title="Apps">${U.icon('apps')}</button>
    <button class="icon-btn hb" id="prof-btn" type="button" title="Profile">${U.icon('user')}</button>
  </header>
  <nav class="t-tabs" id="tabs"></nav>
  <div class="t-main">
    <aside class="t-rail" id="rail">
      <button type="button" data-p="inst" title="Instruments">${U.icon('list')}</button>
      <button type="button" data-p="cal" title="Economic calendar">${U.icon('calendar')}</button>
      <button type="button" data-p="alert" title="Price alerts">${U.icon('alarm')}</button>
      <button type="button" data-p="script" title="Script editor">${U.icon('braces')}</button>
      <button type="button" data-p="ea" title="Expert Advisors (MetaTrader EA)">${U.icon('robot')}</button>
      <button type="button" data-p="set" title="Settings">${U.icon('gear')}</button>
    </aside>
    <section class="t-side hidden" id="side"></section>
    <div class="t-center" id="center">
      <div class="t-chart" id="chartbox">
        <div class="c-top" id="ctop"></div>
        <div class="c-body">
          <div class="c-tools" id="ctools"></div>
          <div class="c-host" id="chost"></div>
        </div>
        <div class="c-replay hidden" id="creplay"></div>
      </div>
      <div class="t-split" id="split"></div>
      <div class="t-orders" id="orders"></div>
    </div>
    <aside class="t-order" id="orderp"></aside>
  </div>
  <div class="ph-trade" id="phtrade"></div>
  <footer class="t-status" id="status"></footer>
  <nav class="ph-nav" id="phnav">
    <button type="button" data-v="markets">${U.icon('list')}<span>Markets</span></button>
    <button type="button" data-v="chart">${U.icon('ct-candles')}<span>Chart</span></button>
    <button type="button" data-v="trade">${U.icon('trade')}<span>Trade</span></button>
    <button type="button" data-v="orders">${U.icon('briefcase')}<span>Orders</span></button>
    <button type="button" data-v="account">${U.icon('user')}<span>Account</span></button>
  </nav>`;
  const ui = AT.ui;
  chart = T.chart = new C.Chart(U.$('#chost'));
  chart.host.addEventListener('click', e => { if (e.target.closest('.lg-ind') && AT.I) AT.I.onLegendClick(e); });
  AT.O.mount(U.$('#orderp'));
  header(); tabs(); rail(); chartTop(); chartTools(); ordersPanel(); status(); split(); phone();
  T.toggleOrderPanel(ui.orderOpen !== false, true);
  T.toggleBottom(ui.bottomOpen !== false, true);
  if (ui.side) AT.Pn.open(ui.side, true);
  T.openSymbol(AT.prefs.tab || 'XAUUSD', true);
  U.on('state', () => { header(); renderOrders(); status(); chart.lines.update(); chart.updateMarkers(); AT.O.render(); hotSyms(); });
  U.on('acc', () => { chart.computeShift(); chart.setSeriesData(); });
  U.on('hist', () => { if (T.otab === 'closed') renderOrders(); chart.updateMarkers(); });
  U.on('notif', () => { const n = E.notifs.filter(x => !x.read).length; U.$('#notif-btn .ndot').classList.toggle('hidden', !n); });
  U.on('feed-status', status);
  U.on('replay', replayBar);
  U.on('undo', () => { const b = U.$('#ctop [data-a="undo"]'), r = U.$('#ctop [data-a="redo"]'); if (b) b.disabled = !AT.undo.stack.length; if (r) r.disabled = !AT.undo.redoStack.length; });
  U.on('tool', toolState);
  document.addEventListener('keydown', keys);
  U.emit('notif');
};
T.formVol = () => AT.O.vol();
T.quickPending = (side, px) => AT.O.pendingAt(side, px);

/* ---------- header ---------- */
function header() {
  const a = E.active(); if (!a) return;
  const m = E.metrics(a);
  U.$('#acc-btn').innerHTML = '#' + a.id + U.icon('chev-down');
  U.$('#bal-btn').innerHTML = '<span data-hbal>' + (AT.prefs.hideBal ? '••••' : U.fmt(m.eq, 2)) + ' ' + a.cur + '</span>' + U.icon('more-v');
  if (header.done) return; header.done = true;
  U.$('#acc-btn').onclick = e => accountMenu(e.currentTarget);
  U.$('#bal-btn').onclick = e => balanceMenu(e.currentTarget);
  U.$('#dep-btn').onclick = () => T.money('deposit');
  U.$('#theme-btn').onclick = () => AT.setTheme(AT.prefs.theme === 'dark' ? 'light' : 'dark');
  U.$('#notif-btn').onclick = e => notifPanel(e.currentTarget);
  U.$('#apps-btn').onclick = e => U.menu(e.currentTarget, [
    { header: 'Amatu Trade' }, { label: 'Personal Area', icon: 'home', onClick: () => AT.go('#/pa/accounts') }, { label: 'Terminal', icon: 'ct-candles', onClick: () => AT.go('#/') },
    { label: 'Performance', icon: 'chart', onClick: () => AT.go('#/pa/performance') }, { label: 'Order history', icon: 'history', onClick: () => AT.go('#/pa/history') },
    { label: 'Economic calendar', icon: 'calendar', onClick: () => AT.Pn.open('cal') }, { sep: true },
    { label: 'Portal AMATU', icon: 'apps', onClick: () => { location.href = '/'; } }
  ], { alignRight: true, minWidth: 220 });
  U.$('#prof-btn').onclick = e => U.menu(e.currentTarget, [
    { header: 'Profile' }, { label: 'My accounts', icon: 'wallet', onClick: () => AT.go('#/pa/accounts') }, { label: 'Transaction history', icon: 'history', onClick: () => AT.go('#/pa/transactions') },
    { label: 'Terminal settings', icon: 'gear', onClick: () => AT.Pn.open('set') }, { label: AT.prefs.theme === 'dark' ? 'Light theme' : 'Dark theme', icon: AT.prefs.theme === 'dark' ? 'sun' : 'moon', onClick: () => AT.setTheme(AT.prefs.theme === 'dark' ? 'light' : 'dark') },
    { sep: true }, { label: 'Back to Portal', icon: 'arrow-left', onClick: () => { location.href = '/'; } }
  ], { alignRight: true, minWidth: 220 });
}
T.header = header;
function accountMenu(btn) {
  const items = [{ header: 'Switch account' }];
  for (const a of E.st.accounts.filter(x => !x.archived)) {
    const m = E.metrics(a);
    const node = U.el('button.pm-item.acc-row' + (a.id === E.st.active ? '.active' : ''), { type: 'button' });
    node.innerHTML = '<span class="acc-r1"><span class="badge t-' + a.type + '">' + U.esc(S.ACCOUNT_TYPES[a.type].name) + '</span># ' + a.id + ' <span class="muted">' + U.esc(a.nick || '') + '</span></span><span class="acc-r2">' + U.fmt(m.eq, 2) + ' ' + a.cur + '</span>';
    node.onclick = () => { U.closeMenu(); E.setActive(a.id); };
    items.push({ node });
  }
  items.push({ sep: true }, { label: 'Manage Accounts', right: U.icon('external'), onClick: () => AT.go('#/pa/accounts') }, { label: 'Open new account', icon: 'plus', onClick: () => AT.go('#/pa/new') });
  U.menu(btn, items, { alignRight: true, minWidth: 280, cls: 'menu-acc' });
}
function balanceMenu(btn) {
  const a = E.active(); const m = E.metrics(a);
  const row = (l, v, tip) => '<div class="bm-row"><span>' + l + '</span><b>' + v + '</b><span class="help" title="' + U.esc(tip) + '">' + U.icon('help') + '</span></div>';
  const top = U.el('div.bm-top', { html: row('Balance', U.money(a.bal, a.cur), 'Funds in the account without the floating profit/loss of open positions.') + row('Equity', U.money(m.eq, a.cur), 'Balance plus the floating profit/loss of open positions.') + row('Margin', U.money(m.margin, a.cur), 'Funds reserved to keep the open positions.') + row('Free margin', U.money(m.free, a.cur), 'Funds available to open new positions.') + row('Margin level', m.ml == null ? '-' : U.pct(m.ml), 'Equity divided by margin. Stop out at ' + S.ACCOUNT_TYPES[a.type].so + '%.') + row('Account leverage', S.levLabel(a.lev), 'Maximum leverage of this account.') });
  const acts = U.el('div.bm-acts');
  for (const [k, l, ic] of [['withdraw', 'Withdraw', 'withdraw'], ['transfer', 'Transfer', 'transfer'], ['deposit', 'Deposit', 'deposit']]) { const b = U.el('button.bm-act', { type: 'button', html: '<i>' + U.icon(ic) + '</i><span>' + l + '</span>' }); b.onclick = () => { U.closeMenu(); T.money(k); }; acts.append(b); }
  const tog = U.el('label.bm-tog', { html: '<span>Hide balance</span>' }); const sw = U.el('input.switch', { type: 'checkbox', checked: AT.prefs.hideBal ? true : null }); sw.onchange = () => { AT.setPref('hideBal', sw.checked); header(); status(); }; tog.append(sw);
  U.menu(btn, [{ node: top }, { node: acts }, { sep: true }, { node: tog },
    { label: 'Transaction History', right: U.icon('external'), onClick: () => AT.go('#/pa/transactions') },
    { label: 'Download Trading Log', right: U.icon('external'), onClick: () => T.downloadLog(a) }, { sep: true },
    { label: 'Switch account', right: U.icon('chev-right'), onClick: () => setTimeout(() => accountMenu(U.$('#acc-btn')), 0) }], { alignRight: true, minWidth: 300, cls: 'menu-bal' });
}
T.downloadLog = function (a) {
  const rows = [['Position', 'Symbol', 'Type', 'Volume', 'Open time (UTC)', 'Open price', 'Close time (UTC)', 'Close price', 'T/P', 'S/L', 'Swap', 'Commission', 'Profit', 'Reason', 'Currency']];
  for (const h of E.history(a.id)) { if (h.ord) continue; const s = S.map[h.sym]; rows.push([h.id, s ? s.n : h.sym, h.side, h.vol, new Date(h.t0).toISOString(), h.open, new Date(h.t1).toISOString(), h.close, h.tp || '', h.sl || '', h.swap, h.comm, h.pl, h.reason || 'Client', a.cur]); }
  U.download('trading_log_' + a.id + '_' + new Date().toISOString().slice(0, 10) + '.csv', U.csv(rows), 'text/csv');
};
function notifPanel(btn) {
  const list = E.notifs.slice(0, 40);
  const items = [{ header: 'Notifications' }];
  if (!list.length) items.push({ node: U.el('div.empty-sm', { text: 'No notifications yet' }) });
  for (const n of list) items.push({ node: U.el('div.notif-row' + (n.read ? '' : '.unread'), { html: '<b>' + U.esc(n.title) + '</b><span>' + U.esc(n.text || '') + '</span><small>' + U.fmtTime(n.t, 'full') + '</small>' }) });
  if (list.length) items.push({ sep: true }, { label: 'Clear all', icon: 'trash', onClick: () => { E.notifs.length = 0; U.save('exness.notif', E.notifs); U.emit('notif'); } });
  U.menu(btn, items, { alignRight: true, minWidth: 320, cls: 'menu-notif' });
  for (const n of E.notifs) n.read = true; U.save('exness.notif', E.notifs); U.emit('notif');
}

/* ---------- money dialogs (deposit / withdraw / transfer) ---------- */
T.money = function (kind, accId) {
  const a = E.acc(accId) || E.active();
  const title = kind === 'deposit' ? 'Deposit' : kind === 'withdraw' ? 'Withdrawal' : 'Transfer';
  const body = U.el('div.money');
  const accSel = U.el('select.inp');
  for (const x of E.st.accounts.filter(y => !y.archived)) accSel.append(U.el('option', { value: x.id, text: '#' + x.id + ' · ' + S.ACCOUNT_TYPES[x.type].name + ' · ' + U.fmt(x.bal, 2) + ' ' + x.cur, selected: x.id === a.id ? true : null }));
  const toSel = U.el('select.inp');
  const fillTo = () => { toSel.innerHTML = ''; for (const x of E.st.accounts.filter(y => !y.archived && y.id !== accSel.value)) toSel.append(U.el('option', { value: x.id, text: '#' + x.id + ' · ' + S.ACCOUNT_TYPES[x.type].name + ' · ' + U.fmt(x.bal, 2) + ' ' + x.cur })); };
  const amt = U.el('input.inp.amt', { type: 'text', inputmode: 'decimal', placeholder: '0.00' });
  const cur = U.el('span.amt-cur');
  const quick = U.el('div.quick');
  const note = U.el('div.money-note');
  const setCur = () => { const x = E.acc(accSel.value); cur.textContent = x.cur; quick.innerHTML = ''; const base = x.cur === 'IDR' ? [1e6, 5e6, 10e6, 50e6, 100e6] : x.cur === 'JPY' ? [10000, 50000, 100000, 500000, 1e6] : x.cur === 'USC' ? [1000, 10000, 50000, 100000, 1e6] : [100, 500, 1000, 5000, 10000]; for (const v of base) { const b = U.el('button.chip', { type: 'button', text: U.fmt(v, 0) }); b.onclick = () => { amt.value = v; upd(); }; quick.append(b); } if (kind === 'transfer') fillTo(); upd(); };
  const upd = () => {
    const x = E.acc(accSel.value); const m = E.metrics(x); const v = U.parseNum(amt.value);
    if (kind === 'deposit') note.innerHTML = 'Funds are credited instantly. Balance after deposit: <b>' + U.money(x.bal + (v > 0 ? v : 0), x.cur) + '</b>';
    else { const avail = Math.max(0, Math.min(m.free, x.bal)); note.innerHTML = 'Available: <b>' + U.money(avail, x.cur) + '</b>' + (kind === 'transfer' && toSel.value && v > 0 ? ' · Receiving account gets <b>' + U.money(F.convert(v, x.cur, E.acc(toSel.value).cur) || 0, E.acc(toSel.value).cur) + '</b>' : ''); }
  };
  accSel.onchange = setCur; amt.oninput = upd; toSel.onchange = upd;
  body.append(U.el('label.fl', { text: kind === 'transfer' ? 'From account' : 'Account' }), accSel);
  if (kind === 'transfer') body.append(U.el('label.fl', { text: 'To account' }), toSel);
  body.append(U.el('label.fl', { text: 'Amount' }), U.el('div.amt-row', null, amt, cur), quick, note);
  const ok = U.el('button.btn.btn-yellow.wide', { type: 'button', text: kind === 'deposit' ? 'Deposit' : kind === 'withdraw' ? 'Withdraw' : 'Transfer' });
  const m = U.modal({ title, body, foot: ok, width: 420, cls: 'money-modal' });
  setCur(); setTimeout(() => amt.focus(), 30);
  amt.addEventListener('keydown', e => { if (e.key === 'Enter') ok.click(); });
  ok.onclick = () => {
    const v = U.parseNum(amt.value);
    if (!(v > 0)) { U.toast('Enter an amount', '', 'error'); return; }
    let r;
    if (kind === 'deposit') r = E.deposit(accSel.value, v);
    else if (kind === 'withdraw') r = E.withdraw(accSel.value, v);
    else { if (!toSel.value) { U.toast('No other account', 'Open a second account first.', 'error'); return; } r = E.transfer(accSel.value, toSel.value, v); }
    if (r.err) { U.toast('Request rejected', U.esc(r.err), 'error'); return; }
    const x = E.acc(accSel.value);
    U.toast(title + ' successful', U.esc(U.money(kind === 'deposit' ? r.amount : v, x.cur)) + (kind === 'transfer' ? ' → #' + toSel.value : ' · #' + x.id), 'ok');
    m.close();
  };
};

/* ---------- symbol tabs ---------- */
function tabs() {
  const nav = U.$('#tabs');
  const list = AT.prefs.tabs && AT.prefs.tabs.length ? AT.prefs.tabs.filter(id => S.map[id]) : ['BTCUSD', 'XAUUSD'];
  nav.innerHTML = '';
  for (const id of list) {
    const s = S.map[id];
    const b = U.el('button.tab' + (id === AT.prefs.tab ? '.on' : ''), { type: 'button', 'data-s': id, draggable: 'true', html: S.iconHTML(s, 18) + '<span>' + U.esc(s.n) + '</span><i class="tab-x" title="Close">' + U.icon('x') + '</i>' });
    b.onclick = e => { if (e.target.closest('.tab-x')) { closeTab(id); return; } T.openSymbol(id); };
    b.ondragstart = e => { e.dataTransfer.setData('text/plain', id); };
    b.ondragover = e => e.preventDefault();
    b.ondrop = e => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain'); const t = AT.prefs.tabs.slice(); const i = t.indexOf(from), j = t.indexOf(id); if (i < 0 || j < 0) return; t.splice(i, 1); t.splice(j, 0, from); AT.setPref('tabs', t); tabs(); };
    nav.append(b);
  }
  const add = U.el('button.tab-add', { type: 'button', title: 'Add instrument', html: U.icon('plus') });
  add.onclick = () => symbolSearch(add);
  nav.append(add);
}
T.tabs = tabs;
function closeTab(id) {
  const t = AT.prefs.tabs.filter(x => x !== id);
  if (!t.length) return;
  AT.setPref('tabs', t);
  if (AT.prefs.tab === id) T.openSymbol(t[Math.max(0, AT.prefs.tabs.indexOf(id) - 1)] || t[0]); else tabs();
}
T.openSymbol = function (id, first) {
  if (!S.map[id]) id = 'XAUUSD';
  const t = (AT.prefs.tabs || []).slice();
  if (!t.includes(id)) { t.push(id); if (t.length > 12) t.shift(); AT.setPref('tabs', t); }
  AT.setPref('tab', id);
  tabs();
  const tf = (AT.prefs.tfs || {})[id] || AT.prefs.tf || 86400;
  chart.setSymbol(id, tf, AT.prefs.ctype || 'candles');
  AT.O.setSymbol(id);
  chartTop();
  hotSyms();
  T.title();
  if (AT.Pn) AT.Pn.refreshActive();
  if (!first && U.isPhone() && T.phView === 'markets') T.phShow('chart');
};
function symbolSearch(anchor) {
  const box = U.el('div.sym-search');
  const q = U.el('input.inp.search', { type: 'search', placeholder: 'Search' });
  const cat = U.el('div.sym-cats');
  const list = U.el('div.sym-list');
  let g = 'All';
  for (const k of ['All', 'Majors', 'Minors', 'Exotic', 'Metals', 'Crypto', 'Indices', 'Energy', 'Stocks']) { const b = U.el('button.chip' + (k === g ? '.on' : ''), { type: 'button', text: k }); b.onclick = () => { g = k; cat.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === b)); render(); }; cat.append(b); }
  box.append(q, cat, list);
  const render = () => {
    const s = q.value.trim().toLowerCase(); list.innerHTML = '';
    const rows = S.list.filter(x => (g === 'All' || x.g === g) && (!s || (x.n + ' ' + x.s + ' ' + x.d).toLowerCase().includes(s))).slice(0, 120);
    for (const x of rows) { const r = U.el('button.sym-row', { type: 'button', html: S.iconHTML(x, 20) + '<b>' + U.esc(x.n) + '</b><span>' + U.esc(x.d) + '</span><small>' + U.esc(x.g) + '</small>' }); r.onclick = () => { m.close(); T.openSymbol(x.s); }; list.append(r); }
    if (!rows.length) list.append(U.el('div.empty-sm', { text: 'No instruments found' }));
  };
  const m = U.modal({ title: 'Add instrument', body: box, width: 520, cls: 'sym-modal' });
  q.oninput = render; render(); setTimeout(() => q.focus(), 30);
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = list.querySelector('.sym-row'); if (f) f.click(); } });
}
T.symbolSearch = () => symbolSearch(U.$('.tab-add'));
T.title = function () {
  const id = AT.prefs.tab; const s = S.map[id]; const a = E.active(); const x = a && s ? E.quote(a, id) : null;
  document.title = s ? s.n + ' ' + ((AT.prefs.priceSrc || 'bid') === 'ask' ? 'Ask ' + (x ? U.fmt(x.ask, s.dg) : '') : 'Bid ' + (x ? U.fmt(x.bid, s.dg) : '')) : 'Amatu Trade';
};
function hotSyms() {
  const a = E.active(); const ids = new Set(AT.prefs.tabs || []);
  for (const acc of E.st.accounts) { for (const p of acc.pos) ids.add(p.sym); for (const o of acc.ord) ids.add(o.sym); }
  if (AT.Pn) for (const id of AT.Pn.visibleSyms()) ids.add(id);
  F.setHot(Array.from(ids));
}
T.hotSyms = hotSyms;

/* ---------- left rail ---------- */
function rail() {
  U.$('#rail').addEventListener('click', e => { const b = e.target.closest('button[data-p]'); if (!b) return; AT.Pn.toggle(b.dataset.p); });
}

/* ---------- chart top toolbar ---------- */
function chartTop() {
  const el = U.$('#ctop'); if (!el) return;
  const tf = chart.tf; const ct = C.TYPES.find(x => x.k === chart.type) || C.TYPES[1];
  el.innerHTML = `
    <button class="cb" data-a="compare" title="Compare or add symbol">${U.icon('plus-circle')}</button><i class="sep"></i>
    <button class="cb tfb" data-a="tf" title="Interval">${C.tfKey(tf)}</button><i class="sep"></i>
    <button class="cb" data-a="type" title="Chart type">${U.icon(ct.i)}</button><i class="sep"></i>
    <button class="cb txt" data-a="ind" title="Indicators">${U.icon('fx')}<span>Indicators</span></button>
    <button class="cb" data-a="tpl" title="Indicator templates">${U.icon('layout')}</button><i class="sep"></i>
    <button class="cb" data-a="replay" title="Bar replay">${U.icon('replay')}</button><i class="sep"></i>
    <button class="cb" data-a="undo" title="Undo" ${AT.undo.stack.length ? '' : 'disabled'}>${U.icon('undo')}</button>
    <button class="cb" data-a="redo" title="Redo" ${AT.undo.redoStack.length ? '' : 'disabled'}>${U.icon('redo')}</button>
    <span class="grow"></span>
    <button class="cb" data-a="layout" title="Select layout">${U.icon('square')}</button>
    <button class="cb txt save" data-a="save" title="Save all charts for all symbols and intervals"><span>Save<small>${AT.prefs.layoutName ? U.esc(AT.prefs.layoutName) : 'Save'}</small></span></button>
    <button class="cb" data-a="savemenu" title="Manage layouts">${U.icon('chev-down')}</button><i class="sep"></i>
    <button class="cb" data-a="quick" title="Quick search">${U.icon('quick')}</button><i class="sep"></i>
    <button class="cb" data-a="shot" title="Take a snapshot">${U.icon('camera')}</button><i class="sep"></i>
    <button class="cb" data-a="full" title="Fullscreen mode">${U.icon('fullscreen')}</button>`;
  if (chartTop.done) return; chartTop.done = true;
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const a = b.dataset.a;
    if (a === 'tf') tfMenu(b);
    else if (a === 'type') U.menu(b, C.TYPES.map(t => ({ label: t.l, icon: t.i, active: t.k === chart.type, onClick: () => { AT.setPref('ctype', t.k); chart.setType(t.k); chartTop(); } })), { minWidth: 200 });
    else if (a === 'ind') AT.I.picker();
    else if (a === 'tpl') templatesMenu(b);
    else if (a === 'replay') { if (chart.replay) chart.replayExit(); else { chart.replayStart(); AT.D.setTool('cross'); U.$('.draw-over').style.pointerEvents = 'auto'; U.toast('Bar replay', 'Click on the chart to choose the starting point.', 'info', 3000); } }
    else if (a === 'undo') AT.undo.undo();
    else if (a === 'redo') AT.undo.redo();
    else if (a === 'layout') U.toast('Single chart layout', 'This terminal shows one chart per tab.', 'info', 2500);
    else if (a === 'save') { AT.layouts.save(); }
    else if (a === 'savemenu') AT.layouts.menu(b);
    else if (a === 'quick') quickSearch();
    else if (a === 'shot') U.menu(b, [{ label: 'Download image', icon: 'download', onClick: () => chart.screenshot(false) }, { label: 'Copy image', icon: 'copy', onClick: () => chart.screenshot(true) }], { alignRight: true });
    else if (a === 'full') { const box = U.$('#chartbox'); if (document.fullscreenElement) document.exitFullscreen(); else if (box.requestFullscreen) box.requestFullscreen().catch(() => box.classList.toggle('pseudo-full')); else box.classList.toggle('pseudo-full'); }
    else if (a === 'compare') T.symbolSearch();
  });
}
T.chartTop = chartTop;
function tfMenu(b) {
  const items = [{ label: 'Add custom interval…', icon: 'plus', onClick: customTF }];
  let g = null;
  for (const t of C.TFS) { if (t.g !== g) { g = t.g; items.push({ header: g }); } items.push({ label: t.l, active: t.s === chart.tf, onClick: () => setTF(t.s) }); }
  for (const s of (AT.prefs.customTF || [])) if (!C.TFS.some(t => t.s === s)) items.push({ label: C.tfLabel(s), active: s === chart.tf, onClick: () => setTF(s) });
  U.menu(b, items, { minWidth: 200, cls: 'menu-tf' });
}
function setTF(s) { const tfs = Object.assign({}, AT.prefs.tfs || {}); tfs[chart.sym] = s; AT.setPref('tfs', tfs); AT.setPref('tf', s); chart.setTF(s); chartTop(); }
function customTF() {
  const n = U.el('input.inp', { type: 'number', min: 1, value: 2 }); const u = U.el('select.inp'); for (const [v, l] of [[60, 'minutes'], [3600, 'hours'], [86400, 'days']]) u.append(U.el('option', { value: v, text: l }));
  const ok = U.el('button.btn.btn-yellow', { type: 'button', text: 'Add' });
  const m = U.modal({ title: 'Add custom interval', body: U.el('div.row-gap', null, n, u), foot: ok, width: 340 });
  ok.onclick = () => { const s = Math.round(+n.value) * +u.value; if (!(s >= 60)) return; const l = (AT.prefs.customTF || []).concat([s]); AT.setPref('customTF', Array.from(new Set(l))); m.close(); setTF(s); };
}
function templatesMenu(b) {
  const tpls = AT.prefs.indTpl || {};
  const items = [{ header: 'Indicator templates' }, { label: 'Save indicator template…', icon: 'save', onClick: () => { const name = prompt('Template name'); if (!name) return; const t = Object.assign({}, AT.prefs.indTpl || {}); t[name] = AT.I.list.map(x => ({ k: x.k, p: x.p, st: x.st, code: x.code, name: x.name })); AT.setPref('indTpl', t); U.toast('Template saved', U.esc(name), 'ok'); } }];
  const names = Object.keys(tpls);
  if (names.length) items.push({ sep: true });
  for (const n of names) items.push({ label: n, icon: 'layout', onClick: () => { AT.I.removeAll(); for (const x of tpls[n]) AT.I.add(x.k, { p: x.p, code: x.code, name: x.name }); chart.renderLegend(); } });
  items.push({ sep: true }, { header: 'Built-in' }, { label: 'Trend: EMA 20/50 + Bollinger', onClick: () => { AT.I.add('ema', { p: { len: 20 } }); AT.I.add('ema', { p: { len: 50 } }); AT.I.add('bb'); chart.renderLegend(); } }, { label: 'Momentum: RSI + MACD', onClick: () => { AT.I.add('rsi'); AT.I.add('macd'); chart.renderLegend(); } }, { label: 'Ichimoku + Stochastic', onClick: () => { AT.I.add('ichi'); AT.I.add('stoch'); chart.renderLegend(); } });
  U.menu(b, items, { minWidth: 260 });
}
function quickSearch() {
  const box = U.el('div.sym-search'); const q = U.el('input.inp.search', { type: 'search', placeholder: 'Search for tools, indicators, symbols and intervals' }); const list = U.el('div.sym-list'); box.append(q, list);
  const m = U.modal({ title: 'Quick search', body: box, width: 520 });
  const all = [];
  for (const k in AT.I.DEFS) all.push({ l: AT.I.DEFS[k].n, s: 'Indicator', f: () => { AT.I.add(k); chart.renderLegend(); } });
  for (const g of AT.D.GROUPS) for (const [k, l] of g.items) all.push({ l, s: 'Drawing tool', f: () => AT.D.setTool(k) });
  for (const t of C.TFS) all.push({ l: t.l, s: 'Interval', f: () => setTF(t.s) });
  for (const s of S.list) all.push({ l: s.n + ' — ' + s.d, s: 'Symbol', f: () => T.openSymbol(s.s) });
  const render = () => { const s = q.value.trim().toLowerCase(); list.innerHTML = ''; for (const x of all.filter(x => !s || x.l.toLowerCase().includes(s)).slice(0, 60)) { const r = U.el('button.sym-row', { type: 'button', html: '<b>' + U.esc(x.l) + '</b><small>' + x.s + '</small>' }); r.onclick = () => { m.close(); x.f(); }; list.append(r); } };
  q.oninput = render; render(); setTimeout(() => q.focus(), 30);
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const f = list.querySelector('.sym-row'); if (f) f.click(); } });
}
T.chartSettings = function () {
  const p = AT.prefs; const body = U.el('div.form-grid');
  const color = (k, def) => { const i = U.el('input.inp.color', { type: 'color', value: p[k] || def }); i.oninput = () => AT.setPref(k, i.value); return i; };
  const chk = (k, def) => { const i = U.el('input', { type: 'checkbox', checked: (p[k] == null ? def : p[k]) ? true : null }); i.onchange = () => AT.setPref(k, i.checked); return i; };
  const sel = (k, opts, def) => { const s = U.el('select.inp'); for (const [v, l] of opts) s.append(U.el('option', { value: v, text: l, selected: String(p[k] == null ? def : p[k]) === String(v) ? true : null })); s.onchange = () => AT.setPref(k, isNaN(+s.value) ? s.value : +s.value); return s; };
  const row = (l, n) => body.append(U.el('label.fg-l', { text: l }), n);
  row('Up color', color('cUp', '#158BF9')); row('Down color', color('cDown', '#EB483F'));
  row('Price scale', sel('scaleMode', [[0, 'Regular'], [1, 'Logarithmic'], [2, 'Percent']], 0));
  row('Grid lines', chk('grid', true)); row('Magnet mode (drawings)', chk('magnet', false));
  row('OHLC values in legend', chk('legendOHLC', true)); row('Executions (buy/sell marks)', chk('execs', true));
  const ok = U.el('button.btn.btn-yellow', { type: 'button', text: 'Ok' });
  const m = U.modal({ title: 'Chart settings', body, foot: ok, width: 400, onclose: () => { chart.applyTheme(); chart.renderLegend(); chart.updateMarkers(); } });
  ok.onclick = () => m.close();
};

/* ---------- drawing toolbar ---------- */
function chartTools() {
  const el = U.$('#ctools');
  const last = Object.assign({}, AT.prefs.lastTools || {});
  const html = AT.D.GROUPS.map(g => { const k = last[g.g] || g.items[0][0]; const it = g.items.find(x => x[0] === k) || g.items[0]; return '<div class="tg" data-g="' + g.g + '"><button class="tb" data-t="' + it[0] + '" title="' + U.esc(it[1]) + '">' + U.icon(it[2]) + '</button>' + (g.items.length > 1 || g.g === 'icons' ? '<button class="tg-more" data-more="' + g.g + '" aria-label="More">' + U.icon('caret-r') + '</button>' : '') + '</div>'; }).join('');
  el.innerHTML = '<div class="tools-scroll">' + html + '<i class="tsep"></i>' +
    '<button class="tb tog" data-x="magnet" title="Magnet mode">' + U.icon('magnet') + '</button>' +
    '<button class="tb tog" data-x="stay" title="Stay in drawing mode">' + U.icon('pin') + '</button>' +
    '<button class="tb tog" data-x="lock" title="Lock all drawings">' + U.icon('lock') + '</button>' +
    '<button class="tb tog" data-x="hide" title="Hide all drawings">' + U.icon('eye') + '</button>' +
    '<button class="tb" data-x="trash" title="Remove objects">' + U.icon('trash') + '</button></div>' +
    '<button class="tools-collapse" title="Hide drawings toolbar">' + U.icon('chev-left') + '</button>';
  el.addEventListener('click', e => {
    const t = e.target.closest('[data-t]'), more = e.target.closest('[data-more]'), x = e.target.closest('[data-x]');
    if (e.target.closest('.tools-collapse')) { U.$('#chartbox').classList.toggle('tools-off'); AT.setUI('toolsOff', U.$('#chartbox').classList.contains('tools-off')); return; }
    if (more) { const g = AT.D.GROUPS.find(y => y.g === more.dataset.more); toolFlyout(more, g); return; }
    if (t) { const k = t.dataset.t; AT.D.setTool(AT.D.tool === k && k !== 'cross' ? 'cross' : k); if (k === 'emoji' && !AT.D.emoji) AT.D.emoji = '🚀'; return; }
    if (x) {
      const k = x.dataset.x;
      if (k === 'magnet') { AT.setPref('magnet', !AT.prefs.magnet); chart.applyTheme(); }
      if (k === 'stay') AT.D.stay = !AT.D.stay;
      if (k === 'lock') AT.D.setLockAll(!AT.D.lockAll);
      if (k === 'hide') AT.D.setHideAll(!AT.D.hideAll);
      if (k === 'trash') U.menu(x, [{ label: 'Remove ' + AT.D.count() + ' drawings', icon: 'trash', onClick: () => AT.D.removeAll() }, { label: 'Remove ' + AT.I.list.length + ' indicators', icon: 'trash', onClick: () => { AT.I.removeAll(); chart.renderLegend(); } }, { label: 'Remove all', icon: 'trash', danger: true, onClick: () => { AT.D.removeAll(); AT.I.removeAll(); chart.renderLegend(); } }], { side: true });
      toolState();
    }
  });
  if (AT.ui.toolsOff) U.$('#chartbox').classList.add('tools-off');
  toolState();
}
function toolFlyout(btn, g) {
  const items = g.items.map(([k, l, ic, sc]) => ({ label: l, icon: ic, right: sc ? '<small>' + sc + '</small>' : '', active: AT.D.tool === k, onClick: () => { const lt = Object.assign({}, AT.prefs.lastTools || {}); lt[g.g] = k; AT.setPref('lastTools', lt); chartToolsRefresh(); AT.D.setTool(k); } }));
  if (g.g === 'icons') {
    const grid = U.el('div.emoji-grid'); for (const em of AT.D.EMOJI) { const b = U.el('button.em', { type: 'button', text: em }); b.onclick = () => { AT.D.emoji = em; U.closeMenu(); AT.D.setTool('emoji'); }; grid.append(b); }
    U.menu(btn, [{ header: 'Icons' }, { node: grid }], { side: true, cls: 'menu-emoji' }); return;
  }
  U.menu(btn, [{ header: g.g === 'lines' ? 'Lines' : g.g === 'fib' ? 'Fibonacci' : g.g === 'patterns' ? 'Patterns' : g.g === 'forecast' ? 'Forecasting and measurement' : g.g === 'shapes' ? 'Shapes' : g.g === 'text' ? 'Annotation' : g.g === 'cursor' ? 'Cursors' : 'Tools' }].concat(items), { side: true, minWidth: 240 });
}
function chartToolsRefresh() { const el = U.$('#ctools'); const fresh = el.cloneNode(false); el.replaceWith(fresh); chartTools(); }
function toolState() {
  const el = U.$('#ctools'); if (!el) return;
  el.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === AT.D.tool));
  const set = (k, v) => { const b = el.querySelector('[data-x="' + k + '"]'); if (b) b.classList.toggle('on', !!v); };
  set('magnet', AT.prefs.magnet); set('stay', AT.D.stay); set('lock', AT.D.lockAll); set('hide', AT.D.hideAll);
}

/* ---------- replay controls ---------- */
function replayBar() {
  const el = U.$('#creplay'); const r = chart.replay;
  U.$('#ctop [data-a="replay"]') && U.$('#ctop [data-a="replay"]').classList.toggle('on', !!r);
  if (!r) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  if (r.pick) { el.innerHTML = '<span>Select a bar to start replay</span><button class="cb" data-r="exit">' + U.icon('x') + '</button>'; }
  else {
    const b = chart.vb[chart.vb.length - 1];
    el.innerHTML = '<button class="cb" data-r="' + (r.play ? 'pause' : 'play') + '" title="' + (r.play ? 'Pause' : 'Play') + '">' + U.icon(r.play ? 'pause' : 'play') + '</button><button class="cb" data-r="step" title="Forward">' + U.icon('step') + '</button>' +
      '<select class="inp sm" data-r="speed">' + [1, 3, 10, 30].map(s => '<option value="' + s + '"' + (r.speed === s ? ' selected' : '') + '>' + s + 'x</option>').join('') + '</select><span class="muted">' + (b ? U.fmtTime((b.time) * 1000, 'chart') : '') + '</span>' +
      '<button class="cb txt" data-r="real">Jump to real-time</button><button class="cb" data-r="exit" title="Exit replay">' + U.icon('x') + '</button>';
  }
  if (!replayBar.done) {
    replayBar.done = true;
    el.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b || b.tagName === 'SELECT') return; const k = b.dataset.r; if (k === 'play') chart.replayPlay(); if (k === 'pause') chart.replayPause(); if (k === 'step') chart.replayStep(); if (k === 'exit' || k === 'real') { chart.replayExit(); U.$('.draw-over').style.pointerEvents = 'none'; } });
    el.addEventListener('change', e => { if (e.target.dataset.r === 'speed') chart.replaySpeed(+e.target.value); });
  }
}

/* ---------- orders panel ---------- */
const COLS = {
  open: [['sym', 'Symbol'], ['type', 'Type'], ['vol', 'Volume, lot'], ['open', 'Open price'], ['cur', 'Current price'], ['tp', 'T/P'], ['sl', 'S/L'], ['id', 'Position'], ['t0', 'Open time'], ['swap', 'Swap'], ['comm', 'Commission'], ['pl', 'P/L']],
  pend: [['sym', 'Symbol'], ['type', 'Type'], ['vol', 'Volume, lot'], ['open', 'Opening price'], ['cur', 'Current price'], ['tp', 'T/P'], ['sl', 'S/L'], ['id', 'Order'], ['t0', 'Open time']],
  closed: [['sym', 'Symbol'], ['type', 'Type'], ['vol', 'Volume, lot'], ['open', 'Open price'], ['close', 'Close price'], ['tp', 'T/P'], ['sl', 'S/L'], ['id', 'Position'], ['t0', 'Open time'], ['t1', 'Close time'], ['swap', 'Swap'], ['comm', 'Commission'], ['reason', 'Reason'], ['pl', 'P/L']]
};
const COL_NAMES = { type: 'Type', vol: 'Volume', open: 'Open price', cur: 'Current price', close: 'Close price', tp: 'Take profit', sl: 'Stop loss', id: 'Order / Position ID', t0: 'Open time', t1: 'Close time', swap: 'Swap', comm: 'Commission', reason: 'Reason' };
T.otab = 'open';
function ordersPanel() {
  const el = U.$('#orders');
  el.innerHTML = '<div class="o-head"><div class="o-tabs" id="otabs"></div><span class="grow"></span><div class="o-tools" id="otools"></div><button class="icon-btn" id="o-more" type="button" title="Options">' + U.icon('more-v') + '</button><button class="icon-btn" id="o-x" type="button" title="Hide">' + U.icon('x') + '</button></div><div class="o-body" id="obody"></div>';
  U.$('#o-x').onclick = () => T.toggleBottom(false);
  U.$('#o-more').onclick = e => colsMenu(e.currentTarget);
  U.$('#otabs').addEventListener('click', e => { const b = e.target.closest('[data-o]'); if (!b) return; T.otab = b.dataset.o; renderOrders(); });
  U.$('#obody').addEventListener('click', onOrderClick);
  renderOrders();
}
function colsMenu(btn) {
  const tab = T.otab; const cols = (AT.prefs.cols || {})[tab] || {};
  const items = [{ header: 'Columns' }];
  for (const [k] of COLS[tab]) { if (k === 'sym' || k === 'pl') continue; items.push({ label: COL_NAMES[k] || k, check: cols[k] !== false && !(k === 'comm' && cols[k] == null && !hasComm()), keep: true, onClick: () => { const all = Object.assign({}, AT.prefs.cols || {}); const c = Object.assign({}, all[tab] || {}); c[k] = !(c[k] !== false && !(k === 'comm' && c[k] == null && !hasComm())); all[tab] = c; AT.setPref('cols', all); renderOrders(); colsMenu(btn); } }); }
  if (tab === 'open') items.push({ sep: true }, { label: 'Group positions by symbol', check: !!AT.prefs.group, keep: true, onClick: () => { AT.setPref('group', !AT.prefs.group); renderOrders(); colsMenu(btn); } });
  if (tab === 'closed') { items.push({ sep: true }, { header: 'Period' }); for (const [k, l] of [['day', 'Today'], ['week', 'Last 7 days'], ['month', 'Last 30 days'], ['q', 'Last 3 months'], ['all', 'All time']]) items.push({ label: l, check: (AT.prefs.closedPeriod || 'all') === k, keep: true, onClick: () => { AT.setPref('closedPeriod', k); renderOrders(); colsMenu(btn); } }); }
  U.menu(btn, items, { alignRight: true, minWidth: 240, cls: 'menu-cols' });
}
function hasComm() { const a = E.active(); return a && (a.type === 'raw' || a.type === 'zero'); }
function visibleCols(tab) { const c = (AT.prefs.cols || {})[tab] || {}; return COLS[tab].filter(([k]) => c[k] !== false && !(k === 'comm' && c[k] == null && !hasComm())); }
function closedRows(a) {
  const per = AT.prefs.closedPeriod || 'all'; const now = Date.now();
  const since = per === 'day' ? new Date().setUTCHours(0, 0, 0, 0) : per === 'week' ? now - 7 * 864e5 : per === 'month' ? now - 30 * 864e5 : per === 'q' ? now - 91 * 864e5 : 0;
  return E.history(a.id).filter(h => !h.ord && h.t1 >= since);
}
function renderOrders() {
  const a = E.active(); if (!a) return;
  const tabsEl = U.$('#otabs'); if (!tabsEl) return;
  tabsEl.innerHTML = [['open', 'Open', a.pos.length], ['pend', 'Pending', a.ord.length], ['closed', 'Closed', 0]].map(([k, l, n]) => '<button type="button" data-o="' + k + '" class="' + (T.otab === k ? 'on' : '') + '">' + l + (n ? '<i class="cnt">' + n + '</i>' : '') + '</button>').join('');
  const tools = U.$('#otools'); tools.innerHTML = '';
  if (T.otab === 'open' && a.pos.length) { const b = U.el('button.btn.btn-ghost.sm', { type: 'button', html: 'Close all ' + U.icon('chev-down') }); b.onclick = () => closeAllMenu(b, a); tools.append(b); }
  if (T.otab === 'pend' && a.ord.length) { const b = U.el('button.btn.btn-ghost.sm', { type: 'button', html: 'Cancel all ' + U.icon('chev-down') }); b.onclick = () => U.menu(b, [{ label: 'Cancel all orders', onClick: () => { for (const o of a.ord.slice()) E.cancel(a, o.id); } }, { label: 'Cancel all ' + (S.map[AT.prefs.tab] || {}).n + ' orders', onClick: () => { for (const o of a.ord.filter(x => x.sym === AT.prefs.tab)) E.cancel(a, o.id); } }], { alignRight: true }); tools.append(b); }
  if (T.otab === 'closed') { const rows = closedRows(a); const tot = rows.reduce((s, h) => s + h.pl + (h.swap || 0) + (h.comm || 0), 0); tools.append(U.el('span.o-sum', { html: rows.length ? 'Total: <b class="' + (tot >= 0 ? 'pos' : 'neg') + '">' + U.money(tot, a.cur, true) + '</b>' : '' })); }
  const body = U.$('#obody');
  const tab = T.otab; const cols = visibleCols(tab);
  const cur = a.cur;
  let rows = [];
  if (tab === 'open') rows = a.pos.slice().sort((x, y) => y.t - x.t);
  else if (tab === 'pend') rows = a.ord.slice().sort((x, y) => y.t - x.t);
  else rows = closedRows(a);
  if (!rows.length) {
    body.innerHTML = '<div class="o-empty">' + U.icon('briefcase') + '<span>' + (tab === 'open' ? 'No open positions' : tab === 'pend' ? 'No pending orders' : 'No closed orders') + '</span></div>';
    return;
  }
  const head = '<tr>' + cols.map(([k, l]) => '<th class="c-' + k + '">' + (k === 'swap' || k === 'comm' || k === 'pl' ? l + ', ' + cur : l) + '</th>').join('') + (tab !== 'closed' ? '<th class="c-act"></th>' : '') + '</tr>';
  let html = '';
  const LIMIT = 400;
  if (tab === 'open' && AT.prefs.group) {
    const g = {}; for (const p of rows) (g[p.sym] = g[p.sym] || []).push(p);
    for (const id in g) {
      const list = g[id]; const s = S.map[id]; const vol = list.reduce((x, p) => x + (p.side === 'buy' ? p.vol : -p.vol), 0);
      const open = AT.prefs.groupOpen && AT.prefs.groupOpen[id];
      html += '<tr class="grp" data-g="' + id + '"><td class="c-sym">' + U.icon(open ? 'caret' : 'caret-r') + S.iconHTML(s, 16) + '<b>' + U.esc(s.n) + '</b> <span class="muted">(' + list.length + ')</span></td>' + cols.slice(1).map(([k]) => k === 'vol' ? '<td class="c-vol">' + U.fmt(Math.abs(vol), 2) + '</td>' : k === 'pl' ? '<td class="c-pl" data-gpl="' + id + '"></td>' : k === 'type' ? '<td class="c-type">' + (vol > 0 ? 'Buy' : vol < 0 ? 'Sell' : 'Hedged') + '</td>' : '<td></td>').join('') + '<td class="c-act"><button class="ia" data-act="closegrp" data-s="' + id + '" title="Close all ' + U.esc(s.n) + '">' + U.icon('x') + '</button></td></tr>';
      if (open) for (const p of list) html += rowHTML(tab, p, cols, a);
    }
  } else for (const r of rows.slice(0, LIMIT)) html += rowHTML(tab, r, cols, a);
  if (rows.length > LIMIT) html += '<tr><td colspan="' + (cols.length + 1) + '" class="muted center">Showing the latest ' + LIMIT + ' of ' + rows.length + ' — see Personal Area › Order history for all.</td></tr>';
  body.innerHTML = '<table class="otable' + (tab === 'closed' ? ' no-act' : '') + '"><thead>' + head + '</thead><tbody>' + html + '</tbody></table>';
  tickOrders();
}
T.renderOrders = renderOrders;
function rowHTML(tab, r, cols, a) {
  const s = S.map[r.sym]; if (!s) return '';
  const dg = s.dg;
  const cells = cols.map(([k]) => {
    switch (k) {
      case 'sym': return '<td class="c-sym">' + S.iconHTML(s, 16) + '<b>' + U.esc(s.n) + '</b></td>';
      case 'type': return '<td class="c-type"><i class="dot ' + r.side + '"></i>' + (tab === 'pend' || r.ord ? E.typeLabel(r) : (r.side === 'buy' ? 'Buy' : 'Sell')) + '</td>';
      case 'vol': return '<td class="c-vol">' + U.fmt(r.vol, 2) + '</td>';
      case 'open': return tab === 'pend' ? '<td class="c-open"><button class="lnk u" data-act="edit" data-id="' + r.id + '">' + U.fmt(r.price, dg) + '</button></td>' : '<td class="c-open">' + U.fmt(r.open, dg) + '</td>';
      case 'cur': return '<td class="c-cur" data-cur="' + r.sym + '" data-side="' + r.side + '"></td>';
      case 'close': return '<td class="c-close">' + (r.close != null ? U.fmt(r.close, dg) : '-') + '</td>';
      case 'tp': return tab === 'closed' ? '<td class="c-tp">' + (r.tp ? U.fmt(r.tp, dg) : '-') + '</td>' : '<td class="c-tp"><button class="lnk u" data-act="edit" data-id="' + r.id + '">' + (r.tp ? U.fmt(r.tp, dg) : 'Add') + '</button></td>';
      case 'sl': return tab === 'closed' ? '<td class="c-sl">' + (r.sl ? U.fmt(r.sl, dg) : '-') + '</td>' : '<td class="c-sl"><button class="lnk u" data-act="edit" data-id="' + r.id + '">' + (r.sl ? U.fmt(r.sl, dg) : 'Add') + '</button></td>';
      case 'id': return '<td class="c-id">' + r.id + '</td>';
      case 't0': return '<td class="c-t">' + U.fmtTime(tab === 'pend' ? r.t : (r.t0 || r.t), 'full') + '</td>';
      case 't1': return '<td class="c-t">' + U.fmtTime(r.t1, 'full') + '</td>';
      case 'swap': return '<td class="c-swap">' + U.fmt(r.swap || 0, 2) + '</td>';
      case 'comm': return '<td class="c-comm">' + U.fmt(r.comm || 0, 2) + '</td>';
      case 'reason': return '<td class="c-reason">' + U.esc(r.reason || '') + '</td>';
      case 'pl': return tab === 'closed' ? '<td class="c-pl ' + (r.pl >= 0 ? 'pos' : 'neg') + '">' + U.fmtSignedAscii(r.pl, 2) + '</td>' : '<td class="c-pl" data-pl="' + r.id + '"></td>';
    }
    return '<td></td>';
  }).join('');
  const act = tab === 'open' ? '<td class="c-act"><button class="ia" data-act="edit" data-id="' + r.id + '" title="Modify">' + U.icon('edit') + '</button><button class="ia" data-act="close" data-id="' + r.id + '" title="Close position">' + U.icon('x') + '</button></td>'
    : tab === 'pend' ? '<td class="c-act"><button class="ia" data-act="edit" data-id="' + r.id + '" title="Modify">' + U.icon('edit') + '</button><button class="ia" data-act="cancel" data-id="' + r.id + '" title="Delete order">' + U.icon('trash') + '</button></td>' : '';
  return '<tr data-id="' + r.id + '" data-s="' + r.sym + '">' + cells + act + '</tr>';
}
function tickOrders() {
  const a = E.active(); if (!a) return;
  const body = U.$('#obody'); if (!body) return;
  body.querySelectorAll('[data-cur]').forEach(td => { const s = S.map[td.dataset.cur]; const x = E.quote(a, s.s); if (!x) return; const v = T.otab === 'pend' ? (td.dataset.side === 'buy' ? x.ask : x.bid) : (td.dataset.side === 'buy' ? x.bid : x.ask); td.textContent = U.fmt(v, s.dg); });
  const gsum = {};
  body.querySelectorAll('[data-pl]').forEach(td => { const p = a.pos.find(x => x.id === td.dataset.pl); if (!p) return; const v = E.profit(a, p); td.textContent = v == null ? '-' : U.fmtSignedAscii(v, 2); td.className = 'c-pl ' + (v >= 0 ? 'pos' : 'neg'); });
  if (AT.prefs.group) { for (const p of a.pos) gsum[p.sym] = (gsum[p.sym] || 0) + (E.profit(a, p) || 0); body.querySelectorAll('[data-gpl]').forEach(td => { const v = gsum[td.dataset.gpl] || 0; td.textContent = U.fmtSignedAscii(v, 2); td.className = 'c-pl ' + (v >= 0 ? 'pos' : 'neg'); }); }
}
function onOrderClick(e) {
  const a = E.active(); if (!a) return;
  const b = e.target.closest('[data-act]');
  const grp = e.target.closest('tr.grp');
  if (!b && grp) { const go = Object.assign({}, AT.prefs.groupOpen || {}); go[grp.dataset.g] = !go[grp.dataset.g]; AT.setPref('groupOpen', go); renderOrders(); return; }
  if (!b) { const tr = e.target.closest('tr[data-s]'); if (tr && tr.dataset.s !== AT.prefs.tab) T.openSymbol(tr.dataset.s); return; }
  const id = b.dataset.id, act = b.dataset.act;
  const rej = r => { if (r && r.err) U.toast('Request rejected', U.esc(r.err), 'error'); };
  if (act === 'close') rej(E.close(a, id));
  else if (act === 'cancel') rej(E.cancel(a, id));
  else if (act === 'closegrp') { const r = E.closeAll(a, p => p.sym === b.dataset.s); if (r.err) rej(r); }
  else if (act === 'edit') T.modify(b, id);
}
function closeAllMenu(btn, a) {
  const pl = p => E.profit(a, p) || 0;
  const s = S.map[AT.prefs.tab];
  const run = f => { const r = E.closeAll(a, f); if (r.err) U.toast('Some positions were not closed', U.esc(r.err), 'error'); else if (r.n) U.toast(r.n + ' position(s) closed', '', 'ok'); };
  U.menu(btn, [
    { label: 'Close all positions', onClick: () => run() }, { label: 'Close all profitable', onClick: () => run(p => pl(p) > 0) }, { label: 'Close all losing', onClick: () => run(p => pl(p) < 0) },
    { sep: true }, { label: 'Close all Buy', onClick: () => run(p => p.side === 'buy') }, { label: 'Close all Sell', onClick: () => run(p => p.side === 'sell') },
    s ? { label: 'Close all ' + s.n, onClick: () => run(p => p.sym === s.s) } : null
  ], { alignRight: true, minWidth: 220 });
}
/* modify popover for a position or a pending order */
T.modify = function (anchor, id) {
  const a = E.active(); const p = a.pos.find(x => x.id === id), o = a.ord.find(x => x.id === id);
  const r = p || o; if (!r) return;
  const s = S.map[r.sym];
  const box = U.el('div.modify');
  const mk = (label, val, key) => { const inp = U.el('input.inp', { type: 'text', inputmode: 'decimal', value: val ? U.fmtPlain(val, key === 'vol' ? 2 : s.dg) : '', placeholder: 'Not set', 'data-k': key }); const hint = U.el('div.op-hint'); const w = U.el('div.mf', null, U.el('label', { text: label }), U.el('div.ibox', null, inp, U.el('button.istep', { type: 'button', html: U.icon('minus'), onclick: () => stepIt(inp, key, -1, hint) }), U.el('button.istep', { type: 'button', html: U.icon('plus'), onclick: () => stepIt(inp, key, 1, hint) })), hint); inp.oninput = () => hintIt(inp, key, hint); setTimeout(() => hintIt(inp, key, hint), 0); return w; };
  const stepIt = (inp, key, d, hint) => { let v = U.parseNum(inp.value); const x = E.quote(a, r.sym); if (isNaN(v)) v = key === 'vol' ? r.vol : key === 'price' ? r.price : (p ? (p.side === 'buy' ? x.bid : x.ask) : r.price) + (key === 'tp' ? 1 : -1) * (r.side === 'buy' ? 1 : -1) * s.pip * 10; else v += d * (key === 'vol' ? s.step : s.pip); inp.value = U.fmtPlain(v, key === 'vol' ? 2 : s.dg); hintIt(inp, key, hint); };
  const hintIt = (inp, key, hint) => { const v = U.parseNum(inp.value); if (key !== 'tp' && key !== 'sl' || isNaN(v)) { hint.textContent = ''; return; } const base = p ? p.open : U.parseNum(box.querySelector('[data-k="price"]').value) || r.price; const pr = E.profit(a, { sym: r.sym, side: r.side, vol: r.vol, open: base }, v); hint.textContent = U.fmtSignedAscii((v - base) / s.pip * (r.side === 'buy' ? 1 : -1), 1) + ' pips · ' + (pr == null ? '' : U.money(pr, a.cur, true)); };
  box.append(U.el('div.mod-title', { html: S.iconHTML(s, 16) + '<b>' + U.esc(s.n) + '</b> <span class="muted">' + (p ? (p.side === 'buy' ? 'Buy' : 'Sell') + ' · #' + p.id : E.typeLabel(o) + ' · #' + o.id) + '</span>' }));
  if (o) { box.append(mk('Open price', o.price, 'price')); box.append(mk('Volume', o.vol, 'vol')); }
  box.append(mk('Take Profit', r.tp, 'tp'), mk('Stop Loss', r.sl, 'sl'));
  const save = U.el('button.btn.btn-yellow.wide', { type: 'button', text: 'Modify' });
  box.append(save);
  if (p) {
    const pv = U.el('input.inp', { type: 'text', inputmode: 'decimal', value: U.fmtPlain(p.vol, 2) });
    const cb = U.el('button.btn.btn-ghost.wide', { type: 'button', text: 'Close position' });
    box.append(U.el('div.mf', null, U.el('label', { text: 'Close volume (partial close)' }), U.el('div.ibox', null, pv)), cb);
    cb.onclick = () => { const v = U.parseNum(pv.value); const res = E.close(a, p.id, v); if (res.err) U.toast('Request rejected', U.esc(res.err), 'error'); else U.closeMenu(); };
  }
  save.onclick = () => {
    const g = k => { const el = box.querySelector('[data-k="' + k + '"]'); if (!el) return undefined; const v = U.parseNum(el.value); return isNaN(v) ? null : v; };
    const res = p ? E.modifyPos(a, p.id, { tp: g('tp'), sl: g('sl') }) : E.modifyOrd(a, o.id, { price: g('price'), vol: g('vol'), tp: g('tp'), sl: g('sl') });
    if (res.err) U.toast('Request rejected', U.esc(res.err), 'error'); else { U.toast('Order modified', '', 'ok', 2000); U.closeMenu(); }
  };
  U.menu(anchor, [{ node: box }], { minWidth: 280, cls: 'menu-modify' });
};
T.toggleBottom = function (on, init) {
  if (!on && !init && U.isPhone()) { T.phShow('chart'); return; }
  const o = U.$('#orders'), sp = U.$('#split');
  o.classList.toggle('collapsed', !on); sp.classList.toggle('hidden', !on);
  if (!on) { if (!U.$('#o-reopen')) { const b = U.el('button.o-reopen#o-reopen', { type: 'button', html: U.icon('chev-up') + '<span>Orders</span>' }); b.onclick = () => T.toggleBottom(true); U.$('#center').append(b); } }
  else { const b = U.$('#o-reopen'); if (b) b.remove(); }
  if (!init) AT.setUI('bottomOpen', on);
};
T.toggleOrderPanel = function (on, init) {
  U.$('#orderp').classList.toggle('hidden', !on);
  let b = U.$('#op-reopen');
  if (!on && !b) { b = U.el('button.op-reopen#op-reopen', { type: 'button', title: 'New order', html: U.icon('trade') + '<span>New order</span>' }); b.onclick = () => T.toggleOrderPanel(true); U.$('#center').append(b); }
  if (on && b) b.remove();
  if (!init) AT.setUI('orderOpen', on);
};
function split() {
  const sp = U.$('#split'), o = U.$('#orders');
  const h = AT.ui.bottomH || 260; o.style.height = h + 'px';
  sp.addEventListener('pointerdown', e => {
    e.preventDefault(); const h0 = o.offsetHeight; const max = U.$('#center').clientHeight - 140;
    U.drag(e, (dx, dy) => { o.style.height = U.clamp(h0 - dy, 90, max) + 'px'; }, () => AT.setUI('bottomH', o.offsetHeight));
  });
}

/* ---------- status bar ---------- */
function status() {
  const a = E.active(); const el = U.$('#status'); if (!a || !el) return;
  const m = E.metrics(a); const hide = AT.prefs.hideBal;
  const v = x => (hide ? '••••' : U.fmt(x, 2)) + ' ' + a.cur;
  const h = F.health;
  const sig = h === 'ok' ? 'ok' : h === 'slow' ? 'slow' : h === 'init' ? 'slow' : 'down';
  el.innerHTML = '<span>Equity: <b data-st="eq">' + v(m.eq) + '</b></span><span>Free Margin: <b data-st="free">' + v(m.free) + '</b></span><span>Balance: <b data-st="bal">' + v(m.bal) + '</b></span><span>Margin: <b data-st="margin">' + v(m.margin) + '</b></span><span>Margin level: <b data-st="ml">' + (m.ml == null ? '–' : U.pct(m.ml)) + '</b></span><span class="grow"></span><span class="sig ' + sig + '" title="' + (sig === 'ok' ? 'Connected · real-time prices' : sig === 'slow' ? 'Connecting…' : 'Connection lost · reconnecting') + '">' + U.icon('signal') + '</span><span class="ver">' + (AT.VER || '') + '</span>';
}
T.status = status;
function tickStatus() {
  const a = E.active(); if (!a) return;
  const m = E.metrics(a); const hide = AT.prefs.hideBal; const v = x => (hide ? '••••' : U.fmt(x, 2)) + ' ' + a.cur;
  const set = (k, t) => { const e = U.$('[data-st="' + k + '"]'); if (e && e.textContent !== t) e.textContent = t; };
  set('eq', v(m.eq)); set('free', v(m.free)); set('bal', v(m.bal)); set('margin', v(m.margin)); set('ml', m.ml == null ? '–' : U.pct(m.ml));
  const hb = U.$('[data-hbal]'); if (hb) hb.textContent = (hide ? '••••' : U.fmt(m.eq, 2)) + ' ' + a.cur;
  const ph = U.$('#phtrade'); if (ph && U.isPhone()) phTick();
}

/* ---------- live tick fan-out ---------- */
T.onTicks = function (ids) {
  const set = new Set(ids);
  if (set.has(chart.sym)) { chart.onTick(); AT.O.tick(); T.title(); }
  const a = E.active();
  if (a && a.pos.some(p => set.has(p.sym))) { tickOrders(); chart.lines.update(); }
  else if (a && T.otab === 'pend' && a.ord.some(o => set.has(o.sym))) tickOrders();
  tickStatus();
};

/* ---------- keyboard ---------- */
function keys(e) {
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
  if (AT.route !== 'term') return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); AT.undo.undo(); }
  else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); AT.undo.redo(); }
  else if (e.altKey && e.code === 'KeyR') { e.preventDefault(); chart.resetView(); }
  else if (e.altKey && e.code === 'KeyT') { e.preventDefault(); AT.D.setTool('trend'); }
  else if (e.altKey && e.code === 'KeyH') { e.preventDefault(); AT.D.setTool('hline'); }
  else if (e.altKey && e.code === 'KeyV') { e.preventDefault(); AT.D.setTool('vline'); }
  else if (e.altKey && e.code === 'KeyF') { e.preventDefault(); AT.D.setTool('fib'); }
  else if (!mod && !e.altKey && e.key === '/') { e.preventDefault(); quickSearch(); }
  else if (!mod && !e.altKey && /^[a-z0-9]$/i.test(e.key) && !e.repeat && e.target === document.body) { /* typing a symbol opens the search, like TradingView */ if (e.key.length === 1 && /[a-z]/i.test(e.key)) { e.preventDefault(); T.symbolSearch(); setTimeout(() => { const i = U.$('.sym-modal input'); if (i) { i.value = e.key.toUpperCase(); i.dispatchEvent(new Event('input')); } }, 40); } }
}

/* ---------- phone layout ---------- */
T.phView = 'chart';
function phone() {
  U.$('#phnav').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) T.phShow(b.dataset.v); });
  T.phShow(AT.ui.phView || 'chart', true);
  const mq = window.matchMedia('(max-width: 820px)');
  const onMq = () => { if (mq.matches) { T.phShow(T.phView, true); } else { $root.dataset.ph = ''; if (AT.ui.side) AT.Pn.open(AT.ui.side, true); } };
  mq.addEventListener ? mq.addEventListener('change', onMq) : mq.addListener(onMq);
}
T.phShow = function (v, init) {
  T.phView = v;
  if (!U.isPhone()) return;
  $root.dataset.ph = v;
  U.$$('#phnav [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  if (v === 'markets') AT.Pn.open('inst', true);
  if (v === 'account') AT.Pn.open('acct', true);
  if (v === 'trade') { T.toggleOrderPanel(true, true); AT.O.render(); }
  if (v === 'orders') T.toggleBottom(true, true);
  if (v === 'chart') phTick(true);
  if (!init) AT.setUI('phView', v);
  window.dispatchEvent(new Event('resize'));
};
function phTick(build) {
  const el = U.$('#phtrade'); if (!el) return;
  const s = S.map[AT.prefs.tab]; const a = E.active(); if (!s || !a) return;
  if (build || !el.dataset.s || el.dataset.s !== s.s) {
    el.dataset.s = s.s;
    el.innerHTML = '<button class="phb sell" type="button" data-side="sell"><small>Sell</small><b data-p="bid"></b></button><div class="phv"><button type="button" data-d="-1">' + U.icon('minus') + '</button><input class="inp" inputmode="decimal" data-vol value="' + U.fmtPlain(AT.O.vol(), 2) + '"><button type="button" data-d="1">' + U.icon('plus') + '</button></div><button class="phb buy" type="button" data-side="buy"><small>Buy</small><b data-p="ask"></b></button>';
    el.onclick = e => {
      const b = e.target.closest('[data-side]'), d = e.target.closest('[data-d]');
      const inp = el.querySelector('[data-vol]');
      if (d) { const v = U.clamp(U.round((U.parseNum(inp.value) || s.min) + (+d.dataset.d) * s.step, 2), s.min, s.max); inp.value = U.fmtPlain(v, 2); AT.O.st.vol = v; }
      if (b) { const v = U.parseNum(inp.value); AT.O.submitSide(b.dataset.side, v > 0 ? v : null); }
    };
    el.querySelector('[data-vol]').oninput = e => { const v = U.parseNum(e.target.value); if (v > 0) AT.O.st.vol = v; };
  }
  const x = E.quote(a, s.s);
  const bid = el.querySelector('[data-p="bid"]'), ask = el.querySelector('[data-p="ask"]');
  if (x) { bid.textContent = U.fmt(x.bid, s.dg); ask.textContent = U.fmt(x.ask, s.dg); }
  const closed = !F.isOpen(s.s); el.querySelectorAll('.phb').forEach(b => { b.disabled = closed; });
}
})();
