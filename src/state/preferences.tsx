// src/state/preferences.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeOption = 'system' | 'light' | 'dark';

type Prefs = {
  theme: ThemeOption;
  fontScale: number; // 0.9 ~ 1.3
};

const DEFAULT: Prefs = { theme: 'system', fontScale: 1.0 };
const KEY = 'prefs:v1';

const Ctx = createContext<{
  prefs: Prefs;
  setTheme: (t: ThemeOption) => void;
  setFontScale: (n: number) => void;
} | null>(null);

export const PreferencesProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT);

  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULT, ...JSON.parse(raw) });
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(KEY, JSON.stringify(prefs));
  }, [prefs]);

  const api = useMemo(
    () => ({
      prefs,
      setTheme: (theme: ThemeOption) => setPrefs(p => ({ ...p, theme })),
      setFontScale: (fontScale: number) => setPrefs(p => ({ ...p, fontScale })),
    }),
    [prefs],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
};

export const usePreferences = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('PreferencesProvider missing');
  return v;
};
