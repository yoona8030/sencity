// src/utils/permissions.ts
import { Platform, PermissionsAndroid } from 'react-native';

/** Android 13+ 알림 권한 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 33) {
    const r = await PermissionsAndroid.request(
      'android.permission.POST_NOTIFICATIONS',
    );
    return r === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

/** 갤러리(사진) 읽기 권한 */
export async function ensurePhotoReadPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 33) {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } else {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  }
}

/** (선택) 카메라 권한 */
export async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const res = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
  );
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

/** (선택) 위치 권한: fine 우선, 안되면 coarse */
export async function ensureLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const fine = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  if (fine === PermissionsAndroid.RESULTS.GRANTED) return true;

  const coarse = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
  );
  return coarse === PermissionsAndroid.RESULTS.GRANTED;
}
