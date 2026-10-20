/** Two-variable principal-component projection. Exploratory only, not a fitted training pipeline. */
export function pcaTwoFeatures(rows, first, second) {
  if (!first || !second || first === second) throw new Error('PCA_REQUIRES_TWO_DIFFERENT_FEATURES');
  const observed = rows.map((row, index)=>({
    rowNumber:index+1,id:row.id ?? `row-${index+1}`,x:row[first],y:row[second],
  })).filter(row=>Number.isFinite(row.x)&&Number.isFinite(row.y));
  if (observed.length < 3) return {available:false,reason:'PCA needs at least three complete numeric pairs.',count:observed.length,excluded:rows.length-observed.length};
  const n=observed.length;
  const meanX=observed.reduce((sum,row)=>sum+row.x,0)/n;
  const meanY=observed.reduce((sum,row)=>sum+row.y,0)/n;
  let covXX=0,covXY=0,covYY=0;
  for (const row of observed) {
    const x=row.x-meanX,y=row.y-meanY;
    covXX+=x*x;covXY+=x*y;covYY+=y*y;
  }
  covXX/=n-1;covXY/=n-1;covYY/=n-1;
  const total=covXX+covYY;
  if (!(total>0) || !Number.isFinite(total)) return {available:false,reason:'PCA is undefined for zero-variance or nonfinite input.',count:n,excluded:rows.length-n};
  const delta=Math.hypot(covXX-covYY,2*covXY);
  const eigen1=Math.max(0,(total+delta)/2);
  const eigen2=Math.max(0,(total-delta)/2);
  const angle=.5*Math.atan2(2*covXY,covXX-covYY);
  let vx=Math.cos(angle),vy=Math.sin(angle);
  if (Math.abs(vx)>=Math.abs(vy) ? vx<0 : vy<0) { vx=-vx;vy=-vy; }
  const ux=-vy,uy=vx;
  const projected=observed.map(row => {
    const x=row.x-meanX,y=row.y-meanY;
    return {id:row.id,rowNumber:row.rowNumber,pc1:x*vx+y*vy,pc2:x*ux+y*uy};
  });
  return {
    available:true,count:n,excluded:rows.length-n,features:[first,second],
    center:[meanX,meanY],covariance:[[covXX,covXY],[covXY,covYY]],
    eigenvalues:[eigen1,eigen2],explained:[eigen1/total,eigen2/total],
    components:[[vx,vy],[ux,uy]],projected,
  };
}
