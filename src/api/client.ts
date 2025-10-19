// src/api/client.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { jwtDecode } from 'jwt-decode';

export const BASE_URL = 'http://127.0.0.1:8000/api';

const DEFAULT_TIMEOUT_MS = 8000; // 업로드 제외 일반 요청 타임아웃(현실화)
const REFRESH_PATH = '/token/refresh/';

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

/* ---------------- Token helpers ---------------- */
async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(AS.access);
}
async function setAccessToken(t: string) {
  await AsyncStorage.setItem(AS.access, t);
}
async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(AS.refresh);
}
async function setRefreshToken(t: string) {
  await AsyncStorage.setItem(AS.refresh, t);
}
async function clearTokens() {
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
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
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

/* ---------------- JWT exp 파싱 & 선제 갱신 ---------------- */
function parseJwtExp(token: string | null): number | null {
  if (!token) return null;
  try {
    const payload = jwtDecode<{ exp?: number }>(token);
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

async function ensureFreshAccess() {
  const access = await getAccessToken();
  const exp = parseJwtExp(access);
  if (!exp) return;
  const now = Math.floor(Date.now() / 1000);
  // 만료 60초 전이면 미리 갱신
  if (exp - now <= 60) {
    await refreshOnce(); // 실패 시 throw → 상위에서 처리
  }
}

/* ---------------- Refresh 1회 시도 ---------------- */
async function refreshOnce() {
  const refresh = await getRefreshToken();
  if (!refresh) throw new ApiError('no refresh token', 401, { logout: true });

  const url = `${BASE_URL}${REFRESH_PATH}`;
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ refresh }),
    },
    DEFAULT_TIMEOUT_MS,
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    let data: any = null;
    try {
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
  if (data?.refresh) {
    // ROTATE_REFRESH_TOKENS=True이면 새 refresh도 저장
    await setRefreshToken(data.refresh);
  }
  return newAccess;
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
  const url = path.startsWith('http')
    ? path
    : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData;

  // 1) (인증 요청이면) 만료 임박 시 선제 갱신
  if (auth) {
    try {
      await ensureFreshAccess();
    } catch (e) {
      // 선제 갱신이 실패해도, 아래 본요청에서 401 재시도로 한 번 더 시도
    }
  }

  const access = auth ? await getAccessToken() : null;

  // 2) 1차 요청
  let res = await fetchWithTimeout(
    url,
    {
      method,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Accept: 'application/json',
        ...(access ? { Authorization: `Bearer ${access}` } : {}),
        ...headers,
      },
      body:
        body != null ? (isFormData ? body : JSON.stringify(body)) : undefined,
    },
    timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  // 3) 401이면 refresh 1회 → 재시도
  if (auth && res.status === 401) {
    try {
      await refreshOnce();
      const access2 = await getAccessToken();
      res = await fetchWithTimeout(
        url,
        {
          method,
          headers: {
            ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
            Accept: 'application/json',
            ...(access2 ? { Authorization: `Bearer ${access2}` } : {}),
            ...headers,
          },
          body:
            body != null
              ? isFormData
                ? body
                : JSON.stringify(body)
              : undefined,
        },
        timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
    } catch (e) {
      // 갱신 실패 → 토큰 정리 + 로그아웃 플래그
      await clearTokens();
      throw new ApiError('세션이 만료되었습니다. 다시 로그인해주세요.', 401, {
        logout: true,
        raw: e,
      });
    }
  }

  // 4) 결과 처리
  if (res.ok) {
    if (res.status === 204) return undefined as unknown as T;
    const text = await res.text();
    try {
      return (text ? JSON.parse(text) : null) as T;
    } catch {
      return text as unknown as T; // 응답이 텍스트인 경우
    }
  }

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
  // 업로드는 타임아웃을 넉넉히
  request<T>(path, { ...opts, method: 'POST', body: form, timeoutMs: 15000 });
