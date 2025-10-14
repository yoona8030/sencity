// App.tsx (전체본 - visit 이벤트 전송 + FCM 토큰 등록 보강)
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import RNBootSplash from 'react-native-bootsplash';
import { InAppNoticeHost } from './src/components/InAppNoticeHost';
import { AppAlertProvider } from './src/components/AppAlertProvider';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PreferencesProvider } from './src/state/preferences';
import RootNavigator from './src/navigation/RootNavigator';
import {
  ensureDefaultChannel,
  attachForegroundFCMListener,
} from './src/utils/notifications';
import { loadTokensIntoMemory } from './src/utils/auth';
// ★ FCM 토큰 등록/갱신 + 알림 권한
import {
  registerFcmTokenToServer,
  attachFcmTokenRefreshListener,
  watchAppStateForFcm,
} from './src/utils/fcm';
import { ensureNotificationPermission } from './src/utils/permissions';

// ★ 방문 이벤트 & AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendEvent } from './src/utils/metrics'; // sendEvent('visit') 호출용

const AppTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#0E0E0E' },
};

function AppInner() {
  const { isReady, user } = useAuth();
  const [navReady, setNavReady] = React.useState(false);

  // 1) 알림 채널 보장 + FCM 포그라운드 리스너
  React.useEffect(() => {
    ensureDefaultChannel();
    const detach = attachForegroundFCMListener();
    return detach; // 언마운트 시 구독 해제
  }, []);

  // 2) 권한 → 토큰 서버 등록 → 토큰 갱신 리스너
  React.useEffect(() => {
    let offRefresh: (() => void) | undefined;

    (async () => {
      try {
        const granted = await ensureNotificationPermission();
        if (granted) {
          await registerFcmTokenToServer(); // 초기 1회 등록
          offRefresh = attachFcmTokenRefreshListener();
          console.log('[FCM] setup done (permission/granted & token registered)');
        } else {
          console.log('[FCM] notification permission not granted');
        }
      } catch (e) {
        // 시뮬레이터/권한 거부/네트워크 이슈 등은 조용히 무시
      }
    })();

    return () => {
      if (offRefresh) offRefresh();
    };
  }, []);

  // 2-보강) 로그인 상태가 바뀌면 토큰 재등록(로그인 직후 보장 업서트)
  React.useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        await registerFcmTokenToServer();
      } catch {
        /* 무시 */
      }
    })();
  }, [user?.id]); // 사용자 식별자 변화에 반응

  // 3) 방문 이벤트(visit) — 로그인 시 하루 1회만
  React.useEffect(() => {
    (async () => {
      try {
        const access = await AsyncStorage.getItem('accessToken');
        if (!access) return; // 로그인된 경우에만 전송

        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const dayKey = `@visit.sent.${today}`;
        const done = await AsyncStorage.getItem(dayKey);
        if (!done) {
          await sendEvent('visit'); // 내부에서 Authorization 헤더 포함되도록 구현되어 있어야 함
          await AsyncStorage.setItem(dayKey, '1');
        }
      } catch {
        /* 무시 */
      }
    })();
  }, []);

  // 4) 스플래시 숨김 타이밍
  React.useEffect(() => {
    if (isReady && navReady) {
      requestAnimationFrame(() => RNBootSplash.hide({ fade: false }));
    }
  }, [isReady, navReady]);

  
  React.useEffect(() => {
    const off = watchAppStateForFcm();
    return off;
  }, []);

  // 초기화 완료 전에는 네이티브 스플래시 유지
  if (!isReady) return null;

  const initialRouteName = user ? 'MainTabs' : 'Login';

  return (
    <NavigationContainer theme={AppTheme} onReady={() => setNavReady(true)}>
      <RootNavigator initialRouteName={initialRouteName} />
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    // 앱 시작 시 저장된 토큰을 메모리에 올려둡니다.
    loadTokensIntoMemory().catch(() => {});
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0E0E0E' }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <PreferencesProvider>
            <AuthProvider>
              <AppAlertProvider>
                <InAppNoticeHost>
                  <AppInner />
                </InAppNoticeHost>
              </AppAlertProvider>
            </AuthProvider>
          </PreferencesProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
