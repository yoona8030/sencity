// src/api/report.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';

/** 호출부 호환 타입 */
export type CreateReportParams = {
  // 원래 기대 필드
  photoUri?: string;
  animal?: number;
  status: 'checking' | 'confirmed' | 'rejected';

  // 위치: locationId 또는 lat/lng/address 중 하나
  locationId?: number;
  lat?: number;
  lng?: number;
  address?: string;

  // 호출부에서 쓰던 별칭(호환)
  imageUri?: string; // photoUri 별칭
  animalId?: number; // animal 별칭
  mode?: 'auth' | 'no-auth';
};

function fetchWithTimeout(input: RequestInfo, init: RequestInit, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() =>
    clearTimeout(id),
  );
}

/* =========================
 * 공통 유틸
 * ========================= */
function assertValidBase(base: string) {
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(
      `API_BASE_URL이 잘못되었습니다. 반드시 프로토콜을 포함해야 합니다.  (현재: ${base})`,
    );
  }
}

function buildUrl(path: string) {
  assertValidBase(API_BASE_URL);
  const base = API_BASE_URL.replace(/\/+$/, ''); // 끝 슬래시 제거
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

async function readSafeText(res: Response) {
  try {
    return await res.text();
  } catch {
    return '';
  }
}

/* =========================
 * 토큰 조회/리프레시 헬퍼
 *  - 다양한 키를 시도하고, 없으면 refresh로 재발급
 * ========================= */
async function getAccessTokenOrRefresh(): Promise<string> {
  // 1) 실제 프로젝트에 존재하던 키들을 모두 시도
  const directKeys = [
    'access',
    'accessToken',
    'token',
    'jwt',
    '@auth/access',
    '@accessToken',
    '@access_token',
  ];
  for (const k of directKeys) {
    const v = await AsyncStorage.getItem(k);
    if (v) return v;
  }

  // 2) JSON 객체 안에 들어가 있는 패턴도 시도 (선택)
  const jsonKeys = ['user', 'auth', 'session', '@auth/user'];
  for (const k of jsonKeys) {
    const raw = await AsyncStorage.getItem(k);
    if (!raw) continue;
    try {
      const j = JSON.parse(raw);
      const cand =
        j?.access ?? j?.accessToken ?? j?.token ?? j?.jwt ?? j?.tokens?.access;
      if (cand) return String(cand);
    } catch {}
  }

  // 3) refresh로 재발급 (서버 경로에 맞춰 변경 가능)
  const refresh =
    (await AsyncStorage.getItem('@auth/refresh')) ??
    (await AsyncStorage.getItem('refresh'));
  if (refresh) {
    const url = buildUrl('/token/refresh/'); // 예: '/auth/jwt/refresh/' 로 바꿔야 할 수도 있음
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    const txt = await readSafeText(res);
    console.log('[TOKEN REFRESH]', res.status, txt);
    if (res.ok) {
      try {
        const j = JSON.parse(txt);
        const newAccess = j.access ?? j.token;
        if (newAccess) {
          await AsyncStorage.setItem('access', newAccess); // 표준 키로 저장
          return newAccess;
        }
      } catch {}
    }
  }

  throw new Error('로그인 토큰이 없습니다. 먼저 로그인하세요.');
}

/* =========================
 * 파라미터 정규화
 * ========================= */
function normalizeParams(p: CreateReportParams) {
  const photoUri = p.photoUri ?? p.imageUri;
  if (!photoUri) throw new Error('photoUri(또는 imageUri)가 필요합니다.');

  const animal =
    typeof p.animal === 'number'
      ? p.animal
      : typeof p.animalId === 'number'
      ? p.animalId
      : undefined;
  if (typeof animal !== 'number') {
    throw new Error('animal(또는 animalId)가 필요합니다.');
  }

  return {
    photoUri,
    animal,
    status: p.status,
    locationId: p.locationId,
    lat: p.lat,
    lng: p.lng,
    address: p.address,
  };
}

/* =========================
 * 내부 전송기 (필드명 선택 가능)
 *  - required(animalField)를 optional(authToken)보다 앞에 둠
 * ========================= */
async function postReportWithField(
  endpoint: '/reports/' | '/reports/no-auth/',
  payload: ReturnType<typeof normalizeParams>,
  animalField: 'animal' | 'animalId', // required
  authToken?: string, // optional
) {
  const { photoUri, animal, status, locationId, lat, lng, address } = payload;

  const form = new FormData();
  // form.append('photo', {
  //   uri: photoUri,
  //   name: 'report.jpg',
  //   type: 'image/jpeg',
  // } as any);
  const file = {
    uri: photoUri.startsWith('file://') ? photoUri : `file://${photoUri}`,
    name: 'report.jpg',
    type: 'image/jpeg',
  } as any;

  form.append('image', file); // Django/DRF 모델 필드명이 image인 케이스

  form.append(animalField, String(animal));
  form.append('status', status);

  if (typeof locationId === 'number') {
    form.append('location', String(locationId));
  } else {
    if (typeof lat === 'number') form.append('lat', String(lat));
    if (typeof lng === 'number') form.append('lng', String(lng));
    if (address) form.append('address', address);
  }

  const url = buildUrl(endpoint);
  const res = await fetchWithTimeout(
    url,
    {
      method: 'POST',
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
      body: form,
    },
    10000, // 10초
  );

  const bodyText = await readSafeText(res);
  console.log(`[REPORT][POST] ${endpoint}`, res.status, bodyText);

  if (res.status === 201) {
    try {
      return JSON.parse(bodyText);
    } catch {
      return { ok: true };
    }
  }

  const err = new Error(`신고 등록 실패: ${res.status} ${bodyText}`.trim());
  (err as any)._status = res.status;
  (err as any)._body = bodyText;
  throw err;
}

/* =========================
 * 공개 API: 인증 필요
 * ========================= */
export async function createReportAuto(raw: CreateReportParams) {
  const norm = normalizeParams(raw);

  // 🔁 수정 포인트: 다양한 키/리프레시를 지원하는 헬퍼로 토큰 획득
  const access = await getAccessTokenOrRefresh();

  try {
    // 1차: 'animal' 필드로 시도
    return await postReportWithField('/reports/', norm, 'animal', access);
  } catch (e: any) {
    const status = e?._status as number | undefined;
    const body = (e?._body as string | undefined) ?? '';

    // 400이고 필드 불일치가 의심될 때만 'animalId'로 재시도
    const shouldRetry =
      status === 400 &&
      /animal/i.test(body) &&
      !/already exists|duplicate/i.test(body);

    if (shouldRetry) {
      console.warn('[REPORT] animal → animalId로 재시도합니다.');
      return await postReportWithField('/reports/', norm, 'animalId', access);
    }
    throw e;
  }
}

/* =========================
 * 공개 API: 무인증
 * ========================= */
export async function createReportNoAuth(raw: CreateReportParams) {
  const norm = normalizeParams(raw);

  try {
    return await postReportWithField('/reports/no-auth/', norm, 'animal');
  } catch (e: any) {
    const status = e?._status as number | undefined;
    const body = (e?._body as string | undefined) ?? '';
    const shouldRetry = status === 400 && /animal/i.test(body);

    if (shouldRetry) {
      console.warn('[REPORT: NO-AUTH] animal → animalId로 재시도합니다.');
      return await postReportWithField('/reports/no-auth/', norm, 'animalId');
    }
    throw e;
  }
}

/* =========================
 * 호환용 별칭
 * ========================= */
export const createReport = createReportAuto;

/* =========================
 * 내 신고 포인트 조회 (JWT 필요)
 * ========================= */
export type ReportPoint = {
  id: number;
  animalId: number;
  animalName?: string | null;
  lat: number;
  lng: number;
  createdAt: string; // ISO
  status: 'checking' | 'confirmed' | 'rejected' | 'accepted' | 'rejected';
  // ↑ 서버 상태키에 맞춰 'confirmed' vs 'accepted' 중 하나만 쓰면 됩니다.
};

/**
 * 내가 등록한 신고 포인트 목록을 가져옵니다.
 * @param since ISO 문자열(선택). 예: '2025-01-01T00:00:00Z'
 */
export async function fetchReportPoints(
  since?: string,
): Promise<ReportPoint[]> {
  const access = await getAccessTokenOrRefresh(); // 기존 헬퍼 재사용
  let url = buildUrl('/reports/my-points/'); // 백엔드 라우트와 정확히 일치해야 함
  if (since) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}since=${encodeURIComponent(since)}`;
  }

  const res = await fetchWithTimeout(
    url,
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${access}`,
      },
    },
    10000,
  );

  const bodyText = await readSafeText(res);
  if (!res.ok) {
    throw new Error(
      `내 신고 포인트 조회 실패: ${res.status} ${bodyText}`.trim(),
    );
  }
  try {
    return JSON.parse(bodyText) as ReportPoint[];
  } catch {
    return [];
  }
}
