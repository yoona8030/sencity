// src/navigation/RootNavigator.tsx
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Login from '../screens/Login';
import SignUp from '../screens/SignUp';
import TabNavigator from './TabNavigator';
import CustomerCenter from '../screens/CustomerCenter';
import Inquiry from '../screens/Inquiry';

export type RootStackParamList = {
  Login: undefined;
  FindEmail: undefined;
  FindPassword: undefined;
  SignUp: undefined;
  MainTabs: undefined;
  CustomerCenter: undefined;
  Inquiry: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

type Props = {
  accessToken: string | null;
};

export default function RootNavigator({ accessToken }: Props) {
  return (
    <Stack.Navigator
      // 로그인 여부에 따라 초기 화면을 바꾸고 싶다면 아래 주석을 풀어주세요.
      // initialRouteName={accessToken ? 'MainTabs' : 'Login'}
      initialRouteName="Login"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="SignUp" component={SignUp} />
      <Stack.Screen name="MainTabs" component={TabNavigator} />
      <Stack.Screen name="CustomerCenter" component={CustomerCenter} />
      <Stack.Screen name="Inquiry" component={Inquiry} />
    </Stack.Navigator>
  );
}
