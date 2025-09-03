import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { AppState, NativeModules, StatusBar, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNBootSplash from 'react-native-bootsplash';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import RootNavigator, {
  RootStackParamList,
} from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';

enableScreens();

type CustomSystemUIModule = {
  enableStickyHideNavKeepStatus: () => void;
};
const CustomSystemUI: CustomSystemUIModule | undefined = (NativeModules as any)
  ?.CustomSystemUI;

// 상단만 안전영역 적용 (앱 배경: 흰색)
function TopOnlySafeArea({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flex: 1,
        paddingTop: insets.top,
        paddingBottom: 0,
        backgroundColor: '#FFFFFF',
      }}
    >
      {children}
    </View>
  );
}

// 내비 배경도 흰색
const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#FFFFFF' },
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [initialRouteName, setInitialRouteName] =
    useState<keyof RootStackParamList>('Login');

  // 시스템 UI 세팅
  useEffect(() => {
    CustomSystemUI?.enableStickyHideNavKeepStatus?.();
    StatusBar.setHidden(false);
    StatusBar.setTranslucent(false);
    StatusBar.setBackgroundColor('#FFFFFF'); // 앱 화면은 흰 배경
    StatusBar.setBarStyle('dark-content'); // 검정 아이콘
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        CustomSystemUI?.enableStickyHideNavKeepStatus?.();
        StatusBar.setHidden(false);
        StatusBar.setTranslucent(false);
        StatusBar.setBackgroundColor('#FFFFFF');
        StatusBar.setBarStyle('dark-content');
      }
    });
    return () => sub.remove();
  }, []);

  // 토큰 읽어 초기 라우트 결정 + fail-safe
  useEffect(() => {
    const failSafe = setTimeout(() => RNBootSplash.hide({ fade: true }), 2500);
    (async () => {
      try {
        const token = await AsyncStorage.getItem('accessToken');
        setInitialRouteName(token ? 'MainTabs' : 'Login');
      } catch {
        setInitialRouteName('Login');
      } finally {
        setIsReady(true);
      }
    })();
    return () => clearTimeout(failSafe);
  }, []);

  if (!isReady) return null; // 스플래시 떠 있는 동안 JS는 렌더 안 함

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <TopOnlySafeArea>
            <AuthProvider>
              <NavigationContainer
                theme={navTheme}
                onReady={() => RNBootSplash.hide({ fade: true })}
              >
                <RootNavigator initialRouteName={initialRouteName} />
              </NavigationContainer>
            </AuthProvider>
          </TopOnlySafeArea>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
