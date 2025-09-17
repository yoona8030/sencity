// src/context/AuthContext.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getJSON, postJSON } from '../api/client';

type User = { id: number; email: string; name?: string };

type AuthContextType = {
  isReady: boolean;
  user: User | null;
  token: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  isReady: false,
  user: null,
  token: null,
  signIn: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

const AS = {
  access: 'accessToken',
  refresh: 'refreshToken',
  email: 'userEmail',
} as const;

const LOGIN_PATH = '/login/';
const PROFILE_PATH = '/user/profile/';

// ✅ AbortController 없이 타임아웃
async function getWithTimeout<T>(path: string, ms = 4000) {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('GET timeout')), ms),
  );
  return Promise.race([getJSON<T>(path), timeout]) as Promise<T>;
}

async function loadToken() {
  return AsyncStorage.getItem(AS.access);
}
async function saveToken(t: string | null) {
  if (t) await AsyncStorage.setItem(AS.access, t);
  else await AsyncStorage.removeItem(AS.access);
}
async function clearAllAuth() {
  await AsyncStorage.multiRemove([AS.access, AS.refresh, AS.email]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const fetchProfileAndSet = useCallback(async () => {
    try {
      const me = await getWithTimeout<Partial<User>>(PROFILE_PATH, 4000);
      setUser({
        id: Number(me.id ?? 0),
        email: String(me.email ?? ''),
        name: me.name ? String(me.name) : undefined,
      });
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      setToken(t);
      setIsReady(true); // 초기 지연 최소화

      if (t) {
        try {
          await fetchProfileAndSet();
        } catch {
          await clearAllAuth();
          setToken(null);
          setUser(null);
        }
      } else {
        setUser(null);
      }
    })();
  }, [fetchProfileAndSet]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const res = await postJSON<any>(
        LOGIN_PATH,
        { email, password },
        { auth: false },
      );
      const access: string | undefined =
        res?.access ?? res?.token ?? res?.auth_token;
      if (!access) throw new Error('토큰이 응답에 없습니다.');

      await AsyncStorage.setItem(AS.email, email);
      await saveToken(access);
      setToken(access);

      fetchProfileAndSet().catch(() => {});
    },
    [fetchProfileAndSet],
  );

  const signOut = useCallback(async () => {
    await clearAllAuth();
    setToken(null);
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!token) return;
    await fetchProfileAndSet();
  }, [token, fetchProfileAndSet]);

  const value = useMemo(
    () => ({ isReady, user, token, signIn, signOut, refreshProfile }),
    [isReady, user, token, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
