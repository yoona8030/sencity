import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { API_BASE_URL } from '@env';

const AS = {
  enabled: 'offline_enabled',
  autoSync: 'offline_autoSync',
} as const;

// TODO: 실제 동기화할 엔드포인트 목록(예시)
export const API_BASE = API_BASE_URL;
const PREFETCH_ENDPOINTS = [
  '/animals/',
  '/location/regions/',
  '/notifications/latest/',
].map(p => `${API_BASE}${p}`);

export default function SettingsOffline() {
  const [enabled, setEnabled] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  useEffect(() => {
    (async () => {
      const [e, a] = await Promise.all([
        AsyncStorage.getItem(AS.enabled),
        AsyncStorage.getItem(AS.autoSync),
      ]);
      setEnabled(e === '1');
      setAutoSync(a !== '0');
    })();
  }, []);

  const saveEnabled = async (v: boolean) => {
    setEnabled(v);
    await AsyncStorage.setItem(AS.enabled, v ? '1' : '0');
  };
  const saveAutoSync = async (v: boolean) => {
    setAutoSync(v);
    await AsyncStorage.setItem(AS.autoSync, v ? '1' : '0');
  };

  const manualSync = async () => {
    if (!enabled) return;
    try {
      // 간단한 자리표시자: 여러 엔드포인트를 순차 프리페치
      for (const url of PREFETCH_ENDPOINTS) {
        try {
          await fetch(url, { method: 'GET' });
        } catch {}
      }
      Alert.alert(
        '동기화 시작',
        '데이터를 가져오는 중입니다. 잠시 후 반영됩니다.',
      );
    } catch {
      Alert.alert('오류', '동기화 중 문제가 발생했습니다.');
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      <View style={s.section}>
        <Text style={s.sectionLabel}>오프라인 데이터</Text>
        <View style={s.row}>
          <Text style={s.rowText}>오프라인 모드 사용</Text>
          <Switch
            value={enabled}
            onValueChange={saveEnabled}
            trackColor={{ false: '#ccc', true: '#FEBA15' }}
            thumbColor="#ffffff"
            ios_backgroundColor="#ccc"
          />
        </View>
        <View style={s.row}>
          <Text style={[s.rowText, !enabled && { color: '#999' }]}>
            백그라운드 자동 동기화
          </Text>
          <Switch
            value={autoSync}
            onValueChange={saveAutoSync}
            disabled={!enabled}
            trackColor={{ false: '#ccc', true: '#FEBA15' }}
            thumbColor="#ffffff"
            ios_backgroundColor="#ccc"
          />
        </View>
        <Pressable
          onPress={manualSync}
          style={[s.row, !enabled && { opacity: 0.5 }]}
        >
          <Text style={s.rowText}>지금 동기화</Text>
          <Ionicons name="cloud-download-outline" size={20} color="#111" />
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
});
