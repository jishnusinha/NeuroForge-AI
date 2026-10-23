import { readFile } from 'node:fs/promises';

const config=await readFile('client/src/theme/themeConfig.js','utf8');
const css=await readFile('client/src/index.css','utf8');
const ids=[...config.matchAll(/\{id:'([^']+)',label:'[^']+',mode:'(dark|light)'/g)].map(match=>({id:match[1],mode:match[2]}));
if(ids.length!==10||new Set(ids.map(theme=>theme.id)).size!==10)throw new Error(`Expected ten unique theme definitions; found ${ids.length}.`);
const luminance=rgb=>rgb.map(channel=>channel/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4).reduce((sum,channel,index)=>sum+channel*[.2126,.7152,.0722][index],0);
const contrast=(first,second)=>{const a=luminance(first),b=luminance(second);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
for(const theme of ids){
  const rule=css.match(new RegExp(`\\[data-theme="${theme.id}"\\]\\s*\\{([^}]*)\\}`));
  if(!rule)throw new Error(`Missing semantic palette for ${theme.id}.`);
  const values=Object.fromEntries([...rule[1].matchAll(/--nf-([\w-]+)-rgb:\s*([\d ]+)/g)].map(match=>[match[1],match[2].trim().split(/\s+/).map(Number)]));
  for(const [name,foreground,background,min] of [
    ['text on background',values.text,values.bg,4.5],['text on surface',values.text,values.surface,4.5],
    ['muted text on background',values.muted,values.bg,4.5],['muted text on surface',values.muted,values.surface,4.5],
    ['accent graphic on background',values.accent,values.bg,3],['accent graphic on surface',values.accent,values.surface,3],
    ['button text on accent',values['on-accent'],values.accent,4.5],
  ]){if(!foreground||!background||contrast(foreground,background)<min)throw new Error(`${theme.id}: ${name} misses ${min}:1 contrast.`);}
}
const chart=await readFile('client/src/components/workspace/charts/ScientificChart.jsx','utf8');
if(!chart.includes('THEMES.find(item=>item.id===theme)?.mode')||!chart.includes('chartOptions(spec,{dark})'))throw new Error('Scientific charts and vector export must follow the active theme mode.');
console.log('Ten theme palettes and scientific chart theme behavior meet the semantic contrast contract.');
