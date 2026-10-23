import {simulate} from './simulation.js';
import {freeze} from './objectives.js';
export function compareOptimizers(config,optimizers){if(!Array.isArray(optimizers)||optimizers.length<1||optimizers.length>3||new Set(optimizers).size!==optimizers.length)throw new Error('Select one to three distinct optimizers');return freeze(optimizers.map(optimizerId=>simulate({...config,optimizerId})));}
export function stateAt(trace,step){return trace.history[Math.min(Math.max(0,Math.floor(step)),trace.completedSteps)];}
