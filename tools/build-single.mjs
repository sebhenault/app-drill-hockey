/**
 * Assemble la PWA en un seul fichier HTML autonome.
 *
 * L'Artifact Claude interdit toute requête vers un hôte externe et sert une
 * page unique : les modules ES ne peuvent donc pas être chargés séparément.
 * Ce script concatène les modules dans l'ordre des dépendances, retire les
 * lignes `import`/`export` (tout se retrouve dans une seule portée de module)
 * et vérifie qu'aucun nom global n'entre en collision.
 *
 *   node tools/build-single.mjs            → dist/drillbuilder-hockey.html
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jsDir = path.join(root, 'pwa', 'js');

// Ordre topologique des dépendances.
const ORDER = [
  'util.js', 'i18n.js', 'taxonomy.js', 'rink.js', 'symbols.js', 'qr.js',
  'render.js', 'store.js', 'seed.js', 'exporter.js', 'coach.js', 'plans.js', 'editor.js', 'app.js',
];

const IMPORT_RE = /^\s*import\s(?:[\s\S]*?)\sfrom\s+['"][^'"]+['"];?\s*$/gm;
const IMPORT_BARE_RE = /^\s*import\s+['"][^'"]+['"];?\s*$/gm;

function strip(src) {
  return src
    .replace(IMPORT_RE, '')
    .replace(IMPORT_BARE_RE, '')
    .replace(/^export\s+(const|let|var|function|class|async)\b/gm, '$1')
    .replace(/^export\s*\{[^}]*\};?\s*$/gm, '');
}

/** Déclarations de premier niveau, pour détecter les collisions de noms. */
function topLevelNames(src) {
  const names = new Set();
  const re = /^(?:const|let|var|function|class|async function)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  const destr = /^const\s*\{([^}]*)\}\s*=/gm;
  while ((m = destr.exec(src))) {
    for (const part of m[1].split(',')) {
      const n = part.split(':').pop().trim().replace(/=.*$/, '').trim();
      if (n) names.add(n);
    }
  }
  return names;
}

/** Noms exportés par un module, pour reconstruire les espaces de noms. */
function exportedNames(src) {
  const names = new Set();
  const re = /^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
  let m;
  while ((m = re.exec(src))) names.add(m[1]);
  const list = /^export\s*\{([^}]*)\}/gm;
  while ((m = list.exec(src))) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (n) names.add(n);
    }
  }
  return [...names];
}

// `import * as store from './store.js'` : la portée fusionnée n'a plus
// d'espace de noms. On le reconstruit explicitement après le module concerné.
const NS_RE = /^\s*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]\.\/([\w.-]+)['"];?\s*$/gm;
const namespaces = new Map();   // fichier → [nom d'espace]
for (const file of ORDER) {
  const raw = fs.readFileSync(path.join(jsDir, file), 'utf8');
  let m;
  NS_RE.lastIndex = 0;
  while ((m = NS_RE.exec(raw))) {
    const [, alias, target] = m;
    if (!namespaces.has(target)) namespaces.set(target, new Set());
    namespaces.get(target).add(alias);
  }
}

const seen = new Map();
const collisions = [];
const parts = [];

for (const file of ORDER) {
  const raw = fs.readFileSync(path.join(jsDir, file), 'utf8');
  const code = strip(raw);
  for (const n of topLevelNames(code)) {
    if (seen.has(n)) collisions.push(`${n} : ${seen.get(n)} ↔ ${file}`);
    else seen.set(n, file);
  }
  let block = `/* ===== ${file} ===== */\n${code.trim()}\n`;
  if (namespaces.has(file)) {
    const names = exportedNames(raw);
    for (const alias of namespaces.get(file)) {
      if (seen.has(alias)) collisions.push(`${alias} (espace de noms) : ${seen.get(alias)} ↔ ${file}`);
      seen.set(alias, file);
      block += `const ${alias} = { ${names.join(', ')} };\n`;
    }
  }
  parts.push(block);
}

if (collisions.length) {
  console.error('Collisions de noms de premier niveau :\n  ' + collisions.join('\n  '));
  process.exit(1);
}

let js = parts.join('\n');

// Pas de service worker dans un fichier unique : la page est déjà autonome.
js = js.replace(
  /if \('serviceWorker' in navigator[\s\S]*?\n  \}\n/,
  '// (Pas de service worker dans la version mono-fichier : la page est autonome.)\n',
);

const css = fs.readFileSync(path.join(root, 'pwa', 'styles.css'), 'utf8');

const html = `<title>DrillBuilder Hockey</title>
<meta name="theme-color" content="#0d1218">
<style>
${css}
</style>

<div id="app"></div>
<div id="toasts" aria-live="polite"></div>
<div id="printArea" class="print-only"></div>

<script type="module">
${js}
</script>
`;

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'drillbuilder-hockey.html');
fs.writeFileSync(out, html);
console.log(`${out} — ${(html.length / 1024).toFixed(0)} Ko, ${ORDER.length} modules, aucune collision`);
