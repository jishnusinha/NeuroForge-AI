import {simulate} from './optimization/simulation.js';
/** F8 compatibility: historical `sgd` means full-gradient descent, not mini-batch SGD. */
export function quadraticLoss(x,y,curvatureX=1,curvatureY=6){return .5*(curvatureX*x*x+curvatureY*y*y);}
export function simulateOptimizer({method='sgd',learningRate=.08,steps=45,startX=2.8,startY=1.9,momentum=.9}={}){
 if(!['sgd','momentum','adam'].includes(method))throw new Error('INVALID_OPTIMIZER');
 if(!Number.isFinite(learningRate)||learningRate<=0||learningRate>1.5||!Number.isInteger(steps)||steps<1||steps>100||![startX,startY,momentum].every(Number.isFinite)||Math.abs(startX)>10||Math.abs(startY)>10||momentum<0||momentum>=1)throw new Error('INVALID_OPTIMIZER_SETTINGS');
 const trace=simulate({objectiveId:'bowl',optimizerId:method==='sgd'?'gd':method,learningRate,steps,start:[startX,startY],momentum,tolerance:0,permittedDomain:'legacy'}),history=trace.history.map(r=>({step:r.step,x:r.theta[0],y:r.theta[1],loss:r.loss}));
 return {method,learningRate,requestedSteps:steps,completedSteps:trace.completedSteps,status:trace.status,initialLoss:history[0].loss,finalLoss:history.at(-1).loss,history,surface:'0.5 × (x² + 6y²)',optimum:{x:0,y:0,loss:0}};
}
