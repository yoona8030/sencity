// src/utils/notifications.ts
import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  onMessage,
  setBackgroundMessageHandler,
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';

import notifee, {
  AndroidImportance,
  AndroidStyle,
  EventType as NotifeeEventType,
} from '@notifee/react-native';

export const DEFAULT_CHANNEL_ID = 'default';
let cachedChannelCreated = false;

/** any → string 안전 변환 */
const toStr = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : v == null ? undefined : String(v);

/** ───────────────── 채널 보장 ───────────────── */
export async function ensureDefaultChannel(): Promise<string> {
  if (Platform.OS !== 'android') return DEFAULT_CHANNEL_ID;
  if (!cachedChannelCreated) {
    await notifee.createChannel({
      id: DEFAULT_CHANNEL_ID,
      name: '기본 알림',
      importance: AndroidImportance.HIGH,
      lights: true,
      vibration: true,
      // smallIcon: 'ic_stat_notification', // 필요 시 리소스 추가
    });
    cachedChannelCreated = true;
  }
  return DEFAULT_CHANNEL_ID;
}

/** ───────────────── OS가 이미 표시하는 케이스는 스킵 ─────────────────
 *  notification payload가 포함되어 오면(특히 백그라운드/종료 상태),
 *  OS가 이미 시스템 알림을 띄웁니다. 이때 앱이 또 띄우면 '중복'이 됩니다.
 */
function isOSAlreadyShowing(
  msg: FirebaseMessagingTypes.RemoteMessage,
): boolean {
  // 안드/ios 공통: notification 필드가 존재하면 OS가 표시한다고 간주하고 스킵
  return !!msg.notification;
}

/** ───────────────── 간단 dedup ─────────────────
 * 서버가 data.dedup 같이 idem 키를 내려주면 가장 효과적.
 * 없을 때는 messageId로 보조.
 */
function shouldSkipByDedup(msg: FirebaseMessagingTypes.RemoteMessage): boolean {
  const g = globalThis as any;
  const data = (msg.data || {}) as Record<string, string>;
  const key =
    toStr(data.dedup) ||
    toStr(msg.messageId) ||
    `${toStr(msg.notification?.title) ?? ''}|${
      toStr(msg.notification?.body) ?? ''
    }`;

  if (!key) return false;
  if (g.__SENCITY_LAST_DEDUP__ === key) return true;
  g.__SENCITY_LAST_DEDUP__ = key;
  return false;
}

/** message에서 이미지 URL 추출 */
function getImageUrl(
  msg: FirebaseMessagingTypes.RemoteMessage,
): string | undefined {
  const fromAndroid = msg.notification?.android?.imageUrl;
  if (fromAndroid) return fromAndroid;
  const fromData = (msg.data as Record<string, string> | undefined)?.imageUrl;
  if (fromData) return fromData;
  const legacy: unknown = (msg.notification as any)?.imageUrl;
  return toStr(legacy);
}

/** 단순 로컬 알림 */
export async function showLocalNotification(title: string, body?: string) {
  const channelId = await ensureDefaultChannel();
  await notifee.displayNotification({
    title,
    body,
    android: { channelId, pressAction: { id: 'default' } },
  });
}

/** RemoteMessage → 표시 (중복/OS표시 케이스 자동 차단) */
async function presentRemoteMessage(msg: FirebaseMessagingTypes.RemoteMessage) {
  // 1) OS가 표시할 케이스는 스킵
  if (isOSAlreadyShowing(msg)) return;

  // 2) dedup 스킵
  if (shouldSkipByDedup(msg)) return;

  const channelId = await ensureDefaultChannel();

  const title: string =
    toStr(msg.notification?.title) ??
    (msg.data as Record<string, string> | undefined)?.title ??
    '알림';

  const body: string =
    toStr(msg.notification?.body) ??
    (msg.data as Record<string, string> | undefined)?.body ??
    '';

  const imageUrl = getImageUrl(msg);

  await notifee.displayNotification({
    title,
    body,
    data: msg.data,
    android: {
      channelId,
      pressAction: { id: 'default' },
      style: imageUrl
        ? { type: AndroidStyle.BIGPICTURE, picture: imageUrl }
        : undefined,
      // smallIcon: 'ic_stat_notification',
    },
  });
}

/** ───────────────── 포그라운드 리스너 (App에서 attach) ─────────────────
 * App.tsx 쪽에서 한 번만 붙이세요.
 */
export function attachForegroundFCMListener() {
  const app = getApp();
  const messaging = getMessaging(app);

  const unsubMessage = onMessage(messaging, async remoteMessage => {
    // 포그라운드에서도 notification 동봉 시(드묾) OS 중복 가능성 → 스킵
    try {
      await presentRemoteMessage(remoteMessage);
    } catch (e) {
      console.warn('[FCM] presentRemoteMessage error:', e);
    }
  });

  const unsubNotifee = notifee.onForegroundEvent(event => {
    if (event.type === NotifeeEventType.PRESS) {
      // TODO: event.detail.notification?.data 기반으로 라우팅 필요 시 구현
      // console.log('[Notifee] pressed:', event.detail.notification?.data);
    }
  });

  return () => {
    try {
      unsubMessage();
    } catch {}
    try {
      unsubNotifee();
    } catch {}
  };
}

/** ───────────────── 백그라운드/종료 핸들러 (index.js에서 1회 등록) ───────────────── */
let __BG_SET = false;

export function registerBackgroundFCMHandler() {
  if (__BG_SET) return;
  __BG_SET = true;

  const app = getApp();
  const messaging = getMessaging(app);

  setBackgroundMessageHandler(messaging, async remoteMessage => {
    try {
      await presentRemoteMessage(remoteMessage);
    } catch (e) {
      console.warn('[FCM] background presentRemoteMessage error:', e);
    }
  });
}
