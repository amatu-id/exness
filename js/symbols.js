/* Amatu Trade — instrument catalog, contract specs, price-source formulas, market hours */
(function () {
'use strict';
const AT = window.AT;
const S = AT.S = {};

/* ---------- currencies ---------- */
S.CUR = {
  USD: ['US Dollar', '🇺🇸'], EUR: ['Euro', '🇪🇺'], GBP: ['Great Britain Pound', '🇬🇧'], JPY: ['Japanese Yen', '🇯🇵'],
  CHF: ['Swiss Franc', '🇨🇭'], CAD: ['Canadian Dollar', '🇨🇦'], AUD: ['Australian Dollar', '🇦🇺'], NZD: ['New Zealand Dollar', '🇳🇿'],
  SGD: ['Singapore Dollar', '🇸🇬'], HKD: ['Hong Kong Dollar', '🇭🇰'], MXN: ['Mexican Peso', '🇲🇽'], ZAR: ['South African Rand', '🇿🇦'],
  TRY: ['Turkish Lira', '🇹🇷'], SEK: ['Swedish Krona', '🇸🇪'], NOK: ['Norwegian Krone', '🇳🇴'], DKK: ['Danish Krone', '🇩🇰'],
  PLN: ['Polish Zloty', '🇵🇱'], CNH: ['Chinese Yuan Offshore', '🇨🇳'], THB: ['Thai Baht', '🇹🇭'], IDR: ['Indonesian Rupiah', '🇮🇩'],
  INR: ['Indian Rupee', '🇮🇳'], KRW: ['South Korean Won', '🇰🇷'], MYR: ['Malaysian Ringgit', '🇲🇾'], USC: ['US Cent', '🇺🇸'],
  XAU: ['Gold', null], XAG: ['Silver', null], BTC: ['Bitcoin', null], ETH: ['Ethereum', null], USDT: ['Tether', null]
};
/* "X per 1 USD" as a product of feeds^exp  (g:=gTrade pair, b:=Binance mid, r:=daily reference rate) */
S.RATE = {
  USD: [], USC: [], USDT: [['b:USDCUSDT', 1]],
  EUR: [['g:21', -1]], GBP: [['g:23', -1]], AUD: [['g:25', -1]], NZD: [['g:27', -1]],
  JPY: [['g:22', 1]], CHF: [['g:24', 1]], CAD: [['g:26', 1]], CNH: [['g:92', 1]], SGD: [['g:93', 1]], KRW: [['g:95', 1]],
  INR: [['g:97', 1]], MXN: [['g:98', 1]], ZAR: [['g:100', 1]],
  SEK: [['g:94', 1], ['g:21', -1]], NOK: [['g:96', 1], ['g:21', -1]],
  DKK: [['r:EURDKK', 1], ['g:21', -1]], PLN: [['r:EURPLN', 1], ['g:21', -1]], HKD: [['r:USDHKD', 1]], MYR: [['r:USDMYR', 1]],
  TRY: [['b:USDCTRY', 1]], THB: [['b:USDCTHB', 1]], IDR: [['b:USDCIDR', 1]],
  XAU: [['g:90', -1]], XAG: [['g:91', -1]], BTC: [['g:0', -1]], ETH: [['g:1', -1]]
};
/* direct gTrade feeds for pairs (preferred over derivation) */
const G = {
  EURUSD: 21, USDJPY: 22, GBPUSD: 23, USDCHF: 24, AUDUSD: 25, USDCAD: 26, NZDUSD: 27, EURCHF: 28, EURJPY: 29, EURGBP: 30,
  USDCNH: 92, USDSGD: 93, EURSEK: 94, EURNOK: 96, USDMXN: 98, USDZAR: 100,
  EURAUD: 110, EURNZD: 111, EURCAD: 112, GBPAUD: 113, GBPNZD: 114, GBPCAD: 115, GBPCHF: 116, GBPJPY: 117, AUDNZD: 118,
  AUDCAD: 119, AUDCHF: 120, AUDJPY: 121, NZDCAD: 122, NZDCHF: 123, NZDJPY: 124, CADCHF: 125, CADJPY: 126, CHFJPY: 127,
  XAUUSD: 90, XAGUSD: 91, XPTUSD: 188, XPDUSD: 189, USOIL: 187, UKOIL: 450, BTCUSD: 0, ETHUSD: 1
};
function mul(a, b) { const m = new Map(); for (const [k, e] of a.concat(b)) m.set(k, (m.get(k) || 0) + e); return Array.from(m).filter(x => x[1] !== 0); }
function neg(a) { return a.map(([k, e]) => [k, -e]); }
S.pairFormula = (base, quote) => {
  const id = base + quote;
  if (G[id] != null) return [['g:' + G[id], 1]];
  const inv = quote + base;
  if (G[inv] != null) return [['g:' + G[inv], -1]];
  return mul(S.RATE[quote], neg(S.RATE[base]));
};
S.rateFormula = cur => S.RATE[cur] || [];

/* ---------- market hours (exchange schedules incl. holidays) ---------- */
const SCHED = {
  fx: 'America/New_York;O,O,O,O,0000-1659,C,1705-2400;1224/0000-1659,1231/0000-1659',
  metal: 'America/New_York;0000-1659&1801-2400,0000-1659&1801-2400,0000-1659&1801-2400,0000-1659&1801-2400,0000-1659,C,1801-2400;1126/0000-1430&1801-2400,1127/0000-1445,1224/0000-1345,1225/C,1231/0000-1659,0101/C,0118/0000-1430&1801-2400,0215/0000-1430&1801-2400,0325/0000-1659,0326/C,0531/0000-1430&1801-2400,0618/0000-1300,0705/0000-1430&1801-2400',
  index: 'America/New_York;0000-1615&1630-1700&1801-2400,0000-1615&1630-1700&1801-2400,0000-1615&1630-1700&1801-2400,0000-1615&1630-1700&1801-2400,0000-1615&1630-1659,C,1801-2400;1126/0000-1300&1801-2400,1127/0000-1315,1224/0000-1315,1225/C,0101/C,0118/0000-1300&1801-2400,0215/0000-1300&1801-2400,0326/C,0531/0000-1300&1801-2400,0618/0000-1300,0705/0000-1300&1801-2400',
  stock: 'America/New_York;0930-1600,0930-1600,0930-1600,0930-1600,0930-1600,C,C;1126/C,1127/0930-1300,1224/0930-1300,1225/C,0101/C,0118/C,0215/C,0326/C,0531/C,0618/C,0705/C',
  crypto: 'UTC;O,O,O,O,O,O,O;'
};
const parsedSched = {};
function parseSched(str) {
  const [tz, days, hol] = str.split(';');
  const rng = s => s === 'O' ? [[0, 1440]] : s === 'C' ? [] : s.split('&').map(r => { const [a, b] = r.split('-'); return [(+a.slice(0, 2)) * 60 + (+a.slice(2)), (+b.slice(0, 2)) * 60 + (+b.slice(2))]; });
  const d = days.split(',').map(rng); // Mon..Sun
  const h = {};
  if (hol) for (const x of hol.split(',')) { if (!x) continue; const [md, r] = x.split('/'); h[md] = rng(r); }
  return { tz, d, h };
}
function schedOf(k) { return parsedSched[k] || (parsedSched[k] = parseSched(SCHED[k] || SCHED.crypto)); }
/* is market open at ms? */
S.isOpenAt = (sym, ms) => {
  const sc = schedOf(sym.hrs);
  if (sym.hrs === 'crypto') return true;
  const p = AT.U.tzParts(ms, sc.tz);
  const md = String(p.mo).padStart(2, '0') + String(p.d).padStart(2, '0');
  const ranges = sc.h[md] || sc.d[(p.wd + 6) % 7];
  const m = p.h * 60 + p.mi;
  for (const [a, b] of ranges) if (m >= a && m < b) return true;
  return false;
};
/* next state change (open/close) — scans minute steps (coarse 15m then fine) */
S.nextChange = (sym, ms) => {
  if (sym.hrs === 'crypto') return null;
  const st = S.isOpenAt(sym, ms);
  let t = ms - (ms % 60000);
  for (let i = 0; i < 4 * 24 * 9; i++) { t += 15 * 60000; if (S.isOpenAt(sym, t) !== st) { let a = t - 15 * 60000; while (a < t) { a += 60000; if (S.isOpenAt(sym, a) !== st) return a; } return t; } }
  return null;
};

/* ---------- catalog ---------- */
const MAJ = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD'];
const MINORS = ['EURGBP', 'EURJPY', 'EURCHF', 'EURAUD', 'EURCAD', 'EURNZD', 'GBPJPY', 'GBPCHF', 'GBPAUD', 'GBPCAD', 'GBPNZD', 'AUDJPY', 'AUDCHF', 'AUDCAD', 'AUDNZD', 'NZDJPY', 'NZDCHF', 'NZDCAD', 'CADJPY', 'CADCHF', 'CHFJPY'];
const EXOTIC = ['AUDDKK', 'AUDMXN', 'AUDNOK', 'AUDPLN', 'AUDSEK', 'AUDSGD', 'AUDTRY', 'AUDZAR', 'CADMXN', 'CADNOK', 'CADPLN', 'CADTRY', 'CHFDKK', 'CHFMXN', 'CHFNOK', 'CHFPLN', 'CHFSEK', 'CHFSGD', 'CHFTRY', 'CHFZAR',
  'DKKJPY', 'DKKPLN', 'DKKSGD', 'DKKZAR', 'EURHKD', 'EURMXN', 'EURNOK', 'EURSEK', 'EURSGD', 'EURTRY', 'EURZAR', 'GBPDKK', 'GBPMXN', 'GBPNOK', 'GBPPLN', 'GBPSEK', 'GBPSGD', 'GBPTRY', 'GBPZAR',
  'HKDJPY', 'MXNJPY', 'NOKDKK', 'NOKJPY', 'NOKSEK', 'NZDDKK', 'NZDMXN', 'NZDNOK', 'NZDPLN', 'NZDSEK', 'NZDSGD', 'NZDTRY', 'NZDZAR', 'PLNDKK', 'PLNJPY', 'PLNSEK', 'SEKDKK', 'SEKJPY', 'SGDHKD', 'SGDJPY',
  'TRYDKK', 'TRYJPY', 'TRYZAR', 'USDCNH', 'USDDKK', 'USDMXN', 'USDNOK', 'USDPLN', 'USDSEK', 'USDSGD', 'USDTHB', 'USDTRY', 'USDZAR', 'ZARJPY'];
/* standard-account typical spreads in pips (overrides) */
const SPIPS = { EURUSD: 0.8, GBPUSD: 1.0, USDJPY: 1.0, USDCHF: 1.2, USDCAD: 1.4, AUDUSD: 1.0, NZDUSD: 1.5, EURGBP: 1.3, EURJPY: 1.6, EURCHF: 1.6, GBPJPY: 2.2, AUDJPY: 1.7, CHFJPY: 2.2, CADJPY: 2.0, NZDJPY: 2.2,
  USDTRY: 260, EURTRY: 320, GBPTRY: 380, USDMXN: 40, EURMXN: 55, USDZAR: 70, EURZAR: 90, USDSEK: 30, EURSEK: 32, USDNOK: 30, EURNOK: 32, USDDKK: 18, USDPLN: 22, USDSGD: 2.4, EURSGD: 3.6, USDCNH: 6, USDTHB: 6, EURHKD: 20, SGDHKD: 12 };
const STOCKS = [
  ['AAPL', 'Apple Inc.', 'h:xyz:AAPL'], ['AMD', 'Advanced Micro Devices Inc.', 'h:xyz:AMD'], ['AMZN', 'Amazon.com Inc.', 'h:xyz:AMZN'], ['AVGO', 'Broadcom Inc.', 'h:xyz:AVGO'],
  ['BA', 'Boeing Co.', 'g:76'], ['BABA', 'Alibaba Group Holding Ltd.', 'h:xyz:BABA'], ['BIDU', 'Baidu Inc.', 'g:395'], ['COST', 'Costco Wholesale Corp.', 'h:xyz:COST'],
  ['EBAY', 'eBay Inc.', 'h:xyz:EBAY'], ['FB', 'Meta Platforms Inc. (FB)', 'h:xyz:META'], ['GOOGL', 'Alphabet Inc. Class A', 'h:xyz:GOOGL'], ['IBM', 'International Business Machines', 'h:xyz:IBM'],
  ['INTC', 'Intel Corp.', 'h:xyz:INTC'], ['JPM', 'JPMorgan Chase & Co.', 'g:485'], ['KO', 'Coca-Cola Co.', 'g:69'], ['LLY', 'Eli Lilly and Co.', 'h:xyz:LLY'],
  ['LMT', 'Lockheed Martin Corp.', 'g:397'], ['MA', 'Mastercard Inc.', 'g:67'], ['MCD', "McDonald's Corp.", 'g:80'], ['META', 'Meta Platforms Inc.', 'h:xyz:META'],
  ['MSFT', 'Microsoft Corp.', 'h:xyz:MSFT'], ['NFLX', 'Netflix Inc.', 'h:xyz:NFLX'], ['NKE', 'Nike Inc.', 'g:72'], ['NVDA', 'NVIDIA Corp.', 'h:xyz:NVDA'],
  ['ORCL', 'Oracle Corp.', 'h:xyz:ORCL'], ['PFE', 'Pfizer Inc.', 'g:68'], ['PYPL', 'PayPal Holdings Inc.', 'g:74'], ['SBUX', 'Starbucks Corp.', 'g:77'],
  ['SPCX', 'SPAC & New Issue ETF', 'h:xyz:SPCX'], ['TSLA', 'Tesla Inc.', 'h:xyz:TSLA'], ['TSM', 'Taiwan Semiconductor Mfg.', 'h:xyz:TSM'], ['V', 'Visa Inc.', 'g:66'], ['WMT', 'Walmart Inc.', 'g:78']
];

S.list = [];
S.map = {};
function add(o) {
  o.pip = o.pip || Math.pow(10, -(o.dg - 1));
  o.pt = Math.pow(10, -o.dg);
  o.min = o.min || 0.01; o.max = o.max || 200; o.step = o.step || 0.01;
  o.sw = o.sw || [0, 0]; o.swm = o.swm || 'pt';
  o.cap = o.cap || 0; // 0 = account leverage
  S.list.push(o); S.map[o.s] = o;
}
for (const id of MAJ.concat(MINORS, EXOTIC)) {
  const b = id.slice(0, 3), q = id.slice(3);
  const jpyLike = q === 'JPY' || q === 'THB';
  const dg = jpyLike ? 3 : 5;
  const pip = jpyLike ? 0.01 : 0.0001;
  const g = MAJ.includes(id) ? 'Majors' : MINORS.includes(id) ? 'Minors' : 'Exotic';
  const sp = (SPIPS[id] || (g === 'Minors' ? 2.0 : 25)) * pip;
  const exotic = g === 'Exotic';
  add({ s: id, n: b + '/' + q, d: S.CUR[b][0] + ' vs ' + S.CUR[q][0], g, dg, pip, cs: 100000, base: b, quote: q, mm: 'fx', sp,
    cap: exotic ? 200 : 0, hrs: (q === 'TRY' || b === 'TRY' || q === 'THB') ? 'metal' : 'fx', f: S.pairFormula(b, q),
    sw: exotic ? [-(sp / pip) * 2.2, -(sp / pip) * 1.1] : [0, 0], ic: { t: 'fx', a: b, b: q } });
}
/* metals */
const MET = [['XAUUSD', 'XAU', 'USD', 3, 100, 0.24, 'Gold vs US Dollar'], ['XAGUSD', 'XAG', 'USD', 3, 5000, 0.025, 'Silver vs US Dollar'],
  ['XPTUSD', 'XPT', 'USD', 2, 100, 2.6, 'Platinum vs US Dollar'], ['XPDUSD', 'XPD', 'USD', 2, 100, 4.2, 'Palladium vs US Dollar'],
  ['XAUEUR', 'XAU', 'EUR', 3, 100, 0.35, 'Gold vs Euro'], ['XAUGBP', 'XAU', 'GBP', 3, 100, 0.38, 'Gold vs Great Britain Pound'], ['XAUAUD', 'XAU', 'AUD', 3, 100, 0.55, 'Gold vs Australian Dollar'],
  ['XAGEUR', 'XAG', 'EUR', 4, 5000, 0.035, 'Silver vs Euro'], ['XAGGBP', 'XAG', 'GBP', 4, 5000, 0.04, 'Silver vs Great Britain Pound'], ['XAGAUD', 'XAG', 'AUD', 4, 5000, 0.06, 'Silver vs Australian Dollar']];
for (const [id, b, q, dg, cs, sp, d] of MET) {
  const f = (b === 'XPT' || b === 'XPD') ? [['g:' + G[id], 1]] : S.pairFormula(b, q);
  add({ s: id, n: b + '/' + q, d, g: 'Metals', dg, cs, base: b, quote: q, mm: 'cfd', sp, hrs: 'metal', f, cap: (b === 'XPT' || b === 'XPD') ? 100 : 0,
    sw: (b === 'XPT' || b === 'XPD') ? [-12, -6] : [0, 0], ic: { t: 'metal', m: b, b: q } });
}
add({ s: 'XAUUSD247', n: 'XAU/USD247', d: 'Gold vs US Dollar 24/7', g: 'Metals', dg: 3, cs: 100, base: 'XAU', quote: 'USD', mm: 'cfd', sp: 0.30, hrs: 'crypto', f: [['w:XAU247', 1]], ic: { t: 'metal', m: 'XAU', b: 'USD' } });
/* energies */
add({ s: 'USOIL', n: 'USOIL', d: 'Crude Oil WTI', g: 'Energy', dg: 3, cs: 1000, base: 'USOIL', quote: 'USD', mm: 'cfd', sp: 0.014, hrs: 'metal', cap: 200, f: [['g:187', 1]], ic: { t: 'oil' } });
add({ s: 'UKOIL', n: 'UKOIL', d: 'Crude Oil Brent', g: 'Energy', dg: 3, cs: 1000, base: 'UKOIL', quote: 'USD', mm: 'cfd', sp: 0.02, hrs: 'metal', cap: 200, f: [['g:450', 1]], ic: { t: 'oil' } });
add({ s: 'XNGUSD', n: 'XNG/USD', d: 'Natural Gas vs US Dollar', g: 'Energy', dg: 4, cs: 10000, base: 'XNG', quote: 'USD', mm: 'cfd', sp: 0.0045, hrs: 'metal', cap: 200, f: [['h:xyz:NATGAS', 1]], ic: { t: 'gas' } });
/* indices */
add({ s: 'US500', n: 'US500', d: 'US SPX 500 Index', g: 'Indices', dg: 2, cs: 1, base: 'US500', quote: 'USD', mm: 'cfd', sp: 0.5, hrs: 'index', cap: 400, f: [['h:xyz:SP500', 1]], sw: [0, 0], ic: { t: 'flag', c: 'USD' } });
add({ s: 'USTEC', n: 'USTEC', d: 'US Tech 100 Index', g: 'Indices', dg: 2, cs: 1, base: 'USTEC', quote: 'USD', mm: 'cfd', sp: 1.12, hrs: 'index', cap: 400, f: [['h:xyz:XYZ100', 1]], ic: { t: 'flag', c: 'USD' } });
add({ s: 'JP225', n: 'JP225', d: 'Japan 225 Index', g: 'Indices', dg: 2, cs: 1, base: 'JP225', quote: 'JPY', mm: 'cfd', sp: 9, hrs: 'index', cap: 400, f: [['h:xyz:JP225', 1]], ic: { t: 'flag', c: 'JPY' } });
add({ s: 'US500X100', n: 'US500 (x100)', d: 'US SPX 500 Index (x100)', g: 'Indices', dg: 2, cs: 100, base: 'US500', quote: 'USD', mm: 'cfd', sp: 0.5, hrs: 'index', cap: 400, f: [['h:xyz:SP500', 1]], ic: { t: 'flag', c: 'USD' } });
add({ s: 'USTECX100', n: 'USTEC (x100)', d: 'US Tech 100 Index (x100)', g: 'Indices', dg: 2, cs: 100, base: 'USTEC', quote: 'USD', mm: 'cfd', sp: 1.12, hrs: 'index', cap: 400, f: [['h:xyz:XYZ100', 1]], ic: { t: 'flag', c: 'USD' } });
/* crypto */
add({ s: 'BTCUSD', n: 'BTC', d: 'Bitcoin vs US Dollar', g: 'Crypto', dg: 2, cs: 1, base: 'BTC', quote: 'USD', mm: 'cfd', sp: 6.4, hrs: 'crypto', cap: 400, f: [['g:0', 1]], sw: [-0.025, -0.01], swm: 'pct', max: 100, ic: { t: 'coin', c: 'BTC' } });
add({ s: 'ETHUSD', n: 'ETH', d: 'Ethereum vs US Dollar', g: 'Crypto', dg: 2, cs: 1, base: 'ETH', quote: 'USD', mm: 'cfd', sp: 1.0, hrs: 'crypto', cap: 400, f: [['g:1', 1]], sw: [-0.025, -0.01], swm: 'pct', max: 1000, ic: { t: 'coin', c: 'ETH' } });
add({ s: 'BTCUSDT', n: 'BTC/USDT', d: 'Bitcoin vs Tether', g: 'Crypto', dg: 2, cs: 1, base: 'BTC', quote: 'USDT', mm: 'cfd', sp: 7.0, hrs: 'crypto', cap: 200, f: [['b:BTCUSDT', 1]], sw: [-0.025, -0.01], swm: 'pct', max: 100, ic: { t: 'coin', c: 'BTC', b: 'USDT' } });
add({ s: 'ETHBTC', n: 'ETH/BTC', d: 'Ethereum vs Bitcoin', g: 'Crypto', dg: 5, cs: 1, base: 'ETH', quote: 'BTC', mm: 'cfd', sp: 0.00004, hrs: 'crypto', cap: 200, f: [['b:ETHBTC', 1]], sw: [-0.025, -0.01], swm: 'pct', max: 1000, ic: { t: 'coin', c: 'ETH', b: 'BTC' } });
const BX = [['BTCXAU', 'XAU', 3, 0.004, 'Bitcoin vs Gold'], ['BTCXAG', 'XAG', 2, 0.35, 'Bitcoin vs Silver'], ['BTCJPY', 'JPY', 0, 1100, 'Bitcoin vs Japanese Yen'], ['BTCAUD', 'AUD', 2, 11, 'Bitcoin vs Australian Dollar'],
  ['BTCCNH', 'CNH', 1, 48, 'Bitcoin vs Chinese Yuan'], ['BTCZAR', 'ZAR', 0, 120, 'Bitcoin vs South African Rand'], ['BTCTHB', 'THB', 0, 240, 'Bitcoin vs Thai Baht']];
for (const [id, q, dg, sp, d] of BX) add({ s: id, n: 'BTC/' + q, d, g: 'Crypto', dg, cs: 1, base: 'BTC', quote: q, mm: 'cfd', sp, hrs: 'crypto', cap: 200, f: S.pairFormula('BTC', q), sw: [-0.025, -0.01], swm: 'pct', max: 100, ic: { t: 'coin', c: 'BTC', b: q } });
/* stocks */
for (const [id, name, src] of STOCKS) add({ s: id, n: id, d: name, g: 'Stocks', dg: 2, cs: 1, base: id, quote: 'USD', mm: 'cfd', sp: 0, spPct: 0.0005, hrs: 'stock', cap: 20, f: [[src, 1]], sw: [-0.025, -0.015], swm: 'pct', max: 1000, ic: { t: 'stock', c: id } });

S.GROUPS = ['Favorites', 'Most traded', 'Top movers', 'Majors', 'Metals', 'Crypto', 'Indices', 'Stocks', 'Energy', 'Exotic', 'Minors', 'All'];
S.MOST = ['XAUUSD', 'BTCUSD', 'EURUSD', 'GBPUSD', 'USDJPY', 'USTEC', 'US500', 'USOIL', 'ETHUSD', 'XAGUSD', 'GBPJPY', 'AUDUSD'];
S.DEFAULT_FAV = ['BTCUSD', 'XAUUSD', 'XAGUSD', 'ETHUSD', 'USOIL', 'USDJPY', 'EURUSD', 'USTEC'];
S.get = id => S.map[id];

/* spread in price units for an account type */
S.spread = (sym, type, price) => {
  let sp = sym.spPct ? Math.max(0.01, (price || 0) * sym.spPct) : sym.sp;
  const top = ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCHF', 'USDCAD', 'NZDUSD', 'EURGBP', 'EURJPY', 'XAUUSD', 'USTEC', 'US500', 'USOIL', 'BTCUSD', 'ETHUSD'];
  if (type === 'cent') sp *= 1.25;
  else if (type === 'pro') sp *= 0.62;
  else if (type === 'raw') sp *= 0.1;
  else if (type === 'zero') sp = top.includes(sym.s) ? 0 : sp * 0.12;
  return Math.max(sp, type === 'zero' && top.includes(sym.s) ? 0 : sym.pt);
};
/* commission per lot per side, in USD (Raw/Zero) */
S.commission = (sym, type, price) => {
  if (type !== 'raw' && type !== 'zero') return 0;
  if (sym.g === 'Majors' || sym.g === 'Minors' || sym.g === 'Exotic' || sym.g === 'Metals') return type === 'raw' ? 3.5 : 4;
  if (sym.g === 'Energy') return 3.5;
  if (sym.g === 'Indices') return 0.05 * sym.cs;
  return Math.abs(price || 0) * sym.cs * (sym.g === 'Crypto' ? 0.0002 : 0.0002);
};
S.ACCOUNT_TYPES = {
  standard: { name: 'Standard', group: 'Standard accounts', desc: 'Low minimum deposit with no commission. Made for all traders.', min: 10, spread: '0.2 pips', comm: 'No commission', mc: 60, so: 0, icon: 'cube', badge: 'Recommended' },
  cent: { name: 'Standard Cent', group: 'Standard accounts', desc: 'Smaller lots, lower risk. Great for practicing.', min: 10, spread: '0.3 pips', comm: 'No commission', mc: 60, so: 0, icon: 'cube2' },
  pro: { name: 'Pro', group: 'Professional accounts', desc: 'Instant or market execution with tighter spreads and no commission.', min: 200, spread: '0.1 pips', comm: 'No commission', mc: 30, so: 0, icon: 'pro' },
  raw: { name: 'Raw spread', group: 'Professional accounts', desc: 'Direct market pricing with fixed commission. Designed for experienced traders.', min: 200, spread: '0 pips', comm: 'Up to 3.50 USD per lot/side', mc: 30, so: 0, icon: 'raw' },
  zero: { name: 'Zero', group: 'Professional accounts', desc: 'Spreads from 0 pips on top instruments.', min: 200, spread: '0 pips', comm: 'From 0.05 USD per lot/side', mc: 30, so: 0, icon: 'zero' }
};
S.LEVERAGES = [2, 10, 20, 50, 100, 200, 400, 500, 600, 800, 1000, 2000, 0];
S.levLabel = l => (l ? '1:' + l : '1:Unlimited');
S.ACC_CURRENCIES = ['USD', 'IDR', 'EUR', 'GBP', 'JPY', 'AUD', 'SGD', 'MYR', 'THB', 'INR', 'ZAR', 'CHF', 'CAD'];

/* icon HTML for a symbol */
const COIN = { BTC: ['#F7931A', '₿'], ETH: ['#627EEA', 'Ξ'], USDT: ['#26A17B', '₮'] };
const METAL = { XAU: ['#E9C46A', '#B8860B'], XAG: ['#D7DCE1', '#8B95A1'], XPT: ['#C9D3DD', '#6C7A89'], XPD: ['#BFC5CC', '#7A848F'] };
function flag(c, cls) { const f = (S.CUR[c] || [])[1]; return '<span class="flg ' + (cls || '') + '">' + (f || '<b>' + c.slice(0, 1) + '</b>') + '</span>'; }
S.iconHTML = (sym, size) => {
  const ic = sym.ic || {};
  let h = '';
  if (ic.t === 'fx') h = flag(ic.a, 'a') + flag(ic.b, 'b');
  else if (ic.t === 'metal') { const c = METAL[ic.m]; h = '<span class="mtl a" style="--m1:' + c[0] + ';--m2:' + c[1] + '"></span>' + flag(ic.b, 'b'); }
  else if (ic.t === 'coin') { const c = COIN[ic.c]; h = '<span class="coin a" style="background:' + c[0] + '">' + c[1] + '</span>' + (ic.b ? (COIN[ic.b] ? '<span class="coin b" style="background:' + COIN[ic.b][0] + '">' + COIN[ic.b][1] + '</span>' : ic.b === 'XAU' || ic.b === 'XAG' ? '<span class="mtl b" style="--m1:' + METAL[ic.b][0] + ';--m2:' + METAL[ic.b][1] + '"></span>' : flag(ic.b, 'b')) : ''); }
  else if (ic.t === 'oil') h = '<span class="oil a">' + AT.U.icon('drop') + '</span>';
  else if (ic.t === 'gas') h = '<span class="oil gas a">' + AT.U.icon('flame') + '</span>';
  else if (ic.t === 'flag') h = flag(ic.c, 'a solo');
  else if (ic.t === 'stock') { let x = 0; for (const ch of ic.c) x = (x * 31 + ch.charCodeAt(0)) % 360; h = '<span class="stk a" style="background:hsl(' + x + ',45%,42%)">' + ic.c.slice(0, 1) + '</span>'; }
  return '<span class="sym-ic' + (h.includes(' b') ? ' two' : '') + '"' + (size ? ' style="--s:' + size + 'px"' : '') + '>' + h + '</span>';
};
})();
