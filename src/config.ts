// @env (react-native-dotenv)에서 주입되는 값을 읽어서
// 기본값/정규화/런타임 가드를 한 곳에서 처리한다.
import {
  API_BASE_URL as API_BASE_URL_RAW,
  KAKAO_JS_KEY as KAKAO_JS_KEY_RAW,
} from '@env';

function stripTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

// 기본값 + 공백 제거 + 말슬래시 제거
export const API_BASE_URL = stripTrailingSlash(
  (
    API_BASE_URL_RAW || 'https://dramaturgic-moneyed-cecelia.ngrok-free.dev/api'
  ).trim(),
);

// 키는 공백 제거만
export const KAKAO_JS_KEY = (KAKAO_JS_KEY_RAW || '').trim();

// (선택) 개발 모드 경고: 설정 누락 시 콘솔로 알려주기
if (__DEV__) {
  if (!API_BASE_URL_RAW) {
    // eslint-disable-next-line no-console
    console.warn('[config] API_BASE_URL not set; using default:', API_BASE_URL);
  }
  if (!KAKAO_JS_KEY) {
    // eslint-disable-next-line no-console
    console.warn(
      '[config] KAKAO_JS_KEY is empty (심사용: Leaflet 폴백 또는 안내문구 권장)',
    );
  }
}
