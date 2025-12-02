// src/api/ai.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '@env';

export const API_BASE = API_BASE_URL;

// 백엔드 분류기 API에 맞춘 정답버전
export async function recognizeAnimal(
  uri: string,
  opts?: { filename?: string; mime?: string; signal?: AbortSignal },
) {
  const access = await AsyncStorage.getItem('accessToken');
  if (!access) throw new Error('로그인이 필요합니다.');

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
  form.append('image', { uri, name, type: mime } as unknown as Blob);

  // ★ recognize → classify 로 수정
  const res = await fetch(`${API_BASE}/ai/classify/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${access}`,
    },
    body: form,
    signal: opts?.signal,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`recognize failed: ${res.status} ${text}`);
  }

  // 백엔드 응답 = { label: string, score: number }
  const json = (await res.json()) as { label: string; score: number };

  return {
    label: json.label,
    score: json.score, // CameraScreen이 기대하는 구조
  };
}
