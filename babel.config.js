module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: false,
        allowUndefined: true, // 변수값이 없어도 빌드 에러 X
      },
    ],
    'react-native-reanimated/plugin', // ← 반드시 마지막
  ],
};
