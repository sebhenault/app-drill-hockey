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

// --- Texte plus grand sur téléphone
await p.goto(BASE+'#/bibliotheque',{waitUntil:'networkidle'}); await p.waitForTimeout(500);
const fs = await p.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize));
check('police de base agrandie ('+fs+' px)', fs>=17);
const inpFs = await p.evaluate(()=>{ const i=document.querySelector('input'); return i?parseFloat(getComputedStyle(i).fontSize):16; });
check('champs ≥ 16 px (pas de zoom iOS) ('+inpFs+' px)', inpFs>=16);

// --- Éditeur : glace verticale en portrait
await p.goto(BASE+'#/editeur',{waitUntil:'networkidle'}); await p.waitForTimeout(800);
check('glace pivotée en portrait', await p.locator('.editor.is-turned').count()===1);
const box = await p.locator('.ed-stage svg').boundingBox();
check('glace plus haute que large ('+Math.round(box.width)+'×'+Math.round(box.height)+')', box.height > box.width*1.8);
check('en-tête de l’app masqué', !(await p.locator('.topbar').isVisible()));
check('invitation à tourner masquée', !(await p.locator('.rotate-hint').isVisible()));
check('aucun défilement horizontal', await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));

// Un joueur posé au doigt apparaît sous le doigt.
await p.locator('.ed-mobile-bar .tool', {hasText:'Joueurs'}).click(); await p.waitForTimeout(300);
await p.locator('.drawer.open .tool-grid button').first().click(); await p.waitForTimeout(300);
const tap = { x: box.x + box.width*0.30, y: box.y + box.height*0.22 };
await p.mouse.click(tap.x, tap.y); await p.waitForTimeout(300);
const placed = await p.evaluate(()=>{
  const g=[...document.querySelectorAll('.ed-stage svg g[data-id]')].pop(); if(!g) return null;
  const r=g.getBoundingClientRect(); return { x:r.x+r.width/2, y:r.y+r.height/2 };
});
const dist = placed ? Math.hypot(placed.x-tap.x, placed.y-tap.y) : 999;
check('joueur placé sous le doigt (écart '+Math.round(dist)+' px)', dist < 12);
const upright = await p.evaluate(()=>{
  const g=[...document.querySelectorAll('.ed-stage svg g[data-id]')].pop();
  const t=g && g.querySelector('text'); if(!t) return true;
  const m=t.getScreenCTM(); return Math.abs(m.b) < 1e-6 && m.a > 0;
});
check('étiquette du joueur à l’endroit', upright);
await p.screenshot({path:SHOT+'/40-portrait-editeur.png'});

// --- Paysage : glace à plat
const l = await b.newContext({...devices['iPhone 13 landscape']});
const q = await l.newPage();
q.on('pageerror', e=>errs.push('PAGEERROR: '+e.message));
await q.goto(BASE+'#/editeur',{waitUntil:'networkidle'}); await q.waitForTimeout(800);
check('glace à plat en paysage', await q.locator('.editor.is-turned').count()===0);
check('ligne du temps visible en paysage', await q.locator('.timeline').isVisible());
await q.screenshot({path:SHOT+'/41-paysage-editeur.png'});

// --- Ordinateur : rien ne change
const d = await b.newContext({viewport:{width:1280,height:860}});
const r = await d.newPage();
await r.goto(BASE+'#/editeur',{waitUntil:'networkidle'}); await r.waitForTimeout(600);
check('ordinateur : glace à plat', await r.locator('.editor.is-turned').count()===0);
check('ordinateur : police inchangée', await r.evaluate(()=>parseFloat(getComputedStyle(document.documentElement).fontSize))===16);

console.log(ok.join('\n'));
console.log(errs.length ? 'ERREURS:\n'+errs.join('\n') : 'Aucune erreur JavaScript.');
await b.close();
process.exit(ok.some(x=>x.startsWith('ÉCHEC'))||errs.length?1:0);
