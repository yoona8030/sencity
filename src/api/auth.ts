// src/api/auth.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE } from '../constants';
import { jwtDecode } from 'jwt-decode';

/** 저장 키 */
const K_ACCESS = 'access_token';
const K_REFRESH = 'refresh_token';
const K_EXP = 'access_exp'; // epoch seconds

/** 메모리 캐시 */
let memAccess: string | null = null;
let memRefresh: string | null = null;
let memExp: number | null = null;
let initialized = false;

/* ---------------- 토큰 저장/로드 ---------------- */

export async function saveTokens(params: {
  access: string;
  refresh?: string | null;
  exp?: number | null; // epoch seconds
}) {
  const tasks: Promise<any>[] = [];
  if (params.access) tasks.push(AsyncStorage.setItem(K_ACCESS, params.access));
  if (typeof params.refresh !== 'undefined') {
    if (params.refresh)
      tasks.push(AsyncStorage.setItem(K_REFRESH, params.refresh));
    else tasks.push(AsyncStorage.removeItem(K_REFRESH));
  }
  if (typeof params.exp === 'number') {
    tasks.push(AsyncStorage.setItem(K_EXP, String(params.exp)));
  }
  await Promise.all(tasks);

  memAccess = params.access || null;
  if (typeof params.refresh !== 'undefined')
    memRefresh = params.refresh || null;
  if (typeof params.exp === 'number') memExp = params.exp ?? null;
}

export async function clearTokens(): Promise<void> {
  memAccess = null;
  memRefresh = null;
  memExp = null;
  await AsyncStorage.multiRemove([K_ACCESS, K_REFRESH, K_EXP]);
}

export async function loadTokensIntoMemory(): Promise<void> {
  try {
    const [a, r, e] = await Promise.all([
      AsyncStorage.getItem(K_ACCESS),
      AsyncStorage.getItem(K_REFRESH),
      AsyncStorage.getItem(K_EXP),
    ]);
    memAccess = a || null;
    memRefresh = r || null;
    memExp = e ? Number(e) : null;
  } finally {
    initialized = true;
  }
}

/** 로그인 응답을 바로 저장하는 헬퍼 (서버 포맷 대응) */
export async function handleLoginSuccess(resp: {
  access?: string;
  refresh?: string;
  token?: string; // access 대신 token으로 주는 서버 대응
}): Promise<void> {
  const access = resp.access || resp.token || '';
  const refresh = resp.refresh ?? null;
  if (!access) return;

  // exp 파싱(옵션)
  let exp: number | null = null;
  try {
    const decoded: { exp?: number } = jwtDecode(access);
    if (decoded?.exp && Number.isFinite(decoded.exp))
      exp = decoded.exp as number;
  } catch {}
  await saveTokens({ access, refresh, exp });
}

/** 액세스/리프레시/만료 — 비동기 조회 */
export async function getAccessToken(): Promise<string | null> {
  if (initialized) return memAccess;
  await loadTokensIntoMemory();
  return memAccess;
}
export async function getRefreshToken(): Promise<string | null> {
  if (initialized) return memRefresh;
  await loadTokensIntoMemory();
  return memRefresh;
}
export async function getAccessExp(): Promise<number | null> {
  if (initialized) return memExp;
  await loadTokensIntoMemory();
  return memExp;
}

/** 싱크형 */
export function getAccessTokenSync(): string | null {
  return memAccess;
}
export function hasRefreshToken(): boolean {
  return !!memRefresh;
}

/* ---------------- 액세스 토큰 갱신 ---------------- */

export async function refreshAccessToken(): Promise<string | null> {
  try {
    if (!memRefresh) return null;

    const url = `${API_BASE}/token/refresh/`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ refresh: memRefresh }),
    });

    if (!res.ok) {
      await clearTokens();
      return null;
    }

    const data = await res.json();
    const access = data.access || data.token || null;
    if (!access) {
      await clearTokens();
      return null;
    }

    let exp: number | null = null;
    try {
      const decoded: { exp?: number } = jwtDecode(access);
      if (decoded?.exp && Number.isFinite(decoded.exp))
        exp = decoded.exp as number;
    } catch {}

    await saveTokens({ access, exp });
    return access;
  } catch {
    return null;
  }
}

/* ---------------- 공용 authFetch ---------------- */

let refreshing: Promise<string | null> | null = null;
async function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = refreshAccessToken().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  if (!initialized) await loadTokensIntoMemory();

  const headers = new Headers(init.headers || {});
  if (memAccess) headers.set('Authorization', `Bearer ${memAccess}`);

  // 디버그 가드
  if (typeof input === 'string') {
    const url = input;
    if (/\/api\/reports\/(\?|$)/.test(url) && !headers.get('Authorization')) {
      console.warn(
        '[authFetch] WARNING: /api/reports/ 요청에 Authorization 미부착',
      );
    }
  }

  let res = await fetch(input, { ...init, headers });
  if (res.status !== 401) return res;

  if (!memRefresh) return res;

  const newAccess = await refreshOnce();
  if (!newAccess) return res;

  const retryHeaders = new Headers(init.headers || {});
  retryHeaders.set('Authorization', `Bearer ${newAccess}`);
  return fetch(input, { ...init, headers: retryHeaders });
}

/* ---------------- 추가: login() API ---------------- */

export type LoginResponse = {
  success?: boolean;
  access?: string;
  refresh?: string;
  username?: string;
  email?: string;
  user_id?: number;
  [k: string]: any;
};

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/login/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`LOGIN ${res.status} ${t}`);
  }
  return res.json();
}
