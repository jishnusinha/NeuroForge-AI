/** Pure update kernel. Nesterov receives the gradient at explicit look-ahead coordinates. */
export function optimizerStep(theta,g,state,c,t){
 const next={},id=c.optimizerId;
 let direction=g;
 if(id==='momentum'||id==='nesterov'){next.velocity=g.map((v,i)=>c.momentum*(state.velocity?.[i]??0)+v);direction=next.velocity;}
 if(id==='adagrad'||id==='rmsprop'){next.secondMoment=g.map((v,i)=>id==='adagrad'?(state.secondMoment?.[i]??0)+v*v:c.beta2*(state.secondMoment?.[i]??0)+(1-c.beta2)*v*v);direction=g.map((v,i)=>v/(Math.sqrt(next.secondMoment[i])+c.epsilon));}
 if(id==='adam'||id==='adamw'){next.firstMoment=g.map((v,i)=>c.beta1*(state.firstMoment?.[i]??0)+(1-c.beta1)*v);next.secondMoment=g.map((v,i)=>c.beta2*(state.secondMoment?.[i]??0)+(1-c.beta2)*v*v);direction=g.map((_,i)=>(next.firstMoment[i]/(1-c.beta1**t))/(Math.sqrt(next.secondMoment[i]/(1-c.beta2**t))+c.epsilon));}
 const update=direction.map((v,i)=>-c.learningRate*v-(id==='adamw'?c.learningRate*c.weightDecay*theta[i]:0));
 return {theta:theta.map((v,i)=>v+update[i]),update,state:next};
}
