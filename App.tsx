// App.tsx (수정완료)
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import RNBootSplash from 'react-native-bootsplash';

import { AppAlertProvider } from './src/components/AppAlertProvider';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { PreferencesProvider } from './src/state/preferences';
import RootNavigator from './src/navigation/RootNavigator';
import {
  ensureDefaultChannel,
  attachForegroundFCMListener,
} from './src/utils/notifications';

const AppTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#0E0E0E' },
};

function AppInner() {
  const { isReady, user } = useAuth();
  const [navReady, setNavReady] = React.useState(false);

  // ✅ 알림 채널 보장 + FCM 포그라운드 리스너 등록
  React.useEffect(() => {
    // 채널(id: "default") 생성/보장
    ensureDefaultChannel();

    // 앱이 켜져 있을 때 들어오는 푸시를 직접 표시
    const detach = attachForegroundFCMListener();
    return detach; // 언마운트 시 해제
  }, []);

  // ⬅️ 훅은 조기 return 보다 위에!
  React.useEffect(() => {
    if (isReady && navReady) {
      requestAnimationFrame(() => RNBootSplash.hide({ fade: false }));
    }
  }, [isReady, navReady]);

  // 초기화 끝날 때까지 네이티브 스플래시 유지
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
