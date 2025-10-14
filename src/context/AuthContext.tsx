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
import { getJSON } from '../api/client';
import { sendEvent } from '../utils/metrics';

// ✅ 토큰/로그인 관련은 전부 api/auth로 단일화
import {
  login,                   // 서버 로그인 요청
  handleLoginSuccess,      // 로그인 응답(access/refresh) 저장 (메모리+스토리지)
  loadTokensIntoMemory,    // 앱 시작 시 스토리지 → 메모리 로드
  getAccessTokenSync,      // 현재 메모리 access 조회
  refreshAccessToken,      // 만료 임박/401 대응용
  clearTokens as clearAllTokens, // 로그아웃 시 토큰 삭제
} from '../api/auth';

type User = { id: number; email: string; name?: string };

type AuthContextType = {
  isReady: boolean;
  user: User | null;
  token: string | null; // 메모리 access 토큰 스냅샷(읽기 전용 느낌)
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

// 이메일 remember 용 키(토큰 아님)
const K_SAVED_EMAIL = 'savedEmail';

// 백엔드 엔드포인트 (고정)
// NOTE: 프로필 엔드포인트는 서버에 맞춰 조정하세요.
const PROFILE_PATH = '/user/profile/';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null); // getAccessTokenSync 스냅샷

  /** 액세스 토큰 만료 임박 시 선제 갱신 (선택) */
  const ensureFreshAccess = useCallback(async () => {
    // api/auth가 내부에서 exp를 관리하므로, 단순 호출만: 실패해도 무시
    const newAcc = await refreshAccessToken().catch(() => null);
    if (newAcc) setToken(newAcc);
  }, []);

  /** 내 프로필 가져와 상태 반영 (실패해도 세션은 유지) */
  const fetchProfileAndSet = useCallback(async () => {
    try {
      await ensureFreshAccess(); // (선택) 선제 갱신
      const me = await getJSON<Partial<User>>(PROFILE_PATH); // 내부에서 authFetch 사용
      setUser({
        id: Number(me.id ?? 0),
        email: String(me.email ?? ''),
        name: me.name ? String(me.name) : undefined,
      });
    } catch (e) {
      console.warn('fetchProfileAndSet failed:', e);
    }
  }, [ensureFreshAccess]);

  // 앱 시작 시: 스토리지 → 메모리 로드 후 토큰 스냅샷 세팅, 프로필 시도
  useEffect(() => {
    (async () => {
      try {
        await loadTokensIntoMemory();
        const acc = getAccessTokenSync();
        setToken(acc ?? null);
        setIsReady(true);
        if (acc) {
          await fetchProfileAndSet(); // 실패해도 세션 유지
        } else {
          setUser(null);
        }
      } catch (e) {
        setIsReady(true);
        console.warn('Auth boot init failed:', e);
      }
    })();
  }, [fetchProfileAndSet]);

  /** 로그인: 서버 로그인 → 토큰 저장 → 이벤트 → 프로필 로드 */
  const signIn = useCallback(
    async (email: string, password: string) => {
      // 1) 서버 로그인
      const resp = await login(email, password); // { access, refresh, ... }
      // 2) 토큰 저장(메모리+스토리지)
      await handleLoginSuccess(resp);
      const acc = getAccessTokenSync();
      setToken(acc ?? null);

      // 3) 로깅(이벤트)
      await sendEvent('login').catch(() => {});

      // 4) 프로필 갱신 (실패해도 세션 유지)
      fetchProfileAndSet().catch(() => {});
    },
    [fetchProfileAndSet],
  );

  /** 로그아웃: 토큰/상태 정리 */
  const signOut = useCallback(async () => {
    await clearAllTokens(); // api/auth에서 access/refresh/exp 제거
    setToken(null);
    setUser(null);
    // 이메일 remember는 사용자 선택이므로 지우지 않음.
  }, []);

  /** 수동 프로필 새로고침 */
  const refreshProfile = useCallback(async () => {
    if (!getAccessTokenSync()) return;
    await fetchProfileAndSet();
  }, [fetchProfileAndSet]);

  const value = useMemo(
    () => ({ isReady, user, token, signIn, signOut, refreshProfile }),
    [isReady, user, token, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
