// src/utils/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants';

const ACCESS_KEY = '@auth/access';
const REFRESH_KEY = '@auth/refresh';

let inMemoryAccess: string | null = null;
let inMemoryRefresh: string | null = null;
let initialized = false;

/** 앱 시작 시 1회만 호출: 스토리지 → 메모리 로드 */
export async function loadTokensIntoMemory() {
  try {
    const [a, r] = await Promise.all([
      AsyncStorage.getItem(ACCESS_KEY),
      AsyncStorage.getItem(REFRESH_KEY),
    ]);
    inMemoryAccess = a;
    inMemoryRefresh = r;
  } finally {
    initialized = true;
  }
}

/** 로그인 성공 직후 저장용 (access/refresh 둘 다) */
export async function saveLoginTokens(payload: {
  access: string;
  refresh: string;
}) {
  inMemoryAccess = payload.access;
  inMemoryRefresh = payload.refresh;
  await AsyncStorage.setItem(ACCESS_KEY, payload.access);
  await AsyncStorage.setItem(REFRESH_KEY, payload.refresh);
}

/** access만 갱신 (refresh 유지) */
export async function setAccessToken(access: string | null) {
  inMemoryAccess = access;
  if (access) await AsyncStorage.setItem(ACCESS_KEY, access);
  else await AsyncStorage.removeItem(ACCESS_KEY);
}

/** 전체 토큰 삭제 */
export async function clearTokens() {
  inMemoryAccess = null;
  inMemoryRefresh = null;
  await Promise.all([
    AsyncStorage.removeItem(ACCESS_KEY),
    AsyncStorage.removeItem(REFRESH_KEY),
  ]);
}

export function getAccessTokenSync() {
  return inMemoryAccess;
}
export function hasRefreshToken() {
  return !!inMemoryRefresh;
}

/* ===== 리프레시(싱글-플라이트) ===== */
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  if (!inMemoryRefresh) return null;

  const res = await fetch(`${API_BASE}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: inMemoryRefresh }),
  });

  if (!res.ok) {
    await clearTokens();
    return null;
  }

  const data = await res.json();
  const newAccess = typeof data?.access === 'string' ? data.access : null;
  if (!newAccess) {
    await clearTokens();
    return null;
  }
  await setAccessToken(newAccess);
  return newAccess;
}

export async function refreshAccessOnce() {
  if (!refreshing)
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/* ===== 로그인 API + 성공 처리 ===== */
export type LoginResponse = {
  success?: boolean;
  access?: string;
  refresh?: string;
  token?: string;
  username?: string;
  email?: string;
  user_id?: number | string;
  message?: string;
};

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`LOGIN ${res.status} ${t}`);
  }
  return (await res.json()) as LoginResponse;
}

export async function handleLoginSuccess(resp: LoginResponse): Promise<void> {
  const access = resp.access || resp.token || '';
  const refresh = resp.refresh || '';
  if (!access || !refresh)
    throw new Error('유효하지 않은 로그인 응답입니다.(토큰 누락)');
  await saveLoginTokens({ access, refresh });
}
