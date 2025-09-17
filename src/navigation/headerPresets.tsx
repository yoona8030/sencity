// src/navigation/headerPresets.tsx
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import React from 'react';
import { View, Image, Text, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

/**
 * 그룹 통일 원칙
 * - G4: 중앙 타이틀 20
 * - G5: 중앙 타이틀 18
 * - G6: 좌측 로고 + 타이틀 20 (우측 X)
 */

export const headerPresets = {
  /** G4: 상단 중앙, 타이틀 20 */
  g4Center20: {
    headerShown: true,
    headerTitleAlign: 'center',
    headerLargeTitle: false,
    headerTitleStyle: { fontSize: 20, fontWeight: '700' },
    headerShadowVisible: true,
  } satisfies NativeStackNavigationOptions,

  /** G5: 상단 중앙, 타이틀 18 */
  g5Center18: {
    headerShown: true,
    headerTitleAlign: 'center',
    headerLargeTitle: false,
    headerTitleStyle: { fontSize: 18, fontWeight: '700' },
    headerShadowVisible: true,
  } satisfies NativeStackNavigationOptions,

  /** G6 베이스: 좌측 정렬 + 뒤로 버튼 숨김(우측 X 사용) */
  g6BaseLeftLogo20: {
    headerShown: true,
    headerTitle: '',
    headerTitleAlign: 'left',
    headerBackVisible: false,
    headerShadowVisible: true,
  } satisfies NativeStackNavigationOptions,
};

/** G6 전용 옵션(통일: title 20, 좌 로고 / 우 X) */
export function makeG6Options(params: {
  title: string;
  logoSource: any; // e.g. require('../../assets/images/logo.png')
  onClose: () => void;
}): NativeStackNavigationOptions {
  const { title, logoSource, onClose } = params;

  return {
    ...headerPresets.g6BaseLeftLogo20,
    headerLeft: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Image
          source={logoSource}
          style={{
            width: 24,
            height: 24,
            marginRight: 8,
            resizeMode: 'contain',
          }}
        />
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#000' }}>
          {title}
        </Text>
      </View>
    ),
    headerRight: () => (
      <Pressable
        onPress={onClose}
        hitSlop={12}
        style={{ paddingHorizontal: 4 }}
      >
        <Ionicons name="close" size={24} color="#000" />
      </Pressable>
    ),
  };
}
