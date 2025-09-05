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

type Props = {
  // ✅ App에서 받은 값만 사용 (자체 판정/상태/효과 없음)
  initialRouteName: keyof RootStackParamList;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator({ initialRouteName }: Props) {
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
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
