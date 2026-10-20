import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { PreprocessingPipeline } from '../client/src/ml/preprocessingPipeline.js';
import { saveDraftLocal, getDraftLocal, saveRecoverySession, enableMemoryStorageForTests } from '../client/src/services/localRepository.js';
import { DraftManager } from '../client/src/services/draftManager.js';
import { ModelRunner } from '../client/src/ml/modelRunner.js';
enableMemoryStorageForTests();

test('private runs support account ownership, real guest import, scoped sharing and revocation', async () => {
  const server = createApp({ allowMemoryFallback: true }).listen(0,'127.0.0.1');
  await new Promise(done=>server.once('listening',done));
  const base='http://127.0.0.1:'+server.address().port+'/api';
  const guest={'Content-Type':'application/json','X-Owner-Token':'isolated-guest-review-token'};
  const payload={name:'Private evidence',algorithm:'OLS',workspace:'playground',task:'regression',dataset:{name:'Samples',points:[{id:'a',x:0,y:0,label:0},{id:'b',x:1,y:1,label:0}]},metrics:{mse:0}};
  try {
    const saved=(await (await fetch(base+'/experiments',{method:'POST',headers:guest,body:JSON.stringify(payload)})).json()).data;
    assert.equal((await fetch(base+'/experiments/'+saved._id)).status,404);
    assert.equal((await fetch(base+'/experiments/'+saved.shareId)).status,404);
    const auth=await (await fetch(base+'/v2/auth/register',{method:'POST',headers:guest,body:JSON.stringify({email:'review@example.test',name:'Review',password:'test-password-123'})})).json();
    const headers={...guest,Authorization:'Bearer '+auth.token};
    assert.equal((await fetch(base+'/v2/auth/migrate-guest',{method:'POST',headers,body:JSON.stringify({guestToken:guest['X-Owner-Token']})})).status,200);
    assert.equal((await (await fetch(base+'/experiments',{headers})).json()).data.length,1);
    assert.equal((await fetch(base+'/experiments/'+saved._id,{headers:guest})).status,404);
    assert.equal((await fetch(base+'/v2/shares',{method:'POST',headers:guest,body:JSON.stringify({resourceType:'run',resourceId:saved._id})})).status,404);
    const share=(await (await fetch(base+'/v2/shares',{method:'POST',headers,body:JSON.stringify({resourceType:'run',resourceId:saved._id})})).json()).data;
    const report=(await (await fetch(base+'/v2/shares/'+share.shareId)).json()).data;
    assert.equal(report.ownerId,undefined); assert.equal(report.metrics.mse,0);
    assert.equal((await fetch(base+'/v2/shares/'+share.shareId,{method:'DELETE',headers})).status,200);
    assert.equal((await fetch(base+'/v2/shares/'+share.shareId)).status,410);
    assert.equal((await fetch(base+'/v2/runs/'+saved._id)).status,404);
    assert.equal((await fetch(base+'/v2/sync',{method:'POST',headers,body:JSON.stringify({operations:[]})})).status,503);
  } finally { await new Promise(done=>server.close(done)); }
});

test('IndexedDB failure is never acknowledged as durable saving', async () => {
  globalThis.window={indexedDB:{open(){throw new Error('QuotaExceededError');}}};
  try { await assert.rejects(saveDraftLocal({id:'quota',revision:1}),/QuotaExceeded/); }
  finally { delete globalThis.window; }
});

test('actual draft managers enforce revisions, duplicate conflicts and recover interrupted work', async () => {
  const first=new DraftManager(), second=new DraftManager();
  const id=crypto.randomUUID(); const configuration={workspace:'playground',dataset:{points:[{id:'a',x:1,y:2,label:0}]},hyperparameters:{threshold:.7}};
  first.queueAutosave({id,baseRevision:0,workspace:'playground',configuration},10000);
  second.queueAutosave({id,baseRevision:0,workspace:'playground',configuration:{...configuration,threshold:.8}},10000);
  await first.saveNow(); await assert.rejects(second.saveNow(),/REVISION_CONFLICT/);
  assert.equal(second.status,'conflict'); assert.equal((await getDraftLocal(id)).revision,1);
  const copy=await second.resolveConflict('duplicate'); assert.notEqual(copy.id,id);
  await first.setExecutionState('running');
  first.queueAutosave({id,workspace:'playground',configuration},10000);await first.saveNow();await first.setExecutionState('running');
  const recovery=await first.checkRecoveryOnStartup();assert.equal(recovery.wasInterrupted,true);assert.deepEqual(recovery.draft.configuration,configuration);
});

test('sequential preprocessing fits each stage on preceding training output', () => {
  const pipeline=new PreprocessingPipeline([{type:'standardize'},{type:'minmax'}]).fit([{x:10},{x:20}],['x']);
  assert.deepEqual(pipeline.transform([{x:10},{x:20}]),[{x:0},{x:1}]);
  const restored=PreprocessingPipeline.fromJSON(pipeline.toJSON());assert.deepEqual(restored.transform([{x:10}]),[{x:0}]);
  assert.equal(new PreprocessingPipeline([]).fit([{x:1}],['x']).transform([{x:null}])[0].x,null);
});

test('incomplete older drafts restore as an explicitly marked copy without changing their source',async()=>{
  const id=crypto.randomUUID();const configuration={selectedAlgorithm:'Logistic Regression',selectedPreset:'Spiral',learningRate:.03};
  await saveDraftLocal({id,revision:1,workspace:'playground',configuration});
  await saveRecoverySession({draftId:id,workspace:'playground',executionState:'idle'});
  const result=await new DraftManager().checkRecoveryOnStartup();
  assert.equal(result.legacyIncomplete,true);assert.notEqual(result.draft.id,id);
  assert.equal(result.draft.configuration.hyperparameters.learningRate,.03);
  assert.deepEqual((await getDraftLocal(id)).configuration,configuration);
});

test('runner rejects jobs during stopping and resets failed validation', async () => {
  const runner=new ModelRunner();
  await assert.rejects(runner.runTraining({layers:[],trainPoints:[],seed:1}));
  assert.equal(runner.status,'failed'); assert.equal(runner.activeJobId,null);
  runner.activeJobId='still-cleaning-up';runner.status='stopping';
  await assert.rejects(runner.runTraining({}),/CONCURRENT_JOB_REJECTED/);
  assert.equal(runner.dispose(),false);
});

test('email verification and password reset consume real one-time tokens and invalidate sessions', async () => {
  const delivered=[];
  const server=createApp({allowMemoryFallback:true,deliverAccountEmail:async message=>delivered.push(message)}).listen(0,'127.0.0.1');
  await new Promise(done=>server.once('listening',done));const base='http://127.0.0.1:'+server.address().port+'/api/v2/auth';
  const post=(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  try {
    const auth=await (await post('/register',{email:'reset@example.test',name:'Reset',password:'original-password'})).json();
    assert.equal((await post('/request-verification',{email:'reset@example.test'})).status,202);
    const verify=new URL(delivered.at(-1).url).searchParams.get('token');
    assert.equal((await post('/verify-email',{token:verify})).status,200);
    assert.equal((await post('/verify-email',{token:verify})).status,400);
    await post('/request-reset',{email:'reset@example.test'});const token=new URL(delivered.at(-1).url).searchParams.get('token');
    assert.equal((await post('/reset-password',{token,password:'replacement-password'})).status,200);
    assert.equal((await fetch(base+'/me',{headers:{Authorization:'Bearer '+auth.token}})).status,401);
    assert.equal((await post('/reset-password',{token,password:'another-password'})).status,400);
    assert.equal((await post('/login',{email:'reset@example.test',password:'replacement-password'})).status,200);
  }finally{await new Promise(done=>server.close(done));}
});
