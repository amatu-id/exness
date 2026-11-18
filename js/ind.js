/* Amatu Trade — technical indicators (overlays + oscillator panes), legend, settings dialog, custom scripts */
(function () {
'use strict';
const AT = window.AT, U = AT.U;
const L = window.LightweightCharts;
const I = AT.I = {};
const K_IND = 'exness.ind', K_SCR = 'exness.scripts';

/* ---------- math ---------- */
const nan = n => new Array(n).fill(NaN);
const M = I.M = {
  sma(a, n) { const o = nan(a.length); let s = 0, c = 0; for (let i = 0; i < a.length; i++) { const v = a[i]; if (!isNaN(v)) { s += v; c++; } if (i >= n) { const w = a[i - n]; if (!isNaN(w)) { s -= w; c--; } } if (i >= n - 1 && c === n) o[i] = s / n; } return o; },
  ema(a, n) { const o = nan(a.length); const k = 2 / (n + 1); let e = NaN, c = 0, s = 0; for (let i = 0; i < a.length; i++) { const v = a[i]; if (isNaN(v)) continue; if (isNaN(e)) { s += v; c++; if (c === n) { e = s / n; o[i] = e; } } else { e = v * k + e * (1 - k); o[i] = e; } } return o; },
  rma(a, n) { const o = nan(a.length); let e = NaN, c = 0, s = 0; for (let i = 0; i < a.length; i++) { const v = a[i]; if (isNaN(v)) continue; if (isNaN(e)) { s += v; c++; if (c === n) { e = s / n; o[i] = e; } } else { e = (e * (n - 1) + v) / n; o[i] = e; } } return o; },
  wma(a, n) { const o = nan(a.length); const d = n * (n + 1) / 2; for (let i = n - 1; i < a.length; i++) { let s = 0; for (let j = 0; j < n; j++) s += a[i - j] * (n - j); o[i] = s / d; } return o; },
  stdev(a, n) { const m = M.sma(a, n); const o = nan(a.length); for (let i = n - 1; i < a.length; i++) { let s = 0; for (let j = 0; j < n; j++) s += (a[i - j] - m[i]) ** 2; o[i] = Math.sqrt(s / n); } return o; },
  highest(a, n) { const o = nan(a.length); for (let i = n - 1; i < a.length; i++) { let m = -Infinity; for (let j = 0; j < n; j++) m = Math.max(m, a[i - j]); o[i] = m; } return o; },
  lowest(a, n) { const o = nan(a.length); for (let i = n - 1; i < a.length; i++) { let m = Infinity; for (let j = 0; j < n; j++) m = Math.min(m, a[i - j]); o[i] = m; } return o; },
  tr(b) { return b.map((x, i) => i ? Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close)) : x.high - x.low); },
  rsi(a, n) { const up = [], dn = []; for (let i = 0; i < a.length; i++) { const d = i ? a[i] - a[i - 1] : NaN; up.push(isNaN(d) ? NaN : Math.max(d, 0)); dn.push(isNaN(d) ? NaN : Math.max(-d, 0)); } const u = M.rma(up, n), w = M.rma(dn, n); return u.map((v, i) => isNaN(v) || isNaN(w[i]) ? NaN : w[i] === 0 ? 100 : 100 - 100 / (1 + v / w[i])); },
  sub: (a, b) => a.map((v, i) => v - b[i]), add: (a, b) => a.map((v, i) => v + b[i]), mul: (a, k) => a.map(v => v * k),
  src(b, s) { return b.map(x => s === 'open' ? x.open : s === 'high' ? x.high : s === 'low' ? x.low : s === 'hl2' ? (x.high + x.low) / 2 : s === 'hlc3' ? (x.high + x.low + x.close) / 3 : s === 'ohlc4' ? (x.open + x.high + x.low + x.close) / 4 : x.close); }
};
const SRC = ['close', 'open', 'high', 'low', 'hl2', 'hlc3', 'ohlc4'];

/* ---------- definitions ---------- */
const D = I.DEFS = {
  sma: { n: 'Moving Average', s: 'MA', ov: 1, g: 'Trend', inp: [['len', 'Length', 9], ['src', 'Source', 'close', SRC]], pl: [['ma', 'MA', '#2962FF']], f: (b, p) => ({ ma: M.sma(M.src(b, p.src), p.len) }) },
  ema: { n: 'Moving Average Exponential', s: 'EMA', ov: 1, g: 'Trend', inp: [['len', 'Length', 9], ['src', 'Source', 'close', SRC]], pl: [['ma', 'EMA', '#FF6D00']], f: (b, p) => ({ ma: M.ema(M.src(b, p.src), p.len) }) },
  wma: { n: 'Moving Average Weighted', s: 'WMA', ov: 1, g: 'Trend', inp: [['len', 'Length', 9], ['src', 'Source', 'close', SRC]], pl: [['ma', 'WMA', '#E91E63']], f: (b, p) => ({ ma: M.wma(M.src(b, p.src), p.len) }) },
  bb: { n: 'Bollinger Bands', s: 'BB', ov: 1, g: 'Volatility', inp: [['len', 'Length', 20], ['mult', 'StdDev', 2], ['src', 'Source', 'close', SRC]], pl: [['mid', 'Basis', '#FF6D00'], ['up', 'Upper', '#2962FF'], ['lo', 'Lower', '#2962FF']], fill: [['up', 'lo', 'rgba(41,98,255,0.06)']],
    f: (b, p) => { const s = M.src(b, p.src); const m = M.sma(s, p.len), d = M.stdev(s, p.len); return { mid: m, up: m.map((v, i) => v + p.mult * d[i]), lo: m.map((v, i) => v - p.mult * d[i]) }; } },
  env: { n: 'Envelopes', s: 'Env', ov: 1, g: 'Trend', inp: [['len', 'Length', 20], ['pct', 'Percent', 1]], pl: [['mid', 'Basis', '#FF6D00'], ['up', 'Upper', '#2962FF'], ['lo', 'Lower', '#2962FF']], fill: [['up', 'lo', 'rgba(41,98,255,0.05)']],
    f: (b, p) => { const m = M.sma(M.src(b, 'close'), p.len); return { mid: m, up: m.map(v => v * (1 + p.pct / 100)), lo: m.map(v => v * (1 - p.pct / 100)) }; } },
  dc: { n: 'Donchian Channels', s: 'DC', ov: 1, g: 'Volatility', inp: [['len', 'Length', 20]], pl: [['up', 'Upper', '#2962FF'], ['mid', 'Basis', '#FF6D00'], ['lo', 'Lower', '#2962FF']], fill: [['up', 'lo', 'rgba(41,98,255,0.05)']],
    f: (b, p) => { const h = M.highest(b.map(x => x.high), p.len), l = M.lowest(b.map(x => x.low), p.len); return { up: h, lo: l, mid: h.map((v, i) => (v + l[i]) / 2) }; } },
  kc: { n: 'Keltner Channels', s: 'KC', ov: 1, g: 'Volatility', inp: [['len', 'Length', 20], ['mult', 'Multiplier', 2]], pl: [['up', 'Upper', '#2962FF'], ['mid', 'Basis', '#2962FF'], ['lo', 'Lower', '#2962FF']], fill: [['up', 'lo', 'rgba(41,98,255,0.05)']],
    f: (b, p) => { const m = M.ema(M.src(b, 'close'), p.len), a = M.ema(M.tr(b), p.len); return { mid: m, up: m.map((v, i) => v + p.mult * a[i]), lo: m.map((v, i) => v - p.mult * a[i]) }; } },
  ichi: { n: 'Ichimoku Cloud', s: 'Ichimoku', ov: 1, g: 'Trend', inp: [['c', 'Conversion Line Length', 9], ['b', 'Base Line Length', 26], ['s', 'Leading Span B Length', 52], ['d', 'Lagging Span', 26]],
    pl: [['conv', 'Conversion Line', '#2962FF'], ['base', 'Base Line', '#B71C1C'], ['lag', 'Lagging Span', '#43A047'], ['a', 'Leading Span A', '#A5D6A7'], ['bb', 'Leading Span B', '#EF9A9A']], fill: [['a', 'bb', 'rgba(67,160,71,0.10)']],
    f: (b, p) => { const H = b.map(x => x.high), Lw = b.map(x => x.low); const dc = n => { const h = M.highest(H, n), l = M.lowest(Lw, n); return h.map((v, i) => (v + l[i]) / 2); }; const conv = dc(p.c), base = dc(p.b), sb = dc(p.s); const n = b.length; const sh = (a, k) => { const o = nan(n); for (let i = 0; i < n; i++) { const j = i - k; if (j >= 0 && j < n) o[i] = a[j]; } return o; }; return { conv, base, a: sh(conv.map((v, i) => (v + base[i]) / 2), p.d - 1), bb: sh(sb, p.d - 1), lag: sh(b.map(x => x.close), -(p.d - 1)) }; } },
  psar: { n: 'Parabolic SAR', s: 'SAR', ov: 1, g: 'Trend', inp: [['st', 'Start', 0.02], ['inc', 'Increment', 0.02], ['mx', 'Maximum', 0.2]], pl: [['sar', 'ParabolicSAR', '#2962FF', 'dots']],
    f: (b, p) => { const n = b.length, o = nan(n); if (n < 3) return { sar: o }; let up = b[1].close >= b[0].close, af = p.st, ep = up ? b[0].high : b[0].low, sar = up ? b[0].low : b[0].high; for (let i = 1; i < n; i++) { sar = sar + af * (ep - sar); if (up) { sar = Math.min(sar, b[i - 1].low, i > 1 ? b[i - 2].low : b[i - 1].low); if (b[i].low < sar) { up = false; sar = ep; ep = b[i].low; af = p.st; } else if (b[i].high > ep) { ep = b[i].high; af = Math.min(af + p.inc, p.mx); } } else { sar = Math.max(sar, b[i - 1].high, i > 1 ? b[i - 2].high : b[i - 1].high); if (b[i].high > sar) { up = true; sar = ep; ep = b[i].high; af = p.st; } else if (b[i].low < ep) { ep = b[i].low; af = Math.min(af + p.inc, p.mx); } } o[i] = sar; } return { sar: o }; } },
  st: { n: 'Supertrend', s: 'Supertrend', ov: 1, g: 'Trend', inp: [['len', 'ATR Length', 10], ['mult', 'Factor', 3]], pl: [['st', 'Supertrend', '#089981']],
    f: (b, p) => { const a = M.rma(M.tr(b), p.len); const n = b.length, o = nan(n), col = new Array(n); let fu = NaN, fl = NaN, dir = 1; for (let i = 0; i < n; i++) { if (isNaN(a[i])) continue; const m = (b[i].high + b[i].low) / 2; const bu = m + p.mult * a[i], bl = m - p.mult * a[i]; const pc = i ? b[i - 1].close : b[i].close; fu = isNaN(fu) || bu < fu || pc > fu ? bu : fu; fl = isNaN(fl) || bl > fl || pc < fl ? bl : fl; if (dir === 1 && b[i].close < fl) dir = -1; else if (dir === -1 && b[i].close > fu) dir = 1; o[i] = dir === 1 ? fl : fu; col[i] = dir === 1 ? '#089981' : '#F23645'; } return { st: o, _col: { st: col } }; } },
  pivot: { n: 'Pivot Points Standard', s: 'Pivots', ov: 1, g: 'Trend', inp: [], pl: [['p', 'P', '#FF9800', 'step'], ['r1', 'R1', '#F23645', 'step'], ['r2', 'R2', '#F23645', 'step'], ['s1', 'S1', '#089981', 'step'], ['s2', 'S2', '#089981', 'step']],
    f: b => { const n = b.length; const o = { p: nan(n), r1: nan(n), r2: nan(n), s1: nan(n), s2: nan(n) }; let day = null, H = -Infinity, Lw = Infinity, Cc = NaN, cur = null; for (let i = 0; i < n; i++) { const d = Math.floor(b[i].time / 86400); if (d !== day) { if (day != null) { const P = (H + Lw + Cc) / 3; cur = { p: P, r1: 2 * P - Lw, s1: 2 * P - H, r2: P + (H - Lw), s2: P - (H - Lw) }; } day = d; H = -Infinity; Lw = Infinity; } H = Math.max(H, b[i].high); Lw = Math.min(Lw, b[i].low); Cc = b[i].close; if (cur) for (const k in cur) o[k][i] = cur[k]; } return o; } },
  zz: { n: 'ZigZag', s: 'ZigZag', ov: 1, g: 'Trend', inp: [['dev', 'Deviation (%)', 0.5], ['depth', 'Depth', 10]], pl: [['z', 'ZigZag', '#2962FF', 'sparse']], repaint: 1,
    f: (b, p) => { const n = b.length, o = nan(n); if (!n) return { z: o }; let dir = 0, pi = 0, pv = b[0].close; for (let i = 1; i < n; i++) { const hi = b[i].high, lo = b[i].low; if (dir >= 0 && hi >= pv) { if (dir === 1) { pi = i; pv = hi; } else if ((hi - pv) / pv * 100 >= p.dev && i - pi >= 1) { o[pi] = pv; dir = 1; pi = i; pv = hi; } } if (dir <= 0 && lo <= pv) { if (dir === -1) { pi = i; pv = lo; } else if ((pv - lo) / pv * 100 >= p.dev && i - pi >= 1) { o[pi] = pv; dir = -1; pi = i; pv = lo; } } if (dir === 1 && (pv - lo) / pv * 100 >= p.dev && i - pi >= p.depth / 3) { o[pi] = pv; dir = -1; pi = i; pv = lo; } else if (dir === -1 && (hi - pv) / pv * 100 >= p.dev && i - pi >= p.depth / 3) { o[pi] = pv; dir = 1; pi = i; pv = hi; } } o[pi] = pv; return { z: o }; } },
  alli: { n: 'Williams Alligator', s: 'Alligator', ov: 1, g: 'Trend', inp: [['j', 'Jaw Length', 13], ['t', 'Teeth Length', 8], ['l', 'Lips Length', 5]], pl: [['jaw', 'Jaw', '#2962FF'], ['teeth', 'Teeth', '#E91E63'], ['lips', 'Lips', '#66BB6A']],
    f: (b, p) => { const m = M.src(b, 'hl2'); return { jaw: M.rma(m, p.j), teeth: M.rma(m, p.t), lips: M.rma(m, p.l) }; } },
  rsi: { n: 'Relative Strength Index', s: 'RSI', g: 'Oscillators', inp: [['len', 'Length', 14], ['src', 'Source', 'close', SRC]], pl: [['r', 'RSI', '#7E57C2']], lv: [[70, 'rgba(120,123,134,0.6)'], [50, 'rgba(120,123,134,0.35)'], [30, 'rgba(120,123,134,0.6)']], band: [70, 30, 'rgba(126,87,194,0.08)'], rng: [0, 100],
    f: (b, p) => ({ r: M.rsi(M.src(b, p.src), p.len) }) },
  macd: { n: 'MACD', s: 'MACD', g: 'Oscillators', inp: [['f', 'Fast Length', 12], ['sl', 'Slow Length', 26], ['sig', 'Signal Smoothing', 9], ['src', 'Source', 'close', SRC]], pl: [['h', 'Histogram', '#26A69A', 'hist'], ['m', 'MACD', '#2962FF'], ['s', 'Signal', '#FF6D00']], lv: [[0, 'rgba(120,123,134,0.4)']],
    f: (b, p) => { const s = M.src(b, p.src); const m = M.sub(M.ema(s, p.f), M.ema(s, p.sl)); const sg = M.ema(m, p.sig); const h = m.map((v, i) => v - sg[i]); return { m, s: sg, h, _col: { h: h.map((v, i) => v >= 0 ? (i && v < h[i - 1] ? '#B2DFDB' : '#26A69A') : (i && v > h[i - 1] ? '#FFCDD2' : '#FF5252')) } }; } },
  stoch: { n: 'Stochastic', s: 'Stoch', g: 'Oscillators', inp: [['k', '%K Length', 14], ['ks', '%K Smoothing', 1], ['d', '%D Smoothing', 3]], pl: [['k', '%K', '#2962FF'], ['d', '%D', '#FF6D00']], lv: [[80, 'rgba(120,123,134,0.6)'], [20, 'rgba(120,123,134,0.6)']], band: [80, 20, 'rgba(33,150,243,0.07)'], rng: [0, 100],
    f: (b, p) => { const h = M.highest(b.map(x => x.high), p.k), l = M.lowest(b.map(x => x.low), p.k); const raw = b.map((x, i) => (h[i] - l[i]) ? (x.close - l[i]) / (h[i] - l[i]) * 100 : 50); const k = M.sma(raw, p.ks); return { k, d: M.sma(k, p.d) }; } },
  srsi: { n: 'Stochastic RSI', s: 'Stoch RSI', g: 'Oscillators', inp: [['k', 'K', 3], ['d', 'D', 3], ['r', 'RSI Length', 14], ['s', 'Stochastic Length', 14]], pl: [['k', 'K', '#2962FF'], ['d', 'D', '#FF6D00']], lv: [[80, 'rgba(120,123,134,0.6)'], [20, 'rgba(120,123,134,0.6)']], band: [80, 20, 'rgba(33,150,243,0.07)'], rng: [0, 100],
    f: (b, p) => { const r = M.rsi(M.src(b, 'close'), p.r); const h = M.highest(r, p.s), l = M.lowest(r, p.s); const st = r.map((v, i) => (h[i] - l[i]) ? (v - l[i]) / (h[i] - l[i]) * 100 : NaN); const k = M.sma(st, p.k); return { k, d: M.sma(k, p.d) }; } },
  atr: { n: 'Average True Range', s: 'ATR', g: 'Volatility', inp: [['len', 'Length', 14]], pl: [['a', 'ATR', '#B71C1C']], f: (b, p) => ({ a: M.rma(M.tr(b), p.len) }) },
  adx: { n: 'Average Directional Index', s: 'ADX', g: 'Oscillators', inp: [['len', 'ADX Smoothing', 14], ['di', 'DI Length', 14]], pl: [['adx', 'ADX', '#FF5252'], ['p', '+DI', '#2962FF'], ['m', '−DI', '#FF6D00']],
    f: (b, p) => { const n = b.length; const pd = nan(n), md = nan(n); for (let i = 1; i < n; i++) { const u = b[i].high - b[i - 1].high, d = b[i - 1].low - b[i].low; pd[i] = u > d && u > 0 ? u : 0; md[i] = d > u && d > 0 ? d : 0; } const tr = M.rma(M.tr(b), p.di); const P = M.rma(pd, p.di).map((v, i) => 100 * v / tr[i]), Mi = M.rma(md, p.di).map((v, i) => 100 * v / tr[i]); const dx = P.map((v, i) => (v + Mi[i]) ? 100 * Math.abs(v - Mi[i]) / (v + Mi[i]) : NaN); return { adx: M.rma(dx, p.len), p: P, m: Mi }; } },
  cci: { n: 'Commodity Channel Index', s: 'CCI', g: 'Oscillators', inp: [['len', 'Length', 20]], pl: [['c', 'CCI', '#2962FF']], lv: [[100, 'rgba(120,123,134,0.6)'], [0, 'rgba(120,123,134,0.35)'], [-100, 'rgba(120,123,134,0.6)']], band: [100, -100, 'rgba(33,150,243,0.07)'],
    f: (b, p) => { const tp = M.src(b, 'hlc3'); const m = M.sma(tp, p.len); const o = nan(b.length); for (let i = p.len - 1; i < b.length; i++) { let md = 0; for (let j = 0; j < p.len; j++) md += Math.abs(tp[i - j] - m[i]); md /= p.len; o[i] = md ? (tp[i] - m[i]) / (0.015 * md) : 0; } return { c: o }; } },
  wpr: { n: 'Williams %R', s: '%R', g: 'Oscillators', inp: [['len', 'Length', 14]], pl: [['r', '%R', '#7E57C2']], lv: [[-20, 'rgba(120,123,134,0.6)'], [-80, 'rgba(120,123,134,0.6)']], band: [-20, -80, 'rgba(126,87,194,0.07)'], rng: [-100, 0],
    f: (b, p) => { const h = M.highest(b.map(x => x.high), p.len), l = M.lowest(b.map(x => x.low), p.len); return { r: b.map((x, i) => (h[i] - l[i]) ? (x.close - h[i]) / (h[i] - l[i]) * 100 : NaN) }; } },
  mom: { n: 'Momentum', s: 'Mom', g: 'Oscillators', inp: [['len', 'Length', 10]], pl: [['m', 'Momentum', '#2962FF']], f: (b, p) => ({ m: b.map((x, i) => i >= p.len ? x.close - b[i - p.len].close : NaN) }) },
  roc: { n: 'Rate Of Change', s: 'ROC', g: 'Oscillators', inp: [['len', 'Length', 9]], pl: [['r', 'ROC', '#2962FF']], lv: [[0, 'rgba(120,123,134,0.4)']], f: (b, p) => ({ r: b.map((x, i) => i >= p.len ? (x.close / b[i - p.len].close - 1) * 100 : NaN) }) },
  ao: { n: 'Awesome Oscillator', s: 'AO', g: 'Oscillators', inp: [], pl: [['a', 'AO', '#089981', 'hist']], f: b => { const m = M.src(b, 'hl2'); const a = M.sub(M.sma(m, 5), M.sma(m, 34)); return { a, _col: { a: a.map((v, i) => i && v >= a[i - 1] ? '#089981' : '#F23645') } }; } },
  aroon: { n: 'Aroon', s: 'Aroon', g: 'Oscillators', inp: [['len', 'Length', 14]], pl: [['u', 'Aroon Up', '#FB8C00'], ['d', 'Aroon Down', '#2962FF']], rng: [0, 100],
    f: (b, p) => { const n = b.length, u = nan(n), d = nan(n); for (let i = p.len; i < n; i++) { let hi = -Infinity, hiI = 0, lo = Infinity, loI = 0; for (let j = 0; j <= p.len; j++) { const x = b[i - j]; if (x.high >= hi) { hi = x.high; hiI = j; } if (x.low <= lo) { lo = x.low; loI = j; } } u[i] = 100 * (p.len - hiI) / p.len; d[i] = 100 * (p.len - loI) / p.len; } return { u, d }; } },
  sd: { n: 'Standard Deviation', s: 'StdDev', g: 'Volatility', inp: [['len', 'Length', 20]], pl: [['s', 'StdDev', '#2962FF']], f: (b, p) => ({ s: M.stdev(M.src(b, 'close'), p.len) }) },
  vol: { n: 'Volume', s: 'Vol', g: 'Volume', inp: [['ma', 'MA Length', 20]], pl: [['v', 'Volume', '#26A69A', 'hist'], ['m', 'Volume MA', '#2962FF']],
    f: (b, p) => { const v = b.map(x => x.volume != null ? x.volume : NaN); return { v, m: M.sma(v, p.ma), _col: { v: b.map(x => x.close >= x.open ? 'rgba(21,139,249,0.5)' : 'rgba(235,72,63,0.5)') } }; } }
};
const ORDER = ['sma', 'ema', 'wma', 'bb', 'ichi', 'psar', 'st', 'env', 'dc', 'kc', 'pivot', 'zz', 'alli', 'rsi', 'macd', 'stoch', 'srsi', 'atr', 'adx', 'cci', 'wpr', 'mom', 'roc', 'ao', 'aroon', 'sd', 'vol'];

/* ---------- custom scripts ---------- */
I.scripts = U.load(K_SCR, []) || [];
I.saveScripts = () => U.save(K_SCR, I.scripts);
I.runScript = function (code, bars) {
  const plots = [], levels = []; let overlay = false; const inputs = {};
  const open = bars.map(b => b.open), high = bars.map(b => b.high), low = bars.map(b => b.low), close = bars.map(b => b.close), time = bars.map(b => b.time), volume = bars.map(b => b.volume || 0);
  const api = {
    open, high, low, close, time, volume, bars,
    sma: M.sma, ema: M.ema, wma: M.wma, rma: M.rma, rsi: M.rsi, stdev: M.stdev, highest: M.highest, lowest: M.lowest, atr: n => M.rma(M.tr(bars), n), tr: () => M.tr(bars),
    input: (name, def) => (inputs[name] = def),
    plot: (series, title, color, width) => plots.push({ s: series, t: title || 'Plot ' + (plots.length + 1), c: color || ['#2962FF', '#FF6D00', '#089981', '#E91E63'][plots.length % 4], w: width || 2 }),
    histogram: (series, title, color) => plots.push({ s: series, t: title || 'Histogram', c: color || '#26A69A', hist: true }),
    hline: (v, color) => levels.push([v, color || 'rgba(120,123,134,0.6)']),
    overlay: (v) => { overlay = v !== false; },
    crossover: (a, b, i) => a[i - 1] <= b[i - 1] && a[i] > b[i], crossunder: (a, b, i) => a[i - 1] >= b[i - 1] && a[i] < b[i],
    na: NaN, Math
  };
  const fn = new Function(...Object.keys(api), '"use strict";\n' + code);
  fn(...Object.values(api));
  return { plots, levels, overlay };
};

/* ---------- instances ---------- */
I.list = U.load(K_IND, null);
if (!Array.isArray(I.list)) I.list = [];
const save = () => U.save(K_IND, I.list.map(x => ({ id: x.id, k: x.k, p: x.p, st: x.st, hd: x.hd, code: x.code, name: x.name })));
let ch = null;
const live = new Map(); // id -> {series:{key:api}, pane, lines:[]}

function defOf(x) {
  if (x.k !== 'script') return D[x.k];
  return { n: x.name || 'Script', s: x.name || 'Script', g: 'Custom', inp: [], pl: [], script: true };
}
I.add = function (k, opt) {
  opt = opt || {};
  const def = D[k]; if (!def && k !== 'script') return;
  const x = { id: U.uid(), k, p: {}, st: {}, hd: false };
  if (def) for (const [key, , v] of def.inp) x.p[key] = v;
  if (opt.p) Object.assign(x.p, opt.p);
  if (k === 'script') { x.code = opt.code; x.name = opt.name; }
  I.list.push(x); save();
  if (ch) build(ch, x);
  pushUndo('add', x);
  U.emit('ind');
  return x;
};
I.remove = function (id, noUndo) {
  const i = I.list.findIndex(x => x.id === id); if (i < 0) return;
  const x = I.list[i]; I.list.splice(i, 1); save();
  destroy(id);
  if (!noUndo) pushUndo('remove', x, i);
  U.emit('ind'); if (ch) ch.renderLegend();
};
I.removeAll = function () { for (const x of I.list.slice()) I.remove(x.id, true); };
function pushUndo(kind, x, i) {
  if (!AT.undo) return;
  const snap = JSON.parse(JSON.stringify(x));
  if (kind === 'add') AT.undo.push({ undo: () => I.remove(snap.id, true), redo: () => { I.list.push(JSON.parse(JSON.stringify(snap))); save(); if (ch) build(ch, I.list[I.list.length - 1]); U.emit('ind'); } });
  else AT.undo.push({ undo: () => { I.list.splice(Math.min(i, I.list.length), 0, JSON.parse(JSON.stringify(snap))); save(); if (ch) I.recalc(ch, true); U.emit('ind'); }, redo: () => I.remove(snap.id, true) });
}
function destroy(id) {
  const lv = live.get(id); if (!lv || !ch) return;
  for (const k in lv.series) try { ch.chart.removeSeries(lv.series[k]); } catch (e) { /* */ }
  live.delete(id);
  cleanPanes();
}
function cleanPanes() {
  if (!ch) return;
  const panes = ch.chart.panes();
  for (let i = panes.length - 1; i >= 1; i--) if (!panes[i].getSeries().length) try { ch.chart.removePane(i); } catch (e) { /* */ }
  sizePanes(ch);
}
/* main pane keeps most of the height, each oscillator pane gets an equal share */
function sizePanes(c) {
  const ps = c.chart.panes(); if (ps.length < 2) return;
  const n = ps.length - 1;
  try { ps[0].setStretchFactor(n === 1 ? 3 : n === 2 ? 2.4 : 2); for (let i = 1; i < ps.length; i++) ps[i].setStretchFactor(1); }
  catch (e) { const H = c.el.clientHeight; for (let i = 1; i < ps.length; i++) try { ps[i].setHeight(Math.max(70, Math.round(H * 0.18))); } catch (er) { /* */ } }
}
function values(x, bars) {
  const def = defOf(x);
  if (def.script) {
    try { const r = I.runScript(x.code || '', bars); x._err = null; x._sp = r; const o = {}; r.plots.forEach((p, i) => { o['p' + i] = p.s; }); return o; }
    catch (e) { x._err = String(e.message || e); x._sp = { plots: [], levels: [], overlay: false }; return {}; }
  }
  return def.f(bars, x.p);
}
function plotsOf(x) {
  const def = defOf(x);
  if (def.script) { const sp = x._sp || { plots: [] }; return sp.plots.map((p, i) => ['p' + i, p.t, p.c, p.hist ? 'hist' : 'line', p.w]); }
  return def.pl;
}
function isOverlay(x) { const def = defOf(x); return def.script ? !!(x._sp && x._sp.overlay) : !!def.ov; }
function build(c, x) {
  destroy(x.id);
  if (x.hd) return;
  const bars = c.vb; if (!bars.length) return;
  const vals = values(x, bars);
  const def = defOf(x);
  const ov = isOverlay(x);
  const pane = ov ? 0 : c.chart.panes().length;
  const series = {};
  const sh = ov ? c.shift : 0;
  const dg = ov ? c.sObj.dg : 2;
  for (const pl of plotsOf(x)) {
    const [key, title, color, type, width] = pl;
    const st = x.st[key] || {};
    if (st.v === false) continue;
    const col = st.c || color;
    const common = { priceLineVisible: false, lastValueVisible: true, title: '', priceFormat: { type: 'price', precision: dg, minMove: Math.pow(10, -dg) }, crosshairMarkerVisible: type !== 'dots' };
    let s;
    if (type === 'hist') s = c.chart.addSeries(L.HistogramSeries, Object.assign(common, { color: col }), pane);
    else s = c.chart.addSeries(L.LineSeries, Object.assign(common, { color: col, lineWidth: st.w || width || (type === 'dots' ? 2 : 1.5), lineType: type === 'step' ? 1 : 0, lineStyle: 0, pointMarkersVisible: type === 'dots', pointMarkersRadius: 1.6, lineVisible: type !== 'dots' }), pane);
    series[key] = s;
  }
  const lv = { series, pane, ov, sh };
  live.set(x.id, lv);
  setAll(c, x, vals);
  const first = series[Object.keys(series)[0]];
  if (first && !ov) {
    for (const [v, col] of (def.lv || (x._sp ? x._sp.levels : []) || [])) first.createPriceLine({ price: v, color: col, lineWidth: 1, lineStyle: 2, axisLabelVisible: false });
    if (def.rng) first.applyOptions({ autoscaleInfoProvider: () => ({ priceRange: { minValue: def.rng[0], maxValue: def.rng[1] } }) });
    sizePanes(c);
  }
  if (def.fill || def.band) attachFill(c, x, lv, vals);
}
function toData(c, arr, sh, colors, type) {
  const b = c.vb, out = [];
  for (let i = 0; i < b.length; i++) {
    const v = arr[i];
    if (v == null || isNaN(v)) { if (type !== 'sparse') out.push({ time: b[i].time + c.off }); continue; }
    const p = { time: b[i].time + c.off, value: v + sh };
    if (colors && colors[i]) p.color = colors[i];
    out.push(p);
  }
  return out;
}
function setAll(c, x, vals) {
  const lv = live.get(x.id); if (!lv) return;
  const cols = vals._col || {};
  for (const pl of plotsOf(x)) { const s = lv.series[pl[0]]; if (!s || !vals[pl[0]]) continue; s.setData(toData(c, vals[pl[0]], lv.sh, cols[pl[0]], pl[3])); }
  lv.vals = vals;
  if (lv.fill) lv.fill.set(vals);
}
/* fill between two plots (bands) or between fixed levels */
function attachFill(c, x, lv, vals) {
  const def = defOf(x);
  const host = lv.series[Object.keys(lv.series)[0]]; if (!host) return;
  const prim = {
    vals, set(v) { this.vals = v; if (this.req) this.req(); },
    attached(p) { this.req = p.requestUpdate; }, detached() { this.req = null; }, updateAllViews() { },
    paneViews() { return [{ zOrder: () => 'bottom', renderer: () => ({ draw: t => drawFill(t, c, x, lv, def, prim.vals) }) }]; }
  };
  host.attachPrimitive(prim);
  lv.fill = prim;
}
function drawFill(target, c, x, lv, def, vals) {
  target.useMediaCoordinateSpace(({ context: g, mediaSize }) => {
    const s0 = lv.series[Object.keys(lv.series)[0]]; if (!s0) return;
    if (def.band) {
      const y1 = s0.priceToCoordinate(def.band[0]), y2 = s0.priceToCoordinate(def.band[1]);
      if (y1 != null && y2 != null) { g.fillStyle = def.band[2]; g.fillRect(0, Math.min(y1, y2), mediaSize.width, Math.abs(y2 - y1)); }
    }
    if (def.fill) for (const [k1, k2, col] of def.fill) {
      const A = vals[k1], B = vals[k2]; if (!A || !B) continue;
      const ts = c.chart.timeScale(); const r = ts.getVisibleLogicalRange(); if (!r) continue;
      const from = Math.max(0, Math.floor(r.from) - 1), to = Math.min(c.vb.length - 1, Math.ceil(r.to) + 1);
      g.fillStyle = (x.st._fill && x.st._fill.c) || col; g.beginPath();
      let started = false; const back = [];
      for (let i = from; i <= to; i++) {
        if (isNaN(A[i]) || isNaN(B[i])) { if (started) { for (let j = back.length - 1; j >= 0; j--) g.lineTo(back[j][0], back[j][1]); g.closePath(); started = false; back.length = 0; } continue; }
        const xx = ts.logicalToCoordinate(i); const ya = s0.priceToCoordinate(A[i] + lv.sh), yb = s0.priceToCoordinate(B[i] + lv.sh);
        if (xx == null || ya == null || yb == null) continue;
        if (!started) { g.moveTo(xx, ya); started = true; } else g.lineTo(xx, ya);
        back.push([xx, yb]);
      }
      if (started) { for (let j = back.length - 1; j >= 0; j--) g.lineTo(back[j][0], back[j][1]); g.closePath(); }
      g.fill();
    }
  });
}

/* ---------- chart hooks ---------- */
I.recalc = function (c) { ch = c; for (const id of Array.from(live.keys())) destroy(id); for (const x of I.list) build(c, x); cleanPanes(); };
I.restyle = c => I.recalc(c);
I.onTick = function (c, added) {
  if (!live.size) return;
  for (const x of I.list) {
    const lv = live.get(x.id); if (!lv) continue;
    const def = defOf(x);
    const vals = values(x, c.vb);
    if (added || def.repaint || def.script) { setAll(c, x, vals); continue; }
    const i = c.vb.length - 1, b = c.vb[i]; const cols = vals._col || {};
    for (const pl of plotsOf(x)) {
      const s = lv.series[pl[0]]; const arr = vals[pl[0]]; if (!s || !arr) continue;
      const v = arr[i]; if (v == null || isNaN(v)) continue;
      const p = { time: b.time + c.off, value: v + lv.sh }; if (cols[pl[0]] && cols[pl[0]][i]) p.color = cols[pl[0]][i];
      try { s.update(p); } catch (e) { setAll(c, x, vals); break; }
    }
    lv.vals = vals; if (lv.fill) lv.fill.set(vals);
  }
};
I.legendHTML = function (c, tHover) {
  let main = '', idx = -1;
  if (tHover != null) idx = c.vb.findIndex(b => b.time === tHover);
  if (idx < 0) idx = c.vb.length - 1;
  const fmt = (v, dg) => (v == null || isNaN(v) ? '∅' : U.fmt(v, dg));
  const panes = {};
  for (const x of I.list) {
    const def = defOf(x); const lv = live.get(x.id); const ov = lv ? lv.ov : isOverlay(x);
    const args = def.inp ? def.inp.map(i => x.p[i[0]]).filter(v => typeof v !== 'string' || v !== 'close').join(' ') : '';
    let vals = '';
    if (lv && lv.vals) for (const pl of plotsOf(x)) { if ((x.st[pl[0]] || {}).v === false) continue; const arr = lv.vals[pl[0]]; if (!arr) continue; const v = arr[idx]; vals += '<span style="color:' + ((x.st[pl[0]] || {}).c || pl[2]) + '">' + fmt(v + (ov ? lv.sh : 0), ov ? c.sObj.dg : 2) + '</span> '; }
    const row = '<div class="lg-ind' + (x.hd ? ' off' : '') + '" data-id="' + x.id + '"><span class="lg-name">' + U.esc(def.s) + (args ? ' ' + U.esc(args) : '') + '</span> ' + (x._err ? '<span class="lg-err">' + U.esc(x._err) + '</span>' : vals) +
      '<span class="lg-btns"><button data-a="eye" title="Hide">' + U.icon(x.hd ? 'eye-off' : 'eye') + '</button><button data-a="set" title="Settings">' + U.icon('gear') + '</button><button data-a="del" title="Remove">' + U.icon('x') + '</button></span></div>';
    if (ov || !lv) main += row; else (panes[lv.pane] = panes[lv.pane] || []).push(row);
  }
  setTimeout(() => paneLegends(c, panes), 0);
  return main;
};
function paneLegends(c, panes) {
  const host = c.host;
  host.querySelectorAll('.pane-legend').forEach(e => e.remove());
  const ps = c.chart.panes(); const hr = host.getBoundingClientRect();
  for (const i in panes) {
    const p = ps[i]; if (!p) continue;
    const el = p.getHTMLElement ? p.getHTMLElement() : null; if (!el) continue;
    const r = el.getBoundingClientRect();
    const lg = U.el('div.pane-legend', { html: panes[i].join(''), style: { top: (r.top - hr.top + 4) + 'px' } });
    host.append(lg);
  }
}
/* legend buttons (event delegation from the chart host) */
I.onLegendClick = function (e) {
  const btn = e.target.closest('button[data-a]'); const row = e.target.closest('.lg-ind'); if (!row) return;
  const x = I.list.find(y => y.id === row.dataset.id); if (!x) return;
  const a = btn ? btn.dataset.a : 'set';
  if (a === 'del') I.remove(x.id);
  else if (a === 'eye') { x.hd = !x.hd; save(); if (ch) { if (x.hd) destroy(x.id); else build(ch, x); ch.renderLegend(); } }
  else I.settings(x);
};

/* ---------- dialogs ---------- */
I.picker = function () {
  const box = U.el('div.ind-picker');
  const q = U.el('input.inp.search', { type: 'search', placeholder: 'Search' });
  const list = U.el('div.ind-list');
  box.append(q, list);
  const m = U.modal({ title: 'Indicators, metrics, and strategies', body: box, width: 560, cls: 'ind-modal' });
  const render = () => {
    const s = q.value.trim().toLowerCase(); list.innerHTML = '';
    const groups = {};
    for (const k of ORDER) { const d = D[k]; if (s && !(d.n + ' ' + d.s).toLowerCase().includes(s)) continue; (groups[d.g] = groups[d.g] || []).push([k, d]); }
    for (const sc of I.scripts) if (!s || sc.name.toLowerCase().includes(s)) (groups.Custom = groups.Custom || []).push(['script', { n: sc.name, s: sc.name }, sc]);
    for (const g of ['Trend', 'Oscillators', 'Volatility', 'Volume', 'Custom']) {
      if (!groups[g]) continue;
      list.append(U.el('div.ind-g', { text: g === 'Custom' ? 'My scripts' : g }));
      for (const [k, d, sc] of groups[g]) {
        const row = U.el('button.ind-row', { type: 'button' }, U.el('span', { text: d.n }), U.el('small', { text: d.s }));
        row.onclick = () => { if (k === 'script') I.add('script', { code: sc.code, name: sc.name }); else I.add(k); if (ch) ch.renderLegend(); U.toast(d.n + ' added', '', 'ok', 1500); };
        list.append(row);
      }
    }
    if (!list.children.length) list.append(U.el('div.empty-sm', { text: 'No results' }));
  };
  q.oninput = render; render(); setTimeout(() => q.focus(), 30);
  return m;
};
I.settings = function (x) {
  const def = defOf(x);
  const tabs = U.el('div.tabs-line'); const t1 = U.el('button.on', { type: 'button', text: 'Inputs' }), t2 = U.el('button', { type: 'button', text: 'Style' }); tabs.append(t1, t2);
  const inp = U.el('div.form-grid'), sty = U.el('div.form-grid.hidden');
  const p = Object.assign({}, x.p), st = JSON.parse(JSON.stringify(x.st || {}));
  for (const [key, label, v, opts] of def.inp) {
    let el;
    if (opts) { el = U.el('select.inp'); for (const o of opts) el.append(U.el('option', { value: o, text: o, selected: p[key] === o ? true : null })); el.onchange = () => { p[key] = el.value; }; }
    else { el = U.el('input.inp', { type: 'number', step: 'any', value: p[key] }); el.oninput = () => { const n = parseFloat(el.value); if (!isNaN(n)) p[key] = n; }; }
    inp.append(U.el('label.fg-l', { text: label }), el);
  }
  if (def.script) { const ta = U.el('textarea.inp.code', { rows: 10 }); ta.value = x.code || ''; ta.oninput = () => { x._newCode = ta.value; }; inp.append(U.el('label.fg-l', { text: 'Code' }), ta); }
  if (!def.inp.length && !def.script) inp.append(U.el('div.muted', { text: 'No inputs' }));
  for (const pl of plotsOf(x)) {
    const [key, title, color] = pl; const s = st[key] = st[key] || {};
    const on = U.el('input', { type: 'checkbox', checked: s.v === false ? null : true, onchange: e => { s.v = e.target.checked; } });
    const c = U.el('input.inp.color', { type: 'color', value: (s.c || color).startsWith('#') ? (s.c || color).slice(0, 7) : '#2962ff', oninput: e => { s.c = e.target.value; } });
    const w = U.el('select.inp'); for (const v of [1, 2, 3, 4]) w.append(U.el('option', { value: v, text: v + 'px', selected: (s.w || 1.5) === v ? true : null })); w.onchange = () => { s.w = +w.value; };
    sty.append(U.el('label.fg-l', null, on, ' ' + title), U.el('div.row-gap', null, c, w));
  }
  t1.onclick = () => { t1.classList.add('on'); t2.classList.remove('on'); inp.classList.remove('hidden'); sty.classList.add('hidden'); };
  t2.onclick = () => { t2.classList.add('on'); t1.classList.remove('on'); sty.classList.remove('hidden'); inp.classList.add('hidden'); };
  const body = U.el('div', null, tabs, inp, sty);
  const foot = U.el('div.row-end');
  const defs = U.el('button.btn.btn-ghost', { type: 'button', text: 'Defaults' }), cancel = U.el('button.btn.btn-ghost', { type: 'button', text: 'Cancel' }), ok = U.el('button.btn.btn-yellow', { type: 'button', text: 'Ok' });
  foot.append(defs, U.el('span.grow'), cancel, ok);
  const m = U.modal({ title: def.n, body, foot, width: 420 });
  cancel.onclick = () => m.close();
  defs.onclick = () => { for (const [key, , v] of def.inp) x.p[key] = v; x.st = {}; save(); if (ch) build(ch, x); m.close(); ch && ch.renderLegend(); };
  ok.onclick = () => { const before = JSON.stringify(x); x.p = p; x.st = st; if (x._newCode != null) { x.code = x._newCode; delete x._newCode; } save(); if (ch) { build(ch, x); cleanPanes(); ch.renderLegend(); } m.close(); U.emit('ind'); if (AT.undo) { const after = JSON.stringify(x); AT.undo.push({ undo: () => { Object.assign(x, JSON.parse(before)); save(); if (ch) I.recalc(ch); }, redo: () => { Object.assign(x, JSON.parse(after)); save(); if (ch) I.recalc(ch); } }); } };
};
})();
