// src/utils/metrics.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { Platform } from 'react-native';
import { API_BASE_URL } from '@env';

const API: string =
  (API_BASE_URL as any) ||
  'https://dramaturgic-moneyed-cecelia.ngrok-free.dev/api';
const METRICS_URL = `${API}/metrics/events/`;
const DEFAULT_TIMEOUT_MS = 8000;

// ─────────────────────────────────────────────────────────────
// 내부 공용 fetch (타임아웃)
// ─────────────────────────────────────────────────────────────
async function safeFetch(
  url: string,
  init: RequestInit,
  ms = DEFAULT_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

type EventMeta = Record<string, any> | undefined;

async function getDeviceContext() {
  // 일부 단말/환경에서 API가 동기/비동기 차이를 보일 수 있어 try-catch
  let device_id = 'unknown';
  try {
    device_id = await DeviceInfo.getUniqueId();
  } catch {}
  let app_version = '0';
  let build_number = '';
  try {
    app_version = DeviceInfo.getVersion?.() ?? '0';
    build_number = DeviceInfo.getBuildNumber?.() ?? '';
  } catch {}
  const platform = Platform.OS; // 'android' | 'ios'
  return { device_id, app_version, build_number, platform };
}

// ─────────────────────────────────────────────────────────────
// 서버 스키마가 다를 수 있으므로 3가지 포맷을 순차 재시도
// v1: { event_type, device_id, ts, meta }
// v2: { client, events: [{ name, properties, ts }] }
// v3: { event, props, timestamp, device_id }
// ─────────────────────────────────────────────────────────────
export async function sendEvent(event_type: string, meta?: EventMeta) {
  try {
    const token = await AsyncStorage.getItem('accessToken');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const ts = new Date().toISOString();
    const ctx = await getDeviceContext();

    // v1
    const body_v1 = {
      event_type,
      device_id: ctx.device_id,
      ts,
      meta: {
        platform: ctx.platform,
        app_version: ctx.app_version,
        build_number: ctx.build_number,
        ...(meta || {}),
      },
    };

    let res = await safeFetch(
      METRICS_URL,
      { method: 'POST', headers, body: JSON.stringify(body_v1) },
      DEFAULT_TIMEOUT_MS,
    );
    if (res.ok) return;

    // v2
    const body_v2 = {
      client: 'mobile',
      events: [
        {
          name: event_type,
          properties: {
            platform: ctx.platform,
            app_version: ctx.app_version,
            build_number: ctx.build_number,
            device_id: ctx.device_id,
            ...(meta || {}),
          },
          ts,
        },
      ],
    };

    res = await safeFetch(
      METRICS_URL,
      { method: 'POST', headers, body: JSON.stringify(body_v2) },
      DEFAULT_TIMEOUT_MS,
    );
    if (res.ok) return;

    // v3
    const body_v3 = {
      event: event_type,
      props: {
        platform: ctx.platform,
        app_version: ctx.app_version,
        build_number: ctx.build_number,
        ...(meta || {}),
      },
      timestamp: ts,
      device_id: ctx.device_id,
    };

    res = await safeFetch(
      METRICS_URL,
      { method: 'POST', headers, body: JSON.stringify(body_v3) },
      DEFAULT_TIMEOUT_MS,
    );
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.log(
        '[metrics] all formats failed:',
        res.status,
        t || '(no body)',
      );
    }
  } catch {
    // 네트워크/타임아웃/권한 이슈 등은 앱 흐름 방해하지 않도록 조용히 무시
  }
}
