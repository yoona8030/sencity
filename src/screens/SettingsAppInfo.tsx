import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DeviceInfo from 'react-native-device-info';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SettingsAppInfo() {
  const [version, setVersion] = useState('');
  const [build, setBuild] = useState('');
  const [bundleId, setBundleId] = useState('');
  const [device, setDevice] = useState('');

  useEffect(() => {
    setVersion(DeviceInfo.getVersion());
    setBuild(String(DeviceInfo.getBuildNumber()));
    setBundleId(DeviceInfo.getBundleId());
    DeviceInfo.getDeviceName()
      .then(setDevice)
      .catch(() => setDevice(''));
  }, []);

  const resetAllSettings = async () => {
    try {
      // ⚠️ 앱 전체 설정 초기화: prefix 기준으로 삭제하거나, 확실하면 AsyncStorage.clear()
      await AsyncStorage.clear();
      Alert.alert('완료', '앱 설정이 초기화되었습니다.\n앱을 재시작해 주세요.');
    } catch {
      Alert.alert('오류', '초기화 중 문제가 발생했습니다.');
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      <View style={s.section}>
        <Text style={s.sectionLabel}>앱 버전</Text>
        <View style={s.row}>
          <Text style={s.rowText}>버전</Text>
          <Text style={s.rightText}>{version}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.rowText}>빌드</Text>
          <Text style={s.rightText}>{build}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.rowText}>패키지</Text>
          <Text style={s.rightText}>{bundleId}</Text>
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionLabel}>디바이스</Text>
        <View style={s.row}>
          <Text style={s.rowText}>디바이스명</Text>
          <Text style={s.rightText}>{device || '-'}</Text>
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionLabel}>고객지원</Text>
        <Pressable onPress={() => {}} style={s.row}>
          <Text style={s.rowText}>문의: ya8030@naver.com</Text>
          <Ionicons name="mail-outline" size={20} color="#111" />
        </Pressable>
      </View>

      <View style={s.section}>
        <Text style={s.sectionLabel}>기타</Text>
        <Pressable onPress={resetAllSettings} style={s.row}>
          <Text style={[s.rowText, { color: '#b91c1c', fontWeight: '700' }]}>
            저장된 설정 초기화
          </Text>
          <Ionicons name="warning-outline" size={20} color="#b91c1c" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  section: { marginTop: 8 },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    fontSize: 12,
    color: '#888',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: { fontSize: 16, color: '#111' },
  rightText: { fontSize: 14, color: '#374151' },
});
