import 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

import { registerBackgroundFCMHandler } from './src/utils/notifications';
import { LogBox } from 'react-native';

/**
 * ✅ 백그라운드/종료 상태 FCM 처리
 *  - 엔트리에서 딱 1번만 등록
 *  - UI 모듈 사용 금지(Headless JS)
 */
registerBackgroundFCMHandler();

if (__DEV__) {
    LogBox.ignoreLogs([
        /This method is deprecated .* React Native Firebase namespaced API/i,
        /Legacy Architecture is deprecated/i,
        // 필요하면 패턴을 더 추가
    ]);
}

AppRegistry.registerComponent(appName, () => App);