import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';

const AS = {
  wifiOnly: 'ds_wifiOnly',
  autoClear: 'ds_autoClear', // '7' | '30' | '90' | '0'
} as const;

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  const k = 1024;
  const sizes = ['KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(n) / Math.log(k)), sizes.length);
  return `${(n / Math.pow(k, i)).toFixed(1)} ${sizes[i - 1]}`;
}

export default function SettingsDataStorage() {
  const [wifiOnly, setWifiOnly] = useState(true);
  const [autoClear, setAutoClear] = useState<'7' | '30' | '90' | '0'>('30');
  const [cacheSize, setCacheSize] = useState(0);

  useEffect(() => {
    (async () => {
      const [w, a] = await Promise.all([
        AsyncStorage.getItem(AS.wifiOnly),
        AsyncStorage.getItem(AS.autoClear),
      ]);
      setWifiOnly(w !== '0');
      setAutoClear((a as any) || '30');
      calcCache();
    })();
  }, []);

  const calcCache = async () => {
    try {
      const dirs = [
        RNFS.CachesDirectoryPath,
        RNFS.TemporaryDirectoryPath,
      ].filter(Boolean) as string[];
      let total = 0;
      for (const d of dirs) {
        const items = await RNFS.readDir(d);
        for (const it of items) {
          try {
            const stat = await RNFS.stat(it.path);
            total += stat.size;
          } catch {}
        }
      }
      setCacheSize(total);
    } catch {}
  };

  const saveWifiOnly = async (v: boolean) => {
    setWifiOnly(v);
    await AsyncStorage.setItem(AS.wifiOnly, v ? '1' : '0');
  };

  const cycleAutoClear = async () => {
    const order: ('7' | '30' | '90' | '0')[] = ['7', '30', '90', '0'];
    const next = order[(order.indexOf(autoClear) + 1) % order.length];
    setAutoClear(next);
    await AsyncStorage.setItem(AS.autoClear, next);
  };

  const clearCache = async () => {
    try {
      await RNFS.unlink(RNFS.CachesDirectoryPath).catch(() => {});
      await RNFS.mkdir(RNFS.CachesDirectoryPath).catch(() => {});
      if (RNFS.TemporaryDirectoryPath) {
        await RNFS.unlink(RNFS.TemporaryDirectoryPath).catch(() => {});
        await RNFS.mkdir(RNFS.TemporaryDirectoryPath).catch(() => {});
      }
      setCacheSize(0);
      Alert.alert('완료', '캐시가 삭제되었습니다.');
    } catch {
      Alert.alert('오류', '캐시 삭제 중 문제가 발생했습니다.');
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      {/* 네트워크 */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>네트워크</Text>
        <View style={s.row}>
          <Text style={s.rowText}>Wi-Fi에서만 다운로드</Text>
          <Switch
            value={wifiOnly}
            onValueChange={saveWifiOnly}
            trackColor={{ false: '#ccc', true: '#FEBA15' }}
            thumbColor="#ffffff"
            ios_backgroundColor="#ccc"
          />
        </View>
      </View>

      {/* 저장공간 */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>저장공간</Text>
        <View style={s.row}>
          <Text style={s.rowText}>캐시 용량</Text>
          <Text style={s.rightText}>{formatBytes(cacheSize)}</Text>
        </View>
        <Pressable onPress={clearCache} style={s.row}>
          <Text style={s.rowText}>캐시 비우기</Text>
          <Ionicons name="trash-outline" size={20} color="#e11d48" />
        </Pressable>
      </View>

      {/* 자동 정리 */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>자동 정리</Text>
        <Pressable onPress={cycleAutoClear} style={s.row}>
          <Text style={s.rowText}>자동 캐시 정리 주기</Text>
          <Text style={s.rightText}>
            {autoClear === '0' ? '사용 안 함' : `${autoClear}일`}
          </Text>
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
