import React, { createContext, useContext, useEffect, useState } from 'react';
export const THEMES = [
 { id:'midnight',label:'Midnight' },
 { id:'slate',label:'Calm Slate' },
 { id:'forest',label:'Sage Forest' },
 { id:'paper',label:'Soft Paper' }
];
const Context=createContext(null);
const KEY='neuroforge-theme-v1';
const valid=value=>THEMES.some(item=>item.id===value);
export function ThemeProvider({children}){
 const [theme,setTheme]=useState(()=>{
  try{const stored=localStorage.getItem(KEY);return valid(stored)?stored:'midnight';}
  catch{return 'midnight';}
 });
 useEffect(()=>{
  document.documentElement.dataset.theme=theme;
  document.documentElement.style.colorScheme=theme==='paper'?'light':'dark';
  try{localStorage.setItem(KEY,theme);}catch{/* Storage may be disabled. */}
 },[theme]);
 return <Context.Provider value={{theme,setTheme}}>{children}</Context.Provider>;
}
export function useTheme(){const context=useContext(Context);if(!context)throw new Error('ThemeProvider required');return context;}
