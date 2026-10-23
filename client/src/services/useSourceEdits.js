import {useCallback,useMemo,useSyncExternalStore} from 'react';
import {sourceEditKey,validateSourceEdits} from '../ml/sourceEdits.js';

export function useSourceEdits(summary) {
  const key=sourceEditKey(summary);
  const subscribe=useCallback(listener=>{const changed=event=>{if(event.type==='storage'?event.key===key||event.key===null:event.detail===key)listener();};window.addEventListener('storage',changed);window.addEventListener('csv-source-edits',changed);return()=>{window.removeEventListener('storage',changed);window.removeEventListener('csv-source-edits',changed);};},[key]);
  const snapshot=useCallback(()=>{try{return key?localStorage.getItem(key)||'{}':'{}';}catch{return '{}';}},[key]);
  const text=useSyncExternalStore(subscribe,snapshot,()=> '{}');
  const state=useMemo(()=>{try{return {edits:validateSourceEdits(JSON.parse(text)),error:''};}catch(reason){return {edits:{},error:'Source edits could not be loaded: '+reason.message};}},[text]);
  const save=useCallback(edits=>{if(!key)throw new Error('A source fingerprint is required before editing.');validateSourceEdits(edits);localStorage.setItem(key,JSON.stringify(edits));window.dispatchEvent(new CustomEvent('csv-source-edits',{detail:key}));},[key]);
  return {...state,save,revision:text};
}
