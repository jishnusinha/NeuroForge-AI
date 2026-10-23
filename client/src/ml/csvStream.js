import {coerce,detectCsvDelimiter,safeHeaders} from './datasetImport.js';

export const CSV_MAX_BYTES=100*1024*1024;
export function csvOptions(options={}) {
  return {delimiter:options.delimiter??options.delimiterChoice??'auto',quoteChar:options.quoteChar??'"',
    encoding:options.encoding??'utf-8',hasHeader:options.hasHeader!==false,decimalSeparator:options.decimalSeparator??'.',schemaOverrides:options.schemaOverrides||{}};
}
export function parseCsvCell(raw,type='auto',decimalSeparator='.',rowNumber=1,column='value'){
  if(type===undefined||type==='auto')return coerce(decimalSeparator===','?raw.replaceAll('.','').replace(',','.'):raw);
  if(type==='text')return raw===''?null:raw;
  if(raw==='')return null;
  if(type==='numeric'){
    const value=decimalSeparator===','?raw.replaceAll('.','').replace(',','.'):raw;
    if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())||!Number.isFinite(Number(value)))throw new Error(`Source row ${rowNumber}: “${raw.slice(0,80)}” is not numeric in “${column}”.`);
    return Number(value);
  }
  if(type==='boolean'){
    const value=raw.trim().toLowerCase();if(['true','yes','1'].includes(value))return true;if(['false','no','0'].includes(value))return false;
    throw new Error(`Source row ${rowNumber}: “${raw.slice(0,80)}” is not a recognized boolean in “${column}”.`);
  }
  if(type==='date'){
    const value=raw.trim();if(!/^\d{4}-\d{2}-\d{2}(?:t\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:z|[+-]\d{2}:?\d{2})?)?$/i.test(value))throw new Error(`Source row ${rowNumber}: “${raw.slice(0,80)}” is not an ISO date in “${column}”.`);
    const date=new Date(value);if(!Number.isFinite(date.getTime()))throw new Error(`Source row ${rowNumber}: invalid ISO date in “${column}”.`);return value.length===10?value:date.toISOString();
  }
  throw new Error(`Unsupported type override for “${column}”.`);
}
function rowError(message,rowNumber,fields){const error=new Error(message);error.diagnostics=[{rowNumber,reason:message,fields:fields.slice(0,100).map(value=>String(value).slice(0,160))}];return error;}

/** One record at a time. No source row array or file-sized decoded string. */
export async function scanCsv(file,options={},onRow=()=>{}, {onHeaders=()=>{},onProgress=()=>{},onBytes=()=>{},signal,edits={}}={}) {
  if(!file?.stream||file.size>CSV_MAX_BYTES)throw new Error('Choose a readable source file of at most 100 MiB.');
  const cfg=csvOptions(options);
  if(typeof cfg.quoteChar!=='string'||cfg.quoteChar.length!==1)throw new Error('Choose exactly one quote character.');
  const prefix=new TextDecoder(cfg.encoding,{fatal:true}).decode(await file.slice(0,128*1024).arrayBuffer(),{stream:true});
  const delimiter=cfg.delimiter==='auto'?detectCsvDelimiter(prefix.slice(0,Math.max(0,prefix.lastIndexOf('\n')))||prefix,cfg.quoteChar):cfg.delimiter==='tab'?'\t':cfg.delimiter;
  if(![',',';','\t'].includes(delimiter))throw new Error('Unsupported source delimiter.');
  const patches=new Map();
  for(const [key,value] of Object.entries(edits)) {
    const [id,column]=JSON.parse(key);
    if(!patches.has(id))patches.set(id,new Map());
    patches.get(id).set(column,value);
  }
  const reader=file.stream().getReader(),decoder=new TextDecoder(cfg.encoding,{fatal:true});
  let headers=null,record=[],cell='',quoted=false,pendingQuote=false,closedQuote=false,skipLF=false,rows=0,bytes=0,stopped=false;
  const accept=()=>{
    record.push(cell);cell='';closedQuote=false;
    if(record.length===1&&record[0]===''){record=[];return;}
    if(!headers){const originalHeaders=cfg.hasHeader?[...record]:record.map((_,i)=>`Column ${i+1}`);headers=safeHeaders(originalHeaders);if(headers.length>100)throw new Error('The source exceeds 100 columns.');onHeaders(headers,originalHeaders);if(cfg.hasHeader){record=[];return;}}
    if(record.length!==headers.length)throw rowError(`Source row ${rows+1} has ${record.length} fields; expected ${headers.length}.`,rows+1,record);
    const row=Object.create(null);row.id=`source-${rows}`;row.sourceRowNumber=rows+1;
    for(let i=0;i<headers.length;i++)try{row[headers[i]]=parseCsvCell(record[i],cfg.schemaOverrides[headers[i]],cfg.decimalSeparator,rows+1,headers[i]);}catch(error){throw rowError(error.message,rows+1,[record[i]]);}
    for(const [column,value] of patches.get(row.id)??[]){if(headers.includes(column))row[column]=value;}
    record=[];rows++;stopped=onRow(row)===true;
  };
  const feed=text=>{
    for(const ch of text){
      if(stopped)break;
      if(skipLF){skipLF=false;if(ch==='\n')continue;}
      if(quoted){
        if(pendingQuote){pendingQuote=false;if(ch===cfg.quoteChar){cell+=ch;continue;}quoted=false;closedQuote=true;}
        else {if(ch===cfg.quoteChar)pendingQuote=true;else cell+=ch;if(cell.length>1024*1024)throw new Error('A CSV cell exceeds the 1 MiB limit.');continue;}
      }
      if(ch===delimiter){record.push(cell);cell='';closedQuote=false;if(record.length>=100)throw new Error('A record exceeds 100 columns.');}
      else if(ch==='\r'||ch==='\n'){accept();skipLF=ch==='\r';}
      else if(closedQuote)throw new Error(`Unexpected character after a quoted field at source row ${rows+1}.`);
      else if(ch===cfg.quoteChar&&cell==='')quoted=true;
      else cell+=ch;
      if(cell.length>1024*1024)throw new Error('A CSV cell exceeds the 1 MiB limit.');
    }
  };
  try {
    while(!stopped){signal?.throwIfAborted();const chunk=await reader.read();if(chunk.done)break;bytes+=chunk.value.byteLength;onBytes(chunk.value);feed(decoder.decode(chunk.value,{stream:true}));onProgress({bytes,totalBytes:file.size,rows});}
    if(!stopped){feed(decoder.decode());if(quoted&&!pendingQuote)throw new Error('A quoted field is not closed.');if(cell.length||record.length||pendingQuote)accept();}
    if(!headers)throw new Error('The file has no records.');
    return {headers,sourceRows:rows,delimiter};
  }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
}
