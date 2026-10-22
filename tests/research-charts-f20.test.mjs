import test from 'node:test';
import assert from 'node:assert/strict';
import {runFixtures,searchFixture,archivedFixture} from './helpers/researchFixtures.mjs';
import {RESEARCH_CHARTS} from '../client/src/visualization/chartRegistry.js';
import {createResearchChartSpec} from '../client/src/visualization/researchChartSpec.js';
import {chartOptions} from '../client/src/visualization/chartOptions.js';
import {portableChart,chartCsv} from '../client/src/visualization/chartExport.js';
import {generatePython} from '../client/src/visualization/codegen/pythonCodegen.js';
import {generateJavaScript} from '../client/src/visualization/codegen/javascriptCodegen.js';
test('F20 all thirteen chart families produce measured portable evidence',async()=>{
  const runs=await runFixtures(),receipt=await archivedFixture();
  for(const def of RESEARCH_CHARTS){const source=def.family==='research_registry'?{kind:'f14-archive',receipts:runs}:{kind:'f15-archived',receipt};
    const result=await createResearchChartSpec({source,chartType:def.id,metric:'accuracy',secondaryMetric:'precision',...(def.id==='research_difference'?{selectedRunIds:runs.slice(0,2).map(r=>r.runId)}:{}),...(def.id==='cv_response'?{parameter:'maxDepth'}:{})});
    assert.equal(result.spec.source.datasetDigest,null);assert.match(result.spec.source.collectionDigest,/^[a-f0-9]{64}$/);assert.equal(result.spec.privacy.observationLevel,false);
    assert.ok(result.spec.evidence.rows.length,def.id);assert.ok(chartOptions(result.spec).series.length,def.id);
    if(def.id==='research_timeline'){assert.equal(chartOptions(result.spec).useUTC,true);assert.deepEqual(result.spec.evidence.rows.map(r=>r.x),result.spec.evidence.rows.map(r=>r.x).toSorted((a,b)=>a-b));}
    const json=JSON.stringify(portableChart(result.spec));assert.ok(!json.includes('private-f19'));assert.ok(!json.includes('accessHistory'));assert.ok(chartCsv(result.spec));assert.match(generatePython(result.spec),/read_csv/);assert.match(generateJavaScript(result.spec),/setOption/);
  }
});
test('F20 snapshot fingerprint tracks revisions and context without dataset fabrication',async()=>{
  const runs=await runFixtures(2),input={source:{kind:'f14-archive',receipts:runs},chartType:'research_leaderboard',metric:'accuracy'};
  const a=await createResearchChartSpec(input);runs[0].revision++;const b=await createResearchChartSpec(input);assert.notEqual(a.spec.source.collectionDigest,b.spec.source.collectionDigest);
  runs[1].lineage.splitDigest='b'.repeat(64);const c=await createResearchChartSpec({...input,chartType:'research_difference'});assert.equal(c.spec.researchContext.comparisonScope.status,'contextual');assert.equal(c.spec.evidence.rows[0].y,null);
});
test('F20 bounded maximum archive and search chart benchmark',async t=>{
  const runs=await runFixtures(30),start=performance.now();await createResearchChartSpec({source:{kind:'f14-archive',receipts:runs},selectedRunIds:runs.slice(0,10).map(r=>r.runId),chartType:'research_matrix',metric:'accuracy'});
  await createResearchChartSpec({source:{kind:'f15-live',search:searchFixture(12,5)},chartType:'cv_heatmap'});t.diagnostic('30 receipts / 12 trials × 5 folds: '+(performance.now()-start).toFixed(1)+'ms');
});
