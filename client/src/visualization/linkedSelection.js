export function validatedSelection(dataset,ids,columns=dataset.headers){
  if(!Array.isArray(ids)||ids.length>2000||!Array.isArray(columns)||columns.length>20||columns.some(c=>!dataset.headers.includes(c)))throw new Error('F18_INVALID_SELECTION');
  const source=new Set(dataset.rows.map(r=>r.id)),selected=[...new Set(ids)];
  if(selected.some(id=>!source.has(id)))throw new Error('F18_STALE_SELECTION');
  return {ids:selected,columns:[...new Set(columns)]};
}
export function linkedRows(links,indexes){return [...new Set(indexes.flatMap(index=>links[index]||[]))];}
export function brushEvidenceIndexes(option,event){
  return [...new Set((event.batch||[]).flatMap(batch=>(batch.selected||[]).flatMap(selected=>
    (selected.dataIndex||[]).map(i=>option.series[selected.seriesIndex]?.data[i]?.evidenceIndex).filter(Number.isInteger))))];
}
