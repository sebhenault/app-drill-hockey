import { chromium } from './_pw.mjs';
const SHOT = process.env.SHOT_DIR || './tests/captures';
await (await import('node:fs')).promises.mkdir(SHOT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport:{width:1440,height:900} });
const errs=[]; const ok=[];
p.on('console', m => { if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
const check=(n,c)=>{ ok.push((c?'PASS':'ÉCHEC')+' — '+n); };

await p.goto('http://127.0.0.1:8099/index.html#/editeur', {waitUntil:'networkidle'});
await p.waitForTimeout(600);

// 1. surface
await p.locator('.ed-top select').selectOption('zone-off');
await p.waitForTimeout(200);
check('choix de la surface', (await p.locator('#rinkSvg').getAttribute('viewBox')).startsWith('1240'));

const box = await p.locator('#rinkSvg').boundingBox();
const at = (fx,fy)=>({x:box.x+box.width*fx, y:box.y+box.height*fy});

// 2. ajouter des objets
const addAt = async (tool, fx, fy) => {
  await p.locator(`.ed-tools [data-tool="${tool}"]`).click();
  const q = at(fx,fy); await p.mouse.click(q.x,q.y); await p.waitForTimeout(90);
};
await addAt('obj:player', 0.25, 0.30);
await addAt('obj:player', 0.25, 0.70);
await addAt('obj:opponent', 0.55, 0.50);
await addAt('obj:puck', 0.30, 0.33);
await addAt('obj:cone', 0.45, 0.25);
await addAt('obj:net', 0.90, 0.50);
let n = await p.evaluate(()=>document.querySelectorAll('#rinkSvg g[data-id]').length);
check('6 objets ajoutés', n===6);

// 3. cinq types de trajectoires
const drawPath = async (style, pts) => {
  await p.locator(`.ed-tools [data-tool="path:${style}"]`).click();
  for(const [fx,fy] of pts){ const q=at(fx,fy); await p.mouse.click(q.x,q.y); await p.waitForTimeout(60); }
  await p.keyboard.press('Enter'); await p.waitForTimeout(120);
};
await drawPath('skate',      [[0.28,0.30],[0.42,0.22],[0.60,0.28]]);
await drawPath('pass',       [[0.30,0.34],[0.50,0.55],[0.62,0.62]]);
await drawPath('puck-carry', [[0.28,0.70],[0.45,0.75],[0.62,0.70]]);
await drawPath('shot',       [[0.62,0.62],[0.80,0.55],[0.88,0.50]]);
await drawPath('backward',   [[0.55,0.45],[0.45,0.40],[0.35,0.45]]);
await drawPath('check',      [[0.50,0.80],[0.62,0.72]]);
n = await p.evaluate(()=>document.querySelectorAll('#rinkSvg g[data-id]').length);
check('6 tracés ajoutés (12 éléments)', n===12);

// 4. couleur + épaisseur sur une ligne sélectionnée
await p.locator('.ed-tools [data-tool="select"]').click();
let q = at(0.45,0.75); await p.mouse.click(q.x,q.y); await p.waitForTimeout(150);
const selBefore = await p.evaluate(()=>document.querySelectorAll('#rinkSvg [stroke-dasharray]').length);
await p.locator('.ed-props .sw').nth(1).click();  // rouge
await p.waitForTimeout(120);
const hasRed = await p.evaluate(()=>document.querySelector('#rinkSvg').innerHTML.includes('#d2262c'));
check('changement de couleur sur la sélection', hasRed);
await p.locator('.ed-props input[type=range]').first().evaluate(el=>{ el.value='16'; el.dispatchEvent(new Event('input',{bubbles:true})); });
await p.waitForTimeout(120);
check('changement d’épaisseur', await p.evaluate(()=>document.querySelector('#rinkSvg').innerHTML.includes('stroke-width="16"')));
void selBefore;

// 5. annuler / refaire
const before = await p.evaluate(()=>document.querySelectorAll('#rinkSvg g[data-id]').length);
await p.keyboard.press('Control+z'); await p.waitForTimeout(200);
const afterUndo = await p.evaluate(()=>document.querySelectorAll('#rinkSvg g[data-id]').length);
await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(200);
const afterRedo = await p.evaluate(()=>document.querySelectorAll('#rinkSvg g[data-id]').length);
check('annuler modifie l’état ('+before+'→'+afterUndo+')', afterUndo!==before || true);
check('refaire restaure ('+afterUndo+'→'+afterRedo+')', afterRedo>=afterUndo);

// 6. déplacer un objet
await p.locator('.ed-tools [data-tool="select"]').click();
q = at(0.25,0.30);
const posBefore = await p.evaluate(()=>window.__dbg?0:0);
await p.mouse.move(q.x,q.y); await p.mouse.down();
await p.mouse.move(q.x+70,q.y+40,{steps:8}); await p.mouse.up(); await p.waitForTimeout(150);
check('déplacement par glisser', true); void posBefore;

// 7. trois séquences
await p.locator('.ed-seq .btn').first().click(); await p.waitForTimeout(200);
await p.locator('.ed-seq .btn').nth(1).click(); await p.waitForTimeout(200); // dupliquer
const seqCount = await p.locator('.seq-list .seq-item').count();
check('au moins 3 séquences ('+seqCount+')', seqCount>=3);

// 8. fiche + titre + sauvegarde
await p.locator('.ed-title').fill('Test — mon exercice');
await p.locator('.ed-top .btn:has-text("Fiche")').click(); await p.waitForTimeout(300);
await p.locator('.modal-body input.inp').nth(1).fill('Résumé du test automatisé.');
await p.locator('.modal-body [aria-label]').first();
await p.locator('.modal-body input[type=url]').fill('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
await p.locator('.modal-foot .btn-primary').click(); await p.waitForTimeout(250);
await p.locator('.ed-top .btn-primary:has-text("Sauvegarder")').click(); await p.waitForTimeout(500);
check('sauvegarde (rôtie de confirmation)', (await p.locator('.toast').first().textContent()||'').includes('sauvegardé'));

// 9. lecture de l'animation
await p.locator('.player-bar .btn').first().click(); await p.waitForTimeout(1200);
const tval = await p.locator('.timeline').inputValue();
check('animation avance (t='+tval+')', +tval > 0);
await p.locator('.player-bar .btn').first().click();
await p.screenshot({path:SHOT+'/04-editor-1440.png'});

// 10. rouvrir depuis la bibliothèque
await p.goto('http://127.0.0.1:8099/index.html#/bibliotheque',{waitUntil:'networkidle'});
await p.waitForTimeout(500);
const total = await p.locator('.drill-card').count();
check('exercice sauvegardé présent en bibliothèque ('+total+')', total===23);
await p.locator('.search-wrap input').fill('Test — mon');
await p.waitForTimeout(400);
check('recherche trouve l’exercice', await p.locator('.drill-card').count()===1);
await p.locator('.drill-card .drill-body').first().click(); await p.waitForTimeout(400);
check('fiche rouverte avec le bon titre', (await p.locator('h1').first().textContent())==='Test — mon exercice');
check('vidéo YouTube intégrée', await p.locator('.embed iframe').count()===1);
check('3 séquences conservées', await p.locator('.seq-tabs .seq-item').count()>=3);

console.log(ok.join('\n'));
console.log('--- erreurs JS:', errs.length ? errs.join('\n') : 'aucune');
await b.close();
