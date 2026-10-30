const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function highlightSyntax(code, filename) {
  if (!code) return '';
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (ext === 'html' || ext === 'htm' || ext === 'svg') return highlightHtml(code);
  if (ext === 'css') return highlightCss(code);
  if (ext === 'py') return highlightPython(code);
  if (ext === 'json') return highlightJson(code);
  return highlightJs(code);
}

function highlightHtml(code){
 const regex = /(<!--[\s\S]*?-->)|(<!DOCTYPE[^>]*>)|(<\/?)([a-zA-Z0-9_-]+)((?:\s+[a-zA-Z0-9_:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*)(\/?>)/gi;
 let out = '', lastIdx = 0, match;
 while ((match = regex.exec(code)) !== null) {
  if (match.index > lastIdx) out += esc(code.slice(lastIdx, match.index));
  const [full, com, doctype, tagOpen, tagName, tagAttrs, tagClose] = match;
  if (com) out += `<span class="tok-com">${esc(com)}</span>`;
  else if (doctype) out += `<span class="tok-doctype">${esc(doctype)}</span>`;
  else if (tagName) {
   out += esc(tagOpen) + `<span class="tok-tag">${esc(tagName)}</span>`;
   if (tagAttrs) {
    const attrRegex = /([a-zA-Z0-9_:-]+)(\s*=\s*)("[^"]*"|'[^']*'|[^\s>]+)?/g;
    let attrOut = '', aLast = 0, aMatch;
    while ((aMatch = attrRegex.exec(tagAttrs)) !== null) {
     if (aMatch.index > aLast) attrOut += esc(tagAttrs.slice(aLast, aMatch.index));
     const [, aName, aEq, aVal] = aMatch;
     attrOut += `<span class="tok-attr">${esc(aName)}</span>`;
     if (aEq) attrOut += esc(aEq);
     if (aVal) attrOut += aVal.startsWith('"') || aVal.startsWith("'") ? `<span class="tok-str">${esc(aVal)}</span>` : `<span class="tok-val">${esc(aVal)}</span>`;
     aLast = attrRegex.lastIndex;
    }
    if (aLast < tagAttrs.length) attrOut += esc(tagAttrs.slice(aLast));
    out += attrOut;
   }
   out += esc(tagClose);
  } else out += esc(full);
  lastIdx = regex.lastIndex;
 }
 if (lastIdx < code.length) out += esc(code.slice(lastIdx));
 return out;
}

function highlightCss(code){
 const regex = /(\/\*[\s\S]*?\*\/)|(@[a-zA-Z-]+)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(#[a-fA-F0-9]{3,8}\b)|(\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg|fr)?\b)|(!important\b)|(\b[a-zA-Z-]+(?=\s*:))|([{}():;,])/g;
 let out = '', lastIdx = 0, match;
 while ((match = regex.exec(code)) !== null) {
  if (match.index > lastIdx) out += esc(code.slice(lastIdx, match.index));
  const [full, com, atRule, str, hex, num, imp, prop, punc] = match;
  if (com) out += `<span class="tok-com">${esc(com)}</span>`;
  else if (atRule) out += `<span class="tok-kw">${esc(atRule)}</span>`;
  else if (str) out += `<span class="tok-str">${esc(str)}</span>`;
  else if (hex) out += `<span class="tok-color">${esc(hex)}</span>`;
  else if (num) out += `<span class="tok-num">${esc(num)}</span>`;
  else if (imp) out += `<span class="tok-kw">${esc(imp)}</span>`;
  else if (prop) out += `<span class="tok-prop">${esc(prop)}</span>`;
  else if (punc) out += `<span class="tok-op">${esc(punc)}</span>`;
  else out += esc(full);
  lastIdx = regex.lastIndex;
 }
 if (lastIdx < code.length) out += esc(code.slice(lastIdx));
 return out;
}

function highlightJs(code){
 const regex = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(`(?:\\`|[\s\S])*?`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:async|await|break|case|catch|class|const|continue|debugger|default|delete|do|else|export|extends|finally|for|function|if|import|in|instanceof|let|new|return|super|switch|this|throw|try|typeof|var|void|while|with|yield|from|of)\b)|(\b(?:true|false|null|undefined|NaN|Infinity)\b)|(\b(?:String|Number|Boolean|Array|Object|Function|Promise|Map|Set|JSON|Math|Date|RegExp|Error|Symbol|document|window|console|localStorage|sessionStorage|fetch|crypto)\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|(\b(?:0x[a-fA-F0-9]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b)|(=>|===|!==|==|!=|<=|>=|\+\+|--|&&|\|\||[+\-*\/%&|^!~?:=<>])/g;
 let out = '', lastIdx = 0, match;
 while ((match = regex.exec(code)) !== null) {
  if (match.index > lastIdx) out += esc(code.slice(lastIdx, match.index));
  const [full, com, str, kw, val, type, fn, num, op] = match;
  if (com) out += `<span class="tok-com">${esc(com)}</span>`;
  else if (str) out += `<span class="tok-str">${esc(str)}</span>`;
  else if (kw) out += `<span class="tok-kw">${esc(kw)}</span>`;
  else if (val) out += `<span class="tok-const">${esc(val)}</span>`;
  else if (type) out += `<span class="tok-type">${esc(type)}</span>`;
  else if (fn) out += `<span class="tok-fn">${esc(fn)}</span>`;
  else if (num) out += `<span class="tok-num">${esc(num)}</span>`;
  else if (op) out += `<span class="tok-op">${esc(op)}</span>`;
  else out += esc(full);
  lastIdx = regex.lastIndex;
 }
 if (lastIdx < code.length) out += esc(code.slice(lastIdx));
 return out;
}

function highlightPython(code){
 const regex = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|(?:f|r|b)?'(?:\\.|[^'\\])*'|(?:f|r|b)?"(?:\\.|[^"\\])*")|(\b(?:def|class|if|elif|else|for|while|try|except|finally|with|as|import|from|return|yield|pass|raise|break|continue|lambda|async|await|and|or|not|is|in|global|nonlocal|assert)\b)|(\b(?:True|False|None)\b)|(\b(?:print|len|range|str|int|float|list|dict|set|tuple|open|type|enumerate|zip|isinstance|sum|min|max|any|all|map|filter)\b)|(\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\())|(\b\d+(?:\.\d+)?\b)|([+\-*\/%&|^!~=<>]=?|==|!=|<=|>=)/g;
 let out = '', lastIdx = 0, match;
 while ((match = regex.exec(code)) !== null) {
  if (match.index > lastIdx) out += esc(code.slice(lastIdx, match.index));
  const [full, com, str, kw, val, built, fn, num, op] = match;
  if (com) out += `<span class="tok-com">${esc(com)}</span>`;
  else if (str) out += `<span class="tok-str">${esc(str)}</span>`;
  else if (kw) out += `<span class="tok-kw">${esc(kw)}</span>`;
  else if (val) out += `<span class="tok-const">${esc(val)}</span>`;
  else if (built) out += `<span class="tok-type">${esc(built)}</span>`;
  else if (fn) out += `<span class="tok-fn">${esc(fn)}</span>`;
  else if (num) out += `<span class="tok-num">${esc(num)}</span>`;
  else if (op) out += `<span class="tok-op">${esc(op)}</span>`;
  else out += esc(full);
  lastIdx = regex.lastIndex;
 }
 if (lastIdx < code.length) out += esc(code.slice(lastIdx));
 return out;
}

function highlightJson(code){
 const regex = /("(?:\\.|[^"\\])*"(?=\s*:))|("(?:\\.|[^"\\])*")|(\b(?:true|false|null)\b)|(\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g;
 let out = '', lastIdx = 0, match;
 while ((match = regex.exec(code)) !== null) {
  if (match.index > lastIdx) out += esc(code.slice(lastIdx, match.index));
  const [full, key, str, val, num] = match;
  if (key) out += `<span class="tok-attr">${esc(key)}</span>`;
  else if (str) out += `<span class="tok-str">${esc(str)}</span>`;
  else if (val) out += `<span class="tok-const">${esc(val)}</span>`;
  else if (num) out += `<span class="tok-num">${esc(num)}</span>`;
  else out += esc(full);
  lastIdx = regex.lastIndex;
 }
 if (lastIdx < code.length) out += esc(code.slice(lastIdx));
 return out;
}

const tests = [
  ['index.html', '<div class="app"><h1 id="title">Hello World</h1></div>'],
  ['styles.css', 'body { background: #000000; color: #ffffff !important; }'],
  ['script.js', 'const x = async () => { console.log("OK"); return true; };'],
  ['app.py', 'def greet(name: str):\n    # Say hello\n    print(f"Hello, {name}")'],
  ['data.json', '{\n  "version": 2,\n  "enabled": true\n}']
];

for (const [file, code] of tests) {
  const t0 = performance.now();
  const res = highlightSyntax(code, file);
  const t1 = performance.now();
  console.log(`[PASS] ${file} -> ${(t1-t0).toFixed(3)}ms`);
}
