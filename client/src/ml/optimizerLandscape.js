/** Controlled 2D convex loss surface; educational optimizer experiment, not a TF.js training run. */
export function quadraticLoss(x,y,curvatureX=1,curvatureY=6) {
  return .5*(curvatureX*x*x+curvatureY*y*y);
}

export function simulateOptimizer({
  method='sgd', learningRate=.08, steps=45, startX=2.8, startY=1.9,
  momentum=.9,
}={}) {
  if(!['sgd','momentum','adam'].includes(method))throw new Error('INVALID_OPTIMIZER');
  if(!Number.isFinite(learningRate)||learningRate<=0||learningRate>1.5||
    !Number.isInteger(steps)||steps<1||steps>100 ||
    ![startX,startY,momentum].every(Number.isFinite)||Math.abs(startX)>10||Math.abs(startY)>10 ||
    momentum<0||momentum>=1)throw new Error('INVALID_OPTIMIZER_SETTINGS');

  let x=startX,y=startY,vx=0,vy=0,mx=0,my=0,sx=0,sy=0;
  const history=[{step:0,x,y,loss:quadraticLoss(x,y)}];
  let status='completed';
  for(let step=1;step<=steps;step++){
    const gx=x,gy=6*y;
    if(method==='sgd'){
      x-=learningRate*gx;y-=learningRate*gy;
    }else if(method==='momentum'){
      vx=momentum*vx+gx;vy=momentum*vy+gy;
      x-=learningRate*vx;y-=learningRate*vy;
    }else{
      mx=.9*mx+.1*gx;my=.9*my+.1*gy;
      sx=.999*sx+.001*gx*gx;sy=.999*sy+.001*gy*gy;
      const bx=mx/(1-Math.pow(.9,step)),by=my/(1-Math.pow(.9,step));
      const ux=sx/(1-Math.pow(.999,step)),uy=sy/(1-Math.pow(.999,step));
      x-=learningRate*bx/(Math.sqrt(ux)+1e-8);
      y-=learningRate*by/(Math.sqrt(uy)+1e-8);
    }
    const loss=quadraticLoss(x,y);
    if(![x,y,loss].every(Number.isFinite)||Math.max(Math.abs(x),Math.abs(y))>1e5||loss>1e12){
      status='diverged';
      break;
    }
    history.push({step,x,y,loss});
  }
  return {
    method,learningRate,requestedSteps:steps,completedSteps:history.length-1,
    status,initialLoss:history[0].loss,finalLoss:history.at(-1).loss,
    history,surface:'0.5 × (x² + 6y²)',optimum:{x:0,y:0,loss:0},
  };
}
