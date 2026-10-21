import {mkdir,writeFile} from 'node:fs/promises';
import {fixture,envelope} from '../tests/helpers/modelChartFixtures.mjs';
import {createModelChartSpec} from '../client/src/visualization/modelChartSpec.js';
import {createChartSpec} from '../client/src/visualization/chartSpecV2.js';
import {portableChart,chartCsv} from '../client/src/visualization/chartExport.js';
import {generatePython} from '../client/src/visualization/codegen/pythonCodegen.js';
import {explainLocalPrediction} from '../client/src/ml/modelWorkbench/localExplanations.js';
import {partialDependence} from '../client/src/ml/modelWorkbench/partialDependence.js';
import {permutationImportance} from '../client/src/ml/modelWorkbench/permutationImportance.js';
import {subgroupDiagnostics} from '../client/src/ml/modelWorkbench/subgroupDiagnostics.js';
import {sourceWhatIf,sourceFeatureControls} from '../client/src/ml/modelWorkbench/whatIfDiagnostics.js';
const root='.artifacts/python-charts';
async function save(spec){const dir=root+'/'+spec.chartType;await mkdir(dir,{recursive:true});await Promise.all([
  writeFile(dir+'/neuroforge-chart.json',JSON.stringify(portableChart(spec,{consent:true}))),writeFile(dir+'/neuroforge-chart-data.csv',chartCsv(spec,{consent:true})),writeFile(dir+'/neuroforge-chart.py',generatePython(spec))]);}
for(const task of ['classification','regression']){
  const ctx=fixture(task);
  for(const type of task==='regression'?['actual_predicted','residuals','residual_distribution','error_range']:['confusion','per_class','roc','precision_recall','calibration','confidence','training_loss'])await save((await createModelChartSpec({...ctx,config:{type}})).spec);
  const local=explainLocalPrediction(ctx.matrix,ctx.candidate.model,ctx.matrix.membership.validation[0]);await save((await createModelChartSpec({...ctx,config:{type:'model_contributions'},explanation:envelope(ctx.candidate,local)})).spec);
}
const ctx=fixture(),control=sourceFeatureControls(ctx.plan,ctx.matrix).find(c=>c.editable&&c.type==='numeric');
for(const [type,result] of [
  ['model_importance',permutationImportance(ctx.matrix,ctx.candidate.model)],['model_dependence',partialDependence(ctx.matrix,ctx.candidate.model,{feature:ctx.matrix.features[0]})],
  ['model_subgroups',subgroupDiagnostics(ctx.matrix,ctx.candidate.model,{feature:ctx.matrix.features[0]})],['model_whatif',sourceWhatIf(ctx.matrix,ctx.candidate.model,ctx.plan,ctx.matrix.membership.validation[0],{[control.name]:control.max})],
])await save((await createModelChartSpec({...ctx,config:{type},explanation:envelope(ctx.candidate,result)})).spec);
const tree=fixture('classification','cart');await save((await createModelChartSpec({...tree,config:{type:'model_model_specific'},explanation:envelope(tree.candidate,explainLocalPrediction(tree.matrix,tree.candidate.model,tree.matrix.membership.validation[0]))})).spec);
// Retain coverage of shared F18 reproduction branches too.
for(const type of ['histogram','kde','box','violin','ecdf','count','scatter','scatter_matrix','hexbin','trend','correlation','missingness'])await save((await createChartSpec({dataset:ctx.plan.raw?{headers:['x','y','target'],rows:ctx.plan.raw}:null,config:{type,x:'x',y:'y',columns:['x','y']}})).spec);
console.log('Exported executable chart fixtures to '+root);
