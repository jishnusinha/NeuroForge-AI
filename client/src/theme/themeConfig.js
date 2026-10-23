import { createContext } from 'react';

// Stable IDs retain existing preferences while each theme declares its mode.
export const THEMES = Object.freeze([
 {id:'midnight',label:'Midnight',mode:'dark',swatches:['#080d18','#151e30','#46d7f2','#a78bfa']},
 {id:'slate',label:'Calm Slate',mode:'dark',swatches:['#141b26','#202b38','#8cc9e8','#b6a6e5']},
 {id:'forest',label:'Sage Forest',mode:'dark',swatches:['#101c1b','#1a302d','#8bd9be','#b8cda6']},
 {id:'paper',label:'Soft Paper',mode:'light',swatches:['#f3f5f4','#ffffff','#176b7b','#655aa0']},
 {id:'glacier',label:'Glacier',mode:'light',swatches:['#edf5f8','#ffffff','#176b8a','#557d9d']},
 {id:'dusk',label:'Indigo Dusk',mode:'dark',swatches:['#17152b','#24213f','#9aa7ff','#d0a6ec']},
 {id:'ocean',label:'Ocean Ink',mode:'dark',swatches:['#071d28','#103343','#50c7cf','#7bbbd3']},
 {id:'sand',label:'Desert Sand',mode:'light',swatches:['#f6f0e5','#fffdf8','#82511d','#4f6972']},
 {id:'rose',label:'Rose Quartz',mode:'light',swatches:['#f8eff2','#fffafd','#944b68','#63548b']},
 {id:'contrast',label:'High Contrast',mode:'dark',swatches:['#000000','#121212','#ffff00','#00ffff']},
]);
export const THEME_STORAGE_KEY = 'neuroforge-theme-v1';
export const ThemeContext = createContext(null);
