// src/utils/authFetch.ts
import { getAccessToken, refreshAccessToken } from '../api/auth'; // ✅ 경로 확인!

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const token = (await getAccessToken()) || '';
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');

  let res = await fetch(input, { ...init, headers, credentials: 'include' });

  // 401이면 토큰 갱신 시도 후 1회 재시도
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(input, { ...init, headers, credentials: 'include' });
    }
  }
  return res;
}
