import { validateRunReceipt } from './runContracts.js';
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
