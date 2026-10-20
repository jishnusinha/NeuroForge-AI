import React from 'react';
import { Palette } from 'lucide-react';
import { THEMES } from '../theme/themeConfig.js';
import { useTheme } from '../theme/useTheme.js';
export default function ThemePicker(){
 const {theme,setTheme}=useTheme();
 return <div className="px-3 py-2 border-t border-white/10 hidden lg:block">
  <label htmlFor="nf-theme" className="flex items-center gap-2 mb-2 text-xs font-medium text-text-muted"><Palette size={15}/> Appearance</label>
  <select id="nf-theme" aria-label="Visual theme" value={theme} onChange={event=>setTheme(event.target.value)}
   className="w-full rounded-lg border border-white/10 bg-obsidian p-2 text-sm text-text-primary">
   {THEMES.map(item=><option key={item.id} value={item.id}>{item.label}</option>)}
  </select>
 </div>;
}
