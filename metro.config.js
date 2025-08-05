// const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// /**
//  * Metro configuration
//  * https://reactnative.dev/docs/metro
//  *
//  * @type {import('@react-native/metro-config').MetroConfig}
//  */

// const config = {};

// module.exports = mergeConfig(getDefaultConfig(__dirname), config);

// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = mergeConfig(defaultConfig, {
  resolver: {
    // ‘windows’ 플랫폼만 제거
    platforms: defaultConfig.resolver.platforms.filter(p => p !== 'windows'),
  },
});
