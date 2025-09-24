// src/navigation/RootNavigator.tsx
import React from 'react';
import {
  View,
  Image,
  Text,
  TouchableOpacity,
  StyleSheet as RNStyleSheet,
} from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
// 프리셋/팩토리만 유지 (이 파일에서는 화면 컴포넌트 import ❌)
import { headerPresets, makeG6Options } from './headerPresets';

// --------- Stack Param Types ---------
export type RootStackParamList = {
  // 그룹 1 (커스텀/풀스크린)
  Login: undefined;
  SignUp: undefined;

  // Tab 루트
  MainTabs: undefined;

  // 그룹 6 (좌 로고+타이틀 20 / 우 X)
  CustomerCenter: undefined;
  Inquiry: undefined;

  // 그룹 5 (중앙 18)
  Notification: { tab?: 'group' | 'individual' } | undefined;
  AccountInfo: undefined;
  SettingsHome: undefined;
  SettingsLocation: undefined;
  SettingsNotifications: undefined;
  SettingsDataStorage: undefined;
  SettingsOffline: undefined;
  SettingsPrivacy: undefined;
  SettingsAppInfo: undefined;
  FindEmail: undefined;
  FindPassword: undefined;

  // 커스텀/특수
  MapPicker: { initial?: { lat: number; lng: number } } | undefined;
  Camera: undefined;
};

type Props = {
  initialRouteName?: keyof RootStackParamList;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator({ initialRouteName = 'Login' }: Props) {
  return (
    <Stack.Navigator
      key={`root-${initialRouteName}`}
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0E0E0E' },
        animation: 'none', // ⬅️ 첫 렌더 전환 부드럽게 (필요시 'fade'로 교체)
      }}
    >
      {/* ===== 그룹 1: 커스텀/풀스크린 ===== */}
      <Stack.Screen
        name="Login"
        getComponent={() => require('../screens/Login').default}
      />
      <Stack.Screen
        name="SignUp"
        getComponent={() => require('../screens/SignUp').default}
      />

      {/* ===== Tab 루트 ===== */}
      <Stack.Screen
        name="MainTabs"
        getComponent={() => require('./TabNavigator').default}
      />

      {/* ===== 그룹 5: 중앙 18 (통일) ===== */}
      <Stack.Group screenOptions={headerPresets.g5Center18}>
        <Stack.Screen
          name="SettingsHome"
          getComponent={() => require('../screens/SettingsHome').default}
          options={({ navigation }) => ({
            // 0) 뒤로가기 제거
            headerBackVisible: false,
            headerLeft: () => null,
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#000" />
              </TouchableOpacity>
            ),

            // 1) 밑줄/그림자 제거 + 상하 패딩 0
            headerShadowVisible: false,
            headerStyle: {
              backgroundColor: '#fff',
              paddingTop: 0,
              paddingBottom: 0,
              elevation: 0, // Android
              shadowOpacity: 0, // iOS
              borderBottomWidth: 0,
            },
            // 프리셋이 배경에서 선을 그리면 이것으로 완전히 덮음
            headerBackground: () => (
              <View style={{ flex: 1, backgroundColor: '#fff' }} />
            ),

            // 2) 타이틀을 커스텀 Text로 → 폰트/마진 직접 제어
            headerTitle: () => (
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '500',
                  color: '#000',
                  marginBottom: -6,
                }}
              >
                설정
              </Text>
            ),
            // 타이틀 컨테이너 자체도 위로 끌어올림
            headerTitleContainerStyle: {
              marginBottom: -4, // 필요 시 -2 ~ -10 사이로 조절
            },
          })}
        />

        <Stack.Screen
          name="SettingsNotifications"
          getComponent={() =>
            require('../screens/SettingsNotifications').default
          }
          options={{
            headerBackVisible: true,
            headerLeft: undefined,
            headerRight: () => null,
            headerTintColor: '#000',

            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#fff' },
            headerBackground: () => (
              <View style={{ flex: 1, backgroundColor: '#fff' }} />
            ),

            // ⬇ 간격은 타이틀 컴포넌트에서만 조절
            headerTitle: () => (
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '500',
                  color: '#000',
                  marginBottom: -8,
                }}
              >
                알림 설정
              </Text>
            ),
          }}
        />

        <Stack.Screen
          name="SettingsLocation"
          getComponent={() => require('../screens/SettingsLocation').default}
          options={{
            headerBackVisible: true,
            headerLeft: undefined,
            headerRight: () => null,
            headerTintColor: '#000',

            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#fff' },
            headerBackground: () => (
              <View style={{ flex: 1, backgroundColor: '#fff' }} />
            ),
            headerTitle: () => (
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '500',
                  color: '#000',
                  marginBottom: -8,
                }}
              >
                지도 · 위치 설정
              </Text>
            ),
          }}
        />

        <Stack.Screen
          name="SettingsDataStorage"
          getComponent={() => require('../screens/SettingsDataStorage').default}
          options={{
            headerBackVisible: true,
            headerLeft: undefined,
            headerRight: () => null,
            headerTintColor: '#000',

            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#fff' },
            headerBackground: () => (
              <View style={{ flex: 1, backgroundColor: '#fff' }} />
            ),
            headerTitle: () => (
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '500',
                  color: '#000',
                  marginBottom: -8,
                }}
              >
                데이터 · 저장공간
              </Text>
            ),
          }}
        />

        <Stack.Screen
          name="SettingsOffline"
          getComponent={() => require('../screens/SettingsOffline').default}
          options={{
            headerBackVisible: true,
            headerLeft: undefined,
            headerRight: () => null,
            headerTintColor: '#000',

            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#fff' },
            headerBackground: () => (
              <View style={{ flex: 1, backgroundColor: '#fff' }} />
            ),
            headerTitle: () => (
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '500',
                  color: '#000',
                  marginBottom: -8,
                }}
              >
                오프라인 모드
              </Text>
            ),
          }}
        />

        <Stack.Screen
          name="SettingsPrivacy"
          getComponent={() => require('../screens/SettingsPrivacy').default}
          options={{
            headerBackVisible: true,
            headerLeft: undefined,
            headerRight: () => null,
            headerTintColor: '#000',

            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#fff' },
            headerBackground: () => (
              <View style={{ flex: 1, backgroundColor: '#fff' }} />
            ),
            headerTitle: () => (
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '500',
                  color: '#000',
                  marginBottom: -8,
                }}
              >
                개인정보 · 권한
              </Text>
            ),
          }}
        />

        <Stack.Screen
          name="SettingsAppInfo"
          getComponent={() => require('../screens/SettingsAppInfo').default}
          options={{
            headerBackVisible: true,
            headerLeft: undefined,
            headerRight: () => null,
            headerTintColor: '#000',

            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#fff' },
            headerBackground: () => (
              <View style={{ flex: 1, backgroundColor: '#fff' }} />
            ),
            headerTitle: () => (
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '500',
                  color: '#000',
                  marginBottom: -8,
                }}
              >
                앱 정보
              </Text>
            ),
          }}
        />

        <Stack.Screen
          name="AccountInfo"
          getComponent={() => require('../screens/AccountInfo').default}
          options={({ navigation }) => ({
            // 0) 뒤로가기 제거
            headerBackVisible: false,
            headerLeft: () => null,
            headerRight: () => (
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={20} color="#000" />
              </TouchableOpacity>
            ),

            // 1) 밑줄/그림자 제거 + 상하 패딩 0
            headerShadowVisible: false,
            headerStyle: {
              backgroundColor: '#fff',
              paddingTop: 0,
              paddingBottom: 0,
              elevation: 0, // Android
              shadowOpacity: 0, // iOS
              borderBottomWidth: 0,
            },
            // 프리셋이 배경에서 선을 그리면 이것으로 완전히 덮음
            headerBackground: () => (
              <View style={{ flex: 1, backgroundColor: '#fff' }} />
            ),

            // 2) 타이틀을 커스텀 Text로 → 폰트/마진 직접 제어
            headerTitle: () => (
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '500',
                  color: '#000',
                  marginBottom: -6,
                }}
              >
                개인 정보
              </Text>
            ),
            // 타이틀 컨테이너 자체도 위로 끌어올림
            headerTitleContainerStyle: {
              marginBottom: -4, // 필요 시 -2 ~ -10 사이로 조절
            },
          })}
        />

        <Stack.Screen
          name="Notification"
          getComponent={() => require('../screens/Notification').default}
          options={({ navigation, route }) => {
            const r = route as RouteProp<RootStackParamList, 'Notification'>;
            const current: 'group' | 'individual' = r.params?.tab ?? 'group';

            const Segmented = () => {
              const tabs = [
                { key: 'group' as const, label: '전체 공지' },
                { key: 'individual' as const, label: '내 알림' },
              ];

              return (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: 24, // 탭 간격
                    alignItems: 'flex-end', // 밑줄 기준 맞추기
                    paddingBottom: 2, // 헤더와 살짝 여유
                  }}
                >
                  {tabs.map(t => {
                    const active = current === t.key;
                    return (
                      <TouchableOpacity
                        key={t.key}
                        onPress={() => navigation.setParams({ tab: t.key })}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ alignItems: 'center' }}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: '700',
                            color: active ? '#111' : '#B0B0B0', // 활성: 진한 검정 / 비활성: 회색
                          }}
                        >
                          {t.label}
                        </Text>

                        {/* 🔽 리포트 화면처럼 텍스트 아래 검은 밑줄 */}
                        {active && (
                          <View
                            style={{
                              marginTop: 6,
                              height: 2,
                              backgroundColor: '#111', // 검은 선
                              alignSelf: 'stretch',
                              width: '100%',
                            }}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            };

            return {
              headerBackVisible: true,
              headerLeft: undefined,
              headerRight: () => null,
              headerTintColor: '#000',
              headerShadowVisible: false,
              headerStyle: { backgroundColor: '#fff' },
              headerBackground: () => (
                <View style={{ flex: 1, backgroundColor: '#fff' }} />
              ),
              headerTitle: () => <Segmented />, // ← 세그먼트 탭을 타이틀로 표시
            };
          }}
        />

        <Stack.Screen
          name="FindEmail"
          getComponent={() => require('../screens/FindEmail').default}
          options={{ headerTitle: '이메일 찾기' }}
        />
        <Stack.Screen
          name="FindPassword"
          getComponent={() => require('../screens/FindPassword').default}
          options={{ headerTitle: '비밀번호 찾기' }}
        />
      </Stack.Group>

      {/* ===== 그룹 6: 좌 로고+타이틀 20 / 우 X ===== */}
      <Stack.Screen
        name="CustomerCenter"
        getComponent={() => require('../screens/CustomerCenter').default}
        options={({ navigation }) => {
          const base = makeG6Options({
            title: '고객 센터',
            logoSource: require('../../assets/images/logo.png'),
            onClose: () => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('MainTabs' as never);
            },
          });

          return {
            ...base,
            // 밑줄은 유지(=헤더 하단 hairline), 그림자만 제거
            headerShadowVisible: false,
            headerStyle: {
              ...(base as any).headerStyle,
              backgroundColor: '#fff',
              paddingBottom: 14, // 타이틀과 밑줄 사이 간격
              elevation: 0, // Android shadow 제거
              shadowOpacity: 0, // iOS shadow 제거
            },
            // ✅ 여기서 내가 원하는 밑줄 직접 그림
            headerBackground: () => (
              <View style={{ flex: 1, backgroundColor: '#fff' }}>
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: RNStyleSheet.hairlineWidth,
                    backgroundColor: '#E2E2E2',
                  }}
                />
              </View>
            ),
            headerLeftContainerStyle: {
              ...(base as any).headerLeftContainerStyle,
              marginLeft: -8, // 로고 조금 더 왼쪽으로
              paddingLeft: 0,
            },
            headerLeft: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={{
                    width: 48,
                    height: 48,
                    resizeMode: 'contain',
                    marginRight: 10,
                  }}
                />
                <Text
                  style={{ fontSize: 22, fontWeight: '700', color: '#000' }}
                >
                  고객 센터
                </Text>
              </View>
            ),
          };
        }}
      />

      <Stack.Screen
        name="Inquiry"
        getComponent={() => require('../screens/Inquiry').default}
        options={({ navigation }) => {
          // 고객센터와 동일한 좌측 로고/타이틀을 쓰되, 밑줄은 제거
          const base = makeG6Options({
            title: '1:1 문의',
            logoSource: require('../../assets/images/logo.png'),
            onClose: () => {
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('MainTabs' as never);
            },
          });

          return {
            ...base,
            // 밑줄 제거 (탭 바가 있으니 헤더 하단 구분선 제거)
            headerShadowVisible: false,
            headerStyle: {
              ...(base as any).headerStyle,
              backgroundColor: '#fff',
              paddingBottom: 10, // 살짝 여백만
              elevation: 0, // Android shadow 제거
              shadowOpacity: 0, // iOS shadow 제거
              shadowColor: 'transparent',
              shadowRadius: 0,
              borderBottomWidth: 0,
            },
            headerLeftContainerStyle: {
              ...(base as any).headerLeftContainerStyle,
              marginLeft: -8,
              paddingLeft: 0,
            },
            headerLeft: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image
                  source={require('../../assets/images/logo.png')}
                  style={{
                    width: 48,
                    height: 48,
                    resizeMode: 'contain',
                    marginRight: 10,
                  }}
                />
                <Text
                  style={{ fontSize: 22, fontWeight: '700', color: '#000' }}
                >
                  문의하기
                </Text>
              </View>
            ),
          };
        }}
      />

      {/* ===== 커스텀/특수 ===== */}
      <Stack.Screen
        name="MapPicker"
        getComponent={() => require('../screens/MapPicker').default}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
