/* Amatu Trade — MQL5 → JavaScript translator for Expert Advisors.
   Covers the MQL5 most EAs are written in: #define, input/sinput (+ group), enum, struct, global and
   local variables, arrays, functions with reference (&) parameters, casts, integer division, static
   locals, color/char/date literals. Not supported: class/template, DLL #import, function overloading.
   The output runs inside AT.EA's runtime (with(env)), which implements the MQL5 API. */
(function () {
'use strict';
const AT = window.AT || (window.AT = {});
const M = AT.MQL = {};

const BASE_T = ['void', 'bool', 'char', 'uchar', 'short', 'ushort', 'int', 'uint', 'long', 'ulong', 'float', 'double', 'string', 'datetime', 'color'];
const INT_T = new Set(['bool', 'char', 'uchar', 'short', 'ushort', 'int', 'uint', 'long', 'ulong', 'datetime', 'color']);
const LIB_T = ['MqlDateTime', 'MqlTick', 'MqlRates', 'MqlTradeRequest', 'MqlTradeResult', 'MqlTradeCheckResult', 'MqlCalendarValue', 'MqlCalendarEvent',
  'CTrade', 'CPositionInfo', 'COrderInfo', 'CSymbolInfo', 'CAccountInfo'];
const RESERVED = new Set(['var', 'let', 'function', 'in', 'of', 'with', 'yield', 'await', 'typeof', 'instanceof', 'arguments', 'eval', 'export', 'import',
  'super', 'extends', 'debugger', 'finally', 'try', 'catch', 'throw', 'package', 'interface', 'implements', 'async', 'undefined', 'NaN', 'Infinity']);
const INT_FN = new Set(['PositionsTotal', 'OrdersTotal', 'ArraySize', 'StringLen', 'StringFind', 'Bars', 'iBars', 'HistoryDealsTotal', 'HistoryOrdersTotal',
  'SymbolsTotal', 'ObjectsTotal', 'GetLastError', 'TimeCurrent', 'TimeLocal', 'TimeGMT', 'TimeTradeServer', 'GetTickCount', 'MathRand', 'ArrayRange',
  'StringSplit', 'CopyBuffer', 'CopyRates', 'iTime', 'iHighest', 'iLowest', 'iBarShift', 'PeriodSeconds', 'StringToInteger', 'AccountInfoInteger',
  'SymbolInfoInteger', 'PositionGetInteger', 'OrderGetInteger', 'ObjectGetInteger', 'HistoryDealGetInteger', 'TerminalInfoInteger', 'MQLInfoInteger',
  'PositionGetTicket', 'OrderGetTicket', 'HistoryDealGetTicket', 'StructToTime', 'StringToTime', 'ArrayMaximum', 'ArrayMinimum', 'StringGetCharacter']);
/* built-ins whose scalar arguments are written back (MQL "&" parameters) */
const REF_FN = {
  OrderCalcMargin: [4], OrderCalcProfit: [5], StringTrimLeft: [0], StringTrimRight: [0], StringToUpper: [0], StringToLower: [0], StringReplace: [0],
  StringAdd: [0], StringInit: [0], StringFill: [0], StringSetCharacter: [0], SymbolInfoDouble: [2], SymbolInfoInteger: [2], SymbolInfoString: [2],
  PositionGetDouble: [1], PositionGetInteger: [1], PositionGetString: [1], OrderGetDouble: [1], OrderGetInteger: [1], OrderGetString: [1],
  HistoryDealGetDouble: [2], HistoryDealGetInteger: [2], HistoryDealGetString: [2], GlobalVariableGet: [1], ObjectGetInteger: [4],
  ObjectGetDouble: [4], ObjectGetString: [4], SymbolInfoSessionTrade: [3, 4], SymbolInfoSessionQuote: [3, 4]
};
M.LIB_T = LIB_T;

function fail(line, msg) { const e = new Error((line ? 'Baris ' + line + ': ' : '') + msg); e.line = line; throw e; }

/* ---------- 1. preprocessor: directives + inputs (line based, line numbers kept) ---------- */
function preprocess(src, warn) {
  src = String(src).replace(/\r\n?/g, '\n').replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const lines = src.split('\n');
  const inputs = [], defines = [], props = {}, elabels = {};
  let group = '', inImport = false;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i], s = L.trim();
    if (inImport) { if (/^#import\b/.test(s)) inImport = false; lines[i] = ''; continue; }
    if (s.startsWith('#')) {
      let m;
      if ((m = /^#property\s+(\w+)\s*(.*)$/.exec(s))) props[m[1]] = m[2].replace(/^"|"$/g, '');
      else if ((m = /^#define\s+(\w+)(\([^)]*\))?\s*(.*)$/.exec(s))) defines.push({ name: m[1], params: m[2] ? m[2].slice(1, -1).split(',').map(x => x.trim()).filter(Boolean) : null, body: m[3].replace(/\/\/.*$/, '').trim(), line: i + 1 });
      else if (/^#import\s+"/.test(s)) { inImport = true; warn.push('Baris ' + (i + 1) + ': #import DLL tidak didukung di browser (dilewati)'); }
      lines[i] = '';
      continue;
    }
    const em = /^\s*([A-Za-z_]\w*)\s*(?:=\s*[^,\/]+)?,?\s*\/\/\s*(.+)$/.exec(L); if (em) elabels[em[1]] = em[2].trim(); // enum member labels
    let m = /^\s*(?:input|sinput)\s+group\s+"([^"]*)"/.exec(L);
    if (m) { group = m[1]; lines[i] = ''; continue; }
    m = /^(\s*)(?:input|sinput)\s+(?:const\s+)?(\w+)\s+(\w+)\s*(?:=\s*(.*?))?\s*;\s*(?:\/\/\s*(.*))?$/.exec(L);
    if (m) {
      const [, ind, type, name, def, label] = m;
      inputs.push({ name, type, def: def == null ? '' : def, label: (label || '').trim() || name, group, line: i + 1 });
      lines[i] = ind + type + ' ' + name + ' = __inp("' + name + '", ' + (def == null || def === '' ? (type === 'string' ? '""' : type === 'bool' ? 'false' : '0') : def) + ');';
    }
  }
  return { text: lines.join('\n'), inputs, defines, props, elabels };
}

/* ---------- 2. lexer ---------- */
function colorLit(b) { const p = b.split(',').map(x => parseInt(x, 10) || 0); if (p.length === 3) return String(p[0] + p[1] * 256 + p[2] * 65536); return String(parseInt(b, 16) || 0); }
function dateLit(b) { const m = /^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(b.trim()); if (!m) return '0'; return String(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)) / 1000); }
const ESC = { n: 10, t: 9, r: 13, '0': 0, '\\': 92, "'": 39, '"': 34 };
const OPS3 = ['<<=', '>>=', '...'];
const OPS2 = ['==', '!=', '<=', '>=', '&&', '||', '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<', '>>', '::', '->'];
function lex(src) {
  const T = []; let i = 0, line = 1; const n = src.length;
  const push = (k, v) => T.push({ k, v, line });
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c <= ' ') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < n && src[j] !== '"') { if (src[j] === '\\') { s += src[j] + (src[j + 1] || ''); j += 2; continue; } if (src[j] === '\n') fail(line, 'string tidak ditutup'); s += src[j++]; }
      push('str', s); i = j + 1; continue;
    }
    if ((c === 'C' || c === 'D') && src[i + 1] === "'") { const j = src.indexOf("'", i + 2); push('num', c === 'C' ? colorLit(src.slice(i + 2, j)) : dateLit(src.slice(i + 2, j))); i = j + 1; continue; }
    if (c === "'") { let j = i + 1, ch; if (src[j] === '\\') { ch = ESC[src[j + 1]] != null ? ESC[src[j + 1]] : src.charCodeAt(j + 1); j += 2; } else { ch = src.charCodeAt(j); j++; } push('num', String(ch)); i = j + 1; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1]))) {
      const m = /^(0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)[uUlLfF]*/.exec(src.slice(i, i + 64));
      push('num', m[1]); i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_]\w*/.exec(src.slice(i, i + 256)); push('id', m[0]); i += m[0].length; continue; }
    const t3 = src.substr(i, 3), t2 = src.substr(i, 2);
    if (OPS3.includes(t3)) { push('op', t3); i += 3; continue; }
    if (OPS2.includes(t2)) { push('op', t2); i += 2; continue; }
    push('op', c); i++;
  }
  return T;
}

/* ---------- 3. translator ---------- */
M.compile = function (src) {
  const warn = [];
  const pre = preprocess(src, warn);
  const T = lex(pre.text);
  let N = T.length;
  const EOF = { k: 'eof', v: '', line: T.length ? T[N - 1].line : 0 };
  const tk = i => T[i] || EOF;

  const types = new Set(BASE_T.concat(LIB_T));
  const enums = {}, enumConst = new Set(), structs = {};
  const isType = t => t && t.k === 'id' && (types.has(t.v) || /^ENUM_\w+$/.test(t.v));
  const intType = ty => INT_T.has(ty) || !!enums[ty] || /^ENUM_/.test(ty);
  const isScalarType = ty => BASE_T.includes(ty) || !!enums[ty] || /^ENUM_/.test(ty);

  /* matching bracket helpers */
  const PAIR = { '(': ')', '[': ']', '{': '}' }, BACK = { ')': '(', ']': '[', '}': '{' };
  function match(i) { const o = T[i].v, c = PAIR[o]; let d = 0; for (let j = i; j < N; j++) { if (T[j].v === o) d++; else if (T[j].v === c && --d === 0) return j; } fail(T[i].line, "'" + o + "' tidak ditutup"); }
  function matchBack(i) { const c = T[i].v, o = BACK[c]; let d = 0; for (let j = i; j >= 0; j--) { if (T[j].v === c) d++; else if (T[j].v === o && --d === 0) return j; } return -1; }
  function stmtEnd(i, stop) { let d = 0; for (let j = i; j < N; j++) { const v = T[j].v; if (v === '(' || v === '[' || v === '{') d++; else if (v === ')' || v === ']' || v === '}') { if (d === 0) return j; d--; } else if (d === 0 && (v === ';' || (stop && stop.includes(v)))) return j; } return N; }
  function splitTop(a, b) { const parts = []; let d = 0, s = a; for (let j = a; j < b; j++) { const v = T[j].v; if (v === '(' || v === '[' || v === '{') d++; else if (v === ')' || v === ']' || v === '}') d--; else if (v === ',' && d === 0) { parts.push([s, j]); s = j + 1; } } if (b > s) parts.push([s, b]); return parts; }

  /* pass 0: enum / struct names are types */
  for (let i = 0; i < N; i++) {
    const v = T[i].v;
    if ((v === 'enum' || v === 'struct') && tk(i + 1).k === 'id') { types.add(T[i + 1].v); if (v === 'enum') enums[T[i + 1].v] = []; else structs[T[i + 1].v] = []; }
    if ((v === 'class' || v === 'template') && i + 1 < N) fail(T[i].line, v + ' belum didukung — tulis EA dengan fungsi biasa');
  }

  /* pass 1: top-level items + function signatures */
  const items = [], fnInfo = {};
  const globals = new Map();
  let i = 0;
  while (i < N) {
    const t = T[i];
    if (t.v === ';') { i++; continue; }
    if (t.v === 'enum' || t.v === 'struct') { const nm = tk(i + 1).v; const ob = t.v === 'enum' ? i + 2 : i + 2; if (tk(ob).v !== '{') fail(t.line, t.v + ' tanpa isi'); const cb = match(ob); items.push({ kind: t.v, name: nm, a: ob + 1, b: cb, line: t.line }); i = cb + 1; while (tk(i).v !== ';' && i < N && tk(i).k === 'id') i++; continue; }
    if (t.v === 'typedef') { i = stmtEnd(i) + 1; warn.push('Baris ' + t.line + ': typedef dilewati'); continue; }
    let j = i; const mods = [];
    while (['static', 'const', 'extern', 'virtual', 'input', 'sinput'].includes(tk(j).v)) mods.push(T[j++].v);
    if (!isType(tk(j))) fail(tk(j).line, "tidak dikenal di tingkat atas: '" + tk(j).v + "'");
    const type = T[j].v; j++;
    while (tk(j).v === '*' || tk(j).v === '&') j++;
    if (tk(j).k !== 'id') fail(tk(j).line, 'nama tidak ada setelah tipe ' + type);
    const name = T[j].v;
    if (tk(j + 1).v === '(') {
      const pe = match(j + 1); let k = pe + 1;
      while (tk(k).v === 'const') k++;
      if (tk(k).v === ';') { i = k + 1; continue; } // prototype
      if (tk(k).v !== '{') fail(tk(k).line, "'{' diharapkan setelah fungsi " + name);
      const be = match(k);
      const params = splitTop(j + 2, pe).map(([a, b]) => parseParam(a, b)).filter(Boolean);
      if (fnInfo[name]) warn.push('Baris ' + t.line + ': fungsi ' + name + ' di-overload — hanya versi terakhir dipakai');
      fnInfo[name] = { ret: type, refs: params.map((p, x) => (p.ref ? x : -1)).filter(x => x >= 0), params };
      items.push({ kind: 'fn', name, type, params, a: k + 1, b: be, line: t.line });
      i = be + 1; continue;
    }
    const se = stmtEnd(j);
    for (const [x] of splitTop(j, se)) { let q = x; while (tk(q).v === '*' || tk(q).v === '&') q++; globals.set(tk(q).v, { type, arr: T.slice(q, se).some(z => z.v === '[') && tk(q + 1).v === '[' }); }
    items.push({ kind: 'var', type, mods, a: i, b: se, line: t.line });
    i = se + 1;
  }
  function parseParam(a, b) {
    let j = a, cst = false;
    if (b <= a) return null;
    if (tk(j).v === 'void' && b - a === 1) return null;
    while (tk(j).v === 'const') { cst = true; j++; }
    if (!isType(tk(j))) fail(tk(j).line, "tipe parameter tidak dikenal: '" + tk(j).v + "'");
    const type = T[j].v; j++;
    let ref = false; while (tk(j).v === '&' || tk(j).v === '*') { if (T[j].v === '&') ref = true; j++; }
    const name = tk(j).v; j++;
    let arr = false; while (tk(j).v === '[') { arr = true; j = match(j) + 1; }
    let def = null; if (tk(j).v === '=') def = [j + 1, b];
    return { type, name, arr, ref: ref && !cst && !arr && isScalarType(type), def };
  }

  /* ---- expression / statement emitter ---- */
  const statics = [];
  function varInfo(name, ctx) { return (ctx.scope && ctx.scope.get(name)) || globals.get(name) || null; }
  function isIntRange(a, b, ctx) { // [a, b)
    if (b <= a) return false;
    let j = a;
    while (j < b) {
      const t = T[j];
      if (t.k === 'num') { if (/[.eE]/.test(t.v) && !/^0[xX]/.test(t.v)) return false; j++; continue; }
      if (t.k === 'str') return false;
      if (t.k === 'id') {
        if (tk(j + 1).v === '(') { const fi = fnInfo[t.v]; if (!(fi ? intType(fi.ret) : INT_FN.has(t.v))) return false; j = match(j + 1) + 1; continue; }
        if (tk(j + 1).v === '.') return false;
        if (enumConst.has(t.v)) { j++; continue; }
        const vi = varInfo(t.v, ctx); if (!vi || !intType(vi.type)) return false;
        if (tk(j + 1).v === '[') { j = match(j + 1) + 1; continue; }
        j++; continue;
      }
      if (t.v === '(' && isType(tk(j + 1)) && tk(j + 2).v === ')') { if (!intType(T[j + 1].v)) return false; j += 3; continue; }
      if (['+', '-', '*', '%', '/', '(', ')', '~'].includes(t.v)) { j++; continue; }
      return false;
    }
    return true;
  }
  function atomStart(e) { // first token of the operand that ends at e (inclusive)
    let j = e; const t = tk(j);
    if (t.v === ')' || t.v === ']') { j = matchBack(j); if (j < 0) return -1; if (tk(j - 1).k === 'id') j--; }
    else if (t.k !== 'id' && t.k !== 'num') return -1;
    if (tk(j - 1).v === '.') return -1;
    if (tk(j - 1).v === ')' && isType(tk(j - 2)) && tk(j - 3).v === '(') j -= 3; // cast
    return j;
  }
  function operandEnd(s) { // exclusive end of the unary/primary operand starting at s
    let j = s;
    while (['-', '+', '!', '~'].includes(tk(j).v)) j++;
    if (tk(j).v === '(' && isType(tk(j + 1)) && tk(j + 2).v === ')') return operandEnd(j + 3);
    if (tk(j).v === '(') j = match(j) + 1;
    else if (tk(j).k === 'id' || tk(j).k === 'num' || tk(j).k === 'str') { if (tk(j).v === 'new') j++; j++; }
    else return j + 1;
    while (true) {
      const v = tk(j).v;
      if (v === '.') j += 2; else if (v === '(' || v === '[') j = match(j) + 1; else if (v === '++' || v === '--') j++; else break;
    }
    return j;
  }
  function defaultFor(type, arr, dims, ctx) {
    const el = structs[type] || LIB_T.includes(type) ? '() => new ' + type + '()' : type === 'string' ? '""' : type === 'bool' ? 'false' : '0';
    if (!arr) return structs[type] || LIB_T.includes(type) ? 'new ' + type + '()' : el;
    if (!dims.length) return '__arr(' + el + ', 0)';
    let code = el;
    for (let d = dims.length - 1; d >= 0; d--) code = d === dims.length - 1 ? '__arr(' + code + ', ' + (dims[d] || '0') + ')' : '__arr(() => ' + code + ', ' + (dims[d] || '0') + ')';
    return code;
  }
  function emitInit(a, b, ctx) { // initializer; {..} becomes array / struct
    if (tk(a).v === '{') { const e = match(a); const parts = splitTop(a + 1, e).map(([x, y]) => emitInit(x, y, ctx)); return '[' + parts.join(', ') + ']'; }
    return emit(a, b, ctx);
  }
  function isDeclAt(k, a, ctx) {
    let j = k;
    while (tk(j).v === 'static' || tk(j).v === 'const') j++;
    if (!isType(tk(j))) return false;
    const prev = k > a ? tk(k - 1).v : ';';
    if (!['{', '}', ';', '(', ')', ':', 'else', 'do'].includes(prev) && k > a) return false;
    if (prev === '(' && tk(j + 1).v === ')') return false; // cast
    let q = j + 1; while (tk(q).v === '*' || tk(q).v === '&') q++;
    if (tk(q).k !== 'id') return false;
    return ['=', ';', ',', '[', ')', ':'].includes(tk(q + 1).v);
  }
  function emitDecl(k, b, ctx) { // returns { code, next } — next points at ';' / ')' that ends the declaration
    let j = k, isStatic = false;
    while (['static', 'const', 'extern', 'input', 'sinput'].includes(tk(j).v)) { if (T[j].v === 'static') isStatic = true; j++; }
    const type = T[j].v; j++;
    const end = stmtEnd(j, [')']);
    const decls = splitTop(j, Math.min(end, b)).map(([x, y]) => {
      let q = x; while (tk(q).v === '*' || tk(q).v === '&') q++;
      const name = tk(q).v; q++;
      const dims = []; let arr = false;
      while (tk(q).v === '[') { arr = true; const e = match(q); dims.push(e > q + 1 ? emit(q + 1, e, ctx) : ''); q = e + 1; }
      let init;
      if (tk(q).v === '=') {
        if (tk(q + 1).v === '{' && (structs[type] || LIB_T.includes(type)) && !arr) init = 'new ' + type + '()';
        else init = emitInit(q + 1, y, ctx);
        if (arr && tk(q + 1).v === '{') init = '__arrOf(' + init + ', ' + (structs[type] || LIB_T.includes(type) ? '() => new ' + type + '()' : type === 'string' ? '""' : type === 'bool' ? 'false' : '0') + ')';
      } else init = defaultFor(type, arr, dims, ctx);
      return { name, init, arr };
    });
    const out = [];
    for (const d of decls) {
      if (ctx.scope) ctx.scope.set(d.name, { type, arr: d.arr });
      if (isStatic && ctx.fn) {
        const g = '__s_' + ctx.fn + '_' + d.name;
        ctx.statics.set(d.name, g); globals.set(g, { type, arr: d.arr });
        statics.push('let ' + g + ' = ' + d.init + ';');
      } else out.push(jsName(d.name) + ' = ' + d.init);
    }
    return { code: out.length ? 'let ' + out.join(', ') : '', next: end };
  }
  const jsName = n => (RESERVED.has(n) ? n + '_' : n);
  function castWrap(type, code) {
    if (type === 'double' || type === 'float') return '(+(' + code + '))';
    if (type === 'string') return '__ts(' + code + ')';
    if (type === 'bool') return '(!!(' + code + '))';
    if (INT_T.has(type) && type !== 'color') return '__ti(' + code + ')';
    return '(' + code + ')';
  }
  function emit(a, b, ctx) {
    const o = [], startAt = {}, closeAfter = {};
    let k = a;
    while (k < b) {
      const t = T[k], k0 = k;
      startAt[k] = o.length;
      if (isDeclAt(k, a, ctx)) { const r = emitDecl(k, b, ctx); if (r.code) o.push(r.code); k = r.next; }
      else if (t.k === 'id') {
        const prevDot = tk(k - 1).v === '.' || tk(k - 1).v === '->';
        if (prevDot) { o.push(t.v); k++; }
        else if (t.v === 'NULL') { o.push('null'); k++; }
        else if (t.v === 'delete') { o.push('void'); k++; }
        else if (t.v === 'sizeof') { const e = match(k + 1); o.push('8'); k = e + 1; }
        else if (tk(k + 1).v === '(' && (fnInfo[t.v] || REF_FN[t.v])) {
          const refs = fnInfo[t.v] ? fnInfo[t.v].refs : REF_FN[t.v];
          const e = match(k + 1);
          const args = splitTop(k + 2, e).map(([x, y], ai) => { const c = emit(x, y, ctx); return refs.includes(ai) ? '{get v(){return ' + c + '},set v(__x){' + c + '=__x}}' : c; });
          o.push(jsName(t.v) + '(' + args.join(', ') + ')'); k = e + 1;
        } else {
          let nm = t.v;
          if (ctx.statics && ctx.statics.has(nm)) nm = ctx.statics.get(nm);
          else if (ctx.scope && ctx.scope.get(nm) && ctx.scope.get(nm).ref) nm = jsName(nm) + '.v';
          else nm = jsName(nm);
          o.push(nm); k++;
        }
      } else if (t.k === 'num') { o.push(t.v); k++; }
      else if (t.k === 'str') {
        let s = '"' + t.v + '"'; k++;
        while (tk(k).k === 'str') { s += ' + "' + T[k].v + '"'; k++; }
        o.push(s);
      } else if (t.v === '(' && isType(tk(k + 1)) && (tk(k + 2).v === ')' || (tk(k + 2).v === '*' && tk(k + 3).v === ')'))) {
        const ce = tk(k + 2).v === ')' ? k + 3 : k + 4;
        const oe = operandEnd(ce);
        o.push(castWrap(T[k + 1].v, emit(ce, Math.min(oe, b), ctx))); k = Math.min(oe, b);
      } else if (t.v === '/' ) {
        // integer division: int / int truncates in MQL
        let ls = atomStart(k - 1);
        while (ls > a && ['*', '%', '/'].includes(tk(ls - 1).v)) { const p = atomStart(ls - 2); if (p < 0) break; ls = p; }
        const re = operandEnd(k + 1);
        if (ls >= a && startAt[ls] != null && re <= b && isIntRange(ls, k, ctx) && isIntRange(k + 1, re, ctx)) {
          o[startAt[ls]] = '__idiv(' + o[startAt[ls]];
          o.push(','); closeAfter[re - 1] = (closeAfter[re - 1] || 0) + 1;
        } else o.push('/');
        k++;
      } else if (t.v === '::') { k++; }
      else if (t.v === '->') { o.push('.'); k++; }
      else { o.push(t.v); k++; }
      for (let q = k0; q < k; q++) if (closeAfter[q]) { o.push(')'.repeat(closeAfter[q])); closeAfter[q] = 0; }
    }
    return o.join(' ');
  }

  /* ---- assemble ---- */
  const head = [], body = [];
  for (const d of pre.defines) {
    const dt = lex(d.body);
    const base = T.length; T.push(...dt); const NN = T.length; N = NN;
    const gctx = { scope: null, refs: null, statics: null, fn: '' };
    let code;
    try { code = dt.length ? emit(base, NN, gctx) : '1'; } catch (e) { code = '0'; warn.push('Baris ' + d.line + ': #define ' + d.name + ' tidak bisa diterjemahkan'); }
    if (d.params) head.push('function ' + jsName(d.name) + '(' + d.params.join(', ') + ') { return (' + code + '); }');
    else { head.push('const ' + jsName(d.name) + ' = (' + code + ');'); if (dt.length === 1 && dt[0].k === 'num' && !/[.eE]/.test(dt[0].v)) enumConst.add(d.name); }
  }
  const gctx = { scope: null, refs: null, statics: null, fn: '' };
  const enumInfo = {};
  for (const it of items) {
    if (it.kind === 'enum') {
      let prev = '-1', num = -1;
      const mem = [];
      for (const [x, y] of splitTop(it.a, it.b)) {
        if (y <= x) continue;
        const nm = T[x].v;
        const val = tk(x + 1).v === '=' ? '(' + emit(x + 2, y, gctx) + ')' : '(' + prev + ') + 1';
        if (tk(x + 1).v === '=') { const lit = y === x + 3 && T[x + 2].k === 'num' ? +T[x + 2].v : (y === x + 4 && T[x + 2].v === '-' && T[x + 3].k === 'num' ? -T[x + 3].v : NaN); num = isNaN(lit) ? num + 1 : lit; } else num++;
        head.push('const ' + jsName(nm) + ' = ' + val + ';');
        enumConst.add(nm); mem.push({ n: nm, v: num }); prev = nm;
      }
      enums[it.name] = mem; enumInfo[it.name] = mem;
    } else if (it.kind === 'struct') {
      const fields = [];
      let j = it.a;
      while (j < it.b) {
        if (tk(j).v === ';') { j++; continue; }
        let q = j; while (['const', 'static'].includes(tk(q).v)) q++;
        if (!isType(tk(q))) fail(tk(q).line, 'isi struct tidak dikenal: ' + tk(q).v);
        const ty = T[q].v; const se = stmtEnd(q + 1);
        if (T.slice(q, se).some(x => x.v === '(')) fail(tk(q).line, 'method di dalam struct belum didukung');
        for (const [x, y] of splitTop(q + 1, se)) {
          const nm = T[x].v; const dims = []; let p = x + 1, arr = false;
          while (tk(p).v === '[') { arr = true; const e = match(p); dims.push(e > p + 1 ? emit(p + 1, e, gctx) : ''); p = e + 1; }
          fields.push('this.' + nm + ' = ' + defaultFor(ty, arr, dims, gctx) + ';');
        }
        j = se + 1;
      }
      head.push('class ' + it.name + ' { constructor() { ' + fields.join(' ') + ' } }');
    }
  }
  for (const it of items) {
    if (it.kind === 'var') {
      const ctx = { scope: globals, refs: null, statics: null, fn: '' };
      const r = emitDecl(it.a, it.b, ctx);
      body.push(r.code + ';');
    } else if (it.kind === 'fn') {
      const scope = new Map(), refs = new Set();
      const ps = it.params.map(p => { scope.set(p.name, { type: p.type, arr: p.arr, ref: p.ref }); if (p.ref) refs.add(p.name); return jsName(p.name) + (p.def ? ' = ' + emit(p.def[0], p.def[1], gctx) : ''); });
      const ctx = { scope, refs, statics: new Map(), fn: it.name };
      body.push('function ' + jsName(it.name) + '(' + ps.join(', ') + ') {\n' + emit(it.a, it.b, ctx) + '\n}');
    }
  }
  const handlers = ['OnInit', 'OnDeinit', 'OnTick', 'OnTimer', 'OnTrade', 'OnTradeTransaction', 'OnChartEvent', 'OnBookEvent'];
  const code = 'with (__env) {\n' + head.join('\n') + '\n' + body.join('\n') + '\n' + statics.join('\n') + '\nreturn {' + handlers.map(h => h + ': typeof ' + h + " === 'function' ? " + h + ' : null').join(', ') + '};\n}';
  let fn;
  try { fn = new Function('__env', '__inp', code); } // eslint-disable-line no-new-func
  catch (e) { const er = new Error('Terjemahan gagal (' + e.message + '). Bagian MQL5 ini belum didukung.'); er.code = code; throw er; }
  if (!fnInfo.OnTick && !fnInfo.OnTimer) warn.push('Tidak ada OnTick/OnTimer — EA tidak akan melakukan apa-apa');
  for (const inp of pre.inputs) if (enumInfo[inp.type]) inp.opts = enumInfo[inp.type].map(o => Object.assign({ l: pre.elabels[o.n] || '' }, o));
  return { fn, code, inputs: pre.inputs, props: pre.props, warn };
};

M.isEx5 = buf => { try { const b = new Uint8Array(buf.slice(0, 4)); return b[0] === 0x45 && b[1] === 0x58 && b[2] === 0x35; } catch (e) { return false; } };
})();
