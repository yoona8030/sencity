// src/utils/apis.ts
import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosHeaders, // ⬅️ 추가
} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { API_BASE_URL } from '@env';

// --- Base URL ---
export const API_BASE = API_BASE_URL;

// --- Axios 인스턴스 ---
export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// --- 토큰 저장/로드 유틸 ---
const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';

export async function getAccessToken() {
  return AsyncStorage.getItem(ACCESS_KEY);
}
export async function setAccessToken(t: string) {
  await AsyncStorage.setItem(ACCESS_KEY, t);
}
export async function getRefreshToken() {
  return AsyncStorage.getItem(REFRESH_KEY);
}
export async function setRefreshToken(t: string) {
  await AsyncStorage.setItem(REFRESH_KEY, t);
}

// ===== 요청 인터셉터: Authorization 부착 =====
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();
    if (token) {
      // headers 보장 후 set
      (config.headers ??= new AxiosHeaders()).set(
        'Authorization',
        `Bearer ${token}`,
      );
    }
    return config;
  },
  (err: AxiosError) => Promise.reject(err),
);

/** ==== 401 자동 리프레시 & 큐 ==== */
let refreshing = false;
let queue: Array<(t: string) => void> = [];

async function refresh(): Promise<string> {
  const rt = await getRefreshToken();
  // 서버 엔드포인트/필드명은 실제 값으로 바꾸세요.
  const { data } = await axios.post(`${API_BASE}/auth/jwt/refresh/`, {
    refresh: rt,
  });
  const newAccess = data?.access ?? data?.access_token;
  await setAccessToken(newAccess);
  return newAccess;
}

function retry(orig: InternalAxiosRequestConfig, token: string) {
  // 원본 config를 살짝 복제해서 Authorization만 교체
  const cfg: InternalAxiosRequestConfig = {
    ...orig,
    headers: new AxiosHeaders(orig.headers), // ⬅️ 타입 안전 복제
  };
  (cfg.headers as AxiosHeaders).set('Authorization', `Bearer ${token}`);
  (cfg as any).__retried = true; // 루프 방지 플래그
  return api.request(cfg);
}

api.interceptors.response.use(undefined, async (err: AxiosError) => {
  const res = err.response;
  const cfg = (err as any).config as InternalAxiosRequestConfig | undefined;
  if (!res || res.status !== 401 || !cfg || (cfg as any).__retried) {
    throw err;
  }

  // refresh 호출 자체에 대한 401은 건너뛰기
  const isRefreshCall =
    typeof cfg.url === 'string' && cfg.url.includes('/auth/jwt/refresh/');
  if (isRefreshCall) throw err;

  // 중복 갱신 방지 + 대기열 처리
  if (!refreshing) {
    refreshing = true;
    try {
      const newToken = await refresh();
      queue.forEach(fn => fn(newToken));
      queue = [];
      return retry(cfg, newToken);
    } finally {
      refreshing = false;
    }
  }

  // 다른 요청들은 리프레시가 끝날 때까지 대기했다가 재시도
  return new Promise(resolve => {
    queue.push(t => resolve(retry(cfg, t)));
  });
});
