// src/api/client.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BASE_URL = 'http://127.0.0.1:8000/api';

const DEFAULT_TIMEOUT_MS = 1500;

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
  body?: any; // FormData | JSON
  auth?: boolean; // 기본 true
  timeoutMs?: number;
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
  const token = auth ? await getAccessToken() : null;

  const url = path.startsWith('http')
    ? path
    : `${BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

  const isFormData =
    typeof FormData !== 'undefined' && body instanceof FormData;

  const res = await fetchWithTimeout(
    url,
    {
      method,
      headers: {
        // JSON일 때만 Content-Type 지정, multipart는 RN이 boundary 포함해서 자동 세팅
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body:
        body != null ? (isFormData ? body : JSON.stringify(body)) : undefined,
    },
    timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  if (res.ok) {
    if (res.status === 204) return undefined as unknown as T;
    const text = await res.text();
    try {
      return (text ? JSON.parse(text) : null) as T;
    } catch {
      // 응답이 순수 텍스트일 수도 있음
      return text as unknown as T;
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

// ---- JSON/Multipart 헬퍼 ----
export const getJSON = <T = any>(
  path: string,
  opts: Omit<RequestOptions, 'method'> = {},
) => request<T>(path, { ...opts, method: 'GET' });

export const postJSON = <T = any>(
  path: string,
  body?: any,
  opts: Omit<RequestOptions, 'method' | 'body'> = {},
) => request<T>(path, { ...opts, method: 'POST', body });

export const postMultipart = <T = any>(
  path: string,
  form: FormData,
  opts: Omit<RequestOptions, 'method' | 'body'> = {},
) =>
  // 업로드는 타임아웃을 넉넉히
  request<T>(path, { ...opts, method: 'POST', body: form, timeoutMs: 15000 });
