import 'react-native-gesture-handler';
import 'react-native-reanimated';
import React, { useEffect, useState } from 'react';
import { AppState, NativeModules, StatusBar, View } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { enableScreens } from 'react-native-screens';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// ★ AuthContext import 추가
import { AuthProvider } from './src/context/AuthContext';

enableScreens();

type CustomSystemUIModule = {
  enableStickyHideNavKeepStatus: () => void;
};
const CustomSystemUI: CustomSystemUIModule | undefined = (NativeModules as any)
  ?.CustomSystemUI;

// 상단만 안전영역 적용
function TopOnlySafeArea({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, paddingTop: insets.top, paddingBottom: 0 }}>
      {children}
    </View>
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: 'transparent' },
};

export default function App() {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    CustomSystemUI?.enableStickyHideNavKeepStatus?.();
    StatusBar.setHidden(false);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') {
        CustomSystemUI?.enableStickyHideNavKeepStatus?.();
        StatusBar.setHidden(false);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('accessToken');
      console.log('[App.tsx] 불러온 토큰:', token);
      setAccessToken(token);
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <StatusBar
            hidden={false}
            translucent
            backgroundColor="transparent"
            barStyle="dark-content"
          />
          <TopOnlySafeArea>
            {/* ★ 여기서 전체를 AuthProvider로 감싸줌 */}
            <AuthProvider>
              <NavigationContainer theme={navTheme}>
                <RootNavigator accessToken={accessToken} />
              </NavigationContainer>
            </AuthProvider>
          </TopOnlySafeArea>
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
