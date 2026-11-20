/* Amatu Trade — Expert Advisors: runs MetaTrader 5 EAs (.mq5 source, translated by AT.MQL) on the Amatu engine.
   Implements the MQL5 API most EAs use: CTrade / OrderSend, positions & orders, account & symbol info,
   bars + iMA/iATR/iRSI/iBands/iMACD/iStochastic, time & string helpers, global variables, chart objects
   (labels/panels drawn over the chart), economic calendar. EAs run only in the device's leader tab. */
(function () {
'use strict';
const AT = window.AT, U = AT.U, S = AT.S, F = AT.F, E = AT.E;
const EA = AT.EA = {};
const K_ST = 'exness.ea', K_LIB = 'exness.ea.lib', K_GV = 'exness.ea.gv';
const kLog = id => 'pt.exness.ea.log.' + id;

const BUILTIN = [
  { id: 'litus', name: 'LITUS', file: 'ea/LITUS.mq5', sym: 'XAUUSD', tf: 300, desc: 'Tangga BUY STOP + SELL STOP $1, lot berlipat berpasangan (0.01 0.01 0.02 0.02 …), keluar basket dengan Break-Even + Trailing, Risk Guard, filter jam/spread/ATR/berita.' },
  { id: 'macross', name: 'MA Cross', file: 'ea/MACross.mq5', tf: 900, desc: 'Contoh EA sederhana: EMA cepat memotong EMA lambat → buka posisi dengan SL/TP tetap.' }
];
EA.BUILTIN = BUILTIN;
EA.st = Object.assign({ v: 1, algo: true, list: [] }, U.load(K_ST, null) || {});
EA.lib = U.load(K_LIB, []) || [];
let GV = U.load(K_GV, {}) || {};
let DEV = U.load('pt.exness.dev', null); if (!DEV) { DEV = 'd' + U.uid(); U.save('pt.exness.dev', DEV); }
EA.DEV = DEV;
/* EA state syncs to the user's other devices; each EA runs on ONE device only (inst.dev), else ladders would be placed twice */
const mine = i => !i.dev || i.dev === DEV;
const R = {};          // runtime per instance id
const SRC = {};        // libId -> source text
const COMPILED = {};   // libId -> compiled (per source)
EA.R = R;

function saveSt() { U.save(K_ST, EA.st); }
function saveLib() { U.save(K_LIB, EA.lib); }
let gvT = null; function saveGV() { clearTimeout(gvT); gvT = setTimeout(() => U.save(K_GV, GV), 300); }

/* ================= constants ================= */
const NUM = {
  // trade enums (MQL5 values)
  POSITION_TYPE_BUY: 0, POSITION_TYPE_SELL: 1,
  ORDER_TYPE_BUY: 0, ORDER_TYPE_SELL: 1, ORDER_TYPE_BUY_LIMIT: 2, ORDER_TYPE_SELL_LIMIT: 3, ORDER_TYPE_BUY_STOP: 4, ORDER_TYPE_SELL_STOP: 5, ORDER_TYPE_BUY_STOP_LIMIT: 6, ORDER_TYPE_SELL_STOP_LIMIT: 7, ORDER_TYPE_CLOSE_BY: 8,
  ORDER_STATE_STARTED: 0, ORDER_STATE_PLACED: 1, ORDER_STATE_CANCELED: 2, ORDER_STATE_FILLED: 4,
  ORDER_FILLING_FOK: 0, ORDER_FILLING_IOC: 1, ORDER_FILLING_RETURN: 2, ORDER_TIME_GTC: 0, ORDER_TIME_DAY: 1, ORDER_TIME_SPECIFIED: 2, ORDER_TIME_SPECIFIED_DAY: 3,
  DEAL_TYPE_BUY: 0, DEAL_TYPE_SELL: 1, DEAL_TYPE_BALANCE: 2, DEAL_ENTRY_IN: 0, DEAL_ENTRY_OUT: 1, DEAL_ENTRY_INOUT: 2, DEAL_ENTRY_OUT_BY: 3,
  DEAL_REASON_CLIENT: 0, DEAL_REASON_EXPERT: 3, DEAL_REASON_SL: 4, DEAL_REASON_TP: 5, DEAL_REASON_SO: 6,
  TRADE_ACTION_DEAL: 1, TRADE_ACTION_PENDING: 5, TRADE_ACTION_SLTP: 6, TRADE_ACTION_MODIFY: 7, TRADE_ACTION_REMOVE: 8, TRADE_ACTION_CLOSE_BY: 10,
  ACCOUNT_TRADE_MODE_DEMO: 0, ACCOUNT_TRADE_MODE_CONTEST: 1, ACCOUNT_TRADE_MODE_REAL: 2,
  ACCOUNT_MARGIN_MODE_RETAIL_NETTING: 0, ACCOUNT_MARGIN_MODE_EXCHANGE: 1, ACCOUNT_MARGIN_MODE_RETAIL_HEDGING: 2,
  ACCOUNT_STOPOUT_MODE_PERCENT: 0, SYMBOL_TRADE_MODE_DISABLED: 0, SYMBOL_TRADE_MODE_LONGONLY: 1, SYMBOL_TRADE_MODE_SHORTONLY: 2, SYMBOL_TRADE_MODE_CLOSEONLY: 3, SYMBOL_TRADE_MODE_FULL: 4,
  SYMBOL_FILLING_FOK: 1, SYMBOL_FILLING_IOC: 2, SYMBOL_EXPIRATION_GTC: 1, SYMBOL_EXPIRATION_DAY: 2, SYMBOL_EXPIRATION_SPECIFIED: 4, SYMBOL_EXPIRATION_SPECIFIED_DAY: 8,
  CALENDAR_IMPORTANCE_NONE: 0, CALENDAR_IMPORTANCE_LOW: 1, CALENDAR_IMPORTANCE_MODERATE: 2, CALENDAR_IMPORTANCE_HIGH: 3,
  INIT_SUCCEEDED: 0, INIT_FAILED: 1, INIT_PARAMETERS_INCORRECT: 2, INIT_AGENT_NOT_SUITABLE: 3,
  REASON_PROGRAM: 0, REASON_REMOVE: 1, REASON_RECOMPILE: 2, REASON_CHARTCHANGE: 3, REASON_CHARTCLOSE: 4, REASON_PARAMETERS: 5, REASON_ACCOUNT: 6, REASON_TEMPLATE: 7, REASON_INITFAILED: 8, REASON_CLOSE: 9,
  MODE_SMA: 0, MODE_EMA: 1, MODE_SMMA: 2, MODE_LWMA: 3, MODE_MAIN: 0, MODE_SIGNAL: 1, MODE_PLUSDI: 1, MODE_MINUSDI: 2, MODE_UPPER: 1, MODE_LOWER: 2,
  MODE_OPEN: 0, MODE_LOW: 1, MODE_HIGH: 2, MODE_CLOSE: 3, MODE_VOLUME: 4, MODE_REAL_VOLUME: 5, MODE_TIME: 6,
  PRICE_CLOSE: 1, PRICE_OPEN: 2, PRICE_HIGH: 3, PRICE_LOW: 4, PRICE_MEDIAN: 5, PRICE_TYPICAL: 6, PRICE_WEIGHTED: 7, STO_LOWHIGH: 0, STO_CLOSECLOSE: 1, VOLUME_TICK: 0, VOLUME_REAL: 1,
  TIME_DATE: 1, TIME_MINUTES: 2, TIME_SECONDS: 4,
  PERIOD_CURRENT: 0, PERIOD_M1: 1, PERIOD_M2: 2, PERIOD_M3: 3, PERIOD_M4: 4, PERIOD_M5: 5, PERIOD_M6: 6, PERIOD_M10: 10, PERIOD_M12: 12, PERIOD_M15: 15, PERIOD_M20: 20, PERIOD_M30: 30,
  PERIOD_H1: 16385, PERIOD_H2: 16386, PERIOD_H3: 16387, PERIOD_H4: 16388, PERIOD_H6: 16390, PERIOD_H8: 16392, PERIOD_H12: 16396, PERIOD_D1: 16408, PERIOD_W1: 32769, PERIOD_MN1: 49153,
  CORNER_LEFT_UPPER: 0, CORNER_LEFT_LOWER: 1, CORNER_RIGHT_LOWER: 2, CORNER_RIGHT_UPPER: 3,
  ANCHOR_LEFT_UPPER: 0, ANCHOR_LEFT: 1, ANCHOR_LEFT_LOWER: 2, ANCHOR_LOWER: 3, ANCHOR_RIGHT_LOWER: 4, ANCHOR_RIGHT: 5, ANCHOR_RIGHT_UPPER: 6, ANCHOR_UPPER: 7, ANCHOR_CENTER: 8,
  BORDER_FLAT: 0, BORDER_RAISED: 1, BORDER_SUNKEN: 2, STYLE_SOLID: 0, STYLE_DASH: 1, STYLE_DOT: 2, STYLE_DASHDOT: 3, STYLE_DASHDOTDOT: 4,
  OBJ_VLINE: 0, OBJ_HLINE: 1, OBJ_TREND: 2, OBJ_RECTANGLE: 16, OBJ_ARROW: 100, OBJ_TEXT: 101, OBJ_LABEL: 102, OBJ_BUTTON: 103, OBJ_BITMAP_LABEL: 106, OBJ_EDIT: 107, OBJ_RECTANGLE_LABEL: 110,
  CHART_WIDTH_IN_PIXELS: 104, CHART_HEIGHT_IN_PIXELS: 105, CHARTEVENT_KEYDOWN: 0, CHARTEVENT_OBJECT_CLICK: 1, CHARTEVENT_CLICK: 4, CHARTEVENT_CUSTOM: 1000,
  POINTER_INVALID: 0, POINTER_DYNAMIC: 1, POINTER_AUTOMATIC: 2,
  // trade server return codes
  TRADE_RETCODE_REQUOTE: 10004, TRADE_RETCODE_REJECT: 10006, TRADE_RETCODE_CANCEL: 10007, TRADE_RETCODE_PLACED: 10008, TRADE_RETCODE_DONE: 10009, TRADE_RETCODE_DONE_PARTIAL: 10010,
  TRADE_RETCODE_ERROR: 10011, TRADE_RETCODE_TIMEOUT: 10012, TRADE_RETCODE_INVALID: 10013, TRADE_RETCODE_INVALID_VOLUME: 10014, TRADE_RETCODE_INVALID_PRICE: 10015,
  TRADE_RETCODE_INVALID_STOPS: 10016, TRADE_RETCODE_TRADE_DISABLED: 10017, TRADE_RETCODE_MARKET_CLOSED: 10018, TRADE_RETCODE_NO_MONEY: 10019, TRADE_RETCODE_PRICE_CHANGED: 10020,
  TRADE_RETCODE_PRICE_OFF: 10021, TRADE_RETCODE_INVALID_EXPIRATION: 10022, TRADE_RETCODE_ORDER_CHANGED: 10023, TRADE_RETCODE_TOO_MANY_REQUESTS: 10024, TRADE_RETCODE_NO_CHANGES: 10025,
  TRADE_RETCODE_SERVER_DISABLES_AT: 10026, TRADE_RETCODE_CLIENT_DISABLES_AT: 10027, TRADE_RETCODE_LOCKED: 10028, TRADE_RETCODE_FROZEN: 10029, TRADE_RETCODE_INVALID_FILL: 10030,
  TRADE_RETCODE_CONNECTION: 10031, TRADE_RETCODE_ONLY_REAL: 10032, TRADE_RETCODE_LIMIT_ORDERS: 10033, TRADE_RETCODE_LIMIT_VOLUME: 10034, TRADE_RETCODE_INVALID_ORDER: 10035, TRADE_RETCODE_POSITION_CLOSED: 10036,
  // numeric limits
  WRONG_VALUE: -1, INVALID_HANDLE: -1, EMPTY_VALUE: 1.7976931348623157e308, DBL_MAX: 1.7976931348623157e308, DBL_MIN: 2.2250738585072014e-308, DBL_EPSILON: 2.220446049250313e-16,
  FLT_MAX: 3.402823466e38, INT_MAX: 2147483647, INT_MIN: -2147483648, UINT_MAX: 4294967295, LONG_MAX: 9223372036854775807, LONG_MIN: -9223372036854775808, ULONG_MAX: 18446744073709551615,
  CHAR_MAX: 127, UCHAR_MAX: 255, SHORT_MAX: 32767, USHORT_MAX: 65535, WHOLE_ARRAY: -1, M_PI: Math.PI, M_PI_2: Math.PI / 2, M_E: Math.E, M_LN2: Math.LN2, M_SQRT2: Math.SQRT2,
  CP_ACP: 0, CP_UTF8: 65001, FILE_READ: 1, FILE_WRITE: 2, FILE_CSV: 8, FILE_TXT: 16, FILE_COMMON: 4096, ERR_SUCCESS: 0
};
const CLR = { clrNONE: -1, clrBlack: 0x000000, clrWhite: 0xFFFFFF, clrRed: 0x0000FF, clrLime: 0x00FF00, clrGreen: 0x008000, clrBlue: 0xFF0000, clrYellow: 0x00FFFF, clrGold: 0x00D7FF,
  clrOrange: 0x00A5FF, clrOrangeRed: 0x0045FF, clrGray: 0x808080, clrSilver: 0xC0C0C0, clrDarkGray: 0xA9A9A9, clrLightGray: 0xD3D3D3, clrDimGray: 0x696969, clrDodgerBlue: 0xFF901E,
  clrDeepSkyBlue: 0xFFBF00, clrAqua: 0xFFFF00, clrMagenta: 0xFF00FF, clrCrimson: 0x3C14DC, clrTomato: 0x4763FF, clrLimeGreen: 0x32CD32, clrSeaGreen: 0x578B2E, clrSpringGreen: 0x7FFF00,
  clrNavy: 0x800000, clrMaroon: 0x000080, clrWhiteSmoke: 0xF5F5F5, clrMidnightBlue: 0x701919, clrSteelBlue: 0xB48246, clrSlateGray: 0x908070, clrDarkSlateGray: 0x4F4F2F, clrBrown: 0x2A2AA5,
  clrPurple: 0x800080, clrTeal: 0x808000, clrOlive: 0x008080, clrPink: 0xCBC0FF, clrKhaki: 0x8CE6F0, clrBeige: 0xDCF5F5, clrIvory: 0xF0FFFF, clrLavender: 0xFAE6E6, clrMintCream: 0xFAFFF5 };
const TF_SEC = { 1: 60, 2: 120, 3: 180, 4: 240, 5: 300, 6: 360, 10: 600, 12: 720, 15: 900, 20: 1200, 30: 1800, 16385: 3600, 16386: 7200, 16387: 10800, 16388: 14400, 16390: 21600, 16392: 28800, 16396: 43200, 16408: 86400, 32769: 604800, 49153: 2592000 };
const SEC_TF = {}; for (const k in TF_SEC) SEC_TF[TF_SEC[k]] = +k;
EA.TFS = [[60, 'M1'], [300, 'M5'], [900, 'M15'], [1800, 'M30'], [3600, 'H1'], [14400, 'H4'], [86400, 'D1']];
const TF_ENUM = Object.keys(NUM).filter(k => k.startsWith('PERIOD_'));
const RC_TXT = { 10004: 'requote', 10006: 'request rejected', 10008: 'order placed', 10009: 'done', 10013: 'invalid request', 10014: 'invalid volume', 10015: 'invalid price', 10016: 'invalid stops',
  10017: 'trade disabled', 10018: 'market closed', 10019: 'not enough money', 10021: 'no quotes', 10025: 'no changes', 10027: 'autotrading disabled by client (Algo Trading OFF)', 10033: 'orders limit reached', 10035: 'invalid order', 10036: 'position already closed' };
const isConst = k => /^[A-Z][A-Z0-9]*_[A-Z0-9_]+$/.test(k);
const colorCss = c => { c = +c; if (!(c >= 0) || c === 0xFFFFFFFF) return 'transparent'; return 'rgb(' + (c & 255) + ',' + ((c >> 8) & 255) + ',' + ((c >> 16) & 255) + ')'; };

/* ================= helpers ================= */
function sprintf(fmt, args) {
  let ai = 0;
  return String(fmt).replace(/%([-+ 0#]*)(\d+|\*)?(?:\.(\d+|\*))?(?:I64|I32|ll|l|h)?([diouxXeEfgGcsS%])/g, (m, fl, w, p, c) => {
    if (c === '%') return '%';
    if (w === '*') w = args[ai++]; if (p === '*') p = args[ai++];
    const v = args[ai++]; let s;
    switch (c) {
      case 'd': case 'i': case 'u': s = String(Math.trunc(+v || 0)); if (fl.includes('+') && +v >= 0) s = '+' + s; break;
      case 'o': s = (Math.trunc(+v) >>> 0).toString(8); break;
      case 'x': case 'X': s = (Math.trunc(+v) >>> 0).toString(16); if (c === 'X') s = s.toUpperCase(); break;
      case 'f': s = (+v || 0).toFixed(p == null ? 6 : +p); if (fl.includes('+') && +v >= 0) s = '+' + s; break;
      case 'e': case 'E': s = (+v || 0).toExponential(p == null ? 6 : +p); if (c === 'E') s = s.toUpperCase(); break;
      case 'g': case 'G': s = String(+(+v || 0).toPrecision(p == null ? 6 : Math.max(1, +p))); break;
      case 'c': s = String.fromCharCode(+v); break;
      default: s = v == null ? '' : typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v); if (p != null) s = s.slice(0, +p);
    }
    w = +w || 0;
    if (s.length < w) s = fl.includes('-') ? s.padEnd(w) : (fl.includes('0') && /[dfiuxXeEg]/.test(c) ? (s[0] === '-' ? '-' + s.slice(1).padStart(w - 1, '0') : s.padStart(w, '0')) : s.padStart(w));
    return s;
  });
}
const valStr = v => (typeof v === 'boolean' ? (v ? 'true' : 'false') : typeof v === 'number' ? (Number.isInteger(v) ? String(v) : String(+v.toFixed(8))) : v == null ? '' : String(v));
function pad2(n) { return (n < 10 ? '0' : '') + n; }
function timeStr(t, f) {
  f = f == null ? 3 : f; const d = new Date(t * 1000); const p = [];
  if (f & 1) p.push(d.getUTCFullYear() + '.' + pad2(d.getUTCMonth() + 1) + '.' + pad2(d.getUTCDate()));
  if (f & 4) p.push(pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds()));
  else if (f & 2) p.push(pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()));
  return p.join(' ');
}
function strToTime(s) {
  s = String(s).trim(); let m = /^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) / 1000;
  m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
  if (m) { const d = new Date(); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), +m[1], +m[2], +(m[3] || 0)) / 1000; }
  return 0;
}
function resolveSym(s, X) {
  if (s == null || s === '' || s === 'NULL') return X.inst.sym;
  s = String(s);
  if (S.map[s]) return s;
  const t = s.replace(/\.[a-z]+$/i, '').replace(/[#!]$/, '').replace(/(m|c|z|pro|ecn)$/i, '').toUpperCase();
  if (S.map[t]) return t;
  const u = s.toUpperCase(); if (S.map[u]) return u;
  return null;
}
function mkArr(def, n) { const a = []; a.__def = def; resize(a, n); return a; }
function resize(a, n) { n = Math.max(0, Math.trunc(n) || 0); const d = a.__def; const o = a.length; a.length = n; for (let i = o; i < n; i++) a[i] = typeof d === 'function' ? d() : d == null ? 0 : d; return n; }

/* ================= bars & indicators ================= */
const BARS = {};
function series(sym, tf) {
  const k = sym + '|' + tf; let c = BARS[k];
  if (!c) c = BARS[k] = { b: [], t: 0, loading: null, ver: 0, sym, tf };
  const now = Date.now();
  if (!c.loading && (!c.t || now - c.t > (c.b.length ? 10 * 60000 : 30000))) {
    c.loading = F.history(sym, tf, { bars: 900 }).then(b => {
      if (b && b.length) { c.b = b.map(x => ({ time: x.time, open: x.open, high: x.high, low: x.low, close: x.close, vol: x.volume || x.vol || 0 })); c.ver++; }
      c.t = Date.now(); c.loading = null;
    }).catch(() => { c.t = Date.now(); c.loading = null; });
  }
  live(c);
  return c;
}
function live(c) {
  if (!c.b.length) return;
  const q = F.bidAsk(c.sym, 'standard'); if (!q || !(q.bid > 0)) return;
  const px = q.bid, now = Math.floor(Date.now() / 1000);
  let last = c.b[c.b.length - 1];
  if (now >= last.time + c.tf) {
    if (!F.isOpen(c.sym)) return;
    const t = last.time + c.tf * Math.floor((now - last.time) / c.tf);
    c.b.push({ time: t, open: px, high: px, low: px, close: px, vol: 1 }); if (c.b.length > 1500) c.b.splice(0, c.b.length - 1500);
    c.ver++; return;
  }
  if (last.close !== px) { last.close = px; if (px > last.high) last.high = px; if (px < last.low) last.low = px; last.vol++; c.ver++; }
}
const priceOf = (b, ap) => { switch (ap) { case 2: return b.open; case 3: return b.high; case 4: return b.low; case 5: return (b.high + b.low) / 2; case 6: return (b.high + b.low + b.close) / 3; case 7: return (b.high + b.low + 2 * b.close) / 4; default: return b.close; } };
function maArr(src, p, method) {
  const n = src.length, out = new Array(n).fill(NaN); if (p < 1 || n < p) return out;
  if (method === 1 || method === 2) { const a = method === 1 ? 2 / (p + 1) : 1 / p; let s = 0; for (let i = 0; i < p; i++) s += src[i]; let v = s / p; out[p - 1] = v; for (let i = p; i < n; i++) { v = v + a * (src[i] - v); out[i] = v; } return out; }
  if (method === 3) { const w = p * (p + 1) / 2; for (let i = p - 1; i < n; i++) { let s = 0; for (let j = 0; j < p; j++) s += src[i - j] * (p - j); out[i] = s / w; } return out; }
  let s = 0; for (let i = 0; i < n; i++) { s += src[i]; if (i >= p) s -= src[i - p]; if (i >= p - 1) out[i] = s / p; } return out;
}
function calcInd(h) {
  const c = series(h.sym, h.tf); const b = c.b;
  if (h.ver === c.ver && h.vals) return h.vals;
  const P = h.p; let vals;
  if (h.kind === 'atr') {
    const tr = b.map((x, i) => i ? Math.max(x.high - x.low, Math.abs(x.high - b[i - 1].close), Math.abs(x.low - b[i - 1].close)) : x.high - x.low);
    vals = [maArr(tr, P[0], 0)];
  } else if (h.kind === 'ma') {
    const m = maArr(b.map(x => priceOf(x, P[3])), P[0], P[2]);
    vals = [P[1] ? m.map((v, i) => (i - P[1] >= 0 ? m[i - P[1]] : NaN)) : m];
  } else if (h.kind === 'rsi') {
    const s = b.map(x => priceOf(x, P[1])), n = s.length, out = new Array(n).fill(NaN), p = P[0];
    let g = 0, l = 0;
    for (let i = 1; i < n; i++) {
      const d = s[i] - s[i - 1];
      if (i <= p) { g += Math.max(d, 0); l += Math.max(-d, 0); if (i === p) { g /= p; l /= p; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); } }
      else { g = (g * (p - 1) + Math.max(d, 0)) / p; l = (l * (p - 1) + Math.max(-d, 0)) / p; out[i] = l === 0 ? 100 : 100 - 100 / (1 + g / l); }
    }
    vals = [out];
  } else if (h.kind === 'bands') {
    const s = b.map(x => priceOf(x, P[3])), mid = maArr(s, P[0], 0), up = [], lo = [];
    for (let i = 0; i < s.length; i++) { if (isNaN(mid[i])) { up.push(NaN); lo.push(NaN); continue; } let v = 0; for (let j = 0; j < P[0]; j++) v += Math.pow(s[i - j] - mid[i], 2); const sd = Math.sqrt(v / P[0]); up.push(mid[i] + P[2] * sd); lo.push(mid[i] - P[2] * sd); }
    vals = [mid, up, lo];
  } else if (h.kind === 'macd') {
    const s = b.map(x => priceOf(x, P[3])), f = maArr(s, P[0], 1), sl = maArr(s, P[1], 1);
    const m = f.map((v, i) => v - sl[i]); const first = m.findIndex(v => !isNaN(v));
    const sig = new Array(m.length).fill(NaN); if (first >= 0) { const ss = maArr(m.slice(first), P[2], 0); for (let i = 0; i < ss.length; i++) sig[first + i] = ss[i]; }
    vals = [m, sig];
  } else if (h.kind === 'stoch') {
    const [K, D, sl] = P, n = b.length, raw = new Array(n).fill(NaN);
    for (let i = K - 1; i < n; i++) { let hi = -Infinity, lo = Infinity; for (let j = 0; j < K; j++) { hi = Math.max(hi, b[i - j].high); lo = Math.min(lo, b[i - j].low); } raw[i] = hi === lo ? 50 : (b[i].close - lo) / (hi - lo) * 100; }
    const first = raw.findIndex(v => !isNaN(v)); const main = new Array(n).fill(NaN), sig = new Array(n).fill(NaN);
    if (first >= 0) { const m = maArr(raw.slice(first), sl, 0); for (let i = 0; i < m.length; i++) main[first + i] = m[i]; const f2 = main.findIndex(v => !isNaN(v)); if (f2 >= 0) { const s2 = maArr(main.slice(f2), D, 0); for (let i = 0; i < s2.length; i++) sig[f2 + i] = s2[i]; } }
    vals = [main, sig];
  } else vals = [[]];
  h.vals = vals; h.ver = c.ver; return vals;
}

/* ================= the MQL5 environment of one EA instance ================= */
function makeEnv(inst) {
  const X = { inst, sel: { pos: null, ord: null }, objs: new Map(), comment: '', timerMs: 0, nextTimer: 0, lastErr: 0, handles: [null], dirty: false, cal: new Map() };
  const acc = () => E.acc(inst.acc);
  const tfOf = p => { p = +p || 0; return p === 0 ? inst.tf : (TF_SEC[p] || inst.tf); };
  const symOf = s => resolveSym(s, X);
  const log = (msg, lv) => EA.log(inst.id, msg, lv);
  const symbol = s => S.map[symOf(s)] || null;
  const q = s => { const a = acc(); const id = symOf(s); return id ? E.quote(a, id) : null; };
  const out = (box, v) => { if (box && typeof box === 'object' && 'v' in box) box.v = v; return v; };
  const ticketOf = id => +id;
  const findPos = t => { const a = acc(); return a ? a.pos.find(p => +p.id === +t) || null : null; };
  const findOrd = t => { const a = acc(); return a ? a.ord.find(o => +o.id === +t) || null : null; };
  const ordType = o => (o.side === 'buy' ? (o.kind === 'limit' ? 2 : 4) : (o.kind === 'limit' ? 3 : 5));

  /* --- trading primitives --- */
  function rcOf(err) { switch (err) { case E.ERR.closed: return 10018; case E.ERR.money: return 10019; case E.ERR.vol: return 10014; case E.ERR.stops: return 10016; case E.ERR.price: return 10015; case E.ERR.noquote: return 10021; default: return 10013; } }
  function guard() { if (!EA.st.algo) return 10027; const a = acc(); if (!a) return 10013; if (a.archived) return 10017; return 0; }
  function openMkt(side, vol, s, sl, tp, cmt, magic) {
    const g = guard(); if (g) return { rc: g };
    const id = symOf(s); if (!id) return { rc: 10013 };
    const r = E.open(acc(), { sym: id, side, vol: +vol, sl: +sl || null, tp: +tp || null, quiet: true, magic, cmt });
    if (r.err) { log('order gagal: ' + (side === 'buy' ? 'buy ' : 'sell ') + vol + ' ' + id + ' — ' + r.err, 'err'); return { rc: rcOf(r.err) }; }
    log('deal #' + r.pos.id + ' ' + side + ' ' + r.pos.vol + ' ' + id + ' at ' + r.pos.open + (cmt ? ' [' + cmt + ']' : ''));
    return { rc: 10009, order: ticketOf(r.pos.id), deal: ticketOf(r.pos.id), price: r.pos.open, vol: r.pos.vol };
  }
  function placePend(side, kind, vol, price, s, sl, tp, cmt, magic, exp) {
    const g = guard(); if (g) return { rc: g };
    const id = symOf(s); if (!id) return { rc: 10013 };
    if (!F.isOpen(id)) return { rc: 10018 };
    const qq = q(id); if (!qq) return { rc: 10021 };
    price = +price;
    const ok = side === 'buy' ? (kind === 'stop' ? price > qq.ask : price < qq.ask) : (kind === 'stop' ? price < qq.bid : price > qq.bid);
    if (!ok) { log('order gagal: ' + side + ' ' + kind + ' ' + vol + ' ' + id + ' at ' + price + ' — invalid price', 'err'); return { rc: 10015 }; }
    const r = E.place(acc(), { sym: id, side, kind, vol: +vol, price, sl: +sl || null, tp: +tp || null, quiet: true, magic, cmt, exp: exp > 0 ? exp * 1000 : null });
    if (r.err) { log('order gagal: ' + side + ' ' + kind + ' ' + vol + ' ' + id + ' — ' + r.err, 'err'); return { rc: rcOf(r.err) }; }
    return { rc: 10009, order: ticketOf(r.ord.id), price: r.ord.price, vol: r.ord.vol };
  }
  function closePos(t, vol) {
    const g = guard(); if (g && g !== 10027) return { rc: g };
    const p = findPos(t); if (!p) return { rc: 10036 };
    const r = E.close(acc(), p.id, vol == null ? null : +vol, 'Expert');
    if (r.err) { log('tutup #' + p.id + ' gagal — ' + r.err, 'err'); return { rc: rcOf(r.err) }; }
    log('close #' + p.id + ' ' + p.side + ' ' + r.rec.vol + ' ' + p.sym + ' at ' + r.rec.close + ' P/L ' + U.fmt(r.rec.pl, 2));
    return { rc: 10009, deal: ticketOf(p.id), price: r.rec.close, vol: r.rec.vol };
  }
  function modPos(t, sl, tp) { const p = findPos(t); if (!p) return { rc: 10036 }; const r = E.modifyPos(acc(), p.id, { sl: +sl || 0, tp: +tp || 0 }); return r.err ? { rc: rcOf(r.err) } : { rc: 10009 }; }
  function modOrd(t, price, sl, tp) { const o = findOrd(t); if (!o) return { rc: 10035 }; const r = E.modifyOrd(acc(), o.id, { price: +price || o.price, sl: +sl || 0, tp: +tp || 0 }); return r.err ? { rc: rcOf(r.err) } : { rc: 10009 }; }
  function delOrd(t) { const o = findOrd(t); if (!o) return { rc: 10035 }; E.cancel(acc(), o.id, 'Canceled by EA'); return { rc: 10009, order: +t }; }
  const sideOfType = ty => (+ty === 0 || +ty === 2 || +ty === 4 ? 'buy' : 'sell');
  const kindOfType = ty => (+ty === 2 || +ty === 3 ? 'limit' : 'stop');

  class CTrade {
    constructor() { this.m = 0; this.res = { rc: 0 }; }
    SetExpertMagicNumber(m) { this.m = +m || 0; } SetDeviationInPoints() { } SetTypeFilling() { } SetTypeFillingBySymbol() { return true; } SetMarginMode() { } SetAsyncMode() { } LogLevel() { }
    RequestMagic() { return this.m; }
    _r(r) { this.res = r; X.lastErr = r.rc === 10009 || r.rc === 10008 ? 0 : 4756; return r.rc === 10009 || r.rc === 10008; }
    Buy(v, s, p, sl, tp, c) { return this._r(openMkt('buy', v, s, sl, tp, c, this.m)); }
    Sell(v, s, p, sl, tp, c) { return this._r(openMkt('sell', v, s, sl, tp, c, this.m)); }
    PositionOpen(s, ty, v, p, sl, tp, c) { return this._r(openMkt(sideOfType(ty), v, s, sl, tp, c, this.m)); }
    BuyLimit(v, p, s, sl, tp, tt, ex, c) { return this._r(placePend('buy', 'limit', v, p, s, sl, tp, c, this.m, ex)); }
    SellLimit(v, p, s, sl, tp, tt, ex, c) { return this._r(placePend('sell', 'limit', v, p, s, sl, tp, c, this.m, ex)); }
    BuyStop(v, p, s, sl, tp, tt, ex, c) { return this._r(placePend('buy', 'stop', v, p, s, sl, tp, c, this.m, ex)); }
    SellStop(v, p, s, sl, tp, tt, ex, c) { return this._r(placePend('sell', 'stop', v, p, s, sl, tp, c, this.m, ex)); }
    OrderOpen(s, ty, v, lp, p, sl, tp, tt, ex, c) { if (+ty <= 1) return this._r(openMkt(sideOfType(ty), v, s, sl, tp, c, this.m)); return this._r(placePend(sideOfType(ty), kindOfType(ty), v, p, s, sl, tp, c, this.m, ex)); }
    PositionClose(t) { if (typeof t === 'string') { const id = symOf(t); const a = acc(); const p = a && a.pos.find(x => x.sym === id && (!this.m || x.magic === this.m)); return this._r(p ? closePos(p.id) : { rc: 10036 }); } return this._r(closePos(t)); }
    PositionClosePartial(t, v) { return this._r(closePos(t, v)); }
    PositionModify(t, sl, tp) { if (typeof t === 'string') { const id = symOf(t); const a = acc(); const p = a && a.pos.find(x => x.sym === id); return this._r(p ? modPos(p.id, sl, tp) : { rc: 10036 }); } return this._r(modPos(t, sl, tp)); }
    OrderModify(t, p, sl, tp) { return this._r(modOrd(t, p, sl, tp)); }
    OrderDelete(t) { return this._r(delOrd(t)); }
    ResultRetcode() { return this.res.rc; } ResultRetcodeDescription() { return RC_TXT[this.res.rc] || 'retcode ' + this.res.rc; } ResultComment() { return this.ResultRetcodeDescription(); }
    ResultOrder() { return this.res.order || 0; } ResultDeal() { return this.res.deal || 0; } ResultPrice() { return this.res.price || 0; } ResultVolume() { return this.res.vol || 0; }
    CheckResultRetcode() { return this.res.rc; } CheckResultRetcodeDescription() { return this.ResultRetcodeDescription(); }
  }
  class CPositionInfo {
    constructor() { this.p = null; }
    SelectByIndex(i) { const a = acc(); this.p = a && a.pos[i] || null; X.sel.pos = this.p; return !!this.p; }
    SelectByTicket(t) { this.p = findPos(t); X.sel.pos = this.p; return !!this.p; }
    Select(s) { const a = acc(); const id = symOf(s); this.p = a && a.pos.find(x => x.sym === id) || null; return !!this.p; }
    Ticket() { return this.p ? +this.p.id : 0; } Symbol() { return this.p ? this.p.sym : ''; } Magic() { return this.p ? this.p.magic || 0 : 0; } Comment() { return this.p ? this.p.cmt || '' : ''; }
    PositionType() { return this.p ? (this.p.side === 'buy' ? 0 : 1) : -1; } Volume() { return this.p ? this.p.vol : 0; } PriceOpen() { return this.p ? this.p.open : 0; }
    StopLoss() { return this.p ? this.p.sl || 0 : 0; } TakeProfit() { return this.p ? this.p.tp || 0 : 0; } Swap() { return this.p ? this.p.swap || 0 : 0; } Commission() { return this.p ? this.p.comm || 0 : 0; }
    Profit() { return this.p ? E.profit(acc(), this.p) || 0 : 0; } Time() { return this.p ? Math.floor(this.p.t / 1000) : 0; } Identifier() { return this.Ticket(); }
    PriceCurrent() { if (!this.p) return 0; const x = q(this.p.sym); return x ? (this.p.side === 'buy' ? x.bid : x.ask) : 0; }
  }
  class COrderInfo {
    constructor() { this.o = null; }
    SelectByIndex(i) { const a = acc(); this.o = a && a.ord[i] || null; X.sel.ord = this.o; return !!this.o; }
    Select(t) { this.o = findOrd(t); X.sel.ord = this.o; return !!this.o; }
    Ticket() { return this.o ? +this.o.id : 0; } Symbol() { return this.o ? this.o.sym : ''; } Magic() { return this.o ? this.o.magic || 0 : 0; } Comment() { return this.o ? this.o.cmt || '' : ''; }
    OrderType() { return this.o ? ordType(this.o) : -1; } VolumeCurrent() { return this.o ? this.o.vol : 0; } VolumeInitial() { return this.VolumeCurrent(); } PriceOpen() { return this.o ? this.o.price : 0; }
    StopLoss() { return this.o ? this.o.sl || 0 : 0; } TakeProfit() { return this.o ? this.o.tp || 0 : 0; } TimeSetup() { return this.o ? Math.floor(this.o.t / 1000) : 0; }
  }
  class CSymbolInfo {
    constructor() { this.s = inst.sym; }
    Name(s) { if (s === undefined) return this.s; this.s = symOf(s) || this.s; return true; } RefreshRates() { return !!q(this.s); } Refresh() { return true; }
    Bid() { const x = q(this.s); return x ? x.bid : 0; } Ask() { const x = q(this.s); return x ? x.ask : 0; } Point() { return env.SymbolInfoDouble(this.s, 'SYMBOL_POINT'); } Digits() { return env.SymbolInfoInteger(this.s, 'SYMBOL_DIGITS'); }
    Spread() { return env.SymbolInfoInteger(this.s, 'SYMBOL_SPREAD'); } LotsMin() { return env.SymbolInfoDouble(this.s, 'SYMBOL_VOLUME_MIN'); } LotsMax() { return env.SymbolInfoDouble(this.s, 'SYMBOL_VOLUME_MAX'); } LotsStep() { return env.SymbolInfoDouble(this.s, 'SYMBOL_VOLUME_STEP'); }
    TickSize() { return env.SymbolInfoDouble(this.s, 'SYMBOL_TRADE_TICK_SIZE'); } TickValue() { return env.SymbolInfoDouble(this.s, 'SYMBOL_TRADE_TICK_VALUE'); } ContractSize() { return env.SymbolInfoDouble(this.s, 'SYMBOL_TRADE_CONTRACT_SIZE'); }
    StopsLevel() { return 0; } FreezeLevel() { return 0; } NormalizePrice(p) { return +(+p).toFixed(this.Digits()); }
  }
  class CAccountInfo {
    Balance() { return env.AccountInfoDouble('ACCOUNT_BALANCE'); } Equity() { return env.AccountInfoDouble('ACCOUNT_EQUITY'); } Profit() { return env.AccountInfoDouble('ACCOUNT_PROFIT'); }
    Margin() { return env.AccountInfoDouble('ACCOUNT_MARGIN'); } FreeMargin() { return env.AccountInfoDouble('ACCOUNT_MARGIN_FREE'); } MarginLevel() { return env.AccountInfoDouble('ACCOUNT_MARGIN_LEVEL'); }
    Leverage() { return env.AccountInfoInteger('ACCOUNT_LEVERAGE'); } Login() { return env.AccountInfoInteger('ACCOUNT_LOGIN'); } Currency() { return env.AccountInfoString('ACCOUNT_CURRENCY'); } TradeMode() { return 0; }
  }
  class MqlDateTime { constructor() { this.year = 0; this.mon = 0; this.day = 0; this.hour = 0; this.min = 0; this.sec = 0; this.day_of_week = 0; this.day_of_year = 0; } }
  class MqlTick { constructor() { this.time = 0; this.bid = 0; this.ask = 0; this.last = 0; this.volume = 0; this.time_msc = 0; this.flags = 0; this.volume_real = 0; } }
  class MqlRates { constructor() { this.time = 0; this.open = 0; this.high = 0; this.low = 0; this.close = 0; this.tick_volume = 0; this.spread = 0; this.real_volume = 0; } }
  class MqlTradeRequest { constructor() { this.action = 0; this.magic = 0; this.order = 0; this.symbol = ''; this.volume = 0; this.price = 0; this.stoplimit = 0; this.sl = 0; this.tp = 0; this.deviation = 0; this.type = 0; this.type_filling = 0; this.type_time = 0; this.expiration = 0; this.comment = ''; this.position = 0; this.position_by = 0; } }
  class MqlTradeResult { constructor() { this.retcode = 0; this.deal = 0; this.order = 0; this.volume = 0; this.price = 0; this.bid = 0; this.ask = 0; this.comment = ''; this.request_id = 0; this.retcode_external = 0; } }
  class MqlTradeCheckResult { constructor() { this.retcode = 0; this.balance = 0; this.equity = 0; this.profit = 0; this.margin = 0; this.margin_free = 0; this.margin_level = 0; this.comment = ''; } }
  class MqlCalendarValue { constructor() { this.id = 0; this.event_id = 0; this.time = 0; this.period = 0; this.revision = 0; this.actual_value = 0; this.prev_value = 0; this.revised_prev_value = 0; this.forecast_value = 0; this.impact_type = 0; } }
  class MqlCalendarEvent { constructor() { this.id = 0; this.type = 0; this.sector = 0; this.frequency = 0; this.time_mode = 0; this.country_id = 0; this.unit = 0; this.importance = 0; this.multiplier = 0; this.digits = 0; this.source_url = ''; this.event_code = ''; this.name = ''; } }

  const ind = (kind, s, tf, p) => { const id = symOf(s); if (!id) return -1; X.handles.push({ kind, sym: id, tf: tfOf(tf), p, vals: null, ver: -1 }); return X.handles.length - 1; };
  const bars = (s, tf) => { const id = symOf(s); return id ? series(id, tfOf(tf)).b : []; };
  const barAt = (s, tf, sh) => { const b = bars(s, tf); const i = b.length - 1 - (+sh || 0); return i >= 0 && i < b.length ? b[i] : null; };
  const copySeries = (s, tf, start, count, arr, pick) => {
    const b = bars(s, tf); if (!b.length) return -1;
    let st = +start; if (st > 1e8) { let i = b.length - 1; while (i > 0 && b[i].time > st) i--; st = b.length - 1 - i; }
    let n = +count; if (n > 1e8) n = b.length; n = Math.min(n, b.length - st); if (n <= 0) return -1;
    if (arr.__def === undefined) arr.__def = 0;
    resize(arr, n);
    for (let j = 0; j < n; j++) { const sh = arr.__series ? st + j : st + n - 1 - j; arr[j] = pick(b[b.length - 1 - sh]); }
    return n;
  };
  const objSet = (name, prop, a, b) => { const o = X.objs.get(name); if (!o) return false; o.p[prop] = b === undefined ? a : b; X.dirty = true; return true; };
  const objGet = (name, prop, box) => { const o = X.objs.get(name); if (!o) return 0; return out(box, o.p[prop] != null ? o.p[prop] : 0); };

  const env = {
    // helpers used by translated code
    __ti: v => { v = +v; return isFinite(v) ? Math.trunc(v) : 0; },
    __ts: v => valStr(v),
    __idiv: (a, b) => { a = +a; b = +b; if (!b) { X.lastErr = 4054; return 0; } return Math.trunc(a / b); },
    __arr: (d, n) => mkArr(d, n),
    __arrOf: (list, d) => { list.__def = d; return list; },
    CTrade, CPositionInfo, COrderInfo, CSymbolInfo, CAccountInfo, MqlDateTime, MqlTick, MqlRates, MqlTradeRequest, MqlTradeResult, MqlTradeCheckResult, MqlCalendarValue, MqlCalendarEvent,
    // ---- output
    Print: (...a) => log(a.map(valStr).join('')),
    PrintFormat: (f, ...a) => log(sprintf(f, a)),
    printf: (f, ...a) => log(sprintf(f, a)),
    Alert: (...a) => { const s = a.map(valStr).join(''); log('Alert: ' + s, 'warn'); U.toast(inst.name + ' · ' + S.map[inst.sym].n, U.esc(s), 'warn', 8000); U.beep && AT.prefs.sndAlert && U.beep('alert'); },
    Comment: (...a) => { X.comment = a.map(valStr).join(''); X.dirty = true; },
    PlaySound: () => true, SendNotification: s => { U.toast(inst.name, U.esc(String(s)), 'info'); return true; }, SendMail: () => true, SendFTP: () => false,
    StringFormat: (f, ...a) => sprintf(f, a),
    // ---- time
    TimeCurrent: () => Math.floor(Date.now() / 1000), TimeTradeServer: () => Math.floor(Date.now() / 1000), TimeGMT: () => Math.floor(Date.now() / 1000),
    TimeLocal: () => Math.floor(Date.now() / 1000) - new Date().getTimezoneOffset() * 60, TimeDaylightSavings: () => 0, TimeGMTOffset: () => 0,
    TimeToStruct: (t, st) => { const d = new Date((+t || 0) * 1000); st.year = d.getUTCFullYear(); st.mon = d.getUTCMonth() + 1; st.day = d.getUTCDate(); st.hour = d.getUTCHours(); st.min = d.getUTCMinutes(); st.sec = d.getUTCSeconds(); st.day_of_week = d.getUTCDay(); st.day_of_year = Math.floor((Date.UTC(st.year, st.mon - 1, st.day) - Date.UTC(st.year, 0, 1)) / 86400000); return true; },
    StructToTime: st => Date.UTC(st.year, st.mon - 1, st.day, st.hour, st.min, st.sec) / 1000,
    TimeToString: (t, f) => timeStr(+t || 0, f), StringToTime: s => strToTime(s),
    PeriodSeconds: p => tfOf(p), Period: () => SEC_TF[inst.tf] || 5, Symbol: () => inst.sym, Point: () => symbol(null).pt, Digits: () => symbol(null).dg,
    GetTickCount: () => Math.floor(performance.now()) >>> 0, GetTickCount64: () => Math.floor(performance.now()), GetMicrosecondCount: () => Math.floor(performance.now() * 1000), Sleep: () => { },
    // ---- math
    MathAbs: Math.abs, MathMax: Math.max, MathMin: Math.min, MathPow: Math.pow, MathSqrt: Math.sqrt, MathRound: v => Math.round(v), MathFloor: Math.floor, MathCeil: Math.ceil,
    MathLog: Math.log, MathLog10: Math.log10, MathExp: Math.exp, MathMod: (a, b) => a % b, MathSin: Math.sin, MathCos: Math.cos, MathTan: Math.tan, MathArctan: Math.atan, MathArcsin: Math.asin, MathArccos: Math.acos,
    MathRand: () => Math.floor(Math.random() * 32768), rand: () => Math.floor(Math.random() * 32768), MathSrand: () => { }, srand: () => { }, MathIsValidNumber: v => isFinite(v), MathSwap: () => { },
    fabs: Math.abs, fmax: Math.max, fmin: Math.min, pow: Math.pow, sqrt: Math.sqrt, round: Math.round, floor: Math.floor, ceil: Math.ceil, log: Math.log, exp: Math.exp, fmod: (a, b) => a % b,
    NormalizeDouble: (v, d) => { const k = Math.pow(10, d || 0); return Math.round(+v * k) / k; },
    // ---- conversion / strings
    DoubleToString: (v, d) => { d = d == null ? 8 : d; return d < 0 ? (+v).toExponential(-d) : (+v).toFixed(d); }, IntegerToString: (v, len, fill) => String(Math.trunc(+v || 0)).padStart(len || 0, typeof fill === 'number' ? String.fromCharCode(fill) : fill || ' '),
    StringToDouble: s => parseFloat(s) || 0, StringToInteger: s => parseInt(s, 10) || 0, CharToString: c => String.fromCharCode(c), ShortToString: c => String.fromCharCode(c), ColorToString: c => colorCss(c), EnumToString: v => String(v), BoolToString: b => (b ? 'true' : 'false'),
    StringLen: s => String(s).length, StringFind: (s, f, st) => String(s).indexOf(f, st || 0), StringSubstr: (s, st, n) => (n == null || n < 0 ? String(s).substr(st) : String(s).substr(st, n)),
    StringGetCharacter: (s, i) => String(s).charCodeAt(i) || 0, StringCompare: (a, b, cs) => { a = String(a); b = String(b); if (cs === false) { a = a.toLowerCase(); b = b.toLowerCase(); } return a < b ? -1 : a > b ? 1 : 0; },
    StringSplit: (s, sep, arr) => { const p = String(s).split(typeof sep === 'number' ? String.fromCharCode(sep) : sep); arr.length = 0; arr.push(...p); return p.length; },
    StringTrimLeft: box => { const o = box.v; box.v = String(o).replace(/^\s+/, ''); return o.length - box.v.length; }, StringTrimRight: box => { const o = box.v; box.v = String(o).replace(/\s+$/, ''); return o.length - box.v.length; },
    StringToUpper: box => { box.v = String(box.v).toUpperCase(); return true; }, StringToLower: box => { box.v = String(box.v).toLowerCase(); return true; },
    StringReplace: (box, f, r) => { const s = String(box.v); if (!f) return 0; const n = s.split(f).length - 1; box.v = s.split(f).join(r); return n; },
    StringAdd: (box, x) => { box.v = String(box.v) + x; return true; }, StringConcatenate: (...a) => a.map(valStr).join(''), StringInit: (box, n, c) => { box.v = c ? String.fromCharCode(c).repeat(n) : ''; return true; },
    // ---- arrays
    ArrayResize: (a, n) => resize(a, n), ArraySize: a => (a ? a.length : 0), ArrayRange: a => a.length, ArrayFree: a => { a.length = 0; }, ArrayInitialize: (a, v) => { for (let i = 0; i < a.length; i++) a[i] = v; return a.length; },
    ArrayFill: (a, st, n, v) => { for (let i = st; i < st + n; i++) a[i] = v; }, ArraySetAsSeries: (a, f) => { a.__series = !!f; return true; }, ArrayGetAsSeries: a => !!a.__series, ArrayIsSeries: () => false, ArrayIsDynamic: () => true,
    ArrayCopy: (d, s, ds, ss, n) => { ds = ds || 0; ss = ss || 0; n = n == null || n < 0 ? s.length - ss : n; for (let i = 0; i < n; i++) d[ds + i] = s[ss + i]; return n; },
    ArrayMaximum: (a, st, n) => { st = st || 0; n = n == null || n < 0 ? a.length - st : n; let bi = -1; for (let i = st; i < st + n; i++) if (bi < 0 || a[i] > a[bi]) bi = i; return bi; },
    ArrayMinimum: (a, st, n) => { st = st || 0; n = n == null || n < 0 ? a.length - st : n; let bi = -1; for (let i = st; i < st + n; i++) if (bi < 0 || a[i] < a[bi]) bi = i; return bi; },
    ArraySort: a => { a.sort((x, y) => x - y); return true; }, ArrayReverse: a => { a.reverse(); return true; }, ZeroMemory: o => { if (Array.isArray(o)) o.length = 0; else for (const k in o) o[k] = typeof o[k] === 'string' ? '' : typeof o[k] === 'number' ? 0 : o[k]; },
    // ---- state
    GetLastError: () => X.lastErr, ResetLastError: () => { X.lastErr = 0; }, IsStopped: () => !R[inst.id] || !R[inst.id].running, GetPointer: o => o, CheckPointer: o => (o ? 1 : 0), ExpertRemove: () => { setTimeout(() => EA.stop(inst.id, 'ExpertRemove()'), 0); },
    TerminalInfoInteger: p => ({ TERMINAL_TRADE_ALLOWED: EA.st.algo ? 1 : 0, TERMINAL_CONNECTED: F.health === 'down' ? 0 : 1, TERMINAL_BUILD: 5000, TERMINAL_PING_LAST: 40000, TERMINAL_DLLS_ALLOWED: 0, TERMINAL_MAXBARS: 100000 }[p] || 0),
    TerminalInfoString: p => ({ TERMINAL_NAME: 'Amatu Trade', TERMINAL_COMPANY: 'Amatu', TERMINAL_LANGUAGE: 'Indonesian' }[p] || ''), TerminalInfoDouble: () => 0,
    MQLInfoInteger: p => ({ MQL_TRADE_ALLOWED: 1, MQL_TESTER: 0, MQL_OPTIMIZATION: 0, MQL_VISUAL_MODE: 0, MQL_DEBUG: 0, MQL_PROFILER: 0, MQL_DLLS_ALLOWED: 0, MQL_SIGNALS_ALLOWED: 0 }[p] || 0),
    MQLInfoString: p => (p === 'MQL_PROGRAM_NAME' ? inst.name : ''),
    EventSetTimer: s => { X.timerMs = Math.max(1, +s || 1) * 1000; X.nextTimer = Date.now() + X.timerMs; return true; },
    EventSetMillisecondTimer: ms => { X.timerMs = Math.max(50, +ms || 100); X.nextTimer = Date.now() + X.timerMs; return true; },
    EventKillTimer: () => { X.timerMs = 0; }, EventChartCustom: () => true,
    // ---- global variables (shared by all EAs on this device + synced)
    GlobalVariableSet: (n, v) => { GV[n] = { v: +v, t: Math.floor(Date.now() / 1000) }; saveGV(); return GV[n].t; },
    GlobalVariableGet: (n, box) => (GV[n] ? (box ? (out(box, GV[n].v), true) : GV[n].v) : (box ? false : 0)),
    GlobalVariableCheck: n => !!GV[n], GlobalVariableDel: n => { const had = !!GV[n]; delete GV[n]; saveGV(); return had; }, GlobalVariableTime: n => (GV[n] ? GV[n].t : 0),
    GlobalVariablesDeleteAll: (pre) => { let n = 0; for (const k of Object.keys(GV)) if (!pre || k.startsWith(pre)) { delete GV[k]; n++; } saveGV(); return n; },
    GlobalVariablesTotal: () => Object.keys(GV).length, GlobalVariableName: i => Object.keys(GV)[i] || '', GlobalVariablesFlush: () => { U.save(K_GV, GV); }, GlobalVariableTemp: () => true,
    // ---- account
    AccountInfoDouble: p => { const a = acc(); if (!a) return 0; const m = E.metrics(a); return { ACCOUNT_BALANCE: a.bal, ACCOUNT_EQUITY: m.eq, ACCOUNT_PROFIT: m.fl + m.swap, ACCOUNT_MARGIN: m.margin, ACCOUNT_MARGIN_FREE: m.free, ACCOUNT_MARGIN_LEVEL: m.ml || 0, ACCOUNT_CREDIT: 0, ACCOUNT_MARGIN_SO_CALL: S.ACCOUNT_TYPES[a.type].mc, ACCOUNT_MARGIN_SO_SO: S.ACCOUNT_TYPES[a.type].so, ACCOUNT_ASSETS: 0, ACCOUNT_LIABILITIES: 0, ACCOUNT_COMMISSION_BLOCKED: 0 }[p] || 0; },
    AccountInfoInteger: p => { const a = acc(); if (!a) return 0; return { ACCOUNT_LOGIN: +a.id, ACCOUNT_LEVERAGE: a.lev || 2000000, ACCOUNT_TRADE_MODE: 0, ACCOUNT_MARGIN_MODE: 2, ACCOUNT_LIMIT_ORDERS: 0, ACCOUNT_TRADE_ALLOWED: a.archived ? 0 : 1, ACCOUNT_TRADE_EXPERT: 1, ACCOUNT_CURRENCY_DIGITS: 2, ACCOUNT_MARGIN_SO_MODE: 0, ACCOUNT_FIFO_CLOSE: 0, ACCOUNT_HEDGE_ALLOWED: 1 }[p] || 0; },
    AccountInfoString: p => { const a = acc(); if (!a) return ''; return { ACCOUNT_CURRENCY: a.cur, ACCOUNT_NAME: a.nick, ACCOUNT_SERVER: 'Amatu-Trade', ACCOUNT_COMPANY: 'Amatu' }[p] || ''; },
    // ---- symbols
    SymbolInfoDouble: (s, p, box) => {
      const sym = symbol(s); if (!sym) return out(box, 0); const a = acc(); const x = q(s);
      const cs = E.cs(a, sym); const tv = (F.convert(sym.pt * cs, sym.quote, a ? a.cur : 'USD') || 0);
      const v = { SYMBOL_BID: x ? x.bid : 0, SYMBOL_ASK: x ? x.ask : 0, SYMBOL_LAST: x ? x.bid : 0, SYMBOL_BIDHIGH: x ? x.bid : 0, SYMBOL_BIDLOW: x ? x.bid : 0, SYMBOL_POINT: sym.pt, SYMBOL_TRADE_TICK_SIZE: sym.pt,
        SYMBOL_TRADE_TICK_VALUE: tv, SYMBOL_TRADE_TICK_VALUE_PROFIT: tv, SYMBOL_TRADE_TICK_VALUE_LOSS: tv, SYMBOL_TRADE_CONTRACT_SIZE: cs, SYMBOL_VOLUME_MIN: sym.min, SYMBOL_VOLUME_MAX: sym.max, SYMBOL_VOLUME_STEP: sym.step,
        SYMBOL_VOLUME_LIMIT: 0, SYMBOL_SWAP_LONG: sym.sw[0], SYMBOL_SWAP_SHORT: sym.sw[1], SYMBOL_MARGIN_INITIAL: 0, SYMBOL_MARGIN_MAINTENANCE: 0, SYMBOL_SESSION_VOLUME: 0 }[p];
      return out(box, v || 0);
    },
    SymbolInfoInteger: (s, p, box) => {
      const sym = symbol(s); if (!sym) return out(box, 0); const x = q(s);
      const v = { SYMBOL_DIGITS: sym.dg, SYMBOL_SPREAD: x ? Math.round((x.ask - x.bid) / sym.pt) : 0, SYMBOL_SPREAD_FLOAT: 1, SYMBOL_TRADE_STOPS_LEVEL: 0, SYMBOL_TRADE_FREEZE_LEVEL: 0, SYMBOL_TRADE_MODE: F.isOpen(sym.s) ? 4 : 0,
        SYMBOL_FILLING_MODE: 3, SYMBOL_EXPIRATION_MODE: 15, SYMBOL_ORDER_MODE: 127, SYMBOL_SELECT: 1, SYMBOL_VISIBLE: 1, SYMBOL_TIME: Math.floor(Date.now() / 1000), SYMBOL_TRADE_EXEMODE: 2, SYMBOL_SWAP_ROLLOVER3DAYS: 3 }[p];
      return out(box, v || 0);
    },
    SymbolInfoString: (s, p, box) => { const sym = symbol(s); if (!sym) return out(box, ''); return out(box, { SYMBOL_DESCRIPTION: sym.d, SYMBOL_CURRENCY_BASE: sym.base, SYMBOL_CURRENCY_PROFIT: sym.quote, SYMBOL_CURRENCY_MARGIN: sym.mm === 'fx' ? sym.base : sym.quote, SYMBOL_PATH: sym.g + '\\' + sym.s, SYMBOL_ISIN: '' }[p] || ''); },
    SymbolInfoTick: (s, t) => { const x = q(s); if (!x) return false; t.bid = x.bid; t.ask = x.ask; t.last = x.bid; t.time = Math.floor(Date.now() / 1000); t.time_msc = Date.now(); return true; },
    SymbolSelect: () => true, SymbolsTotal: () => S.list.length, SymbolName: i => (S.list[i] ? S.list[i].s : ''), SymbolExist: s => !!symOf(s), SymbolIsSynchronized: () => true,
    SymbolInfoSessionTrade: () => false, SymbolInfoSessionQuote: () => false,
    // ---- positions
    PositionsTotal: () => { const a = acc(); return a ? a.pos.length : 0; },
    PositionGetTicket: i => { const a = acc(); const p = a && a.pos[i]; X.sel.pos = p || null; return p ? +p.id : 0; },
    PositionGetSymbol: i => { const a = acc(); const p = a && a.pos[i]; X.sel.pos = p || null; return p ? p.sym : ''; },
    PositionSelect: s => { const a = acc(); const id = symOf(s); const p = a && a.pos.find(x => x.sym === id); X.sel.pos = p || null; return !!p; },
    PositionSelectByTicket: t => { const p = findPos(t); X.sel.pos = p; return !!p; },
    PositionGetDouble: (prop, box) => { const p = X.sel.pos; if (!p) return out(box, 0); const x = q(p.sym); const v = { POSITION_VOLUME: p.vol, POSITION_PRICE_OPEN: p.open, POSITION_PRICE_CURRENT: x ? (p.side === 'buy' ? x.bid : x.ask) : p.open, POSITION_SL: p.sl || 0, POSITION_TP: p.tp || 0, POSITION_PROFIT: E.profit(acc(), p) || 0, POSITION_SWAP: p.swap || 0, POSITION_COMMISSION: p.comm || 0 }[prop]; return out(box, v || 0); },
    PositionGetInteger: (prop, box) => { const p = X.sel.pos; if (!p) return out(box, 0); const v = { POSITION_TICKET: +p.id, POSITION_IDENTIFIER: +p.id, POSITION_TYPE: p.side === 'buy' ? 0 : 1, POSITION_MAGIC: p.magic || 0, POSITION_TIME: Math.floor(p.t / 1000), POSITION_TIME_MSC: p.t, POSITION_TIME_UPDATE: Math.floor(p.t / 1000), POSITION_REASON: p.magic ? 3 : 0 }[prop]; return out(box, v || 0); },
    PositionGetString: (prop, box) => { const p = X.sel.pos; if (!p) return out(box, ''); return out(box, { POSITION_SYMBOL: p.sym, POSITION_COMMENT: p.cmt || '', POSITION_EXTERNAL_ID: '' }[prop] || ''); },
    // ---- orders
    OrdersTotal: () => { const a = acc(); return a ? a.ord.length : 0; },
    OrderGetTicket: i => { const a = acc(); const o = a && a.ord[i]; X.sel.ord = o || null; return o ? +o.id : 0; },
    OrderSelect: t => { const o = findOrd(t); X.sel.ord = o; return !!o; },
    OrderGetDouble: (prop, box) => { const o = X.sel.ord; if (!o) return out(box, 0); const x = q(o.sym); return out(box, { ORDER_PRICE_OPEN: o.price, ORDER_VOLUME_CURRENT: o.vol, ORDER_VOLUME_INITIAL: o.vol, ORDER_SL: o.sl || 0, ORDER_TP: o.tp || 0, ORDER_PRICE_CURRENT: x ? (o.side === 'buy' ? x.ask : x.bid) : 0, ORDER_PRICE_STOPLIMIT: 0 }[prop] || 0); },
    OrderGetInteger: (prop, box) => { const o = X.sel.ord; if (!o) return out(box, 0); return out(box, { ORDER_TICKET: +o.id, ORDER_TYPE: ordType(o), ORDER_MAGIC: o.magic || 0, ORDER_TIME_SETUP: Math.floor(o.t / 1000), ORDER_TIME_SETUP_MSC: o.t, ORDER_STATE: 1, ORDER_TYPE_TIME: o.exp ? 2 : 0, ORDER_TIME_EXPIRATION: o.exp ? Math.floor(o.exp / 1000) : 0, ORDER_TYPE_FILLING: 2, ORDER_POSITION_ID: 0 }[prop] || 0); },
    OrderGetString: (prop, box) => { const o = X.sel.ord; if (!o) return out(box, ''); return out(box, { ORDER_SYMBOL: o.sym, ORDER_COMMENT: o.cmt || '' }[prop] || ''); },
    OrderCalcMargin: (ty, s, vol, px, box) => { const id = symOf(s); const a = acc(); if (!id || !a) return false; const m = E.marginFor(a, id, sideOfType(ty), +vol, +px || null, E.metrics(a).eqUsd); if (m == null) return false; box.v = m; return true; },
    OrderCalcProfit: (ty, s, vol, o1, o2, box) => { const id = symOf(s); const a = acc(); if (!id || !a) return false; const p = E.profit(a, { sym: id, side: sideOfType(ty), vol: +vol, open: +o1 }, +o2); if (p == null) return false; box.v = p; return true; },
    OrderCheck: (req, res) => { res.retcode = 0; return true; },
    OrderSend: (req, res) => {
      let r;
      const a = +req.action;
      if (a === 1) r = req.position ? closePos(req.position, req.volume) : openMkt(sideOfType(req.type), req.volume, req.symbol, req.sl, req.tp, req.comment, req.magic);
      else if (a === 5) r = placePend(sideOfType(req.type), kindOfType(req.type), req.volume, req.price, req.symbol, req.sl, req.tp, req.comment, req.magic, req.type_time === 2 ? req.expiration : 0);
      else if (a === 6) r = modPos(req.position, req.sl, req.tp);
      else if (a === 7) r = modOrd(req.order, req.price, req.sl, req.tp);
      else if (a === 8) r = delOrd(req.order);
      else r = { rc: 10013 };
      res.retcode = r.rc; res.order = r.order || 0; res.deal = r.deal || 0; res.price = r.price || 0; res.volume = r.vol || 0; res.comment = RC_TXT[r.rc] || '';
      const x = q(req.symbol); if (x) { res.bid = x.bid; res.ask = x.ask; }
      X.lastErr = r.rc === 10009 || r.rc === 10008 ? 0 : 4756;
      return r.rc === 10009 || r.rc === 10008;
    },
    OrderSendAsync: (req, res) => env.OrderSend(req, res),
    // ---- history (closed positions → deals)
    HistorySelect: () => true, HistorySelectByPosition: () => true,
    HistoryDealsTotal: () => { X.deals = (E.history(inst.acc) || []).filter(h => !h.ord); return X.deals.length; },
    HistoryDealGetTicket: i => { const d = (X.deals || [])[i]; X.selDeal = d || null; return d ? (+d.id) * 10 + 1 : 0; },
    HistoryDealSelect: t => { const d = (X.deals || E.history(inst.acc).filter(h => !h.ord)).find(h => (+h.id) * 10 + 1 === +t); X.selDeal = d || null; return !!d; },
    HistoryDealGetDouble: (t, prop, box) => { const d = dealOf(t); if (!d) return out(box, 0); return out(box, { DEAL_PROFIT: d.pl, DEAL_VOLUME: d.vol, DEAL_PRICE: d.close, DEAL_SWAP: d.swap || 0, DEAL_COMMISSION: d.comm || 0, DEAL_FEE: 0 }[prop] || 0); },
    HistoryDealGetInteger: (t, prop, box) => { const d = dealOf(t); if (!d) return out(box, 0); return out(box, { DEAL_TICKET: (+d.id) * 10 + 1, DEAL_ORDER: +d.id, DEAL_POSITION_ID: +d.id, DEAL_MAGIC: d.magic || 0, DEAL_TYPE: d.side === 'buy' ? 1 : 0, DEAL_ENTRY: 1, DEAL_TIME: Math.floor(d.t1 / 1000), DEAL_TIME_MSC: d.t1, DEAL_REASON: d.reason === 'TP' ? 5 : d.reason === 'SL' ? 4 : d.reason === 'Stop Out' ? 6 : d.magic ? 3 : 0 }[prop] || 0); },
    HistoryDealGetString: (t, prop, box) => { const d = dealOf(t); if (!d) return out(box, ''); return out(box, { DEAL_SYMBOL: d.sym, DEAL_COMMENT: d.cmt || '' }[prop] || ''); },
    HistoryOrdersTotal: () => 0, HistoryOrderGetTicket: () => 0, HistoryOrderGetInteger: () => 0, HistoryOrderGetDouble: () => 0, HistoryOrderGetString: () => '',
    // ---- series & indicators
    Bars: (s, tf) => bars(s, tf).length, iBars: (s, tf) => bars(s, tf).length,
    iOpen: (s, tf, sh) => { const b = barAt(s, tf, sh); return b ? b.open : 0; }, iHigh: (s, tf, sh) => { const b = barAt(s, tf, sh); return b ? b.high : 0; },
    iLow: (s, tf, sh) => { const b = barAt(s, tf, sh); return b ? b.low : 0; }, iClose: (s, tf, sh) => { const b = barAt(s, tf, sh); return b ? b.close : 0; },
    iTime: (s, tf, sh) => { const b = barAt(s, tf, sh); return b ? b.time : 0; }, iVolume: (s, tf, sh) => { const b = barAt(s, tf, sh); return b ? b.vol : 0; }, iTickVolume: (s, tf, sh) => { const b = barAt(s, tf, sh); return b ? b.vol : 0; },
    iHighest: (s, tf, mode, n, st) => { const b = bars(s, tf); st = st || 0; n = n == null || n < 0 ? b.length - st : n; let bi = -1, bv = -Infinity; for (let sh = st; sh < st + n && sh < b.length; sh++) { const x = b[b.length - 1 - sh]; const v = mode === 1 ? x.low : mode === 0 ? x.open : mode === 3 ? x.close : x.high; if (v > bv) { bv = v; bi = sh; } } return bi; },
    iLowest: (s, tf, mode, n, st) => { const b = bars(s, tf); st = st || 0; n = n == null || n < 0 ? b.length - st : n; let bi = -1, bv = Infinity; for (let sh = st; sh < st + n && sh < b.length; sh++) { const x = b[b.length - 1 - sh]; const v = mode === 2 ? x.high : mode === 0 ? x.open : mode === 3 ? x.close : x.low; if (v < bv) { bv = v; bi = sh; } } return bi; },
    iBarShift: (s, tf, t) => { const b = bars(s, tf); for (let i = b.length - 1; i >= 0; i--) if (b[i].time <= t) return b.length - 1 - i; return -1; },
    CopyRates: (s, tf, st, n, arr) => { if (arr.__def === undefined || arr.__def === 0) arr.__def = () => new MqlRates(); return copySeries(s, tf, st, n, arr, b => Object.assign(new MqlRates(), { time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, tick_volume: b.vol })); },
    CopyOpen: (s, tf, st, n, a) => copySeries(s, tf, st, n, a, b => b.open), CopyHigh: (s, tf, st, n, a) => copySeries(s, tf, st, n, a, b => b.high), CopyLow: (s, tf, st, n, a) => copySeries(s, tf, st, n, a, b => b.low),
    CopyClose: (s, tf, st, n, a) => copySeries(s, tf, st, n, a, b => b.close), CopyTime: (s, tf, st, n, a) => copySeries(s, tf, st, n, a, b => b.time), CopyTickVolume: (s, tf, st, n, a) => copySeries(s, tf, st, n, a, b => b.vol),
    iATR: (s, tf, p) => ind('atr', s, tf, [+p || 14]), iMA: (s, tf, p, sh, m, ap) => ind('ma', s, tf, [+p || 14, +sh || 0, +m || 0, +ap || 1]), iRSI: (s, tf, p, ap) => ind('rsi', s, tf, [+p || 14, +ap || 1]),
    iBands: (s, tf, p, sh, dev, ap) => ind('bands', s, tf, [+p || 20, +sh || 0, +dev || 2, +ap || 1]), iMACD: (s, tf, f, sl, sg, ap) => ind('macd', s, tf, [+f || 12, +sl || 26, +sg || 9, +ap || 1]),
    iStochastic: (s, tf, k, d, sl) => ind('stoch', s, tf, [+k || 5, +d || 3, +sl || 3]),
    iCustom: (s, tf, name) => { log('iCustom("' + name + '") tidak didukung di browser', 'err'); return -1; },
    iADX: () => { log('iADX belum didukung', 'err'); return -1; }, iCCI: () => { log('iCCI belum didukung', 'err'); return -1; }, iSAR: () => { log('iSAR belum didukung', 'err'); return -1; },
    IndicatorRelease: h => { if (X.handles[h]) X.handles[h] = null; return true; }, BarsCalculated: h => { const x = X.handles[h]; if (!x) return -1; const v = calcInd(x)[0]; return v.filter(y => !isNaN(y)).length; },
    CopyBuffer: (h, buf, st, n, arr) => {
      const x = X.handles[h]; if (!x) { X.lastErr = 4807; return -1; }
      const v = calcInd(x)[+buf || 0]; if (!v || !v.length) return -1;
      const L = v.length; st = +st; n = +n;
      if (st > 1e8) { const b = series(x.sym, x.tf).b; let i = b.length - 1; while (i > 0 && b[i].time > st) i--; st = L - 1 - i; }
      if (n > L - st) n = L - st; if (n <= 0) return -1;
      if (isNaN(v[L - 1 - (st + n - 1)])) { const ok = []; for (let j = 0; j < n; j++) if (!isNaN(v[L - 1 - (st + j)])) ok.push(j); if (!ok.length) return -1; n = ok[ok.length - 1] + 1; }
      if (arr.__def === undefined) arr.__def = 0; resize(arr, n);
      for (let j = 0; j < n; j++) { const sh = arr.__series ? st + j : st + n - 1 - j; arr[j] = v[L - 1 - sh]; }
      return n;
    },
    // ---- chart & objects
    ChartID: () => 0, ChartRedraw: () => { X.dirty = true; }, ChartSymbol: () => inst.sym, ChartPeriod: () => SEC_TF[inst.tf] || 5, ChartSetInteger: () => true, ChartSetDouble: () => true, ChartSetString: () => true,
    ChartGetInteger: (c, p) => { const h = document.querySelector('#chost'); return p === 104 || p === 'CHART_WIDTH_IN_PIXELS' ? (h ? h.clientWidth : 800) : p === 105 || p === 'CHART_HEIGHT_IN_PIXELS' ? (h ? h.clientHeight : 500) : 0; },
    ChartGetDouble: () => 0, ChartGetString: () => '', ChartNavigate: () => true, ChartApplyTemplate: () => false, ChartSaveTemplate: () => false, WindowRedraw: () => { X.dirty = true; },
    ObjectCreate: (c, name, type) => { if (X.objs.has(name)) return false; X.objs.set(name, { type: +type, p: { OBJPROP_COLOR: 0xFFFFFF, OBJPROP_FONTSIZE: 10, OBJPROP_FONT: 'Arial', OBJPROP_TEXT: name === '' ? '' : (+type === 102 ? 'Label' : '') } }); X.dirty = true; return true; },
    ObjectDelete: (c, name) => { const r = X.objs.delete(name); X.dirty = true; return r; }, ObjectFind: (c, name) => (X.objs.has(name) ? 0 : -1),
    ObjectsDeleteAll: (c, a, b, t) => { let n = 0; for (const [k, o] of Array.from(X.objs)) { if (typeof a === 'string' && a && !k.startsWith(a)) continue; if (t != null && t >= 0 && o.type !== t) continue; X.objs.delete(k); n++; } X.dirty = true; return n; },
    ObjectsTotal: () => X.objs.size, ObjectName: (c, i) => Array.from(X.objs.keys())[i] || '',
    ObjectSetInteger: (c, name, prop, a, b) => objSet(name, prop, a, b), ObjectSetDouble: (c, name, prop, a, b) => objSet(name, prop, a, b), ObjectSetString: (c, name, prop, a, b) => objSet(name, prop, a, b),
    ObjectGetInteger: (c, name, prop, mod, box) => objGet(name, prop, box), ObjectGetDouble: (c, name, prop, mod, box) => objGet(name, prop, box), ObjectGetString: (c, name, prop, mod, box) => objGet(name, prop, box),
    ObjectMove: () => true, ObjectSetText: (name, text) => objSet(name, 'OBJPROP_TEXT', text),
    // ---- economic calendar (ForexFactory feed of the terminal)
    CalendarValueHistory: (arr, from, to, country, cur) => {
      const ev = AT.Pn && AT.Pn.calAll ? AT.Pn.calAll() : []; arr.length = 0;
      for (const e of ev) { const t = Math.floor(e.t / 1000); if (t < from || (to && t > to)) continue; if (cur && e.cur !== cur) continue; X.cal.set(e.id, e); arr.push(Object.assign(new MqlCalendarValue(), { id: e.id, event_id: e.id, time: t })); }
      return arr.length;
    },
    CalendarValueLast: () => 0, CalendarEventByCurrency: () => 0, CalendarCountries: () => 0,
    CalendarEventById: (id, ev) => { const e = X.cal.get(+id) || (AT.Pn && AT.Pn.calAll ? AT.Pn.calAll().find(x => x.id === +id) : null); if (!e) return false; ev.id = e.id; ev.importance = e.imp; ev.name = e.title; return true; },
    // ---- files / web (not available in the browser sandbox)
    FileOpen: () => -1, FileClose: () => { }, FileWrite: () => 0, FileWriteString: () => 0, FileReadString: () => '', FileIsExist: () => false, FileDelete: () => false, WebRequest: () => { log('WebRequest tidak didukung', 'err'); return -1; }
  };
  function dealOf(t) { if (X.selDeal && (+X.selDeal.id) * 10 + 1 === +t) return X.selDeal; return (X.deals || []).find(h => (+h.id) * 10 + 1 === +t) || null; }
  Object.assign(env, NUM, CLR);
  Object.defineProperty(env, '_Symbol', { get: () => inst.sym }); Object.defineProperty(env, '_Period', { get: () => SEC_TF[inst.tf] || 5 });
  Object.defineProperty(env, '_Point', { get: () => S.map[inst.sym].pt }); Object.defineProperty(env, '_Digits', { get: () => S.map[inst.sym].dg });
  Object.defineProperty(env, '_LastError', { get: () => X.lastErr }); Object.defineProperty(env, '_StopFlag', { get: () => false });
  const proxy = new Proxy(env, {
    has: (t, k) => typeof k === 'string' && (k in t || (isConst(k) && k !== 'JSON') || /^clr[A-Z]/.test(k)),
    get: (t, k) => { if (typeof k !== 'string') return undefined; if (k in t) return t[k]; if (/^clr[A-Z]/.test(k)) return 0xC0C0C0; return k; }
  });
  return { X, env: proxy };
}

/* ================= library & compile ================= */
EA.libItems = () => BUILTIN.map(b => Object.assign({ builtin: true }, b)).concat(EA.lib.map(l => Object.assign({ builtin: false }, l)));
EA.libItem = id => EA.libItems().find(x => x.id === id) || null;
async function source(libId) {
  if (SRC[libId] != null) return SRC[libId];
  const it = EA.libItem(libId); if (!it) throw new Error('EA tidak ditemukan di pustaka');
  if (it.builtin) { const r = await fetch(it.file + '?v=' + AT.VER, { cache: 'no-cache' }); if (!r.ok) throw new Error('Gagal memuat ' + it.file); SRC[libId] = await r.text(); }
  else SRC[libId] = it.code;
  return SRC[libId];
}
EA.compiled = async function (libId) {
  const src = await source(libId);
  if (COMPILED[libId] && COMPILED[libId].src === src) return COMPILED[libId];
  const c = AT.MQL.compile(src); c.src = src; COMPILED[libId] = c; return c;
};
EA.importSource = function (name, code) {
  const c = AT.MQL.compile(code); // throws with a line number when unsupported
  const nm = (name || 'EA').replace(/\.(mq5|mqh|txt)$/i, '').slice(0, 40);
  const ex = EA.lib.find(x => x.name === nm);
  if (ex) { ex.code = code; ex.t = Date.now(); delete SRC[ex.id]; delete COMPILED[ex.id]; saveLib(); return { item: ex, c, updated: true }; }
  const item = { id: 'u' + U.uid(), name: nm, code, t: Date.now(), desc: c.props.description || '' };
  EA.lib.push(item); saveLib();
  return { item, c };
};
EA.removeLib = id => { if (EA.st.list.some(x => x.lib === id)) return false; EA.lib = EA.lib.filter(x => x.id !== id); delete SRC[id]; delete COMPILED[id]; saveLib(); return true; };

/* ================= instances ================= */
EA.log = function (id, msg, lv) {
  const r = R[id] || (R[id] = { log: U.load(kLog(id), []) || [] });
  const line = { t: Date.now(), m: String(msg).slice(0, 400), lv: lv || '' };
  r.log.push(line); if (r.log.length > 400) r.log.splice(0, r.log.length - 400);
  clearTimeout(r.logT); r.logT = setTimeout(() => U.save(kLog(id), r.log.slice(-200)), 1000);
  U.emit('ea-log', id);
};
EA.logs = id => (R[id] && R[id].log) || (U.load(kLog(id), []) || []);
EA.inst = id => EA.st.list.find(x => x.id === id) || null;
EA.status = id => { const r = R[id]; const i = EA.inst(id); if (!i) return { k: 'off', t: '' }; if (r && r.err) return { k: 'err', t: r.err }; if (r && r.running) return EA.st.algo ? { k: 'on', t: 'Berjalan' } : { k: 'wait', t: 'Algo Trading OFF' }; if (i.run && !mine(i)) return { k: 'wait', t: 'Berjalan di perangkat lain' }; if (i.run && !AT.isLeader()) return { k: 'wait', t: 'Berjalan di tab lain' }; if (i.run) return { k: 'wait', t: 'Menyiapkan…' }; return { k: 'off', t: 'Berhenti' }; };

EA.attach = function (o) {
  const inst = { id: 'e' + U.uid(), lib: o.lib, name: o.name, sym: o.sym, tf: o.tf || 300, acc: o.acc, inputs: o.inputs || {}, run: true, created: Date.now(), dev: DEV };
  EA.st.list.push(inst); saveSt();
  EA.log(inst.id, 'Dipasang: ' + inst.name + ' pada ' + S.map[inst.sym].n + ' ' + tfName(inst.tf) + ', akun #' + inst.acc);
  if (AT.isLeader()) EA.start(inst.id);
  U.emit('ea');
  return inst;
};
EA.update = function (id, o) {
  const inst = EA.inst(id); if (!inst) return;
  const wasRunning = R[id] && R[id].running;
  if (wasRunning) EA.stop(id, null, 5);
  Object.assign(inst, o); saveSt();
  if (inst.run && mine(inst) && AT.isLeader()) EA.start(id);
  U.emit('ea');
};
EA.remove = function (id) {
  const inst = EA.inst(id); if (!inst) return;
  if (R[id] && R[id].running) EA.stop(id, 'Dilepas', 1);
  EA.st.list = EA.st.list.filter(x => x.id !== id); saveSt();
  U.del(kLog(id)); delete R[id];
  U.emit('ea'); drawOverlay();
};
EA.toggleRun = function (id) {
  const inst = EA.inst(id); if (!inst) return;
  if (inst.run) { inst.run = false; saveSt(); EA.stop(id, 'Dihentikan', 1); }
  else { inst.run = true; inst.dev = DEV; saveSt(); if (AT.isLeader()) EA.start(id); }
  U.emit('ea');
};
/* move a running EA to this device (the other device stops it when it sees the change) */
EA.claim = function (id) { const inst = EA.inst(id); if (!inst) return; inst.dev = DEV; inst.run = true; saveSt(); EA.log(id, 'Dipindahkan ke perangkat ini'); if (AT.isLeader()) EA.start(id); U.emit('ea'); };
/* one click: LITUS on XAU/USD M5 + BTC M5 like the MT5 setup (BTC uses its own magic) */
EA.setupLitus = function () {
  const a = E.active(); const made = [];
  for (const [sym, magic] of [['XAUUSD', 20261120], ['BTCUSD', 20261130]]) {
    if (!S.map[sym] || EA.st.list.some(x => x.lib === 'litus' && x.sym === sym && x.acc === a.id)) continue;
    made.push(EA.attach({ lib: 'litus', name: 'LITUS', sym, tf: 300, acc: a.id, inputs: magic === 20261120 ? {} : { InpMagic: magic } }));
  }
  return made;
};
function reloadSt() {
  const st = U.load(K_ST, null); if (!st || !Array.isArray(st.list)) return;
  EA.st = Object.assign({ v: 1, algo: true, list: [] }, st);
  for (const id of Object.keys(R)) { const i = EA.inst(id); const r = R[id]; if (r && r.running && (!i || !i.run || !mine(i))) EA.stop(id, !i ? 'Dilepas di perangkat lain' : !i.run ? 'Dihentikan di perangkat lain' : 'Dipindahkan ke perangkat lain', !i || !i.run ? 1 : 9); }
  U.emit('ea'); drawOverlay();
}
window.addEventListener('storage', e => { if (e.key === K_ST) reloadSt(); else if (e.key === K_LIB) { EA.lib = U.load(K_LIB, []) || []; U.emit('ea'); } else if (e.key === K_GV) GV = U.load(K_GV, {}) || {}; });
document.addEventListener('amatu:change', e => { const d = e.detail || {}; const keys = (d.keys || (d.key ? [d.key] : [])).map(k => String(k).replace(/^ls:/, '')); if (!keys.length || keys.includes(K_ST)) setTimeout(reloadSt, 300); if (keys.includes(K_LIB)) { EA.lib = U.load(K_LIB, []) || []; U.emit('ea'); } if (keys.includes(K_GV)) GV = U.load(K_GV, {}) || {}; });
EA.setAlgo = function (on) { EA.st.algo = !!on; saveSt(); for (const i of EA.st.list) EA.log(i.id, 'Algo Trading ' + (on ? 'ON' : 'OFF')); U.emit('ea'); drawOverlay(); };
const tfName = s => (EA.TFS.find(x => x[0] === s) || [0, 'M' + Math.round(s / 60)])[1];
EA.tfName = tfName;

/* run one MQL handler with emits batched and notifications muted */
function call(id, name, args) {
  const r = R[id]; if (!r || !r.prog || !r.prog[name]) return undefined;
  const emitOrig = U.emit; const q = new Map();
  U.emit = (ev, d) => { if (ev === 'ea-log') return emitOrig(ev, d); q.set(ev + '|' + (d == null ? '' : typeof d === 'object' ? JSON.stringify(d) : d), [ev, d]); };
  E.mute = true; r.busy = true;
  const t0 = performance.now();
  try { return r.prog[name].apply(null, args || []); }
  catch (e) {
    r.err = name + ': ' + (e && e.message || e);
    EA.log(id, 'ERROR di ' + name + ': ' + (e && e.message || e) + ' — EA dihentikan', 'err');
    console.warn('EA', id, e);
    r.running = false; r.timerOn = false;
    U.toast('EA dihentikan', U.esc(EA.inst(id).name + ': ' + (e && e.message || e)), 'error', 9000);
    return undefined;
  } finally {
    r.busy = false; E.mute = false; U.emit = emitOrig;
    const dt = performance.now() - t0; if (dt > 250) EA.log(id, name + ' lambat: ' + Math.round(dt) + ' ms', 'warn');
    for (const [ev, d] of q.values()) U.emit(ev, d);
    if (r.X && r.X.dirty) { r.X.dirty = false; drawOverlay(); }
  }
}
EA.start = async function (id) {
  const inst = EA.inst(id); if (!inst) return;
  const r = R[id] || (R[id] = { log: U.load(kLog(id), []) || [] });
  if (r.running || r.starting) return;
  r.starting = true; r.err = null;
  try {
    if (!S.map[inst.sym]) throw new Error('simbol ' + inst.sym + ' tidak ada');
    if (!E.acc(inst.acc)) throw new Error('akun #' + inst.acc + ' tidak ada');
    const c = await EA.compiled(inst.lib);
    const { X, env } = makeEnv(inst);
    const ins = {};
    for (const p of c.inputs) if (inst.inputs[p.name] !== undefined) ins[p.name] = inst.inputs[p.name];
    const inp = (n, d) => (Object.prototype.hasOwnProperty.call(ins, n) ? ins[n] : d);
    const sc = series(inst.sym, inst.tf); // load bars first so OnInit can read history (CopyRates, iTime…)
    if (sc.loading) await Promise.race([sc.loading, new Promise(res => setTimeout(res, 6000))]);
    if (!EA.inst(id) || !inst.run) return;
    r.X = X; r.prog = c.fn(env, inp); r.c = c;
    r.running = true; r.lastTick = 0;
    EA.log(id, inst.name + ' dimulai pada ' + S.map[inst.sym].n + ' ' + tfName(inst.tf) + (c.warn.length ? ' — ' + c.warn.join('; ') : ''));
    const res = call(id, 'OnInit');
    if (r.err) throw new Error(r.err);
    if (res != null && +res !== 0) { call(id, 'OnDeinit', [8]); throw new Error('OnInit gagal (kode ' + res + ')'); }
    U.emit('ea');
  } catch (e) {
    r.running = false; r.err = String(e && e.message || e);
    EA.log(id, 'Gagal mulai: ' + r.err, 'err');
    U.emit('ea');
  } finally { r.starting = false; drawOverlay(); }
};
EA.stop = function (id, why, reason) {
  const r = R[id]; if (!r || !r.running) { if (r) { r.err = null; } U.emit('ea'); return; }
  call(id, 'OnDeinit', [reason == null ? 0 : reason]);
  r.running = false; r.prog = null;
  if (r.X) { r.X.objs.clear(); r.X.comment = ''; }
  if (why) EA.log(id, why);
  U.emit('ea'); drawOverlay();
};

/* ticks + timers, leader tab only */
U.on('ticks', ids => {
  if (!AT.isLeader()) return;
  const set = ids ? new Set(ids) : null; const now = Date.now();
  for (const inst of EA.st.list) {
    const r = R[inst.id]; if (!r || !r.running || r.busy) continue;
    if (set && !set.has(inst.sym)) continue;
    if (now - (r.lastTick || 0) < 150) { r.pendingTick = true; continue; }
    r.lastTick = now; r.pendingTick = false;
    series(inst.sym, inst.tf);
    call(inst.id, 'OnTick');
  }
});
setInterval(() => {
  const now = Date.now();
  if (!AT.isLeader()) { for (const inst of EA.st.list) { const r = R[inst.id]; if (r && r.running) EA.stop(inst.id, 'Pindah ke tab lain', 9); } return; }
  for (const inst of EA.st.list) {
    const r = R[inst.id];
    if (r && r.running && !mine(inst)) { EA.stop(inst.id, 'Dipindahkan ke perangkat lain', 9); continue; }
    if (inst.run && mine(inst) && (!r || (!r.running && !r.starting && !r.err))) { if (!inst.dev) { inst.dev = DEV; saveSt(); } if (EA.ready) EA.start(inst.id); continue; }
    if (!r || !r.running || r.busy) continue;
    if (r.pendingTick && now - r.lastTick >= 150) { r.lastTick = now; r.pendingTick = false; call(inst.id, 'OnTick'); }
    if (r.X && r.X.timerMs && now >= r.X.nextTimer) { r.X.nextTimer = now + r.X.timerMs; call(inst.id, 'OnTimer'); }
  }
}, 100);
U.on('ticks', () => { if (!EA.ready) setTimeout(() => { EA.ready = true; }, 2500); });

/* ================= chart overlay: EA objects, comment, badge ================= */
let ovlQ = false;
function drawOverlay() { if (ovlQ) return; ovlQ = true; requestAnimationFrame(() => { ovlQ = false; renderOverlay(); }); }
EA.drawOverlay = drawOverlay;
U.on('chart-loaded', drawOverlay);
function renderOverlay() {
  const host = document.querySelector('#chost'); if (!host) return;
  let ov = host.querySelector('.ea-ovl');
  if (!ov) { ov = U.el('div.ea-ovl'); host.append(ov); }
  const sym = AT.T && AT.T.chart ? AT.T.chart.sym : null;
  const list = EA.st.list.filter(i => i.sym === sym);
  let html = '';
  const W = host.clientWidth, H = host.clientHeight;
  for (const inst of list) {
    const r = R[inst.id]; const st = EA.status(inst.id);
    if (r && r.running && r.X) {
      if (r.X.comment) html += '<pre class="ea-cmt">' + U.esc(r.X.comment) + '</pre>';
      for (const [name, o] of r.X.objs) {
        const p = o.p; if (p.OBJPROP_HIDDEN_FROM_ALL) continue;
        if (![102, 103, 107, 110, 106].includes(o.type)) continue;
        const x = +p.OBJPROP_XDISTANCE || 0, y = +p.OBJPROP_YDISTANCE || 0, cn = +p.OBJPROP_CORNER || 0;
        const pos = (cn === 0 ? 'left:' + x + 'px;top:' + y + 'px;' : cn === 1 ? 'left:' + x + 'px;bottom:' + y + 'px;' : cn === 2 ? 'right:' + x + 'px;bottom:' + y + 'px;' : 'right:' + x + 'px;top:' + y + 'px;');
        if (o.type === 110 || o.type === 103 || o.type === 107) {
          const w = +p.OBJPROP_XSIZE || 0, h = +p.OBJPROP_YSIZE || 0;
          html += '<div class="ea-o" style="' + pos + 'width:' + w + 'px;height:' + h + 'px;background:' + colorCss(p.OBJPROP_BGCOLOR != null ? p.OBJPROP_BGCOLOR : 0x303030) + ';border:1px solid ' + colorCss(o.type === 110 ? (p.OBJPROP_COLOR != null ? p.OBJPROP_COLOR : 0x808080) : (p.OBJPROP_BORDER_COLOR != null ? p.OBJPROP_BORDER_COLOR : 0x808080)) + ';' + (o.type !== 110 ? 'color:' + colorCss(p.OBJPROP_COLOR) + ';font:' + Math.round((+p.OBJPROP_FONTSIZE || 10) * 1.33) + 'px ' + fontCss(p.OBJPROP_FONT) + ';display:flex;align-items:center;justify-content:center;' : '') + '">' + (o.type !== 110 ? U.esc(p.OBJPROP_TEXT || '') : '') + '</div>';
        } else if (o.type === 102) {
          html += '<div class="ea-o ea-lbl" style="' + pos + 'color:' + colorCss(p.OBJPROP_COLOR) + ';font-size:' + Math.round((+p.OBJPROP_FONTSIZE || 10) * 1.33) + 'px;font-family:' + fontCss(p.OBJPROP_FONT) + '">' + U.esc(p.OBJPROP_TEXT || '') + '</div>';
        }
      }
    }
    html += '<div class="ea-badge ' + st.k + '" title="' + U.esc(inst.name + ' · ' + st.t) + '">' + U.icon('robot') + '<span>' + U.esc(inst.name) + '</span></div>';
  }
  ov.innerHTML = html;
  // stack badges at top right
  ov.querySelectorAll('.ea-badge').forEach((b, i) => { b.style.top = (8 + i * 26) + 'px'; });
  void W; void H;
}
const fontCss = f => { f = String(f || 'Arial'); if (/consol|courier|mono/i.test(f)) return 'ui-monospace, Menlo, Consolas, monospace'; if (/black/i.test(f)) return '"Arial Black", Arial, sans-serif;font-weight:900'; return f.replace(/[;"<>]/g, '') + ', Arial, sans-serif'; };

/* ================= panel ================= */
let selId = null;
EA.panel = function (el) {
  const head = U.el('div.p-head', null, U.el('span.p-title', { text: 'EXPERT ADVISORS' }), U.el('span.grow'),
    U.el('button.icon-btn', { type: 'button', title: 'Close', html: U.icon('x'), onclick: () => AT.Pn.close() }));
  el.append(head);
  const box = U.el('div.p-scroll.ea-scroll'); el.append(box);
  const render = () => {
    rT = null;
    if (!document.body.contains(box)) { off(); offL(); return; }
    const top = box.scrollTop;
    box.innerHTML = '';
    // Algo Trading master switch
    const algo = U.el('button.ea-algo' + (EA.st.algo ? '.on' : ''), { type: 'button', html: '<i></i><b>Algo Trading</b><span>' + (EA.st.algo ? 'ON — EA boleh bertransaksi' : 'OFF — semua EA ditahan') + '</span>' });
    algo.onclick = () => EA.setAlgo(!EA.st.algo);
    box.append(algo);
    if (!AT.isLeader()) box.append(U.el('div.ea-note', { html: U.icon('info') + '<span>EA dijalankan oleh tab Amatu Trade lain yang terbuka di perangkat ini. Tutup tab itu agar EA berjalan di sini.</span>' }));
    // running instances
    box.append(U.el('div.ea-sec', { text: 'Terpasang (' + EA.st.list.length + ')' }));
    if (!EA.st.list.length) box.append(U.el('div.ea-empty', { text: 'Belum ada EA. Pilih dari pustaka di bawah lalu tekan Pasang.' }));
    for (const inst of EA.st.list) {
      const st = EA.status(inst.id); const a = E.acc(inst.acc);
      const card = U.el('div.ea-card' + (selId === inst.id ? '.sel' : ''));
      const r = R[inst.id];
      const nPos = a ? a.pos.filter(p => p.sym === inst.sym && p.magic).length : 0, nOrd = a ? a.ord.filter(o => o.sym === inst.sym && o.magic).length : 0;
      const pl = a ? a.pos.filter(p => p.sym === inst.sym && p.magic).reduce((s, p) => s + (E.profit(a, p) || 0) + (p.swap || 0), 0) : 0;
      card.innerHTML = '<div class="ea-c1"><i class="ea-dot ' + st.k + '"></i><b>' + U.esc(inst.name) + '</b><span class="muted">' + U.esc(S.map[inst.sym] ? S.map[inst.sym].n : inst.sym) + ' · ' + tfName(inst.tf) + '</span><span class="grow"></span><span class="muted">#' + inst.acc + '</span></div>' +
        '<div class="ea-c2"><span class="' + (st.k === 'err' ? 'red' : 'muted') + '">' + U.esc(st.t) + '</span><span class="grow"></span><span class="muted">' + nPos + ' posisi · ' + nOrd + ' pending</span>' + (nPos ? ' <b class="' + (pl >= 0 ? 'green' : 'red') + '">' + U.fmtSignedAscii(pl, 2) + '</b>' : '') + '</div>';
      const acts = U.el('div.ea-acts');
      const bRun = U.el('button.btn.btn-ghost.sm', { type: 'button', html: U.icon(inst.run ? 'pause' : 'play') + (inst.run ? 'Hentikan' : 'Jalankan') }); bRun.onclick = e => { e.stopPropagation(); if (r && r.err) { r.err = null; if (!inst.run) EA.toggleRun(inst.id); else EA.start(inst.id); return; } EA.toggleRun(inst.id); };
      const bSet = U.el('button.btn.btn-ghost.sm', { type: 'button', html: U.icon('gear') + 'Input' }); bSet.onclick = e => { e.stopPropagation(); attachDialog(EA.libItem(inst.lib), inst); };
      const bChart = U.el('button.btn.btn-ghost.sm', { type: 'button', html: U.icon('chart') + 'Chart' }); bChart.onclick = e => { e.stopPropagation(); if (AT.T.openSymbol) AT.T.openSymbol(inst.sym); };
      const bDel = U.el('button.icon-btn', { type: 'button', title: 'Lepas EA', html: U.icon('trash') });
      bDel.onclick = async e => { e.stopPropagation(); const ok = await U.confirm('Lepas ' + inst.name + '?', 'EA berhenti dan dilepas dari ' + U.esc(S.map[inst.sym].n) + '. Posisi dan pending order yang sudah ada tetap ada di akun.', 'Lepas', true); if (ok) EA.remove(inst.id); };
      if (inst.run && !mine(inst)) { const bHere = U.el('button.btn.btn-ghost.sm', { type: 'button', html: U.icon('play') + 'Jalankan di sini' }); bHere.onclick = e => { e.stopPropagation(); EA.claim(inst.id); }; acts.append(bHere); }
      acts.append(bRun, bSet, bChart, U.el('span.grow'), bDel);
      card.append(acts);
      card.onclick = () => { selId = selId === inst.id ? null : inst.id; render(); };
      box.append(card);
      if (selId === inst.id) {
        const j = U.el('div.ea-journal');
        const lines = EA.logs(inst.id).slice(-120);
        j.innerHTML = lines.length ? lines.map(l => '<div class="' + l.lv + '"><time>' + U.fmtTime(l.t, 'time') + '</time> ' + U.esc(l.m) + '</div>').join('') : '<div class="muted">Jurnal kosong</div>';
        box.append(j); j.scrollTop = j.scrollHeight;
        const jb = U.el('div.ea-jbtn', null, U.el('button.btn.btn-ghost.sm', { type: 'button', text: 'Salin jurnal', onclick: () => { navigator.clipboard && navigator.clipboard.writeText(EA.logs(inst.id).map(l => new Date(l.t).toISOString() + ' ' + l.m).join('\n')); U.toast('Jurnal disalin', '', 'ok'); } }),
          U.el('button.btn.btn-ghost.sm', { type: 'button', text: 'Bersihkan', onclick: () => { if (R[inst.id]) R[inst.id].log = []; U.del(kLog(inst.id)); render(); } }));
        box.append(jb);
      }
    }
    // library
    box.append(U.el('div.ea-sec', { text: 'Pustaka EA' }));
    for (const it of EA.libItems()) {
      const row = U.el('div.ea-lib');
      row.innerHTML = '<div class="ea-l1"><b>' + U.esc(it.name) + '</b>' + (it.builtin ? '<span class="badge">Bawaan</span>' : '<span class="badge">.mq5</span>') + '</div>' + (it.desc ? '<div class="ea-l2 muted">' + U.esc(it.desc) + '</div>' : '');
      const acts = U.el('div.ea-acts');
      const bAdd = U.el('button.btn.btn-yellow.sm', { type: 'button', text: 'Pasang' }); bAdd.onclick = () => attachDialog(it);
      const bSrc = U.el('button.btn.btn-ghost.sm', { type: 'button', text: 'Kode' }); bSrc.onclick = () => showSource(it);
      acts.append(bAdd);
      if (it.id === 'litus') { const bBoth = U.el('button.btn.btn-yellow.sm', { type: 'button', text: 'Pasang XAU + BTC' }); bBoth.title = 'LITUS di XAU/USD M5 dan BTC M5 (preset AUTO, BTC magic 20261130) — sama seperti di MetaTrader 5'; bBoth.onclick = () => { const m = EA.setupLitus(); U.toast(m.length ? 'LITUS dipasang' : 'Sudah terpasang', m.length ? U.esc(m.map(x => S.map[x.sym].n + ' ' + tfName(x.tf)).join(' + ')) : 'LITUS sudah ada di XAU/USD dan BTC untuk akun ini', m.length ? 'ok' : 'info'); render(); }; acts.append(bBoth); }
      acts.append(bSrc, U.el('span.grow'));
      if (!it.builtin) { const bDel = U.el('button.icon-btn', { type: 'button', title: 'Hapus dari pustaka', html: U.icon('trash') }); bDel.onclick = async () => { if (!(await U.confirm('Hapus ' + it.name + '?', 'File .mq5 ini dihapus dari pustaka.', 'Hapus', true))) return; if (!EA.removeLib(it.id)) U.toast('Masih terpasang', 'Lepas dulu EA yang memakai file ini.', 'warn'); render(); }; acts.append(bDel); }
      row.append(acts); box.append(row);
    }
    const imp = U.el('div.ea-imp');
    const file = U.el('input', { type: 'file', accept: '.mq5,.mqh,.txt,.ex5', style: { display: 'none' } });
    const bFile = U.el('button.btn.btn-ghost', { type: 'button', html: U.icon('download') + 'Impor file .mq5' }); bFile.onclick = () => file.click();
    const bPaste = U.el('button.btn.btn-ghost', { type: 'button', html: U.icon('braces') + 'Tempel kode MQL5' }); bPaste.onclick = () => pasteDialog();
    file.onchange = async () => { const f = file.files[0]; file.value = ''; if (!f) return; const buf = await f.arrayBuffer(); if (/\.ex5$/i.test(f.name) || AT.MQL.isEx5(buf)) { U.modal({ title: 'File .ex5 tidak bisa dijalankan', body: '<p class="muted">.ex5 adalah hasil kompilasi MetaEditor (biner terenkripsi) dan hanya bisa dijalankan oleh MetaTrader 5. Impor file sumbernya (<b>.mq5</b>) — Amatu Trade menerjemahkan kode MQL5 dan menjalankannya langsung di sini.</p>', width: 440 }); return; } doImport(f.name, new TextDecoder(guessEnc(buf)).decode(buf)); };
    imp.append(bFile, bPaste, file);
    box.append(imp);
    box.append(U.el('div.ea-foot.muted', { html: 'EA berjalan di browser selama Amatu Trade terbuka (tab boleh di belakang). Saat aplikasi ditutup, pending order, TP/SL dan stop out tetap diproses, tetapi logika EA (trailing, buka tangga baru) baru jalan lagi ketika dibuka. Didukung: MQL5 dengan fungsi, struct, enum, input, CTrade, OrderSend, iMA/iATR/iRSI/iBands/iMACD/iStochastic, objek label/panel. Belum: class, DLL, iCustom, file.' }));
    box.scrollTop = top;
  };
  let rT = null; const later = () => { clearTimeout(rT); rT = setTimeout(render, 120); };
  const off = U.on('ea', later), offL = U.on('ea-log', id => { if (id === selId) later(); });
  let lastS = 0;
  const offS = U.on('state', () => { if (!document.body.contains(box)) { offS(); return; } const n = Date.now(); if (!rT && n - lastS > 1000) { lastS = n; later(); } });
  render();
};
function guessEnc(buf) { const b = new Uint8Array(buf.slice(0, 2)); return b[0] === 0xFF && b[1] === 0xFE ? 'utf-16le' : b[0] === 0xFE && b[1] === 0xFF ? 'utf-16be' : 'utf-8'; }
function doImport(name, code) {
  try {
    const r = EA.importSource(name, code);
    U.toast(r.updated ? 'EA diperbarui' : 'EA diimpor', U.esc(r.item.name + ' · ' + r.c.inputs.length + ' input' + (r.c.warn.length ? ' · ' + r.c.warn.length + ' peringatan' : '')), 'ok');
    if (r.c.warn.length) U.modal({ title: 'Peringatan terjemahan', body: '<ul class="ea-warn">' + r.c.warn.map(w => '<li>' + U.esc(w) + '</li>').join('') + '</ul>', width: 480 });
    U.emit('ea');
    return true;
  } catch (e) {
    U.modal({ title: 'EA tidak bisa diterjemahkan', body: '<p>' + U.esc(e.message) + '</p><p class="muted">Penerjemah mendukung MQL5 umum untuk EA (fungsi, struct, enum, input, CTrade, indikator bawaan). Bagian seperti class, template, #import DLL dan iCustom belum didukung.</p>', width: 480 });
    return false;
  }
}
function pasteDialog() {
  const ta = U.el('textarea.code-ta.ea-paste', { spellcheck: 'false', placeholder: '// tempel kode .mq5 di sini' });
  const nm = U.el('input.inp', { placeholder: 'Nama EA', value: 'EA saya' });
  const foot = U.el('div.row-end'); const ok = U.el('button.btn.btn-yellow', { type: 'button', text: 'Terjemahkan & simpan' });
  foot.append(ok);
  const body = U.el('div', null, U.el('div.set-lbl', { text: 'Nama' }), nm, U.el('div.set-lbl', { text: 'Kode MQL5 (.mq5)' }), ta);
  const m = U.modal({ title: 'Tempel kode MQL5', body, foot, width: 640, sticky: true });
  ok.onclick = () => { if (!ta.value.trim()) return; if (doImport(nm.value.trim() || 'EA', ta.value)) m.close(); };
}
async function showSource(it) {
  let code = '';
  try { code = await source(it.id); } catch (e) { code = String(e.message); }
  const pre = U.el('pre.ea-src', { text: code });
  const foot = U.el('div.row-end', null, U.el('button.btn.btn-ghost', { type: 'button', text: 'Unduh .mq5', onclick: () => U.download(it.name + '.mq5', code, 'text/plain') }));
  U.modal({ title: it.name + '.mq5', body: pre, foot, width: 760 });
}
async function attachDialog(it, inst) {
  if (!it) return;
  let c;
  try { c = await EA.compiled(it.id); } catch (e) { U.modal({ title: 'EA tidak bisa diterjemahkan', body: '<p>' + U.esc(e.message) + '</p>', width: 460 }); return; }
  const a = inst ? E.acc(inst.acc) : E.active();
  const cur = inst ? inst.inputs : {};
  const body = U.el('div.ea-form');
  const top = U.el('div.ea-grid');
  const symSel = U.el('select.inp');
  const chartSym = AT.T && AT.T.chart ? AT.T.chart.sym : 'XAUUSD';
  const defSym = inst ? inst.sym : (it.sym && !inst && chartSym !== it.sym && S.map[it.sym] ? chartSym : chartSym);
  for (const s of S.list) symSel.append(U.el('option', { value: s.s, text: s.n + ' — ' + s.d, selected: s.s === defSym ? true : null }));
  const tfSel = U.el('select.inp');
  for (const [s, n] of EA.TFS) tfSel.append(U.el('option', { value: s, text: n, selected: s === (inst ? inst.tf : it.tf || 300) ? true : null }));
  top.append(U.el('label', null, U.el('span', { text: 'Simbol' }), symSel), U.el('label', null, U.el('span', { text: 'Timeframe' }), tfSel));
  body.append(top);
  if (it.sym && !inst && defSym !== it.sym) body.append(U.el('div.ea-note', { html: U.icon('info') + '<span>' + U.esc(it.name) + ' dirancang untuk ' + U.esc(S.map[it.sym].n) + '. <a href="#" class="ea-usesym">Pakai ' + U.esc(S.map[it.sym].n) + '</a></span>' }));
  const note = body.querySelector('.ea-usesym'); if (note) note.onclick = e => { e.preventDefault(); symSel.value = it.sym; };
  body.append(U.el('div.ea-acc.muted', { html: 'Akun: <b>#' + a.id + '</b> · ' + U.esc(S.ACCOUNT_TYPES[a.type].name) + ' · ' + U.money(E.metrics(a).eq, a.cur) + ' · ' + S.levLabel(a.lev) }));
  const fields = {};
  let grp = null, gbox = null;
  for (const p of c.inputs) {
    if (p.group !== grp || !gbox) { grp = p.group; gbox = U.el('div.ea-group'); if (grp) gbox.append(U.el('div.ea-gt', { text: grp.replace(/^=+\s*|\s*=+$/g, '') })); body.append(gbox); }
    const v0 = cur[p.name] !== undefined ? cur[p.name] : defaultValue(p);
    let f;
    if (p.type === 'bool') { f = U.el('input.switch', { type: 'checkbox', checked: v0 ? true : null }); }
    else if (p.type === 'ENUM_TIMEFRAMES') { f = U.el('select.inp'); for (const k of TF_ENUM) f.append(U.el('option', { value: NUM[k], text: k.replace('PERIOD_', ''), selected: +v0 === NUM[k] ? true : null })); }
    else if (p.opts) { f = U.el('select.inp'); p.opts.forEach(o => f.append(U.el('option', { value: o.v, text: o.l || o.n, selected: +v0 === o.v ? true : null }))); }
    else if (p.type === 'string') f = U.el('input.inp', { value: v0 });
    else f = U.el('input.inp', { inputmode: 'decimal', value: String(v0) });
    fields[p.name] = { f, p };
    gbox.append(U.el('label.ea-in' + (p.type === 'bool' ? '.chk' : ''), { title: p.name }, U.el('span', { text: p.label }), f));
  }
  const foot = U.el('div.row-end');
  const reset = U.el('button.btn.btn-ghost', { type: 'button', text: 'Default' });
  const ok = U.el('button.btn.btn-yellow', { type: 'button', text: inst ? 'Simpan & mulai ulang' : 'Pasang & jalankan' });
  foot.append(reset, U.el('span.grow'), ok);
  const m = U.modal({ title: (inst ? 'Input · ' : 'Pasang EA · ') + it.name, body, foot, width: 560, cls: 'ea-modal' });
  reset.onclick = () => { for (const k in fields) { const { f, p } = fields[k]; const v = defaultValue(p); if (p.type === 'bool') f.checked = !!v; else f.value = String(v); } };
  ok.onclick = () => {
    const inputs = {};
    for (const k in fields) {
      const { f, p } = fields[k]; let v;
      if (p.type === 'bool') v = f.checked; else if (p.type === 'string') v = f.value;
      else { v = U.parseNum(f.value); if (isNaN(v)) { f.focus(); U.toast('Input tidak valid', U.esc(p.label), 'warn'); return; } if (INT_TYPES.has(p.type) || p.opts || p.type === 'ENUM_TIMEFRAMES') v = Math.trunc(v); }
      if (String(v) !== String(defaultValue(p))) inputs[k] = v;
    }
    const sym = symSel.value, tf = +tfSel.value;
    if (inst) EA.update(inst.id, { inputs, sym, tf });
    else { const x = EA.attach({ lib: it.id, name: it.name, sym, tf, acc: a.id, inputs }); selId = x.id; if (AT.T.openSymbol && AT.T.chart && AT.T.chart.sym !== sym) AT.T.openSymbol(sym); }
    m.close();
    U.toast(inst ? 'Input disimpan' : 'EA dipasang', U.esc(it.name + ' · ' + S.map[sym].n + ' ' + tfName(tf)), 'ok');
  };
}
const INT_TYPES = new Set(['int', 'uint', 'long', 'ulong', 'short', 'ushort', 'char', 'uchar', 'datetime', 'color']);
function defaultValue(p) {
  const d = String(p.def).trim();
  if (p.type === 'bool') return d === 'true' || d === '1';
  if (p.type === 'string') return d.replace(/^"|"$/g, '');
  if (p.opts) { const o = p.opts.find(x => x.n === d); return o ? o.v : (parseInt(d, 10) || 0); }
  if (NUM[d] !== undefined) return NUM[d];
  if (CLR[d] !== undefined) return CLR[d];
  const v = parseFloat(d); return isNaN(v) ? 0 : v;
}
})();
