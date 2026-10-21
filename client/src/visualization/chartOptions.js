// Pure rendering instructions: all statistical work belongs to adapters.
export const PALETTES={prism:['#42a5ad','#d49a6a','#9a85c7','#62b69d','#dfbc60','#c9798d','#638bc0','#9ca873'],
  publication:['#0072B2','#D55E00','#009E73','#CC79A7','#E69F00','#56B4E9','#000000','#999999'],
  diverging:['#386aa6','#739dc4','#e9edf0','#d9a084','#b84a4a']};
const item=(value,index)=>({value,evidenceIndex:index});
const unique=values=>[...new Set(values)];
export function chartOptions(spec,{dark=false,compact=false}={}){
  const rows=spec.evidence.rows,kind=spec.plot.kind,palette=PALETTES[spec.visual.palette]||PALETTES.prism;
  const text=dark?'#dce7eb':'#253e47',grid=dark?'#354a54':'#d6e0e2';
  const base={animation:false,color:palette,backgroundColor:dark?'#122128':'#ffffff',textStyle:{color:text,fontFamily:'system-ui, sans-serif'},
    aria:{enabled:true,decal:{show:false}},tooltip:{trigger:'item',renderMode:'richText',confine:true},
    legend:{type:'scroll',top:0,textStyle:{color:text}},grid:{left:65,right:30,top:55,bottom:85,containLabel:true},
    xAxis:{type:'value',name:spec.plot.xLabel,nameLocation:'middle',nameGap:35,splitNumber:compact?2:5,axisLabel:{color:text,hideOverlap:true,fontSize:compact?10:12},splitLine:{lineStyle:{color:grid}}},
    yAxis:{type:'value',name:spec.plot.yLabel,splitNumber:compact?3:5,axisLabel:{color:text,hideOverlap:true,fontSize:compact?10:12},splitLine:{lineStyle:{color:grid}}},
    series:[],dataZoom:[{type:'inside',filterMode:'none'},{type:'slider',height:18,bottom:12}],
    brush:{toolbox:['rect','clear'],brushType:'rect',brushMode:'single',xAxisIndex:'all',yAxisIndex:'all',throttleType:'debounce',throttleDelay:100}};
  const groups=unique(rows.map(r=>r.series||'Measured evidence'));
  if(kind==='heatmap'){
    const xs=unique(rows.map(r=>String(r.x))),ys=unique(rows.map(r=>String(r.y)));
    base.xAxis={...base.xAxis,type:'category',data:xs,axisLabel:{color:text,hideOverlap:true,rotate:compact?35:0}};base.yAxis={...base.yAxis,type:'category',data:ys};
    base.visualMap={min:spec.plot.correlation?-1:0,max:1,calculable:false,orient:'horizontal',left:'center',bottom:38,inRange:{color:spec.plot.correlation?['#386aa6','#f0f1ed','#b84a4a']:['#365c6c','#e3ad62']},textStyle:{color:text}};
    base.series=[{name:spec.plot.correlation?'Correlation':'Missing (1) / observed (0)',type:'heatmap',progressive:0,
      label:{show:spec.visual.showLabels&&xs.length<=8&&ys.length<=12,color:text,formatter:'{@[2]}'},
      data:rows.flatMap((r,i)=>r.value==null?[]:[item([xs.indexOf(String(r.x)),ys.indexOf(String(r.y)),r.value],i)])}];
  }else if(kind==='lineage'){
    delete base.xAxis;delete base.yAxis;delete base.dataZoom;delete base.brush;
    base.series=[{type:'graph',layout:'none',roam:true,symbolSize:40,label:{show:true,position:'bottom',color:text},edgeSymbol:['none','arrow'],edgeSymbolSize:10,
      data:rows.map((r,i)=>({id:String(i),name:r.label,x:60+i*150,y:100,evidenceIndex:i,value:r.detail})),
      links:rows.slice(1).map((_,i)=>({source:String(i),target:String(i+1)})),lineStyle:{color:palette[0],width:2}}];
  }else if(kind==='matrix'){
    const facets=spec.plot.facets,n=facets.length;
    base.grid=[];base.xAxis=[];base.yAxis=[];delete base.dataZoom;
    for(let r=0;r<n;r++)for(let c=0;c<n;c++){
      const idx=r*n+c;
      base.grid.push({left:(8+c*88/n)+'%',top:(10+r*80/n)+'%',width:(75/n)+'%',height:(65/n)+'%'});
      base.xAxis.push({type:'value',gridIndex:idx,name:r===n-1?facets[c]:'',axisLabel:{show:r===n-1,color:text},splitNumber:2});
      base.yAxis.push({type:'value',gridIndex:idx,name:c===0?facets[r]:'',axisLabel:{show:c===0,color:text},splitNumber:2});
      base.series.push({name:facets[c]+' / '+facets[r],type:r===c?'bar':'scatter',symbolSize:4,xAxisIndex:idx,yAxisIndex:idx,
        data:rows.flatMap((row,i)=>row.facet_x===facets[c]&&row.facet_y===facets[r]?[item([row.x,row.y],i)]:[])});
    }
  }else if(kind==='box'){
    base.xAxis={...base.xAxis,type:'category',data:rows.map(r=>r.series)};
    base.series=[{name:'Tukey box',type:'boxplot',data:rows.map((r,i)=>item([r.low,r.q1,r.median,r.q3,r.high],i))}];
  }else if(kind==='range'){
    const categories=unique(rows.map(r=>r.x));
    base.xAxis={...base.xAxis,type:'category',data:categories};
    base.yAxis.name='Observed range (min–max), center mark = mean';
    base.series=groups.map(group=>({name:group,type:'boxplot',data:categories.map(category=>{
      const index=rows.findIndex(r=>r.x===category&&r.series===group);if(index<0)return '-';const r=rows[index];
      return item([r.min,r.mean,r.mean,r.mean,r.max],index);
    })}));
  }else if(kind==='violin'){
    base.xAxis={...base.xAxis,name:'Group / normalized density width',min:-.6,max:groups.length-.4};
    base.yAxis={...base.yAxis,name:spec.plot.yLabel};
    const max=Math.max(...rows.map(r=>r.y),1e-100);
    for(const [gi,group] of groups.entries()){
      const points=rows.map((r,i)=>({...r,i})).filter(r=>r.series===group);
      const contour=[...points.map(r=>[gi-r.y/max*.42,r.x]),...points.toReversed().map(r=>[gi+r.y/max*.42,r.x])];
      base.series.push({type:'line',name:group,symbol:'none',lineStyle:{width:1},areaStyle:{opacity:.25},data:contour});
    }
  }else{
    const numericX=spec.evidence.columns.find(c=>c.key==='x')?.type!=='text';
    const categories=unique(rows.map(r=>String(r.x)));
    if(!numericX)base.xAxis={...base.xAxis,type:'category',data:categories,axisLabel:{color:text,hideOverlap:true,rotate:categories.length>5?30:0}};
    for(const group of groups){
      const points=rows.map((r,i)=>({...r,i})).filter(r=>(r.series||'Measured evidence')===group&&r.y!=null);
      const seriesType=kind==='line'||spec.plot.trend&&group==='OLS fit'?'line':kind==='scatter'||kind==='hexbin'?'scatter':'bar';
      base.series.push({name:group,type:seriesType,symbolSize:kind==='hexbin'?20:6,symbol:kind==='hexbin'?'path://M0,-1 L0.866,-0.5 L0.866,0.5 L0,1 L-0.866,0.5 L-0.866,-0.5 Z':'circle',
        step:spec.plot.step?'end':false,showSymbol:kind!=='line',areaStyle:spec.chartType==='kde'?{opacity:.16}:undefined,
        data:points.map(r=>item([numericX?r.x:categories.indexOf(String(r.x)),r.y,...(kind==='hexbin'?[r.count]:[])],r.i))});
    }
    if(kind==='hexbin')base.visualMap={min:0,max:Math.max(1,...rows.map(r=>r.count)),dimension:2,inRange:{color:['#d7e8e8','#237f88']},show:true,right:0,textStyle:{color:text}};
  }
  if(!Array.isArray(base.yAxis)&&base.yAxis){if(spec.visual.axisMin!==null)base.yAxis.min=spec.visual.axisMin;if(spec.visual.axisMax!==null)base.yAxis.max=spec.visual.axisMax;}
  return base;
}
