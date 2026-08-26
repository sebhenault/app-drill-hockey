import { chromium, devices } from './_pw.mjs';
const SHOT = process.env.SHOT_DIR || './tests/captures';
await (await import('node:fs')).promises.mkdir(SHOT, { recursive: true });
const b = await chromium.launch();
const ok=[], errs=[];
const check=(n,c)=>ok.push((c?'PASS':'ÉCHEC')+' — '+n);

async function run(label, opts, shots){
  const ctx = await b.newContext(opts);
  const p = await ctx.newPage();
  p.on('pageerror', e => errs.push(label+' PAGEERROR: '+e.message));
  p.on('console', m => { if(m.type()==='error') errs.push(label+' CONSOLE: '+m.text()); });

  await p.goto('http://127.0.0.1:8099/index.html',{waitUntil:'networkidle'});
  await p.waitForTimeout(600);
  const hs = await p.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(label+' : pas de défilement horizontal (accueil)', hs);
  await p.screenshot({path:SHOT+'/'+shots+'-home.png'});

  await p.goto('http://127.0.0.1:8099/index.html#/bibliotheque',{waitUntil:'networkidle'});
  await p.waitForTimeout(500);
  check(label+' : pas de défilement horizontal (bibliothèque)',
    await p.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth + 1));
  await p.screenshot({path:SHOT+'/'+shots+'-library.png'});

  await p.goto('http://127.0.0.1:8099/index.html#/editeur',{waitUntil:'networkidle'});
  await p.waitForTimeout(600);
  const w = opts.viewport.width;
  if (w <= 860) {
    check(label+' : barre d’outils mobile visible', await p.locator('.ed-mobile-bar').isVisible());
    check(label+' : panneau latéral masqué', !(await p.locator('.ed-tools').isVisible()));
    // tiroir coulissant
    await p.locator('.ed-mobile-bar .tool').nth(1).click(); await p.waitForTimeout(400);
    check(label+' : tiroir d’outils s’ouvre', await p.locator('.drawer.open').count()===1);
    const tapOk = await p.evaluate(()=>{
      const bs=[...document.querySelectorAll('.drawer .tool')];
      return bs.length>0 && bs.every(x=>{const r=x.getBoundingClientRect(); return r.width>=44 && r.height>=44;});
    });
    check(label+' : zones tactiles ≥ 44 px dans le tiroir', tapOk);
    await p.screenshot({path:SHOT+'/'+shots+'-editor-drawer.png'});
    await p.locator('.drawer .tool').first().click(); await p.waitForTimeout(350);
    // pose d'un joueur au doigt
    const box = await p.locator('#rinkSvg').boundingBox();
    await p.touchscreen.tap(box.x+box.width*0.4, box.y+box.height*0.5).catch(async ()=>{
      await p.mouse.click(box.x+box.width*0.4, box.y+box.height*0.5);
    });
    await p.waitForTimeout(300);
    check(label+' : élément posé au toucher',
      await p.evaluate(()=>document.querySelectorAll('#rinkSvg g[data-id]').length)>=1);
    await p.screenshot({path:SHOT+'/'+shots+'-editor.png'});
  } else {
    check(label+' : panneaux outils + propriétés visibles',
      await p.locator('.ed-tools').isVisible() && await p.locator('.ed-props').isVisible());
    await p.screenshot({path:SHOT+'/'+shots+'-editor.png'});
  }
  check(label+' : pas de défilement horizontal (éditeur)',
    await p.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth + 1));
  await ctx.close();
}

await run('390 px (iPhone)', { ...devices['iPhone 13'], viewport:{width:390,height:844} }, '10-390');
await run('768 px (iPad)', { viewport:{width:768,height:1024}, hasTouch:true, isMobile:true }, '11-768');
await run('1440 px (bureau)', { viewport:{width:1440,height:900} }, '12-1440');

console.log(ok.join('\n'));
console.log('--- erreurs JS:', errs.length ? errs.join('\n') : 'aucune');
await b.close();
