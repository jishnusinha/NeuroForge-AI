/**
 * Summary-only F15 selection evidence, compatible with historical F14 v1
 * receipts. No fold observation identities or source data are archived.
 */
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function validateSelectionEvidence(evidence,algorithm,task){
  if(evidence===null||evidence===undefined)return null;
  if(evidence.kind!=='neuroforge-f15-selection'||evidence.schemaVersion!==1||
     evidence.scope!=='original-training-inner-cv'||
     evidence.algorithm!==algorithm||evidence.task!==task ||
     ![3,5].includes(evidence.folds)||
     !Number.isInteger(evidence.seed)||evidence.seed<0||evidence.seed>0xffffffff||
     !/^[a-f0-9]{64}$/.test(evidence.foldMembershipDigest??'')||
     !Number.isInteger(evidence.sourceTrainingCount)||evidence.sourceTrainingCount<6||
     !['accuracy','macroF1','rmse','mae','r2'].includes(evidence.metric)||
     !['maximize','minimize'].includes(evidence.direction)||
     !Array.isArray(evidence.trials)||evidence.trials.length<1||evidence.trials.length>12||
     evidence.trials.length*evidence.folds>60||
     !Number.isInteger(evidence.selectedIndex)||evidence.selectedIndex<0||
     !finite(evidence.selectedMean)||
     (evidence.selectedSampleSd!==null&&!finite(evidence.selectedSampleSd)))
    throw new Error('F15_INVALID_SELECTION_EVIDENCE');
  const chosen=evidence.trials.find(entry=>entry.configIndex===evidence.selectedIndex);
  if(!chosen||chosen.status!=='complete'||
     !Array.isArray(chosen.foldScores)||chosen.foldScores.length!==evidence.folds||
     chosen.foldScores.some(value=>!finite(value)) ||
     chosen.mean!==evidence.selectedMean||
     chosen.sampleSd!==evidence.selectedSampleSd)
    throw new Error('F15_INVALID_SELECTION_WINNER');
  if(evidence.trials.some(item=>
    !Number.isInteger(item.configIndex)||item.configIndex<0||
    !['complete','unavailable'].includes(item.status)||
    !Array.isArray(item.foldScores)||item.foldScores.length>evidence.folds||
    item.foldScores.some(value=>!finite(value)) ||
    !item.configuration||typeof item.configuration!=='object'))
    throw new Error('F15_INVALID_SELECTION_TRIAL');
  // Explicit allowlisting prevents accidentally persisting raw rows in this
  // versioned evidence slot.
  return {
    kind:'neuroforge-f15-selection',schemaVersion:1,
    scope:evidence.scope,algorithm,task,metric:evidence.metric,direction:evidence.direction,
    folds:evidence.folds,seed:evidence.seed,
    foldMembershipDigest:evidence.foldMembershipDigest,
    sourceTrainingCount:evidence.sourceTrainingCount,
    selectedIndex:evidence.selectedIndex,selectedMean:evidence.selectedMean,
    selectedSampleSd:evidence.selectedSampleSd,
    trials:evidence.trials.map(item=>({
      configIndex:item.configIndex,configuration:structuredClone(item.configuration),
      status:item.status,foldScores:[...item.foldScores],
      foldCounts:[...(item.foldCounts??[])],
      mean:item.mean??null,sampleSd:item.sampleSd??null,reason:item.reason??null,
    })),
  };
}
