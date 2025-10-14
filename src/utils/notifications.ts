// src/utils/notifications.ts
import { Platform } from 'react-native';
import messaging, {
  FirebaseMessagingTypes,
  AuthorizationStatus,
} from '@react-native-firebase/messaging';
import notifee, {
  AndroidImportance,
  AndroidStyle,
  EventType as NotifeeEventType,
} from '@notifee/react-native';

/** 서버와 반드시 동일하게 유지할 채널 ID */
export const DEFAULT_CHANNEL_ID = 'sencity-general';
const DEFAULT_CHANNEL_NAME = 'Sencity 일반 알림';

import { API_BASE_URL } from '@env';

const RAW_BASE = (API_BASE_URL as any) || 'http://127.0.0.1:8000/api';

export const BASE = RAW_BASE;

/** 서버의 디바이스 등록 엔드포인트
 *  - 네 urls.py가 `router.register('devices', ...)`라면 '/devices/'가 정답
 *  - 만약 커스텀 액션 '/devices/register-fcm/'를 쓰면 아래를 바꿔줘
 */
const DEVICES_ENDPOINT = `${BASE}/devices/`;

let cachedChannelCreated = false;

/** any → string 안전 변환 */
const toStr = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : v == null ? undefined : String(v);

/** 안드로이드 채널을 앱 프로세스당 1회 보장 */
export async function ensureDefaultChannel(): Promise<string> {
  if (Platform.OS !== 'android') return DEFAULT_CHANNEL_ID;
  if (!cachedChannelCreated) {
    await notifee.createChannel({
      id: DEFAULT_CHANNEL_ID,
      name: DEFAULT_CHANNEL_NAME,
      importance: AndroidImportance.HIGH,
      lights: true,
      vibration: true,
      sound: 'default',
      // smallIcon: 'ic_notification', // 리소스 준비 시 주석 해제
    });
    cachedChannelCreated = true;
    if (__DEV__) console.log('[Notifee] channel ensured:', DEFAULT_CHANNEL_ID);
  }
  return DEFAULT_CHANNEL_ID;
}

/** RemoteMessage에서 이미지 URL 추출 */
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

/** 단순 로컬 알림 표시 */
export async function showLocalNotification(title: string, body?: string) {
  const channelId = await ensureDefaultChannel();
  await notifee.displayNotification({
    title,
    body,
    android: {
      channelId,
      pressAction: { id: 'default' },
      // smallIcon: 'ic_notification',
    },
  });
}

/** RemoteMessage → notifee로 표시 */
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
      // largeIcon: 'resource://notice_large', // 원형 큰 아이콘을 쓰고 싶으면 준비 후 주석 해제
      // smallIcon: 'ic_notification',
      style: imageUrl
        ? { type: AndroidStyle.BIGPICTURE, picture: imageUrl }
        : { type: AndroidStyle.BIGTEXT, text: body },
      colorized: true,
      color: '#FF2A2A',
    },
  });
}

/** 앱 포그라운드 수신 리스너 (App에서 attach) */
export function attachForegroundFCMListener() {
  const unsubMessage = messaging().onMessage(async remoteMessage => {
    if (__DEV__)
      console.log('[FCM] Foreground message:', JSON.stringify(remoteMessage));
    try {
      // 포그라운드에서도 시스템 알림로 띄우고 싶으면 유지,
      // Figma 스타일 커스텀 배너로 바꾸려면 여기서 presentRemoteMessage 대신 배너 호출
      await presentRemoteMessage(remoteMessage);
    } catch (e) {
      console.warn('[FCM] presentRemoteMessage error:', e);
    }
  });

  const unsubNotifee = notifee.onForegroundEvent(event => {
    if (event.type === NotifeeEventType.PRESS) {
      if (__DEV__)
        console.log('[Notifee] pressed:', event.detail.notification?.data);
      // TODO: event.detail.notification?.data 로 라우팅 처리
    }
  });

  return () => {
    unsubMessage();
    unsubNotifee();
  };
}

/** 권한 → 토큰 획득 → 서버 등록 (포그라운드 초기화용) */
export async function initForegroundFCM(tokenJwt?: string) {
  await ensureDefaultChannel();

  // 1) Android 13+ 권한
  const status = await messaging().requestPermission();
  const enabled =
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    if (__DEV__) console.warn('[FCM] notification permission not granted');
    return;
  }

  // 2) 토큰
  let fcmToken: string | undefined;
  try {
    fcmToken = await messaging().getToken();
    if (__DEV__) console.log('[FCM] device token =', fcmToken);
  } catch (e) {
    console.warn('[FCM] getToken error:', e);
  }
  if (!fcmToken) return;

  // 3) 서버 등록 (JWT 필요 시 Authorization 추가)
  try {
    await fetch(DEVICES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(tokenJwt ? { Authorization: `Bearer ${tokenJwt}` } : {}),
      },
      body: JSON.stringify({
        token: fcmToken,
        platform: Platform.OS, // 'android' | 'ios'
        app: 'sencity',
      }),
    });
    if (__DEV__) console.log('[FCM] token registered to server');
  } catch (e) {
    if (__DEV__) console.warn('[FCM] device register failed:', e);
  }

  // 4) 토큰 갱신 리스너(선택)
  messaging().onTokenRefresh(async newToken => {
    try {
      await fetch(DEVICES_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: newToken,
          platform: Platform.OS,
          app: 'sencity',
        }),
      });
      if (__DEV__) console.log('[FCM] token refreshed & registered');
    } catch {}
  });
}

/** 백그라운드/종료 상태 핸들러 – index.(ts|js) 최상단에서 1회 호출 */
export function registerBackgroundFCMHandler() {
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    if (__DEV__)
      console.log('[FCM] Background message:', JSON.stringify(remoteMessage));
    try {
      await presentRemoteMessage(remoteMessage);
    } catch (e) {
      console.warn('[FCM] background presentRemoteMessage error:', e);
    }
  });
}
