import { validateRunReceipt } from './runContracts.js';
import {analyzeResearchRuns} from './researchAnalytics.js';
import {digest} from '../../../../shared/domain.mjs';
const escapeReport=value=>String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replaceAll('|','\\|').replaceAll('`','\\`').replaceAll('[','\\[').replaceAll(']','\\]').replace(/[\r\n]/g,' ');
function researchReportData(runs,{metric='accuracy',observations='',limitations=''}={}){
  if(typeof observations!=='string'||observations.length>4000||typeof limitations!=='string'||limitations.length>4000)throw new Error('F20_REPORT_INVALID');
  const analysis=analyzeResearchRuns(runs,metric);
  return {kind:'neuroforge-f20-research-report',schemaVersion:1,...analysis,observations,limitations,reproduction:'Recorded aggregate evidence only; no training data, fitted pipeline or model restoration.',validity:['Inner CV, fixed validation and final test remain distinct.','Final-test timestamps are a local workflow audit, not tamper-proof provenance.','Fold sample SD is descriptive, not a confidence interval.']};
}
export async function createResearchComparisonSnapshot(runs,options){const report=researchReportData(runs,options);return {...report,snapshotDigest:await digest(report)};}
export function createResearchComparisonReport(runs,options){
  const report=researchReportData(runs,options),lines=['# PRISM Research Comparison','',`Comparison: ${report.comparison.status} · ${report.comparison.metric} (${report.comparison.direction})`,'',...report.comparison.reasons.map(escapeReport),...report.comparison.notes.map(escapeReport),''];
  lines.push('| Run | Validation metric | Recorded score | Comparable rank |','| --- | --- | ---: | ---: |');
  for(const run of report.runs)lines.push('| '+escapeReport(run.title)+' | '+report.comparison.metric+' | '+(run.validation.metrics[report.comparison.metric]??'Unavailable')+' | '+(report.comparison.rankings.find(r=>r.runId===run.runId)?.rank??'Unavailable')+' |');
  for(const run of report.runs){
    lines.push('','## '+escapeReport(run.title),'','Revision: '+run.revision+' · Algorithm: '+run.model.algorithm,'','| Configuration parameter | Recorded value |','| --- | ---: |',...Object.entries(run.model.configuration).map(([k,v])=>'| '+k+' | '+v+' |'));
    if(!Object.keys(run.model.configuration).length)lines.push('| Preset defaults | No explicit overrides recorded |');
    if(run.selection){lines.push('','### Recorded inner-CV trials','','| Trial | Status | Configuration | Fold scores | Fold counts | Mean | Sample SD |','| ---: | --- | --- | --- | --- | ---: | ---: |');for(const trial of run.selection.trials)lines.push('| '+(trial.configIndex+1)+' | '+trial.status+' | '+JSON.stringify(trial.configuration)+' | '+trial.foldScores.join(', ')+' | '+(trial.foldCounts.length?trial.foldCounts.join(', '):'Not recorded')+' | '+(trial.mean??'Unavailable')+' | '+(trial.sampleSd??'Unavailable')+' |');}
    lines.push('','Final-test audit: '+(run.finalTestAudit.length?run.finalTestAudit.map(a=>escapeReport(a.accessedAt)+' ('+a.count+' observations)').join('; '):'No access recorded.')+' Scores are excluded from comparison.','','### Exact aggregate evidence and provenance','','```json',JSON.stringify(run,null,2).replace(/</g,'\\u003c').replace(/>/g,'\\u003e'),'```','');
  }
  lines.push('## Research notes','',escapeReport(report.observations),'','## Validity limitations','',escapeReport(report.limitations),'',...report.validity.map(v=>'- '+v),'',report.reproduction);return lines.join('\n');
}
const clean = text => String(text??'').replace(/\|/g,'\\|').replace(/[\r\n]/g,' ');
const fmt = x => x===null||!Number.isFinite(x)?'Unavailable':Number(x).toFixed(5);
export function createRunResearchReport(runs,{title='NeuroForge research record',observations='',limitations=''}={}) {
  if(!Array.isArray(runs)||!runs.length||runs.length>10||typeof title!=='string'||!title.trim()||title.length>120||
     typeof observations!=='string'||observations.length>4000||
     typeof limitations!=='string'||limitations.length>4000)
    throw new Error('F14_REPORT_INVALID');
  runs.forEach(validateRunReceipt);
  const head=['# '+title.trim(),'','**Report type:** Saved F12/F13 research receipts (not model training reproduction).','',
    '## Observed validation evidence','','| Experiment | Task | Algorithm | Source digest | Validation samples | Metric(s) |',
    '|---|---|---|---|---:|---|'];
  for(const run of runs) {
    const metrics=Object.entries(run.validation.metrics)
      .map(([k,v])=>k+': '+fmt(v)).join('; ');
    head.push('| '+clean(run.title)+' | '+clean(run.task.type)+' | '+clean(run.model.algorithm)+
      ' | '+run.lineage.sourceDigest.slice(0,16)+'… | '+run.validation.count+
      ' | '+clean(metrics)+' |');
  }
  head.push('','## Final-test access audit','');
  for(const run of runs){
    const access=run.finalTest.accessHistory;
    head.push('- **'+clean(run.title)+'**: '+(access.length?
      ('Access recorded at '+clean(access[0].accessedAt)+'. This result was not used to rank candidates.') :
      'No final-test access recorded in this archived receipt.'));
  }
  head.push('','## F15 model-selection evidence','');
  for(const run of runs){
    const selection=run.selectionEvidence;
    head.push('- **'+clean(run.title)+'**: '+(selection
      ?('Selected '+clean(selection.algorithm)+' using '+selection.folds+
        ' fold inner cross-validation; '+clean(selection.metric)+
        ' mean '+fmt(selection.selectedMean)+', fold SD '+fmt(selection.selectedSampleSd)+
        '; fold digest '+selection.foldMembershipDigest+'.')
      :'No F15 selection evidence attached.'));
  }
  head.push('','## Attached explanation evidence','');
  for(const run of runs){
    head.push('- **'+clean(run.title)+'**: '+run.explanations.length+
      ' saved summary receipt(s); algorithm '+clean(run.model.algorithm)+
      ', model SHA-256 '+run.model.digest+'.');
    for(const exp of run.explanations)
      head.push('  - F13 evidence at '+clean(exp.createdAt)+
        '; global importance '+clean(exp.permutation?.status??'Not recorded')+
        '; partial dependence '+(exp.dependence?'Recorded':'Not recorded')+
        '; subgroup evidence '+(exp.subgroups?'Recorded':'Not recorded')+'.');
  }
  head.push('','## Research notes','',observations||'No observations recorded.','',
    '## Limitations','',limitations||'No researcher-supplied limitations.','',
    '- Saved metrics are measurements from their recorded validation populations; different source/split populations must not be ranked together.',
    '- A saved receipt does not restore the source dataset, fitted F11 preprocessing, or training environment.',
    '- The final-test access log is a local workflow record, not tamper-proof provenance.',
    '- F13 explanations are model behavior, not causal conclusions.',
    '');
  return head.join('\n');
}
