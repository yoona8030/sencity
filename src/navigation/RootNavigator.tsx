// src/navigation/RootNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Login from '../screens/Login';
import SignUp from '../screens/SignUp';
import TabNavigator from './TabNavigator';
import CustomerCenter from '../screens/CustomerCenter';
import Inquiry from '../screens/Inquiry';
import Notification from '../screens/Notification';
import AccountInfo from '../screens/AccountInfo';

export type RootStackParamList = {
  Login: undefined;
  FindEmail: undefined;
  FindPassword: undefined;
  SignUp: undefined;
  MainTabs: undefined;
  CustomerCenter: undefined;
  Inquiry: undefined;
  Notification: undefined;
  AccountInfo: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type Props = { accessToken: string | null };

export default function RootNavigator({ accessToken }: Props) {
  return (
    <Stack.Navigator
      // 로그인 연동 원하시면 주석 해제
      // initialRouteName={accessToken ? 'MainTabs' : 'Login'}
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        // ✅ 하단 흰 배경이 비치지 않도록 스택 씬 배경도 투명
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="SignUp" component={SignUp} />
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="CustomerCenter" component={CustomerCenter} />
      <Stack.Screen name="Inquiry" component={Inquiry} />
      <Stack.Screen name="Notification" component={Notification} />
      <Stack.Screen
        name="AccountInfo"
        component={AccountInfo}
        options={{ title: '내 정보 관리' }}
      />
    </Stack.Navigator>
  );
}
