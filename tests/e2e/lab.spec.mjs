import { test as base, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const test = base.extend({
  page: async ({ page }, use, info) => {
    const errors=[];
    page.on('pageerror',error => errors.push(error.message));
    await use(page);
    if (!page.isClosed()) {
      const path=info.outputPath('reference-view.png');
      await page.screenshot({path,fullPage:true});
      await info.attach('reference-view',{path,contentType:'image/png'});
    }
    expect(errors,'No uncaught application errors').toEqual([]);
  },
});

async function calculate(page) {
  await page.getByRole('button',{name:'Recalculate Model Boundary',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeEnabled();
}
async function save(page) {
  const response=page.waitForResponse(r=>r.url().includes('/api/experiments') && r.request().method()==='POST');
  await page.getByRole('button',{name:'Save Run',exact:true}).click();
  const res=await response;
  expect(res.status()).toBe(201);
  return (await res.json()).data;
}

test('guest can enter the lab and use keyboard commands',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('link',{name:/Launch Interactive Lab/i}).first()).toBeVisible();
  await page.getByRole('link',{name:/Launch Interactive Lab/i}).first().click();
  await expect(page.getByRole('heading',{name:'Mission Control',exact:true})).toBeVisible();
  await page.keyboard.press('Control+k');
  const dialog=page.getByRole('dialog',{name:'Quick commands'});
  await expect(dialog).toBeVisible();
  await page.getByRole('textbox',{name:'Search commands'}).fill('K-Means');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app\/playground/);
  await expect(page.getByRole('button',{name:'Gaussian Blobs',exact:true})).toBeVisible();
  await calculate(page);
});

test('computed regression saves, survives reload, opens by share ID, exports and forks',async({page,context})=>{
  await page.goto('/app/playground');
  await page.getByRole('button',{name:'Linear Trend',exact:true}).click();
  await calculate(page);
  const saved=await save(page);
  expect(saved.algorithm).toBe('Linear Regression');
  expect(saved.metrics.mse).toBeGreaterThanOrEqual(0);
  expect(saved.dataset.points.length).toBe(120);
  expect(saved.domain.datasetVersion.contentDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(saved.domain.run.state).toBe('completed');
  expect(saved.domain.evaluationProtocol.membership.validation.length).toBeGreaterThan(0);
  await page.waitForTimeout(900);
  await page.reload();
  await page.getByRole('button',{name:'Restore draft',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeDisabled();
  await page.goto(`/report/${saved.shareId}`);
  await expect(page.getByRole('heading',{name:saved.name,exact:true})).toBeVisible();
  const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export Report',exact:true}).click();
  expect((await downloaded).suggestedFilename()).toContain('_report.json');
  const token=await page.evaluate(()=>localStorage.getItem('neuroforge_owner_token'));
  const shareResponse=await page.request.post('/api/v2/shares',{headers:{'X-Owner-Token':token},data:{resourceType:'run',resourceId:saved._id,expiresInHours:24}});
  expect(shareResponse.status()).toBe(201);
  const shared=(await shareResponse.json()).data;
  // Only the explicit scoped report may resolve without the owner's cache.
  const guest=await context.browser().newContext();
  try {
    const report=await guest.newPage(); await report.goto(`${new URL(page.url()).origin}/report/${shared.shareId}`);
    await expect(report.getByRole('heading',{name:saved.name,exact:true})).toBeVisible();
  } finally { await guest.close(); }
  await page.getByRole('button',{name:'Open & Improve',exact:true}).click();
  await expect(page).toHaveURL(/\/app\/playground/);
  await calculate(page);
  const fork=await save(page);
  expect(fork.dataset.fingerprint).toBe(saved.dataset.fingerprint);
  expect(fork.metrics.mse).toBe(saved.metrics.mse);
  expect(fork.domain.run.parentRunId).toBe(saved.domain.run.id);
  expect(fork.domain.datasetVersion.contentDigest).toBe(saved.domain.datasetVersion.contentDigest);
});

test('drawing and undo invalidate results; K-means converges without a rerender loop',async({page})=>{
  await page.goto('/app/playground'); await calculate(page);
  await page.getByRole('button',{name:'Draw New Points',exact:true}).click();
  await page.getByRole('img',{name:'Interactive dataset canvas'}).click({position:{x:100,y:100}});
  await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Undo data edit',exact:true}).click();
  await calculate(page);
  await page.getByRole('button',{name:'Gaussian Blobs',exact:true}).click();
  await calculate(page);
  const first=await save(page);
  expect(first.task).toBe('clustering'); expect(first.metrics.inertia).toBeGreaterThanOrEqual(0);
  await expect(page.getByRole('button',{name:'Step Iteration',exact:true})).toBeEnabled();
  // A stable input canvas is usable after the solver completes.
  await page.getByRole('button',{name:'Step Iteration',exact:true}).click();
  await expect(page.getByRole('button',{name:'Converge',exact:true})).toBeEnabled();
});

test('Studio trains, keeps learned state while probing, inspects a checkpoint and stops safely',async({page},info)=>{
  const started=Date.now();
  await page.goto('/app/studio');
  await page.getByRole('spinbutton',{name:'Epochs',exact:true}).fill('10');
  const modelReady=Date.now();
  await page.getByRole('button',{name:'Train Model (TensorFlow.js)',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeEnabled({timeout:45000});
  const trained=Date.now();
  const checkpoint=page.getByRole('combobox',{name:'Recorded checkpoint'});
  await expect(checkpoint).toHaveValue('10');
  const surface=page.getByRole('img',{name:'Model decision surface',exact:true});
  const cells=await surface.locator(':scope > div').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().toJSON()));
  expect(cells.length).toBe(400);
  expect(cells[1].x).toBeGreaterThan(cells[0].x);
  expect(cells[20].y).toBeGreaterThan(cells[0].y);
  const chart=page.getByRole('region',{name:'Binary Cross-Entropy Loss chart',exact:true});
  await chart.getByRole('button',{name:'Toggle accessible table view',exact:true}).click();
  await expect(chart.getByRole('row')).toHaveCount(11);
  await expect(chart.getByRole('row').last()).toContainText('10');
  const probe=page.getByRole('slider',{name:'Probe x1'});
  await probe.fill('-0.8');
  await expect(checkpoint).toHaveValue('10');
  await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeEnabled();
  await checkpoint.selectOption('1');
  const saved=await save(page);
  expect(saved.metricHistory.length).toBe(10);
  expect(saved.hyperparameters.layers.map(l=>l.units)).toEqual([2,4,1]);
  await page.getByRole('spinbutton',{name:'Epochs',exact:true}).fill('500');
  await page.getByRole('button',{name:'Train Model (TensorFlow.js)',exact:true}).click();
  const stop=page.getByRole('button',{name:'Stop Training',exact:true});
  await expect(stop).toBeVisible();
  const stopRequested=Date.now();
  await stop.click();
  await expect(page.getByRole('button',{name:'Train Model (TensorFlow.js)',exact:true})).toBeVisible({timeout:20000});
  await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeDisabled();
  const path=info.outputPath('training-baseline.json');
  await writeFile(path,JSON.stringify({browser:page.context().browser().version(),node:process.version,platform:process.platform,
    viewport:page.viewportSize(),backend:saved.runtime.backend,modelReadyMs:modelReady-started,tenEpochsMs:trained-modelReady,stopMs:Date.now()-stopRequested},null,2));
  await info.attach('training-baseline',{path,contentType:'application/json'});
});

test('compatible real runs compare and edited evaluation splits are rejected',async({page})=>{
  await page.goto('/app/playground'); await calculate(page); const a=await save(page);
  await calculate(page); const b=await save(page);
  await page.goto('/app/arena');
  await page.getByRole('combobox',{name:'Baseline',exact:true}).selectOption(a._id);
  await page.getByRole('combobox',{name:'Variant',exact:true}).selectOption(b._id);
  await expect(page.getByRole('status').filter({hasText:'Matched task'})).toBeVisible();
  await expect(page.getByRole('img',{name:/Recorded loss curves/})).toBeVisible();
  await page.getByRole('button',{name:'Duplicate & Improve',exact:true}).last().click();
  await calculate(page);
  await page.getByRole('slider',{name:'Train ratio'}).fill('70');
  await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeDisabled();
  await calculate(page); const changed=await save(page);
  await page.goto('/app/arena');
  await page.getByRole('combobox',{name:'Baseline',exact:true}).selectOption(a._id);
  await page.getByRole('combobox',{name:'Variant',exact:true}).selectOption(changed._id);
  await expect(page.getByRole('status').filter({hasText:'Direct comparison unavailable'})).toBeVisible();
  await expect(page.getByRole('img',{name:/Recorded loss curves/})).toHaveCount(0);
});

test('offline saves stay local and a failed storage write is not reported as success',async({page})=>{
  await page.goto('/app/playground'); await calculate(page);
  await page.route('**/api/experiments**',route=>route.abort());
  await page.getByRole('button',{name:'Save Run',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'in this browser'})).toBeVisible();
  await page.getByRole('button',{name:'Share',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'stored on this browser only'})).toBeVisible();
  await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Storage full','QuotaExceededError');};});
  await page.getByRole('button',{name:'Save Run',exact:true}).click();
  await expect(page.getByRole('alert').filter({hasText:'Storage full'})).toBeVisible();
});

test('workspace fits the viewport and captures measured load baseline',async({page},info)=>{
  const start=Date.now(); await page.goto('/app/playground');
  const canvas=page.getByRole('img',{name:'Interactive dataset canvas'});
  await expect(canvas).toBeVisible();
  await expect(page.getByRole('status').filter({hasText:'No current measurements'})).toBeVisible();
  const metrics=await page.evaluate(()=>({
    viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,
    navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),
    scripts:performance.getEntriesByType('resource').filter(r=>r.initiatorType==='script').map(r=>({name:new URL(r.name).pathname,bytes:r.transferSize})),
  }));
  metrics.readyMs=Date.now()-start;
  expect(metrics.documentWidth).toBeLessThanOrEqual(metrics.viewport+1);
  const bounds=await canvas.boundingBox(); expect(bounds.width).toBeGreaterThan(200);
  const path=info.outputPath('performance-baseline.json');
  await writeFile(path,JSON.stringify(metrics,null,2));
  await info.attach('performance-baseline',{path,contentType:'application/json'});
});
