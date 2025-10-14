// src/api/report.ts
// 모든 요청은 src/api/client 의 request/postMultipart 를 통해 나갑니다.
// => Authorization 자동 부착 + 401 시 refresh 재시도

import { postMultipart } from './client'; // ✅ client.ts 사용

type Status = 'checking' | 'on_hold' | 'done';

// 서버 허용값으로 정규화 (completed 등 들어오면 done으로)
function normStatus(s?: string): Status {
  const v = (s || '').toLowerCase();
  if (v === 'on_hold') return 'on_hold';
  if (v === 'done' || v === 'completed' || v === 'complete' || v === 'finish')
    return 'done';
  return 'checking';
}

// === [로그인 신고] /api/reports/  (animal_id, location_id, image, status)
export async function createReportAuth(params: {
  animalId: number;
  locationId: number;
  status?: Status | 'completed';
  imageUri: string;
  imageType?: string;
  imageName?: string;
}) {
  const fd = new FormData();
  fd.append('animal_id', String(params.animalId));
  fd.append('location_id', String(params.locationId));
  fd.append('status', normStatus(params.status));
  fd.append('image', {
    uri: params.imageUri,
    type: params.imageType ?? 'image/jpeg',
    name: params.imageName ?? 'photo.jpg',
  } as any);

  // ✅ postMultipart는 FormData일 때 Content-Type 자동 처리 + Authorization 자동
  //    기본이 auth:true 이므로 토큰/리프레시 흐름은 client.ts에서 보장됨
  return postMultipart('/reports/', fd);
}

// === [비로그인 신고 - 위치ID] /api/reports/no-auth  (animalId, locationId, photo, status)
export async function createReportNoAuthByLocation(params: {
  animalId: number;
  locationId: number;
  status?: Status | 'completed';
  imageUri: string;
  imageType?: string;
  imageName?: string;
}) {
  const fd = new FormData();
  fd.append('animalId', String(params.animalId));
  fd.append('locationId', String(params.locationId));
  fd.append('status', normStatus(params.status));
  fd.append('photo', {
    uri: params.imageUri,
    type: params.imageType ?? 'image/jpeg',
    name: params.imageName ?? 'photo.jpg',
  } as any);

  // 비로그인 엔드포인트는 보통 auth 불필요
  return postMultipart('/reports/no-auth', fd, { auth: false });
}

// === [비로그인 신고 - 위경도] /api/reports/no-auth  (animalId, lat, lng, photo, status)
export async function createReportNoAuthByLatLng(params: {
  animalId: number;
  lat: number;
  lng: number;
  status?: Status | 'completed';
  imageUri: string;
  imageType?: string;
  imageName?: string;
}) {
  const fd = new FormData();
  fd.append('animalId', String(params.animalId));
  fd.append('lat', String(params.lat));
  fd.append('lng', String(params.lng));
  fd.append('status', normStatus(params.status));
  fd.append('photo', {
    uri: params.imageUri,
    type: params.imageType ?? 'image/jpeg',
    name: params.imageName ?? 'photo.jpg',
  } as any);

  return postMultipart('/reports/no-auth', fd, { auth: false });
}

// === 자동 라우팅
export async function createReportAuto(
  p:
    | ({ mode: 'auth' } & {
        animalId: number;
        locationId: number;
        imageUri: string;
        status?: Status | 'completed';
        imageType?: string;
        imageName?: string;
      })
    | ({ mode: 'noauth-location' } & {
        animalId: number;
        locationId: number;
        imageUri: string;
        status?: Status | 'completed';
        imageType?: string;
        imageName?: string;
      })
    | ({ mode: 'noauth-latlng' } & {
        animalId: number;
        lat: number;
        lng: number;
        imageUri: string;
        status?: Status | 'completed';
        imageType?: string;
        imageName?: string;
      }),
) {
  if (p.mode === 'auth') return createReportAuth(p);
  if (p.mode === 'noauth-location') return createReportNoAuthByLocation(p);
  return createReportNoAuthByLatLng(p);
}
