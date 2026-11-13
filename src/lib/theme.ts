import { create } from 'zustand';

export type Theme = 'dark' | 'light';
const KEY = 'tactic.theme';

function read(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* storage unavailable */
  }
  return 'dark';
}

/** Dark (default) / light theme, remembered per browser. */
export const useTheme = create<{ theme: Theme; setTheme: (t: Theme) => void }>((set) => ({
  theme: read(),
  setTheme: (theme) => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* storage unavailable */
    }
    set({ theme });
  },
}));
