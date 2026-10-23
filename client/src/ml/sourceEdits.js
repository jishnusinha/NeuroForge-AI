export const sourceEditKey=summary=>summary?.sourceFingerprint?.value?`neuroforge-csv-edits:${summary.sourceFingerprint.value}`:null;
export function validateSourceEdits(edits) {
  if(!edits||typeof edits!=='object'||Array.isArray(edits))throw new Error('Invalid source edit overlay.');
  const text=JSON.stringify(edits);
  if(text.length>4*1024*1024)throw new Error('The local edit draft exceeds 4 MiB. Export the edited source before continuing.');
  for(const [key,value] of Object.entries(edits)){
    const pair=JSON.parse(key);
    if(!Array.isArray(pair)||pair.length!==2||!/^source-\d+$/.test(pair[0])||typeof pair[1]!=='string'||
      !pair[1]||['id','sourceRowNumber','__proto__','constructor','prototype'].includes(pair[1])||
      !(value===null||typeof value==='string'||typeof value==='boolean'||typeof value==='number'&&Number.isFinite(value)))throw new Error('Invalid source edit cell.');
  }
  return edits;
}
