// src/api/ai.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND = 'http://127.0.0.1:8000/api';

// 서버 응답 정규화 타입
export type RecognizeTop = {
  label: string; // 정규화된 영문 (예: goat, wild boar, ...)
  label_ko?: string | null; // 한글 (예: 고라니, 멧돼지, ...)
  prob?: number;
  animal_id?: number | null;
  topk?: any;
};

export async function recognizeAnimal(
  uri: string,
  opts?: { filename?: string; mime?: string; signal?: AbortSignal },
): Promise<RecognizeTop> {
  // ⬇️ 토큰은 선택적으로만 사용 (엔드포인트는 AllowAny)
  const access = await AsyncStorage.getItem('accessToken').catch(() => null);

  // 파일명/타입 추출
  const clean = uri.split('?')[0];
  const ext = (clean.split('.').pop() || 'jpg').toLowerCase();
  const name = opts?.filename ?? `photo.${ext}`;
  const mime =
    opts?.mime ??
    (ext === 'png'
      ? 'image/png'
      : ext === 'heic' || ext === 'heif'
      ? 'image/heic'
      : 'image/jpeg');

  const form = new FormData();
  form.append('image', { uri, name, type: mime } as unknown as Blob); // 서버는 image/ photo 둘 다 허용

  const res = await fetch(`${BACKEND}/ai/recognize`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      ...(access ? { Authorization: `Bearer ${access}` } : {}), // 선택적 헤더
    },
    body: form, // Content-Type 자동
    signal: opts?.signal,
  });

  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`recognize failed: ${res.status} ${text}`);
  }

  let json: any;
  try {
    json = JSON.parse(text || '{}');
  } catch {
    throw new Error(`Invalid JSON: ${text}`);
  }

  // ✅ 서버 표준(single) 스키마 우선
  if (json?.mode === 'single' || json?.label !== undefined) {
    return {
      label: (json.label ?? '-').toString(), // ex) "goat"
      label_ko: json.label_ko ?? null, // ex) "고라니"
      prob: typeof json.prob === 'number' ? json.prob : 0,
      animal_id: typeof json.animal_id === 'number' ? json.animal_id : null,
      topk: json.topk,
    };
  }

  // ✅ grouped 호환: 최상위 1개만 정규화
  const first = json?.results?.[0] ?? {};
  return {
    label: (first.label ?? first.rep_eng ?? '-').toString(),
    label_ko: first.label_ko ?? null,
    prob: typeof first.prob === 'number' ? first.prob : 0,
    animal_id: typeof first.animal_id === 'number' ? first.animal_id : null,
    topk: json?.results,
  };
}
