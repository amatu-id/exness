/* Amatu Trade — order panel: Regular / One-click / Risk calculator forms, Market & Pending, TP/SL in price, pips, money or % of equity */
(function () {
'use strict';
const AT = window.AT, U = AT.U, S = AT.S, F = AT.F, E = AT.E;
const O = AT.O = {};
const UNITS = [['price', 'Price', 'By asset price'], ['pips', 'Pips', 'In pips'], ['money', '', 'In money'], ['pct', '%', 'In % of equity']];
let root = null, sym = null;
const st = O.st = { side: null, mode: 'market', vol: 0.01, price: null, tp: null, sl: null, tpU: 'price', slU: 'price', risk: 1, riskU: 'pct', more: false, edited: {} };

function acc() { return E.active(); }
function q() { const a = acc(); return a && sym ? E.quote(a, sym.s) : null; }
function form() { return AT.prefs.form || 'regular'; }
O.vol = () => st.vol;
function unitLabel(u) { const a = acc(); return u === 'money' ? (a ? a.cur : 'USD') : (UNITS.find(x => x[0] === u) || UNITS[0])[1]; }
function entryPrice(side) { const x = q(); if (st.mode === 'pending' && st.price > 0) return st.price; if (!x) return null; return side === 'sell' ? x.bid : x.ask; }
/* convert a TP/SL value in its unit to an absolute price */
function toPrice(which, side) {
  const v = which === 'tp' ? st.tp : st.sl, u = which === 'tp' ? st.tpU : st.slU;
  if (v == null || v === '' || isNaN(v)) return null;
  if (u === 'price') return +v;
  const e = entryPrice(side); if (!e) return null;
  const dir = (side === 'buy' ? 1 : -1) * (which === 'tp' ? 1 : -1);
  let dist;
  if (u === 'pips') dist = v * sym.pip;
  else {
    const a = acc(); const m = E.metrics(a);
    const money = u === 'money' ? +v : m.eq * v / 100;
    const perUnit = F.convert(st.vol * E.cs(a, sym), sym.quote, a.cur); // acc money per 1.0 price move
    if (!perUnit) return null;
    dist = Math.abs(money) / perUnit;
  }
  return U.round(e + dir * dist, sym.dg);
}
function fromPrice(which, side, price, unit) {
  if (price == null) return null;
  if (unit === 'price') return price;
  const e = entryPrice(side); if (!e) return null;
  const d = Math.abs(price - e);
  if (unit === 'pips') return U.round(d / sym.pip, 1);
  const a = acc(); const perUnit = F.convert(st.vol * E.cs(a, sym), sym.quote, a.cur) || 0;
  const money = d * perUnit;
  if (unit === 'money') return U.round(money, 2);
  const m = E.metrics(a); return m.eq > 0 ? U.round(money / m.eq * 100, 2) : 0;
}
function sideNow() { return st.side || 'buy'; }
/* risk calculator volume */
function riskVolume() {
  const a = acc(); const x = q(); if (!a || !x) return null;
  const side = sideNow(); const e = entryPrice(side); const slp = toPrice('sl', side);
  if (!slp || !e) return null;
  const m = E.metrics(a);
  const money = st.riskU === 'pct' ? m.eq * st.risk / 100 : st.risk;
  const perUnit = F.convert(E.cs(a, sym), sym.quote, a.cur); if (!perUnit) return null;
  const v = money / (Math.abs(e - slp) * perUnit);
  return U.clamp(Math.floor(v / sym.step) * sym.step, 0, sym.max);
}
function unitsText(vol) {
  const a = acc(); const n = vol * E.cs(a, sym);
  const g = sym.g;
  if (g === 'Metals') return U.fmt(n, 2) + ' Troy oz.';
  if (sym.s === 'USOIL' || sym.s === 'UKOIL') return U.fmt(n, 2) + ' barrels';
  if (sym.s === 'XNGUSD') return U.fmt(n, 0) + ' MMBtu';
  if (g === 'Stocks') return U.fmt(n, 2) + ' shares';
  if (g === 'Indices') return U.fmt(n, 2) + ' units';
  return U.fmt(n, n < 10 ? 4 : 0) + ' ' + sym.base;
}

/* ---------- build ---------- */
O.mount = function (el) { root = el; };
O.setSymbol = function (id) {
  const ns = S.map[id]; if (!ns) return;
  const changed = !sym || sym.s !== id;
  sym = ns;
  if (changed) { st.side = null; st.price = null; st.tp = null; st.sl = null; st.vol = U.clamp(st.vol, sym.min, sym.max); st.edited = {}; if (AT.prefs.autoTPSL) applyAuto(); }
  render();
};
function applyAuto() {
  const mem = (AT.prefs.autoMem || {})[sym.s];
  if (!mem) return;
  st.tpU = 'pips'; st.slU = 'pips'; st.tp = mem.tp || null; st.sl = mem.sl || null;
}
function render() {
  if (!root || !sym) return;
  const a = acc();
  const f = form();
  root.innerHTML = '';
  const head = U.el('div.op-head', null, U.el('div.op-sym', { html: S.iconHTML(sym, 18) + '<span>' + U.esc(sym.n) + '</span>' }), U.el('button.icon-btn.op-x', { type: 'button', title: 'Close', html: U.icon('x'), onclick: () => AT.T.toggleOrderPanel(false) }));
  const sel = U.el('button.selbox.op-form', { type: 'button', html: '<span>' + ({ regular: 'Regular form', oneclick: 'One-click form', risk: 'Risk calculator form' })[f] + '</span>' + U.icon('chev-down') });
  sel.onclick = () => U.menu(sel, [['regular', 'Regular form'], ['oneclick', 'One-click form'], ['risk', 'Risk calculator form']].map(([k, l]) => ({ label: l, active: k === f, onClick: () => { AT.setPref('form', k); st.side = null; render(); } })), { minWidth: sel.offsetWidth });
  const quotes = U.el('div.op-quotes');
  const sell = U.el('button.qbox.sell' + (st.side === 'sell' ? '.on' : ''), { type: 'button' }, U.el('span.qlbl', { text: 'Sell' }), U.el('span.qpx', { 'data-px': 'bid' }));
  const buy = U.el('button.qbox.buy' + (st.side === 'buy' ? '.on' : ''), { type: 'button' }, U.el('span.qlbl', { text: 'Buy' }), U.el('span.qpx', { 'data-px': 'ask' }));
  const spr = U.el('span.qspread', { 'data-sp': '1' });
  quotes.append(sell, spr, buy);
  sell.onclick = () => pick('sell'); buy.onclick = () => pick('buy');
  const sent = U.el('div.op-sent', { html: '<span class="s-sell"></span><span class="s-bar"><i></i></span><span class="s-buy"></span>' });
  root.append(head, sel, quotes, sent);
  const closed = !F.isOpen(sym.s);
  if (closed) {
    const nx = S.nextChange(sym, Date.now());
    root.append(U.el('div.op-closed', { html: U.icon('clock') + '<div><b>Market is closed</b><span>' + (nx ? 'Opens in ' + U.dur(nx - Date.now()) + ' · ' + U.fmtTime(nx, 'long') : 'Trading is not available') + '</span></div>' }));
  }
  if (f !== 'oneclick') {
    const seg = U.el('div.seg2', null, U.el('button' + (st.mode === 'market' ? '.on' : ''), { type: 'button', text: 'Market' }), U.el('button' + (st.mode === 'pending' ? '.on' : ''), { type: 'button', text: 'Pending' }));
    seg.children[0].onclick = () => { st.mode = 'market'; st.price = null; render(); };
    seg.children[1].onclick = () => { st.mode = 'pending'; const x = q(); if (x && !st.price) st.price = U.round(sideNow() === 'buy' ? x.ask : x.bid, sym.dg); render(); };
    root.append(seg);
  }
  if (st.mode === 'pending' && f !== 'oneclick') {
    const kind = pendingKind();
    root.append(field('Open price', 'price', st.price, null, kind ? (kind === 'limit' ? 'Limit' : 'Stop') : '', true));
    root.append(U.el('div.op-hint', { 'data-hint': 'price' }));
  }
  if (f === 'risk') {
    root.append(riskField());
    root.append(field('Stop Loss', 'sl', st.sl, st.slU, null, true));
    root.append(U.el('div.op-hint', { 'data-hint': 'sl' }));
    root.append(U.el('div.op-calc', { 'data-calc': '1' }));
    root.append(field('Take Profit', 'tp', st.tp, st.tpU, null, true));
    root.append(U.el('div.op-hint', { 'data-hint': 'tp' }));
  } else {
    root.append(field('Volume', 'vol', st.vol, null, 'Lots'));
    root.append(field('Take Profit', 'tp', st.tp, st.tpU, null, true));
    root.append(U.el('div.op-hint', { 'data-hint': 'tp' }));
    root.append(field('Stop Loss', 'sl', st.sl, st.slU, null, true));
    root.append(U.el('div.op-hint', { 'data-hint': 'sl' }));
  }
  const confirmMode = f !== 'oneclick' && st.side;
  if (confirmMode) {
    const cb = U.el('button.btn.btn-confirm.' + st.side, { type: 'button', 'data-confirm': '1', disabled: closed ? true : null });
    cb.onclick = submit;
    const cc = U.el('button.btn.btn-cancel', { type: 'button', text: 'Cancel', onclick: () => { st.side = null; render(); } });
    root.append(cb, cc);
  }
  if (confirmMode || f === 'oneclick') root.append(U.el('div.op-info', { 'data-info': '1' }));
  if (closed) { sell.disabled = true; buy.disabled = true; }
  O.tick();
  preview();
}
function pendingKind() { const x = q(); if (!x || !(st.price > 0)) return null; return E.pendingKind(sideNow(), st.price, x); }
function field(label, key, val, unit, badge, help) {
  const wrap = U.el('div.op-field');
  const lab = U.el('div.op-lbl', null, U.el('span', { text: label }));
  if (help) lab.append(U.el('span.help', { html: U.icon('help'), title: key === 'tp' ? 'Take Profit closes the position when the price reaches the target.' : key === 'sl' ? 'Stop Loss closes the position to limit your loss.' : 'Price at which the pending order is placed.' }));
  const box = U.el('div.ibox');
  const inp = U.el('input.ival', { type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: key === 'tp' || key === 'sl' ? 'Not set' : '', value: val == null ? '' : fmtVal(key, val, unit), 'data-k': key });
  inp.addEventListener('input', () => { const n = U.parseNum(inp.value); if (key === 'vol') { if (!isNaN(n)) st.vol = n; } else if (key === 'price') st.price = isNaN(n) ? null : n; else st[key] = inp.value.trim() === '' || isNaN(n) ? null : n; st.edited[key] = true; O.tick(); preview(); });
  inp.addEventListener('blur', () => { if (key === 'vol') { st.vol = U.clamp(Math.round((st.vol || sym.min) / sym.step) * sym.step, sym.min, sym.max); inp.value = U.fmtPlain(st.vol, 2); } O.tick(); });
  inp.addEventListener('keydown', e => { if (e.key === 'ArrowUp') { e.preventDefault(); step(key, 1); } if (e.key === 'ArrowDown') { e.preventDefault(); step(key, -1); } if (e.key === 'Enter' && st.side) submit(); });
  box.append(inp);
  if ((key === 'tp' || key === 'sl') && val != null) box.append(U.el('button.iclr', { type: 'button', html: U.icon('x'), title: 'Clear', onclick: () => { st[key] = null; render(); } }));
  if (unit) {
    const ub = U.el('button.iunit', { type: 'button', html: '<span>' + U.esc(unitLabel(unit)) + '</span>' + U.icon('caret') });
    ub.onclick = () => U.menu(ub, UNITS.map(([u, , l]) => ({ label: l, active: u === unit, onClick: () => { const side = sideNow(); const px = toPrice(key, side); st[key + 'U'] = u; st[key] = px != null ? fromPrice(key, side, px, u) : null; render(); } })), { alignRight: true });
    box.append(ub);
  } else if (badge) box.append(U.el('span.ibadge' + (key === 'price' ? '.kind' : ''), { text: badge }));
  const minus = U.el('button.istep', { type: 'button', html: U.icon('minus'), 'aria-label': 'Decrease' }), plus = U.el('button.istep', { type: 'button', html: U.icon('plus'), 'aria-label': 'Increase' });
  hold(minus, () => step(key, -1)); hold(plus, () => step(key, 1));
  box.append(minus, plus);
  wrap.append(lab, box);
  return wrap;
}
function riskField() {
  const wrap = U.el('div.op-field');
  wrap.append(U.el('div.op-lbl', null, U.el('span', { text: 'Risk' })));
  const box = U.el('div.ibox');
  const inp = U.el('input.ival', { type: 'text', inputmode: 'decimal', value: st.risk });
  inp.oninput = () => { const n = U.parseNum(inp.value); if (!isNaN(n)) st.risk = n; O.tick(); preview(); };
  const a = acc();
  const ub = U.el('button.iunit', { type: 'button', html: '<span>' + (st.riskU === 'pct' ? '%' : a.cur) + '</span>' + U.icon('caret') });
  ub.onclick = () => U.menu(ub, [{ label: 'In % of equity', active: st.riskU === 'pct', onClick: () => { st.riskU = 'pct'; render(); } }, { label: 'In money', active: st.riskU === 'money', onClick: () => { st.riskU = 'money'; render(); } }], { alignRight: true });
  const minus = U.el('button.istep', { type: 'button', html: U.icon('minus') }), plus = U.el('button.istep', { type: 'button', html: U.icon('plus') });
  hold(minus, () => { st.risk = Math.max(0, U.round(st.risk - (st.riskU === 'pct' ? 0.5 : 10), 2)); inp.value = st.risk; O.tick(); });
  hold(plus, () => { st.risk = U.round(st.risk + (st.riskU === 'pct' ? 0.5 : 10), 2); inp.value = st.risk; O.tick(); });
  box.append(inp, ub, minus, plus); wrap.append(box);
  return wrap;
}
function hold(btn, fn) {
  let t1 = null, t2 = null;
  const stop = () => { clearTimeout(t1); clearInterval(t2); };
  btn.addEventListener('pointerdown', e => { e.preventDefault(); fn(); t1 = setTimeout(() => { let n = 0; t2 = setInterval(() => { fn(); if (++n > 20) { clearInterval(t2); t2 = setInterval(fn, 30); } }, 90); }, 380); });
  btn.addEventListener('pointerup', stop); btn.addEventListener('pointerleave', stop); btn.addEventListener('pointercancel', stop);
}
function fmtVal(key, v, unit) {
  if (v == null || isNaN(v)) return '';
  if (key === 'vol') return U.fmtPlain(v, 2);
  if (key === 'price' || unit === 'price') return U.fmtPlain(v, sym.dg);
  if (unit === 'pips') return U.fmtPlain(v, 1);
  return U.fmtPlain(v, 2);
}
function step(key, dir) {
  const side = sideNow();
  if (key === 'vol') { st.vol = U.clamp(U.round((st.vol || 0) + dir * sym.step, 2), sym.min, sym.max); }
  else if (key === 'price') { const x = q(); if (st.price == null && x) st.price = side === 'buy' ? x.ask : x.bid; st.price = U.round((st.price || 0) + dir * sym.pip, sym.dg); }
  else {
    const u = st[key + 'U'];
    if (st[key] == null) {
      const e = entryPrice(side); if (!e) return;
      const sdir = (side === 'buy' ? 1 : -1) * (key === 'tp' ? 1 : -1);
      const x = q(); const dist = Math.max(sym.pip * 10, (x ? x.sp : 0) * 3);
      st[key] = fromPrice(key, side, U.round(e + sdir * dist, sym.dg), u);
    } else {
      const inc = u === 'price' ? sym.pip : u === 'pips' ? 1 : u === 'pct' ? 0.1 : Math.pow(10, Math.max(0, Math.floor(Math.log10(Math.max(1, E.metrics(acc()).eq))) - 3));
      st[key] = U.round(st[key] + dir * inc, u === 'price' ? sym.dg : 2);
    }
  }
  const inp = root.querySelector('input[data-k="' + key + '"]');
  if (inp) inp.value = fmtVal(key, st[key], st[key + 'U']); else render();
  if ((key === 'tp' || key === 'sl') && !root.querySelector('.iclr')) render();
  O.tick(); preview();
}
function pick(side) {
  const f = form();
  if (f === 'oneclick') { st.side = side; submit(); st.side = null; return; }
  st.side = st.side === side ? null : side;
  if (st.side && AT.prefs.autoTPSL && !st.edited.tp && !st.edited.sl) applyAuto();
  render();
}
function submit() {
  const a = acc(); if (!a || !sym) return;
  const side = st.side || 'buy';
  let vol = st.vol;
  if (form() === 'risk') { vol = riskVolume(); if (!vol) { U.toast('Request rejected', 'Set a Stop Loss to calculate the volume', 'error'); return; } }
  const tp = toPrice('tp', side), sl = toPrice('sl', side);
  let r;
  if (st.mode === 'pending' && form() !== 'oneclick') r = E.place(a, { sym: sym.s, side, price: st.price, vol, tp, sl });
  else r = E.open(a, { sym: sym.s, side, vol, tp, sl });
  if (r.err) { U.toast('Request rejected', U.esc(r.err), 'error'); return; }
  if (AT.prefs.autoTPSL) {
    const e = r.pos ? r.pos.open : st.price; const mem = Object.assign({}, AT.prefs.autoMem || {});
    mem[sym.s] = { tp: tp ? U.round(Math.abs(tp - e) / sym.pip, 1) : null, sl: sl ? U.round(Math.abs(sl - e) / sym.pip, 1) : null }; AT.setPref('autoMem', mem);
  }
  if (form() !== 'oneclick') { st.side = null; if (!AT.prefs.autoTPSL) { st.tp = null; st.sl = null; } st.edited = {}; }
  render();
}
O.submitSide = (side, vol) => { const keep = st.side; st.side = side; const v0 = st.vol; if (vol) st.vol = vol; const m0 = st.mode; st.mode = 'market'; const tp = st.tp, sl = st.sl; st.tp = null; st.sl = null; submit(); st.tp = tp; st.sl = sl; st.mode = m0; st.vol = v0; st.side = keep; render(); };
O.pendingAt = (side, price) => { st.mode = 'pending'; st.price = price; st.side = side; if (form() === 'oneclick') AT.setPref('form', 'regular'); render(); AT.T.toggleOrderPanel(true); };

/* ---------- live refresh ---------- */
function bigPrice(px) {
  if (px == null) return '<span class="q-s">-</span>';
  const s = U.fmt(px, sym.dg);
  if (sym.dg % 2 === 1 && sym.dg > 0) return '<span class="q-s">' + s.slice(0, -3) + '</span><span class="q-b">' + s.slice(-3, -1) + '</span><sup>' + s.slice(-1) + '</sup>';
  return '<span class="q-s">' + s.slice(0, -2) + '</span><span class="q-b">' + s.slice(-2) + '</span>';
}
O.tick = function () {
  if (!root || !sym) return;
  const x = q(); const a = acc();
  const bid = root.querySelector('[data-px="bid"]'), ask = root.querySelector('[data-px="ask"]'), sp = root.querySelector('[data-sp]');
  if (bid) bid.innerHTML = bigPrice(x && x.bid);
  if (ask) ask.innerHTML = bigPrice(x && x.ask);
  if (sp && x) sp.textContent = sym.mm === 'fx' ? U.fmt(x.sp / sym.pip, 1) + ' pips' : U.fmt(x.sp, Math.max(0, sym.dg - 1)) + ' ' + (sym.quote === 'USDT' ? 'USDT' : sym.quote);
  const sb = F.sentiment(sym.s);
  const se = root.querySelector('.op-sent');
  if (se) { se.querySelector('.s-sell').textContent = (100 - sb) + '%'; se.querySelector('.s-buy').textContent = sb + '%'; se.querySelector('.s-bar i').style.width = (100 - sb) + '%'; }
  const side = sideNow();
  for (const key of ['price', 'tp', 'sl']) {
    const h = root.querySelector('[data-hint="' + key + '"]'); if (!h) continue;
    if (key === 'price') { if (x && st.price > 0) { const cur = side === 'buy' ? x.ask : x.bid; h.textContent = U.fmtSignedAscii((st.price - cur) / sym.pip, 1) + ' pips'; const k = pendingKind(); const b = root.querySelector('.ibadge.kind'); if (b && k) b.textContent = k === 'limit' ? 'Limit' : 'Stop'; } else h.textContent = ''; continue; }
    const px = toPrice(key, side);
    if (px == null) { h.innerHTML = ''; continue; }
    const e = entryPrice(side);
    const pips = e ? (px - e) / sym.pip * (side === 'buy' ? 1 : -1) : 0;
    const vol = form() === 'risk' ? (riskVolume() || 0) : st.vol;
    const money = e ? E.profit(a, { sym: sym.s, side, vol, open: e }, px) : null;
    const m = E.metrics(a);
    const pct = money != null && m.eq > 0 ? money / m.eq * 100 : 0;
    const parts = [];
    const u = st[key + 'U'];
    if (u !== 'price') parts.push(U.fmt(px, sym.dg));
    if (u !== 'pips') parts.push(U.fmtSignedAscii(pips, 1) + ' pips');
    if (u !== 'money' && money != null) parts.push(U.fmtSignedAscii(money, 2) + ' ' + a.cur);
    if (u !== 'pct') parts.push(U.fmt(pct, 2) + ' %');
    const bad = e && !E.checkStops(side, st.mode === 'pending' ? e : (side === 'buy' ? x.bid : x.ask), key === 'tp' ? px : null, key === 'sl' ? px : null);
    h.innerHTML = parts.map(p => '<span>' + U.esc(p) + '</span>').join('<i></i>');
    h.classList.toggle('bad', !!bad);
  }
  const calc = root.querySelector('[data-calc]');
  if (calc) { const v = riskVolume(); calc.innerHTML = 'Volume: <b>' + (v ? U.fmt(v, 2) + ' lots' : '—') + '</b>'; }
  const cb = root.querySelector('[data-confirm]');
  if (cb) { const vol = form() === 'risk' ? riskVolume() : st.vol; const k = st.mode === 'pending' ? pendingKind() : null; cb.textContent = 'Confirm ' + (st.side === 'buy' ? 'Buy' : 'Sell') + (k ? (k === 'limit' ? ' Limit' : ' Stop') : '') + ' ' + (vol ? U.fmt(vol, 2) : '0.00') + ' lots'; }
  const info = root.querySelector('[data-info]');
  if (info && a && x) {
    const vol = form() === 'risk' ? (riskVolume() || 0) : st.vol;
    const px = entryPrice(side);
    const spreadCost = F.convert(x.sp * vol * E.cs(a, sym), sym.quote, a.cur) || 0;
    const comm = 2 * (F.convert(S.commission(sym, a.type, px) * vol * (a.type === 'cent' ? 0.01 : 1), 'USD', a.cur) || 0);
    const m = E.metrics(a);
    const margin = E.marginFor(a, sym.s, side, vol, px, m.eqUsd);
    const lev = E.levEff(a, sym, m.eqUsd);
    const pipVal = F.convert(sym.pip * vol * E.cs(a, sym), sym.quote, 'USD');
    const notional = F.convert(vol * E.cs(a, sym) * px, sym.quote, 'USD');
    let h = '<div><span>Fees:</span><b>≈ ' + U.money(spreadCost + comm, a.cur) + '</b>' + U.icon('help') + '</div>' +
      '<div><span>Leverage:</span><b>' + S.levLabel(lev >= 2000000 ? 0 : lev) + '</b>' + U.icon('help') + '</div>' +
      '<div><span>Margin:</span><b>' + (margin != null ? U.money(margin, a.cur) : '-') + '</b></div>';
    if (st.more) h += '<div><span>Pip Value:</span><b>' + (pipVal != null ? U.fmt(pipVal, 2) + ' USD' : '-') + '</b></div><div><span>Volume in units:</span><b>' + unitsText(vol) + '</b></div><div><span>Volume in USD:</span><b>' + (notional != null ? U.fmt(notional, 2) + ' USD' : '-') + '</b></div>';
    h += '<button class="lnk op-more" type="button">' + (st.more ? 'Less' : 'More') + ' ' + U.icon(st.more ? 'caret-up' : 'caret') + '</button>';
    if (info.dataset.h !== h) { info.innerHTML = h; info.dataset.h = h; info.querySelector('.op-more').onclick = () => { st.more = !st.more; O.tick(); }; }
  }
};
/* order-form preview lines on the chart (drag them to change values) */
function preview() {
  const c = AT.T && AT.T.chart; if (!c) return;
  const f = form();
  if (!st.side || f === 'oneclick') { if (c.lines.preview) { c.lines.preview = null; c.lines.update(); } return; }
  const side = st.side;
  c.lines.preview = { sym: sym.s, side, vol: f === 'risk' ? (riskVolume() || 0) : st.vol, entry: st.mode === 'pending' ? st.price : null, kind: pendingKind(), tp: toPrice('tp', side), sl: toPrice('sl', side) };
  c.lines.update();
}
O.preview = preview;
U.on('preview-drag', ({ k, price }) => {
  const side = sideNow();
  if (k === 'pe') st.price = price;
  if (k === 'ptp') st.tp = fromPrice('tp', side, price, st.tpU);
  if (k === 'psl') st.sl = fromPrice('sl', side, price, st.slU);
  render();
});
U.on('preview-clear', k => { if (k === 'ptp') st.tp = null; else if (k === 'psl') st.sl = null; else if (k === 'pe') { st.mode = 'market'; st.price = null; } render(); });
O.render = render;
})();
