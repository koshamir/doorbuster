// DOORBUSTER tool — build.mjs
// Builds dist/index.html: the whole game in one file (MINDBLOWN.md section 3, rule 4). The modules
// are ordered by their imports, their import/export keywords are stripped and they are placed in a
// single <script type="module">. three.js stays external (platform-hosted on Mindblown; a copy goes
// to dist/lib for local runs) and tune.json is copied next to the page.
// Run: node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { ROOT } from './lib.mjs';

const src = (f) => resolve(ROOT, 'src', f);
const order = [], seen = new Set();
const importRe = /^import\s+\{[^}]*\}\s+from\s+'\.\/([\w.]+)';\s*$/gm;

function visit(file) {
  if (seen.has(file)) return;
  seen.add(file);
  const text = readFileSync(src(file), 'utf8');
  for (const m of text.matchAll(importRe)) visit(m[1]);
  order.push(file);
}
visit('main.js');

const names = new Map();
let code = '';
for (const file of order) {
  let text = readFileSync(src(file), 'utf8');
  if (/^import\s(?!\{[^}]*\}\s+from\s+'\.\/[\w.]+';)/m.test(text.replace(importRe, ''))) throw new Error(file + ': only `import { a, b } from \'./x.js\';` is supported');
  text = text.replace(importRe, '').replace(/^export\s+(?=(async\s+)?function|const|let|class)/gm, '');
  if (/^export\s/m.test(text)) throw new Error(file + ': unsupported export form');
  // top-level names must be unique across files, because they now share one scope
  for (const m of text.matchAll(/^(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) {
    if (names.has(m[1])) throw new Error(`top-level name "${m[1]}" is declared in both ${names.get(m[1])} and ${file}`);
    names.set(m[1], file);
  }
  code += `\n// ======== src/${file} ========\n` + text.trim() + '\n';
}

let html = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const tag = '<script type="module" src="src/main.js"></script>';
if (!html.includes(tag)) throw new Error('index.html: entry script tag not found');
html = html.replace(tag, () => '<script type="module">' + code + '</script>');

const out = resolve(ROOT, 'dist', 'index.html');
mkdirSync(dirname(out), { recursive: true });
mkdirSync(resolve(ROOT, 'dist', 'lib'), { recursive: true });
writeFileSync(out, html);
copyFileSync(resolve(ROOT, 'lib', 'three.min.js'), resolve(ROOT, 'dist', 'lib', 'three.min.js'));
copyFileSync(resolve(ROOT, 'tune.json'), resolve(ROOT, 'dist', 'tune.json'));
console.log(`dist/index.html: ${order.length} modules (${order.join(', ')}), ${(html.length / 1024).toFixed(0)} KB`);
