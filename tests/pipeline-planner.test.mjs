import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDatasetPipeline, defaultPipelineColumns, SPLIT_PRESETS } from '../client/src/ml/pipelinePlanner.js';

const data = {
  headers: ['feature_x', 'feature_y', 'label'],
  rows: Array.from({length: 30}, (_, i) => ({
    id: `row-${i}`, feature_x: i === 0 ? null : i + 1,
    feature_y: i === 5 ? null : (i % 5) * 10,
    label: i < 15 ? 0 : 1,
  })),
};

test('F3 visual pipeline produces stable stratified partitions and train-fitted finite inputs', () => {
  const first = buildDatasetPipeline(data,{imputation:'median',scaling:'standardize'});
  const second = buildDatasetPipeline(data,{imputation:'median',scaling:'standardize'});
  assert.deepEqual(first.membership,second.membership);
  assert.deepEqual(first.points,second.points);
  assert.equal(first.counts.total,30);
  assert.equal(first.membership.train.length+first.membership.validation.length+first.membership.test.length,30);
  assert.equal(new Set(Object.values(first.membership).flat()).size,30);
  assert.ok(first.points.every(row=>Number.isFinite(row.x)&&Number.isFinite(row.y)));
  assert.equal(first.stages.length,5);
  assert.equal(first.statistics.x.count+first.statistics.x.missingTraining,first.counts.train);
});

test('F3 train-only fitted statistics do not change when held-out observations are altered', () => {
  const initial = buildDatasetPipeline(data,{imputation:'mean',scaling:'minmax',seed:15});
  const heldOut = new Set([...initial.membership.validation,...initial.membership.test]);
  const changed = {headers:data.headers,rows:data.rows.map(row=>heldOut.has(row.id)
    ? {...row,feature_x:999999,feature_y:-999999} : {...row})};
  const revised = buildDatasetPipeline(changed,{imputation:'mean',scaling:'minmax',seed:15});
  assert.deepEqual(initial.membership,revised.membership);
  assert.deepEqual(initial.pipeline.fittedParams,revised.pipeline.fittedParams);
  assert.notDeepEqual(initial.points,revised.points);
});

test('F3 median imputation is fitted on training rows and survives serialization', () => {
  const plan=buildDatasetPipeline(data,{imputation:'median',scaling:'none',seed:19});
  const med=plan.statistics.x.median;
  const missing=plan.points.find(row=>row.id==='row-0');
  assert.equal(missing.x,med);
  const serial=plan.pipeline.toJSON();
  assert.equal(serial.steps[0].options.strategy,'median');
  assert.equal(serial.fittedParams.stepParams[0].stats.x.median,med);
});

test('F3 no-imputation fails closed for incomplete numeric inputs', () => {
  assert.throws(()=>buildDatasetPipeline(data,{imputation:'none',scaling:'none'}),/NONFINITE_FEATURE/);
  assert.throws(()=>buildDatasetPipeline(data,{scaling:'invalid'}),/supported scaling/);
  assert.throws(()=>buildDatasetPipeline(data,{splitPreset:'55\/45'}),/supported train/);
  assert.throws(()=>buildDatasetPipeline(data,{seed:1.5}),/integer/);
});

test('F3 custom split ratios and column choices yield consistent, replayable membership', () => {
  for(const splitPreset of Object.keys(SPLIT_PRESETS)){
    const plan=buildDatasetPipeline(data,{splitPreset,seed:12});
    const repeat=buildDatasetPipeline(data,{splitPreset,seed:12});
    assert.deepEqual(plan.membership,repeat.membership);
    assert.ok(plan.counts.train>plan.counts.validation);
    assert.ok(plan.counts.test>0);
  }
  assert.deepEqual(defaultPipelineColumns(data),{x:'feature_x',y:'feature_y',target:'label'});
  assert.throws(()=>buildDatasetPipeline(data,{columns:{x:'feature_x',y:'label',target:'feature_y'}}),/numeric input/);
  assert.throws(()=>buildDatasetPipeline(data,{columns:{x:'feature_x',y:'feature_x',target:'label'}}),/different numeric/);
});

test('F3 no finite training observations never produces pretend imputed measurements', () => {
  const empty={headers:['x','y','label'],rows:data.rows.map(row=>({...row,x:null,y:null}))};
  assert.throws(()=>buildDatasetPipeline(empty,{columns:{x:'x',y:'y',target:'label'}}),/two numeric input/);
});
