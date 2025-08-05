import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Home from '../screens/Home';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Camera from '../screens/Camera';
import Map from '../screens/Map';
import Mypage from '../screens/Mypage';
import Report from '../screens/Report';
import FontAwesome from 'react-native-vector-icons/FontAwesome';

const Tab = createBottomTabNavigator<TabParamList>();

export type TabParamList = {
  Home: undefined;
  Camera: undefined;
  Map: undefined;
  Mypage: undefined;
  Report: undefined;
};

export default function TabNavigator() {
  console.log('=== TabNavigator 진입 ===');
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'Home'; // 기본 아이콘 이름

          switch (route.name) {
            case 'Home':
              iconName = 'home-outline';
              break;
            case 'Camera':
              iconName = 'camera-outline';
              break;
            case 'Map':
              iconName = 'map-outline';
              break;
            case 'Mypage':
              iconName = 'person-outline';
              break;
            case 'Report':
              iconName = 'document-text-outline';
              break;
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#DD0000', // 선택된 탭의 색
        tabBarInactiveTintColor: 'gray', // 비활성 탭의 색
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopWidth: 1,
          borderTopColor: '#ccc',
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
