import * as tf from '@tensorflow/tfjs';
import { buildTFModel, trainTFModel, extractModelWeights } from './tfModelEngine.js';
import { serializeModelArtifact } from './modelArtifacts.js';
import { validateExecutionBudget, isFeatureEnabled } from '../services/productionConfig.js';
export class ModelRunner {
  constructor() { this.status='idle'; this.activeJobId=null; this.currentModel=null; this.ownsModel=false; this.listeners=new Set(); this.lastRunArtifact=null; this.stopRef={current:false}; this.lastEvent={}; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  notify(event={}) { this.lastEvent={...this.lastEvent,...event,status:this.status}; for (const fn of this.listeners) { try { fn(this.lastEvent); } catch { /* A view cannot interrupt the job. */ } } }
  getStatus() { return { ...this.lastEvent, status:this.status, activeJobId:this.activeJobId, tensorsCount:tf.memory().numTensors, backend:tf.getBackend() }; }
  async runTraining(spec) {
    if (this.activeJobId) throw new Error('CONCURRENT_JOB_REJECTED: Another job is active, including stop cleanup.');
    this.activeJobId=crypto.randomUUID(); this.status='validating'; this.stopRef=spec.shouldStopRef || {current:false}; this.stopRef.current=false; this.lastRunArtifact=null; this.lastEvent={};
    this.notify({epoch:0,totalEpochs:spec.epochs ?? 60});
    const losses=[]; let earlyStopped=false; let best=Infinity; let stale=0;
    try {
      validateExecutionBudget((spec.trainPoints?.length ?? 0)+(spec.valPoints?.length ?? 0),2);
      if (!Number.isFinite(spec.learningRate ?? .04) || (spec.learningRate ?? .04)<=0 || !Number.isInteger(spec.seed ?? 42)) throw new Error('Invalid learning rate or model seed.');
      if (spec.earlyStopping?.enabled && (!Number.isInteger(spec.earlyStopping.patience) || spec.earlyStopping.patience<1 || !Number.isFinite(spec.earlyStopping.minDelta) || spec.earlyStopping.minDelta<0)) throw new Error('Invalid early stopping settings.');
      if (this.ownsModel && this.currentModel) { this.currentModel.optimizer?.dispose(); this.currentModel.dispose(); }
      this.currentModel=null; this.ownsModel=!spec.model;
      const model=spec.model || buildTFModel(spec.layers,spec.learningRate ?? .04,spec.seed ?? 42,spec.optimizer ?? 'adam');
      this.currentModel=model; this.status='running'; this.notify();
      const checkpoints=await trainTFModel(model,spec.trainPoints,spec.valPoints || [],spec.epochs ?? 60,spec.batchSize ?? 16,(epoch,logs)=>{
        const row={epoch,...logs}; losses.push(row);
        spec.onEpochEnd?.(row); this.notify({...row,totalEpochs:spec.epochs ?? 60});
        const settings=spec.earlyStopping;
        if (settings?.enabled && Number.isFinite(logs.valLoss)) {
          if (logs.valLoss<best-settings.minDelta) { best=logs.valLoss; stale=0; }
          else if (++stale>=settings.patience) { earlyStopped=true; model.stopTraining=true; }
        }
      },this.stopRef);
      if(losses.length && checkpoints.at(-1)?.epoch !== losses.at(-1).epoch) checkpoints.push({...losses.at(-1),weights:extractModelWeights(model)});
      const cancelled=this.stopRef.current;
      if (!cancelled && isFeatureEnabled('persistent_artifacts')) this.lastRunArtifact=await serializeModelArtifact(model,spec.layers,{earlyStopped,epochsTrained:losses.length,finalLoss:losses.at(-1)?.loss,seed:spec.seed ?? 42,evaluationWeights:'final'});
      this.status=cancelled?'cancelled':'completed';
      this.notify({completed:!cancelled,cancelled,earlyStopped,checkpoints});
      return {status:this.status,losses,checkpoints,earlyStopped,artifact:this.lastRunArtifact};
    } catch(error) { this.status='failed'; this.notify({error:error.message}); if(this.ownsModel&&this.currentModel){this.currentModel.optimizer?.dispose();this.currentModel.dispose();this.currentModel=null;} throw error; }
    finally { this.activeJobId=null; }
  }
  stop() { if(this.activeJobId && ['running','validating'].includes(this.status)){this.stopRef.current=true;this.status='stopping';this.notify();} }
  dispose() { if(this.activeJobId){this.stop();return false;} if(this.ownsModel&&this.currentModel){this.currentModel.optimizer?.dispose();this.currentModel.dispose();} this.currentModel=null;this.status='idle';this.lastRunArtifact=null;this.notify();return true; }
}
export const modelRunner=new ModelRunner();
