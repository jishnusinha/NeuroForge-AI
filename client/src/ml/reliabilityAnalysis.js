/** Evidence-based reliability analysis for the existing classifier validation partition. */
export function calibrationEvidence(samples, bins=5) {
  if(!Number.isInteger(bins)||bins<2||bins>10)throw new Error('INVALID_CALIBRATION_BINS');
  const observed=samples.filter(row=>[0,1].includes(row.label)&&Number.isFinite(row.probability)&&row.probability>=0&&row.probability<=1);
  const buckets=Array.from({length:bins},(_,i)=>({index:i,from:i/bins,to:(i+1)/bins,count:0,sumProbability:0,sumLabels:0}));
  let brier=0;
  for(const row of observed){
    const index=Math.min(bins-1,Math.floor(row.probability*bins));
    const bucket=buckets[index];bucket.count++;bucket.sumProbability+=row.probability;bucket.sumLabels+=row.label;
    brier+=(row.probability-row.label)**2;
  }
  let ece=0;
  const rows=buckets.map(bucket=>{
    const meanProbability=bucket.count?bucket.sumProbability/bucket.count:null;
    const observedRate=bucket.count?bucket.sumLabels/bucket.count:null;
    const gap=bucket.count?Math.abs(meanProbability-observedRate):null;
    if(bucket.count)ece+=gap*bucket.count/observed.length;
    return {bin:bucket.index+1,from:bucket.from,to:bucket.to,count:bucket.count,
      meanProbability,observedRate,gap};
  });
  return {count:observed.length,brier:observed.length?brier/observed.length:null,
    expectedCalibrationError:observed.length?ece:null,bins:rows};
}

export function subgroupEvidence(samples, feature='x', boundary=0, threshold=.5) {
  if(!['x','y'].includes(feature)||!Number.isFinite(boundary)||!Number.isFinite(threshold)||
    threshold<=0||threshold>=1)throw new Error('INVALID_SUBGROUP_SETTINGS');
  const groups=[
    {label:`${feature} < ${Number(boundary.toFixed(3))}`,predicate:row=>row[feature]<boundary},
    {label:`${feature} ≥ ${Number(boundary.toFixed(3))}`,predicate:row=>row[feature]>=boundary},
  ];
  return groups.map(group=>{
    const observed=samples.filter(row=>Number.isFinite(row[feature])&&[0,1].includes(row.label)&&
      Number.isFinite(row.probability)&&row.probability>=0&&row.probability<=1&&group.predicate(row));
    const correct=observed.filter(row=>(row.probability>=threshold?1:0)===row.label).length;
    const positive=observed.filter(row=>row.label===1).length;
    return {label:group.label,count:observed.length,positives:positive,
      accuracy:observed.length?correct/observed.length:null,errorRate:observed.length?1-correct/observed.length:null};
  });
}

export function featureShiftEvidence(samples,predict,{deltaX=0,deltaY=0,threshold=.5}={}) {
  if(typeof predict!=='function'||![deltaX,deltaY,threshold].every(Number.isFinite)||
      Math.abs(deltaX)>4||Math.abs(deltaY)>4||threshold<=0||threshold>=1)
    throw new Error('INVALID_SHIFT_SCENARIO');
  const rows=samples.filter(row=>Number.isFinite(row.x)&&Number.isFinite(row.y)&&[0,1].includes(row.label)
    &&Number.isFinite(row.probability)&&row.probability>=0&&row.probability<=1);
  if(!rows.length)return {count:0,meanProbabilityDelta:null,flipRate:null,originalAccuracy:null,shiftedAccuracy:null};
  let probabilityDelta=0,flips=0,origCorrect=0,shiftCorrect=0;
  for(const row of rows){
    const shifted=predict(row.x+deltaX,row.y+deltaY);
    if(!Number.isFinite(shifted)||shifted<0||shifted>1)throw new Error('INVALID_MODEL_SHIFT_PROBABILITY');
    const origClass=row.probability>=threshold?1:0;
    const shiftedClass=shifted>=threshold?1:0;
    probabilityDelta+=shifted-row.probability;
    if(origClass!==shiftedClass)flips++;
    if(origClass===row.label)origCorrect++;
    if(shiftedClass===row.label)shiftCorrect++;
  }
  return {count:rows.length,meanProbabilityDelta:probabilityDelta/rows.length,flipRate:flips/rows.length,
    originalAccuracy:origCorrect/rows.length,shiftedAccuracy:shiftCorrect/rows.length};
}
