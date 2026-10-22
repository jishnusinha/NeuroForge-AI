import {chartCsv,portableChart} from './chartExport.js';
import {generatePython} from './codegen/pythonCodegen.js';
import {generateJavaScript} from './codegen/javascriptCodegen.js';
const encoder=new TextEncoder();
export function reproductionFiles(spec,{consent=false}={}){
  if(spec.privacy.observationLevel&&!consent)throw new Error('F21_BUNDLE_REQUIRES_OBSERVATION_CONSENT');
  return {'neuroforge-chart.json':JSON.stringify(portableChart(spec,{consent}),null,2),'neuroforge-chart-data.csv':chartCsv(spec,{consent}),
    'neuroforge-chart.py':generatePython(spec),'neuroforge-chart.js':generateJavaScript(spec),
    'README.txt':'PRISM plot-data reproduction\n\nKeep these files together. Python needs pandas, numpy, matplotlib and seaborn. Run python neuroforge-chart.py. JavaScript needs ECharts and a bundler; serve the JSON alongside the generated code.\n\nThese programs render exact exported evidence. They do not restore source datasets, fitted preprocessing, models or training environments. Method definitions, source fingerprints, missingness policies and units are in neuroforge-chart.json. No source observation export is silently added.\n'};
}
function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
/** Standards-compatible uncompressed ZIP; deterministic, UTF-8, no runtime dependency. */
export function zipFiles(files){const chunks=[],directory=[];let offset=0,centralSize=0;
  for(const [name,text] of Object.entries(files)){if(!/^[a-zA-Z0-9_.-]+$/.test(name))throw new Error('F21_INVALID_BUNDLE_FILENAME');const filename=encoder.encode(name),data=encoder.encode(text),crc=crc32(data),local=new Uint8Array(30+filename.length),l=new DataView(local.buffer);l.setUint32(0,0x04034b50,true);l.setUint16(4,20,true);l.setUint16(6,0x800,true);l.setUint32(14,crc,true);l.setUint32(18,data.length,true);l.setUint32(22,data.length,true);l.setUint16(26,filename.length,true);local.set(filename,30);
    l.setUint16(12,0x21,true);
    const central=new Uint8Array(46+filename.length),c=new DataView(central.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(14,0x21,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);c.setUint16(28,filename.length,true);c.setUint32(42,offset,true);central.set(filename,46);chunks.push(local,data);directory.push(central);offset+=local.length+data.length;centralSize+=central.length;
  }
  const end=new Uint8Array(22),view=new DataView(end.buffer);view.setUint32(0,0x06054b50,true);view.setUint16(8,directory.length,true);view.setUint16(10,directory.length,true);view.setUint32(12,centralSize,true);view.setUint32(16,offset,true);const result=new Uint8Array(offset+centralSize+end.length);let cursor=0;for(const chunk of [...chunks,...directory,end]){result.set(chunk,cursor);cursor+=chunk.length;}return result;
}
export function downloadReproductionBundle(spec,options){const bytes=zipFiles(reproductionFiles(spec,options)),url=URL.createObjectURL(new Blob([bytes],{type:'application/zip'})),link=document.createElement('a');link.download='neuroforge-reproduction.zip';link.href=url;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
