// src/api/client.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'http://127.0.0.1:8000/api';

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

async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem('accessToken');
}

async function clearTokens() {
  await AsyncStorage.multiRemove(['accessToken', 'refreshToken', 'userEmail']);
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  auth?: boolean; // 기본 true
};

export async function request<T = any>(
  path: string,
  { method = 'GET', headers = {}, body, auth = true }: RequestOptions = {},
): Promise<T> {
  const token = auth ? await getAccessToken() : null;

  const res = await fetch(
    path.startsWith('http')
      ? path
      : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`,
    {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body != null ? JSON.stringify(body) : undefined,
    },
  );

  // OK
  if (res.ok) {
    // 204 No Content
    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
  }

  // 에러 본문 파싱 시도
  let server;
  try {
    const txt = await res.text();
    server = txt ? JSON.parse(txt) : null;
  } catch {
    server = null;
  }

  // 메시지 우선순위
  const serverMsg =
    server?.detail ||
    server?.message ||
    (typeof server === 'string' ? server : '') ||
    `요청에 실패했습니다. (HTTP ${res.status})`;

  // 401: 토큰 만료 → 토큰 삭제 후 logout 플래그 포함한 에러 던짐
  if (res.status === 401) {
    await clearTokens();
    throw new ApiError('세션이 만료되었습니다. 다시 로그인해주세요.', 401, {
      logout: true,
      raw: server,
    });
  }

  // 그 외 상태코드
  throw new ApiError(serverMsg, res.status, { raw: server });
}

export const getJSON = <T = any>(
  path: string,
  opts: Omit<RequestOptions, 'method'> = {},
) => request<T>(path, { ...opts, method: 'GET' });

export const postJSON = <T = any>(
  path: string,
  body?: any,
  opts: Omit<RequestOptions, 'method' | 'body'> = {},
) => request<T>(path, { ...opts, method: 'POST', body });
