// Self-contained so generated JavaScript can restore these trusted renderers
// after loading JSON. User labels remain data, never generated executable code.
export function restoreModelRenderers(spec,option){
  if(spec.plot.kind==='horizontal_error')option.series[1].renderItem=(_params,api)=>{
    const a=api.coord([api.value(1),api.value(0)]),b=api.coord([api.value(2),api.value(0)]);
    return {type:'group',children:[{type:'line',shape:{x1:a[0],y1:a[1],x2:b[0],y2:b[1]},style:{stroke:'#888888',lineWidth:2}},...[a,b].map(p=>({type:'line',shape:{x1:p[0],y1:p[1]-5,x2:p[0],y2:p[1]+5},style:{stroke:'#888888',lineWidth:2}}))]};
  };
  if(spec.plot.kind==='waterfall')option.series[0].renderItem=(_params,api)=>{
    const a=api.coord([api.value(0),api.value(1)]),b=api.coord([api.value(0),api.value(2)]),width=Math.max(3,api.size([1,0])[0]*.6);
    return {type:'rect',shape:{x:a[0]-width/2,y:Math.min(a[1],b[1]),width,height:Math.abs(a[1]-b[1])},style:{fill:api.value(2)>=api.value(1)?option.color[0]:option.color[1]}};
  };
  return option;
}
