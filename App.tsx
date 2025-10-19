// App.tsx (완성본 예시: 교체해 넣으세요)
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

// ✅ 스플래시 최소 노출 시간 (원하시는 값으로 조절: 1200~2000ms 권장)
const MIN_SPLASH_MS = 1600;
// 스플래시 시작 시각(앱 로드 시점에 기록)
const BOOT_START_AT = Date.now();

const AppTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#0E0E0E' }, // 부트스플래시 배경과 색 맞추기
};

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

  // ✅ 네비 준비되면(첫 프레임 이후) + 최소 시간 충족 시에만 스플래시 숨김
  React.useEffect(() => {
    if (!isReady || !navReady || bootHidden) return;

    // 첫 프레임 이후로 미룬 다음, 남은 시간 계산
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

  // 초기화 끝날 때까지 네이티브 스플래시 유지 (여기서 별도 로고를 그리지 않음)
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
            <AuthProvider>
              <AppAlertProvider>
                <AppInner />
              </AppAlertProvider>
            </AuthProvider>
          </PreferencesProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
