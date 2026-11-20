/* Amatu Trade — trading engine: accounts, market & pending orders, TP/SL, margin, stop out, swaps,
   commissions, deposits/withdrawals/transfers, and catch-up of everything that happened while the app was closed. */
(function () {
'use strict';
const AT = window.AT, U = AT.U, S = AT.S, F = AT.F;
const E = AT.E = {};
const K_ACC = 'exness.accounts', K_TX = 'exness.tx', K_NOTIF = 'exness.notif';
const kHist = id => 'exness.hist.' + id;

E.st = { v: 1, active: null, accounts: [] };
E.tx = [];
E.notifs = [];
const hist = {};

/* ---------- persistence ---------- */
E.load = function () {
  const st = U.load(K_ACC, null);
  if (st && Array.isArray(st.accounts)) E.st = st;
  E.tx = U.load(K_TX, []) || [];
  E.notifs = U.load(K_NOTIF, []) || [];
  for (const k in hist) delete hist[k];
  if (!E.st.accounts.length) E.createAccount({ type: 'standard', cur: 'IDR', lev: 200, nick: 'Standard', deposit: 100000000, silent: true });
  if (!E.acc(E.st.active)) E.st.active = (E.st.accounts.find(a => !a.archived) || E.st.accounts[0]).id;
};
let saveT = null;
E.save = function (now) {
  clearTimeout(saveT);
  if (now) { U.save(K_ACC, E.st); return; }
  saveT = setTimeout(() => U.save(K_ACC, E.st), 250);
};
E.history = id => hist[id] || (hist[id] = U.load(kHist(id), []) || []);
function saveHist(id) { U.save(kHist(id), E.history(id)); }
function saveTx() { U.save(K_TX, E.tx); }

/* ---------- accounts ---------- */
E.acc = id => E.st.accounts.find(a => a.id === id) || null;
E.active = () => E.acc(E.st.active);
E.setActive = id => { if (!E.acc(id)) return; E.st.active = id; E.save(); U.emit('acc'); U.emit('state'); };
function newId() { let id; do { id = String(Math.floor(100000000 + Math.random() * 899999999)); } while (E.acc(id)); return id; }
E.createAccount = function (o) {
  const a = {
    id: newId(), type: o.type || 'standard', cur: o.type === 'cent' ? 'USC' : (o.cur || 'USD'), lev: o.lev != null ? o.lev : 200,
    nick: o.nick || S.ACCOUNT_TYPES[o.type || 'standard'].name, bal: 0, created: Date.now(), archived: false,
    pos: [], ord: [], seq: 5400000 + Math.floor(Math.random() * 90000), oseq: 11700000 + Math.floor(Math.random() * 90000),
    chk: Date.now(), swapT: Date.now()
  };
  E.st.accounts.unshift(a);
  E.st.active = a.id;
  if (o.deposit > 0) E.deposit(a.id, o.deposit, o.depositCur || a.cur, true);
  E.save(true);
  if (!o.silent) U.emit('state');
  return a;
};
E.archive = id => { const a = E.acc(id); if (!a) return { err: 'Account not found' }; if (a.pos.length || a.ord.length) return { err: 'Close all positions and orders before archiving' }; a.archived = true; if (E.st.active === id) { const n = E.st.accounts.find(x => !x.archived); if (n) E.st.active = n.id; } E.save(true); U.emit('state'); return { ok: true }; };
E.restore = id => { const a = E.acc(id); if (!a) return; a.archived = false; a.chk = Date.now(); a.swapT = Date.now(); E.save(true); U.emit('state'); };
E.remove = id => { const i = E.st.accounts.findIndex(a => a.id === id); if (i < 0) return; E.st.accounts.splice(i, 1); U.del(kHist(id)); delete hist[id]; if (E.st.active === id && E.st.accounts.length) E.st.active = E.st.accounts[0].id; E.save(true); U.emit('state'); };
E.setLeverage = (id, lev) => {
  const a = E.acc(id); if (!a) return { err: 'Account not found' };
  const old = a.lev; a.lev = lev;
  const m = E.metrics(a);
  if (a.pos.length && m.margin > 0 && m.eq / m.margin * 100 <= 100) { a.lev = old; return { err: 'Not enough free margin to change leverage' }; }
  E.save(true); U.emit('state'); return { ok: true };
};
E.rename = (id, nick) => { const a = E.acc(id); if (!a) return; a.nick = String(nick || '').slice(0, 36); E.save(true); U.emit('state'); };

/* ---------- money movements ---------- */
function addTx(t) { t.id = t.id || String(Math.floor(1e9 + Math.random() * 8.9e9)); t.t = t.t || Date.now(); t.status = 'Done'; E.tx.unshift(t); if (E.tx.length > 2000) E.tx.length = 2000; saveTx(); U.emit('tx'); }
E.deposit = function (id, amount, cur, quiet) {
  const a = E.acc(id); amount = +amount;
  if (!a || !(amount > 0)) return { err: 'Invalid amount' };
  const v = cur && cur !== a.cur ? F.convert(amount, cur, a.cur) : amount;
  if (!(v > 0)) return { err: 'Currency rate unavailable' };
  a.bal = U.round(a.bal + v, 2);
  addTx({ type: 'Deposit', acc: id, amt: v, cur: a.cur, method: 'Virtual deposit' });
  E.save(true); if (!quiet) U.emit('state');
  return { ok: true, amount: v };
};
E.withdraw = function (id, amount) {
  const a = E.acc(id); amount = +amount;
  if (!a || !(amount > 0)) return { err: 'Invalid amount' };
  const m = E.metrics(a);
  if (amount > Math.max(0, Math.min(m.free, a.bal)) + 1e-9) return { err: 'Amount exceeds available free margin' };
  a.bal = U.round(a.bal - amount, 2);
  addTx({ type: 'Withdrawal', acc: id, amt: -amount, cur: a.cur, method: 'Virtual withdrawal' });
  E.save(true); U.emit('state'); return { ok: true };
};
E.transfer = function (fromId, toId, amount) {
  const a = E.acc(fromId), b = E.acc(toId); amount = +amount;
  if (!a || !b || a === b) return { err: 'Choose two different accounts' };
  if (!(amount > 0)) return { err: 'Invalid amount' };
  const m = E.metrics(a);
  if (amount > Math.max(0, Math.min(m.free, a.bal)) + 1e-9) return { err: 'Amount exceeds available free margin' };
  const v = F.convert(amount, a.cur, b.cur);
  if (!(v > 0)) return { err: 'Currency rate unavailable' };
  a.bal = U.round(a.bal - amount, 2); b.bal = U.round(b.bal + v, 2);
  const ref = String(Math.floor(1e9 + Math.random() * 8.9e9));
  addTx({ type: 'Transfer', acc: fromId, to: toId, amt: -amount, cur: a.cur, method: 'Internal transfer', ref });
  addTx({ type: 'Transfer', acc: toId, from: fromId, amt: v, cur: b.cur, method: 'Internal transfer', ref });
  E.save(true); U.emit('state'); return { ok: true, received: v };
};

/* ---------- pricing helpers ---------- */
E.quote = (a, id) => F.bidAsk(id, a ? a.type : 'standard');
E.cs = (a, sym) => (a && a.type === 'cent' ? sym.cs / 100 : sym.cs);
function usdEquity(a, eq) { return F.convert(eq, a.cur, 'USD') || 0; }
/* effective leverage incl. Exness-style equity tiers for unlimited / very high leverage */
E.levEff = function (a, sym, eqUsd) {
  let lev = a.lev || 2000000;
  if (!sym.cap && (sym.g === 'Majors' || sym.g === 'Minors' || sym.g === 'Metals')) {
    const e = eqUsd || 0;
    if (e >= 100000) lev = Math.min(lev, 500); else if (e >= 30000) lev = Math.min(lev, 1000); else if (e >= 5000) lev = Math.min(lev, 2000);
  } else if (!sym.cap) lev = Math.min(lev, 2000);
  if (sym.cap) lev = Math.min(lev, sym.cap);
  if (AT.Pn && AT.Pn.hmr && AT.Pn.hmr(sym.s)) lev = Math.min(lev, 200); // high margin requirement around major news
  return lev;
};
/* margin for vol lots of sym, in account currency */
E.marginFor = function (a, id, side, vol, price, eqUsd) {
  const sym = S.map[id]; const q = E.quote(a, id);
  const px = price || (q ? (side === 'buy' ? q.ask : q.bid) : null);
  if (!px) return null;
  const lev = E.levEff(a, sym, eqUsd);
  if (sym.mm === 'fx') return F.convert(vol * E.cs(a, sym) / lev, sym.base, a.cur);
  return F.convert(vol * E.cs(a, sym) * px / lev, sym.quote, a.cur);
};
/* profit of a position in account currency at the given (or current) close price */
E.profit = function (a, p, closePx) {
  const sym = S.map[p.sym];
  let px = closePx;
  if (px == null) { const q = E.quote(a, p.sym); if (!q) return null; px = p.side === 'buy' ? q.bid : q.ask; }
  const diff = (p.side === 'buy' ? px - p.open : p.open - px) * p.vol * E.cs(a, sym);
  return F.convert(diff, sym.quote, a.cur);
};
E.pips = (sym, from, to) => (to - from) / sym.pip;
E.metrics = function (a) {
  let fl = 0, sw = 0, cm = 0, ok = true;
  for (const p of a.pos) { const pr = E.profit(a, p); if (pr == null) { ok = false; continue; } fl += pr; sw += p.swap || 0; cm += p.comm || 0; }
  const eq = a.bal + fl + sw;
  const eqUsd = usdEquity(a, eq);
  let margin = 0;
  const by = {};
  for (const p of a.pos) (by[p.sym] || (by[p.sym] = { buy: 0, sell: 0, bm: 0, sm: 0 }))[p.side] += p.vol;
  for (const id in by) {
    const g = by[id];
    const mb = g.buy ? E.marginFor(a, id, 'buy', g.buy, null, eqUsd) || 0 : 0;
    const ms = g.sell ? E.marginFor(a, id, 'sell', g.sell, null, eqUsd) || 0 : 0;
    margin += Math.max(mb, ms); // hedged positions: only the larger leg needs margin
  }
  const free = eq - margin;
  return { bal: a.bal, eq, fl, swap: sw, comm: cm, margin, free, ml: margin > 0 ? eq / margin * 100 : null, ok, eqUsd };
};

/* ---------- validation ---------- */
const ERR = {
  closed: 'Market is closed', money: 'Not enough money', vol: 'Invalid volume', stops: 'Invalid S/L or T/P', price: 'Invalid price', noquote: 'No quotes', noacc: 'Account not found', archived: 'Account is archived'
};
E.ERR = ERR;
function normVol(sym, vol) { vol = Math.round(vol / sym.step) * sym.step; return U.round(vol, 2); }
E.checkVol = (sym, vol) => vol >= sym.min - 1e-9 && vol <= sym.max + 1e-9 && Math.abs(Math.round(vol / sym.step) * sym.step - vol) < 1e-7;
/* TP/SL relative to the price a position will be closed at */
E.checkStops = function (side, ref, tp, sl) {
  if (tp != null && tp > 0 && (side === 'buy' ? tp <= ref : tp >= ref)) return false;
  if (sl != null && sl > 0 && (side === 'buy' ? sl >= ref : sl <= ref)) return false;
  return true;
};
/* which pending type a price implies (Exness: Limit when better than market, Stop when worse) */
E.pendingKind = (side, price, q) => (side === 'buy' ? (price < q.ask ? 'limit' : 'stop') : (price > q.bid ? 'limit' : 'stop'));
E.typeLabel = o => (o.side === 'buy' ? 'Buy' : 'Sell') + (o.kind ? ' ' + (o.kind === 'limit' ? 'Limit' : 'Stop') : '');

/* ---------- trading ---------- */
function commFor(a, sym, vol, px) { const c = S.commission(sym, a.type, px) * vol * (a.type === 'cent' ? 0.01 : 1); return c ? -(F.convert(c, 'USD', a.cur) || 0) : 0; }
E.open = function (a, o, at) {
  if (!a) return { err: ERR.noacc };
  if (a.archived) return { err: ERR.archived };
  const sym = S.map[o.sym]; if (!sym) return { err: 'Unknown symbol' };
  if (!at && !F.isOpen(o.sym)) return { err: ERR.closed };
  const vol = normVol(sym, +o.vol);
  if (!E.checkVol(sym, vol)) return { err: ERR.vol };
  const q = at ? at.q : E.quote(a, o.sym); if (!q) return { err: ERR.noquote };
  const px = U.round(at && at.px != null ? at.px : (o.side === 'buy' ? q.ask : q.bid), sym.dg);
  const tp = o.tp > 0 ? U.round(+o.tp, sym.dg) : null, sl = o.sl > 0 ? U.round(+o.sl, sym.dg) : null;
  if (!E.checkStops(o.side, o.side === 'buy' ? q.bid : q.ask, tp, sl) && !at) return { err: ERR.stops };
  if (!at) {
    const m0 = E.metrics(a);
    const add = E.marginFor(a, o.sym, o.side, vol, px, m0.eqUsd) || 0;
    const by = a.pos.filter(p => p.sym === o.sym);
    const curB = by.filter(p => p.side === 'buy').reduce((s, p) => s + p.vol, 0), curS = by.filter(p => p.side === 'sell').reduce((s, p) => s + p.vol, 0);
    const before = Math.max(curB ? E.marginFor(a, o.sym, 'buy', curB, null, m0.eqUsd) : 0, curS ? E.marginFor(a, o.sym, 'sell', curS, null, m0.eqUsd) : 0);
    const after = Math.max(E.marginFor(a, o.sym, 'buy', curB + (o.side === 'buy' ? vol : 0), null, m0.eqUsd) || 0, E.marginFor(a, o.sym, 'sell', curS + (o.side === 'sell' ? vol : 0), null, m0.eqUsd) || 0);
    const need = Math.max(0, after - before);
    if (!(add >= 0) || m0.free - need < 0 || m0.eq <= 0) return { err: ERR.money };
  }
  const comm = commFor(a, sym, vol, px);
  const p = { id: String(++a.seq), sym: o.sym, side: o.side, vol, open: px, t: at ? at.t : Date.now(), tp, sl, swap: 0, comm, from: o.from || null };
  if (o.magic) p.magic = +o.magic; if (o.cmt) p.cmt = String(o.cmt).slice(0, 31);
  a.pos.push(p);
  if (comm) a.bal = U.round(a.bal + comm, 2);
  a.chk = Math.max(a.chk || 0, at ? at.t : Date.now());
  E.save();
  U.emit('state');
  if (!o.quiet) E.notify({ kind: 'ok', title: 'Order opened', text: (p.side === 'buy' ? 'Buy ' : 'Sell ') + U.fmt(vol, 2) + ' ' + sym.n + ' at ' + U.fmt(px, sym.dg), sym: p.sym, snd: 'open' });
  return { ok: true, pos: p };
};
E.place = function (a, o) {
  if (!a) return { err: ERR.noacc };
  if (a.archived) return { err: ERR.archived };
  const sym = S.map[o.sym]; if (!sym) return { err: 'Unknown symbol' };
  const vol = normVol(sym, +o.vol);
  if (!E.checkVol(sym, vol)) return { err: ERR.vol };
  const q = E.quote(a, o.sym); if (!q) return { err: ERR.noquote };
  const price = U.round(+o.price, sym.dg);
  if (!(price > 0)) return { err: ERR.price };
  const kind = o.kind || E.pendingKind(o.side, price, q);
  const tp = o.tp > 0 ? +o.tp : null, sl = o.sl > 0 ? +o.sl : null;
  if (!E.checkStops(o.side, price, tp, sl)) return { err: ERR.stops };
  const m = E.metrics(a);
  if (m.eq <= 0) return { err: ERR.money };
  const ord = { id: String(++a.oseq), sym: o.sym, side: o.side, kind, vol, price, tp, sl, t: Date.now(), exp: o.exp || null };
  if (o.magic) ord.magic = +o.magic; if (o.cmt) ord.cmt = String(o.cmt).slice(0, 31);
  a.ord.push(ord);
  E.save(); U.emit('state');
  if (!o.quiet) E.notify({ kind: 'ok', title: 'Order placed', text: E.typeLabel(ord) + ' ' + U.fmt(vol, 2) + ' ' + sym.n + ' at ' + U.fmt(price, sym.dg), sym: o.sym, snd: 'open' });
  return { ok: true, ord };
};
E.modifyPos = function (a, id, o) {
  const p = a.pos.find(x => x.id === id); if (!p) return { err: 'Position not found' };
  const q = E.quote(a, p.sym);
  const tp = o.tp === undefined ? p.tp : (o.tp > 0 ? +o.tp : null), sl = o.sl === undefined ? p.sl : (o.sl > 0 ? +o.sl : null);
  if (q && !E.checkStops(p.side, p.side === 'buy' ? q.bid : q.ask, tp, sl)) return { err: ERR.stops };
  p.tp = tp; p.sl = sl;
  E.save(); U.emit('state');
  return { ok: true };
};
E.modifyOrd = function (a, id, o) {
  const ord = a.ord.find(x => x.id === id); if (!ord) return { err: 'Order not found' };
  const sym = S.map[ord.sym];
  const q = E.quote(a, ord.sym);
  const price = o.price != null ? U.round(+o.price, sym.dg) : ord.price;
  const tp = o.tp === undefined ? ord.tp : (o.tp > 0 ? +o.tp : null), sl = o.sl === undefined ? ord.sl : (o.sl > 0 ? +o.sl : null);
  const vol = o.vol != null ? normVol(sym, +o.vol) : ord.vol;
  if (!(price > 0)) return { err: ERR.price };
  if (!E.checkVol(sym, vol)) return { err: ERR.vol };
  if (!E.checkStops(ord.side, price, tp, sl)) return { err: ERR.stops };
  ord.price = price; ord.tp = tp; ord.sl = sl; ord.vol = vol;
  if (q) ord.kind = E.pendingKind(ord.side, price, q);
  E.save(); U.emit('state');
  return { ok: true };
};
E.cancel = function (a, id, why) {
  const i = a.ord.findIndex(x => x.id === id); if (i < 0) return { err: 'Order not found' };
  const ord = a.ord.splice(i, 1)[0];
  const h = E.history(a.id);
  h.unshift({ id: ord.id, ord: true, sym: ord.sym, side: ord.side, kind: ord.kind, vol: ord.vol, open: ord.price, close: null, tp: ord.tp, sl: ord.sl, t0: ord.t, t1: Date.now(), swap: 0, comm: 0, pl: 0, reason: why || 'Canceled', magic: ord.magic || undefined });
  saveHist(a.id);
  E.save(); U.emit('state'); U.emit('hist', a.id);
  return { ok: true };
};
/* close (part of) a position */
E.close = function (a, id, vol, reason, at) {
  const i = a.pos.findIndex(x => x.id === id); if (i < 0) return { err: 'Position not found' };
  const p = a.pos[i]; const sym = S.map[p.sym];
  if (!at && !F.isOpen(p.sym)) return { err: ERR.closed };
  vol = vol == null ? p.vol : normVol(sym, vol);
  if (!(vol > 0) || vol > p.vol + 1e-9) return { err: ERR.vol };
  const q = at ? at.q : E.quote(a, p.sym); if (!q && !(at && at.px != null)) return { err: ERR.noquote };
  const px = U.round(at && at.px != null ? at.px : (p.side === 'buy' ? q.bid : q.ask), sym.dg);
  const part = vol / p.vol;
  const pr = E.profit(a, Object.assign({}, p, { vol }), px) || 0;
  const swap = U.round((p.swap || 0) * part, 2);
  const comm0 = U.round((p.comm || 0) * part, 2);
  const comm1 = commFor(a, sym, vol, px);
  const rec = { id: p.id, sym: p.sym, side: p.side, vol, open: p.open, close: px, tp: p.tp, sl: p.sl, t0: p.t, t1: at ? at.t : Date.now(), swap, comm: U.round(comm0 + comm1, 2), pl: U.round(pr, 2), reason: reason || '' };
  if (p.magic) rec.magic = p.magic; if (p.cmt) rec.cmt = p.cmt;
  a.bal = U.round(a.bal + rec.pl + swap + comm1, 2);
  if (vol >= p.vol - 1e-9) a.pos.splice(i, 1);
  else { p.vol = U.round(p.vol - vol, 2); p.swap = U.round((p.swap || 0) - swap, 2); p.comm = U.round((p.comm || 0) - comm0, 2); }
  E.history(a.id).unshift(rec);
  saveHist(a.id);
  E.save(); U.emit('state'); U.emit('hist', a.id);
  const by = reason === 'TP' ? 'Take Profit' : reason === 'SL' ? 'Stop Loss' : reason === 'Stop Out' ? 'Stop Out' : '';
  if (!(at && at.quiet)) E.notify({ kind: rec.pl >= 0 ? 'ok' : (reason ? 'warn' : 'info'), title: by ? 'Position closed by ' + by : 'Position closed', text: (p.side === 'buy' ? 'Buy ' : 'Sell ') + U.fmt(vol, 2) + ' ' + sym.n + ' · ' + U.money(rec.pl, a.cur, true), sym: p.sym, snd: reason === 'TP' ? 'tp' : reason === 'SL' ? 'sl' : reason === 'Stop Out' ? 'so' : null });
  return { ok: true, rec };
};
E.closeAll = function (a, filter) {
  const list = a.pos.filter(filter || (() => true)).map(p => p.id);
  let n = 0, err = null;
  for (const id of list) { const r = E.close(a, id, null, '', null); if (r.ok) n++; else err = r.err; }
  return { n, err };
};

/* ---------- live checks on every tick ---------- */
E.check = function (ids) {
  const set = ids ? new Set(ids) : null;
  for (const a of E.st.accounts) {
    if (a.archived || (!a.pos.length && !a.ord.length)) continue;
    let touched = false;
    for (const ord of a.ord.slice()) {
      if (set && !set.has(ord.sym)) continue;
      if (!F.isOpen(ord.sym)) continue;
      const q = E.quote(a, ord.sym); if (!q) continue;
      let fill = null;
      if (ord.side === 'buy') { if (ord.kind === 'limit' && q.ask <= ord.price) fill = Math.min(ord.price, q.ask); else if (ord.kind === 'stop' && q.ask >= ord.price) fill = q.ask; }
      else { if (ord.kind === 'limit' && q.bid >= ord.price) fill = Math.max(ord.price, q.bid); else if (ord.kind === 'stop' && q.bid <= ord.price) fill = q.bid; }
      if (fill != null) { trigger(a, ord, fill, q, Date.now()); touched = true; }
      else if (ord.exp && Date.now() >= ord.exp) { E.cancel(a, ord.id, 'Expired'); touched = true; }
    }
    for (const p of a.pos.slice()) {
      if (set && !set.has(p.sym)) continue;
      if (!F.isOpen(p.sym)) continue;
      const q = E.quote(a, p.sym); if (!q) continue;
      const px = p.side === 'buy' ? q.bid : q.ask;
      if (p.tp && (p.side === 'buy' ? px >= p.tp : px <= p.tp)) { E.close(a, p.id, null, 'TP', { q, px: p.side === 'buy' ? Math.max(px, p.tp) : Math.min(px, p.tp), t: Date.now() }); touched = true; continue; }
      if (p.sl && (p.side === 'buy' ? px <= p.sl : px >= p.sl)) { E.close(a, p.id, null, 'SL', { q, px, t: Date.now() }); touched = true; continue; }
    }
    if (a.pos.length && (!set || a.pos.some(p => set.has(p.sym)))) marginCheck(a);
    if (touched) a.chk = Date.now();
  }
};
function trigger(a, ord, fill, q, t, quiet) {
  const i = a.ord.indexOf(ord); if (i >= 0) a.ord.splice(i, 1);
  const sym = S.map[ord.sym];
  const r = E.open(a, { sym: ord.sym, side: ord.side, vol: ord.vol, tp: ord.tp, sl: ord.sl, quiet: true, from: ord.id, magic: ord.magic, cmt: ord.cmt }, { q, px: U.round(fill, sym.dg), t });
  E.history(a.id).unshift({ id: ord.id, ord: true, sym: ord.sym, side: ord.side, kind: ord.kind, vol: ord.vol, open: ord.price, close: U.round(fill, sym.dg), tp: ord.tp, sl: ord.sl, t0: ord.t, t1: t, swap: 0, comm: 0, pl: 0, reason: 'Filled', pos: r.pos ? r.pos.id : null });
  saveHist(a.id);
  if (!quiet && !ord.magic) E.notify({ kind: 'ok', title: 'Pending order triggered', text: E.typeLabel(ord) + ' ' + U.fmt(ord.vol, 2) + ' ' + sym.n + ' at ' + U.fmt(fill, sym.dg), sym: ord.sym, snd: 'open' });
  return r;
}
function marginCheck(a, at) {
  const so = S.ACCOUNT_TYPES[a.type].so, mc = S.ACCOUNT_TYPES[a.type].mc;
  let m = E.metrics(a);
  if (m.margin > 0 && m.ml != null && m.ml <= mc && !a.mcOn) { a.mcOn = true; if (!at) E.notify({ kind: 'warn', title: 'Margin call', text: 'Margin level ' + U.pct(m.ml) + '. Deposit funds or close positions.', snd: 'sl' }); }
  if (a.mcOn && m.ml != null && m.ml > mc + 10) a.mcOn = false;
  let guard = 0;
  while (a.pos.length && m.margin > 0 && m.ml != null && m.ml <= so && guard++ < 200) {
    let worst = null, wv = Infinity;
    for (const p of a.pos) { const pr = at ? E.profit(a, p, at.px(p)) : E.profit(a, p); if (pr != null && pr < wv) { wv = pr; worst = p; } }
    if (!worst) break;
    E.close(a, worst.id, null, 'Stop Out', at ? { px: at.px(worst), t: at.t, quiet: true } : null);
    m = E.metrics(a);
  }
  if (!a.pos.length && a.bal < 0) {
    const fix = -a.bal; a.bal = 0;
    addTx({ type: 'Adjustment', acc: a.id, amt: fix, cur: a.cur, method: 'Negative balance protection' });
    E.save(true);
  }
  if (guard) E.notify({ kind: 'error', title: 'Stop Out', text: 'Positions were closed because the margin level fell to ' + so + '%.', snd: 'so' });
}

/* ---------- swaps at rollover (17:00 New York) ---------- */
function rolloversBetween(t0, t1) {
  const out = [];
  if (!(t1 > t0)) return out;
  let d = new Date(t0); d = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 86400000;
  for (; d <= t1 + 86400000; d += 86400000) {
    for (const h of [21, 22]) { // 17:00 NY = 21:00 UTC (summer) or 22:00 UTC (winter)
      const t = d + h * 3600000;
      const p = U.tzParts(t, 'America/New_York');
      if (p.h === 17 && p.mi === 0 && t > t0 && t <= t1) out.push({ t, wd: p.wd });
    }
  }
  return out;
}
function swapDays(sym, wd) {
  if (sym.hrs === 'crypto') return 1;
  if (wd === 0 || wd === 6) return 0;
  if (sym.g === 'Stocks') return wd === 5 ? 3 : 1;
  return wd === 3 ? 3 : 1;
}
function swapAmount(a, p, days) {
  const sym = S.map[p.sym];
  const r = p.side === 'buy' ? sym.sw[0] : sym.sw[1];
  if (!r || !days) return 0;
  let v;
  if (sym.swm === 'pct') { const q = E.quote(a, p.sym); const px = q ? q.mid : p.open; v = p.vol * E.cs(a, sym) * px * r / 100; }
  else v = r * sym.pt * p.vol * E.cs(a, sym);
  return (F.convert(v * days, sym.quote, a.cur) || 0);
}
E.applySwaps = function (a, upto) {
  upto = upto || Date.now();
  const rolls = rolloversBetween(a.swapT || a.created, upto);
  if (!rolls.length) return 0;
  let n = 0;
  for (const r of rolls) for (const p of a.pos) {
    if (p.t >= r.t) continue;
    const s = swapAmount(a, p, swapDays(S.map[p.sym], r.wd));
    if (s) { p.swap = U.round((p.swap || 0) + s, 2); n++; }
  }
  a.swapT = upto;
  return n;
};

/* ---------- catch-up: replay 1-minute bars since the last check ---------- */
E.catchUp = async function () {
  const now = Date.now();
  const todo = E.st.accounts.filter(a => !a.archived && (a.pos.length || a.ord.length) && now - (a.chk || now) > 90000);
  const summary = [];
  for (const a of todo) {
    const from = Math.max(a.chk, now - 14 * 86400000);
    const syms = Array.from(new Set(a.pos.map(p => p.sym).concat(a.ord.map(o => o.sym))));
    const bars = {};
    await Promise.all(syms.map(async id => {
      try { bars[id] = (await F.history(id, 60, { to: Math.floor(now / 1000), bars: Math.ceil((now - from) / 60000) + 5, from: Math.floor(from / 1000) })).filter(b => b.time * 1000 >= from - 60000); }
      catch (e) { bars[id] = []; }
    }));
    const times = Array.from(new Set([].concat(...syms.map(id => bars[id].map(b => b.time))))).sort((x, y) => x - y);
    const idx = {}; for (const id of syms) idx[id] = new Map(bars[id].map(b => [b.time, b]));
    const last = {};
    const before = { pos: a.pos.length, ord: a.ord.length, bal: a.bal };
    let events = 0;
    for (const t of times) {
      const tm = t * 1000;
      if (tm + 60000 <= a.chk) continue;
      E.applySwaps(a, tm);
      for (const id of syms) {
        const b = idx[id].get(t); if (!b) continue;
        last[id] = b;
        const sym = S.map[id];
        const sp = S.spread(sym, a.type, b.close);
        const qOf = px => ({ bid: px - sp / 2, ask: px + sp / 2, mid: px });
        for (const ord of a.ord.slice()) {
          if (ord.sym !== id || ord.t > tm + 59999) continue;
          const oAsk = b.open + sp / 2, oBid = b.open - sp / 2;
          let fill = null;
          if (ord.side === 'buy') {
            if (ord.kind === 'limit' && b.low + sp / 2 <= ord.price) fill = Math.min(ord.price, oAsk);
            else if (ord.kind === 'stop' && b.high + sp / 2 >= ord.price) fill = Math.max(ord.price, oAsk);
          } else {
            if (ord.kind === 'limit' && b.high - sp / 2 >= ord.price) fill = Math.max(ord.price, oBid);
            else if (ord.kind === 'stop' && b.low - sp / 2 <= ord.price) fill = Math.min(ord.price, oBid);
          }
          if (fill != null) { trigger(a, ord, fill, qOf(fill), tm + 30000, true); events++; }
          else if (ord.exp && ord.exp <= tm) { E.cancel(a, ord.id, 'Expired'); events++; }
        }
        for (const p of a.pos.slice()) {
          if (p.sym !== id || p.t > tm + 59999) continue;
          const hiC = p.side === 'buy' ? b.high - sp / 2 : b.high + sp / 2, loC = p.side === 'buy' ? b.low - sp / 2 : b.low + sp / 2;
          const opC = p.side === 'buy' ? b.open - sp / 2 : b.open + sp / 2;
          const hitSL = p.sl && (p.side === 'buy' ? loC <= p.sl : hiC >= p.sl);
          const hitTP = p.tp && (p.side === 'buy' ? hiC >= p.tp : loC <= p.tp);
          if (hitSL) { const px = p.side === 'buy' ? Math.min(p.sl, opC) : Math.max(p.sl, opC); E.close(a, p.id, null, 'SL', { q: qOf(b.close), px, t: tm + 30000, quiet: true }); events++; }
          else if (hitTP) { const px = p.side === 'buy' ? Math.max(p.tp, opC) : Math.min(p.tp, opC); E.close(a, p.id, null, 'TP', { q: qOf(b.close), px, t: tm + 30000, quiet: true }); events++; }
        }
      }
      if (a.pos.length) {
        const adverse = p => { const b = last[p.sym]; if (!b) return null; const sp = S.spread(S.map[p.sym], a.type, b.close); return p.side === 'buy' ? b.low - sp / 2 : b.high + sp / 2; };
        const m = metricsAt(a, adverse);
        if (m.margin > 0 && m.ml <= S.ACCOUNT_TYPES[a.type].so) { marginCheck(a, { px: adverse, t: tm + 30000 }); events++; }
      }
    }
    E.applySwaps(a, now);
    a.chk = now;
    if (events) summary.push({ a, events, before, after: { pos: a.pos.length, ord: a.ord.length, bal: a.bal } });
  }
  E.save(true);
  for (const s of summary) E.notify({ kind: 'info', title: 'While you were away', text: 'Account #' + s.a.id + ': ' + s.events + ' order event(s) processed (TP/SL, pending orders, stop out). Balance ' + U.money(s.after.bal, s.a.cur) + ' (was ' + U.money(s.before.bal, s.a.cur) + ').' });
  if (todo.length) { U.emit('state'); for (const a of todo) U.emit('hist', a.id); }
};
function metricsAt(a, pxOf) {
  let fl = 0;
  for (const p of a.pos) { const px = pxOf(p); const pr = px == null ? E.profit(a, p) : E.profit(a, p, px); fl += pr || 0; fl += p.swap || 0; }
  const eq = a.bal + fl;
  const m = E.metrics(a);
  return { eq, margin: m.margin, ml: m.margin > 0 ? eq / m.margin * 100 : null };
}

/* ---------- notifications ---------- */
E.mute = false;
E.notify = function (n) {
  if (E.mute && n.kind !== 'error') return;
  n.t = Date.now(); n.id = U.uid(); n.read = false;
  E.notifs.unshift({ id: n.id, t: n.t, kind: n.kind, title: n.title, text: n.text, sym: n.sym, read: false });
  if (E.notifs.length > 100) E.notifs.length = 100;
  U.save(K_NOTIF, E.notifs);
  U.toast(n.title, U.esc(n.text || ''), n.kind === 'error' ? 'error' : n.kind === 'warn' ? 'warn' : n.kind === 'ok' ? 'ok' : 'info');
  const pr = AT.prefs || {};
  if (n.snd && (n.snd === 'tp' || n.snd === 'sl' || n.snd === 'so') && pr.sndClose) U.beep(n.snd);
  if (n.snd === 'alert' && pr.sndAlert) U.beep('alert');
  U.emit('notif');
};

/* ---------- periodic housekeeping ---------- */
E.housekeep = function () {
  const now = Date.now();
  let dirty = false;
  for (const a of E.st.accounts) {
    if (a.archived) continue;
    if (E.applySwaps(a, now)) dirty = true;
    if (a.pos.length || a.ord.length) { if (now - (a.chk || 0) > 60000) { a.chk = now; dirty = true; } }
    else if (now - (a.chk || 0) > 600000) { a.chk = now; dirty = true; }
  }
  if (dirty) E.save();
};

/* reload when another device/tab changed the synced state */
E.reloadFromStorage = function (key) {
  if (key === K_ACC) { const st = U.load(K_ACC, null); if (st && Array.isArray(st.accounts)) { const act = E.st.active; E.st = st; if (E.acc(act)) E.st.active = act; U.emit('state'); } }
  else if (key === K_TX) { E.tx = U.load(K_TX, []) || []; U.emit('tx'); }
  else if (key && key.startsWith('exness.hist.')) { const id = key.slice(12); hist[id] = U.load(key, []) || []; U.emit('hist', id); }
};
})();
