import test from 'node:test';
import assert from 'node:assert/strict';
import {createChartSpec,adaptV1Chart,validateChartSpec} from '../client/src/visualization/chartSpecV2.js';
import {CHART_REGISTRY} from '../client/src/visualization/chartRegistry.js';
import {density} from '../client/src/visualization/chartEvidence.js';
import {chartOptions} from '../client/src/visualization/chartOptions.js';
import {chartCsv,portableChart,sourceCsv} from '../client/src/visualization/chartExport.js';
import {generatePython} from '../client/src/visualization/codegen/pythonCodegen.js';
import {generateJavaScript} from '../client/src/visualization/codegen/javascriptCodegen.js';
import {createHistogramChartSpec} from '../client/src/visualization/chartSpec.js';
import {validatedSelection,linkedRows,brushEvidenceIndexes} from '../client/src/visualization/linkedSelection.js';
import {defaultStudioRecipe} from '../client/src/ml/pipelineGraph.js';
import {executeStudioPipeline,replayFittedStages} from '../client/src/ml/pipelineExecutor.js';
import {digest} from '../shared/domain.mjs';

const dataset={headers:['x','y','constant','group','label'],rows:Array.from({length:60},(_,i)=>({id:'private-observation-'+i,x:i===5?null:i,y:i*2+1,constant:7,group:i%2?'A':'B',label:i%2}))};
const base={x:'x',y:'y',columns:['x','y','constant'],bins:8,palette:'prism'};
const chart=(type,config={},data=dataset)=>createChartSpec({dataset:data,config:{...base,y:data.headers.includes('y')?'y':data.headers[0],type,...config}});

test('F18 every EDA family returns validated bounded evidence and render instructions without mutating source',async()=>{
  const before=structuredClone(dataset);
  for(const def of CHART_REGISTRY.filter(d=>d.family!=='pipeline')){
    const {spec}=await chart(def.id);assert.equal(validateChartSpec(spec),spec);
    const option=chartOptions(spec);assert.ok(Array.isArray(option.series),def.id);
    assert.equal(spec.method.implementationVersion,1);
    assert.ok(!JSON.stringify(portableChart(spec,{consent:true})).includes('private-observation-'));
  }
  assert.deepEqual(dataset,before);
});
test('F18 v1 compatibility keeps exact F10 histogram edges, missing counts and frequencies',async()=>{
  const old=createHistogramChartSpec({dataset,column:'x',binCount:8});
  const {spec}=await adaptV1Chart(old,dataset);
  assert.deepEqual(spec.evidence.rows.map(r=>[r.from,r.to,r.count]),old.bins.map(b=>[b.from,b.to,b.count]));
  assert.equal(spec.evidence.rows.reduce((n,r)=>n+r.count,0),59);
  const frequency=(await chart('histogram',{normalization:'frequency'})).spec;
  assert.ok(Math.abs(frequency.evidence.rows.reduce((n,r)=>n+r.y,0)-1)<1e-12);
  const normalized=(await chart('histogram',{normalization:'density'})).spec;
  assert.ok(Math.abs(normalized.evidence.rows.reduce((n,r)=>n+r.y*(r.to-r.from),0)-1)<1e-12);
  assert.equal((await chart('histogram',{x:'constant',normalization:'density'})).spec.evidence.status,'unavailable');
  const grouped=(await chart('histogram',{group:'group'})).spec.evidence.rows;
  for(const bin of old.bins){const matching=grouped.filter(r=>r.x===bin.index);assert.equal(matching.reduce((n,r)=>n+r.count,0),bin.count);assert.ok(matching.every(r=>r.from===bin.from&&r.to===bin.to));}
});

test('F18 grouped categories conserve denominators and do not confuse synthetic labels with real categories',async()=>{
  const data={headers:['x','y','group'],rows:Array.from({length:30},(_,i)=>({id:'r'+i,x:i,y:i*2,group:i===0?'Missing group':i===1?null:i===2?'Other groups (combined)':'category-'+i}))};
  const scatter=await chart('scatter',{group:'group',columns:['x','y']},data);
  const groups=new Set(scatter.spec.evidence.rows.map(r=>r.series));assert.equal(groups.size,8);
  const counted=await chart('count',{x:'group',group:'',columns:['group']},data);
  assert.equal(counted.spec.evidence.rows.reduce((n,r)=>n+r.count,0),29);
  assert.equal(counted.spec.evidence.stats.groups[0].count,29);
});

test('F18 rejects forged scope, non-finite evidence and schema mismatches instead of rendering stale results',async()=>{
  const forged={headers:dataset.headers,rows:dataset.rows.map((r,i)=>i?{...r}:{...r,x:999})};
  await assert.rejects(createChartSpec({dataset:forged,sourceDataset:dataset,population:'selection',config:{...base,type:'histogram'}}),/POPULATION_MISMATCH/);
  const result=await createChartSpec({dataset:forged,sourceDataset:dataset,population:'working_copy',config:{...base,type:'histogram'}});
  assert.equal(result.spec.source.population,'working_copy');
  const bad=structuredClone(result.spec);bad.evidence.rows[0].y=Infinity;assert.throws(()=>validateChartSpec(bad),/NUMERICAL_EVIDENCE/);
  bad.evidence.rows[0].y='1';assert.throws(()=>validateChartSpec(bad),/NUMERICAL_EVIDENCE/);
  assert.throws(()=>validateChartSpec({...result.spec,schemaVersion:99}),/INVALID_CHART_SPEC/);
});
test('F18 KDE matches a closed Gaussian fixture and rejects constant/insufficient samples',()=>{
  const result=density([0,1,2],{bandwidth:.5,grid:97});
  const center=result.rows[48];assert.equal(center.x,1);
  assert.ok(Math.abs(center.y-(1+2*Math.exp(-2))/(1.5*Math.sqrt(2*Math.PI)))<1e-14);
  const area=result.rows.slice(1).reduce((n,p,i)=>n+(p.x-result.rows[i].x)*(p.y+result.rows[i].y)/2,0);
  assert.ok(area>.998&&area<1.001);
  assert.equal(density([1,1,1]).status,'unavailable');assert.equal(density([1,2]).status,'unavailable');
  assert.throws(()=>density([0,1,2],{bandwidth:0}),/BANDWIDTH/);
});
test('F18 quartiles, Tukey whiskers and right-continuous ECDF use explicit definitions',async()=>{
  const data={headers:['x'],rows:[0,1,2,3,100].map((x,i)=>({id:'r'+i,x}))};
  const box=(await chart('box',{columns:['x']},data)).spec.evidence.rows[0];
  assert.deepEqual([box.q1,box.median,box.q3,box.low,box.high,box.outliers],[1,2,3,0,3,1]);
  const tied={headers:['x'],rows:[1,1,2,3].map((x,i)=>({id:'r'+i,x}))};
  const ecdf=(await chart('ecdf',{columns:['x']},tied)).spec.evidence.rows;
  assert.deepEqual(ecdf.map(p=>[p.x,p.y]),[[1,.5],[2,.75],[3,1]]);
});
test('F18 complete-pair scatter, OLS and hexbin conserve source membership and measured coordinates',async()=>{
  const scatter=await chart('scatter');assert.equal(scatter.spec.evidence.rows.length,59);
  assert.deepEqual(scatter.links[5],['private-observation-6']);
  const trend=await chart('trend');assert.ok(Math.abs(trend.spec.evidence.stats.fit.slope-2)<1e-12);assert.ok(Math.abs(trend.spec.evidence.stats.fit.intercept-1)<1e-12);
  assert.equal(trend.spec.evidence.stats.fit.rSquared,1);
  const hex=await chart('hexbin');assert.equal(hex.spec.evidence.rows.reduce((n,r)=>n+r.count,0),59);
  assert.equal(new Set(hex.links.flat()).size,59);
  const matrix=await chart('scatter_matrix',{columns:['x','y']});
  assert.equal(matrix.spec.evidence.rows.filter(r=>r.facet_x==='x'&&r.facet_y==='y').length,59);
  assert.equal(matrix.spec.evidence.rows.filter(r=>r.facet_x==='x'&&r.facet_y==='x').reduce((n,r)=>n+r.count,0),59);
});
test('F18 correlations reuse complete-pair counts and retain unavailable constant coefficients',async()=>{
  const {spec}=await chart('correlation');
  const xy=spec.evidence.rows.find(r=>r.x==='x'&&r.y==='y'),constant=spec.evidence.rows.find(r=>r.x==='constant'&&r.y==='x');
  assert.equal(xy.count,59);assert.ok(Math.abs(xy.value-1)<1e-14);assert.equal(constant.value,null);
  const option=chartOptions(spec);assert.ok(!option.series[0].data.some(p=>p.value[2]===null));
  const inverse={headers:['x','y'],rows:[1,1,2,3].map((x,i)=>({id:'r'+i,x,y:[4,4,2,1][i]}))};
  const tied=await chart('correlation',{columns:['x','y'],correlation:'spearman'},inverse);
  assert.ok(Math.abs(tied.spec.evidence.rows.find(r=>r.x==='x'&&r.y==='y').value+1)<1e-14);
});
test('F18 missingness denominators are exact and the matrix discloses its bounded source sampling',async()=>{
  const full={headers:['x','y'],rows:Array.from({length:2000},(_,i)=>({id:'r'+i,x:i%2?null:i,y:i}))};
  const bars=await chart('completeness',{columns:['x','y']},full);
  assert.equal(bars.spec.evidence.rows[0].count,1000);assert.equal(bars.spec.evidence.rows[0].y,50);assert.equal(bars.links[0].length,1000);
  const matrix=await chart('missingness',{columns:['x','y']},full);
  assert.equal(matrix.spec.evidence.stats.displayedRows,80);assert.equal(matrix.spec.evidence.rows.length,160);
  assert.equal(matrix.spec.source.rowCount,2000);assert.equal(matrix.links[2][0],'r25');
});
test('F18 observation exports require consent and never include raw IDs; executable code treats labels as data',async()=>{
  const {spec}=await chart('scatter');assert.throws(()=>chartCsv(spec),/CONSENT/);assert.throws(()=>sourceCsv(dataset),/CONSENT/);
  assert.equal(portableChart(spec).exportManifest.mode,'metadata_only');assert.deepEqual(portableChart(spec).evidence.rows,[]);
  const exported=portableChart(spec,{consent:true});assert.equal(exported.evidence.rows.length,59);assert.ok(exported.renderOption);
  const malicious='\"; __import__(\"os\").system(\"bad\") #';
  const data={headers:[malicious],rows:[{id:'r0',[malicious]:'=SUM(A1)'},{id:'r1',[malicious]:'@evil'},{id:'r2',[malicious]:'ordinary'}]};
  const counted=(await chart('count',{x:malicious,columns:[malicious]},data)).spec;
  const csv=chartCsv(counted);assert.ok(csv.includes("'=SUM(A1)"));assert.ok(csv.includes("'@evil"));
  assert.ok(!generatePython(counted).includes(malicious));assert.ok(!generateJavaScript(counted).includes(malicious));
  assert.equal(portableChart(counted).exportManifest.csvEscapes.length,2);
});
test('F18 linking validates stable IDs, survives order changes and maps brush series indexes precisely',()=>{
  assert.deepEqual(validatedSelection(dataset,['private-observation-7','private-observation-2'],['x']).ids,['private-observation-7','private-observation-2']);
  assert.throws(()=>validatedSelection(dataset,['stale-id']),/STALE_SELECTION/);
  const links=[['a'],['b','c'],['d']],option={series:[{data:[{evidenceIndex:2},{evidenceIndex:0}]}]};
  assert.deepEqual(linkedRows(links,brushEvidenceIndexes(option,{batch:[{selected:[{seriesIndex:0,dataIndex:[1,0]}]}]})),['a','d']);
});
test('F18 every pipeline view replays frozen training artifacts without changing fits, splits or source',async()=>{
  const raw=structuredClone(dataset),recipe=defaultStudioRecipe(raw);recipe.featureColumns=['x','y'];
  recipe.nodes=recipe.nodes.map(n=>({...n,columns:n.columns.filter(c=>['x','y'].includes(c))})).filter(n=>n.columns.length);
  const provisional=executeStudioPipeline(raw,recipe),training=new Set(provisional.membership.train),validation=new Set(provisional.membership.validation);
  raw.rows=raw.rows.map(r=>({...r,x:training.has(r.id)?Number(r.id.split('-').at(-1)):validation.has(r.id)?10000:-10000}));
  const plan=executeStudioPipeline(raw,recipe),before=await digest(plan),sourceBefore=structuredClone(raw);
  const stages=replayFittedStages(plan.artifact,plan.raw);assert.deepEqual(stages.at(-1).after,plan.rows);
  for(const def of CHART_REGISTRY.filter(d=>d.family==='pipeline')){
    const result=await createChartSpec({dataset:raw,sourceDataset:raw,plan,config:{...base,type:def.id,stage:stages.at(-1).id,partition:'validation'}});
    validateChartSpec(result.spec);assert.ok(!JSON.stringify(portableChart(result.spec)).includes('private-observation-'));
    assert.equal(result.spec.source.pipelineDigest,await digest(plan.artifact));
  }
  const scaling=await createChartSpec({dataset:raw,plan,config:{type:'pipeline_scaling',x:'x',partition:'validation',stage:stages.at(-1).id}});
  const parameters=plan.artifact.fittedNodes.at(-1).parameters.x;
  assert.ok(Math.abs(scaling.spec.evidence.rows.find(r=>r.series==='After'&&r.x==='x').y-(10000-parameters.mean)/parameters.standardDeviation)<1e-10);
  assert.equal(scaling.spec.source.rowCount,plan.membership.validation.length);
  assert.equal(await digest(plan),before);assert.deepEqual(raw,sourceBefore);
});
