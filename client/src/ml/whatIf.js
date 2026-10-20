/**
 * What-if queries must call the actual fitted model. No synthetic probabilities,
 * no inferred causal claims, no access to held-out evaluation labels.
 */
function probability(predict, x, y) {
  const result=predict(x,y);
  if (!Number.isFinite(result)||result<0||result>1) throw new Error('MODEL_INVALID_PROBABILITY');
  return result;
}

export function evaluateWhatIf(predict, x, y, threshold = .5) {
  if(typeof predict!=='function' || ![x,y,threshold].every(Number.isFinite) ||
    threshold<=0 || threshold>=1) throw new Error('INVALID_WHAT_IF_INPUT');
  const predictedProbability=probability(predict,x,y);
  return { x,y,predictedProbability, predictedClass:predictedProbability>=threshold?1:0,threshold };
}

export function localWhatIfSensitivity(predict, x, y, stepX, stepY, threshold=.5) {
  if (![stepX,stepY].every(v=>Number.isFinite(v)&&v>0)) throw new Error('INVALID_PROBE_STEPS');
  const baseline=evaluateWhatIf(predict,x,y,threshold);
  return {
    baseline,
    xPlusDelta:probability(predict,x+stepX,y)-baseline.predictedProbability,
    yPlusDelta:probability(predict,x,y+stepY)-baseline.predictedProbability,
    stepX,stepY,
  };
}

export function nearestClassFlip(predict, origin, {
  threshold = .5, stepX = .1, stepY = .1, radius = 8, lockX = false, lockY = false,
  xBounds = [-Infinity,Infinity], yBounds = [-Infinity,Infinity],
} = {}) {
  if (!Number.isInteger(radius)||radius<1||radius>12 ||
      ![stepX,stepY].every(v=>Number.isFinite(v)&&v>0) ||
      !Array.isArray(xBounds)||!Array.isArray(yBounds)||xBounds.length!==2||yBounds.length!==2||
      xBounds[0]>xBounds[1]||yBounds[0]>yBounds[1]) throw new Error('INVALID_COUNTERFACTUAL_SEARCH');
  const baseline=evaluateWhatIf(predict,origin.x,origin.y,threshold);
  let candidate=null,evaluated=0;
  for(let i=lockX?0:-radius;i<=(lockX?0:radius);i++){
    for(let j=lockY?0:-radius;j<=(lockY?0:radius);j++){
      if(i===0&&j===0)continue;
      const x=origin.x+i*stepX,y=origin.y+j*stepY;
      if(x<xBounds[0]||x>xBounds[1]||y<yBounds[0]||y>yBounds[1])continue;
      const result=evaluateWhatIf(predict,x,y,threshold);
      evaluated++;
      if(result.predictedClass===baseline.predictedClass)continue;
      const distance=Math.hypot(i,j);
      if(!candidate||distance<candidate.distance ||
        (distance===candidate.distance&&Math.abs(i)+Math.abs(j)<candidate.manhattan)){
        candidate={...result,distance,manhattan:Math.abs(i)+Math.abs(j),
          deltaX:x-origin.x,deltaY:y-origin.y};
      }
    }
  }
  return {
    baseline,candidate: candidate ? {
      x:candidate.x,y:candidate.y,predictedProbability:candidate.predictedProbability,
      predictedClass:candidate.predictedClass,deltaX:candidate.deltaX,deltaY:candidate.deltaY,
      normalizedDistance:candidate.distance,
    } : null,
    evaluated,
    search:{stepX,stepY,radius,lockX,lockY,bounded:true},
  };
}
