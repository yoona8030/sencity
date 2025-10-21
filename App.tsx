// App.tsx (최종본)
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { InteractionManager } from 'react-native';

import { AppAlertProvider } from './src/components/AppAlertProvider';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PreferencesProvider } from './src/state/preferences';
import RootNavigator from './src/navigation/RootNavigator';
import {
  ensureDefaultChannel,
  attachForegroundFCMListener,
} from './src/utils/notifications';

// ✅ 추가: 부팅 시 메모리에 토큰 로드
import { loadTokensIntoMemory } from './src/utils/auth';

// ✅ 스플래시 최소 노출 시간
const MIN_SPLASH_MS = 1600;
const BOOT_START_AT = Date.now();

const AppTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#0E0E0E' },
};

// ✅ 추가: 부팅 단계에서 토큰을 메모리에 올린 뒤 자식 렌더
function BootLoader({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await loadTokensIntoMemory();
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return null; // 부팅 중엔 아무 것도 그리지 않음(네이티브 스플래시 유지)
  return <>{children}</>;
}

function AppInner() {
  const { isReady, user } = useAuth();
  const [navReady, setNavReady] = React.useState(false);
  const [bootHidden, setBootHidden] = React.useState(false);

  // ✅ 알림 채널 보장 + FCM 포그라운드 리스너 등록
  React.useEffect(() => {
    ensureDefaultChannel();
    const detach = attachForegroundFCMListener();
    return detach;
  }, []);

  // ✅ 네비 준비되면 + 최소 시간 충족 시에만 스플래시 숨김
  React.useEffect(() => {
    if (!isReady || !navReady || bootHidden) return;

    const task = InteractionManager.runAfterInteractions(() => {
      const elapsed = Date.now() - BOOT_START_AT;
      const remain = Math.max(0, MIN_SPLASH_MS - elapsed);

      const t = setTimeout(() => {
        setBootHidden(true);
      }, remain);

      return () => clearTimeout(t);
    });

    return () => task.cancel?.();
  }, [isReady, navReady, bootHidden]);

  // AuthContext 초기화(예: 사용자 세션 확인)가 끝날 때까지 스플래시 유지
  if (!isReady) return null;

  const initialRouteName = user ? 'MainTabs' : 'Login';

  return (
    <NavigationContainer theme={AppTheme} onReady={() => setNavReady(true)}>
      <RootNavigator initialRouteName={initialRouteName} />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0E0E0E' }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <PreferencesProvider>
            {/* ✅ 부팅 단계: 토큰 메모리 로드 후 AuthProvider 렌더 */}
            <BootLoader>
              <AuthProvider>
                <AppAlertProvider>
                  <AppInner />
                </AppAlertProvider>
              </AuthProvider>
            </BootLoader>
          </PreferencesProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
