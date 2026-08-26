import { chromium } from './_pw.mjs';
const SHOT = process.env.SHOT_DIR || './tests/captures';
await (await import('node:fs')).promises.mkdir(SHOT, { recursive: true });
const b = await chromium.launch();
const ok=[], errs=[];
const check=(n,c)=>ok.push((c?'PASS':'ÉCHEC')+' — '+n);

// ---------- Filtres, plans, export ----------
const p = await b.newPage({ viewport:{width:1440,height:900} });
p.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
p.on('console', m => { if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
await p.goto('http://127.0.0.1:8099/index.html#/bibliotheque',{waitUntil:'networkidle'});
await p.waitForTimeout(600);

await p.locator('.lib-bar .btn', {hasText:'Filtres'}).click(); await p.waitForTimeout(200);
await p.locator('.filters-panel .opt', {hasText:'U9'}).first().click(); await p.waitForTimeout(300);
const nU9 = await p.locator('.drill-card').count();
check('filtre par âge U9 ('+nU9+' exercices)', nU9>0 && nU9<22);
check('pastille de filtre affichée', await p.locator('.chip').count()===1);

await p.locator('.filters-panel .opt', {hasText:'Freinage et arrêt'}).first().click(); await p.waitForTimeout(300);
const nCombo = await p.locator('.drill-card').count();
check('filtres combinés âge + habileté ('+nCombo+')', nCombo>0 && nCombo<=nU9);
check('deux pastilles', await p.locator('.chip').count()===2);
await p.screenshot({path:SHOT+'/05-filters-1440.png'});

await p.locator('.chip button').first().click(); await p.waitForTimeout(300);
check('retrait d’une pastille', await p.locator('.chip').count()===1);
await p.locator('.filters-panel .btn', {hasText:'Tout effacer'}).click(); await p.waitForTimeout(300);
{ const nAll = await p.locator('.drill-card').count();
  check('effacement de tous les filtres ('+nAll+')', nAll===22 && (await p.locator('.chip').count())===0); }

// ---------- Plan de pratique ----------
await p.goto('http://127.0.0.1:8099/index.html#/plans',{waitUntil:'networkidle'});
await p.waitForTimeout(400);
await p.locator('.btn-primary', {hasText:'Nouveau plan'}).click(); await p.waitForTimeout(600);
check('constructeur de plan ouvert', await p.locator('.plan-grid').count()===1);

for (let i=0;i<3;i++){
  await p.locator('.btn-primary', {hasText:'Ajouter un exercice'}).click(); await p.waitForTimeout(300);
  await p.locator('.modal-body .list-row').nth(i).click(); await p.waitForTimeout(350);
}
await p.locator('.btn', {hasText:'Échauffement'}).first().click(); await p.waitForTimeout(250);
await p.locator('.btn', {hasText:'Pause'}).first().click(); await p.waitForTimeout(250);
const items = await p.locator('.plan-item').count();
check('5 blocs dans le plan ('+items+')', items===5);
const totalTxt = await p.locator('.total-bar .big').textContent();
check('total calculé automatiquement ('+totalTxt+')', /\d+ min/.test(totalTxt));
// dépassement
await p.locator('.plan-item .pi-dur input').first().fill('90');
await p.locator('.plan-item .pi-dur input').first().dispatchEvent('input');
await p.waitForTimeout(300);
check('alerte de dépassement', (await p.locator('.total-bar').getAttribute('class')).includes('over')
   && (await p.locator('.badge-warn').count())>0);
// réordonner
const first = await p.locator('.plan-item strong').first().textContent();
await p.locator('.plan-item .btn', {hasText:'↓'}).first().click(); await p.waitForTimeout(300);
const newFirst = await p.locator('.plan-item strong').first().textContent();
check('réordonnancement des blocs', first!==newFirst);
await p.screenshot({path:SHOT+'/06-plan-1440.png'});

// ---------- Exports ----------
await p.goto('http://127.0.0.1:8099/index.html#/bibliotheque',{waitUntil:'networkidle'});
await p.waitForTimeout(500);
await p.locator('.drill-card .drill-body').first().click(); await p.waitForTimeout(400);
await p.locator('.btn', {hasText:'Exporter'}).first().click(); await p.waitForTimeout(300);

const dl1 = p.waitForEvent('download');
await p.locator('.modal .btn', {hasText:'Image vectorielle SVG'}).click();
const d1 = await dl1; check('export SVG ('+d1.suggestedFilename()+')', d1.suggestedFilename().endsWith('.svg'));

const dl2 = p.waitForEvent('download');
await p.locator('.modal .btn', {hasText:'Image PNG'}).click();
const d2 = await dl2;
const path2 = await d2.path();
const fs = await import('fs');
const size = fs.statSync(path2).size;
check('export PNG ('+d2.suggestedFilename()+', '+Math.round(size/1024)+' ko)', size>10000);

const dl3 = p.waitForEvent('download');
await p.locator('.modal .btn', {hasText:'Fichier JSON'}).click();
const d3 = await dl3;
const j = JSON.parse(fs.readFileSync(await d3.path(),'utf8'));
check('export JSON valide ('+j.drills.length+' exercice)', j.app==='drillbuilder-hockey' && j.drills.length===1);

// code QR
await p.locator('.modal input[type=checkbox]').last().check(); await p.waitForTimeout(500);
const qrCount = await p.locator('.modal svg[aria-label*="Code QR"]').count();
const qrMsg = await p.locator('.modal .err-msg').count();
check('code QR ou message clair', qrCount===1 || qrMsg===1);

// lien de partage
await p.locator('.modal .btn', {hasText:'Copier le lien'}).click(); await p.waitForTimeout(400);
check('lien de partage copié', (await p.locator('.toast').last().textContent()||'').length>0);

console.log(ok.join('\n'));
console.log('--- erreurs JS:', errs.length ? errs.join('\n') : 'aucune');
await b.close();
