// src/hooks/useReportPoints.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchReportPointsByScope } from '../api/report';
import type { ReportPoint } from '../types/report';

export type ReportScope = 'mine' | 'all';

export function useReportPoints(initialScope: ReportScope = 'all') {
  const [scope, setScope] = useState<ReportScope>(initialScope);
  const [points, setPoints] = useState<ReportPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sinceRef = useRef<string | undefined>(undefined);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchReportPointsByScope(scope, sinceRef.current);
      setPoints(rows);
      console.log(`[REPORT] fetched scope=${scope} count:`, rows.length);
    } catch (e: any) {
      setError(e?.message ?? '불러오기 실패');
      setPoints([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { scope, setScope, points, loading, error, reload };
}
