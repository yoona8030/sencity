// src/navigation/TabNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';

import Home from '../screens/Home';
import Camera from '../screens/Camera';
import Map from '../screens/Map';
import Mypage from '../screens/Mypage';
import Report from '../screens/Report';

export type TabParamList = {
  Home: undefined;
  Camera: undefined;
  Map: undefined;
  Mypage: undefined;
  Report: { focus?: 'stats' | 'history'; _t?: number } | undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export default function TabNavigator() {
  console.log('=== TabNavigator 진입 ===');

  return (
    <Tab.Navigator
      initialRouteName="Home"
      detachInactiveScreens={false}
      screenOptions={({ route }) => ({
        // 기본: 헤더 숨김 → 화면별 옵션에서 켜기 (그룹 4용)
        headerShown: false,

        // 하단 안전영역 여백 제거
        safeAreaInsets: { bottom: 0 },

        // 배경 깜빡임 방지
        sceneContainerStyle: { backgroundColor: '#0E0E0E' },

        tabBarHideOnKeyboard: true,

        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 65,
          paddingTop: 6,
          paddingBottom: 8,
          borderTopWidth: 0.5,
          borderTopColor: '#CCC',
          backgroundColor: '#FFFFFF',
          elevation: 8,
        },

        tabBarLabelStyle: { fontSize: 11 },
        tabBarActiveTintColor: '#DD0000',
        tabBarInactiveTintColor: 'gray',

        tabBarIcon: ({ color, size, focused }) => {
          let name: string = 'home-outline';
          switch (route.name) {
            case 'Home':
              name = focused ? 'home' : 'home-outline';
              break;
            case 'Camera':
              name = focused ? 'camera' : 'camera-outline';
              break;
            case 'Map':
              name = focused ? 'map' : 'map-outline';
              break;
            case 'Mypage':
              name = focused ? 'person' : 'person-outline';
              break;
            case 'Report':
              name = focused ? 'document-text' : 'document-text-outline';
              break;
          }
          return <Ionicons name={name} size={size} color={color} />;
        },
      })}
    >
      {/* 그룹 3: 지도 — 화면 내부에서 검색바/버튼 헤더 처리 */}
      <Tab.Screen
        name="Map"
        component={Map}
        options={{
          headerShown: false, // 타이틀 X (화면 내부 커스텀)
        }}
      />

      {/* 그룹 4: 신고 — 중앙 타이틀 20 (통일) */}
      <Tab.Screen
        name="Report"
        component={Report}
        options={{
          headerShown: true,
          headerTitle: '신고 통계 및 기록 조회 ',
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerTransparent: false,
          headerStyle: { backgroundColor: '#fff' },
        }}
      />

      {/* 그룹 2: 홈 — 타이틀 20 + 날짜/시간 14는 화면 내부에서 구현 */}
      <Tab.Screen
        name="Home"
        component={Home}
        options={{
          headerShown: false, // 홈 화면 자체 커스텀 헤더 사용
        }}
      />

      {/* (카메라는 정책에 따라 자유 — 여기선 숨김 유지) */}
      <Tab.Screen
        name="Camera"
        component={Camera}
        options={{
          headerShown: false,
        }}
      />

      {/* 그룹 4: 마이페이지 — 중앙 타이틀 20 (통일) */}
      <Tab.Screen
        name="Mypage"
        component={Mypage}
        options={({ navigation }) => ({
          headerShown: true,
          headerTitle: '마이페이지',
          headerTitleAlign: 'center',
          headerShadowVisible: false, // 아래 선/그림자 제거
          headerStyle: { backgroundColor: '#fff' },
          headerRight: () => (
            <Ionicons
              name="notifications-outline"
              size={22}
              color="#000"
              onPress={() => navigation.navigate('Notification' as never)}
              style={{ paddingRight: 12 }}
            />
          ),
        })}
      />
    </Tab.Navigator>
  );
}
