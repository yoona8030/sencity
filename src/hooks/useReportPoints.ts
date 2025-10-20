import { useEffect, useState, useCallback } from 'react';
import { fetchReportPoints } from '../api/report';
import type { ReportPoint } from '../types/report';

export function useReportPoints(enabled: boolean) {
  const [data, setData] = useState<ReportPoint[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    if (data) return; // 1회 캐시 (원하면 제거)
    try {
      setLoading(true);
      setErr(null);
      const rows = await fetchReportPoints();
      setData(rows);
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, [enabled, data]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, err, reload: () => setData(null) };
}
