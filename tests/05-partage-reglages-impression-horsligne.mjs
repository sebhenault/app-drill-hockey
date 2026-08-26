import { chromium } from './_pw.mjs';
const SHOT = process.env.SHOT_DIR || './tests/captures';
await (await import('node:fs')).promises.mkdir(SHOT, { recursive: true });
const b = await chromium.launch(); const ok=[], errs=[];
const check=(n,c)=>ok.push((c?'PASS':'ÉCHEC')+' — '+n);
const ctx = await b.newContext({viewport:{width:1280,height:860}});
const p = await ctx.newPage();
p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });

// --- Guide des symboles
await p.goto('http://127.0.0.1:8099/index.html#/symboles',{waitUntil:'networkidle'});
await p.waitForTimeout(500);
const symCards = await p.locator('.card h3').count();
check('guide des symboles complet ('+symCards+' entrées)', symCards >= 30);
const emptyIcons = await p.evaluate(()=>[...document.querySelectorAll('.grid-cards .card > div > svg')].filter(s=>s.innerHTML.trim()==='').length);
check('aucune icône vide', emptyIcons===0);
await p.screenshot({path:SHOT+'/16-symbols.png'});

// --- Lien de partage : aller-retour
await p.goto('http://127.0.0.1:8099/index.html#/bibliotheque',{waitUntil:'networkidle'});
await p.waitForTimeout(400);
const shareUrl = await p.evaluate(async ()=>{
  const { shareLink } = await import('./js/exporter.js');
  const { seedDrills } = await import('./js/seed.js');
  return shareLink(seedDrills()[3]);
});
check('lien de partage généré ('+shareUrl.length+' caractères)', shareUrl.includes('#/partage/'));
await p.goto(shareUrl,{waitUntil:'networkidle'}); await p.waitForTimeout(700);
check('exercice reçu et décodé', (await p.locator('h1').first().textContent())==='Exercice reçu');
const shownTitle = await p.locator('.card h2').first().textContent();
check('titre correct après décodage ('+shownTitle+')', shownTitle.includes('Slalom'));
check('diagramme reconstruit', await p.locator('.card svg').count()>0);
await p.locator('.btn-primary', {hasText:'Enregistrer'}).click(); await p.waitForTimeout(600);
check('exercice partagé enregistré', (await p.locator('h1').first().textContent()).includes('Slalom'));

// --- Réglages : export / import / thème
await p.goto('http://127.0.0.1:8099/index.html#/parametres',{waitUntil:'networkidle'});
await p.waitForTimeout(500);
const dl = p.waitForEvent('download');
await p.locator('.btn', {hasText:'Exporter tout'}).click();
const d = await dl; const fs = await import('fs');
const j = JSON.parse(fs.readFileSync(await d.path(),'utf8'));
check('export global JSON ('+j.drills.length+' exercice(s))', j.app==='drillbuilder-hockey' && j.drills.length===1);

await p.locator('select').nth(1).selectOption('light'); await p.waitForTimeout(400);
check('thème clair appliqué', await p.evaluate(()=>document.documentElement.dataset.theme==='light'));
await p.screenshot({path:SHOT+'/17-settings-light.png'});
await p.locator('select').nth(1).selectOption('dark'); await p.waitForTimeout(300);

// import du fichier exporté
await p.locator('input[type=file]').setInputFiles(await d.path()); await p.waitForTimeout(900);
check('import JSON accepté', (await p.locator('.toast').last().textContent()||'').includes('importé'));

// --- Impression
await p.goto('http://127.0.0.1:8099/index.html#/bibliotheque',{waitUntil:'networkidle'});
await p.waitForTimeout(400);
await p.locator('.drill-card .drill-body').first().click(); await p.waitForTimeout(400);
await p.locator('.btn', {hasText:'Exporter'}).first().click(); await p.waitForTimeout(300);
await p.evaluate(()=>{ window.print = ()=>{ window.__printed = true; }; });
await p.locator('.modal .btn', {hasText:'Imprimer'}).click(); await p.waitForTimeout(700);
const printed = await p.evaluate(()=>({ p: !!window.__printed, len: document.getElementById('printArea').innerHTML.length,
  svg: document.querySelectorAll('#printArea svg').length }));
check('vue d’impression composée ('+printed.len+' caractères, '+printed.svg+' diagrammes)', printed.p && printed.len>2000 && printed.svg>=1);
await p.emulateMedia({media:'print'});
await p.screenshot({path:SHOT+'/18-print.png', fullPage:false});
await p.emulateMedia({media:'screen'});

// --- Navigation au clavier
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'}); await p.waitForTimeout(400);
let focusables=0;
for(let i=0;i<12;i++){ await p.keyboard.press('Tab');
  const t2 = await p.evaluate(()=>document.activeElement.tagName+':'+(document.activeElement.textContent||'').slice(0,18));
  if(t2 && !t2.startsWith('BODY')) focusables++;
}
check('navigation au clavier atteint '+focusables+' éléments', focusables>=10);

// --- Service worker
await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'}); await p.waitForTimeout(1800);
const sw = await p.evaluate(async ()=>{ const r = await navigator.serviceWorker.getRegistrations(); return r.length; });
check('service worker enregistré', sw>=1);
const cached = await p.evaluate(async ()=>{ const ks = await caches.keys();
  if(!ks.length) return 0; const c = await caches.open(ks[0]); return (await c.keys()).length; });
check('coquille mise en cache ('+cached+' ressources)', cached>=10);
// hors ligne
await ctx.setOffline(true);
await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(1500);
const offlineOk = await p.locator('.drill-card, .hero h1').count();
check('application démarre hors ligne', offlineOk>0);
await ctx.setOffline(false);

console.log(ok.join('\n'));
console.log('--- erreurs JS:', errs.length ? errs.join('\n') : 'aucune');
await b.close();
