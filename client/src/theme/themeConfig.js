import { createContext } from 'react';

export const THEMES = [
  { id: 'midnight', label: 'Midnight' },
  { id: 'slate', label: 'Calm Slate' },
  { id: 'forest', label: 'Sage Forest' },
  { id: 'paper', label: 'Soft Paper' },
];
export const THEME_STORAGE_KEY = 'neuroforge-theme-v1';
export const ThemeContext = createContext(null);
