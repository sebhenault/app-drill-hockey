import { chromium } from './_pw.mjs';
const SHOT = process.env.SHOT_DIR || './tests/captures';
await (await import('node:fs')).promises.mkdir(SHOT, { recursive: true });
const b=await chromium.launch(); const ok=[],errs=[];
const check=(n,c)=>ok.push((c?'PASS':'ÉCHEC')+' — '+n);
const url='file://' + process.cwd() + '/dist/drillbuilder-hockey.html';

for (const scheme of ['dark','light']) {
  const ctx=await b.newContext({viewport:{width:1280,height:800},colorScheme:scheme});
  const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push('PAGEERROR: '+e.message));
  await p.goto(url,{waitUntil:'networkidle'}); await p.waitForTimeout(900);
  const c=await p.evaluate(()=>{
    const cs=getComputedStyle(document.body);
    return {bg:cs.backgroundColor, fg:cs.color, attr:document.documentElement.dataset.theme||'(aucun)'};
  });
  const lum=(s)=>{const m=s.match(/\d+/g).map(Number);return (0.2126*m[0]+0.7152*m[1]+0.0722*m[2])/255;};
  check(`thème ${scheme} : fond ${c.bg} texte ${c.fg} attribut=${c.attr}`,
    scheme==='light' ? lum(c.bg)>0.7 && lum(c.fg)<0.3 : lum(c.bg)<0.25 && lum(c.fg)>0.7);
  await p.evaluate(()=>{location.hash='#/bibliotheque';}); await p.waitForTimeout(700);
  await p.screenshot({path:`${SHOT}/21-artifact-${scheme}.png`});
  await ctx.close();
}
// stamp explicite du host
const ctx=await b.newContext({viewport:{width:1280,height:800},colorScheme:'dark'});
const p=await ctx.newPage();
await p.goto(url,{waitUntil:'networkidle'});
await p.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));
await p.waitForTimeout(300);
const lum2=await p.evaluate(()=>{const m=getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);return (0.2126*m[0]+0.7152*m[1]+0.0722*m[2])/255;});
check('stamp data-theme="light" du lecteur respecté', lum2>0.7);
await ctx.close();
console.log(ok.join('\n'));
console.log('--- erreurs:', errs.length?errs.join('\n'):'aucune');
await b.close();
