import { test, expect } from '@playwright/test';

test('CSV preparation preserves held-out membership and full draft recovery',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/app/datasets');
  const csv='x,y,label\n'+Array.from({length:24},(_,i)=>`${i-12},${i%4-2},${i%2}`).join('\n');
  await page.getByLabel('CSV file',{exact:true}).setInputFiles({name:'binary.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
  await page.getByRole('button',{name:'Prepare for Playground',exact:true}).click();
  await expect(page).toHaveURL(/\/app\/playground/);
  await page.getByRole('button',{name:'Recalculate Model Boundary',exact:true}).click();
  await expect(page.getByText('Error Explorer',{exact:true})).toBeVisible();
  await expect(page.getByText('Saved on device',{exact:true})).toBeVisible();
  const response=page.waitForResponse(r=>r.url().endsWith('/api/experiments')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save Run',exact:true}).click();
  const saved=(await (await response).json()).data;
  expect(saved.dataset.preparation.originalPoints).toHaveLength(24);
  expect(saved.domain.evaluationProtocol.membership.test.length).toBeGreaterThan(0);
  expect(saved.domain.datasetVersion.preprocessing.fittedPipeline).toBeTruthy();
  await page.reload();await page.getByRole('button',{name:'Restore draft',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Recalculate Model Boundary',exact:true}).click();
  await expect(page.getByRole('button',{name:'Evaluate held-out test',exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test('browser account can own runs, link projects, share and revoke',async({page,context})=>{
  await page.goto('/app/account');
  await page.getByLabel('Account action',{exact:true}).selectOption('register');
  await page.getByLabel('Your name',{exact:true}).fill('Browser Reviewer');
  const email='browser-'+crypto.randomUUID()+'@example.test';
  await page.getByLabel('Email',{exact:true}).fill(email);
  await page.getByLabel('Password',{exact:true}).fill('browser-test-password');
  const registration=page.waitForResponse(response=>response.url().endsWith('/api/v2/auth/register'));
  await page.getByRole('button',{name:'Create account',exact:true}).click();
  const registered=await (await registration).json();
  if(registered.verificationRequired){
    const messages=await (await page.request.get('/api/__test/email?email='+encodeURIComponent(email))).json();
    const link=new URL(messages.data.at(-1).url);
    await page.goto('/app/account'+link.search);
    await page.getByRole('button',{name:'Confirm email verification',exact:true}).click();
    await page.getByLabel('Email',{exact:true}).fill(email);
    await page.getByLabel('Password',{exact:true}).fill('browser-test-password');
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
  }
  await expect(page.getByText('Signed in as '+email,{exact:true})).toBeVisible();
  await page.getByRole('link',{name:/ML Playground/}).click();
  await page.getByRole('button',{name:'Recalculate Model Boundary',exact:true}).click();
  const response=page.waitForResponse(r=>r.url().endsWith('/api/experiments')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save Run',exact:true}).click();const saved=(await(await response).json()).data;
  await page.getByRole('link',{name:'Account & Projects',exact:true}).click();
  await page.getByLabel('Project name',{exact:true}).fill('Browser investigation');
  await page.getByRole('button',{name:'Create private project',exact:true}).click();
  await page.getByLabel('Selected project',{exact:true}).selectOption({label:'Browser investigation'});
  await page.getByRole('button',{name:'Link to project',exact:true}).click();
  await expect(page.getByText('1 linked runs · Private',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Create 7-day report link',exact:true}).click();
  const link=page.getByRole('link',{name:'Open shared report',exact:true});const url=await link.getAttribute('href');
  const guest=await context.browser().newContext();
  try{const report=await guest.newPage();await report.goto(new URL(url,page.url()).href);await expect(report.getByRole('heading',{name:saved.name,exact:true})).toBeVisible();await page.getByRole('button',{name:'Revoke link',exact:true}).click();await report.reload();await expect(report.getByRole('heading',{name:saved.name,exact:true})).toHaveCount(0);}finally{await guest.close();}
});

test('failed IndexedDB autosave is visible and never shows a saved acknowledgement',async({page})=>{
  await page.addInitScript(()=>{IDBFactory.prototype.open=function(){throw new DOMException('Blocked test storage','QuotaExceededError');};});
  await page.goto('/app/playground');
  await expect(page.getByRole('alert').filter({hasText:'Draft not saved'})).toBeVisible();
  await expect(page.getByText('Saved on device',{exact:true})).toHaveCount(0);
});

test('saved Studio weights reopen and real seeded sweeps execute and persist',async({page})=>{
  await page.goto('/app/studio');
  await page.getByLabel('Epochs',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Train Model (TensorFlow.js)',exact:true}).click();
  await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeEnabled({timeout:45000});
  const response=page.waitForResponse(r=>r.url().endsWith('/api/experiments')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save Run',exact:true}).click();
  const saved=(await(await response).json()).data;
  expect(saved.modelArtifact.digest).toMatch(/^[a-f0-9]{64}$/);
  expect(saved.domain.artifacts[0].contentDigest).toBe(saved.modelArtifact.digest);
  await page.goto('/app/experiments/'+saved._id);
  await page.getByRole('button',{name:'Open & Improve',exact:true}).click();
  await expect(page.getByText('Neural Studio Diagnostics',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Save Run',exact:true})).toBeDisabled();
  await page.getByRole('link',{name:/Experiment Arena/}).click();
  await page.getByLabel('Baseline',{exact:true}).selectOption(saved._id);
  await page.getByLabel('Sweep learning rates',{exact:true}).fill('0.01');
  await page.getByLabel('Sweep batch sizes',{exact:true}).fill('16');
  await page.getByLabel('Sweep seeds',{exact:true}).fill('7,13');
  await page.getByRole('button',{name:'Run Sweep (2 Jobs)',exact:true}).click();
  await expect(page.getByText('Sweep: completed - 2/2 completed',{exact:true})).toBeVisible({timeout:45000});
  const owner=await page.evaluate(()=>localStorage.getItem('neuroforge_owner_token'));
  const runs=(await(await page.request.get('/api/experiments',{headers:{'X-Owner-Token':owner}})).json()).data;
  const trials=runs.filter(run=>run.name.startsWith('Sweep '));
  expect(trials).toHaveLength(2);
  expect(trials.map(run=>run.domain.run.seeds.model).sort((a,b)=>a-b)).toEqual([7,13]);
  expect(trials.every(run=>run.metricHistory.length===2&&run.modelArtifact)).toBeTruthy();
});

test('two browser tabs preserve both drafts when resolving a revision conflict',async({page,context})=>{
  await page.goto('/app/playground');
  await expect(page.getByText('Saved on device',{exact:true})).toBeVisible();
  const second=await context.newPage();
  try {
    await second.goto('/app/playground');await second.getByRole('button',{name:'Restore draft',exact:true}).click();
    await expect(second.getByText('Saved on device',{exact:true})).toBeVisible();
    await second.getByRole('slider',{name:'Train ratio',exact:true}).fill('70');
    await expect(page.getByRole('dialog',{name:'Cross-Tab Revision Conflict',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Save as Copy',exact:true}).click();
    await expect(page.getByRole('dialog',{name:'Cross-Tab Revision Conflict',exact:true})).toHaveCount(0);
    await expect(page.getByRole('slider',{name:'Train ratio',exact:true})).toHaveValue('80');
    await expect(second.getByRole('slider',{name:'Train ratio',exact:true})).toHaveValue('70');
  } finally { await second.close(); }
});
