import {useCallback,useMemo,useSyncExternalStore} from 'react';
import {sourceEditKey,validateSourceEdits} from '../ml/sourceEdits.js';

export function useSourceEdits(summary) {
  const key=sourceEditKey(summary),historyKey=key?key+':history':null;
  const subscribe=useCallback(listener=>{const changed=event=>{if(event.type==='storage'?event.key===key||event.key===null:event.detail===key)listener();};window.addEventListener('storage',changed);window.addEventListener('csv-source-edits',changed);return()=>{window.removeEventListener('storage',changed);window.removeEventListener('csv-source-edits',changed);};},[key]);
  const snapshot=useCallback(()=>{try{return key?localStorage.getItem(key)||'{}':'{}';}catch{return '{}';}},[key]);
  const text=useSyncExternalStore(subscribe,snapshot,()=> '{}');
  const state=useMemo(()=>{try{return {edits:validateSourceEdits(JSON.parse(text)),error:''};}catch(reason){return {edits:{},error:'Source edits could not be loaded: '+reason.message};}},[text]);
  const save=useCallback(edits=>{if(!key)throw new Error('A source fingerprint is required before editing.');validateSourceEdits(edits);const current=localStorage.getItem(key)||'{}',next=JSON.stringify(edits);if(current===next)return;let h={past:[],future:[]};try{h=JSON.parse(localStorage.getItem(historyKey)||'{"past":[],"future":[]}');}catch{}h={past:[...(h.past||[]),current].slice(-20),future:[]};localStorage.setItem(historyKey,JSON.stringify(h));localStorage.setItem(key,next);window.dispatchEvent(new CustomEvent('csv-source-edits',{detail:key}));},[key,historyKey]);
  const move=useCallback(direction=>{if(!key)return;let h;try{h=JSON.parse(localStorage.getItem(historyKey)||'{"past":[],"future":[]}');}catch{return;}const from=direction==='undo'?'past':'future',to=direction==='undo'?'future':'past';if(!h[from]?.length)return;const current=localStorage.getItem(key)||'{}',next=h[from].at(-1);h[from]=h[from].slice(0,-1);h[to]=[...(h[to]||[]),current].slice(-20);localStorage.setItem(historyKey,JSON.stringify(h));localStorage.setItem(key,next);window.dispatchEvent(new CustomEvent('csv-source-edits',{detail:key}));},[key,historyKey]);
  const history=(()=>{try{return JSON.parse(localStorage.getItem(historyKey)||'{"past":[],"future":[]}');}catch{return {past:[],future:[]};}})();
  return {...state,save,undo:()=>move('undo'),redo:()=>move('redo'),canUndo:Boolean(history.past?.length),canRedo:Boolean(history.future?.length),revision:text};
}
