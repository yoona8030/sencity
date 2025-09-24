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
import { jwtDecode } from 'jwt-decode';

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

export const AS = {
  access: 'accessToken',
  refresh: 'refreshToken',
  email: 'userEmail',
} as const;

const LOGIN_PATH = '/login/';
const PROFILE_PATH = '/user/profile/';
const REFRESH_PATH = '/token/refresh/';

/** AbortController 없이 타임아웃 */
async function getWithTimeout<T>(path: string, ms = 10000) {
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
async function loadRefresh() {
  return AsyncStorage.getItem(AS.refresh);
}
async function saveRefresh(t: string | null) {
  if (t) await AsyncStorage.setItem(AS.refresh, t);
  else await AsyncStorage.removeItem(AS.refresh);
}
async function clearAllAuth() {
  await AsyncStorage.multiRemove([AS.access, AS.refresh, AS.email]);
}

/** access 토큰 exp 파싱 (만료 임박 선제 갱신용, 선택) */
function parseJwtExp(token: string | null): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const payload = jwtDecode<{ exp?: number }>(token);
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  /** (선택) 만료 임박(≤60s) 시 선제 refresh */
  const ensureFreshAccess = useCallback(async () => {
    const t = await loadToken();
    const exp = parseJwtExp(t);
    if (!exp) return;
    const now = Math.floor(Date.now() / 1000);
    if (exp - now <= 60) {
      await refreshAccess(); // 실패 시 throw
      const newT = await loadToken();
      setToken(newT);
    }
  }, []);

  /** refresh 토큰으로 access 재발급 */
  const refreshAccess = useCallback(async () => {
    const r = await loadRefresh();
    if (!r) throw new Error('no refresh token');
    const res = await postJSON<any>(
      REFRESH_PATH,
      { refresh: r },
      { auth: false },
    );
    const newAccess: string | undefined = res?.access ?? res?.token;
    if (!newAccess) throw new Error('no access in refresh response');
    await saveToken(newAccess);
    if (res?.refresh) {
      // ROTATE_REFRESH_TOKENS=True인 경우 새 refresh도 저장
      await saveRefresh(res.refresh);
    }
    setToken(newAccess);
    return newAccess;
  }, []);

  /** 내 프로필 로딩 (실패해도 토큰/세션을 건드리지 않음) */
  const fetchProfileAndSet = useCallback(async () => {
    try {
      // (선택) 만료 임박 선제 갱신
      await ensureFreshAccess();

      const me = await getWithTimeout<Partial<User>>(PROFILE_PATH, 10000);
      setUser({
        id: Number(me.id ?? 0),
        email: String(me.email ?? ''),
        name: me.name ? String(me.name) : undefined,
      });
    } catch (e) {
      // 네트워크/일시장애 가능 → 여기서는 user/token을 건드리지 않음
      console.warn('fetchProfileAndSet failed:', e);
    }
  }, [ensureFreshAccess]);

  useEffect(() => {
    (async () => {
      const t = await loadToken();
      setToken(t);
      setIsReady(true); // 초기 지연 최소화

      if (t) {
        // 실패해도 세션 유지
        await fetchProfileAndSet();
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

      // 백엔드가 'access'로 내려주도록 권장. 호환 위해 token/auth_token도 체크
      const access: string | undefined =
        res?.access ?? res?.token ?? res?.auth_token;
      const refresh: string | undefined = res?.refresh;

      if (!access) throw new Error('토큰이 응답에 없습니다.');

      await AsyncStorage.setItem(AS.email, email);
      await saveToken(access);
      setToken(access);
      if (refresh) await saveRefresh(refresh);
      else console.warn('로그인 응답에 refresh 토큰이 없습니다.');

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
