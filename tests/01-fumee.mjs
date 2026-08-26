/** Test de fumée : démarrage, accueil, bibliothèque, fiche d'exercice. */
import { chromium } from './_pw.mjs';
const SHOT = process.env.SHOT_DIR || './tests/captures';
await (await import('node:fs')).promises.mkdir(SHOT, { recursive: true });
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8099/index.html';

const ok = [], errs = [];
const check = (n, c) => ok.push((c ? 'PASS' : 'ÉCHEC') + ' — ' + n);

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));

await p.goto(BASE, { waitUntil: 'networkidle' });
await p.waitForTimeout(800);
check('titre de la page', (await p.title()).startsWith('DrillBuilder Hockey'));
check('accueil affiché', (await p.locator('.hero h1').textContent()) === 'DrillBuilder Hockey');
check('avertissement de sécurité visible', (await p.locator('.notice').first().textContent()).includes('adapter les exercices'));
await p.screenshot({ path: SHOT + '/01-home-1440.png' });

await p.goto(BASE + '#/bibliotheque', { waitUntil: 'networkidle' });
await p.waitForTimeout(500);
const n = await p.locator('.drill-card').count();
check('bibliothèque de démonstration (' + n + ' exercices)', n >= 22);
check('compteur de résultats', (await p.locator('[role=status]').first().textContent()).includes('exercice'));
const thumbs = await p.locator('.drill-thumb svg').count();
check('miniatures rendues (' + thumbs + ')', thumbs === n);
await p.screenshot({ path: SHOT + '/02-library-1440.png' });

await p.locator('.drill-card .drill-body').first().click();
await p.waitForTimeout(500);
check('fiche ouverte', (await p.locator('h1').first().textContent()).length > 3);
check('diagramme affiché', (await p.locator('.detail-diagram svg').count()) === 1);
check('séquences listées', (await p.locator('.seq-tabs .seq-item').count()) >= 2);
check('légende des symboles', (await p.locator('.card .badge').count()) > 0);
check('déroulement numéroté', (await p.locator('.steps li').count()) >= 3);
await p.screenshot({ path: SHOT + '/03-detail-1440.png' });

console.log(ok.join('\n'));
console.log('--- erreurs JS:', errs.length ? errs.join('\n') : 'aucune');
await b.close();
process.exit(ok.some(l => l.startsWith('ÉCHEC')) || errs.length ? 1 : 0);
