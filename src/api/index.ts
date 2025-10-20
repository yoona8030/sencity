// src/api/index.ts
import { KAKAO_REST_API_KEY, API_BASE_URL } from '@env';

// ---------- 타입 ----------
export type RecognizeTop = {
  label: string; // 표준 영문 (예: "Goat" | "Squirrel" | "Heron/Egret" | ...)
  label_ko?: string; // 그룹 한글 병기 (예: "고라니/노루" | "다람쥐/청설모" | "왜가리/중대백로")
  prob?: number; // 0~1
  group?: string; // 내부 그룹 키 (예: "deer" | "sciuridae" | "heron_egret")
  members?: [string, number][]; // 원라벨별 분포 (예: [["goat",0.72],["roe deer",0.15], ...])
  animal_id?: number; // (서버에서 제공 시)
};

// ---------- 1) 신고(무인증) ----------
export type ReportPayload = {
  animalId: number;
  locationId: number;
  status: 'checking' | 'accepted' | 'rejected';
  photoUri: string; // 'file://...' 포함
};

// (주의) 프로젝트 기존 postMultipart 유틸을 사용하던 버전이 있다면 아래를 유지/교체하세요.
// 여기서는 fetch를 직접 쓰지 않고, 기존 코드 맥락을 유지하기 위해 postMultipart를 그대로 씁니다.
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
export async function recognizeAnimal(photoUri: string): Promise<RecognizeTop> {
  const base = (API_BASE_URL || '').replace(/\/+$/, ''); // 예: http://192.168.45.122:8000/api
  const url = `${base}/ml/recognize/`; // ← 백엔드 그룹 뷰와 일치해야 함

  const form = new FormData();
  // ★ 백엔드가 'photo' 키를 받도록 구현되어 있음
  form.append('photo', {
    uri: photoUri,
    name: 'photo.jpg',
    type: 'image/jpeg',
  } as any);

  const res = await fetch(url, {
    method: 'POST',
    body: form,
    headers: { Accept: 'application/json' }, // Content-Type 자동 설정(Multipart)
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(msg || `HTTP ${res.status}`);
  }

  // 기대 응답: { label, label_ko?, prob?, group?, members? }
  const json = (await res.json()) ?? {};
  // 하위 호환: label 누락 시 안전 폴백
  return {
    label: json.label ?? '-',
    label_ko: json.label_ko,
    prob: json.prob,
    group: json.group,
    members: json.members,
    animal_id: json.animal_id,
  };
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
