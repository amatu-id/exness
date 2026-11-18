/* Amatu Trade — utilities (DOM, format, storage, events, menus, dialogs) */
(function () {
'use strict';
const AT = window.AT = window.AT || {};
const U = AT.U = {};

U.$ = (s, r) => (r || document).querySelector(s);
U.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
U.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
U.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
U.now = () => Date.now();
U.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
U.round = (x, d) => { const k = Math.pow(10, d); return Math.round(x * k) / k; };
U.isNum = x => typeof x === 'number' && isFinite(x);

/* element builder: U.el('div.cls#id', {attrs}, children...) */
U.el = function (sel, attrs, ...kids) {
  const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const e = document.createElement((m && m[1]) || 'div');
  if (m && m[2]) m[2].replace(/([.#])([\w-]+)/g, (_, t, v) => { if (t === '.') e.classList.add(v); else e.id = v; });
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'html') e.innerHTML = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};

/* ---------- numbers ---------- */
const nfCache = {};
function nf(d) { return nfCache[d] || (nfCache[d] = new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })); }
U.fmt = (x, d) => (U.isNum(x) ? nf(d == null ? 2 : d).format(x) : '-');
U.fmtPlain = (x, d) => (U.isNum(x) ? x.toFixed(d) : '');
U.fmtSigned = (x, d) => (U.isNum(x) ? (x > 0 ? '+' : x < 0 ? '−' : '') + nf(d == null ? 2 : d).format(Math.abs(x)) : '-');
U.fmtSignedAscii = (x, d) => (U.isNum(x) ? (x > 0 ? '+' : x < 0 ? '-' : '') + nf(d == null ? 2 : d).format(Math.abs(x)) : '-');
U.money = (x, cur, signed) => (signed ? U.fmtSignedAscii(x, 2) : U.fmt(x, 2)) + ' ' + cur;
U.pct = (x, d) => (U.isNum(x) ? nf(d == null ? 2 : d).format(x) + '%' : '-');
U.parseNum = s => { if (s == null) return NaN; const t = String(s).replace(/[,\s]/g, '').replace(/[−–]/g, '-'); return t === '' ? NaN : Number(t); };
U.decimalsOf = step => { const s = String(step); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };

/* ---------- time ---------- */
const dtfCache = {};
function dtf(tz, kind) {
  const key = tz + '|' + kind;
  if (dtfCache[key]) return dtfCache[key];
  const base = { timeZone: tz };
  const opt = kind === 'full' ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }
    : kind === 'date' ? { month: 'short', day: 'numeric', year: 'numeric' }
    : kind === 'day' ? { weekday: 'long', month: 'long', day: 'numeric' }
    : kind === 'hm' ? { hour: 'numeric', minute: '2-digit', hour12: true }
    : kind === 'hms24' ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }
    : kind === 'parts' ? { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', weekday: 'short', hourCycle: 'h23' }
    : kind === 'chart' ? { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
    : { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
  try { return (dtfCache[key] = new Intl.DateTimeFormat('en-US', Object.assign(base, opt))); }
  catch (e) { return (dtfCache[key] = new Intl.DateTimeFormat('en-US', opt)); }
}
U.tz = () => (AT.prefs && AT.prefs.tz) || 'UTC';
U.fmtTime = (ms, kind, tz) => (U.isNum(ms) ? dtf(tz || U.tz(), kind || 'full').format(new Date(ms)) : '-');
/* calendar parts of an instant in a time zone */
U.tzParts = (ms, tz) => {
  const p = {};
  for (const x of dtf(tz, 'parts').formatToParts(new Date(ms))) p[x.type] = x.value;
  return { y: +p.year, mo: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, s: +p.second, wd: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday) };
};
/* offset (ms) of a tz at instant ms: local = utc + off */
U.tzOffset = (ms, tz) => {
  if (!tz || tz === 'UTC') return 0;
  const p = U.tzParts(ms, tz);
  return Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s) - Math.floor(ms / 1000) * 1000;
};
U.dur = ms => {
  ms = Math.max(0, ms); const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (d > 0) return d + 'd ' + (h % 24) + 'h';
  if (h > 0) return h + 'h ' + (m % 60) + 'm';
  return m + 'm';
};
U.TZS = [
  ['UTC', 'UTC'], ['Pacific/Honolulu', 'Honolulu'], ['America/Los_Angeles', 'Los Angeles'], ['America/Chicago', 'Chicago'],
  ['America/New_York', 'New York'], ['America/Sao_Paulo', 'São Paulo'], ['Europe/London', 'London'], ['Europe/Berlin', 'Berlin'],
  ['Europe/Athens', 'Athens'], ['Europe/Istanbul', 'Istanbul'], ['Europe/Moscow', 'Moscow'], ['Asia/Dubai', 'Dubai'],
  ['Asia/Karachi', 'Karachi'], ['Asia/Kolkata', 'Kolkata'], ['Asia/Dhaka', 'Dhaka'], ['Asia/Jakarta', 'Jakarta'], ['Asia/Bangkok', 'Bangkok'],
  ['Asia/Makassar', 'Makassar'], ['Asia/Singapore', 'Singapore'], ['Asia/Hong_Kong', 'Hong Kong'], ['Asia/Jayapura', 'Jayapura'],
  ['Asia/Tokyo', 'Tokyo'], ['Australia/Sydney', 'Sydney'], ['Pacific/Auckland', 'Auckland']
];
U.tzLabel = tz => {
  if (tz === 'UTC') return 'UTC';
  const off = U.tzOffset(Date.now(), tz) / 60000; const s = off < 0 ? '-' : '+'; const a = Math.abs(off);
  const name = (U.TZS.find(z => z[0] === tz) || [tz, tz])[1];
  return '(UTC' + s + Math.floor(a / 60) + (a % 60 ? ':' + String(a % 60).padStart(2, '0') : '') + ') ' + name;
};

/* ---------- storage (synced keys exness.*, device keys pt.exness.*) ---------- */
U.load = (k, def) => { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } };
U.save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { console.warn('save failed', k, e); return false; } };
U.del = k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };

/* ---------- events ---------- */
const subs = {};
U.on = (ev, fn) => { (subs[ev] || (subs[ev] = new Set())).add(fn); return () => subs[ev].delete(fn); };
U.emit = (ev, data) => { const s = subs[ev]; if (s) for (const fn of Array.from(s)) { try { fn(data); } catch (e) { console.error(ev, e); } } };

U.debounce = (fn, ms) => { let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); }; };
U.throttleRaf = fn => { let q = false, args; return function (...a) { args = a; if (q) return; q = true; requestAnimationFrame(() => { q = false; fn.apply(this, args); }); }; };

/* ---------- icons (inline SVG symbols defined in index.html) ---------- */
U.icon = (id, cls) => '<svg class="ic ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + id + '"/></svg>';

/* ---------- popover menus ---------- */
let openMenu = null;
U.closeMenu = () => { if (openMenu) { const m = openMenu; openMenu = null; m.el.remove(); if (m.onclose) m.onclose(); } };
/* items: [{label, icon, right, check, danger, disabled, sep, header, sub, onClick, html}] */
U.menu = function (anchor, items, opt) {
  opt = opt || {};
  U.closeMenu();
  const el = U.el('div.pop-menu' + (opt.cls ? '.' + opt.cls : ''), { role: 'menu' });
  for (const it of items) {
    if (!it) continue;
    if (it.sep) { el.append(U.el('div.pm-sep')); continue; }
    if (it.header) { el.append(U.el('div.pm-head', { text: it.header })); continue; }
    if (it.node) { el.append(it.node); continue; }
    const row = U.el('button.pm-item' + (it.danger ? '.danger' : '') + (it.active ? '.active' : ''), { type: 'button', disabled: it.disabled ? true : null, role: 'menuitem' });
    row.innerHTML = (it.check != null ? '<span class="pm-check">' + (it.check ? U.icon('check') : '') + '</span>' : '') +
      (it.icon ? '<span class="pm-ic">' + (it.icon.startsWith('<') ? it.icon : U.icon(it.icon)) + '</span>' : '') +
      '<span class="pm-label">' + (it.html || U.esc(it.label)) + '</span>' + (it.right ? '<span class="pm-right">' + it.right + '</span>' : '');
    row.addEventListener('click', ev => { ev.stopPropagation(); if (!it.keep) U.closeMenu(); if (it.onClick) it.onClick(ev); });
    el.append(row);
  }
  document.body.append(el);
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
  const W = window.innerWidth, H = window.innerHeight;
  const mw = el.offsetWidth, mh = el.offsetHeight;
  let x = opt.alignRight ? r.right - mw : r.left, y = opt.up ? r.top - mh - 4 : r.bottom + 4;
  if (opt.side) { x = r.right + 6; y = r.top; }
  if (x + mw > W - 6) x = W - mw - 6; if (x < 6) x = 6;
  if (y + mh > H - 6) y = Math.max(6, r.top - mh - 4); if (y < 6) y = 6;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  if (opt.minWidth) el.style.minWidth = opt.minWidth + 'px';
  openMenu = { el, onclose: opt.onclose, anchor };
  return el;
};
document.addEventListener('pointerdown', e => { if (openMenu && !openMenu.el.contains(e.target) && !(openMenu.anchor && openMenu.anchor.contains && openMenu.anchor.contains(e.target))) U.closeMenu(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (openMenu) U.closeMenu(); } });
window.addEventListener('resize', () => U.closeMenu());

/* ---------- modal dialogs ---------- */
U.modal = function (opt) {
  const back = U.el('div.modal-back' + (opt.light ? '.light' : ''));
  const box = U.el('div.modal' + (opt.cls ? '.' + opt.cls : ''), { role: 'dialog', 'aria-modal': 'true' });
  if (opt.width) box.style.width = opt.width + 'px';
  const head = U.el('div.modal-head', null, U.el('div.modal-title', { text: opt.title || '' }), U.el('button.icon-btn.modal-x', { type: 'button', 'aria-label': 'Close', html: U.icon('x') }));
  const body = U.el('div.modal-body');
  if (typeof opt.body === 'string') body.innerHTML = opt.body; else if (opt.body) body.append(opt.body);
  box.append(head, body);
  if (opt.foot) { const f = U.el('div.modal-foot'); if (typeof opt.foot === 'string') f.innerHTML = opt.foot; else f.append(opt.foot); box.append(f); }
  back.append(box);
  document.body.append(back);
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); if (opt.onclose) opt.onclose(); };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  head.querySelector('.modal-x').onclick = close;
  back.addEventListener('pointerdown', e => { if (e.target === back && !opt.sticky) close(); });
  return { back, box, body, close };
};
U.confirm = (title, text, okLabel, danger) => new Promise(res => {
  const foot = U.el('div.row-end');
  const no = U.el('button.btn.btn-ghost', { type: 'button', text: 'Cancel' });
  const yes = U.el('button.btn' + (danger ? '.btn-red' : '.btn-yellow'), { type: 'button', text: okLabel || 'OK' });
  foot.append(no, yes);
  const m = U.modal({ title, body: '<p class="muted">' + text + '</p>', foot, width: 400, onclose: () => res(false) });
  no.onclick = () => { m.close(); };
  yes.onclick = () => { res(true); m.close(); };
});

/* ---------- toasts ---------- */
U.toast = function (title, text, kind, ms) {
  let host = U.$('#toasts');
  if (!host) { host = U.el('div#toasts'); document.body.append(host); }
  const t = U.el('div.toast.' + (kind || 'info'));
  t.innerHTML = '<span class="toast-ic">' + U.icon(kind === 'error' ? 'alert' : kind === 'ok' ? 'check-circle' : kind === 'warn' ? 'alert' : 'info') + '</span>' +
    '<div class="toast-txt"><b>' + U.esc(title) + '</b>' + (text ? '<span>' + text + '</span>' : '') + '</div><button class="icon-btn toast-x" aria-label="Close">' + U.icon('x') + '</button>';
  host.prepend(t);
  const kill = () => { t.classList.add('out'); setTimeout(() => t.remove(), 250); };
  t.querySelector('.toast-x').onclick = kill;
  setTimeout(kill, ms || 4500);
  while (host.children.length > 5) host.lastChild.remove();
};

/* ---------- small sound engine ---------- */
let actx = null;
U.beep = function (kind) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const seq = kind === 'tp' ? [[880, 0.08], [1320, 0.12]] : kind === 'sl' ? [[440, 0.1], [330, 0.16]] : kind === 'so' ? [[300, 0.15], [220, 0.15], [160, 0.25]] : kind === 'open' ? [[990, 0.06]] : [[1046, 0.1], [1318, 0.1], [1568, 0.14]];
    let t = actx.currentTime + 0.01;
    for (const [f, d] of seq) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(actx.destination); o.start(t); o.stop(t + d + 0.02); t += d;
    }
  } catch (e) { /* audio unavailable */ }
};

/* ---------- download helper ---------- */
U.download = (name, text, mime) => {
  const blob = text instanceof Blob ? text : new Blob([text], { type: mime || 'text/plain' });
  const a = U.el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
};
U.csv = rows => rows.map(r => r.map(c => { const s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\n');

/* drag helper: calls move(dx,dy,ev) and end(ev) */
U.drag = function (ev, move, end) {
  const x0 = ev.clientX, y0 = ev.clientY;
  const mv = e => move(e.clientX - x0, e.clientY - y0, e);
  const up = e => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); if (end) end(e); };
  window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
};

U.isPhone = () => window.matchMedia('(max-width: 820px)').matches;
})();
