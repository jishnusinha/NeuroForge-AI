import { useContext } from 'react';
import { ThemeContext } from './themeConfig.js';

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('ThemeProvider required');
  return context;
}
