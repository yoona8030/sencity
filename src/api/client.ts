// src/api/client.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';
import { jwtDecode } from 'jwt-decode';

export const BASE_URL: string =
  (API_BASE_URL as string) || 'http://127.0.0.1:8000/api';

// ▶ 기본 타임아웃(요약/통계 안정성 위해 30s)
const DEFAULT_TIMEOUT_MS = 30000;

const REFRESH_PATH_MAIN = '/token/refresh/';
const REFRESH_PATH_ALIAS = '/auth/jwt/refresh/';

const AS = {
  access: 'accessToken',
  refresh: 'refreshToken',
  email: 'userEmail',
} as const;

export class ApiError extends Error {
  status?: number;
  logout?: boolean;
  raw?: any;
  constructor(
    message: string,
    status?: number,
    opts?: { logout?: boolean; raw?: any },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.logout = opts?.logout;
    this.raw = opts?.raw;
  }
}

/* ---------------- Utilities ---------------- */
function joinUrl(base: string, path: string): string {
  if (!path) return base;
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

/* ---------------- Token helpers ---------------- */
export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(AS.access);
}
export async function setAccessToken(t: string): Promise<void> {
  await AsyncStorage.setItem(AS.access, t);
}
export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(AS.refresh);
}
export async function setRefreshToken(t: string): Promise<void> {
  await AsyncStorage.setItem(AS.refresh, t);
}
export async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([AS.access, AS.refresh, AS.email]);
}

/* ---------------- Timeouts ---------------- */
type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any; // FormData | JSON
  auth?: boolean; // 기본 true
  timeoutMs?: number; // 기본 DEFAULT_TIMEOUT_MS
};

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  console.log(
    '[request→]',
    init?.method || 'GET',
    url,
    'timeoutMs=',
    timeoutMs,
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiError(`요청 시간 초과 (${timeoutMs}ms)`, 0);
    }
    throw new ApiError(
      '서버에 연결할 수 없습니다. 네트워크/서버 주소를 확인해주세요.',
      0,
      { raw: err },
    );
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- JWT exp & 선제 갱신 ---------------- */
function parseJwtExp(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = jwtDecode<{ exp?: number }>(token);
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

async function ensureFreshAccess(): Promise<void> {
  const access = await getAccessToken();
  const exp = parseJwtExp(access);
  if (!exp) return;
  const now = Math.floor(Date.now() / 1000);
  if (exp - now <= 60) {
    await refreshOnce(); // 실패는 상위 요청에서 다시 처리
  }
}

/* ---------------- Refresh 중복 방지 락 ---------------- */
let refreshing = false;
let refreshWaiters: Array<() => void> = [];

async function runWithRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (refreshing) {
    await new Promise<void>(resolve => {
      refreshWaiters.push(resolve);
    });
    return fn();
  }
  refreshing = true;
  try {
    const out = await fn();
    return out;
  } finally {
    refreshing = false;
    refreshWaiters.forEach(f => f());
    refreshWaiters = [];
  }
}

/* ---------------- Refresh 1회 시도 ---------------- */
async function refreshOnce(): Promise<string> {
  return runWithRefreshLock(async () => {
    const refresh = await getRefreshToken();
    if (!refresh) throw new ApiError('no refresh token', 401, { logout: true });

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    // 표준 경로
    let url = joinUrl(BASE_URL, REFRESH_PATH_MAIN);
    let res = await fetchWithTimeout(
      url,
      { method: 'POST', headers, body: JSON.stringify({ refresh }) },
      DEFAULT_TIMEOUT_MS,
    );

    // 별칭 경로 1회 대체
    if (res.status === 404) {
      url = joinUrl(BASE_URL, REFRESH_PATH_ALIAS);
      res = await fetchWithTimeout(
        url,
        { method: 'POST', headers, body: JSON.stringify({ refresh }) },
        DEFAULT_TIMEOUT_MS,
      );
    }

    if (!res.ok) {
      let data: any = null;
      try {
        const txt = await res.text();
        data = txt ? JSON.parse(txt) : null;
      } catch {}
      throw new ApiError(`refresh failed (HTTP ${res.status})`, res.status, {
        raw: data,
        logout: true,
      });
    }

    const data = await res.json();
    const newAccess: string | undefined = data?.access ?? data?.token;
    if (!newAccess) {
      throw new ApiError('no access in refresh response', 401, {
        logout: true,
        raw: data,
      });
    }
    await setAccessToken(newAccess);
    if (data?.refresh) await setRefreshToken(data.refresh); // 회전 대응

    return newAccess;
  });
}

/* ---------------- 공통 요청 함수 ---------------- */
export async function request<T = any>(
  path: string,
  {
    method = 'GET',
    headers = {},
    body,
    auth = true,
    timeoutMs,
  }: RequestOptions = {},
): Promise<T> {
  const url = path.startsWith('http') ? path : joinUrl(BASE_URL, path);
  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData;

  if (auth) {
    try {
      await ensureFreshAccess();
    } catch {
      // 본 요청에서 401 시 재시도 함
    }
  }

  const makeInit = (access?: string | null): RequestInit => ({
    method,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      Accept: 'application/json',
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
      ...headers,
    },
    body: body != null ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  let access = auth ? await getAccessToken() : null;

  // 1차 호출
  let res = await fetchWithTimeout(
    url,
    makeInit(access),
    timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  // 401 → refresh 1회 후 재시도
  if (auth && res.status === 401) {
    try {
      await refreshOnce();
      access = await getAccessToken();
      res = await fetchWithTimeout(
        url,
        makeInit(access),
        timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
    } catch (e) {
      await clearTokens();
      throw new ApiError('세션이 만료되었습니다. 다시 로그인해주세요.', 401, {
        logout: true,
        raw: e,
      });
    }
  }

  // 성공 처리
  if (res.ok) {
    if (res.status === 204) return undefined as unknown as T;
    const text = await res.text();
    try {
      return (text ? JSON.parse(text) : null) as T;
    } catch {
      return text as unknown as T; // 텍스트 응답 호환
    }
  }

  // 에러 처리
  let server: any = null;
  try {
    const txt = await res.text();
    server = txt ? JSON.parse(txt) : null;
  } catch {}

  const serverMsg =
    server?.detail ||
    server?.message ||
    (typeof server === 'string' ? server : '') ||
    `요청에 실패했습니다. (HTTP ${res.status})`;

  if (res.status === 401) {
    await clearTokens();
    throw new ApiError('세션이 만료되었습니다. 다시 로그인해주세요.', 401, {
      logout: true,
      raw: server,
    });
  }

  throw new ApiError(serverMsg, res.status, { raw: server });
}

/* ---------------- JSON/Multipart helpers ---------------- */
export const getJSON = <T = any>(
  path: string,
  opts: Omit<RequestOptions, 'method'> = {},
) => request<T>(path, { ...opts, method: 'GET' });

export const postJSON = <T = any>(
  path: string,
  body?: any,
  opts: Omit<RequestOptions, 'method' | 'body'> = {},
) => request<T>(path, { ...opts, method: 'POST', body });

export const putJSON = <T = any>(
  path: string,
  body?: any,
  opts: Omit<RequestOptions, 'method' | 'body'> = {},
) => request<T>(path, { ...opts, method: 'PUT', body });

export const patchJSON = <T = any>(
  path: string,
  body?: any,
  opts: Omit<RequestOptions, 'method' | 'body'> = {},
) => request<T>(path, { ...opts, method: 'PATCH', body });

export const delJSON = <T = any>(
  path: string,
  opts: Omit<RequestOptions, 'method'> = {},
) => request<T>(path, { ...opts, method: 'DELETE' });

export const postMultipart = <T = any>(
  path: string,
  form: FormData,
  opts: Omit<RequestOptions, 'method' | 'body'> = {},
) =>
  request<T>(path, {
    ...opts,
    method: 'POST',
    body: form,
    timeoutMs: 15000, // 업로드만 별도 15s
  });
