import {scanCsv} from './csvStream.js';
import {validateSourceEdits} from './sourceEdits.js';

export const CSV_SORT_BATCH=10000;
export function matchesSourceRow(row,filter) {
  if(!filter?.column)return true;
  const value=row[filter.column],needle=String(filter.value??'');
  if(filter.operator==='missing')return value==null||value==='';
  if(!needle)return true;if(value==null)return false;
  if(filter.operator==='equals')return String(value).toLowerCase()===needle.toLowerCase();
  if(['greater','less'].includes(filter.operator)){const number=Number(value),threshold=Number(needle);return Number.isFinite(number)&&Number.isFinite(threshold)&&(filter.operator==='greater'?number>threshold:number<threshold);}
  return String(value).toLowerCase().includes(needle.toLowerCase());
}
export function sourceComparator(direction='asc') {
  const order=direction==='desc'?-1:1;
  const collator=new Intl.Collator('en',{numeric:true,sensitivity:'base'});
  return (a,b)=>{
    if(a.value==null||b.value==null)return a.value==null&&b.value==null?a.sourceRowNumber-b.sourceRowNumber:a.value==null?1:-1;
    const an=typeof a.value==='number',bn=typeof b.value==='number';
    const difference=an&&bn?a.value-b.value:an!==bn?an?-1:1:collator.compare(String(a.value),String(b.value));
    return difference?difference*order:a.sourceRowNumber-b.sourceRowNumber;
  };
}
/** Max heap retains the first K successors of a stable cursor, regardless of source size. */
function keepSmallest(heap,item,limit,compare) {
  if(heap.length<limit){let i=heap.length;heap.push(item);while(i>0){const parent=(i-1)>>1;if(compare(heap[parent],item)>=0)break;heap[i]=heap[parent];i=parent;}heap[i]=item;return;}
  if(compare(item,heap[0])>=0)return;
  let i=0;
  while(2*i+1<heap.length){let child=2*i+1;if(child+1<heap.length&&compare(heap[child+1],heap[child])>0)child++;if(compare(item,heap[child])>=0)break;heap[i]=heap[child];i=child;}
  heap[i]=item;
}
export async function queryCsvSource(file,{start=0,pageSize=100,sort=null,filter=null,edits={},onProgress=()=>{},signal,...options}={}) {
  validateSourceEdits(edits);
  if(!Number.isSafeInteger(start)||start<0||!Number.isInteger(pageSize)||pageSize<1||pageSize>500)throw new Error('Invalid source page.');
  let headers=[],matchedRows=0,sourceRows=0,pass=0;
  const scan=async onRow=>{
    pass++;
    const result=await scanCsv(file,options,onRow,{edits,signal,onHeaders:names=>{headers=names;if(sort?.column&&!names.includes(sort.column)||filter?.column&&!names.includes(filter.column))throw new Error('Choose a source column.');},onProgress:progress=>onProgress({...progress,pass})});
    sourceRows=result.sourceRows;return result;
  };
  if(!sort?.column){
    const rows=[];
    await scan(row=>{if(matchesSourceRow(row,filter)){if(matchedRows>=start&&rows.length<pageSize)rows.push(row);matchedRows++;}});
    return {headers,rows,start,matchedRows,scannedRows:sourceRows,complete:true,sorted:false};
  }
  const compare=sourceComparator(sort.direction);
  let cursor=null,offset=start,selected=[],totalSourceRows=0;
  while(true){
    const heap=[],limit=Math.min(CSV_SORT_BATCH,offset+pageSize-selected.length),first=pass===0;
    await scan(row=>{
      if(!matchesSourceRow(row,filter))return;
      if(first)matchedRows++;
      const item={value:row[sort.column]??null,sourceRowNumber:row.sourceRowNumber};
      if(!cursor||compare(item,cursor)>0)keepSmallest(heap,item,limit,compare);
    });
    totalSourceRows=sourceRows;heap.sort(compare);
    if(offset<heap.length)selected.push(...heap.slice(offset,offset+pageSize-selected.length));
    if(selected.length===pageSize||heap.length<limit||!heap.length)break;
    offset=Math.max(0,offset-heap.length);cursor=heap.at(-1);
  }
  const wanted=new Set(selected.map(item=>item.sourceRowNumber)),byNumber=new Map();
  if(wanted.size)await scan(row=>{if(wanted.has(row.sourceRowNumber))byNumber.set(row.sourceRowNumber,row);return byNumber.size===wanted.size;});
  return {headers,rows:selected.map(item=>byNumber.get(item.sourceRowNumber)),start,matchedRows,scannedRows:totalSourceRows,complete:true,sorted:true,
    sortMethod:'bounded_successor_heap_v1',maxRetainedSortEntries:Math.min(CSV_SORT_BATCH,start+pageSize)};
}
