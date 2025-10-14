import 'react-native-gesture-handler';
import 'react-native-reanimated';
import messaging from '@react-native-firebase/messaging';

messaging().setBackgroundMessageHandler(async remoteMessage => {});

// RN/Hermes에서 전역 top/window가 없어서 나는 에러를 막는 폴리필
if (typeof globalThis.top === 'undefined') globalThis.top = globalThis;
if (typeof globalThis.window === 'undefined') globalThis.window = globalThis;

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// FCM 백그라운드/종료 상태 핸들러 등록 (1회)
import { registerBackgroundFCMHandler } from './src/utils/notifications';
registerBackgroundFCMHandler();

if (__DEV__) {
  LogBox.ignoreLogs([
    /This method is deprecated .* React Native Firebase namespaced API/i,
    /Legacy Architecture is deprecated/i,
    // 필요하면 패턴을 더 추가
  ]);
}

AppRegistry.registerComponent(appName, () => App);
