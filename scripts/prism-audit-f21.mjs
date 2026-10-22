import {mkdir,writeFile,readdir,stat,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';
import {createHash} from 'node:crypto';
process.env.NEUROFORGE_E2E_STORAGE='memory';
process.env.NEUROFORGE_E2E_PORT='4187';
const label=process.argv[2]||'candidate';
if(!/^[a-z0-9-]+$/.test(label))throw new Error('Invalid audit label');
const root='.artifacts/f21/'+label;
await mkdir(root,{recursive:true});
const {default:setup}=await import('../tests/support/e2e-setup.mjs');
const cleanup=await setup(),browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader']});
const widths=process.argv.includes('--full')?[360,390,430,768,1024,1440,1920]:[390,768,1440];
const routes=['/','/app','/app/datasets','/app/playground','/app/studio','/app/experiments','/app/arena','/app/learn','/showcase'];
const results=[];
try{
  for(const theme of ['midnight','slate','forest','paper'])for(const width of widths){
    const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
    await context.addInitScript(theme=>{localStorage.setItem('neuroforge-theme-v1',theme);window.__prismVitals={cls:0,lcp:null};new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__prismVitals.cls+=e.value;}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(list=>{window.__prismVitals.lcp=list.getEntries().at(-1)?.startTime??null;}).observe({type:'largest-contentful-paint',buffered:true});},theme);
    const page=await context.newPage();
    for(const route of routes){
      const errors=[];const onError=e=>errors.push(e.message);page.on('pageerror',onError);
      await page.goto('http://127.0.0.1:4187'+route);await page.locator('h1,h2').first().waitFor();await page.evaluate(()=>document.fonts.ready);
      let recoveryDismissed=false;
      if(['/app/playground','/app/studio'].includes(route)){
        const recovery=page.getByRole('dialog',{name:'Recover draft',exact:true});
        if(await recovery.isVisible()){await recovery.getByRole('button',{name:'Start fresh',exact:true}).click();recoveryDismissed=true;}
        await page.locator('.prism-lab-grid').waitFor();
      }
      await page.screenshot({path:root+'/'+theme+'-'+width+'-'+(route.replaceAll('/','-')||'landing')+'.png',animations:'disabled'});
      const measured=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,...window.__prismVitals,domNodes:document.querySelectorAll('*').length,jsBytes:performance.getEntriesByType('resource').filter(r=>r.name.match(/\.js($|\?)/)).reduce((n,r)=>n+r.encodedBodySize,0),navigationMs:performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd}));
      results.push({route,theme,...measured,errors,recoveryDismissed});page.off('pageerror',onError);
    }
    await context.close();
  }
  const assets=[];const fingerprint=createHash('sha256');for(const name of (await readdir('client/dist/assets')).sort())if(/\.(js|css)$/.test(name)){const bytes=await readFile('client/dist/assets/'+name);assets.push({name,bytes:(await stat('client/dist/assets/'+name)).size});fingerprint.update(name);fingerprint.update(bytes);}
  const report={kind:'neuroforge-f21-ui-audit',label,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),buildDigest:fingerprint.digest('hex'),profile:'Local Chromium, software rendering, reduced motion, warm browser context per theme/width; no network/CPU throttling. Empty labs explicitly start fresh if an earlier audit route created a recoverable draft; recoveryDismissed records that action. Lab values are not field Core Web Vitals.',widths,results,assets,initialJsBudgetBytes:361337};
  if(label!=='baseline'){try{const before=JSON.parse(await readFile('.artifacts/f21/baseline/audit.json','utf8'));report.comparison=results.map(r=>{const old=before.results.find(b=>b.route===r.route&&b.theme===r.theme&&b.width===r.width);return {route:r.route,theme:r.theme,width:r.width,jsDelta:old?r.jsBytes-old.jsBytes:null,overflowBefore:old?old.scrollWidth>old.width:null,overflowAfter:r.scrollWidth>r.width};});}catch{report.comparisonStatus='Baseline unavailable';}}
  await writeFile(root+'/audit.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify({label,screenshots:results.length,overflow:results.filter(r=>r.scrollWidth>r.width).length,errors:results.filter(r=>r.errors.length).length,report:root+'/audit.json'}));
  if(results.some(r=>r.scrollWidth>r.width||r.errors.length))process.exitCode=1;
  if(label!=='baseline'&&assets.some(a=>/^index-.*\.js$/.test(a.name)&&a.bytes>report.initialJsBudgetBytes))throw new Error('F21 initial JavaScript exceeds the measured growth budget.');
}finally{await browser.close();await cleanup();}
