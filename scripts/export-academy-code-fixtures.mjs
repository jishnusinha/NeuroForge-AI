import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ACADEMY_CASES, academyCsv, academyPython, generateAcademyCase } from '../client/src/academy/cases/catalog.js';
import { academyJavaScript } from '../client/src/academy/cases/jsCode.js';

const directory=join('.artifacts','academy-executable');
await mkdir(directory,{recursive:true});
for(const spec of ACADEMY_CASES){
  const {rows}=generateAcademyCase(spec.id);
  await Promise.all([
    writeFile(join(directory,`${spec.id}.csv`),academyCsv(spec,rows),'utf8'),
    writeFile(join(directory,`${spec.id}.py`),academyPython(spec),'utf8'),
    writeFile(join(directory,`${spec.id}.mjs`),academyJavaScript(spec),'utf8'),
    writeFile(join(directory,`${spec.id}-README.md`),`# ${spec.title}\n\n- Task: ${spec.task}\n- Seed: ${spec.seed}\n- Rows: ${spec.rows}\n- Features: ${spec.features.join(', ')}\n- Target: ${spec.target||'None (unsupervised clustering)'}\n- Limit: ${spec.limitation}\n\nInstall Python 3.12, pandas 2.2.3, scikit-learn 1.7.2, and matplotlib 3.10.3. Run \`python ${spec.id}.py\` to fit the recommended model, or run \`node ${spec.id}.mjs\` to reproduce descriptive evidence without a model fit.\n`,'utf8'),
  ]);
}
console.log(`Exported ${ACADEMY_CASES.length} deterministic Academy code fixtures.`);
