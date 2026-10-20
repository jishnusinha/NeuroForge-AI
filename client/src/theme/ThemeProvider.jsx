import React, { useEffect, useState } from 'react';
import { ThemeContext, THEMES, THEME_STORAGE_KEY } from './themeConfig.js';
const valid=value=>THEMES.some(item=>item.id===value);
export function ThemeProvider({children}){
 const [theme,setTheme]=useState(()=>{
  try{const stored=localStorage.getItem(THEME_STORAGE_KEY);return valid(stored)?stored:'midnight';}
  catch{return 'midnight';}
 });
 useEffect(()=>{
  document.documentElement.dataset.theme=theme;
  document.documentElement.style.colorScheme=theme==='paper'?'light':'dark';
  try{localStorage.setItem(THEME_STORAGE_KEY,theme);}catch{/* Storage may be disabled. */}
 },[theme]);
 return <ThemeContext.Provider value={{theme,setTheme}}>{children}</ThemeContext.Provider>;
}
