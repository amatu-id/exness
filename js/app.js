/* Amatu Trade — boot, preferences, theme, routing, live tick fan-out, sync with other devices, version check */
(function () {
'use strict';
const AT = window.AT, U = AT.U, S = AT.S, F = AT.F, E = AT.E;
AT.VER = document.documentElement.dataset.web && document.documentElement.dataset.web.indexOf('%') < 0 ? document.documentElement.dataset.web : 'dev';

const DEF = {
  theme: 'dark', paTheme: 'light', tz: 'UTC', priceSrc: 'bid', align: 'right',
  showSignals: false, showHMR: true, showAlerts: true, showPos: true, showTPSL: true,
  cal: true, calImp: { high: true, mid: false, low: false, lowest: false }, sndAlert: false, sndClose: false,
  autoTPSL: false, form: 'regular', tabs: ['BTCUSD', 'XAUUSD'], tab: 'XAUUSD', tf: 86400, tfs: {}, ctype: 'candles',
  fav: null, instGroup: 'Favorites', cols: {}, group: false, grid: true, magnet: false, legendOHLC: true, execs: true, scaleMode: 0
};
AT.prefs = Object.assign({}, DEF, U.load('exness.prefs', {}) || {});
if (!AT.prefs.fav) AT.prefs.fav = S.DEFAULT_FAV.slice();
AT.setPref = (k, v) => { AT.prefs[k] = v; U.save('exness.prefs', AT.prefs); };
AT.ui = Object.assign({ side: null, bottomH: 260, bottomOpen: true, orderOpen: true }, U.load('pt.exness.ui', {}) || {});
AT.setUI = (k, v) => { AT.ui[k] = v; U.save('pt.exness.ui', AT.ui); };

AT.logoSVG = dark => '<svg class="logo-svg' + (dark ? ' dark' : '') + '" viewBox="0 0 132 34" role="img" aria-label="amatu"><text x="0" y="26" font-family="Inter, Arial, sans-serif" font-weight="700" font-size="30" letter-spacing="-1.2">amatu</text></svg>';

/* ---------- theme ---------- */
AT.applyTheme = function () {
  const t = AT.route === 'pa' ? (AT.prefs.paTheme || 'light') : (AT.prefs.theme || 'dark');
  document.documentElement.dataset.theme = t;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = t === 'dark' ? '#141D22' : '#FFFFFF';
  const tb = U.$('#theme-btn'); if (tb) tb.innerHTML = U.icon(t === 'dark' ? 'moon' : 'sun');
  const pb = U.$('#pa-theme'); if (pb) pb.innerHTML = U.icon(t === 'dark' ? 'moon' : 'sun');
  if (AT.T && AT.T.chart) { AT.T.chart.applyTheme(); AT.T.chart.lines.update(); if (AT.D) AT.D.redraw(); }
};
AT.setTheme = t => { AT.setPref('theme', t); AT.applyTheme(); };

/* ---------- routing ---------- */
AT.go = h => { if (location.hash === h) route(); else location.hash = h; };
function route() {
  const h = location.hash || '#/';
  const m = h.match(/^#\/pa\/?([\w-]*)/);
  const term = U.$('#term'), pa = U.$('#pa');
  if (m) {
    AT.route = 'pa';
    term.classList.add('hidden'); pa.classList.remove('hidden');
    if (!AT.PA.mounted) { AT.PA.mount(pa); AT.PA.mounted = true; }
    AT.PA.show(m[1] || 'accounts');
    document.title = 'Personal Area · Amatu Trade';
  } else {
    AT.route = 'term';
    pa.classList.add('hidden'); term.classList.remove('hidden');
    if (!AT.T.mounted) { AT.T.mount(term); AT.T.mounted = true; }
    else { AT.T.header(); AT.T.renderOrders(); AT.T.status(); AT.O.render(); setTimeout(() => window.dispatchEvent(new Event('resize')), 0); }
  }
  AT.applyTheme();
}
window.addEventListener('hashchange', route);

/* ---------- one "server" tab per device: only the leader executes TP/SL/pending/stop out ---------- */
const TAB = U.uid(); let leader = false;
function elect() {
  const l = U.load('pt.exness.leader', null); const now = Date.now(); const vis = document.visibilityState === 'visible';
  if (!l || now - l.t > 6000 || l.id === TAB || (vis && l.vis === false)) { U.save('pt.exness.leader', { id: TAB, t: now, vis }); leader = true; }
  else leader = false;
}
AT.isLeader = () => leader;
elect(); setInterval(elect, 2000);
document.addEventListener('visibilitychange', elect);
window.addEventListener('pagehide', () => { const l = U.load('pt.exness.leader', null); if (l && l.id === TAB) U.del('pt.exness.leader'); });

/* ---------- live ticks ---------- */
let firstTick = true;
U.on('ticks', ids => {
  if (leader) E.check(ids);
  if (AT.route === 'term' && AT.T.mounted) AT.T.onTicks(ids);
  if (AT.Pn) AT.Pn.onTicks(ids);
  if (firstTick) { firstTick = false; setTimeout(() => { if (leader) E.catchUp().catch(e => console.warn('catch-up', e)); }, 1500); }
});

/* ---------- sync with other devices (Portal AMATU amatu.js) ---------- */
let syncT = null; const pending = new Set();
function remote(key) {
  if (!key || !(key.startsWith('exness.') || key === 'exness.prefs')) return;
  pending.add(key);
  clearTimeout(syncT);
  syncT = setTimeout(() => {
    const keys = Array.from(pending); pending.clear();
    for (const k of keys) {
      if (k === 'exness.accounts' || k === 'exness.tx' || k.startsWith('exness.hist.')) E.reloadFromStorage(k);
      else if (k === 'exness.prefs') { Object.assign(AT.prefs, U.load('exness.prefs', {}) || {}); }
      else if (k === 'exness.alerts' && AT.Pn) { AT.Pn.alerts = U.load('exness.alerts', []) || []; }
      else if (k === 'exness.ind' && AT.I && AT.T.chart) { AT.I.list = U.load('exness.ind', []) || []; AT.I.recalc(AT.T.chart); AT.T.chart.renderLegend(); }
      else if (k.startsWith('exness.draw.') && AT.T.chart && k === 'exness.draw.' + AT.T.chart.sym && AT.D && !AT.D.busy()) AT.D.load(AT.T.chart);
    }
    if (AT.route === 'pa' && AT.PA.render) AT.PA.render();
  }, 300);
}
window.addEventListener('storage', e => remote(e.key));
document.addEventListener('amatu:change', e => { const d = e.detail || {}; const keys = d.keys || (d.key ? [d.key] : []); if (keys.length) keys.forEach(k => remote(String(k).replace(/^ls:/, ''))); else for (const k of ['exness.accounts', 'exness.tx', 'exness.prefs', 'exness.alerts']) remote(k); });

/* ---------- version check ---------- */
async function checkVersion() {
  if (AT.VER === 'dev') return;
  try { const r = await fetch('versi.txt?t=' + Date.now(), { cache: 'no-store' }); const v = (await r.text()).trim(); if (v && v !== AT.VER && !U.$('#newver')) { const b = U.el('button#newver.newver', { type: 'button', html: U.icon('reset') + '<span>New version · reload</span>' }); b.onclick = () => location.reload(); document.body.append(b); } } catch (e) { /* offline */ }
}

/* ---------- boot ---------- */
function boot() {
  E.load();
  F.start();
  route();
  AT.Pn.loadCal().then(() => { if (AT.T.chart) AT.T.chart.lines.update(); });
  setInterval(() => AT.Pn.loadCal().then(() => { if (AT.T.chart) AT.T.chart.lines.update(); }), 20 * 60000);
  const b = U.$('#boot'); if (b) { b.classList.add('done'); setTimeout(() => b.remove(), 400); }
  setInterval(() => { if (leader) E.housekeep(); }, 15000);
  setInterval(() => { if (AT.route === 'term' && AT.T.mounted) AT.T.status(); }, 30000);
  setInterval(checkVersion, 5 * 60000); setTimeout(checkVersion, 20000);
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); if (leader) { E.housekeep(); E.save(true); } }
    else if (hiddenAt && Date.now() - hiddenAt > 120000) { if (leader) E.catchUp().catch(() => { }); if (AT.T.chart) AT.T.chart.load(); }
  });
  window.addEventListener('pagehide', () => { if (leader) { E.housekeep(); E.save(true); } if (AT.D && AT.T.chart) AT.D.save(AT.T.chart); });
  window.AmatuTrade = AT; // debug hook
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
