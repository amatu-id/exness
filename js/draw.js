/* Amatu Trade — drawing tools (trend lines, fibonacci, channels, shapes, long/short position, ranges, text, icons, ruler) */
(function () {
'use strict';
const AT = window.AT, U = AT.U;
const D = AT.D = {};

D.GROUPS = [
  { g: 'cursor', items: [['cross', 'Cross', 't-cross'], ['dot', 'Dot', 't-dot'], ['arrow', 'Arrow', 't-arrow'], ['eraser', 'Eraser', 't-eraser']] },
  { g: 'lines', items: [['trend', 'Trend Line', 't-trend', 'Alt+T'], ['ray', 'Ray', 't-ray'], ['ext', 'Extended Line', 't-ext'], ['info', 'Info Line', 't-info'], ['hline', 'Horizontal Line', 't-hline', 'Alt+H'], ['hray', 'Horizontal Ray', 't-hray'], ['vline', 'Vertical Line', 't-vline', 'Alt+V'], ['crossline', 'Cross Line', 't-crossline'], ['channel', 'Parallel Channel', 't-channel']] },
  { g: 'fib', items: [['fib', 'Fib Retracement', 't-fib', 'Alt+F'], ['fibext', 'Trend-Based Fib Extension', 't-fibext']] },
  { g: 'patterns', items: [['xabcd', 'XABCD Pattern', 't-xabcd'], ['abcd', 'ABCD Pattern', 't-abcd'], ['elliott', 'Elliott Impulse Wave (12345)', 't-elliott']] },
  { g: 'forecast', items: [['long', 'Long Position', 't-long'], ['short', 'Short Position', 't-short'], ['prange', 'Price Range', 't-prange'], ['drange', 'Date Range', 't-drange'], ['dprange', 'Date and Price Range', 't-dprange']] },
  { g: 'shapes', items: [['brush', 'Brush', 't-brush'], ['rect', 'Rectangle', 't-rect'], ['ellipse', 'Ellipse', 't-ellipse'], ['triangle', 'Triangle', 't-triangle'], ['path', 'Path', 't-path'], ['arrowline', 'Arrow', 't-arrowline']] },
  { g: 'text', items: [['text', 'Text', 't-text'], ['plabel', 'Price Label', 't-plabel'], ['aup', 'Arrow Mark Up', 't-aup'], ['adown', 'Arrow Mark Down', 't-adown'], ['flag', 'Flag Mark', 't-flag']] },
  { g: 'icons', items: [['emoji', 'Icons', 't-emoji']] },
  { g: 'measure', items: [['measure', 'Measure', 't-ruler']] }
];
D.EMOJI = ['😀', '😎', '🤑', '😱', '🚀', '🔥', '💰', '💎', '📈', '📉', '⚠️', '✅', '❌', '⭐', '🎯', '🐂', '🐻', '👍', '👎', '⏰', '🔔', '💡', '❤️', '🏁'];
const NPTS = { trend: 2, ray: 2, ext: 2, info: 2, hline: 1, hray: 1, vline: 1, crossline: 1, channel: 3, fib: 2, fibext: 3, xabcd: 5, abcd: 4, elliott: 6, long: 1, short: 1, prange: 2, drange: 2, dprange: 2, rect: 2, ellipse: 2, triangle: 3, arrowline: 2, text: 1, plabel: 1, aup: 1, adown: 1, flag: 1, emoji: 1, measure: 2, path: 99, brush: 999 };
const FIB = [[0, '#787B86', 1], [0.236, '#F23645', 1], [0.382, '#FF9800', 1], [0.5, '#4CAF50', 1], [0.618, '#089981', 1], [0.786, '#00BCD4', 1], [1, '#787B86', 1], [1.618, '#2962FF', 1], [2.618, '#F23645', 0], [3.618, '#9C27B0', 0], [4.236, '#E91E63', 0]];
const DEF = {
  trend: { c: '#2962FF', w: 2 }, ray: { c: '#2962FF', w: 2 }, ext: { c: '#2962FF', w: 2 }, info: { c: '#2962FF', w: 2 }, hline: { c: '#2962FF', w: 1 }, hray: { c: '#2962FF', w: 1 },
  vline: { c: '#2962FF', w: 1 }, crossline: { c: '#2962FF', w: 1 }, channel: { c: '#2962FF', w: 2, f: 'rgba(41,98,255,0.12)' }, fib: { c: '#787B86', w: 1 }, fibext: { c: '#787B86', w: 1 },
  xabcd: { c: '#2962FF', w: 2, f: 'rgba(41,98,255,0.14)' }, abcd: { c: '#089981', w: 2 }, elliott: { c: '#3179F5', w: 2 }, long: { c: '#089981', w: 1 }, short: { c: '#F23645', w: 1 },
  prange: { c: '#2962FF', w: 1, f: 'rgba(41,98,255,0.16)' }, drange: { c: '#2962FF', w: 1, f: 'rgba(41,98,255,0.16)' }, dprange: { c: '#2962FF', w: 1, f: 'rgba(41,98,255,0.16)' },
  brush: { c: '#00BCD4', w: 2 }, rect: { c: '#9C27B0', w: 1, f: 'rgba(156,39,176,0.16)' }, ellipse: { c: '#F57C00', w: 1, f: 'rgba(245,124,0,0.16)' }, triangle: { c: '#089981', w: 1, f: 'rgba(8,153,129,0.16)' },
  path: { c: '#2962FF', w: 2 }, arrowline: { c: '#2962FF', w: 2 }, text: { c: '#2962FF', fs: 14, txt: 'Text' }, plabel: { c: '#2962FF', fs: 12 }, aup: { c: '#089981', fs: 14 }, adown: { c: '#F23645', fs: 14 },
  flag: { c: '#2962FF', fs: 14 }, emoji: { fs: 30, txt: '🚀' }, measure: { c: '#2962FF', w: 1 }
};
D.tool = 'cross';
D.stay = false;
D.lockAll = false;
D.hideAll = false;
let ch = null;          // current Chart
let items = [];         // drawings of the current symbol
let sel = null, hov = null, creating = null, measure = null;
const prim = { _pv: [{ zOrder: () => 'top', renderer: () => ({ draw: t => drawAll(t) }) }], attached(p) { this.req = p.requestUpdate; }, detached() { this.req = null; }, updateAllViews() { }, paneViews() { return this._pv; }, priceAxisViews() { return axisViews; } };
let axisViews = [];
const req = () => { buildAxis(); if (prim.req) prim.req(); };
D.redraw = () => req();
D.busy = () => D.tool !== 'cross' || !!creating || !!dragging;
D.selected = () => sel;

/* ---------- lifecycle ---------- */
let dov = null, dragging = null;
D.attach = function (c) {
  ch = c;
  c.main.attachPrimitive(prim);
  if (!dov) {
    dov = U.el('div.draw-over'); c.host.append(dov);
    dov.addEventListener('pointerdown', onDown);
    dov.addEventListener('pointermove', onMove);
    dov.addEventListener('dblclick', onDbl);
    dov.addEventListener('pointerleave', () => { if (!creating && !dragging && D.tool === 'cross') setActive(false); });
    dov.addEventListener('wheel', e => { if (D.tool === 'cross') setActive(false); }, { passive: true });
    U.on('crosshair', p => { if (!p || !p.point || D.busy() || (ch && ch.overHit)) return; const h = hitTest(p.point.x, p.point.y); if (h) { hov = h; setActive(true); dov.style.cursor = h.handle != null ? 'pointer' : 'move'; req(); } else if (hov) { hov = null; req(); } });
    document.addEventListener('keydown', onKey);
  }
};
D.load = function (c) {
  ch = c; sel = null; hov = null; creating = null; measure = null;
  items = U.load('exness.draw.' + c.sym, []) || [];
  req(); U.emit('draw-sel');
};
D.save = function (c) { if (!c || !c.sym) return; if (items.length) U.save('exness.draw.' + c.sym, items); else U.del('exness.draw.' + c.sym); };
const persist = () => { if (ch) D.save(ch); };
function snapshot() { return JSON.stringify(items); }
function pushUndo(before) {
  const after = snapshot(); if (before === after || !AT.undo) return;
  const sym = ch.sym;
  AT.undo.push({ undo: () => { if (ch.sym !== sym) return; items = JSON.parse(before); sel = null; persist(); req(); }, redo: () => { if (ch.sym !== sym) return; items = JSON.parse(after); sel = null; persist(); req(); } });
}
D.setTool = function (t) {
  D.tool = t; creating = null; if (t !== 'measure') measure = null;
  setActive(t !== 'cross' && t !== 'dot' && t !== 'arrow');
  if (dov) dov.style.cursor = t === 'eraser' ? 'not-allowed' : t !== 'cross' ? 'crosshair' : '';
  if (ch) ch.host.dataset.cursor = t;
  U.emit('tool', t); req();
};
function setActive(on) { if (dov) dov.style.pointerEvents = on ? 'auto' : 'none'; }
D.removeAll = function () { const b = snapshot(); items = []; sel = null; persist(); pushUndo(b); req(); U.emit('draw-sel'); };
D.count = () => items.length;
D.setLockAll = v => { D.lockAll = v; req(); };
D.setHideAll = v => { D.hideAll = v; req(); };

/* ---------- coordinates ---------- */
function pt(e) { const r = ch.host.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
function toTP(x, y, snap) {
  const l = ch.logicalOfX(x); if (l == null) return null;
  let t = ch.timeOfLogical(l);
  let p = ch.pOf(y);
  if (p == null) return null;
  if ((AT.prefs.magnet || snap) && ch.vb.length) {
    const i = Math.round(U.clamp(l, 0, ch.vb.length - 1)); const b = ch.vb[i];
    if (b) {
      const sh = ch.shift; let best = null, bd = 1e9;
      for (const v of [b.open, b.high, b.low, b.close]) { const yy = ch.yOf(v + sh); if (yy == null) continue; const d = Math.abs(yy - y); if (d < bd) { bd = d; best = v + sh; } }
      if (best != null && bd < 26) { p = best; t = b.time; }
    }
  }
  return { t, p };
}
function XY(q) { const x = ch.xOf(q.t), y = ch.yOf(q.p); return x == null || y == null ? null : { x, y }; }

/* ---------- pointer handling ---------- */
function onDown(e) {
  if (!ch) return;
  const P = pt(e);
  e.preventDefault();
  if (ch.replay && ch.replay.pick) { ch.replayPick(P.x); return; }
  const tool = D.tool;
  if (tool === 'eraser') { const h = hitTest(P.x, P.y); if (h) { const b = snapshot(); items = items.filter(d => d !== h.d); persist(); pushUndo(b); req(); } return; }
  if (tool === 'cross' || tool === 'dot' || tool === 'arrow') {
    const h = hitTest(P.x, P.y);
    if (!h) { if (sel) { sel = null; req(); U.emit('draw-sel'); } setActive(false); return; }
    sel = h.d; U.emit('draw-sel');
    if (h.d.lk || D.lockAll) { req(); return; }
    const before = snapshot();
    const start = toTP(P.x, P.y, false); const orig = JSON.parse(JSON.stringify(h.d.p));
    const l0 = ch.logicalOfX(P.x);
    dragging = { d: h.d, handle: h.handle, start, orig, l0, before };
    dov.setPointerCapture(e.pointerId);
    const mv = ev => {
      const Q = pt(ev); const cur = toTP(Q.x, Q.y, false); if (!cur) return;
      const d = dragging.d;
      if (dragging.handle != null) { d.p[dragging.handle] = toTP(Q.x, Q.y) || cur; fixLinked(d, dragging.handle); }
      else {
        const dl = ch.logicalOfX(Q.x) - dragging.l0; const dp = cur.p - dragging.start.p;
        d.p = dragging.orig.map(o => ({ t: ch.timeOfLogical(ch.logicalOf(o.t) + dl), p: o.p + dp }));
      }
      req();
    };
    const up = () => { dov.removeEventListener('pointermove', mv); dov.removeEventListener('pointerup', up); dov.removeEventListener('pointercancel', up); const b = dragging.before; dragging = null; persist(); pushUndo(b); req(); };
    dov.addEventListener('pointermove', mv); dov.addEventListener('pointerup', up); dov.addEventListener('pointercancel', up);
    req(); return;
  }
  const q = toTP(P.x, P.y); if (!q) return;
  if (tool === 'measure') {
    if (measure && measure.done) { measure = null; req(); if (!D.stay) D.setTool('cross'); return; }
    if (!measure) { measure = { p: [q, Object.assign({}, q)], done: false }; trackMeasure(e); return; }
    return;
  }
  if (creating) { // click-click mode: fix current point and add next
    if (creating.t === 'path' && creating.p.length >= 2 && near(creating.p[creating.p.length - 2], q)) { finish(); return; }
    creating.p[creating.p.length - 1] = q;
    if (creating.p.length >= NPTS[creating.t]) { finish(); return; }
    creating.p.push(Object.assign({}, q)); req(); return;
  }
  const d = { id: U.uid(), t: tool, p: [q], s: Object.assign({}, DEF[tool] || { c: '#2962FF', w: 2 }), lk: false, hd: false };
  if (tool === 'long' || tool === 'short') {
    const vr = visiblePriceRange(); const h = (vr[1] - vr[0]) * 0.08;
    const t1 = ch.timeOfLogical(ch.logicalOf(q.t) + 24);
    d.p = [q, { t: t1, p: tool === 'long' ? q.p + h * 2 : q.p - h * 2 }, { t: t1, p: tool === 'long' ? q.p - h : q.p + h }];
    items.push(d); sel = d; persist(); pushUndo(JSON.stringify(items.filter(x => x !== d))); if (!D.stay) D.setTool('cross'); req(); U.emit('draw-sel'); return;
  }
  if (NPTS[tool] === 1) {
    if (tool === 'text') { promptText('Text', d.s.txt, v => { if (!v) return; d.s.txt = v; commitNew(d); }); return; }
    if (tool === 'emoji') { d.s.txt = D.emoji || '🚀'; }
    commitNew(d); return;
  }
  if (tool === 'brush') {
    const before = snapshot(); creating = d; d.p = [q];
    dov.setPointerCapture(e.pointerId);
    const mv = ev => { const Q = pt(ev); const c2 = toTP(Q.x, Q.y, false); if (c2) { d.p.push(c2); req(); } };
    const up = () => { dov.removeEventListener('pointermove', mv); dov.removeEventListener('pointerup', up); creating = null; if (d.p.length > 1) { items.push(d); persist(); pushUndo(before); } if (!D.stay) D.setTool('cross'); req(); };
    dov.addEventListener('pointermove', mv); dov.addEventListener('pointerup', up); req(); return;
  }
  creating = d; d.p.push(Object.assign({}, q));
  const x0 = P.x, y0 = P.y; let moved = false;
  dov.setPointerCapture(e.pointerId);
  const mv = ev => { const Q = pt(ev); if (Math.abs(Q.x - x0) + Math.abs(Q.y - y0) > 6) moved = true; const c2 = toTP(Q.x, Q.y); if (c2 && creating) { creating.p[creating.p.length - 1] = c2; req(); } };
  const up = () => { dov.removeEventListener('pointermove', mv); dov.removeEventListener('pointerup', up); if (moved && creating && creating.p.length >= NPTS[creating.t]) finish(); else if (moved && creating && creating.t !== 'path') { creating.p.push(Object.assign({}, creating.p[creating.p.length - 1])); req(); } };
  dov.addEventListener('pointermove', mv); dov.addEventListener('pointerup', up);
  req();
}
function onMove(e) {
  if (!ch) return;
  const P = pt(e);
  if (creating && !dragging) { const q = toTP(P.x, P.y); if (q) { creating.p[creating.p.length - 1] = q; req(); } return; }
  if (measure && !measure.done) { const q = toTP(P.x, P.y); if (q) { measure.p[1] = q; req(); } return; }
  if (D.tool === 'cross' && !dragging) {
    const h = hitTest(P.x, P.y);
    if (!h) { hov = null; setActive(false); req(); return; }
    hov = h; dov.style.cursor = h.d.lk || D.lockAll ? 'default' : h.handle != null ? 'pointer' : 'move'; req();
  } else if (D.tool !== 'cross') {
    const q = toTP(P.x, P.y); if (q && ch.main) try { ch.chart.setCrosshairPosition(q.p, ch.barAt(q.t) ? ch.barAt(q.t).time + ch.off : undefined, ch.main); } catch (er) { /* outside data */ }
  }
}
function trackMeasure(e) {
  dov.setPointerCapture(e.pointerId);
  const P0 = pt(e); let moved = false;
  const mv = ev => { const Q = pt(ev); if (Math.abs(Q.x - P0.x) + Math.abs(Q.y - P0.y) > 6) moved = true; const q = toTP(Q.x, Q.y); if (q && measure) { measure.p[1] = q; req(); } };
  const up = () => { dov.removeEventListener('pointermove', mv); dov.removeEventListener('pointerup', up); if (moved && measure) measure.done = true; req(); };
  dov.addEventListener('pointermove', mv); dov.addEventListener('pointerup', up);
  const stop = ev => { if (measure && !measure.done && !moved) { measure.done = true; req(); dov.removeEventListener('pointerdown', stop, true); } };
  setTimeout(() => dov.addEventListener('pointerdown', stop, true), 0);
}
function near(a, b) { const A = XY(a), B = XY(b); return A && B && Math.hypot(A.x - B.x, A.y - B.y) < 8; }
function finish() {
  const d = creating; creating = null;
  if (!d) return;
  if (d.t === 'path') d.p = d.p.filter((q, i) => i === 0 || !near(q, d.p[i - 1]));
  if (d.p.length < Math.min(2, NPTS[d.t])) { req(); return; }
  commitNew(d);
}
function commitNew(d) {
  const before = snapshot();
  items.push(d); sel = d; persist(); pushUndo(before);
  if (!D.stay) D.setTool('cross');
  req(); U.emit('draw-sel');
}
function fixLinked(d, i) {
  if (d.t === 'long' || d.t === 'short') { if (i === 1) d.p[2].t = d.p[1].t; if (i === 2) d.p[1].t = d.p[2].t; }
}
function onDbl(e) { const P = pt(e); if (creating && creating.t === 'path') { creating.p.pop(); finish(); return; } const h = hitTest(P.x, P.y); if (h) { sel = h.d; D.props(h.d); } }
function onKey(e) {
  if (!ch) return;
  const tag = (e.target.tagName || '').toLowerCase(); if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;
  if (e.key === 'Escape') { if (creating) { if (creating.t === 'path' && creating.p.length > 2) { creating.p.pop(); finish(); } else creating = null; req(); } else if (measure) { measure = null; req(); } else if (sel) { sel = null; req(); U.emit('draw-sel'); } if (D.tool !== 'cross') D.setTool('cross'); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); D.removeSel(); }
  if (e.key === 'Enter' && creating && creating.t === 'path') { creating.p.pop(); finish(); }
}
D.removeSel = () => { if (!sel) return; const b = snapshot(); items = items.filter(d => d !== sel); sel = null; persist(); pushUndo(b); req(); U.emit('draw-sel'); };
D.updateSel = patch => { if (!sel) return; const b = snapshot(); Object.assign(sel.s, patch.s || {}); if (patch.lk != null) sel.lk = patch.lk; persist(); pushUndo(b); req(); U.emit('draw-sel'); };
function visiblePriceRange() { const h = ch.el.clientHeight; const a = ch.pOf(h * 0.1), b = ch.pOf(h * 0.9); return [Math.min(a, b), Math.max(a, b)]; }
function promptText(title, val, cb) {
  const inp = U.el('textarea.inp', { rows: 3, style: { width: '100%' } }); inp.value = val || '';
  const ok = U.el('button.btn.btn-yellow', { type: 'button', text: 'OK' });
  const m = U.modal({ title, body: inp, foot: ok, width: 360 });
  setTimeout(() => { inp.focus(); inp.select(); }, 30);
  ok.onclick = () => { m.close(); cb(inp.value.trim()); };
  inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ok.click(); } });
}

/* ---------- hit testing ---------- */
function distSeg(px, py, a, b) { const dx = b.x - a.x, dy = b.y - a.y; const L2 = dx * dx + dy * dy; let t = L2 ? ((px - a.x) * dx + (py - a.y) * dy) / L2 : 0; t = U.clamp(t, 0, 1); return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy)); }
function hitTest(x, y) {
  if (D.hideAll) return null;
  for (let k = items.length - 1; k >= 0; k--) {
    const d = items[k]; if (d.hd) continue;
    const P = d.p.map(XY); if (P.some(v => !v)) continue;
    for (let i = 0; i < P.length; i++) if (Math.hypot(P[i].x - x, P[i].y - y) <= 7 && (d === sel || d === (hov && hov.d))) return { d, handle: i };
    if (shapeHit(d, P, x, y)) return { d, handle: null };
  }
  return null;
}
function shapeHit(d, P, x, y) {
  const W = ch.paneWidth(), tol = 5;
  switch (d.t) {
    case 'trend': case 'info': case 'arrowline': return distSeg(x, y, P[0], P[1]) <= tol;
    case 'ray': case 'ext': { const [a, b] = extend(P[0], P[1], d.t === 'ext', W); return distSeg(x, y, a, b) <= tol; }
    case 'hline': return Math.abs(y - P[0].y) <= tol;
    case 'hray': return Math.abs(y - P[0].y) <= tol && x >= P[0].x - tol;
    case 'vline': return Math.abs(x - P[0].x) <= tol;
    case 'crossline': return Math.abs(x - P[0].x) <= tol || Math.abs(y - P[0].y) <= tol;
    case 'channel': { if (P.length < 3) return false; const dy = channelDy(d, P); return distSeg(x, y, P[0], P[1]) <= tol || distSeg(x, y, { x: P[0].x, y: P[0].y + dy }, { x: P[1].x, y: P[1].y + dy }) <= tol || inPoly(x, y, [P[0], P[1], { x: P[1].x, y: P[1].y + dy }, { x: P[0].x, y: P[0].y + dy }]); }
    case 'fib': case 'fibext': { const lv = fibLevels(d, P); const x0 = Math.min(P[0].x, P[P.length - 1].x), x1 = d.t === 'fibext' ? W : Math.max(P[0].x, P[1].x); return lv.some(l => Math.abs(y - l.y) <= tol && x >= x0 - tol && x <= x1 + tol) || (d.t === 'fibext' && (distSeg(x, y, P[0], P[1]) <= tol || distSeg(x, y, P[1], P[2]) <= tol)); }
    case 'rect': case 'prange': case 'drange': case 'dprange': return x >= Math.min(P[0].x, P[1].x) - tol && x <= Math.max(P[0].x, P[1].x) + tol && y >= Math.min(P[0].y, P[1].y) - tol && y <= Math.max(P[0].y, P[1].y) + tol;
    case 'ellipse': { const cx = (P[0].x + P[1].x) / 2, cy = (P[0].y + P[1].y) / 2, rx = Math.abs(P[1].x - P[0].x) / 2 + tol, ry = Math.abs(P[1].y - P[0].y) / 2 + tol; return ((x - cx) ** 2) / (rx * rx) + ((y - cy) ** 2) / (ry * ry) <= 1; }
    case 'triangle': return inPoly(x, y, P) || P.some((p, i) => distSeg(x, y, p, P[(i + 1) % P.length]) <= tol);
    case 'path': case 'brush': case 'xabcd': case 'abcd': case 'elliott': for (let i = 0; i + 1 < P.length; i++) if (distSeg(x, y, P[i], P[i + 1]) <= tol) return true; return d.t === 'xabcd' && P.length >= 3 && inPoly(x, y, P.slice(0, 3));
    case 'long': case 'short': { const x0 = P[0].x, x1 = P[1].x; return x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= Math.min(P[1].y, P[2].y) && y <= Math.max(P[1].y, P[2].y); }
    case 'text': case 'plabel': case 'aup': case 'adown': case 'flag': case 'emoji': { const b = d._bb; return b && x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1; }
  }
  return false;
}
function inPoly(x, y, P) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { if (((P[i].y > y) !== (P[j].y > y)) && (x < (P[j].x - P[i].x) * (y - P[i].y) / (P[j].y - P[i].y) + P[i].x)) c = !c; } return c; }
function extend(a, b, both, W) {
  const dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) < 1e-6) return [{ x: a.x, y: both ? -1e4 : a.y }, { x: a.x, y: dy > 0 ? 1e4 : -1e4 }];
  const k = dy / dx; const xr = dx > 0 ? W + 50 : -50; const end = { x: xr, y: a.y + k * (xr - a.x) };
  if (!both) return [a, end];
  const xl = dx > 0 ? -50 : W + 50; return [{ x: xl, y: a.y + k * (xl - a.x) }, end];
}
function channelDy(d, P) { const a = P[0], b = P[1], c = P[2]; const k = (b.x - a.x) ? (b.y - a.y) / (b.x - a.x) : 0; return c.y - (a.y + k * (c.x - a.x)); }
function fibLevels(d, P) {
  const lv = d.s.lv || FIB;
  const out = [];
  if (d.t === 'fib') { const A = d.p[0].p, B = d.p[1].p; for (const [v, c, on] of lv) if (on) { const p = B + (A - B) * v; out.push({ v, c, p, y: ch.yOf(p) }); } }
  else if (P.length >= 3) { const A = d.p[0].p, B = d.p[1].p, Cc = d.p[2].p; for (const [v, c, on] of lv) if (on) { const p = Cc + (B - A) * v; out.push({ v, c, p, y: ch.yOf(p) }); } }
  return out.filter(l => l.y != null);
}

/* ---------- rendering ---------- */
function rgba(hex, a) { if (!hex) return 'rgba(0,0,0,0)'; if (hex.startsWith('rgba')) return hex; const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')'; }
function fmtP(p) { return ch.fmtPrice(p); }
function label(g, txt, x, y, opt) {
  opt = opt || {};
  g.font = (opt.bold ? '600 ' : '500 ') + (opt.fs || 11) + 'px ' + getComputedStyle(document.body).fontFamily;
  const lines = String(txt).split('\n'); const lh = (opt.fs || 11) + 4;
  const w = Math.max(...lines.map(l => g.measureText(l).width)) + 12, h = lines.length * lh + 6;
  let bx = opt.align === 'center' ? x - w / 2 : opt.align === 'right' ? x - w : x; let by = opt.valign === 'bottom' ? y - h : opt.valign === 'middle' ? y - h / 2 : y;
  if (opt.bg) { g.fillStyle = opt.bg; roundRect(g, bx, by, w, h, 3); g.fill(); }
  g.fillStyle = opt.color || '#fff'; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, bx + 6, by + 4 + i * lh));
  return { x0: bx, y0: by, x1: bx + w, y1: by + h };
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function line(g, a, b, d, dash) { g.beginPath(); g.setLineDash(dash || (d.s.d === 1 ? [6, 4] : d.s.d === 2 ? [2, 3] : [])); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); g.setLineDash([]); }
function arrowHead(g, a, b, size) { const ang = Math.atan2(b.y - a.y, b.x - a.x); g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(b.x - size * Math.cos(ang - 0.45), b.y - size * Math.sin(ang - 0.45)); g.lineTo(b.x - size * Math.cos(ang + 0.45), b.y - size * Math.sin(ang + 0.45)); g.closePath(); g.fill(); }
function rangeText(a, b) {
  const s = ch.sObj; const dp = b.p - a.p; const pct = a.p ? dp / a.p * 100 : 0; const pips = dp / s.pip;
  const bars = Math.round(ch.logicalOf(b.t) - ch.logicalOf(a.t));
  const secs = Math.abs(b.t - a.t);
  return { price: fmtP(dp) + ' (' + U.fmt(pct, 2) + '%) ' + U.fmt(pips, 1) + ' pips', time: bars + ' bars, ' + U.dur(secs * 1000), up: dp >= 0 };
}
function drawOne(g, d, W, H) {
  const P = d.p.map(XY); if (P.some(v => !v)) return;
  const s = d.s; const c = s.c || '#2962FF';
  g.strokeStyle = c; g.fillStyle = c; g.lineWidth = s.w || 1;
  switch (d.t) {
    case 'trend': case 'arrowline': line(g, P[0], P[1], d); if (d.t === 'arrowline') arrowHead(g, P[0], P[1], 9 + (s.w || 1) * 2); break;
    case 'info': { line(g, P[0], P[1], d); const r = rangeText(d.p[0], d.p[1]); const ang = Math.atan2(-(P[1].y - P[0].y), P[1].x - P[0].x) * 180 / Math.PI; label(g, r.price + '\n' + r.time + '\n' + U.fmt(ang, 1) + '°', P[1].x + 8, P[1].y, { bg: rgba(c, 0.9), valign: 'middle' }); break; }
    case 'ray': case 'ext': { const [a, b] = extend(P[0], P[1], d.t === 'ext', W); line(g, a, b, d); break; }
    case 'hline': line(g, { x: 0, y: P[0].y }, { x: W, y: P[0].y }, d); break;
    case 'hray': line(g, P[0], { x: W, y: P[0].y }, d); break;
    case 'vline': line(g, { x: P[0].x, y: 0 }, { x: P[0].x, y: H }, d); break;
    case 'crossline': line(g, { x: 0, y: P[0].y }, { x: W, y: P[0].y }, d); line(g, { x: P[0].x, y: 0 }, { x: P[0].x, y: H }, d); break;
    case 'channel': {
      line(g, P[0], P[1], d);
      if (P.length >= 3) {
        const dy = channelDy(d, P); const a2 = { x: P[0].x, y: P[0].y + dy }, b2 = { x: P[1].x, y: P[1].y + dy };
        g.fillStyle = s.f || rgba(c, 0.12); g.beginPath(); g.moveTo(P[0].x, P[0].y); g.lineTo(P[1].x, P[1].y); g.lineTo(b2.x, b2.y); g.lineTo(a2.x, a2.y); g.closePath(); g.fill();
        line(g, a2, b2, d); g.globalAlpha = 0.6; line(g, { x: P[0].x, y: P[0].y + dy / 2 }, { x: P[1].x, y: P[1].y + dy / 2 }, d, [4, 4]); g.globalAlpha = 1;
      }
      break;
    }
    case 'fib': case 'fibext': {
      if (d.t === 'fibext') { g.setLineDash([4, 4]); g.strokeStyle = rgba('#787B86', 0.9); g.beginPath(); g.moveTo(P[0].x, P[0].y); g.lineTo(P[1].x, P[1].y); if (P[2]) g.lineTo(P[2].x, P[2].y); g.stroke(); g.setLineDash([]); if (!P[2]) break; }
      else { g.setLineDash([4, 4]); g.strokeStyle = rgba('#787B86', 0.9); line(g, P[0], P[1], d, [4, 4]); g.setLineDash([]); }
      const lv = fibLevels(d, P);
      const x0 = d.t === 'fib' ? Math.min(P[0].x, P[1].x) : P[2].x, x1 = d.t === 'fib' ? (s.er ? W : Math.max(P[0].x, P[1].x)) : W;
      for (let i = 0; i + 1 < lv.length; i++) { g.fillStyle = rgba(lv[i + 1].c, 0.08); g.fillRect(x0, Math.min(lv[i].y, lv[i + 1].y), x1 - x0, Math.abs(lv[i + 1].y - lv[i].y)); }
      for (const l of lv) { g.strokeStyle = l.c; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, l.y); g.lineTo(x1, l.y); g.stroke(); g.fillStyle = l.c; g.font = '500 11px ' + getComputedStyle(document.body).fontFamily; g.textBaseline = 'bottom'; g.fillText(l.v + ' (' + fmtP(l.p) + ')', x0 + 4, l.y - 2); }
      break;
    }
    case 'xabcd': case 'abcd': case 'elliott': {
      const names = d.t === 'xabcd' ? ['X', 'A', 'B', 'C', 'D'] : d.t === 'abcd' ? ['A', 'B', 'C', 'D'] : ['0', '(1)', '(2)', '(3)', '(4)', '(5)'];
      if (d.t === 'xabcd') { g.fillStyle = s.f || rgba(c, 0.14); for (const tri of [[0, 1, 2], [2, 3, 4]]) if (P[tri[2]]) { g.beginPath(); g.moveTo(P[tri[0]].x, P[tri[0]].y); g.lineTo(P[tri[1]].x, P[tri[1]].y); g.lineTo(P[tri[2]].x, P[tri[2]].y); g.closePath(); g.fill(); } }
      g.strokeStyle = c; g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke();
      P.forEach((p, i) => { const up = i === 0 ? (P[1] ? p.y > P[1].y : true) : p.y < P[i - 1].y; label(g, names[i] || '', p.x, up ? p.y - 6 : p.y + 6, { bg: rgba(c, 0.95), align: 'center', valign: up ? 'bottom' : 'top', bold: true }); });
      if (d.t !== 'elliott') for (let i = 2; i < d.p.length; i++) { const r = Math.abs((d.p[i].p - d.p[i - 1].p) / (d.p[i - 1].p - d.p[i - 2].p || 1)); const m = { x: (P[i].x + P[i - 2].x) / 2, y: (P[i].y + P[i - 2].y) / 2 }; g.setLineDash([3, 3]); g.strokeStyle = rgba(c, 0.7); g.beginPath(); g.moveTo(P[i - 2].x, P[i - 2].y); g.lineTo(P[i].x, P[i].y); g.stroke(); g.setLineDash([]); label(g, U.fmt(r, 3), m.x, m.y, { bg: rgba(c, 0.8), align: 'center', valign: 'middle', fs: 10 }); }
      break;
    }
    case 'long': case 'short': {
      const x0 = Math.min(P[0].x, P[1].x), x1 = Math.max(P[0].x, P[1].x, P[0].x + 20); const ye = P[0].y, yt = P[1].y, ys = P[2].y;
      g.fillStyle = 'rgba(8,153,129,0.22)'; g.fillRect(x0, Math.min(ye, yt), x1 - x0, Math.abs(yt - ye));
      g.fillStyle = 'rgba(242,54,69,0.22)'; g.fillRect(x0, Math.min(ye, ys), x1 - x0, Math.abs(ys - ye));
      g.strokeStyle = '#787B86'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, ye); g.lineTo(x1, ye); g.stroke();
      const sy = ch.sObj; const e0 = d.p[0].p, tp = d.p[1].p, sl = d.p[2].p;
      const a = AT.E.active(); const vol = AT.T ? AT.T.formVol() : 0.01;
      const money = px => { if (!a) return ''; const v = AT.E.profit(a, { sym: sy.s, side: d.t === 'long' ? 'buy' : 'sell', vol, open: e0 }, px); return v == null ? '' : ', Amount: ' + U.fmt(Math.abs(v), 2) + ' ' + a.cur; };
      const tdp = Math.abs(tp - e0), sdp = Math.abs(sl - e0);
      label(g, 'Target: ' + fmtP(tdp) + ' (' + U.fmt(tdp / e0 * 100, 2) + '%) ' + U.fmt(tdp / sy.pip, 1) + money(tp), (x0 + x1) / 2, yt + (yt < ye ? -4 : 4), { bg: '#089981', align: 'center', valign: yt < ye ? 'bottom' : 'top' });
      label(g, 'Stop: ' + fmtP(sdp) + ' (' + U.fmt(sdp / e0 * 100, 2) + '%) ' + U.fmt(sdp / sy.pip, 1) + money(sl), (x0 + x1) / 2, ys + (ys < ye ? -4 : 4), { bg: '#F23645', align: 'center', valign: ys < ye ? 'bottom' : 'top' });
      label(g, 'Risk/Reward Ratio: ' + U.fmt(sdp ? tdp / sdp : 0, 2) + ' · Qty: ' + U.fmt(vol, 2), (x0 + x1) / 2, ye, { bg: 'rgba(120,123,134,0.95)', align: 'center', valign: 'middle', fs: 10 });
      d._h = [P[0], { x: x1, y: yt }, { x: x1, y: ys }];
      break;
    }
    case 'prange': case 'drange': case 'dprange': {
      const r = rangeText(d.p[0], d.p[1]); const col = d.t === 'drange' ? c : (r.up ? '#2962FF' : '#F23645');
      g.fillStyle = rgba(col, 0.16); g.fillRect(Math.min(P[0].x, P[1].x), Math.min(P[0].y, P[1].y), Math.abs(P[1].x - P[0].x), Math.abs(P[1].y - P[0].y));
      g.strokeStyle = col; g.fillStyle = col;
      const mx = (P[0].x + P[1].x) / 2, my = (P[0].y + P[1].y) / 2;
      if (d.t !== 'drange') { line(g, { x: mx, y: P[0].y }, { x: mx, y: P[1].y }, d); arrowHead(g, { x: mx, y: P[0].y }, { x: mx, y: P[1].y }, 8); }
      if (d.t !== 'prange') { line(g, { x: P[0].x, y: my }, { x: P[1].x, y: my }, d); arrowHead(g, { x: P[0].x, y: my }, { x: P[1].x, y: my }, 8); }
      const txt = d.t === 'prange' ? r.price : d.t === 'drange' ? r.time : r.price + '\n' + r.time;
      label(g, txt, mx, Math.max(P[0].y, P[1].y) + 6, { bg: rgba(col, 0.95), align: 'center' });
      break;
    }
    case 'rect': { g.fillStyle = s.f || rgba(c, 0.16); const x = Math.min(P[0].x, P[1].x), y = Math.min(P[0].y, P[1].y), w = Math.abs(P[1].x - P[0].x), h = Math.abs(P[1].y - P[0].y); g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h); break; }
    case 'ellipse': { g.fillStyle = s.f || rgba(c, 0.16); g.beginPath(); g.ellipse((P[0].x + P[1].x) / 2, (P[0].y + P[1].y) / 2, Math.abs(P[1].x - P[0].x) / 2, Math.abs(P[1].y - P[0].y) / 2, 0, 0, Math.PI * 2); g.fill(); g.stroke(); break; }
    case 'triangle': { g.fillStyle = s.f || rgba(c, 0.16); g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.fill(); g.stroke(); break; }
    case 'path': case 'brush': { g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.stroke(); break; }
    case 'text': d._bb = label(g, s.txt || 'Text', P[0].x, P[0].y, { color: c, fs: s.fs || 14, valign: 'middle', bg: s.bg || null }); break;
    case 'plabel': { const t = fmtP(d.p[0].p); d._bb = label(g, t, P[0].x + 10, P[0].y - 26, { bg: c, fs: s.fs || 12 }); g.strokeStyle = c; g.beginPath(); g.moveTo(P[0].x, P[0].y); g.lineTo(P[0].x + 10, P[0].y - 12); g.stroke(); break; }
    case 'aup': case 'adown': {
      const up = d.t === 'aup'; const x = P[0].x, y = P[0].y; const sz = (s.fs || 14);
      g.fillStyle = c; g.beginPath();
      if (up) { g.moveTo(x, y); g.lineTo(x - sz * 0.6, y + sz * 0.8); g.lineTo(x - sz * 0.25, y + sz * 0.8); g.lineTo(x - sz * 0.25, y + sz * 1.7); g.lineTo(x + sz * 0.25, y + sz * 1.7); g.lineTo(x + sz * 0.25, y + sz * 0.8); g.lineTo(x + sz * 0.6, y + sz * 0.8); }
      else { g.moveTo(x, y); g.lineTo(x - sz * 0.6, y - sz * 0.8); g.lineTo(x - sz * 0.25, y - sz * 0.8); g.lineTo(x - sz * 0.25, y - sz * 1.7); g.lineTo(x + sz * 0.25, y - sz * 1.7); g.lineTo(x + sz * 0.25, y - sz * 0.8); g.lineTo(x + sz * 0.6, y - sz * 0.8); }
      g.closePath(); g.fill();
      d._bb = { x0: x - sz * 0.7, x1: x + sz * 0.7, y0: up ? y : y - sz * 1.8, y1: up ? y + sz * 1.8 : y };
      if (s.txt) label(g, s.txt, x, up ? y + sz * 1.9 : y - sz * 1.9, { color: c, align: 'center', valign: up ? 'top' : 'bottom' });
      break;
    }
    case 'flag': { const x = P[0].x, y = P[0].y; g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 26); g.stroke(); g.fillStyle = c; g.beginPath(); g.moveTo(x, y - 26); g.lineTo(x + 16, y - 21); g.lineTo(x, y - 15); g.closePath(); g.fill(); d._bb = { x0: x - 4, x1: x + 18, y0: y - 28, y1: y + 2 }; break; }
    case 'emoji': { const sz = s.fs || 30; g.font = sz + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s.txt || '🚀', P[0].x, P[0].y); g.textAlign = 'left'; d._bb = { x0: P[0].x - sz / 2, x1: P[0].x + sz / 2, y0: P[0].y - sz / 2, y1: P[0].y + sz / 2 }; break; }
  }
}
function drawAll(target) {
  if (!ch) return;
  target.useMediaCoordinateSpace(({ context: g, mediaSize }) => {
    const W = mediaSize.width, H = mediaSize.height;
    if (!D.hideAll) for (const d of items) { if (d.hd) continue; g.save(); try { drawOne(g, d, W, H); } catch (e) { /* bad drawing */ } g.restore(); }
    if (creating) { g.save(); try { drawOne(g, creating, W, H); } catch (e) { /* */ } g.restore(); }
    const show = [sel, hov && hov.d].filter(Boolean);
    for (const d of show) { if (d.hd || D.hideAll) continue; const P = (d._h && (d.t === 'long' || d.t === 'short')) ? d._h : d.p.map(XY); for (const p of P) { if (!p) continue; g.fillStyle = C2().bg; g.strokeStyle = d === sel ? '#2962FF' : 'rgba(41,98,255,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.arc(p.x, p.y, 4.5, 0, Math.PI * 2); g.fill(); g.stroke(); } }
    if (measure) {
      const a = XY(measure.p[0]), b = XY(measure.p[1]);
      if (a && b) {
        const r = rangeText(measure.p[0], measure.p[1]); const col = r.up ? '#2962FF' : '#F23645';
        g.fillStyle = rgba(col, 0.18); g.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
        g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        g.beginPath(); g.moveTo(mx, a.y); g.lineTo(mx, b.y); g.moveTo(a.x, my); g.lineTo(b.x, my); g.stroke();
        arrowHead(g, { x: mx, y: a.y }, { x: mx, y: b.y }, 7); arrowHead(g, { x: a.x, y: my }, { x: b.x, y: my }, 7);
        label(g, r.price + '\n' + r.time, mx, r.up ? Math.min(a.y, b.y) - 6 : Math.max(a.y, b.y) + 6, { bg: col, align: 'center', valign: r.up ? 'bottom' : 'top' });
      }
    }
  });
}
function C2() { return AT.C.colors(); }
function buildAxis() {
  axisViews = [];
  if (!ch || D.hideAll) return;
  const s = ch.sObj; if (!s) return;
  for (const d of items) {
    if (d.hd) continue;
    if (d.t === 'hline' || d.t === 'hray' || d.t === 'crossline' || (d === sel && d.p.length)) {
      const pts = d.t === 'hline' || d.t === 'hray' || d.t === 'crossline' ? [d.p[0]] : d.p;
      for (const q of pts) axisViews.push({ coordinate: () => { const y = ch.yOf(q.p); return y == null ? -100 : y; }, text: () => U.fmt(q.p, s.dg), textColor: () => '#fff', backColor: () => d.s.c || '#2962FF', visible: () => true, tickVisible: () => true });
    }
  }
}

/* ---------- properties dialog ---------- */
D.PALETTE = ['#2962FF', '#089981', '#F23645', '#FF9800', '#FFEB3B', '#9C27B0', '#00BCD4', '#E91E63', '#787B86', '#FFFFFF', '#000000', '#4CAF50'];
D.props = function (d) {
  const box = U.el('div.form-grid');
  const st = Object.assign({}, d.s);
  const row = (lbl, node) => { box.append(U.el('label.fg-l', { text: lbl }), node); };
  const swatches = (key) => { const w = U.el('div.swatches'); for (const c of D.PALETTE) { const b = U.el('button.sw' + (st[key] === c ? '.on' : ''), { type: 'button', style: { background: c } }); b.onclick = () => { st[key] = c; w.querySelectorAll('.sw').forEach(x => x.classList.remove('on')); b.classList.add('on'); }; w.append(b); } return w; };
  if (d.t !== 'emoji') row('Color', swatches('c'));
  if ('w' in st) { const sel2 = U.el('select.inp'); for (const w of [1, 2, 3, 4]) sel2.append(U.el('option', { value: w, text: w + 'px', selected: st.w === w ? true : null })); sel2.onchange = () => { st.w = +sel2.value; }; row('Width', sel2); }
  if (['trend', 'ray', 'ext', 'hline', 'hray', 'vline', 'crossline', 'path', 'arrowline', 'channel'].includes(d.t)) { const sel3 = U.el('select.inp'); [['0', 'Solid'], ['1', 'Dashed'], ['2', 'Dotted']].forEach(([v, l]) => sel3.append(U.el('option', { value: v, text: l, selected: String(st.d || 0) === v ? true : null }))); sel3.onchange = () => { st.d = +sel3.value; }; row('Style', sel3); }
  if ('f' in st) { const op = U.el('input.inp', { type: 'range', min: 0, max: 60, value: Math.round((parseFloat((st.f.match(/,([\d.]+)\)$/) || [])[1]) || 0.16) * 100) }); op.oninput = () => { st.f = rgba(st.c, op.value / 100); }; row('Background', op); }
  if ('txt' in st || d.t === 'aup' || d.t === 'adown') { const t = U.el('input.inp', { type: 'text', value: st.txt || '' }); t.oninput = () => { st.txt = t.value; }; row(d.t === 'emoji' ? 'Icon' : 'Text', t); }
  if ('fs' in st) { const f = U.el('select.inp'); for (const v of [10, 11, 12, 14, 16, 20, 24, 28, 32, 40, 48]) f.append(U.el('option', { value: v, text: v, selected: st.fs === v ? true : null })); f.onchange = () => { st.fs = +f.value; }; row('Font size', f); }
  if (d.t === 'fib' || d.t === 'fibext') { const lv = (st.lv || FIB).map(x => x.slice()); st.lv = lv; const w = U.el('div.fib-lv'); lv.forEach(l => { const cb = U.el('label.chk', null, U.el('input', { type: 'checkbox', checked: l[2] ? true : null, onchange: e => { l[2] = e.target.checked ? 1 : 0; } }), U.el('span', { text: l[0], style: { color: l[1] } })); w.append(cb); }); row('Levels', w); if (d.t === 'fib') { const er = U.el('input', { type: 'checkbox', checked: st.er ? true : null, onchange: e => { st.er = e.target.checked; } }); row('Extend right', er); } }
  if (d.t === 'emoji') { const w = U.el('div.emoji-grid'); for (const em of D.EMOJI) { const b = U.el('button.em', { type: 'button', text: em }); b.onclick = () => { st.txt = em; box.querySelector('input.inp').value = em; }; w.append(b); } row('', w); }
  const lk = U.el('input', { type: 'checkbox', checked: d.lk ? true : null }); row('Lock', lk);
  const foot = U.el('div.row-end');
  const del = U.el('button.btn.btn-ghost', { type: 'button', text: 'Delete' }); const ok = U.el('button.btn.btn-yellow', { type: 'button', text: 'OK' });
  foot.append(del, ok);
  const name = (D.GROUPS.flatMap(g => g.items).find(x => x[0] === d.t) || [0, 'Drawing'])[1];
  const m = U.modal({ title: name, body: box, foot, width: 380 });
  ok.onclick = () => { const b = snapshot(); d.s = st; d.lk = lk.checked; persist(); pushUndo(b); req(); m.close(); U.emit('draw-sel'); };
  del.onclick = () => { sel = d; D.removeSel(); m.close(); };
};
D.selectedProps = () => { if (sel) D.props(sel); };
})();
