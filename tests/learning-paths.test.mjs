import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeLearningTracks, academyStorageKey, readAcademyProgress, writeAcademyProgress } from '../client/src/ml/learningPaths.js';

test('F7 track mastery requires each actual completed checkpoint',()=>{
 const report=summarizeLearningTracks({'lesson-xor':true,'lesson-lr':false,'lesson-overfitting':true});
 assert.equal(report[0].completed,1);assert.equal(report[0].finished,false);
 assert.equal(report[1].completed,1);assert.equal(report[1].total,3);
 assert.equal(report[2].completed,0);
 const finished=summarizeLearningTracks({'lesson-xor':true,'lesson-lr':true})[0];
 assert.equal(finished.finished,true);
});

test('F7 local progress storage keeps account scopes distinct',()=>{
 const state=new Map();
 const storage={getItem:key=>state.get(key)??null,setItem:(key,value)=>state.set(key,value)};
 writeAcademyProgress(storage,'account-1',{'lesson-xor':true});
 writeAcademyProgress(storage,null,{'lesson-lr':true});
 assert.deepEqual(readAcademyProgress(storage,'account-1'),{'lesson-xor':true});
 assert.deepEqual(readAcademyProgress(storage,null),{'lesson-lr':true});
 assert.notEqual(academyStorageKey('account-1'),academyStorageKey(null));
});

test('F7 corrupt or invalid local checkpoint data never creates fabricated mastery',()=>{
 const storage={getItem:()=>'{INVALID'};
 assert.deepEqual(readAcademyProgress(storage),{});
 assert.deepEqual(readAcademyProgress({getItem:()=>JSON.stringify(['lesson-xor'])}),{});
});
