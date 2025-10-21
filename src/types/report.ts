// 서버가 /api/reports/my-points/에서 주는 원본 DTO
export type ApiReportPoint = {
  id: number;
  lat: number;
  lng: number;
  animal?: string | null;
  status?: string | null;
  date?: string | null;
  address?: string | null;
};

/** 앱 내부에서 사용하는 통일된 타입 */
export type ReportPoint = {
  id: number;
  lat: number;
  lng: number;
  animalName: string; // 표시용 이름
  status: string; // 표시용 상태
  createdAt: string; // ISO (혹은 빈 문자열)
  address: string; // 주소(없으면 빈 문자열)
};

/** 서버 DTO → 앱 타입 매핑 */
export function toReportPoint(api: ApiReportPoint): ReportPoint {
  return {
    id: Number(api.id),
    lat: Number(api.lat),
    lng: Number(api.lng),
    animalName: api.animal ?? '미상',
    status: api.status ?? '확인중',
    createdAt: api.date ?? '',
    address: api.address ?? '',
  };
}
