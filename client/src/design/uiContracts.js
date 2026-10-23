export const DENSITIES=Object.freeze(['comfortable','compact']);
export const TONES=Object.freeze(['neutral','success','warning','error','info']);
export const WORKSPACES=Object.freeze([
  {path:'/app',section:'Research',title:'Mission Control',description:'Choose a research journey or continue a recorded experiment.'},
  {path:'/app/datasets',section:'Data',title:'Dataset Explorer',description:'Import, inspect, edit, prepare and visualize a dataset.'},
  {path:'/app/playground',section:'Laboratory',title:'ML Algorithm Playground',description:'Explore measured behavior with interactive classical models.'},
  {path:'/app/studio',section:'Deep Learning',title:'Neural Network Studio',description:'Build a network, train it and inspect its learned behavior.'},
  {path:'/app/optimization',section:'Optimization',title:'3D Loss Atlas',description:'Explore exact objective surfaces and optimizer updates.'},
  {path:'/app/experiments',section:'Research',title:'My Experiments',description:'Manage saved evidence and compare compatible research runs.'},
  {path:'/app/arena',section:'Evaluation',title:'Experiment Arena',description:'Compare recorded experiments on compatible evaluation populations.'},
  {path:'/app/learn',section:'Education',title:'NeuroForge Academy',description:'Learn through predictions, experiments and measured evidence.'},
  {path:'/showcase',section:'Learning',title:'Guided Product Tour',description:'Follow a guided journey through working scientific tools.'},
]);
export function workspaceInfo(path){return WORKSPACES.find(w=>w.path===path)|| (path.startsWith('/app/learn/')?WORKSPACES.find(w=>w.path==='/app/learn'):path.startsWith('/app/experiments/')||path.startsWith('/report/')?{section:'Research',title:'Experiment Report',description:'Inspect recorded methods, evidence and limitations.'}:{section:'Workspace',title:path==='/app/account'?'Account':'Laboratory',description:'Your local scientific workspace.'});}
export function isEditingTarget(target){return Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"],[role="textbox"],[role="grid"],[role="gridcell"]'));}
export function formatMetric(value,{digits=4,percent=false}={}){if(typeof value!=='number'||!Number.isFinite(value))return 'Unavailable';return new Intl.NumberFormat('en',{maximumFractionDigits:digits,...(percent?{style:'percent'}:{})}).format(value);}
export function draftLabel(state){return {pristine:'No draft changes',pending:'Unsaved changes',saving:'Saving locally',saved_local:'Saved in this browser',conflict:'Draft revision conflict',failed:'Local save unavailable'}[state]||'Draft status unavailable';}
export function contrastRatio(a,b){const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
