import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NavigatorScreenParams } from '@react-navigation/native';

import Home from '../screens/Home';
import Camera from '../screens/Camera';
import Map from '../screens/Map';
import Mypage from '../screens/Mypage';
import Report from '../screens/Report';

// 탭 파라미터 타입
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
      screenOptions={({ route }) => ({
        headerShown: false,

        // ✅ 하단 안전영역을 0으로 강제 — 하얀 공백 제거 핵심
        safeAreaInsets: { bottom: 0 },

        // ✅ 씬 배경도 투명 — 시스템 바가 잠깐 나타나도 흰 바탕이 비치지 않게
        sceneContainerStyle: { backgroundColor: 'transparent' },

        // 키보드 올라올 때 탭 바 자동 숨김
        tabBarHideOnKeyboard: true,

        // ✅ 탭 바를 화면 바닥에 절대 배치 + 불필요 여백 제거
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 65, // 필요 시 조절
          paddingTop: 6,
          paddingBottom: 8, // 필요 시 0~8 사이 조절
          borderTopWidth: 0.5,
          borderTopColor: '#CCC',
          backgroundColor: '#FFFFFF',
          elevation: 8, // 안드로이드 그림자
        },

        tabBarLabelStyle: { fontSize: 11 },

        tabBarActiveTintColor: '#DD0000',
        tabBarInactiveTintColor: 'gray',

        // 아이콘 매핑
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
      <Tab.Screen name="Map" component={Map} />
      <Tab.Screen name="Report" component={Report} />
      <Tab.Screen name="Home" component={Home} />
      <Tab.Screen name="Camera" component={Camera} />
      <Tab.Screen name="Mypage" component={Mypage} />
    </Tab.Navigator>
  );
}
