// src/utils/notifications.ts
import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  onMessage,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import type { FirebaseMessagingTypes } from '@react-native-firebase/messaging';

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

/** 안드 채널 보장 */
export async function ensureDefaultChannel(): Promise<string> {
  if (Platform.OS !== 'android') return DEFAULT_CHANNEL_ID;
  if (!cachedChannelCreated) {
    await notifee.createChannel({
      id: DEFAULT_CHANNEL_ID,
      name: 'Default',
      importance: AndroidImportance.HIGH,
      lights: true,
      vibration: true,
      // smallIcon: 'ic_stat_notification',
    });
    cachedChannelCreated = true;
  }
  return DEFAULT_CHANNEL_ID;
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
    android: {
      channelId,
      pressAction: { id: 'default' },
      // smallIcon: 'ic_stat_notification',
    },
  });
}

/** RemoteMessage → 표시 */
async function presentRemoteMessage(msg: FirebaseMessagingTypes.RemoteMessage) {
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

/** 앱 포그라운드 수신 리스너 (App에서 attach) */
export function attachForegroundFCMListener() {
  const app = getApp();
  const messaging = getMessaging(app);

  const unsubMessage = onMessage(messaging, async remoteMessage => {
    console.log('[FCM] Foreground message:', JSON.stringify(remoteMessage));
    try {
      await presentRemoteMessage(remoteMessage);
    } catch (e) {
      console.warn('[FCM] presentRemoteMessage error:', e);
    }
  });

  const unsubNotifee = notifee.onForegroundEvent(event => {
    if (event.type === NotifeeEventType.PRESS) {
      console.log('[Notifee] pressed:', event.detail.notification?.data);
      // TODO: data 기반 라우팅
    }
  });

  return () => {
    unsubMessage();
    unsubNotifee();
  };
}

/** 백그라운드/종료 상태 핸들러 – index.ts에서 1회 호출 */
export function registerBackgroundFCMHandler() {
  const app = getApp();
  const messaging = getMessaging(app);

  setBackgroundMessageHandler(
    messaging,
    async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log('[FCM] Background message:', JSON.stringify(remoteMessage));
      try {
        await presentRemoteMessage(remoteMessage);
      } catch (e) {
        console.warn('[FCM] background presentRemoteMessage error:', e);
      }
    },
  );
}
