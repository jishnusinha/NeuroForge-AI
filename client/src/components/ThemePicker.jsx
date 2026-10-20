import React, { useId } from 'react';
import { Palette } from 'lucide-react';
import { THEMES } from '../theme/themeConfig.js';
import { useTheme } from '../theme/useTheme.js';

export default function ThemePicker({ compact = false }) {
  const { theme, setTheme } = useTheme();
  const controlId = useId();

  return (
    <div className={compact ? 'flex items-center' : 'hidden lg:block border-t border-white/10 px-3 py-2'}>
      <label
        htmlFor={controlId}
        className={compact ? 'sr-only' : 'mb-2 flex items-center gap-2 text-xs font-medium text-text-muted'}
      >
        {!compact && <Palette size={15} />}
        Appearance
      </label>
      <select
        id={controlId}
        aria-label="Visual theme"
        value={theme}
        onChange={event => setTheme(event.target.value)}
        title="Choose workspace appearance"
        className={compact
          ? 'max-w-[120px] rounded-lg border border-white/10 bg-obsidian px-2 py-2 text-xs text-text-primary'
          : 'w-full rounded-lg border border-white/10 bg-obsidian p-2 text-sm text-text-primary'}
      >
        {THEMES.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </div>
  );
}
