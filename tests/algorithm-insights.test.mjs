import test from 'node:test';
import assert from 'node:assert/strict';
import {trainDecisionTree,decisionTreeProbability,evaluateDecisionTree,flattenTreeRules} from '../client/src/ml/decisionTree.js';
import {pcaTwoFeatures} from '../client/src/ml/pcaTwoFeatures.js';

test('F4 CART learns XOR with a 2-level binary tree from training evidence',()=>{
  const rows=[];
  for(const x of [-2,-1,1,2])for(const y of [-2,-1,1,2])rows.push({x,y,label:(x>0)!==(y>0)?1:0});
  const model=trainDecisionTree(rows,{maxDepth:3,minLeaf:2});
  assert.equal(model.algorithm,'CART-Gini');
  assert.ok(model.nodeCount>1);
  assert.equal(evaluateDecisionTree(model,rows).accuracy,1);
  assert.equal(decisionTreeProbability(model,-1,1),1);
  assert.equal(decisionTreeProbability(model,1,1),0);
  assert.ok(flattenTreeRules(model.root).length>=3);
});

test('F4 tree determinism and max-depth constraints, stable class probabilities',()=>{
  const rows=Array.from({length:30},(_,i)=>({x:i%10,y:Math.floor(i/10),label:i%10>=5?1:0}));
  const a=trainDecisionTree(rows,{maxDepth:1});
  const b=trainDecisionTree(rows,{maxDepth:1});
  assert.deepEqual(a,b);
  assert.ok(a.nodeCount<=3);
  assert.equal(evaluateDecisionTree(a,rows).accuracy,1);
  assert.ok(Math.abs(a.featureImportance.x-1)<1e-12);
  assert.equal(evaluateDecisionTree(a,[]).accuracy,null);
});

test('F4 no-split and invalid inference fail honestly without invented certainty',()=>{
  const rows=Array.from({length:8},(_,i)=>({x:0,y:0,label:i%2}));
  const model=trainDecisionTree(rows,{maxDepth:5});
  assert.equal(model.root.type,'leaf');
  assert.equal(decisionTreeProbability(model,0,0),.5);
  assert.throws(()=>decisionTreeProbability(model,NaN,0),/TREE_INVALID/);
  assert.throws(()=>trainDecisionTree(rows,{maxDepth:12}),/TREE_DEPTH/);
  assert.throws(()=>trainDecisionTree([{x:1,y:2,label:2},...rows]),/TREE_REQUIRES/);
});

test('F4 PCA captures a single strong principal axis and preserves centered coordinates',()=>{
  const rows=Array.from({length:11},(_,i)=>({id:'r'+i,a:i-5,b:2*(i-5)}));
  const p=pcaTwoFeatures(rows,'a','b');
  assert.equal(p.available,true);
  assert.equal(p.count,11);
  assert.ok(p.explained[0]>.99999999);
  assert.ok(p.explained[1]<1e-10);
  assert.ok(p.projected.every(row=>Math.abs(row.pc2)<1e-10));
  const sum=p.projected.reduce((total,row)=>total+row.pc1,0);
  assert.ok(Math.abs(sum)<1e-10);
});

test('F4 PCA excludes incomplete pairs, preserves originals and fails for constant data',()=>{
  const rows=[{a:1,b:2},{a:2,b:3},{a:3,b:4},{a:null,b:7}];
  const original=structuredClone(rows);
  const p=pcaTwoFeatures(rows,'a','b');
  assert.equal(p.count,3);assert.equal(p.excluded,1);
  assert.deepEqual(rows,original);
  assert.equal(pcaTwoFeatures([{a:1,b:1},{a:1,b:1},{a:1,b:1}],'a','b').available,false);
  assert.equal(pcaTwoFeatures([{a:1,b:1},{a:1,b:null}],'a','b').available,false);
  assert.throws(()=>pcaTwoFeatures(rows,'a','a'),/TWO_DIFFERENT/);
});
