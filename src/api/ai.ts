// src/api/ai.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND = 'http://127.0.0.1:8000/api';

export async function recognizeAnimal(
  uri: string,
  opts?: { filename?: string; mime?: string; signal?: AbortSignal },
) {
  const access = await AsyncStorage.getItem('accessToken');
  if (!access) throw new Error('로그인이 필요합니다.');

  // 파일명/확장자/타입 안전하게 추출
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
  // RN에서는 { uri, name, type } 형태로 캐스팅 필요
  form.append('image', { uri, name, type: mime } as unknown as Blob);

  const res = await fetch(`${BACKEND}/ai/recognize`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${access}` },
    body: form, // Content-Type 수동 설정 금지
    signal: opts?.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`recognize failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    results?: Array<{ label: string; index: number; prob: number }>;
  };

  const top = json?.results?.[0];
  return {
    label: top?.label ?? '-',
    index: top?.index ?? -1,
    prob: top?.prob ?? 0,
    raw: json, // 필요하면 디버깅용
  };
}
