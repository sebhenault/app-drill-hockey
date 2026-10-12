import { chromium } from './_pw.mjs';
const SHOT = process.env.SHOT_DIR || './tests/captures';
await (await import('node:fs')).promises.mkdir(SHOT, { recursive: true });
const b = await chromium.launch(); const ok=[], errs=[];
const check=(n,c)=>ok.push((c?'PASS':'ÉCHEC')+' — '+n);
const BASE='http://127.0.0.1:8099/index.html';

// --- Liens générés depuis un plan (2 exercices, 1 vidéo YouTube, 1 lien externe)
const ctx = await b.newContext({viewport:{width:1280,height:860}});
const p = await ctx.newPage();
p.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE: '+m.text()); });
await p.goto(BASE+'#/plans',{waitUntil:'networkidle'}); await p.waitForTimeout(400);
const links = await p.evaluate(async ()=>{
  const { seedDrills } = await import('./js/seed.js');
  const { practiceCoachLink, drillCoachLink } = await import('./js/coach.js');
  const s = seedDrills();
  const a = { ...s[3], videos:[{ id:'v1', url:'https://www.youtube.com/watch?v=dQw4w9WgXcQ', provider:'youtube', title:'Démo' }] };
  const c = { ...s[5], videos:[{ id:'v2', url:'https://example.org/video/123', provider:'externe', title:'Vidéo source' }] };
  const byId = (id)=>[a,c].find(d=>d.id===id)||null;
  const plan = { id:'p1', title:'Pratique test', ageGroup:'u11', date:'2026-10-14', plannedDuration:60,
    equipment:['cônes'], coachNotes:'Arriver 15 min avant.',
    items:[ {id:'i0',type:'warmup',title:'Échauffement',duration:8},
            {id:'i1',type:'drill',drillId:a.id,title:a.title,duration:12},
            {id:'i2',type:'drill',drillId:c.id,title:c.title,duration:10} ] };
  return { plan: await practiceCoachLink(plan, byId), one: await drillCoachLink(a, 12), title:a.title, tp:a.teachingPoints.length };
});
check('lien de pratique généré ('+links.plan.length+' caractères)', links.plan.includes('#/coachs/'));
check('lien d’exercice généré ('+links.one.length+' caractères)', links.one.includes('#/coachs/'));
await p.close();

// --- Ouverture sur téléphone
const m = await b.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
const q = await m.newPage();
q.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
q.on('console', x=>{ if(x.type()==='error') errs.push('CONSOLE: '+x.text()); });
await q.goto(links.plan,{waitUntil:'networkidle'}); await q.waitForTimeout(700);
check('titre de la pratique', (await q.locator('.coach h1').textContent())==='Pratique test');
check('2 exercices affichés', await q.locator('.coach-ex').count()===2);
check('déroulement avec 3 blocs', await q.locator('.coach-order li').count()===3);
check('diagramme présent', await q.locator('.coach-ex .detail-diagram svg').count()>=2);
check('vidéo YouTube intégrée', await q.locator('.coach-ex iframe[src*="youtube-nocookie.com/embed/dQw4w9WgXcQ"]').count()===1);
check('lien vers vidéo externe', await q.locator('.coach-ex a[href="https://example.org/video/123"]').count()===1);
check('points clés affichés', await q.locator('#coach-ex-1 .coach-points li').count()===links.tp);
check('notes du plan affichées', (await q.locator('.coach-notes').textContent()).includes('15 min'));
check('navigation de l’app masquée', !(await q.locator('.tabbar').isVisible()));
check('aucun défilement horizontal', await q.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
await q.screenshot({path:SHOT+'/30-coachs-pratique.png', fullPage:true});

await q.evaluate(()=>{ window.__copied=''; navigator.clipboard.writeText = async (s)=>{ window.__copied=s; }; });
await q.locator('#coach-ex-2 .btn', {hasText:'Partager cet exercice seul'}).click(); await q.waitForTimeout(400);
const single = await q.evaluate(()=>window.__copied);
check('lien d’un exercice copié depuis la pratique', single.includes('#/coachs/'));

await q.goto(links.one,{waitUntil:'networkidle'}); await q.waitForTimeout(600);
check('exercice seul : une section', await q.locator('.coach-ex').count()===1);
check('exercice seul : bon titre', (await q.locator('.coach-ex h2').textContent())===links.title);
await q.screenshot({path:SHOT+'/31-coachs-exercice.png', fullPage:true});

await q.goto(BASE+'#/coachs/zTRONQUE',{waitUntil:'networkidle'}); await q.waitForTimeout(400);
check('lien tronqué : message clair', (await q.locator('h2').first().textContent())==='Lien illisible');

await q.goto(BASE+'#/bibliotheque',{waitUntil:'networkidle'}); await q.waitForTimeout(400);
check('navigation réapparaît hors version coachs', await q.locator('.tabbar').isVisible());

// --- Bouton dans le plan de pratique
await q.goto(BASE+'#/plans',{waitUntil:'networkidle'}); await q.waitForTimeout(400);
await q.locator('.btn-primary', {hasText:'pratique'}).first().click(); await q.waitForTimeout(500);
await q.locator('.btn', {hasText:'Ajouter un exercice'}).first().click(); await q.waitForTimeout(300);
await q.locator('.modal .list-row').first().click(); await q.waitForTimeout(400);
await q.locator('.btn', {hasText:'Liens pour les coachs'}).click(); await q.waitForTimeout(300);
check('fenêtre des liens ouverte', await q.locator('.modal', {hasText:'Partager toute la pratique'}).count()===1);
check('avertissement exercice sans vidéo', await q.locator('.modal .notice-warn').count()===1);
await q.locator('.modal .btn', {hasText:'Voir l’aperçu'}).click(); await q.waitForTimeout(700);
check('aperçu ouvre la version coachs', q.url().includes('#/coachs/') && await q.locator('.coach-ex').count()===1);

console.log(ok.join('\n'));
console.log(errs.length ? 'ERREURS:\n'+errs.join('\n') : 'Aucune erreur JavaScript.');
await b.close();
process.exit(ok.some(x=>x.startsWith('ÉCHEC'))||errs.length?1:0);
