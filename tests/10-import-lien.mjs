import { chromium, devices } from './_pw.mjs';
const SHOT = process.env.SHOT_DIR || './tests/captures';
await (await import('node:fs')).promises.mkdir(SHOT, { recursive: true });
const b = await chromium.launch(); const ok=[], errs=[];
const check=(n,c)=>ok.push((c?'PASS':'ÉCHEC')+' — '+n);
const BASE='http://127.0.0.1:8099/index.html';
const c = await b.newContext({...devices['iPhone 13']});
const p = await c.newPage();
p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });

await p.goto(BASE+'#/bibliotheque',{waitUntil:'networkidle'}); await p.waitForTimeout(400);
// Lien produit ailleurs (autre adresse) : seul le fragment compte.
const link = await p.evaluate(async ()=>{
  const { shareLink } = await import('./js/exporter.js');
  const { seedDrills } = await import('./js/seed.js');
  const url = await shareLink(seedDrills()[3]);
  return 'https://exemple.github.io/app/' + url.slice(url.indexOf('#'));
});
await p.locator('.btn', {hasText:'Coller un lien'}).click(); await p.waitForTimeout(300);
await p.locator('.modal textarea').fill('pas un lien'); await p.locator('.modal .btn-primary', {hasText:'Ouvrir'}).click();
check('texte invalide : message d’erreur', await p.locator('.modal .err-msg').isVisible());
await p.locator('.modal textarea').fill('Voici l’exercice : ' + link + ' bonne pratique');
await p.locator('.modal .btn-primary', {hasText:'Ouvrir'}).click(); await p.waitForTimeout(700);
check('lien collé ouvre l’exercice reçu', (await p.locator('h1').first().textContent())==='Exercice reçu');
const btn = p.locator('.btn-primary', {hasText:'Enregistrer'});
const fits = await btn.evaluate(e=>e.scrollWidth<=e.clientWidth+1);
check('libellé « Enregistrer sur cet appareil » tient dans le bouton', fits);
await p.screenshot({path:SHOT+'/50-import-lien.png'});
await btn.click(); await p.waitForTimeout(600);
check('exercice enregistré', (await p.locator('h1').first().textContent()).includes('Slalom'));

await p.goto(BASE+'#/parametres',{waitUntil:'networkidle'}); await p.waitForTimeout(400);
check('bouton aussi dans les paramètres', await p.locator('.btn', {hasText:'Coller un lien'}).count()===1);

console.log(ok.join('\n'));
console.log(errs.length ? 'ERREURS:\n'+errs.join('\n') : 'Aucune erreur JavaScript.');
await b.close();
process.exit(ok.some(x=>x.startsWith('ÉCHEC'))||errs.length?1:0);
