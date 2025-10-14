// src/api/recognize.ts
import { Platform } from 'react-native';
import { API_BASE } from '../constants';

export type RecognizeTop = {
  label: string;
  label_ko?: string | null;
  animal_id?: number | null;
  prob?: number;
  topk?: any;
  [k: string]: any;
};

function normUri(uri: string) {
  // iOS에서 file:// 누락 대비
  if (
    Platform.OS === 'ios' &&
    uri &&
    !uri.startsWith('file://') &&
    uri.includes('/')
  ) {
    return `file://${uri}`;
  }
  return uri;
}

function guessName(uri: string) {
  const p = uri.split(/[\\/]/).pop() || 'photo.jpg';
  return p.includes('.') ? p : `${p}.jpg`;
}

function guessType(uri: string) {
  const low = uri.toLowerCase();
  if (low.endsWith('.png')) return 'image/png';
  if (low.endsWith('.webp')) return 'image/webp';
  if (low.endsWith('.heic') || low.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export async function recognizeAnimal(
  uri: string,
  name?: string,
  type?: string,
): Promise<RecognizeTop> {
  const u = normUri(uri);

  const form = new FormData();
  form.append('photo', {
    uri: u,
    name: name || guessName(u),
    type: type || guessType(u),
  } as any);

  // ✅ 정식 엔드포인트(+슬래시) & 그룹 모드
  const url = `${API_BASE}/ai/recognize/?grouped=1`; // 슬래시 포함!
  console.log('[AI] POST', url);

  // ⚠️ Content-Type은 직접 지정하지 말 것(경계 자동 생성)
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`recognize ${res.status} ${text}`);
  }

  let json: any = {};
  try {
    json = JSON.parse(text || '{}');
  } catch {
    throw new Error(`Invalid JSON: ${text}`);
  }

  // ✅ 그룹 응답 우선
  if (
    json?.mode === 'grouped' &&
    Array.isArray(json.results) &&
    json.results.length
  ) {
    const first = json.results[0] || {};
    return {
      label: String(first.label ?? first.rep_eng ?? '-'),
      label_ko: String(first.label ?? '') || null,
      prob: typeof first.prob === 'number' ? first.prob : 0,
      animal_id: typeof first.animal_id === 'number' ? first.animal_id : null,
      topk: json.results,
    };
  }

  // ⬇️ 단일 모드 폴백
  if (json?.mode === 'single' || json?.label !== undefined) {
    return {
      label: (json.label ?? '-').toString(),
      label_ko: json.label_ko ?? null,
      prob: typeof json.prob === 'number' ? json.prob : 0,
      animal_id: typeof json.animal_id === 'number' ? json.animal_id : null,
      topk: json.topk,
    };
  }

  // ⬇️ 최후 폴백(안전장치)
  const first = json?.results?.[0] ?? {};
  return {
    label: (first.label ?? first.rep_eng ?? '-').toString(),
    label_ko: first.label_ko ?? null,
    prob: typeof first.prob === 'number' ? first.prob : 0,
    animal_id: typeof first.animal_id === 'number' ? first.animal_id : null,
    topk: json?.results,
  };
}
