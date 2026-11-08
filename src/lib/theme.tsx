import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';

// Light / dark / system theme. index.html applies the saved theme before the first
// paint; this keeps <html class="dark"> in sync afterwards.
export type Theme = 'light' | 'dark' | 'system';
type Ctx = { theme: Theme; resolvedTheme: 'light' | 'dark'; setTheme: (t: Theme) => void };

const ThemeContext = createContext<Ctx>({ theme: 'system', resolvedTheme: 'light', setTheme: () => {} });
export const useTheme = () => useContext(ThemeContext);

const STORAGE_KEY = 'sqlpg.theme';
const query = () => window.matchMedia('(prefers-color-scheme: dark)');

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const t = localStorage.getItem(STORAGE_KEY);
      return t === 'light' || t === 'dark' ? t : 'system';
    } catch {
      return 'system';
    }
  });
  const [systemDark, setSystemDark] = useState(() => query().matches);
  useEffect(() => {
    const mq = query();
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  useLayoutEffect(() => {
    // switch without animating every colour transition on the page
    const style = document.createElement('style');
    style.textContent = '*,*::before,*::after{transition:none!important}';
    document.head.appendChild(style);
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    document.documentElement.style.colorScheme = resolvedTheme;
    void getComputedStyle(document.body).opacity;
    const t = setTimeout(() => style.remove(), 1);
    return () => clearTimeout(t);
  }, [resolvedTheme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      if (t === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
