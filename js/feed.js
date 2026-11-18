/* Amatu Trade — real-time prices & candle history
   Sources (public, CORS-enabled, no keys):
   - gTrade pricing websocket + charts API (forex, metals, oil, crypto, stocks)
   - Hyperliquid xyz markets (US500, USTEC, JP225, natural gas, stocks): mid corrected to the oracle level
   - Binance spot (BTC/USDT, ETH/BTC, USD/IDR, USD/THB, USD/TRY, PAXG for weekend gold)
   - open.er-api.com daily reference rates for pegged currencies (HKD, DKK, PLN, MYR) */
(function () {
'use strict';
const AT = window.AT, U = AT.U, S = AT.S;
const F = AT.F = {};
const GT_WS = 'wss://backend-pricing.eu.gains.trade';
const GT_API = 'https://backend-pricing.eu.gains.trade';
const HL_API = 'https://api.hyperliquid.xyz/info';
const HL_WS = 'wss://api.hyperliquid.xyz/ws';
const BN_API = ['https://data-api.binance.vision', 'https://api1.binance.com', 'https://api.binance.com'];
const BN_WS = 'wss://data-stream.binance.vision/stream?streams=';

const raw = F.raw = {};          // feed key -> {p, t}
const Q = F.quotes = {};         // sym -> {mid, t, prev, dir, open, sig}
const deps = {};                 // feed key -> [sym ids]
const status = F.status = { gt: 'init', hl: 'init', bn: 'init', gtT: 0, hlT: 0, bnT: 0 };
const hl = { basis: {}, mid: {}, oracle: {}, hot: new Set(), subs: new Set(), ws: null };

for (const s of S.list) for (const [k] of s.f) (deps[k] || (deps[k] = [])).push(s.s);
/* the account-currency conversion also needs these */
for (const c of Object.keys(S.RATE)) for (const [k] of S.RATE[c]) if (!deps[k]) deps[k] = [];

/* ---------- market-open cache (per minute) ---------- */
const openCache = {};
F.isOpen = (id, ms) => {
  const sym = S.map[id]; if (!sym) return false;
  if (ms != null) return S.isOpenAt(sym, ms);
  const now = Date.now(), m = Math.floor(now / 60000);
  const c = openCache[id];
  if (c && c.m === m) return c.v;
  const v = S.isOpenAt(sym, now);
  openCache[id] = { m, v };
  return v;
};

/* ---------- compute ---------- */
function evalF(f) {
  let p = 1;
  for (const [k, e] of f) { const r = raw[k]; if (!r || !(r.p > 0)) return null; p *= e === 1 ? r.p : e === -1 ? 1 / r.p : Math.pow(r.p, e); }
  return p;
}
F.evalFormula = evalF;
const dirty = new Set();
let flushQ = false;
function flush() {
  flushQ = false;
  if (!dirty.size) return;
  const ids = Array.from(dirty); dirty.clear();
  U.emit('ticks', ids);
}
function touch(key, p, t) {
  if (!(p > 0)) return;
  const r = raw[key];
  if (r && r.p === p) { r.t = t; return; }
  raw[key] = { p, t };
  const list = deps[key];
  if (list) for (const id of list) recompute(id, t);
  if (key === 'g:90' || key === 'b:PAXGUSDT') x247();
}
function recompute(id, t) {
  const sym = S.map[id];
  let mid = evalF(sym.f);
  if (mid == null) return;
  const q = Q[id] || (Q[id] = { mid: null, t: 0, prev: null, dir: 0 });
  if (q.mid != null && !F.isOpen(id)) return; // market closed: quotes frozen
  if (q.mid === mid) return;
  q.prev = q.mid; q.mid = mid; q.t = t || Date.now();
  q.dir = q.prev == null ? 0 : mid > q.prev ? 1 : -1;
  dirty.add(id);
  if (!flushQ) { flushQ = true; requestAnimationFrame(flush); setTimeout(flush, 250); }
}
/* XAU/USD 24/7: gold while gold trades, PAXG-scaled while gold is closed */
const w247 = U.load('pt.exness.x247', null);
let anchor = w247; // {xau, paxg, t}
function x247() {
  const xau = raw['g:90'], paxg = raw['b:PAXGUSDT'];
  const goldOpen = F.isOpen('XAUUSD');
  if (goldOpen && xau) {
    if (paxg) { anchor = { xau: xau.p, paxg: paxg.p, t: Date.now() }; if (!x247.saved || Date.now() - x247.saved > 60000) { x247.saved = Date.now(); U.save('pt.exness.x247', anchor); } }
    touch('w:XAU247', xau.p, xau.t);
  } else if (anchor && paxg) touch('w:XAU247', anchor.xau * paxg.p / anchor.paxg, paxg.t);
  else if (xau) touch('w:XAU247', xau.p, xau.t);
}

/* ---------- bid / ask for an account type ---------- */
function spreadFactor(sym, ms) {
  if (sym.hrs === 'crypto') return 1;
  const p = U.tzParts(ms, 'America/New_York');
  const m = p.h * 60 + p.mi;
  if (m >= 16 * 60 + 55 && m < 17 * 60 + 15) return 3.2; // rollover
  return 1;
}
let sfCache = { m: -1, v: {} };
F.bidAsk = (id, type) => {
  const q = Q[id], sym = S.map[id];
  if (!q || q.mid == null) return null;
  const m = Math.floor(Date.now() / 60000);
  if (sfCache.m !== m) sfCache = { m, v: {} };
  const k = sym.hrs;
  const fac = sfCache.v[k] != null ? sfCache.v[k] : (sfCache.v[k] = spreadFactor(sym, Date.now()));
  let sp = S.spread(sym, type || 'standard', q.mid) * fac;
  const pt = sym.pt, dg = sym.dg;
  const bid = +(Math.round((q.mid - sp / 2) / pt) * pt).toFixed(dg);
  let ask = +(Math.round((q.mid + sp / 2) / pt) * pt).toFixed(dg);
  if (sp > 0 && ask <= bid) ask = +(bid + pt).toFixed(dg);
  return { bid, ask, sp: ask - bid, mid: q.mid, t: q.t, dir: q.dir };
};
/* conversion: amount in currency `from` -> currency `to` (via USD) */
F.usdRate = cur => { // units of cur per 1 USD
  if (cur === 'USD') return 1;
  if (cur === 'USC') return 100;
  const f = S.RATE[cur];
  if (f) { const v = evalF(f); if (v) return v; }
  const r = F.ref && F.ref[cur]; return r || null;
};
F.convert = (x, from, to) => {
  if (from === to || !x) return x;
  const a = F.usdRate(from), b = F.usdRate(to);
  if (!a || !b) return null;
  return x / a * b;
};

/* ---------- gTrade websocket ---------- */
let gtWs = null, gtRetry = 0, gtTimer = null;
function gtConnect() {
  try { gtWs = new WebSocket(GT_WS); } catch (e) { return gtLater(); }
  gtWs.onopen = () => { gtRetry = 0; status.gt = 'ok'; U.emit('feed-status'); };
  gtWs.onmessage = ev => {
    let a; try { a = JSON.parse(ev.data); } catch (e) { return; }
    if (!Array.isArray(a)) return;
    const t = Date.now(); status.gtT = t;
    if (a.length < 2) return;
    for (let i = 0; i + 1 < a.length; i += 2) {
      const k = 'g:' + a[i];
      if (deps[k]) touch(k, +a[i + 1], t);
    }
  };
  gtWs.onclose = () => { status.gt = 'down'; U.emit('feed-status'); gtLater(); };
  gtWs.onerror = () => { try { gtWs.close(); } catch (e) { /* */ } };
}
function gtLater() { clearTimeout(gtTimer); gtTimer = setTimeout(gtConnect, Math.min(30000, 1000 * Math.pow(2, gtRetry++))); }
/* snapshot of every pair (current-minute close) — used at start and as a safety net */
async function gtSnapshot() {
  try {
    const r = await fetch(GT_API + '/charts', { cache: 'no-store' });
    const d = await r.json();
    const t = Date.now();
    d.closes.forEach((p, i) => { const k = 'g:' + i; if (deps[k] && p > 0 && (!raw[k] || t - raw[k].t > 20000)) touch(k, p, raw[k] ? raw[k].t : d.time || t); });
    if (status.gt !== 'ok' && status.gt !== 'down') status.gt = 'poll';
  } catch (e) { /* offline */ }
}

/* ---------- Hyperliquid ---------- */
function hlPrice(coin) {
  const mid = hl.mid[coin], or = hl.oracle[coin];
  if (!(or > 0)) return mid || null;
  const ids = deps['h:' + coin] || [];
  const open = ids.length ? F.isOpen(ids[0]) : true;
  if (!open || !(mid > 0)) return or;
  return mid - (hl.basis[coin] || 0);
}
function hlCtx(coin, ctx) {
  const mid = +(ctx.midPx || ctx.markPx), or = +ctx.oraclePx;
  if (or > 0) {
    const b = mid > 0 ? mid - or : 0;
    hl.basis[coin] = hl.basis[coin] == null ? b : hl.basis[coin] + 0.15 * (b - hl.basis[coin]);
    hl.oracle[coin] = or;
  }
  if (mid > 0) hl.mid[coin] = mid;
  status.hlT = Date.now();
  touch('h:' + coin, hlPrice(coin), Date.now());
}
async function hlPoll() {
  try {
    const r = await fetch(HL_API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'metaAndAssetCtxs', dex: 'xyz' }) });
    const [meta, ctxs] = await r.json();
    meta.universe.forEach((u, i) => { if (deps['h:' + u.name] && !hl.subs.has(u.name)) hlCtx(u.name, ctxs[i]); else if (deps['h:' + u.name] && !hl.oracle[u.name]) hlCtx(u.name, ctxs[i]); });
    if (status.hl !== 'ok') status.hl = 'poll';
  } catch (e) { if (status.hl !== 'ok') status.hl = 'down'; }
}
let hlRetry = 0;
function hlConnect() {
  let ws;
  try { ws = new WebSocket(HL_WS); } catch (e) { return setTimeout(hlConnect, 5000); }
  hl.ws = ws; hl.subs = new Set();
  ws.onopen = () => { hlRetry = 0; status.hl = 'ok'; hlSync(); U.emit('feed-status'); hl.ping = setInterval(() => { try { ws.send('{"method":"ping"}'); } catch (e) { /* */ } }, 30000); };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.channel === 'activeAssetCtx' && m.data && m.data.ctx) hlCtx(m.data.coin, m.data.ctx);
  };
  ws.onclose = () => { clearInterval(hl.ping); status.hl = 'down'; hl.ws = null; U.emit('feed-status'); setTimeout(hlConnect, Math.min(30000, 1500 * Math.pow(2, hlRetry++))); };
  ws.onerror = () => { try { ws.close(); } catch (e) { /* */ } };
}
/* subscribe live contexts only for instruments in use (tabs, positions, visible rows) */
function hlSync() {
  const ws = hl.ws; if (!ws || ws.readyState !== 1) return;
  for (const c of hl.hot) if (!hl.subs.has(c)) { ws.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'activeAssetCtx', coin: c } })); hl.subs.add(c); }
  for (const c of Array.from(hl.subs)) if (!hl.hot.has(c)) { ws.send(JSON.stringify({ method: 'unsubscribe', subscription: { type: 'activeAssetCtx', coin: c } })); hl.subs.delete(c); }
}
F.setHot = ids => {
  const set = new Set();
  for (const id of ids) { const s = S.map[id]; if (s) for (const [k] of s.f) if (k.startsWith('h:')) set.add(k.slice(2)); }
  const same = set.size === hl.hot.size && Array.from(set).every(x => hl.hot.has(x));
  if (same) return;
  hl.hot = set; hlSync();
};

/* ---------- Binance ---------- */
const BN_SYMS = ['BTCUSDT', 'ETHBTC', 'USDCIDR', 'USDCTHB', 'USDCTRY', 'PAXGUSDT', 'USDCUSDT'];
let bnRetry = 0;
function bnConnect() {
  let ws;
  try { ws = new WebSocket(BN_WS + BN_SYMS.map(s => s.toLowerCase() + '@bookTicker').join('/')); } catch (e) { return setTimeout(bnConnect, 5000); }
  ws.onopen = () => { bnRetry = 0; status.bn = 'ok'; U.emit('feed-status'); };
  ws.onmessage = ev => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    const d = m.data; if (!d || !d.s) return;
    const mid = (+d.b + +d.a) / 2; status.bnT = Date.now();
    touch('b:' + d.s, mid, Date.now());
  };
  ws.onclose = () => { status.bn = 'down'; setTimeout(bnConnect, Math.min(30000, 1500 * Math.pow(2, bnRetry++))); };
  ws.onerror = () => { try { ws.close(); } catch (e) { /* */ } };
}
async function bnFetch(path) {
  let err;
  for (const base of BN_API) { try { const r = await fetch(base + path); if (r.ok) return await r.json(); err = new Error('HTTP ' + r.status); } catch (e) { err = e; } }
  throw err;
}
async function bnSnapshot() {
  try { const d = await bnFetch('/api/v3/ticker/bookTicker?symbols=' + encodeURIComponent(JSON.stringify(BN_SYMS))); const t = Date.now(); for (const x of d) if (!raw['b:' + x.symbol]) touch('b:' + x.symbol, (+x.bidPrice + +x.askPrice) / 2, t); } catch (e) { /* */ }
}

/* ---------- daily reference rates ---------- */
F.ref = {};
async function refRates() {
  let d = U.load('pt.exness.ref', null);
  if (!d || Date.now() - d.t > 6 * 3600e3) {
    try { const r = await fetch('https://open.er-api.com/v6/latest/USD'); const j = await r.json(); if (j && j.rates) { d = { t: Date.now(), r: j.rates }; U.save('pt.exness.ref', d); } } catch (e) { /* offline */ }
  }
  if (!d) return;
  const r = d.r; F.ref = r; const t = Date.now();
  touch('r:USDHKD', r.HKD, t); touch('r:EURDKK', r.DKK / r.EUR, t); touch('r:EURPLN', r.PLN / r.EUR, t); touch('r:USDMYR', r.MYR, t);
  for (const [k, c] of [['b:USDCIDR', 'IDR'], ['b:USDCTHB', 'THB'], ['b:USDCTRY', 'TRY']]) if (!raw[k] && r[c]) touch(k, r[c], t - 3600e3);
}

/* ---------- candle history ---------- */
const GT_RES = [1, 5, 15, 30, 60, 240, 1440];
const HL_RES = { 1: '1m', 3: '3m', 5: '5m', 15: '15m', 30: '30m', 60: '1h', 120: '2h', 240: '4h', 480: '8h', 720: '12h', 1440: '1d' };
const BN_RES = { 1: '1m', 3: '3m', 5: '5m', 15: '15m', 30: '30m', 60: '1h', 120: '2h', 240: '4h', 360: '6h', 480: '8h', 720: '12h', 1440: '1d' };
function baseRes(tfMin, avail) {
  if (tfMin >= 1440) return 1440;
  let best = 1;
  for (const r of avail) if (r <= tfMin && tfMin % r === 0) best = r;
  return best;
}
async function gtCandles(idx, res, from, to) {
  const r = await fetch(GT_API + '/charts/' + idx + '/' + Math.floor(from) + '/' + Math.floor(to) + '/' + res);
  const d = await r.json();
  const step = res * 60;
  const out = [];
  for (const c of d.table || []) {
    const t = Math.floor(c.time / 1000 / step) * step;
    if (out.length && out[out.length - 1].time === t) { const b = out[out.length - 1]; b.high = Math.max(b.high, c.high); b.low = Math.min(b.low, c.low); b.close = c.close; continue; }
    out.push({ time: t, open: c.open, high: c.high, low: c.low, close: c.close });
  }
  return out;
}
async function hlCandles(coin, res, from, to) {
  const out = [];
  let end = to * 1000; const start = from * 1000;
  for (let guard = 0; guard < 4 && end > start; guard++) {
    const r = await fetch(HL_API, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ type: 'candleSnapshot', req: { coin, interval: HL_RES[res], startTime: start, endTime: end } }) });
    const d = await r.json();
    if (!Array.isArray(d) || !d.length) break;
    const chunk = d.map(c => ({ time: Math.floor(c.t / 1000), open: +c.o, high: +c.h, low: +c.l, close: +c.c, volume: +c.v }));
    out.unshift(...chunk.filter(c => !out.length || c.time < out[0].time));
    if (d.length < 4900) break;
    end = d[0].t - 1;
  }
  const b = hl.basis[coin] || 0;
  if (b) for (const c of out) { c.open -= b; c.high -= b; c.low -= b; c.close -= b; }
  return out;
}
async function bnCandles(sym, res, from, to) {
  const out = []; let end = to * 1000; const start = from * 1000;
  for (let guard = 0; guard < 6 && end > start; guard++) {
    const d = await bnFetch('/api/v3/klines?symbol=' + sym + '&interval=' + BN_RES[res] + '&endTime=' + end + '&limit=1000');
    if (!d.length) break;
    const chunk = d.filter(k => k[0] >= start).map(k => ({ time: Math.floor(k[0] / 1000), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] }));
    out.unshift(...chunk);
    if (d.length < 1000 || d[0][0] <= start) break;
    end = d[0][0] - 1;
  }
  return out;
}
/* fetch one feed key's candles */
async function keyCandles(key, res, from, to) {
  if (key.startsWith('g:')) return gtCandles(+key.slice(2), res, from, to);
  if (key.startsWith('h:')) return hlCandles(key.slice(2), res, from, to);
  if (key.startsWith('b:')) return bnCandles(key.slice(2), res, from, to);
  if (key === 'w:XAU247') return x247Candles(res, from, to);
  return null; // r: constants
}
async function x247Candles(res, from, to) {
  const [x, p] = await Promise.all([gtCandles(90, res, from, to), bnCandles('PAXGUSDT', res, from, to).catch(() => [])]);
  if (!p.length) return x;
  const xt = new Map(x.map(c => [c.time, c]));
  const pm = new Map(p.map(c => [c.time, c]));
  const out = x.slice(); let xi = 0, ratio = null;
  const gold = S.map.XAUUSD;
  for (const c of p) {
    while (xi < x.length && x[xi].time <= c.time) { const pc = pm.get(x[xi].time); if (pc) ratio = x[xi].close / pc.close; xi++; }
    if (xt.has(c.time) || ratio == null) continue;
    if (res < 1440 && S.isOpenAt(gold, c.time * 1000)) continue; // only fill while gold itself is closed
    out.push({ time: c.time, open: c.open * ratio, high: c.high * ratio, low: c.low * ratio, close: c.close * ratio });
  }
  out.sort((a, b) => a.time - b.time);
  return out.filter((c, i) => i === 0 || c.time !== out[i - 1].time);
}
/* combine factor candles: P = prod(k^e) */
function combine(series, f) {
  if (series.length === 1 && f[0][1] === 1) return series[0];
  const maps = series.map(s => s && new Map(s.map(c => [c.time, c])));
  const base = series.find(Boolean);
  if (!base) return [];
  const out = [];
  const last = series.map(() => null);
  const times = Array.from(new Set([].concat(...series.filter(Boolean).map(s => s.map(c => c.time))))).sort((a, b) => a - b);
  for (const t of times) {
    let o = 1, c = 1, hi = 1, lo = 1, ok = true;
    for (let i = 0; i < f.length; i++) {
      const e = f[i][1];
      let bar;
      if (!maps[i]) { const v = raw[f[i][0]] ? raw[f[i][0]].p : null; if (!v) { ok = false; break; } bar = { open: v, high: v, low: v, close: v }; }
      else { bar = maps[i].get(t) || (last[i] ? { open: last[i].close, high: last[i].close, low: last[i].close, close: last[i].close } : null); if (maps[i].get(t)) last[i] = maps[i].get(t); }
      if (!bar) { ok = false; break; }
      if (e > 0) { o *= bar.open; c *= bar.close; hi *= bar.high; lo *= bar.low; }
      else { o /= bar.open; c /= bar.close; hi /= bar.low; lo /= bar.high; }
    }
    if (!ok) continue;
    const top = Math.max(o, c), bot = Math.min(o, c);
    out.push({ time: t, open: o, close: c, high: top + (hi - top) * 0.6, low: bot - (bot - lo) * 0.6 });
  }
  return out;
}
/* aggregate base bars into tf (seconds); D/W/M calendar aligned in UTC (weeks start Monday) */
function bucketOf(t, tf) {
  if (tf >= 2592000) { const d = new Date(t * 1000); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000; }
  if (tf === 604800) { const day = Math.floor(t / 86400); const wd = (day + 3) % 7; return (day - wd) * 86400; }
  return Math.floor(t / tf) * tf;
}
F.bucketOf = bucketOf;
function aggregate(bars, tf, baseSec) {
  if (tf === baseSec) return bars;
  const out = [];
  for (const b of bars) {
    const t = bucketOf(b.time, tf);
    const l = out[out.length - 1];
    if (l && l.time === t) { l.high = Math.max(l.high, b.high); l.low = Math.min(l.low, b.low); l.close = b.close; if (b.volume != null) l.volume = (l.volume || 0) + b.volume; }
    else out.push({ time: t, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume });
  }
  return out;
}
const histCache = new Map();
/* F.history(id, tfSec, {to, bars}) -> mid-price bars, oldest first */
F.history = async function (id, tf, opt) {
  opt = opt || {};
  const sym = S.map[id];
  const tfMin = Math.max(1, Math.round(tf / 60));
  const keys = sym.f.map(x => x[0]);
  const srcSets = keys.map(k => k.startsWith('g:') || k.startsWith('w:') ? GT_RES : k.startsWith('h:') ? Object.keys(HL_RES).map(Number) : k.startsWith('b:') ? Object.keys(BN_RES).map(Number) : null).filter(Boolean);
  const avail = srcSets.reduce((a, s) => a.filter(r => s.includes(r)), GT_RES.concat([3, 120, 360, 480, 720]).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b));
  const res = baseRes(tfMin, avail.length ? avail : [1]);
  const bars = opt.bars || (tf >= 2592000 ? 120 : tf >= 604800 ? 260 : 1500);
  const to = Math.floor((opt.to || Date.now() / 1000));
  let span = bars * tf;
  if (tf < 86400) span *= 1.45; // weekends / closed hours
  if (sym.hrs === 'stock') span *= tf < 86400 ? 3.6 : 1.4;
  const maxSpan = res === 1 ? 14 * 86400 : res === 5 ? 89 * 86400 : res <= 30 ? 89 * 86400 : res <= 240 ? 199 * 86400 : 3650 * 86400;
  if (opt.from) span = to - opt.from + tf;
  span = Math.min(span, maxSpan);
  const from = to - span;
  const ck = id + '|' + tf + '|' + to;
  if (histCache.has(ck)) return histCache.get(ck);
  const p = (async () => {
    const series = await Promise.all(sym.f.map(([k]) => keyCandles(k, res, from, to).catch(e => { console.warn('history', k, e); return []; })));
    const comb = combine(series, sym.f);
    return aggregate(comb, tf, res * 60);
  })();
  histCache.set(ck, p);
  setTimeout(() => histCache.delete(ck), 30000);
  return p;
};

/* ---------- daily open + simple trend signal (1h EMA 20/50) ---------- */
const stats = F.stats = {};
const statQ = []; let statBusy = 0;
F.needStats = id => {
  const s = stats[id]; const day = Math.floor(Date.now() / 86400000);
  if (s && (s.pending || (s.day === day && Date.now() - s.t < 30 * 60000))) return;
  stats[id] = Object.assign(s || {}, { pending: true });
  statQ.push(id); pumpStats();
};
function pumpStats() {
  while (statBusy < 4 && statQ.length) {
    const id = statQ.shift(); statBusy++;
    F.history(id, 3600, { bars: 80 }).then(b => {
      const day0 = Math.floor(Date.now() / 86400000) * 86400;
      const today = b.find(c => c.time >= day0);
      const prevClose = (b.filter(c => c.time < day0).pop() || {}).close;
      let e20 = null, e50 = null;
      for (const c of b) { e20 = e20 == null ? c.close : e20 + (c.close - e20) * 2 / 21; e50 = e50 == null ? c.close : e50 + (c.close - e50) * 2 / 51; }
      stats[id] = { open: today ? today.open : prevClose, sig: e20 != null && e50 != null ? (e20 > e50 ? 1 : -1) : 0, day: Math.floor(Date.now() / 86400000), t: Date.now(), pending: false };
      U.emit('stats', id);
    }).catch(() => { stats[id] = { pending: false, t: Date.now() - 25 * 60000, day: 0 }; }).finally(() => { statBusy--; pumpStats(); });
  }
}
F.change = id => { const q = Q[id], s = stats[id]; if (!q || q.mid == null || !s || !s.open) return null; return (q.mid / s.open - 1) * 100; };
/* client sentiment (buyers %), slow-moving and contrarian to the daily move */
F.sentiment = id => {
  let h = 0; for (const ch of id) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const hour = Math.floor(Date.now() / 3600000);
  const n = Math.sin(h * 0.37 + hour * 0.9) * 9 + Math.sin(h * 1.7 + hour * 0.23) * 6;
  const chg = F.change(id) || 0;
  return Math.round(U.clamp(57 + n - chg * 6, 14, 86));
};

/* ---------- start ---------- */
F.start = function () {
  refRates();
  gtSnapshot(); gtConnect();
  hlPoll(); hlConnect();
  bnSnapshot(); bnConnect();
  setInterval(gtSnapshot, 60000);
  setInterval(hlPoll, 12000);
  setInterval(refRates, 3600e3);
  setInterval(() => {
    const t = Date.now();
    const gt = status.gt === 'ok' && t - status.gtT < 15000 ? 'ok' : (t - status.gtT < 90000 ? 'slow' : 'down');
    if (gt !== F.health) { F.health = gt; U.emit('feed-status'); }
  }, 3000);
};
F.health = 'init';
})();
