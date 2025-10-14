// src/api/index.ts
import { KAKAO_REST_API_KEY, API_BASE_URL } from '@env';

/* =========================
   공통
   ========================= */
const API = (API_BASE_URL as any) || 'http://127.0.0.1:8000/api';

// FormData 전송 때는 Content-Type을 직접 지정 X (경계값 자동)
// Accept만 지정: 일부 서버에서 필요
const BASE_HEADERS: Record<string, string> = { Accept: 'application/json' };

// 선택적 JWT (있으면 Bearer 붙이고, 없어도 무인증 업로드 동작)
let _authToken: string | null = null;
export function setAuthToken(t: string | null) {
  _authToken = t && t.trim() ? t.trim() : null;
}
function withAuth(headers: Record<string, string> = {}) {
  if (_authToken) headers.Authorization = `Bearer ${_authToken}`;
  return headers;
}

// 서버 status(모델 choices): checking | on_hold | completed
export type ReportStatus = 'checking' | 'on_hold' | 'completed';

// 서버가 받는 페이로드 규격
export type ReportCreatePayload = {
  animalId: number; // FK id → 서버 필드명 animal
  photoUri: string; // file:// or content://
  status?: ReportStatus; // 기본 checking
  lat: number;
  lng: number;
  address?: string | null;
};

/* =========================
   유틸: 파일 파트 보정
   ========================= */
function inferMimeFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

function cleanFileName(raw: string): string {
  // content:// 또는 file:// 에서 마지막 세그먼트 추출 후 ? 제거
  const seg = raw.split('/').pop() || `report_${Date.now()}`;
  return seg.split('?')[0] || `report_${Date.now()}`;
}

/* =========================
   1) 신고 업로드 (무인증 허용과 호환)
      POST /api/reports/
      필드: image, animal, lat, lng, address, status
   ========================= */
export async function postReport(p: ReportCreatePayload) {
  const form = new FormData();

  const fileName = cleanFileName(p.photoUri);
  const mime = inferMimeFromName(fileName);

  form.append('image', {
    uri: p.photoUri,
    name: fileName,
    type: mime,
  } as any);

  form.append('animal', String(p.animalId));
  form.append('lat', String(p.lat));
  form.append('lng', String(p.lng));
  if (p.address) form.append('address', p.address);
  form.append('status', p.status ?? 'checking');

  const res = await fetch(`${API}/reports/`, {
    method: 'POST',
    headers: withAuth({ ...BASE_HEADERS }),
    body: form,
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    // 백엔드 에러 응답(JSON일 수도) 정리
    let msg = text;
    try {
      const j = JSON.parse(text);
      msg = typeof j === 'string' ? j : JSON.stringify(j);
    } catch {}
    throw new Error(`Upload failed: ${res.status} ${msg}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return text as any;
  }
}

/* =========================
   2) 별칭(기존 호출 교체용)
   ========================= */
export async function postReportNoAuth_LatLng(p: {
  animalId: number;
  photoUri: string;
  status?: ReportStatus;
  lat: number;
  lng: number;
  address?: string | null;
}) {
  return postReport({
    animalId: p.animalId,
    photoUri: p.photoUri,
    status: p.status ?? 'checking',
    lat: p.lat,
    lng: p.lng,
    address: p.address ?? null,
  });
}

/* =========================
   3) 라벨 → animal_id 해석
   GET /api/animals/resolve/?q=...
   ========================= */
export async function resolveAnimalByLabel(
  label: string,
): Promise<{ animal_id: number; confidence?: string; matched?: string }> {
  const res = await fetch(
    `${API}/animals/resolve/?q=${encodeURIComponent(label)}`,
    { method: 'GET', headers: withAuth({ ...BASE_HEADERS }) },
  );
  if (!res.ok) throw new Error(`resolve failed ${res.status}`);
  const j = await res.json();
  return {
    animal_id: j?.animal_id,
    confidence: j?.confidence,
    matched: j?.matched,
  };
}

/* =========================
   4) AI 인식 (/api/ai/recognize)
   ========================= */
export type RecognizeTop = {
  label: string;
  label_ko?: string | null;
  animal_id?: number | null;
  prob?: number;
  topk?: any;
  [k: string]: any;
};

export async function recognizeAnimal(photoUri: string): Promise<RecognizeTop> {
  const form = new FormData();
  const fileName = cleanFileName(photoUri);
  const mime = inferMimeFromName(fileName);

  form.append('image', {
    uri: photoUri,
    name: fileName,
    type: mime,
  } as any);

  const url = `${API}/ai/recognize`;
  const res = await fetch(url, {
    method: 'POST',
    body: form,
    headers: withAuth({ ...BASE_HEADERS }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text || `HTTP ${res.status}`);

  const json: any = JSON.parse(text);

  if (json?.mode === 'single' || json?.label !== undefined) {
    return {
      label: (json.label ?? '-').toString(),
      label_ko: json.label_ko ?? null,
      prob: Number(json.prob ?? 0),
      animal_id: typeof json.animal_id === 'number' ? json.animal_id : null,
      topk: json.topk,
    };
  }
  const first = json?.results?.[0];
  return {
    label: (first?.label ?? '-').toString(),
    label_ko: first?.label_ko ?? null,
    prob: Number(first?.prob ?? 0),
    animal_id: typeof first?.animal_id === 'number' ? first.animal_id : null,
    topk: json?.results,
  };
}

/* =========================
   5) 카카오 역지오코딩 (좌표 → 주소)
   ========================= */
export async function reverseGeocodeKakao(
  lat: number,
  lng: number,
): Promise<string> {
  const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}`;
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Kakao ${res.status}`);

  const j = await res.json();
  const doc = j?.documents?.[0];
  const road = doc?.road_address?.address_name;
  const lot = doc?.address?.address_name;
  return road || lot || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
