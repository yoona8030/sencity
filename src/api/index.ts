// src/api/index.ts
import { KAKAO_REST_API_KEY, API_BASE_URL } from '@env';

// ---------- 타입 ----------
export type RecognizeTop = {
  label: string; // 예: "Goat" | "Squirrel" ...
  label_ko?: string;
  prob?: number; // 0~1
  group?: string;
  members?: [string, number][];
  animal_id?: number;
  label_raw?: string; // 백엔드에서 온 원래 라벨(옵션)
};

// ---------- 1) 신고(무인증) ----------
export type ReportPayload = {
  animalId: number;
  locationId: number;
  status: 'checking' | 'accepted' | 'rejected';
  photoUri: string; // 'file://...'
};

// (주의) 기존 프로젝트의 postMultipart 유틸을 사용
import { postMultipart } from './client';

export async function postReportNoAuth_IdFields(p: ReportPayload) {
  const form = new FormData();
  form.append('photo', {
    uri: p.photoUri,
    name: 'report.jpg',
    type: 'image/jpeg',
  } as any);
  form.append('animalId', String(p.animalId));
  form.append('locationId', String(p.locationId));
  form.append('status', p.status);

  return postMultipart('/reports/no-auth', form, {
    timeoutMs: 15000,
    auth: false,
  });
}

// ---------- 2) AI 인식 (그룹 버전) ----------
export async function recognizeAnimal(
  photoUri: string,
): Promise<RecognizeTop[] | RecognizeTop | null> {
  if (!photoUri) {
    return null;
  }

  const filename = photoUri.split('/').pop() ?? 'photo.jpg';

  const formData = new FormData();
  formData.append('image', {
    uri: photoUri,
    name: filename,
    type: 'image/jpeg',
  } as any);

  const res = await fetch(`${API_BASE_URL}/ai/classify/`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`AI 인식 실패: ${res.status} ${text}`);
  }

  const json: any = await res.json();

  // 백엔드 응답: { ok: true, results: [ {...}, ... ] }
  if (Array.isArray(json)) {
    return json;
  }
  if (Array.isArray(json.results)) {
    return json.results;
  }

  // 혹시 옛날 형태(top1)도 들어올 수 있으니 최소한의 호환 처리
  if (json.top1) {
    return json;
  }

  return json;
}

// ---------- 3) 카카오 역지오코딩 (좌표 → 주소, 안전 폴백/타임아웃/재시도 포함) ----------

/** 내부: AbortSignal 두 개를 병합 */
function linkSignals(
  a?: AbortSignal | null,
  b?: AbortSignal | null,
): AbortSignal | undefined {
  if (!a && !b) return undefined;
  if (a?.aborted) return a as AbortSignal;
  if (b?.aborted) return b as AbortSignal;

  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();

  a?.addEventListener('abort', onAbort, { once: true });
  b?.addEventListener('abort', onAbort, { once: true });

  return ctrl.signal;
}
/** 내부: fetch with timeout (nullable signal 지원) */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
) {
  const { timeoutMs = 5000, signal, ...rest } = init;

  const local = new AbortController();
  // ✅ 외부에서 넘어온 signal이 null/undefined일 수 있으므로 안전 병합
  const merged: AbortSignal | undefined = linkSignals(
    signal ?? undefined,
    local.signal,
  );

  const to = setTimeout(() => local.abort(), timeoutMs);
  try {
    const res = await fetch(input, { ...rest, signal: merged });
    return res;
  } finally {
    clearTimeout(to);
  }
}

/**
 * 좌표 → 주소 문자열.
 * - 1차: coord2address (도로명/지번)
 * - 2차: coord2regioncode (행정동/법정동)
 * - 실패 시: 예외를 던지지 않고 "좌표 문자열"을 최종 반환 (호출부 UI가 튼튼해짐)
 * - Kakao 규칙: x=경도(lng), y=위도(lat)
 * - 기본 타임아웃 5초, 2회 재시도
 */
export async function reverseGeocodeKakao(
  lat: number,
  lng: number,
  opts?: { timeoutMs?: number; retries?: number; signal?: AbortSignal },
): Promise<string> {
  // 입력 검증
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return '위치 정보 없음';
  }

  // 키 검증
  const KEY = (KAKAO_REST_API_KEY || '').trim();
  if (!KEY) {
    console.warn('[reverseGeocodeKakao] KAKAO_REST_API_KEY 누락');
    return `${latNum.toFixed(5)}, ${lngNum.toFixed(5)}`;
  }

  const timeoutMs = Math.max(3000, opts?.timeoutMs ?? 5000);
  const retries = Math.max(0, Math.min(2, opts?.retries ?? 1)); // 기본 1회 재시도

  const tryOnce = async (): Promise<string | null> => {
    try {
      // 1) 도로명/지번 주소
      const url1 =
        `https://dapi.kakao.com/v2/local/geo/coord2address.json` +
        `?x=${encodeURIComponent(lngNum)}&y=${encodeURIComponent(latNum)}`;

      const r1 = await fetchWithTimeout(url1, {
        method: 'GET',
        headers: { Authorization: `KakaoAK ${KEY}` },
        timeoutMs,
        signal: opts?.signal,
      });

      if (r1.ok) {
        const j1 = await r1.json().catch(() => ({} as any));
        const doc = j1?.documents?.[0];
        const road = doc?.road_address?.address_name;
        const lot = doc?.address?.address_name;
        if (typeof road === 'string' && road.trim()) return road.trim();
        if (typeof lot === 'string' && lot.trim()) return lot.trim();
      } else {
        const raw = await r1.text().catch(() => '');
        console.warn('[coord2address fail]', r1.status, raw);
      }

      // 2) 행정구역명 대체
      const url2 =
        `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json` +
        `?x=${encodeURIComponent(lngNum)}&y=${encodeURIComponent(latNum)}`;

      const r2 = await fetchWithTimeout(url2, {
        method: 'GET',
        headers: { Authorization: `KakaoAK ${KEY}` },
        timeoutMs,
        signal: opts?.signal,
      });

      if (r2.ok) {
        const j2 = await r2.json().catch(() => ({} as any));
        const d = j2?.documents?.[0];
        const parts = [
          d?.region_1depth_name,
          d?.region_2depth_name,
          d?.region_3depth_name,
        ]
          .map((s: unknown) => (typeof s === 'string' ? s.trim() : ''))
          .filter(Boolean);
        if (parts.length) return parts.join(' ');
      } else {
        const raw2 = await r2.text().catch(() => '');
        console.warn('[coord2regioncode fail]', r2.status, raw2);
      }

      return null;
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        console.warn('[reverseGeocodeKakao] timeout/aborted');
      } else {
        console.warn('[reverseGeocodeKakao] error', e);
      }
      return null;
    }
  };

  // 재시도 루프
  for (let i = 0; i <= retries; i++) {
    const out = await tryOnce();
    if (out) return out;
  }

  // 최종 폴백: 좌표 문자열
  return `${latNum.toFixed(5)}, ${lngNum.toFixed(5)}`;
}
