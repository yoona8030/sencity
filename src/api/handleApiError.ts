// src/api/handleApiError.ts
import type { NavigationProp } from '@react-navigation/native';
import { ApiError } from './client';

type Notifier = (opt: {
  title: string;
  message: string;
}) => Promise<void> | void;

export async function handleApiError(
  err: unknown,
  notify: Notifier,
  navigation: NavigationProp<any>,
) {
  if (err instanceof ApiError) {
    await notify({ title: '오류', message: err.message });
    if (err.logout || err.status === 401) {
      // 로그인 화면으로 스택 리셋
      navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
    }
    return;
  }

  const message =
    (err as any)?.message || '요청 처리 중 알 수 없는 오류가 발생했습니다.';
  await notify({ title: '오류', message });
}
