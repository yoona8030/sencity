// src/api/index.ts
import { KAKAO_REST_API_KEY } from '@env';
import { postMultipart } from './client';

// ---------- 타입 ----------
export type ReportPayload = {
  animalId: number;
  locationId: number;
  status: 'checking' | 'accepted' | 'rejected';
  photoUri: string; // 'file://...' 포함
};

// ---------- 1) 신고(무인증) ----------
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

  // 업로드는 타임아웃 넉넉히
  return postMultipart('/reports/no-auth', form, {
    timeoutMs: 15000,
    auth: false,
  });
}

// ---------- 2) AI 인식 (/api/ai/recognize) ----------
export async function recognizeAnimal(
  photoUri: string,
): Promise<{ label: string }> {
  const form = new FormData();
  form.append('image', {
    uri: photoUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as any);

  const res = await fetch('http://127.0.0.1:8000/api/ai/recognize', {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json' }, // Content-Type 직접 지정 X
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(txt || `HTTP ${res.status}`);
  }
  const json = await res.json().catch(() => ({}));
  return { label: json?.label ?? '-' };
}

// ---------- 3) 카카오 역지오코딩 (좌표 → 주소) ----------
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
