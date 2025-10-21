// src/api/report.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';
import { ReportPoint } from '../types/report';

/** 호출부 호환 타입 */
export type CreateReportParams = {
  photoUri?: string;
  animal?: number;
  status: 'checking' | 'confirmed' | 'rejected';
  locationId?: number;
  lat?: number;
  lng?: number;
  address?: string;
  imageUri?: string; // photoUri 별칭
  animalId?: number; // animal 별칭
  mode?: 'auth' | 'no-auth';
};

/* ───────── 기본 유틸 ───────── */
function fetchWithTimeout(input: any, init: RequestInit, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() =>
    clearTimeout(id),
  );
}

function assertValidBase(base: string) {
  if (!/^https?:\/\//i.test(base)) {
    throw new Error(
      `API_BASE_URL이 잘못되었습니다. 반드시 프로토콜을 포함해야 합니다. (현재: ${base})`,
    );
  }
}

function buildUrl(path: string) {
  assertValidBase(API_BASE_URL as unknown as string);
  const base = (API_BASE_URL as unknown as string).replace(/\/+$/, '');
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

/* ───────── JWT 토큰 조회 / 리프레시 ───────── */
async function getAccessTokenOrRefresh(): Promise<string> {
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

  const refresh =
    (await AsyncStorage.getItem('@auth/refresh')) ??
    (await AsyncStorage.getItem('refresh'));
  if (refresh) {
    const url = buildUrl('/token/refresh/');
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
          await AsyncStorage.setItem('access', newAccess);
          return newAccess;
        }
      } catch {}
    }
  }
  throw new Error('로그인 토큰이 없습니다. 먼저 로그인하세요.');
}

/* ───────── 파라미터 정규화 ───────── */
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

/* ───────── 내부 전송기 ───────── */
async function postReportWithField(
  endpoint: '/reports/' | '/reports/no-auth/',
  payload: ReturnType<typeof normalizeParams>,
  animalField: 'animal' | 'animalId',
  authToken?: string,
) {
  const { photoUri, animal, status, locationId, lat, lng, address } = payload;
  const form = new FormData();

  const file = {
    uri: photoUri.startsWith('file://') ? photoUri : `file://${photoUri}`,
    name: 'report.jpg',
    type: 'image/jpeg',
  } as any;

  form.append('image', file);
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
    10000,
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

/* ───────── 공개 API ───────── */
export async function createReportAuto(raw: CreateReportParams) {
  const norm = normalizeParams(raw);
  const access = await getAccessTokenOrRefresh();
  try {
    return await postReportWithField('/reports/', norm, 'animal', access);
  } catch (e: any) {
    const status = e?._status as number | undefined;
    const body = (e?._body as string | undefined) ?? '';
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

export const createReport = createReportAuto;

/* ───────── 공통 파서 ───────── */
function hashId(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2147483647;
}

function coerceReportPoint(r: any): ReportPoint | null {
  const toNum = (v: any) => {
    const n = typeof v === 'string' ? Number(v) : v;
    return Number.isFinite(n) ? n : NaN;
  };

  const pickLatLng = (): { lat: number; lng: number } | null => {
    // lat/lng
    {
      const lat = toNum(r?.lat),
        lng = toNum(r?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    // latitude/longitude
    {
      const lat = toNum(r?.latitude),
        lng = toNum(r?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    // location.{lat,lng} / location.{latitude,longitude}
    if (r?.location) {
      let lat = toNum(r.location?.lat),
        lng = toNum(r.location?.lng);
      if (!(Number.isFinite(lat) && Number.isFinite(lng))) {
        lat = toNum(r.location?.latitude);
        lng = toNum(r.location?.longitude);
      }
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    // geo.lat/lng
    if (r?.geo) {
      const lat = toNum(r.geo?.lat),
        lng = toNum(r.geo?.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    // x/y → lng/lat 로 쓰는 케이스
    {
      const lat = toNum(r?.y),
        lng = toNum(r?.x);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
    return null;
  };

  const cand = pickLatLng();
  if (!cand) return null;

  const idRaw =
    r?.id ?? r?.pk ?? r?.uuid ?? `${String(cand.lat)},${String(cand.lng)}`;
  const idNum =
    typeof idRaw === 'number'
      ? idRaw
      : Number.isFinite(+idRaw)
      ? +idRaw
      : hashId(String(idRaw));

  const address =
    r?.address ?? r?.addr ?? r?.location?.address ?? r?.location?.addr ?? '';

  const rawStatus =
    (r?.status ?? r?.state ?? r?.report_status ?? r?.result ?? 'checking') + '';
  const status =
    rawStatus === 'confirmed'
      ? 'confirmed'
      : rawStatus === 'rejected'
      ? 'rejected'
      : 'checking';

  const createdRaw =
    r?.created_at ?? r?.createdAt ?? r?.timestamp ?? r?.time ?? null;
  const createdAt = createdRaw
    ? new Date(createdRaw).toISOString()
    : new Date().toISOString();

  const animalName =
    r?.animalName ?? r?.animal_name ?? r?.animal?.name ?? r?.species ?? '';

  return {
    id: idNum,
    lat: cand.lat,
    lng: cand.lng,
    address: String(address ?? ''),
    status,
    createdAt,
    animalName: String(animalName ?? ''),
  };
}

function parsePointsJSON(bodyText: string): ReportPoint[] {
  let json: any = null;

  // 정식 + 느슨한 파서 순차 시도
  try {
    json = JSON.parse(bodyText);
  } catch {
    json = tryParseJsonLoose(bodyText);
  }
  if (!json) return [];

  // 다양한 컨테이너 키 지원 (points / results / data / items / rows / 루트 배열)
  let rows: any[] =
    (Array.isArray(json?.points) && json.points) ||
    (Array.isArray(json?.results) && json.results) ||
    (Array.isArray(json?.data) && json.data) ||
    (Array.isArray(json?.items) && json.items) ||
    (Array.isArray(json?.rows) && json.rows) ||
    (Array.isArray(json) && json) ||
    [];

  // GeoJSON 간단 대응
  if (rows.length === 0 && Array.isArray(json?.features)) {
    rows = json.features.map((f: any) => {
      const coords = f?.geometry?.coordinates; // [lng, lat]
      const lng = Array.isArray(coords) ? Number(coords[0]) : undefined;
      const lat = Array.isArray(coords) ? Number(coords[1]) : undefined;
      return {
        id: f?.id ?? f?.properties?.id,
        lat,
        lng,
        address: f?.properties?.address,
        status: f?.properties?.status,
        created_at: f?.properties?.created_at,
        animalName: f?.properties?.animalName,
      };
    });
  }
  console.log(
    '[REPORT][PARSE] typeof json:',
    typeof json,
    'isArray=',
    Array.isArray(json),
  );
  console.log('[REPORT][PARSE] rows length:', rows.length);

  const out: ReportPoint[] = [];
  for (const r of rows) {
    const p = coerceReportPoint(r);
    if (p) out.push(p);
  }
  return out;
}

/* ───────── 신고 포인트 조회 ───────── */
export async function fetchReportPoints(
  since?: string,
): Promise<ReportPoint[]> {
  const access = await getAccessTokenOrRefresh();
  let url = buildUrl('/reports/my-points/');
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
  return parsePointsJSON(bodyText);
}

export async function fetchAllReportPoints(): Promise<ReportPoint[]> {
  const access = await getAccessTokenOrRefresh();
  const url = buildUrl('/reports/');
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
  console.log('[REPORT][ALL] sample:', bodyText.slice(0, 400));
  if (!res.ok) {
    throw new Error(`전체 신고 포인트 조회 실패: ${res.status} ${bodyText}`);
  }
  return parsePointsJSON(bodyText);
}

export async function fetchReportPointsByScope(
  scope: 'mine' | 'all',
  since?: string,
) {
  if (scope === 'mine') return fetchReportPoints(since);
  return fetchAllReportPoints();
}

/** 느슨한 파서: JSON 문자열/파이썬 repr 모두 최대한 파싱 */
function tryParseJsonLoose(bodyText: string): any | null {
  // 1) 정식 JSON 먼저 시도
  try {
    const j = JSON.parse(bodyText);
    // 1-1) 결과가 "문자열"인데 그 문자열이 JSON 형식이면 한 번 더
    if (typeof j === 'string') {
      const s = j.trim();
      if (
        (s.startsWith('{') && s.endsWith('}')) ||
        (s.startsWith('[') && s.endsWith(']'))
      ) {
        try {
          return JSON.parse(s);
        } catch {}
      }
    }
    return j;
  } catch {}

  // 2) 홑따옴표 형태 보정: 키/값의 ' → " 치환
  let s = bodyText.trim();

  // 전체가 '...'(홑따옴표)로 한번 더 감싸진 경우 → 벗겨내기
  if (s.startsWith("'") && s.endsWith("'")) s = s.slice(1, -1);

  // 키 'key': → "key":
  s = s.replace(/([{,]\s*)'([^'\\]+?)'\s*:/g, '$1"$2":');
  // 값 : 'value' → : "value"
  s = s.replace(/:\s*'([^'\\]*?)'/g, ':"$1"');

  // 3) 다시 파싱
  try {
    const j = JSON.parse(s);
    if (typeof j === 'string') {
      const t = j.trim();
      if (
        (t.startsWith('{') && t.endsWith('}')) ||
        (t.startsWith('[') && t.endsWith(']'))
      ) {
        try {
          return JSON.parse(t);
        } catch {}
      }
    }
    return j;
  } catch {}

  return null;
}
