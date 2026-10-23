import { finite,evidence,col,grouping } from '../chartEvidence.js';
import { distributionEvidence } from '../../ml/edaStatistics.js';

function fitOLS(points){
  if(points.length<3)return null;
  const n=points.length,mx=points.reduce((s,p)=>s+p.x/n,0),my=points.reduce((s,p)=>s+p.y/n,0);
  const xx=points.reduce((s,p)=>s+(p.x-mx)**2,0),xy=points.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0);
  if(!(xx>0)||!finite(xx)||!finite(xy))return null;
  const slope=xy/xx,intercept=my-slope*mx;
  const error=points.reduce((s,p)=>s+(p.y-intercept-slope*p.x)**2,0),total=points.reduce((s,p)=>s+(p.y-my)**2,0);
  return {slope,intercept,rSquared:total>0?1-error/total:null,n};
}
export function compute({dataset,config}){
  const {type,x,y,columns=[x,y],group}=config;
  const pairs=type==='scatter_matrix'?columns.slice(0,4).flatMap(a=>columns.slice(0,4).map(b=>[a,b])):[[x,y]];
  const rows=[],links=[],warnings=[];let excluded=0,fit=null;
  const labels=new Map();
  if(group)for(const item of grouping(dataset.rows,group))for(const row of item.rows)labels.set(row.id,item.label);
  for(const [a,b] of pairs){
    if(type==='scatter_matrix'&&a===b){
      distributionEvidence(dataset.rows,a,'numeric',8).bins.forEach(bin=>{rows.push({series:'Diagonal distribution',x:(bin.from+bin.to)/2,y:bin.count,from:bin.from,to:bin.to,facet_x:a,facet_y:b,count:bin.count});links.push([]);});
      continue;
    }
    const points=[];
    for(const row of dataset.rows){if(!finite(row[a])||!finite(row[b])){excluded++;continue;}
      points.push({x:row[a],y:row[b],series:group?labels.get(row.id):'Observed',facet_x:a,facet_y:b,id:row.id});}
    if(type==='hexbin'){
      if(!points.length)continue;
      const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x)),minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
      const dx=(maxX-minX||1)/18,dy=(maxY-minY||1)/18,buckets=new Map();
      for(const p of points){const nx=(p.x-minX)/dx,ny=(p.y-minY)/dy;
        const q=(Math.sqrt(3)/3*nx-ny/3),r=2*ny/3;
        let cx=Math.round(q),cz=Math.round(r),cy=Math.round(-q-r);
        const ex=Math.abs(cx-q),ey=Math.abs(cy+q+r),ez=Math.abs(cz-r);
        if(ex>ey&&ex>ez)cx=-cy-cz;else if(ey>ez)cy=-cx-cz;else cz=-cx-cy;
        const key=cx+','+cz;if(!buckets.has(key))buckets.set(key,{x:minX+dx*Math.sqrt(3)*(cx+cz/2),y:minY+dy*1.5*cz,count:0,ids:[]});
        const bucket=buckets.get(key);bucket.count++;bucket.ids.push(p.id);
      }
      for(const b of buckets.values()){rows.push({series:'Hexagonal bins',x:b.x,y:b.y,count:b.count,dx,dy});links.push(b.ids);}
    }else{
      for(const {id,...point} of points){rows.push(point);links.push([id]);}
      if(type==='trend'){
        fit=fitOLS(points);
        if(!fit)warnings.push('OLS requires three complete pairs with nonzero x variation; no trend is available.');
        else for(const xx of [Math.min(...points.map(p=>p.x)),Math.max(...points.map(p=>p.x))]){
          const yy=fit.intercept+fit.slope*xx;if(finite(yy)){rows.push({series:'OLS fit',x:xx,y:yy,facet_x:a,facet_y:b});links.push([]);}
        }
      }
    }
  }
  return evidence({columns:[col('series','text'),col('x'),col('y'),col('count'),col('from'),col('to'),col('dx'),col('dy'),col('facet_x','text'),col('facet_y','text')],rows,
    kind:type==='scatter_matrix'?'matrix':type==='hexbin'?'hexbin':'scatter',stats:{excludedPairs:excluded,fit,pairs:pairs.length,sourceRows:dataset.rows.length},links,warnings,
    observationLevel:type!=='hexbin',notes:['Pairwise complete finite numeric observations only; no sampling of scatter points.',
      'Scatter matrix is capped at four selected variables, with exact histograms on the diagonal. Pairwise exclusions can differ between panels.',
      'Hexbin uses pointy-top axial hexagons, cube-coordinate rounding and independently normalized axes (18 units per observed range). Counts sum to complete pairs.',
      'OLS is descriptive unweighted least squares with an intercept. No uncertainty bands or causal claims. Constant targets have undefined R².'],
    plot:{xLabel:x,yLabel:y,facets:type==='scatter_matrix'?columns.slice(0,4):[],trend:type==='trend'}});
}
