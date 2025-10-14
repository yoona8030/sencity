// src/utils/auth.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

// ⚠️ 환경에 맞춰 조정
export const API_BASE = 'http://127.0.0.1:8000/api';
// 예) 실제 기기 + 같은 Wi-Fi: "http://192.168.45.122:8000/api"

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

/** 전체 토큰 삭제(로그아웃/리프레시 실패 시) */
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
export function getRefreshTokenSync() {
  return inMemoryRefresh;
}
export function hasRefreshToken() {
  return !!inMemoryRefresh;
}

/* ==================== 리프레시 (싱글-플라이트) ==================== */
let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
  if (!inMemoryRefresh) return null;

  const res = await fetch(`${API_BASE}/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: inMemoryRefresh }),
  });

  if (!res.ok) {
    await clearTokens(); // 리프레시 실패 → 모두 폐기
    return null;
  }

  const data = await res.json();
  const newAccess = typeof data?.access === 'string' ? data.access : null;
  if (!newAccess) {
    await clearTokens();
    return null;
  }
  await setAccessToken(newAccess); // refresh 유지
  return newAccess;
}

async function refreshOnce(): Promise<string | null> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

/* ==================== 공용 authFetch ====================
   - Authorization 자동 부착
   - 401이면 1회 리프레시 후 재시도
   - RN에서 FormData 보낼 땐 Content-Type 직접 지정하지 말 것
========================================================= */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  // (안전망) 초기화 안 됐으면 스토리지 로드
  if (!initialized) {
    await loadTokensIntoMemory();
  }

  const headers = new Headers(init.headers || {});
  const token = inMemoryAccess;
  if (token) headers.set('Authorization', `Bearer ${token}`);

  // 디버그: 신고 API 호출 시 Authorization 빠짐을 콘솔에 경고
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

  // 401 → 리프레시 토큰 없으면 그대로 반환
  if (!inMemoryRefresh) return res;

  const newAccess = await refreshOnce();
  if (!newAccess) return res;

  // 새 토큰으로 재시도 (1회)
  const retryHeaders = new Headers(init.headers || {});
  retryHeaders.set('Authorization', `Bearer ${newAccess}`);
  return fetch(input, { ...init, headers: retryHeaders });
}
