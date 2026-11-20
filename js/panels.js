/* Amatu Trade — side panels: instruments, economic calendar, price alerts, script editor, settings, phone account; chart layouts */
(function () {
'use strict';
const AT = window.AT, U = AT.U, S = AT.S, F = AT.F, E = AT.E;
const P = AT.Pn = {};
const K_AL = 'exness.alerts';
let cur = null;
const side = () => U.$('#side');

P.toggle = k => { if (cur === k && !side().classList.contains('hidden')) P.close(); else P.open(k); };
P.close = () => {
  if (U.isPhone()) { AT.T.phShow('chart'); return; }
  side().classList.add('hidden'); cur = null; U.$$('#rail button').forEach(b => b.classList.remove('on')); AT.setUI('side', null); window.dispatchEvent(new Event('resize'));
};
P.open = function (k, init) {
  if (U.isPhone() && !init && k !== 'inst' && k !== 'acct') AT.T.phShow('markets', true); // switch view first (it opens Instruments), then show k
  cur = k;
  const el = side(); el.classList.remove('hidden'); el.dataset.k = k;
  U.$$('#rail button').forEach(b => b.classList.toggle('on', b.dataset.p === k));
  el.innerHTML = '';
  ({ inst, cal, alert: alerts, script, set: settings, acct, ea: x => AT.EA.panel(x) })[k](el);
  if (!init && !U.isPhone()) AT.setUI('side', k);
  window.dispatchEvent(new Event('resize'));
};
function head(title, extra) {
  const h = U.el('div.p-head', null, U.el('span.p-title', { text: title }), U.el('span.grow'));
  if (extra) h.append(extra);
  h.append(U.el('button.icon-btn', { type: 'button', title: 'Close', html: U.icon('x'), onclick: P.close }));
  return h;
}
P.refreshActive = () => { if (cur === 'inst') markActive(); };

/* ================= INSTRUMENTS ================= */
let instRows = new Map(), instList = null;
function favs() { return AT.prefs.fav && AT.prefs.fav.length ? AT.prefs.fav : S.DEFAULT_FAV.slice(); }
function inst(el) {
  const more = U.el('button.icon-btn', { type: 'button', title: 'Options', html: U.icon('more-v') });
  more.onclick = () => U.menu(more, [{ label: 'Signal column', check: AT.prefs.colSig !== false, onClick: () => { AT.setPref('colSig', AT.prefs.colSig === false); P.open('inst'); } }, { label: '1D change column', check: AT.prefs.colChg !== false, onClick: () => { AT.setPref('colChg', AT.prefs.colChg === false); P.open('inst'); } }, { label: 'P/L column', check: AT.prefs.colPL !== false, onClick: () => { AT.setPref('colPL', AT.prefs.colPL === false); P.open('inst'); } }, { sep: true }, { label: 'Reset favorites', onClick: () => { AT.setPref('fav', S.DEFAULT_FAV.slice()); P.open('inst'); } }], { alignRight: true });
  el.append(head('INSTRUMENTS', more));
  const q = U.el('input.inp.search', { type: 'search', placeholder: 'Search' });
  q.value = P.instQ || '';
  const gsel = U.el('button.selbox', { type: 'button', html: '<span>' + U.esc(AT.prefs.instGroup || 'Favorites') + '</span>' + U.icon('chev-down') });
  gsel.onclick = () => U.menu(gsel, S.GROUPS.map(g => ({ label: g, active: g === (AT.prefs.instGroup || 'Favorites'), onClick: () => { AT.setPref('instGroup', g); P.open('inst'); } })), { minWidth: gsel.offsetWidth });
  el.append(U.el('div.p-pad', null, U.el('div.search-wrap', { html: U.icon('search') }, q), gsel));
  const box = U.el('div.p-scroll.inst-scroll');
  el.append(box);
  const render = () => { P.instQ = q.value; renderInst(box); };
  q.oninput = render;
  render();
}
function instIds() {
  const g = AT.prefs.instGroup || 'Favorites'; const s = (P.instQ || '').trim().toLowerCase();
  let ids;
  if (s) ids = S.list.filter(x => (x.n + ' ' + x.s + ' ' + x.d).toLowerCase().includes(s)).map(x => x.s);
  else if (g === 'Favorites') ids = favs().filter(id => S.map[id]);
  else if (g === 'Most traded') ids = S.MOST.slice();
  else if (g === 'Top movers') ids = S.list.map(x => x.s).filter(id => F.change(id) != null).sort((a, b) => Math.abs(F.change(b)) - Math.abs(F.change(a))).slice(0, 25);
  else if (g === 'All') ids = S.list.map(x => x.s).sort((a, b) => S.map[a].n.localeCompare(S.map[b].n));
  else ids = S.list.filter(x => x.g === g).map(x => x.s);
  if (g === 'Top movers' && ids.length < 10) { for (const x of S.list) F.needStats(x.s); }
  return ids;
}
function renderInst(box) {
  const ids = instIds(); const a = E.active();
  const sig = AT.prefs.colSig !== false, chg = AT.prefs.colChg !== false, pl = AT.prefs.colPL !== false;
  const fav = new Set(favs());
  const t = U.el('table.itable');
  t.innerHTML = '<thead><tr><th class="i-sym">Symbol</th>' + (sig ? '<th class="i-sig">Signal</th>' : '') + '<th class="i-px">Bid</th><th class="i-px">Ask</th>' + (chg ? '<th class="i-chg">1D change</th>' : '') + (pl ? '<th class="i-pl">P/L, ' + (a ? a.cur : '') + '</th>' : '') + '</tr></thead>';
  const tb = U.el('tbody');
  instRows = new Map();
  for (const id of ids) {
    const s = S.map[id]; if (!s) continue;
    const tr = U.el('tr', { 'data-s': id, draggable: (AT.prefs.instGroup || 'Favorites') === 'Favorites' && !P.instQ ? 'true' : null });
    tr.innerHTML = '<td class="i-sym"><span class="grip">' + U.icon('grip') + '</span>' + S.iconHTML(s, 18) + '<span class="i-n">' + U.esc(s.n) + '</span><button class="star' + (fav.has(id) ? ' on' : '') + '" type="button" title="Favorite">' + U.icon(fav.has(id) ? 'star-fill' : 'star') + '</button></td>' +
      (sig ? '<td class="i-sig"><span class="sigb"></span></td>' : '') + '<td class="i-px"><span class="pxc" data-k="bid"></span></td><td class="i-px"><span class="pxc" data-k="ask"></span></td>' + (chg ? '<td class="i-chg"></td>' : '') + (pl ? '<td class="i-pl"></td>' : '');
    tb.append(tr);
    instRows.set(id, { tr, bid: tr.querySelector('[data-k="bid"]'), ask: tr.querySelector('[data-k="ask"]'), sig: tr.querySelector('.sigb'), chg: tr.querySelector('.i-chg'), pl: tr.querySelector('.i-pl'), last: {} });
    F.needStats(id);
  }
  t.append(tb);
  box.innerHTML = ''; box.append(t);
  if (!ids.length) box.append(U.el('div.empty-sm', { text: P.instQ ? 'No instruments found' : 'No favorites yet — tap ☆ to add' }));
  tb.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-s]'); if (!tr) return;
    if (e.target.closest('.star')) { toggleFav(tr.dataset.s); renderInst(box); return; }
    AT.T.openSymbol(tr.dataset.s);
  });
  tb.addEventListener('contextmenu', e => { const tr = e.target.closest('tr[data-s]'); if (!tr) return; e.preventDefault(); const id = tr.dataset.s; U.menu({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, [{ label: 'Open chart', icon: 'ct-candles', onClick: () => AT.T.openSymbol(id) }, { label: favs().includes(id) ? 'Remove from favorites' : 'Add to favorites', icon: 'star', onClick: () => { toggleFav(id); renderInst(box); } }, { label: 'Add alert', icon: 'alarm', onClick: () => P.newAlert(id) }, { label: 'Contract specification', icon: 'info', onClick: () => P.spec(id) }]); });
  let dragId = null;
  tb.addEventListener('dragstart', e => { const tr = e.target.closest('tr[data-s]'); dragId = tr && tr.dataset.s; });
  tb.addEventListener('dragover', e => e.preventDefault());
  tb.addEventListener('drop', e => { e.preventDefault(); const tr = e.target.closest('tr[data-s]'); if (!tr || !dragId || dragId === tr.dataset.s) return; const f = favs().slice(); const i = f.indexOf(dragId), j = f.indexOf(tr.dataset.s); if (i < 0 || j < 0) return; f.splice(i, 1); f.splice(j, 0, dragId); AT.setPref('fav', f); renderInst(box); });
  instList = box;
  markActive();
  tickInst(null, true);
  AT.T.hotSyms();
}
function toggleFav(id) { const f = favs().slice(); const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); AT.setPref('fav', f); }
function markActive() { for (const [id, r] of instRows) r.tr.classList.toggle('on', id === AT.prefs.tab); }
function tickInst(ids, all) {
  if (cur !== 'inst' || !instRows.size) return;
  const a = E.active();
  const list = all ? Array.from(instRows.keys()) : ids.filter(id => instRows.has(id));
  for (const id of list) {
    const r = instRows.get(id); const s = S.map[id]; const x = a ? E.quote(a, id) : null;
    if (!x) continue;
    for (const k of ['bid', 'ask']) {
      const v = x[k]; const el = r[k]; const prev = r.last[k];
      if (prev !== v) { el.textContent = U.fmt(v, s.dg); if (prev != null && !all) { el.classList.remove('up', 'dn'); void el.offsetWidth; el.classList.add(v > prev ? 'up' : 'dn'); } r.last[k] = v; }
    }
    if (r.chg) { const c = F.change(id); const t = c == null ? '-' : U.fmtSignedAscii(c, 2) + '%'; if (r.chg.textContent !== t) { r.chg.textContent = t; r.chg.className = 'i-chg ' + (c > 0 ? 'pos' : c < 0 ? 'neg' : ''); } }
    if (r.pl && a) { const ps = a.pos.filter(p => p.sym === id); if (ps.length) { const v = ps.reduce((sm, p) => sm + (E.profit(a, p) || 0), 0); r.pl.textContent = U.fmtSignedAscii(v, 2); r.pl.className = 'i-pl ' + (v >= 0 ? 'pos' : 'neg'); } else if (r.pl.textContent) r.pl.textContent = '-'; }
    if (r.sig) { const st = F.stats[id]; const v = st ? st.sig : 0; const cls = 'sigb ' + (v > 0 ? 'up' : v < 0 ? 'dn' : ''); if (r.sig.className !== cls) { r.sig.className = cls; r.sig.innerHTML = v ? U.icon(v > 0 ? 'arrow-up' : 'arrow-down') : '-'; } }
  }
}
P.visibleSyms = () => (cur === 'inst' ? Array.from(instRows.keys()).slice(0, 60) : []);
U.on('stats', id => tickInst([id]));
P.spec = function (id) {
  const s = S.map[id]; const a = E.active();
  const rows = [['Symbol', s.n], ['Description', s.d], ['Category', s.g], ['Digits', s.dg], ['Contract size', U.fmt(E.cs(a, s), 0) + (s.mm === 'fx' ? ' ' + s.base : '')], ['Pip size', s.pip], ['Typical spread (' + S.ACCOUNT_TYPES[a.type].name + ')', U.fmt(S.spread(s, a.type, (F.quotes[id] || {}).mid) / s.pip, 1) + ' pips'], ['Minimum volume', s.min + ' lots'], ['Maximum volume', s.max + ' lots'], ['Volume step', s.step], ['Max leverage', s.cap ? '1:' + s.cap : S.levLabel(a.lev)], ['Margin calculation', s.mm === 'fx' ? 'Forex: lots × contract ÷ leverage' : 'CFD: lots × contract × price ÷ leverage'], ['Swap long / short', s.sw[0] || s.sw[1] ? U.fmt(s.sw[0], 2) + ' / ' + U.fmt(s.sw[1], 2) + (s.swm === 'pct' ? ' % per day' : ' points') : 'Swap-free'], ['Stop out level', S.ACCOUNT_TYPES[a.type].so + '%'], ['Trading hours', s.hrs === 'crypto' ? '24/7' : s.hrs === 'fx' ? 'Sun 22:05 – Fri 21:59 (UTC, winter)' : s.hrs === 'stock' ? 'Mon–Fri US session (14:30–21:00 UTC, winter)' : 'Sun 23:01 – Fri 21:59 with daily break 21:59–23:01 (UTC, winter)'], ['Market now', F.isOpen(id) ? 'Open' : 'Closed']];
  U.modal({ title: 'Contract specification · ' + s.n, body: '<table class="spec">' + rows.map(r => '<tr><td>' + U.esc(r[0]) + '</td><td>' + U.esc(String(r[1])) + '</td></tr>').join('') + '</table>', width: 460 });
};

/* ================= ECONOMIC CALENDAR ================= */
const CAL_URL = 'https://ieyqxmzztoxgpvwexbkj.supabase.co/functions/v1/amatu-pasar/kalender';
let calData = null, calT = 0;
async function loadCal() {
  if (calData && Date.now() - calT < 15 * 60000) return calData;
  try {
    const r = await fetch(CAL_URL); const j = await r.json();
    if (Array.isArray(j.events)) { calData = j.events; calT = Date.now(); U.save('pt.exness.cal', { t: calT, e: calData }); }
  } catch (e) { const c = U.load('pt.exness.cal', null); if (c) { calData = c.e; calT = 0; } }
  return calData || [];
}
P.loadCal = loadCal;
/* all calendar events (for Expert Advisors): t ms, imp 0..3, cur, title */
P.calAll = () => (calData || []).map((e, i) => ({ id: i + 1, t: Date.parse(e.date), imp: IMP[e.impact] || 0, cur: e.country, title: e.title }));
const IMP = { High: 3, Medium: 2, Low: 1, Holiday: 0 };
/* currencies whose news moves an instrument */
function cursOf(s) {
  if (s.mm === 'fx') return [s.base, s.quote];
  if (s.s === 'JP225') return ['JPY'];
  if (s.g === 'Metals') return ['USD', s.quote].filter((v, i, a) => a.indexOf(v) === i);
  return ['USD'];
}
let evCache = { t: 0, sym: null, list: [] };
P.eventsFor = function (symId) {
  if (!calData || !calData.length) return [];
  if (evCache.sym === symId && evCache.t === calT) return evCache.list;
  const s = S.map[symId]; if (!s) return [];
  const cs = cursOf(s);
  const list = calData.filter(e => cs.includes(e.country)).map(e => ({ t: Date.parse(e.date), imp: IMP[e.impact] || 0, cur: e.country, title: e.title }));
  evCache = { t: calT, sym: symId, list };
  return list;
};
/* High Margin Requirement period: 15 min before to 5 min after high-impact news of the instrument's currencies */
P.hmr = function (symId, ms) {
  ms = ms || Date.now();
  for (const e of P.eventsFor(symId)) if (e.imp === 3 && ms >= e.t - 15 * 60000 && ms <= e.t + 5 * 60000) return e;
  return null;
};
function cal(el) {
  const filt = U.el('button.icon-btn', { type: 'button', title: 'Filter', html: U.icon('filter') });
  el.append(head('ECONOMIC CALENDAR', filt));
  const box = U.el('div.p-scroll.cal-scroll', { html: '<div class="empty-sm">Loading…</div>' });
  el.append(U.el('div.cal-cols', { html: '<span></span><span>Actual</span><span>Forecast</span><span>Previous</span>' }), box);
  filt.onclick = () => { const ci = AT.prefs.calImp || {}; U.menu(filt, [{ header: 'Impact' }].concat([['high', 'High impact'], ['mid', 'Middle impact'], ['low', 'Low impact'], ['lowest', 'Holidays']].map(([k, l]) => ({ label: l, check: ci[k] !== false && (k === 'high' || ci[k]), keep: true, onClick: () => { const c = Object.assign({ high: true }, AT.prefs.calImp || {}); c[k] = !(c[k] !== false && (k === 'high' || c[k])); AT.setPref('calImp', c); draw(); filt.click(); } }))), { alignRight: true }); };
  const draw = async () => {
    const ev = await loadCal();
    if (!ev.length) { box.innerHTML = '<div class="empty-sm">Calendar is unavailable right now.</div>'; return; }
    const ci = Object.assign({ high: true, mid: true, low: false, lowest: false }, AT.prefs.calImp || {});
    const ok = e => (e.impact === 'High' && ci.high) || (e.impact === 'Medium' && ci.mid) || (e.impact === 'Low' && ci.low) || (e.impact === 'Holiday' && ci.lowest);
    let html = '', day = null; const now = Date.now(); let firstFuture = null;
    for (const e of ev.filter(ok)) {
      const t = Date.parse(e.date); const d = U.fmtTime(t, 'day');
      if (d !== day) { html += '<div class="cal-day">' + U.esc(d) + '</div>'; day = d; }
      const imp = IMP[e.impact] || 0;
      const fl = (S.CUR[e.country] || [])[1] || '🏳️';
      const id = 'ce' + t + e.country;
      if (!firstFuture && t > now) firstFuture = id;
      html += '<div class="cal-row' + (t < now ? ' past' : '') + '" id="' + id + '"><div class="cal-t">' + U.fmtTime(t, 'hm') + '</div><div class="cal-n"><b>' + U.esc(e.title) + '</b><span><span class="flg">' + fl + '</span>' + U.esc(e.country) + ' <i class="imp i' + imp + '"><b></b><b></b><b></b></i></span></div><div>' + U.esc(e.actual || '-') + '</div><div>' + U.esc(e.forecast || '-') + '</div><div>' + U.esc(e.previous || '-') + '</div></div>';
    }
    box.innerHTML = html || '<div class="empty-sm">No events for this filter.</div>';
    if (firstFuture) { const r = document.getElementById(firstFuture); if (r) box.scrollTop = Math.max(0, r.offsetTop - 120); }
  };
  draw();
}

/* ================= PRICE ALERTS ================= */
P.alerts = U.load(K_AL, []) || [];
const saveAl = () => U.save(K_AL, P.alerts);
let alTab = 'active';
function alerts(el) {
  el.append(head('PRICE ALERTS'));
  const seg = U.el('div.seg2.p-seg', null, U.el('button' + (alTab === 'active' ? '.on' : ''), { type: 'button', text: 'Active' }), U.el('button' + (alTab === 'hist' ? '.on' : ''), { type: 'button', text: 'History' }));
  seg.children[0].onclick = () => { alTab = 'active'; P.open('alert'); }; seg.children[1].onclick = () => { alTab = 'hist'; P.open('alert'); };
  el.append(U.el('div.p-pad', null, seg));
  const box = U.el('div.p-scroll');
  const list = P.alerts.filter(x => alTab === 'active' ? !x.done : x.done).sort((a, b) => (b.tt || b.t) - (a.tt || a.t));
  if (!list.length) box.innerHTML = '<div class="p-empty">' + U.icon('alarm', 'big') + '<b>' + (alTab === 'active' ? 'No alerts' : 'No triggered alerts') + '</b><span>Get notified instantly about price movements</span></div>';
  for (const x of list) {
    const s = S.map[x.sym]; if (!s) continue;
    const row = U.el('div.al-row', { html: S.iconHTML(s, 18) + '<div class="al-txt"><b>' + U.esc(s.n) + '</b><span>' + (x.src === 'ask' ? 'Ask' : 'Bid') + ' ' + ({ cross: 'crossing', up: 'crossing up', down: 'crossing down', gt: 'greater than', lt: 'less than' })[x.op] + ' ' + U.fmt(x.v, s.dg) + '</span>' + (x.msg ? '<small>' + U.esc(x.msg) + '</small>' : '') + '<small>' + (x.done ? 'Triggered ' + U.fmtTime(x.tt, 'full') : 'Created ' + U.fmtTime(x.t, 'full')) + '</small></div>' });
    const del = U.el('button.icon-btn', { type: 'button', html: U.icon('trash'), title: 'Delete' }); del.onclick = () => { P.alerts = P.alerts.filter(y => y !== x); saveAl(); P.open('alert'); AT.T.chart.lines.update(); };
    if (!x.done) { const ed = U.el('button.icon-btn', { type: 'button', html: U.icon('edit'), title: 'Edit' }); ed.onclick = () => P.newAlert(x.sym, x.v, x); row.append(ed); }
    row.append(del); box.append(row);
  }
  el.append(box);
  const nb = U.el('button.btn.btn-ghost.new-alert', { type: 'button', html: U.icon('plus') + ' New alert' }); nb.onclick = () => P.newAlert(AT.prefs.tab);
  if (alTab === 'active') { if (!list.length) box.querySelector('.p-empty').append(nb); else el.append(U.el('div.p-pad', null, nb)); }
}
P.newAlert = function (symId, price, edit) {
  const a = E.active();
  let s = S.map[symId] || S.map[AT.prefs.tab];
  const body = U.el('div.form-grid');
  const symSel = U.el('select.inp'); for (const x of S.list) symSel.append(U.el('option', { value: x.s, text: x.n, selected: x.s === s.s ? true : null }));
  const src = U.el('select.inp'); for (const [v, l] of [['bid', 'Bid'], ['ask', 'Ask']]) src.append(U.el('option', { value: v, text: l, selected: (edit ? edit.src : (AT.prefs.priceSrc || 'bid')) === v ? true : null }));
  const op = U.el('select.inp'); for (const [v, l] of [['cross', 'Crossing'], ['up', 'Crossing Up'], ['down', 'Crossing Down'], ['gt', 'Greater Than'], ['lt', 'Less Than']]) op.append(U.el('option', { value: v, text: l, selected: (edit ? edit.op : 'cross') === v ? true : null }));
  const q0 = E.quote(a, s.s);
  const val = U.el('input.inp', { type: 'text', inputmode: 'decimal', value: U.fmtPlain(price != null ? price : (q0 ? q0.bid : 0), s.dg) });
  const msg = U.el('input.inp', { type: 'text', placeholder: 'Optional message', value: edit ? edit.msg || '' : '' });
  const once = U.el('select.inp'); for (const [v, l] of [['once', 'Only once'], ['every', 'Every time']]) once.append(U.el('option', { value: v, text: l, selected: (edit ? edit.rep : 'once') === v ? true : null }));
  symSel.onchange = () => { s = S.map[symSel.value]; const q1 = E.quote(a, s.s); if (q1) val.value = U.fmtPlain(q1.bid, s.dg); };
  for (const [l, n] of [['Symbol', symSel], ['Price', src], ['Condition', op], ['Value', val], ['Trigger', once], ['Message', msg]]) body.append(U.el('label.fg-l', { text: l }), n);
  const ok = U.el('button.btn.btn-yellow', { type: 'button', text: edit ? 'Save' : 'Create' });
  const m = U.modal({ title: edit ? 'Edit alert' : 'New alert', body, foot: ok, width: 400 });
  ok.onclick = () => {
    const v = U.parseNum(val.value); if (!(v > 0)) { U.toast('Enter a price', '', 'error'); return; }
    const x = edit || { id: U.uid(), t: Date.now() };
    Object.assign(x, { sym: symSel.value, src: src.value, op: op.value, v, msg: msg.value.trim(), rep: once.value, done: false, last: null });
    if (!edit) P.alerts.push(x);
    saveAl(); m.close(); U.toast('Alert ' + (edit ? 'saved' : 'created'), U.esc(S.map[x.sym].n + ' · ' + U.fmt(v, S.map[x.sym].dg)), 'ok'); if (cur === 'alert') P.open('alert'); AT.T.chart.lines.update();
  };
};
P.checkAlerts = function (ids) {
  if (!P.alerts.length) return;
  const a = E.active(); if (!a) return; const set = new Set(ids); let ch = false;
  for (const x of P.alerts) {
    if (x.done || !set.has(x.sym)) continue;
    const q = E.quote(a, x.sym); if (!q) continue;
    const p = x.src === 'ask' ? q.ask : q.bid; const last = x.last; x.last = p;
    let hit = false;
    if (x.op === 'gt') hit = p > x.v; else if (x.op === 'lt') hit = p < x.v;
    else if (last != null) { const up = last < x.v && p >= x.v, dn = last > x.v && p <= x.v; hit = x.op === 'cross' ? up || dn : x.op === 'up' ? up : dn; }
    if (hit) {
      const s = S.map[x.sym];
      E.notify({ kind: 'info', title: 'Price alert · ' + s.n, text: (x.src === 'ask' ? 'Ask' : 'Bid') + ' ' + U.fmt(p, s.dg) + (x.msg ? ' — ' + x.msg : ''), sym: x.sym, snd: 'alert' });
      if (x.rep === 'once') { x.done = true; x.tt = Date.now(); } else { x.tt = Date.now(); if (x.op === 'gt' || x.op === 'lt') { x.done = true; } }
      ch = true;
    }
  }
  if (ch) { saveAl(); if (cur === 'alert') P.open('alert'); AT.T.chart.lines.update(); }
};
P.alertsFor = sym => (AT.prefs.showAlerts === false ? [] : P.alerts.filter(x => !x.done && x.sym === sym));

/* ================= SCRIPT EDITOR ================= */
const TEMPLATE = "// Amatu Script — JavaScript indicator\n// Series: open, high, low, close, volume, time (arrays)\n// Helpers: sma, ema, wma, rma, rsi, stdev, highest, lowest, atr(n)\n// Output: plot(series, title, color), histogram(series), hline(value), overlay(true)\noverlay(true);\nconst len = input('Length', 20);\nplot(ema(close, len), 'EMA ' + len, '#FFDE02');\n";
let scr = null;
function script(el) {
  scr = scr || { name: 'Untitled indicator', code: TEMPLATE, id: null };
  const more = U.el('button.icon-btn', { type: 'button', title: 'More', html: U.icon('more-v') });
  const share = U.el('button.btn.btn-ghost.sm', { type: 'button', text: 'Share' });
  const h = head(scr.name.toUpperCase(), U.el('span', null, share, more));
  el.append(h);
  const wrap = U.el('div.code-wrap');
  const gut = U.el('div.code-gut'); const ta = U.el('textarea.code-ta', { spellcheck: 'false' }); ta.value = scr.code;
  const lines = () => { const n = ta.value.split('\n').length; gut.innerHTML = Array.from({ length: n }, (_, i) => '<span>' + (i + 1) + '</span>').join(''); gut.scrollTop = ta.scrollTop; };
  ta.oninput = () => { scr.code = ta.value; lines(); }; ta.onscroll = () => { gut.scrollTop = ta.scrollTop; };
  ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s0 = ta.selectionStart; ta.setRangeText('  ', s0, ta.selectionEnd, 'end'); scr.code = ta.value; } });
  wrap.append(gut, ta); el.append(wrap); lines();
  const cons = U.el('div.code-cons');
  const foot = U.el('div.code-foot', null, U.el('span.muted', { html: U.icon('quick') + ' Powered by <u>Amatu Script</u>' }), U.el('span.grow'));
  const save = U.el('button.btn.btn-ghost', { type: 'button', text: 'Save' }), add = U.el('button.btn.btn-yellow', { type: 'button', text: 'Add to chart' });
  el.append(cons, foot, U.el('div.code-btns', null, save, add));
  const test = () => { try { const r = AT.I.runScript(scr.code, AT.T.chart.vb); cons.textContent = 'OK · ' + r.plots.length + ' plot(s)' + (r.overlay ? ' · overlay' : ''); cons.className = 'code-cons ok'; return true; } catch (e) { cons.textContent = 'Error: ' + e.message; cons.className = 'code-cons err'; return false; } };
  save.onclick = () => { const name = prompt('Script name', scr.name) || scr.name; scr.name = name; if (scr.id) { const x = AT.I.scripts.find(y => y.id === scr.id); if (x) { x.name = name; x.code = scr.code; } } else { scr.id = U.uid(); AT.I.scripts.push({ id: scr.id, name, code: scr.code }); } AT.I.saveScripts(); test(); U.toast('Script saved', U.esc(name), 'ok'); h.querySelector('.p-title').textContent = name.toUpperCase(); };
  add.onclick = () => { if (!test()) return; AT.I.add('script', { code: scr.code, name: scr.name }); AT.T.chart.renderLegend(); U.toast('Added to chart', U.esc(scr.name), 'ok'); };
  share.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(scr.code).then(() => U.toast('Code copied', '', 'ok')); };
  more.onclick = () => U.menu(more, [{ label: 'New indicator', icon: 'plus', onClick: () => { scr = { name: 'Untitled indicator', code: TEMPLATE, id: null }; P.open('script'); } }, { sep: true }, { header: 'My scripts' }].concat(AT.I.scripts.map(x => ({ label: x.name, icon: 'braces', onClick: () => { scr = { name: x.name, code: x.code, id: x.id }; P.open('script'); } })), AT.I.scripts.length ? [{ sep: true }, { label: 'Delete current script', icon: 'trash', danger: true, onClick: () => { if (!scr.id) return; AT.I.scripts = AT.I.scripts.filter(y => y.id !== scr.id); AT.I.saveScripts(); scr = null; P.open('script'); } }] : []), { alignRight: true, minWidth: 220 });
}

/* ================= SETTINGS ================= */
function settings(el) {
  el.append(head('SETTINGS'));
  const box = U.el('div.p-scroll.set-scroll'); el.append(box);
  const p = AT.prefs;
  const sec = t => box.append(U.el('div.set-sec', { html: t }));
  const tog = (label, key, def, after) => { const sw = U.el('input.switch', { type: 'checkbox', checked: (p[key] == null ? def : p[key]) ? true : null }); sw.onchange = () => { AT.setPref(key, sw.checked); if (after) after(); }; box.append(U.el('label.set-row', null, U.el('span', { text: label }), sw)); };
  const sel = (label, key, opts, def, after) => { const b = U.el('button.selbox', { type: 'button' }); const lbl = () => { const v = p[key] == null ? def : p[key]; b.innerHTML = '<span>' + U.esc((opts.find(o => String(o[0]) === String(v)) || opts[0])[1]) + '</span>' + U.icon('chev-down'); }; lbl(); b.onclick = () => U.menu(b, opts.map(([v, l]) => ({ label: l, active: String(p[key] == null ? def : p[key]) === String(v), onClick: () => { AT.setPref(key, v); lbl(); if (after) after(); } })), { minWidth: b.offsetWidth, cls: key === 'tz' ? 'menu-tz' : '' }); box.append(U.el('div.set-lbl', { text: label }), b); };
  const redraw = () => { const c = AT.T.chart; c.lines.update(); c.updateMarkers(); AT.D.redraw(); };
  sec('Show on chart');
  tog('Signals', 'showSignals', false, redraw); tog('HMR periods', 'showHMR', true, redraw); tog('Price alerts', 'showAlerts', true, redraw); tog('Open positions', 'showPos', true, redraw); tog('TP / SL / Stop / Limit', 'showTPSL', true, redraw);
  sel('Order and position alignment', 'align', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], 'right', redraw);
  tog('Economic calendar', 'cal', true, redraw);
  const ci = Object.assign({ high: true, mid: false, low: false, lowest: false }, p.calImp || {});
  for (const [k, l] of [['high', 'High impact'], ['mid', 'Middle impact'], ['low', 'Low impact'], ['lowest', 'Lowest impact']]) { const cb = U.el('input', { type: 'checkbox', checked: ci[k] ? true : null }); cb.onchange = () => { const c = Object.assign({}, ci, AT.prefs.calImp || {}); c[k] = cb.checked; AT.setPref('calImp', c); }; box.append(U.el('label.set-chk', null, cb, U.el('span', { text: l }))); }
  sec('Sound effects <span class="help" title="Plays a short sound when it happens.">' + U.icon('help') + '</span>');
  tog('Price alerts', 'sndAlert', false); tog('Closing by TP / SL / SO', 'sndClose', false);
  sec('Trading settings');
  tog('Set TP/SL automatically', 'autoTPSL', false, () => AT.O.render());
  sel('Open order mode', 'form', [['regular', 'Regular form'], ['oneclick', 'One-click form'], ['risk', 'Risk calculator form']], 'regular', () => AT.O.render());
  sel('Price source', 'priceSrc', [['ask', 'Ask'], ['bid', 'Bid']], 'bid', () => { const c = AT.T.chart; c.computeShift(); c.setSeriesData(); AT.T.title(); });
  sel('Time zone', 'tz', U.TZS.map(([z]) => [z, U.tzLabel(z)]), 'UTC', () => { const c = AT.T.chart; c.load(); AT.T.renderOrders(); });
  sec('Appearance');
  sel('Theme', 'theme', [['dark', 'Dark'], ['light', 'Light']], 'dark', () => AT.setTheme(AT.prefs.theme));
}

/* ================= PHONE ACCOUNT ================= */
function acct(el) {
  const a = E.active(); const m = E.metrics(a);
  el.append(head('ACCOUNT'));
  const box = U.el('div.p-scroll.ph-acct');
  box.innerHTML = '<div class="pa-card"><div class="pa-c1"><span class="badge t-' + a.type + '">' + S.ACCOUNT_TYPES[a.type].name + '</span><b># ' + a.id + '</b> <span class="muted">' + U.esc(a.nick) + '</span></div><div class="pa-bal">' + U.fmt(m.eq, 2) + ' <small>' + a.cur + '</small></div>' +
    '<div class="pa-grid"><span>Balance</span><b>' + U.money(a.bal, a.cur) + '</b><span>Margin</span><b>' + U.money(m.margin, a.cur) + '</b><span>Free margin</span><b>' + U.money(m.free, a.cur) + '</b><span>Margin level</span><b>' + (m.ml == null ? '-' : U.pct(m.ml)) + '</b><span>Leverage</span><b>' + S.levLabel(a.lev) + '</b></div></div>';
  const acts = U.el('div.bm-acts');
  for (const [k, l, ic] of [['deposit', 'Deposit', 'deposit'], ['withdraw', 'Withdraw', 'withdraw'], ['transfer', 'Transfer', 'transfer']]) { const b = U.el('button.bm-act', { type: 'button', html: '<i>' + U.icon(ic) + '</i><span>' + l + '</span>' }); b.onclick = () => AT.T.money(k); acts.append(b); }
  box.append(acts);
  const links = [['Switch account', 'wallet', () => { const items = E.st.accounts.filter(x => !x.archived).map(x => ({ label: '#' + x.id + ' · ' + S.ACCOUNT_TYPES[x.type].name + ' · ' + U.fmt(E.metrics(x).eq, 2) + ' ' + x.cur, active: x.id === a.id, onClick: () => { E.setActive(x.id); P.open('acct', true); } })); U.menu(box.querySelector('.ph-l0'), items, { minWidth: 280 }); }],
    ['Personal Area', 'home', () => AT.go('#/pa/accounts')], ['Economic calendar', 'calendar', () => P.open('cal')], ['Price alerts', 'alarm', () => P.open('alert')], ['Script editor', 'braces', () => P.open('script')], ['Expert Advisors', 'robot', () => P.open('ea')], ['Terminal settings', 'gear', () => P.open('set')], ['Back to Portal', 'arrow-left', () => { location.href = '/'; }]];
  links.forEach(([l, ic, fn], i) => { const b = U.el('button.ph-link.ph-l' + i, { type: 'button', html: U.icon(ic) + '<span>' + l + '</span>' + U.icon('chev-right') }); b.onclick = fn; box.append(b); });
  el.append(box);
}

/* ================= tick fan-out ================= */
P.onTicks = function (ids) {
  tickInst(ids);
  P.checkAlerts(ids);
  if (cur === 'acct' && U.isPhone()) { const now = Date.now(); if (!P._acctT || now - P._acctT > 2000) { P._acctT = now; const sc = side().querySelector('.p-scroll'); const top = sc ? sc.scrollTop : 0; P.open('acct', true); const sc2 = side().querySelector('.p-scroll'); if (sc2) sc2.scrollTop = top; } }
};

/* ================= chart layouts ================= */
AT.layouts = {
  list: () => U.load('exness.layouts', []) || [],
  snapshot: () => ({ ind: AT.I.list.map(x => ({ k: x.k, p: x.p, st: x.st, hd: x.hd, code: x.code, name: x.name })), tf: AT.T.chart.tf, ctype: AT.T.chart.type, tabs: AT.prefs.tabs, tab: AT.prefs.tab }),
  save(name) {
    const L = AT.layouts.list(); name = name || AT.prefs.layoutName || 'My layout';
    const i = L.findIndex(x => x.name === name); const snap = Object.assign({ name, t: Date.now() }, AT.layouts.snapshot());
    if (i >= 0) L[i] = snap; else L.push(snap);
    U.save('exness.layouts', L); AT.setPref('layoutName', name); AT.T.chartTop(); U.toast('Layout saved', U.esc(name), 'ok', 2000);
  },
  load(name) {
    const x = AT.layouts.list().find(y => y.name === name); if (!x) return;
    AT.I.removeAll(); for (const i of x.ind) { const n = AT.I.add(i.k, { p: i.p, code: i.code, name: i.name }); if (n) { n.st = i.st || {}; n.hd = !!i.hd; } }
    AT.setPref('layoutName', name); AT.setPref('ctype', x.ctype); AT.setPref('tabs', x.tabs); AT.T.openSymbol(x.tab); AT.T.chart.setType(x.ctype); AT.T.chartTop();
  },
  menu(btn) {
    const L = AT.layouts.list();
    U.menu(btn, [{ label: 'Save layout', icon: 'save', right: '<small>Ctrl+S</small>', onClick: () => AT.layouts.save() }, { label: 'Rename…', icon: 'edit', onClick: () => { const n = prompt('Layout name', AT.prefs.layoutName || 'My layout'); if (!n) return; const all = AT.layouts.list(); const x = all.find(y => y.name === AT.prefs.layoutName); if (x) { x.name = n; U.save('exness.layouts', all); } AT.setPref('layoutName', n); AT.T.chartTop(); } }, { label: 'Make a copy…', icon: 'copy', onClick: () => { const n = prompt('Copy name', (AT.prefs.layoutName || 'My layout') + ' copy'); if (n) AT.layouts.save(n); } },
      { sep: true }, { header: 'Load layout' }].concat(L.length ? L.map(x => ({ label: x.name, right: '<small>' + U.fmtTime(x.t, 'date') + '</small>', active: x.name === AT.prefs.layoutName, onClick: () => AT.layouts.load(x.name) })) : [{ node: U.el('div.empty-sm', { text: 'No saved layouts' }) }]).concat(L.length ? [{ sep: true }, { label: 'Delete current layout', icon: 'trash', danger: true, onClick: () => { U.save('exness.layouts', L.filter(y => y.name !== AT.prefs.layoutName)); AT.setPref('layoutName', ''); AT.T.chartTop(); } }] : []), { alignRight: true, minWidth: 240 });
  }
};
document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's' && AT.route === 'term') { e.preventDefault(); AT.layouts.save(); } });
})();
