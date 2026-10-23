import {createObjective,seededRandom,freeze} from './objectives.js';
import {simulationConfig} from './traceContracts.js';
import {optimizerStep} from './optimizerEngine.js';
export function experimentFingerprint(config){let hash=2166136261;for(const character of JSON.stringify({version:1,config})){hash=Math.imul(hash^character.charCodeAt(0),16777619)>>>0;}return 'f22-v1-'+hash.toString(16).padStart(8,'0');}
export function simulate(input={}){
 const config=simulationConfig(input),objective=createObjective(config.objectiveId,config.seed),random=seededRandom(config.seed),history=[];
 let theta=[...config.start],state={},status='completed',gradientCalls=0;
 const permitted=([x,y])=>config.permittedDomain==='legacy'?Math.max(Math.abs(x),Math.abs(y))<=1e5:x>=objective.domain.x[0]&&x<=objective.domain.x[1]&&y>=objective.domain.y[0]&&y<=objective.domain.y[1];
 if(!permitted(theta))throw new Error('Start lies outside the permitted parameter domain');
 const record=(step,update,usedGradient,batch)=>{const loss=objective.loss(...theta),gradient=objective.gradient(...theta);gradientCalls++;return {step,theta:[...theta],loss,gradient,gradNorm:Math.hypot(...gradient),update,state:structuredClone(state),...(usedGradient?{usedGradient}:{}),...(batch?{batch}:{}),finite:true,status:'running'};};
 history.push(record(0,[0,0]));
 for(let t=1;t<=config.steps;t++){
  if(config.optimizerId!=='sgd'&&config.tolerance>0&&history.at(-1).gradNorm<=config.tolerance){status='converged';break;}
  const batch=config.optimizerId==='sgd'?Array.from({length:config.batchSize},()=>Math.floor(random()*objective.sampleCount)):undefined;
  const at=config.optimizerId==='nesterov'?theta.map((v,i)=>v-config.learningRate*config.momentum*(state.velocity?.[i]??0)):theta;
  const gradient=objective.gradient(...at,batch);gradientCalls++;
  const next=optimizerStep(theta,gradient,state,config,t),loss=objective.loss(...next.theta);
  if(![...next.theta,...gradient,loss,...next.update,...Object.values(next.state).flat()].every(Number.isFinite)||Math.abs(loss)>1e12){status='diverged';break;}
  if(!permitted(next.theta)){status=config.permittedDomain==='legacy'?'diverged':'out_of_domain';break;}
  theta=next.theta;state=next.state;history.push(record(t,next.update,gradient,batch));
 }
 history.at(-1).status=status;
 return freeze({kind:'neuroforge-optimization-trace',schemaVersion:1,fingerprint:experimentFingerprint(config),config,objective:{id:objective.id,version:objective.version,equation:objective.equation,domain:objective.domain,seed:config.seed,...(objective.dataset?{dataset:objective.dataset}:{})},status,completedSteps:history.length-1,gradientCalls,lossEvaluations:history.length*2-1+(status==='diverged'||status==='out_of_domain'?1:0),history,stoppingRule:'Full-objective gradient norm ≤ tolerance for deterministic methods; SGD has no convergence claim. Otherwise budget complete or stop at last valid state.'});
}
