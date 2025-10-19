// src/utils/fcm.ts
import { Platform, AppState, AppStateStatus } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';

const RAW_API: string = (API_BASE_URL as any) || 'http://127.0.0.1:8000/api';
const API = RAW_API;

const CACHE_KEY = '@fcm.token.last';

/** 가벼운 타임아웃 fetch */
async function safeFetch(url: string, init: RequestInit, ms = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * FCM 디바이스 토큰을 서버에 업서트
 * - 엔드포인트: POST {API}/devices/register-fcm/
 * - 바디: { token: string, platform: 'android' | 'ios' }
 * - Authorization: Bearer {accessToken} (로그인 상태면)
 */
export async function registerFcmTokenToServer() {
  // 1) 토큰 취득
  const token = await messaging().getToken();
  if (__DEV__) console.log('[FCM] device token =', token);
  if (!token) return;

  // 2) 동일 토큰이면 업로드 스킵(간단 캐시)
  const last = await AsyncStorage.getItem(CACHE_KEY);
  if (last === token) return token;

  // 3) 헤더 구성(로그인 시 Authorization 포함)
  const access = await AsyncStorage.getItem('accessToken');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (access) headers.Authorization = `Bearer ${access}`;

  // 4) 서버 업서트 호출
  try {
    const endpoint = `${API}/devices/`;
    const res = await safeFetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token,
        platform: Platform.OS, // 'android' | 'ios'
      }),
    });
    if (res?.ok) {
      await AsyncStorage.setItem(CACHE_KEY, token);
      if (__DEV__) console.log('[FCM] token registered to server');
    } else if (__DEV__) {
      console.warn('[FCM] register-fcm non-OK:', res?.status);
    }
  } catch (e) {
    // 네트워크/타임아웃은 조용히 무시 → 다음 실행/토큰 갱신 때 재시도
    if (__DEV__) console.warn('[FCM] register-fcm failed:', e);
  }

  return token;
}

/** FCM 토큰 갱신 리스너(앱 생애주기 동안 1회 attach) */
export function attachFcmTokenRefreshListener() {
  return messaging().onTokenRefresh(async () => {
    try {
      if (__DEV__) console.log('[FCM] onTokenRefresh -> re-register');
      await registerFcmTokenToServer();
    } catch {
      /* 무시 */
    }
  });
}

/** 앱이 active 될 때도 최신 토큰이 서버에 반영되도록 보장 */
export async function ensureFcmTokenFreshOnResume() {
  try {
    await registerFcmTokenToServer();
  } catch {
    /* 무시 */
  }
}

/** AppState 감시를 붙여 active 전환마다 ensure 호출 */
export function watchAppStateForFcm(): () => void {
  const handler = (state: AppStateStatus) => {
    if (state === 'active') ensureFcmTokenFreshOnResume();
  };
  const sub = AppState.addEventListener('change', handler);
  return () => sub.remove();
}

/** 강제 재발급: 토큰 삭제 → 새 토큰 발급 → 서버 업서트 */
export async function forceRefreshFcmTokenAndRegister() {
  try {
    if (__DEV__) console.log('[FCM] force refresh: deleteToken → getToken');
    await messaging().deleteToken(); // 기존 토큰 폐기
    await AsyncStorage.removeItem(CACHE_KEY); // 캐시도 무효화
    // 일부 기기에서 getToken 직후 null 가능 → 재시도 보호
    let token = await messaging().getToken();
    if (!token) {
      // 짧은 backoff 후 한 번 더
      await new Promise(r => setTimeout(r, 500));
      token = await messaging().getToken();
    }
    await registerFcmTokenToServer();
    return token;
  } catch (e) {
    if (__DEV__)
      console.warn('[FCM] forceRefreshFcmTokenAndRegister failed:', e);
  }
}

/** (선택) 로그아웃 시 캐시 정리용 */
export async function clearCachedFcmToken() {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {}
}
