// src/api/analytics.ts
import { auth } from '../utils/auth';
import { REPORT_POINTS_URL } from '../constants';

export type ReportPointRow = {
  lat: number;
  lng: number;
  region: string;
  count: number;
};

export async function fetchReportPoints(
  year: number,
  animal?: string,
): Promise<ReportPointRow[]> {
  const qs = new URLSearchParams({ year: String(year) });
  if (animal && animal.trim()) qs.set('animal', animal.trim());

  const url = `${REPORT_POINTS_URL}?${qs.toString()}`;

  const res = await auth(url, { method: 'GET' });
  if (!res.ok) throw new Error(String(res.status));

  const rows = (await res.json()) as ReportPointRow[] | any;
  // 백엔드 키: { lat,lng,count,region,city,district,address }
  // region이 빈 문자열일 수 있으므로 안전 처리
  return Array.isArray(rows)
    ? rows.map(r => ({
        lat: Number(r.lat),
        lng: Number(r.lng),
        region: String(r.region || r.district || r.city || ''),
        count: Number(r.count || 0),
      }))
    : [];
}
