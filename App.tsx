// App.tsx (수정본 핵심만)
import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { enableScreens } from 'react-native-screens';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import RNBootSplash from 'react-native-bootsplash'; // ✅ 여기서만 hide
import { AppAlertProvider } from './src/components/AppAlertProvider';
import { AuthProvider } from './src/context/AuthContext';
import { PreferencesProvider } from './src/state/preferences';
import AppNavigator from './src/navigation/AppNavigator';
import type { RootStackParamList } from './src/navigation/RootNavigator';

enableScreens();

function TopOnlySafeArea({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets(); // ✅ 훅은 컴포넌트 최상위
  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        backgroundColor: 'transparent',
      }}
    >
      {children}
    </View>
  );
}

const isValidToken = (v?: string | null) =>
  !!(v && v.trim() !== '' && v !== 'null' && v !== 'undefined');

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initialRouteName, setInitialRouteName] =
    useState<keyof RootStackParamList>('Login');

  // ✅ 항상 선언되는 첫 번째 훅
  useEffect(() => {
    (async () => {
      try {
        const [atk, rtk] = await AsyncStorage.multiGet([
          'accessToken',
          'refreshToken',
        ]);
        const signedIn = isValidToken(atk?.[1]) || isValidToken(rtk?.[1]);
        setInitialRouteName(signedIn ? 'MainTabs' : 'Login');
      } catch {
        setInitialRouteName('Login');
      } finally {
        setIsReady(true);
      }
    })();
  }, []);

  // ✅ 두 번째 훅(조건은 훅 "내부"에서 처리)
  useEffect(() => {
    if (isReady) RNBootSplash.hide({ fade: true }).catch(() => {});
  }, [isReady]);

  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FFFFFF',
        }}
      >
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Initializing…</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <PreferencesProvider>
            <AuthProvider>
              <AppAlertProvider>
                <TopOnlySafeArea>
                  <AppNavigator initialRouteName={initialRouteName} />
                </TopOnlySafeArea>
              </AppAlertProvider>
            </AuthProvider>
          </PreferencesProvider>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
