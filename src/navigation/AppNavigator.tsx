// src/navigation/AppNavigator.tsx
import React, { useEffect, useMemo } from 'react';
import { AppState, StatusBar, useColorScheme } from 'react-native';
import {
  NavigationContainer,
  DefaultTheme,
  DarkTheme,
} from '@react-navigation/native';
import RNBootSplash from 'react-native-bootsplash';
import { usePreferences } from '../state/preferences';
import RootNavigator, { RootStackParamList } from './RootNavigator';

type Props = { initialRouteName: keyof RootStackParamList };

export default function AppNavigator({ initialRouteName }: Props) {
  const system = useColorScheme();
  const { prefs } = usePreferences();
  const mode =
    prefs.theme === 'system'
      ? system === 'dark'
        ? 'dark'
        : 'light'
      : prefs.theme;
  const navTheme = useMemo(
    () => (mode === 'dark' ? DarkTheme : DefaultTheme),
    [mode],
  );

  useEffect(() => {
    const apply = () => {
      const isDark = mode === 'dark';
      StatusBar.setHidden(false);
      StatusBar.setTranslucent(false);
      StatusBar.setBackgroundColor(isDark ? '#000000' : '#FFFFFF');
      StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content');
    };
    apply();
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') apply();
    });
    return () => sub.remove();
  }, [mode]);

  return (
    <NavigationContainer
      theme={navTheme}
      onReady={() => RNBootSplash.hide({ fade: true })} // BootSplash 쓰면 유지, 아니면 삭제
    >
      <RootNavigator initialRouteName={initialRouteName} />
    </NavigationContainer>
  );
}
