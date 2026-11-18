/* Amatu Trade — chart (Lightweight Charts v5): series types, timeframes, live bars, legend,
   trading lines (positions, pending orders, TP/SL, order-form preview) with drag-to-modify, bar replay. */
(function () {
'use strict';
const AT = window.AT, U = AT.U, S = AT.S, F = AT.F, E = AT.E;
const L = window.LightweightCharts;
const C = AT.C = {};

C.TFS = [
  { s: 1, l: '1 second', k: '1s', g: 'SECONDS' }, { s: 5, l: '5 seconds', k: '5s', g: 'SECONDS' }, { s: 10, l: '10 seconds', k: '10s', g: 'SECONDS' },
  { s: 15, l: '15 seconds', k: '15s', g: 'SECONDS' }, { s: 30, l: '30 seconds', k: '30s', g: 'SECONDS' }, { s: 45, l: '45 seconds', k: '45s', g: 'SECONDS' },
  { s: 60, l: '1 minute', k: '1m', g: 'MINUTES' }, { s: 120, l: '2 minutes', k: '2m', g: 'MINUTES' }, { s: 180, l: '3 minutes', k: '3m', g: 'MINUTES' },
  { s: 300, l: '5 minutes', k: '5m', g: 'MINUTES' }, { s: 600, l: '10 minutes', k: '10m', g: 'MINUTES' }, { s: 900, l: '15 minutes', k: '15m', g: 'MINUTES' },
  { s: 1800, l: '30 minutes', k: '30m', g: 'MINUTES' }, { s: 2700, l: '45 minutes', k: '45m', g: 'MINUTES' },
  { s: 3600, l: '1 hour', k: '1h', g: 'HOURS' }, { s: 7200, l: '2 hours', k: '2h', g: 'HOURS' }, { s: 10800, l: '3 hours', k: '3h', g: 'HOURS' }, { s: 14400, l: '4 hours', k: '4h', g: 'HOURS' },
  { s: 86400, l: '1 day', k: 'D', g: 'DAYS' }, { s: 604800, l: '1 week', k: 'W', g: 'DAYS' }, { s: 2592000, l: '1 month', k: 'M', g: 'DAYS' }
];
C.tfKey = s => { const t = C.TFS.find(x => x.s === s); if (t) return t.k; if (s % 86400 === 0) return (s / 86400) + 'D'; if (s % 3600 === 0) return (s / 3600) + 'h'; if (s % 60 === 0) return (s / 60) + 'm'; return s + 's'; };
C.tfLabel = s => { const t = C.TFS.find(x => x.s === s); if (t) return t.l; return C.tfKey(s); };
C.TYPES = [
  { k: 'bars', l: 'Bars', i: 'ct-bars' }, { k: 'candles', l: 'Candles', i: 'ct-candles' }, { k: 'hollow', l: 'Hollow candles', i: 'ct-hollow' },
  { k: 'heikin', l: 'Heikin Ashi', i: 'ct-heikin' }, { k: 'line', l: 'Line', i: 'ct-line' }, { k: 'step', l: 'Step line', i: 'ct-step' },
  { k: 'area', l: 'Area', i: 'ct-area' }, { k: 'baseline', l: 'Baseline', i: 'ct-baseline' }, { k: 'columns', l: 'Columns', i: 'ct-columns' }
];

function css(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
C.colors = () => ({
  bg: css('--chart-bg') || '#141D22', text: css('--chart-text') || 'rgba(237,240,242,0.7)', grid: css('--chart-grid') || 'rgba(237,240,242,0.06)',
  border: css('--chart-border') || 'rgba(237,240,242,0.12)', cross: css('--chart-cross') || 'rgba(237,240,242,0.45)', crossLbl: css('--chart-cross-lbl') || '#2B3940',
  up: (AT.prefs && AT.prefs.cUp) || '#158BF9', down: (AT.prefs && AT.prefs.cDown) || '#EB483F', green: css('--green') || '#2FB47C', red: css('--red') || '#EF6D65',
  buy: '#158BF9', sell: '#EB483F', label: css('--chart-label-bg') || '#141D22', fg: css('--text') || '#EDF0F2'
});

/* heikin ashi transform */
function heikin(bars) {
  const out = []; let po = null, pc = null;
  for (const b of bars) {
    const c = (b.open + b.high + b.low + b.close) / 4;
    const o = po == null ? (b.open + b.close) / 2 : (po + pc) / 2;
    out.push({ time: b.time, open: o, high: Math.max(b.high, o, c), low: Math.min(b.low, o, c), close: c });
    po = o; pc = c;
  }
  return out;
}

class Chart {
  constructor(host) {
    this.host = host;
    this.el = U.el('div.lwc'); host.append(this.el);
    this.over = U.el('div.chart-over'); host.append(this.over);
    this.legend = U.el('div.chart-legend'); host.append(this.legend);
    this.sym = null; this.tf = 3600; this.type = 'candles';
    this.bars = []; this.vb = []; this.loading = false; this.exhausted = false; this.reqId = 0;
    this.off = 0; this.shift = 0; this.cross = null; this.replay = null;
    const col = C.colors();
    this.chart = L.createChart(this.el, {
      autoSize: true,
      layout: { background: { type: 'solid', color: col.bg }, textColor: col.text, fontFamily: getComputedStyle(document.body).fontFamily, fontSize: 11, attributionLogo: false,
        panes: { separatorColor: col.border, separatorHoverColor: 'rgba(21,139,249,0.35)', enableResize: true } },
      grid: { vertLines: { color: col.grid }, horzLines: { color: col.grid } },
      crosshair: { mode: 0, vertLine: { color: col.cross, width: 1, style: 2, labelBackgroundColor: col.crossLbl }, horzLine: { color: col.cross, width: 1, style: 2, labelBackgroundColor: col.crossLbl } },
      rightPriceScale: { borderColor: col.border, scaleMargins: { top: 0.12, bottom: 0.1 }, entireTextOnly: true },
      timeScale: { borderColor: col.border, timeVisible: true, secondsVisible: false, rightOffset: 12, barSpacing: 8, minBarSpacing: 0.5, shiftVisibleRangeOnNewBar: true },
      localization: { locale: 'en-US', priceFormatter: p => this.fmtPrice(p) },
      handleScale: { axisPressedMouseMove: { time: true, price: true } }
    });
    this.lines = new TradeLines(this);
    this.chart.subscribeCrosshairMove(p => this.onCross(p));
    this.chart.timeScale().subscribeVisibleLogicalRangeChange(r => this.onRange(r));
    this.chart.subscribeDblClick && this.chart.subscribeDblClick(p => U.emit('chart-dblclick', p));
    this.setupOverlay();
    this.el.addEventListener('contextmenu', e => { e.preventDefault(); this.contextMenu(e); });
  }
  get sObj() { return S.map[this.sym]; }
  fmtPrice(p) { const s = this.sObj; return U.fmt(p, s ? s.dg : 2); }
  applyTheme() {
    const col = C.colors();
    this.chart.applyOptions({
      layout: { background: { type: 'solid', color: col.bg }, textColor: col.text, panes: { separatorColor: col.border } },
      grid: { vertLines: { color: col.grid, visible: AT.prefs.grid !== false }, horzLines: { color: col.grid, visible: AT.prefs.grid !== false } },
      crosshair: { mode: AT.prefs.magnet ? 1 : 0, vertLine: { color: col.cross, labelBackgroundColor: col.crossLbl }, horzLine: { color: col.cross, labelBackgroundColor: col.crossLbl } },
      rightPriceScale: { borderColor: col.border, mode: AT.prefs.scaleMode || 0 }, timeScale: { borderColor: col.border }
    });
    if (this.main) this.makeSeries(true);
    if (AT.I) AT.I.restyle(this);
  }
  /* ---------- series ---------- */
  makeSeries(keepData) {
    const col = C.colors(); const s = this.sObj; if (!s) return;
    const pf = { type: 'price', precision: s.dg, minMove: s.pt };
    if (this.main && this.mainType !== this.type) { this.chart.removeSeries(this.main); this.main = null; }
    const common = { priceFormat: pf, lastValueVisible: true, priceLineVisible: true, priceLineStyle: 2, priceLineWidth: 1 };
    let opts, ctor;
    const t = this.type;
    if (t === 'candles' || t === 'heikin' || t === 'hollow') {
      ctor = L.CandlestickSeries;
      opts = { upColor: t === 'hollow' ? 'rgba(0,0,0,0)' : col.up, downColor: col.down, borderUpColor: col.up, borderDownColor: col.down, wickUpColor: col.up, wickDownColor: col.down, borderVisible: true };
    } else if (t === 'bars') { ctor = L.BarSeries; opts = { upColor: col.up, downColor: col.down, thinBars: false }; }
    else if (t === 'line' || t === 'step') { ctor = L.LineSeries; opts = { color: col.up, lineWidth: 2, lineType: t === 'step' ? 1 : 0 }; }
    else if (t === 'area') { ctor = L.AreaSeries; opts = { lineColor: col.up, topColor: 'rgba(21,139,249,0.35)', bottomColor: 'rgba(21,139,249,0.02)', lineWidth: 2 }; }
    else if (t === 'baseline') { ctor = L.BaselineSeries; opts = { topLineColor: col.up, topFillColor1: 'rgba(21,139,249,0.28)', topFillColor2: 'rgba(21,139,249,0.03)', bottomLineColor: col.down, bottomFillColor1: 'rgba(235,72,63,0.03)', bottomFillColor2: 'rgba(235,72,63,0.28)', lineWidth: 2 }; }
    else { ctor = L.HistogramSeries; opts = { color: col.up }; }
    Object.assign(opts, common);
    if (!this.main) { this.main = this.chart.addSeries(ctor, opts, 0); this.mainType = this.type; this.main.attachPrimitive(this.lines); if (AT.D) AT.D.attach(this); this.markers = L.createSeriesMarkers ? L.createSeriesMarkers(this.main, []) : null; }
    else this.main.applyOptions(opts);
    if (keepData) this.setSeriesData();
  }
  mapBars(bars) {
    const sh = this.shift, off = this.off;
    const src = this.type === 'heikin' ? heikin(bars) : bars;
    if (this.type === 'candles' || this.type === 'heikin' || this.type === 'hollow' || this.type === 'bars')
      return src.map(b => ({ time: b.time + off, open: b.open + sh, high: b.high + sh, low: b.low + sh, close: b.close + sh }));
    if (this.type === 'columns') { const col = C.colors(); return src.map(b => ({ time: b.time + off, value: b.close + sh, color: b.close >= b.open ? col.up : col.down })); }
    return src.map(b => ({ time: b.time + off, value: b.close + sh }));
  }
  setSeriesData() {
    if (!this.main) return;
    this.main.setData(this.mapBars(this.vb));
    if (this.type === 'baseline' && this.vb.length) this.main.applyOptions({ baseValue: { type: 'price', price: this.vb[Math.max(0, this.vb.length - 120)].close + this.shift } });
    if (AT.I) AT.I.recalc(this);
    this.updateMarkers();
    this.lines.update();
    this.renderLegend();
  }
  computeShift() {
    const a = E.active(); const q = a ? E.quote(a, this.sym) : null;
    const src = AT.prefs.priceSrc || 'bid';
    this.shift = q ? (src === 'ask' ? q.ask - q.mid : q.bid - q.mid) : 0;
    this.off = this.tf < 86400 ? Math.round(U.tzOffset(Date.now(), U.tz()) / 1000) : 0;
  }
  /* ---------- symbol / timeframe ---------- */
  async setSymbol(id, tf, type) {
    if (!S.map[id]) return;
    const same = id === this.sym && (tf == null || tf === this.tf) && (type == null || type === this.type);
    if (type) this.type = type;
    if (tf) this.tf = tf;
    if (this.sym !== id && AT.D) AT.D.save(this);
    this.sym = id;
    if (same && this.bars.length) return;
    this.replay = null; U.emit('replay');
    await this.load();
  }
  async setTF(tf) { if (tf === this.tf) return; this.tf = tf; this.replay = null; U.emit('replay'); await this.load(); }
  setType(t) { this.type = t; this.makeSeries(true); }
  async load() {
    const id = ++this.reqId;
    this.loading = true; this.exhausted = false;
    this.host.classList.add('is-loading');
    this.chart.applyOptions({ timeScale: { secondsVisible: this.tf < 60, timeVisible: this.tf < 86400 } });
    this.computeShift();
    this.makeSeries(false);
    let bars = [];
    if (this.tf >= 60) {
      try { bars = await F.history(this.sym, this.tf); } catch (e) { console.warn(e); }
    }
    if (id !== this.reqId) return;
    if (!bars.length) { const q = F.quotes[this.sym]; if (q && q.mid) { const t = F.bucketOf(Math.floor(Date.now() / 1000), this.tf); bars = [{ time: t, open: q.mid, high: q.mid, low: q.mid, close: q.mid }]; } }
    this.bars = bars; this.vb = bars;
    this.loading = false;
    this.host.classList.remove('is-loading');
    this.setSeriesData();
    this.resetView(true);
    requestAnimationFrame(() => { if (id === this.reqId) this.resetView(true); });
    if (AT.D) AT.D.load(this);
    U.emit('chart-loaded', this);
  }
  resetView(noAnim) {
    const n = this.vb.length; if (!n) return;
    const w = this.el.clientWidth || 800;
    const vis = Math.max(30, Math.min(n + 12, Math.floor(w / 5.5)));
    this.chart.timeScale().setVisibleLogicalRange({ from: n - vis + 12, to: n + 12 });
    this.chart.priceScale('right').applyOptions({ autoScale: true });
  }
  async loadOlder() {
    if (this.loading || this.exhausted || !this.bars.length || this.tf < 60 || this.replay) return;
    this.loading = true; const id = this.reqId;
    const first = this.bars[0].time;
    let older = [];
    try { older = await F.history(this.sym, this.tf, { to: first - 1 }); } catch (e) { /* */ }
    if (id !== this.reqId) return;
    older = older.filter(b => b.time < first);
    this.loading = false;
    if (!older.length) { this.exhausted = true; return; }
    const r = this.chart.timeScale().getVisibleLogicalRange();
    this.bars = older.concat(this.bars); this.vb = this.bars;
    this.setSeriesData();
    if (r) this.chart.timeScale().setVisibleLogicalRange({ from: r.from + older.length, to: r.to + older.length });
    if (AT.D) AT.D.redraw();
  }
  onRange(r) {
    if (r && r.from < 15) this.loadOlder();
    this.lines.update();
    if (AT.D) AT.D.redraw();
  }
  /* live update from the quote stream */
  onTick() {
    if (!this.sym || this.replay) return;
    const q = F.quotes[this.sym]; if (!q || q.mid == null || this.loading) return;
    const nowS = Math.floor(Date.now() / 1000);
    const t = this.tf < 60 ? Math.floor(nowS / this.tf) * this.tf : F.bucketOf(nowS, this.tf);
    const bars = this.bars; const last = bars[bars.length - 1];
    const px = q.mid;
    let added = false;
    if (!last || t > last.time) { if (!F.isOpen(this.sym) && last) return; bars.push({ time: t, open: px, high: px, low: px, close: px }); added = true; }
    else if (t === last.time || t < last.time) { last.high = Math.max(last.high, px); last.low = Math.min(last.low, px); last.close = px; }
    const lb = bars[bars.length - 1];
    const prevShift = this.shift; this.computeShift();
    if (Math.abs(prevShift - this.shift) > (this.sObj.pt * 3)) { this.setSeriesData(); return; }
    if (this.type === 'heikin') { const h = heikin(bars.slice(-60)); const x = h[h.length - 1]; this.main.update({ time: x.time + this.off, open: x.open + this.shift, high: x.high + this.shift, low: x.low + this.shift, close: x.close + this.shift }); }
    else this.main.update(this.mapBars([lb])[0]);
    if (AT.I) AT.I.onTick(this, added);
    this.lines.update();
    if (!this.cross) this.renderLegend();
    if (added && AT.D) AT.D.redraw();
  }
  /* ---------- coordinates ---------- */
  logicalOf(tSec) {
    const b = this.vb, n = b.length; if (!n) return null;
    if (tSec >= b[n - 1].time) return n - 1 + (tSec - b[n - 1].time) / this.tf;
    if (tSec <= b[0].time) return (tSec - b[0].time) / this.tf;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (b[m].time <= tSec) lo = m; else hi = m; }
    return lo + (tSec - b[lo].time) / (b[hi].time - b[lo].time);
  }
  timeOfLogical(l) {
    const b = this.vb, n = b.length; if (!n) return null;
    if (l >= n - 1) return Math.round(b[n - 1].time + (l - (n - 1)) * this.tf);
    if (l <= 0) return Math.round(b[0].time + l * this.tf);
    const i = Math.floor(l), f = l - i;
    return Math.round(b[i].time + f * (b[i + 1].time - b[i].time));
  }
  xOfLogical(l) {
    const ts = this.chart.timeScale();
    const i = Math.floor(l); const x0 = ts.logicalToCoordinate(i), x1 = ts.logicalToCoordinate(i + 1);
    if (x0 == null || x1 == null) return null;
    return x0 + (x1 - x0) * (l - i);
  }
  logicalOfX(x) {
    const ts = this.chart.timeScale(); const x0 = ts.logicalToCoordinate(0), x1 = ts.logicalToCoordinate(1);
    if (x0 == null || x1 == null || x1 === x0) return null;
    return (x - x0) / (x1 - x0);
  }
  xOf(tSec) { const l = this.logicalOf(tSec); return l == null ? null : this.xOfLogical(l); }
  tOf(x) { const l = this.logicalOfX(x); return l == null ? null : this.timeOfLogical(l); }
  /* prices here are axis prices (what the price scale shows: bid or ask), not mid prices */
  yOf(p) { return this.main ? this.main.priceToCoordinate(p) : null; }
  pOf(y) { const v = this.main ? this.main.coordinateToPrice(y) : null; return v == null ? null : v; }
  barAt(tSec) { const l = this.logicalOf(tSec); if (l == null) return null; return this.vb[Math.round(Math.max(0, Math.min(this.vb.length - 1, l)))]; }
  paneWidth() { return this.chart.timeScale().width(); }
  /* ---------- legend ---------- */
  onCross(p) {
    this.cross = p && p.time != null && p.point ? p : null;
    this.renderLegend();
    /* when our overlay switches on, the chart canvas gets a mouseleave (empty point): keep the overlay then */
    if (p && p.point) this.hoverAt(p.point); else if (!this.overHit) this.hoverAt(null);
    U.emit('crosshair', p);
  }
  renderLegend() {
    const s = this.sObj; if (!s) return;
    let b = null;
    if (this.cross) { const t = this.cross.time - this.off; b = this.vb.find(x => x.time === t) || null; }
    if (!b) b = this.vb[this.vb.length - 1];
    const prev = b ? this.vb[this.vb.indexOf(b) - 1] : null;
    const sh = this.shift, dg = s.dg;
    const col = C.colors();
    let ohlc = '';
    if (b && AT.prefs.legendOHLC !== false) {
      const ch = prev ? b.close - prev.close : b.close - b.open; const chp = prev ? ch / prev.close * 100 : 0;
      const c = b.close >= b.open ? col.up : col.down;
      const v = x => '<span style="color:' + c + '">' + U.fmt(x + sh, dg) + '</span>';
      ohlc = '<span class="lg-ohlc">O' + v(b.open) + ' H' + v(b.high) + ' L' + v(b.low) + ' C' + v(b.close) + ' <span style="color:' + c + '">' + (ch >= 0 ? '+' : '') + U.fmt(ch, dg) + ' (' + (chp >= 0 ? '+' : '') + U.fmt(chp, 2) + '%)</span></span>';
    }
    const head = '<div class="lg-main">' + S.iconHTML(s, 16) + '<span class="lg-title">' + U.esc(s.d) + ' · ' + C.tfKey(this.tf) + ' · </span>' + ohlc + (this.loading ? '<span class="lg-load">●●●</span>' : '') + '</div>';
    let ind = '';
    if (AT.I) ind = AT.I.legendHTML(this, this.cross ? this.cross.time - this.off : null);
    this.legend.innerHTML = head + ind;
  }
  /* ---------- trade-line overlay (hover + drag) ---------- */
  setupOverlay() {
    const ov = this.over;
    ov.addEventListener('pointerdown', e => this.overDown(e));
    ov.addEventListener('pointermove', e => { if (!this.dragging) { const r = this.host.getBoundingClientRect(); this.hoverAt({ x: e.clientX - r.left, y: e.clientY - r.top }); } });
    ov.addEventListener('pointerleave', () => { if (!this.dragging) this.setOver(null); });
    ov.addEventListener('wheel', e => { this.setOver(null); }, { passive: true });
  }
  hoverAt(pt) {
    if (this.dragging) return;
    if (AT.D && AT.D.busy()) return;
    const h = pt ? this.lines.hit(pt.x, pt.y) : null;
    this.setOver(h);
  }
  setOver(h) {
    this.overHit = h;
    this.over.style.pointerEvents = h ? 'auto' : 'none';
    this.over.style.cursor = !h ? '' : h.part === 'x' ? 'pointer' : h.part === 'tp' || h.part === 'sl' ? 'grab' : 'ns-resize';
    this.lines.hover = h; this.lines.update();
  }
  overDown(e) {
    const h = this.overHit; if (!h) return;
    e.preventDefault(); e.stopPropagation();
    if (h.part === 'x') { this.lines.act(h); this.setOver(null); return; }
    const r = this.host.getBoundingClientRect();
    this.dragging = { h, y0: e.clientY - r.top, price: h.price };
    this.over.setPointerCapture(e.pointerId);
    this.over.style.cursor = 'grabbing';
    const mv = ev => {
      const y = ev.clientY - r.top;
      let p = this.pOf(y); if (p == null) return;
      p = U.round(p, this.sObj.dg);
      this.dragging.price = p;
      this.lines.drag = { h, price: p };
      this.lines.update();
    };
    const up = ev => {
      this.over.removeEventListener('pointermove', mv); this.over.removeEventListener('pointerup', up); this.over.removeEventListener('pointercancel', up);
      const d = this.lines.drag; this.lines.drag = null; this.dragging = null;
      if (d && Math.abs(d.price - h.price) > this.sObj.pt / 2) this.lines.commit(h, d.price);
      this.setOver(null); this.lines.update();
    };
    this.over.addEventListener('pointermove', mv); this.over.addEventListener('pointerup', up); this.over.addEventListener('pointercancel', up);
  }
  updateMarkers() {
    if (!this.markers) return;
    const a = E.active(); if (!a || AT.prefs.execs === false) { this.markers.setMarkers([]); return; }
    const col = C.colors(); const out = [];
    const first = this.vb.length ? this.vb[0].time : 0;
    const add = (t, side, text) => { const tt = F.bucketOf(Math.floor(t / 1000), this.tf); if (tt < first) return; out.push({ time: (this.tf < 60 ? Math.floor(t / 1000 / this.tf) * this.tf : tt) + this.off, position: side === 'buy' ? 'belowBar' : 'aboveBar', color: side === 'buy' ? col.buy : col.sell, shape: side === 'buy' ? 'arrowUp' : 'arrowDown', text, size: 1 }); };
    for (const p of a.pos) if (p.sym === this.sym) add(p.t, p.side, '');
    const h = E.history(a.id);
    for (let i = 0; i < h.length && i < 300; i++) { const x = h[i]; if (x.sym !== this.sym || x.ord) continue; add(x.t0, x.side, ''); add(x.t1, x.side === 'buy' ? 'sell' : 'buy', ''); }
    if (AT.prefs.showSignals) {
      /* trend signals: EMA 20 / EMA 50 crossovers on the current interval */
      const b = this.vb; let e1 = null, e2 = null, prev = 0;
      for (let i = 0; i < b.length; i++) {
        const v = b[i].close; e1 = e1 == null ? v : e1 + (v - e1) * 2 / 21; e2 = e2 == null ? v : e2 + (v - e2) * 2 / 51;
        const st = i < 50 ? 0 : e1 > e2 ? 1 : -1;
        if (prev && st && st !== prev && i > b.length - 400) out.push({ time: b[i].time + this.off, position: st > 0 ? 'belowBar' : 'aboveBar', color: '#FFDE02', shape: 'circle', text: st > 0 ? 'Buy signal' : 'Sell signal', size: 0.6 });
        if (st) prev = st;
      }
    }
    out.sort((x, y) => x.time - y.time);
    try { this.markers.setMarkers(out); } catch (e) { /* time not in data */ }
  }
  /* ---------- context menu ---------- */
  contextMenu(e) {
    const r = this.host.getBoundingClientRect();
    const y = e.clientY - r.top; const p = this.pOf(y);
    const s = this.sObj; const a = E.active(); const q = a ? E.quote(a, this.sym) : null;
    const items = [];
    if (p && q && !this.replay) {
      const px = U.round(p, s.dg);
      const vol = AT.T ? AT.T.formVol() : s.min;
      const bk = px < q.ask ? 'Limit' : 'Stop', sk = px > q.bid ? 'Limit' : 'Stop';
      items.push({ label: 'Buy ' + U.fmt(vol, 2) + ' ' + s.n + ' @ ' + U.fmt(px, s.dg) + ' ' + bk, icon: 'buy', onClick: () => AT.T.quickPending('buy', px) });
      items.push({ label: 'Sell ' + U.fmt(vol, 2) + ' ' + s.n + ' @ ' + U.fmt(px, s.dg) + ' ' + sk, icon: 'sell', onClick: () => AT.T.quickPending('sell', px) });
      items.push({ label: 'Add alert on ' + s.n + ' at ' + U.fmt(px, s.dg), icon: 'alarm', onClick: () => AT.Pn && AT.Pn.newAlert(this.sym, px) });
      items.push({ sep: true });
    }
    items.push({ label: 'Reset chart view', icon: 'reset', right: 'Alt+R', onClick: () => this.resetView() });
    if (AT.D) items.push({ label: 'Remove drawings', icon: 'trash', onClick: () => AT.D.removeAll(this) });
    if (AT.I) items.push({ label: 'Remove indicators', icon: 'trash', onClick: () => AT.I.removeAll(this) });
    items.push({ sep: true });
    items.push({ label: 'Settings…', icon: 'gear', onClick: () => AT.T && AT.T.chartSettings() });
    U.menu({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, items, { minWidth: 260 });
  }
  /* ---------- screenshot ---------- */
  screenshot(copy) {
    const cv = this.chart.takeScreenshot();
    const s = this.sObj; const out = document.createElement('canvas');
    out.width = cv.width; out.height = cv.height + 34;
    const g = out.getContext('2d'); const col = C.colors();
    g.fillStyle = col.bg; g.fillRect(0, 0, out.width, out.height);
    g.drawImage(cv, 0, 34);
    g.fillStyle = col.fg; g.font = '600 14px ' + getComputedStyle(document.body).fontFamily;
    g.fillText(s.n + ' · ' + C.tfKey(this.tf) + ' · ' + U.fmtTime(Date.now(), 'long'), 12, 22);
    out.toBlob(b => {
      if (copy && navigator.clipboard && window.ClipboardItem) navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]).then(() => U.toast('Chart image copied', '', 'ok')).catch(() => U.download(s.s + '_' + C.tfKey(this.tf) + '.png', b));
      else U.download(s.s + '_' + C.tfKey(this.tf) + '_' + new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '') + '.png', b);
    }, 'image/png');
  }
  /* ---------- bar replay ---------- */
  replayStart() { this.replay = { pick: true, speed: 1, play: false }; this.host.classList.add('replay-pick'); U.emit('replay'); }
  replayPick(x) {
    const l = Math.round(this.logicalOfX(x)); if (l == null) return;
    const i = U.clamp(l, 20, this.bars.length - 2);
    this.replay = { pick: false, i, speed: this.replay ? this.replay.speed : 1, play: false };
    this.host.classList.remove('replay-pick');
    this.vb = this.bars.slice(0, i + 1); this.setSeriesData(); U.emit('replay');
  }
  replayStep() {
    const r = this.replay; if (!r || r.pick) return;
    if (r.i >= this.bars.length - 1) { this.replayPause(); return; }
    r.i++; const b = this.bars[r.i]; this.vb = this.bars.slice(0, r.i + 1);
    this.main.update(this.mapBars([b])[0]);
    if (AT.I) AT.I.onTick(this, true);
    this.lines.update(); this.renderLegend(); U.emit('replay');
  }
  replayPlay() { const r = this.replay; if (!r || r.pick) return; r.play = true; clearInterval(this.rpT); this.rpT = setInterval(() => this.replayStep(), Math.max(60, 1000 / r.speed)); U.emit('replay'); }
  replayPause() { const r = this.replay; if (r) r.play = false; clearInterval(this.rpT); U.emit('replay'); }
  replaySpeed(s) { if (!this.replay) return; this.replay.speed = s; if (this.replay.play) this.replayPlay(); U.emit('replay'); }
  replayExit() { clearInterval(this.rpT); this.replay = null; this.host.classList.remove('replay-pick'); this.vb = this.bars; this.setSeriesData(); this.resetView(); U.emit('replay'); }
}
C.Chart = Chart;

/* ---------- trading lines primitive ---------- */
class TradeLines {
  constructor(c) { this.c = c; this.items = []; this.hits = []; this.hover = null; this.drag = null; this.preview = null; const self = this; this._pv = [{ zOrder: () => 'top', renderer: () => ({ draw: t => self.draw(t) }) }]; this._av = []; }
  attached(p) { this.req = p.requestUpdate; }
  detached() { this.req = null; }
  updateAllViews() { /* geometry computed in draw */ }
  paneViews() { return this._pv; }
  priceAxisViews() { return this._av; }
  update() { this.build(); if (this.req) this.req(); }
  build() {
    const c = this.c, s = c.sObj, a = E.active(); const pr = AT.prefs;
    const items = [];
    if (s && a && pr.showPos !== false) {
      for (const p of a.pos) if (p.sym === c.sym) {
        const pl = E.profit(a, p);
        items.push({ k: 'pos', id: p.id, side: p.side, price: p.open, vol: p.vol, txt: pl == null ? '…' : U.fmtSignedAscii(pl, 2) + ' ' + a.cur, pl });
        if (pr.showTPSL !== false) {
          if (p.tp) items.push({ k: 'tp', id: p.id, side: p.side, price: p.tp, vol: p.vol, txt: projected(a, p, p.tp) });
          if (p.sl) items.push({ k: 'sl', id: p.id, side: p.side, price: p.sl, vol: p.vol, txt: projected(a, p, p.sl) });
        }
      }
      for (const o of a.ord) if (o.sym === c.sym) {
        items.push({ k: 'ord', id: o.id, side: o.side, price: o.price, vol: o.vol, txt: E.typeLabel(o) });
        if (pr.showTPSL !== false) {
          if (o.tp) items.push({ k: 'otp', id: o.id, side: o.side, price: o.tp, vol: o.vol, txt: projected(a, { sym: o.sym, side: o.side, vol: o.vol, open: o.price }, o.tp) });
          if (o.sl) items.push({ k: 'osl', id: o.id, side: o.side, price: o.sl, vol: o.vol, txt: projected(a, { sym: o.sym, side: o.side, vol: o.vol, open: o.price }, o.sl) });
        }
      }
    }
    if (s && AT.Pn) for (const al of AT.Pn.alertsFor(c.sym)) items.push({ k: 'alert', id: al.id, side: 'buy', price: al.v, vol: 0, txt: (al.src === 'ask' ? 'Ask ' : 'Bid ') + ({ cross: '⇅', up: '↑', down: '↓', gt: '>', lt: '<' })[al.op] + ' ' + U.fmt(al.v, s.dg) });
    const pv = this.preview;
    if (pv && s && a && pv.sym === c.sym) {
      const base = pv.entry || (E.quote(a, c.sym) || {})[pv.side === 'buy' ? 'ask' : 'bid'];
      if (pv.entry) items.push({ k: 'pe', id: 'pv', side: pv.side, price: pv.entry, vol: pv.vol, txt: (pv.side === 'buy' ? 'Buy ' : 'Sell ') + (pv.kind === 'stop' ? 'Stop' : 'Limit'), pv: true });
      if (pv.tp) items.push({ k: 'ptp', id: 'pv', side: pv.side, price: pv.tp, vol: pv.vol, txt: base ? projected(a, { sym: c.sym, side: pv.side, vol: pv.vol, open: base }, pv.tp) : 'TP', pv: true });
      if (pv.sl) items.push({ k: 'psl', id: 'pv', side: pv.side, price: pv.sl, vol: pv.vol, txt: base ? projected(a, { sym: c.sym, side: pv.side, vol: pv.vol, open: base }, pv.sl) : 'SL', pv: true });
    }
    if (this.drag) { const it = items.find(x => x.k === this.drag.h.k && x.id === this.drag.h.id); if (it) { it.price = this.drag.price; if (/tp|sl/.test(it.k)) { const p = it.k.startsWith('o') ? a.ord.find(o => o.id === it.id) : it.pv ? null : a.pos.find(x => x.id === it.id); const base = it.pv ? (pv.entry || (E.quote(a, c.sym) || {})[pv.side === 'buy' ? 'ask' : 'bid']) : p ? (p.open || p.price) : null; if (base) it.txt = projected(a, { sym: c.sym, side: it.side, vol: it.vol, open: base }, it.price); } } }
    this.items = items;
    const col = C.colors();
    this._av = items.map(it => {
      const clr = colorOf(it, col);
      return { coordinate: () => { const y = c.yOf(it.price); return y == null ? -100 : y; }, text: () => U.fmt(it.price, s.dg), textColor: () => (it.k === 'pos' || it.k === 'ord' || it.k === 'pe') ? '#fff' : clr, backColor: () => (it.k === 'pos' || it.k === 'ord' || it.k === 'pe') ? clr : col.label, visible: () => true, tickVisible: () => true };
    });
  }
  draw(target) {
    const c = this.c; const col = C.colors(); const al = AT.prefs.align || 'right';
    target.useMediaCoordinateSpace(({ context: g, mediaSize }) => {
      const W = mediaSize.width, H = mediaSize.height; this.hits = [];
      /* news: HMR bands + calendar flags along the bottom */
      const evs = AT.Pn && AT.Pn.eventsFor ? AT.Pn.eventsFor(c.sym) : [];
      if (evs.length) {
        const ci = Object.assign({ high: true, mid: false, low: false, lowest: false }, AT.prefs.calImp || {});
        const okImp = e => (e.imp === 3 && ci.high) || (e.imp === 2 && ci.mid) || (e.imp === 1 && ci.low) || (e.imp === 0 && ci.lowest);
        for (const e of evs) {
          if (AT.prefs.showHMR !== false && e.imp === 3) {
            const x0 = c.xOf(e.t / 1000 - 900), x1 = c.xOf(e.t / 1000 + 300);
            if (x0 != null && x1 != null && x1 > 0 && x0 < W) { g.fillStyle = 'rgba(245,165,36,0.09)'; g.fillRect(x0, 0, Math.max(2, x1 - x0), H); }
          }
          if (AT.prefs.cal !== false && okImp(e)) {
            const x = c.xOf(e.t / 1000); if (x == null || x < 6 || x > W - 6) continue;
            const y = H - 13; const ring = e.imp === 3 ? '#F23645' : e.imp === 2 ? '#F5A524' : e.imp === 1 ? '#FFD54F' : '#787B86';
            g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fillStyle = col.label; g.fill(); g.lineWidth = 1.5; g.strokeStyle = ring; g.stroke();
            g.font = '11px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.fillText((AT.S.CUR[e.cur] || [])[1] || e.cur.slice(0, 1), x, y + 0.5); g.textAlign = 'left';
          }
        }
      }
      g.font = '500 11px ' + getComputedStyle(document.body).fontFamily;
      for (const it of this.items) {
        const y0 = c.yOf(it.price); if (y0 == null) continue;
        const y = Math.round(y0) + 0.5;
        const clr = colorOf(it, col);
        g.strokeStyle = clr; g.lineWidth = 1; g.setLineDash(it.k === 'pos' ? [] : it.k === 'ord' || it.k === 'pe' ? [6, 4] : [2, 3]);
        g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); g.setLineDash([]);
        const vtxt = it.k === 'alert' ? '⏰' : U.fmt(it.vol, 2); const vw = g.measureText(vtxt).width + 12;
        const tw = g.measureText(it.txt).width + 14; const xw = 18;
        const lbl = it.k === 'tp' || it.k === 'otp' || it.k === 'ptp' ? 'TP' : it.k === 'sl' || it.k === 'osl' || it.k === 'psl' ? 'SL' : null;
        const lw = lbl ? g.measureText(lbl).width + 10 : 0;
        const total = vw + tw + xw + lw;
        let x = al === 'left' ? 8 : al === 'center' ? (W - total) / 2 : W - total - 70;
        x = Math.round(Math.max(4, x));
        const h = 18, top = Math.round(y - h / 2);
        const filled = it.k === 'pos' || it.k === 'ord' || it.k === 'pe';
        const isHover = this.hover && this.hover.k === it.k && this.hover.id === it.id;
        // label background
        g.fillStyle = col.label; g.fillRect(x, top, total, h);
        g.strokeStyle = clr; g.lineWidth = 1; g.strokeRect(x + 0.5, top + 0.5, total - 1, h - 1);
        let cx = x;
        if (lbl) { g.fillStyle = clr; g.fillRect(cx, top, lw, h); g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(lbl, cx + 5, top + h / 2 + 0.5); cx += lw; }
        g.fillStyle = filled ? clr : 'transparent'; if (filled) g.fillRect(cx, top, vw, h);
        g.fillStyle = filled ? '#fff' : clr; g.textBaseline = 'middle'; g.fillText(vtxt, cx + 6, top + h / 2 + 0.5); cx += vw;
        g.strokeStyle = clr; g.beginPath(); g.moveTo(cx + 0.5, top); g.lineTo(cx + 0.5, top + h); g.stroke();
        const plc = it.k === 'pos' ? (it.pl >= 0 ? col.green : col.red) : (/^(tp|otp|ptp)$/.test(it.k) ? col.green : /^(sl|osl|psl)$/.test(it.k) ? col.red : clr);
        g.fillStyle = plc; g.fillText(it.txt, cx + 7, top + h / 2 + 0.5); cx += tw;
        g.strokeStyle = clr; g.beginPath(); g.moveTo(cx + 0.5, top); g.lineTo(cx + 0.5, top + h); g.stroke();
        const xr = { x0: cx, y0: top, x1: cx + xw, y1: top + h };
        g.strokeStyle = isHover && this.hover.part === 'x' ? col.fg : clr; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(cx + 6, top + 6); g.lineTo(cx + 12, top + 12); g.moveTo(cx + 12, top + 6); g.lineTo(cx + 6, top + 12); g.stroke();
        this.hits.push({ it, box: { x0: x, y0: top, x1: x + total, y1: top + h }, xr, y });
      }
    });
  }
  hit(x, y) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i]; const it = h.it;
      if (x >= h.xr.x0 && x <= h.xr.x1 && y >= h.xr.y0 && y <= h.xr.y1) return { k: it.k, id: it.id, part: 'x', price: it.price };
      if (x >= h.box.x0 && x <= h.box.x1 && y >= h.box.y0 && y <= h.box.y1) return { k: it.k, id: it.id, part: /tp/.test(it.k) ? 'tp' : /sl/.test(it.k) ? 'sl' : 'line', price: it.price };
    }
    for (let i = this.hits.length - 1; i >= 0; i--) { const h = this.hits[i]; if (Math.abs(y - h.y) <= 3 && h.it.k !== 'pos') return { k: h.it.k, id: h.it.id, part: /tp/.test(h.it.k) ? 'tp' : /sl/.test(h.it.k) ? 'sl' : 'line', price: h.it.price }; }
    return null;
  }
  /* click on × */
  act(h) {
    const a = E.active(); if (!a) return;
    const r = (fn) => { const res = fn(); if (res && res.err) U.toast('Request rejected', U.esc(res.err), 'error'); };
    if (h.k === 'pos') r(() => E.close(a, h.id));
    else if (h.k === 'tp') r(() => E.modifyPos(a, h.id, { tp: null }));
    else if (h.k === 'sl') r(() => E.modifyPos(a, h.id, { sl: null }));
    else if (h.k === 'ord') r(() => E.cancel(a, h.id));
    else if (h.k === 'otp') r(() => E.modifyOrd(a, h.id, { tp: null }));
    else if (h.k === 'osl') r(() => E.modifyOrd(a, h.id, { sl: null }));
    else if (h.k === 'pe' || h.k === 'ptp' || h.k === 'psl') U.emit('preview-clear', h.k);
    else if (h.k === 'alert' && AT.Pn) { AT.Pn.alerts = AT.Pn.alerts.filter(x => x.id !== h.id); U.save('exness.alerts', AT.Pn.alerts); this.update(); }
  }
  /* drop after drag */
  commit(h, price) {
    const a = E.active(); if (!a) return;
    const p = a.pos.find(x => x.id === h.id), o = a.ord.find(x => x.id === h.id);
    let res = null;
    if (h.k === 'pos' && p) { const q = E.quote(a, p.sym); const cur = p.side === 'buy' ? q.bid : q.ask; const prof = p.side === 'buy' ? price > cur : price < cur; res = E.modifyPos(a, p.id, prof ? { tp: price } : { sl: price }); }
    else if (h.k === 'tp' && p) res = E.modifyPos(a, p.id, { tp: price });
    else if (h.k === 'sl' && p) res = E.modifyPos(a, p.id, { sl: price });
    else if (h.k === 'ord' && o) res = E.modifyOrd(a, o.id, { price });
    else if (h.k === 'otp' && o) res = E.modifyOrd(a, o.id, { tp: price });
    else if (h.k === 'osl' && o) res = E.modifyOrd(a, o.id, { sl: price });
    else if (h.k === 'pe' || h.k === 'ptp' || h.k === 'psl') { U.emit('preview-drag', { k: h.k, price }); return; }
    else if (h.k === 'alert' && AT.Pn) { const al = AT.Pn.alerts.find(x => x.id === h.id); if (al) { al.v = price; al.last = null; U.save('exness.alerts', AT.Pn.alerts); this.update(); } return; }
    if (res && res.err) U.toast('Request rejected', U.esc(res.err), 'error');
    else if (res) U.toast('Order modified', '', 'ok', 2000);
  }
}
function projected(a, p, px) { const v = E.profit(a, p, px); return v == null ? '' : U.fmtSignedAscii(v, 2) + ' ' + a.cur; }
function colorOf(it, col) {
  if (it.k === 'alert') return '#FF9800';
  if (/^(tp|otp|ptp)$/.test(it.k)) return col.green;
  if (/^(sl|osl|psl)$/.test(it.k)) return col.red;
  return it.side === 'buy' ? col.buy : col.sell;
}
})();
