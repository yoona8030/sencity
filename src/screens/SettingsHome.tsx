// src/screens/SettingsHome.tsx
import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ✅ 한 줄: 각 행 타입을 명확히
type Row = { label: string; route?: keyof RootStackParamList };

const HEADER_ICON_SIZE = 24;

// ✅ rows를 Row[]로 고정 (satisfies 또는 명시적 타입 사용)
const rows = [
  { label: '알림 설정', route: 'SettingsNotifications' },
  { label: '지도 · 위치 설정', route: 'SettingsLocation' },
  { label: '데이터 · 저장공간', route: 'SettingsDataStorage' },
  { label: '오프라인 모드', route: 'SettingsOffline' },
  { label: '개인정보 · 권한', route: 'SettingsPrivacy' },
  { label: '앱 정보', route: 'SettingsAppInfo' },
] as const satisfies readonly Row[];

export default function SettingsHome() {
  const insets = useSafeAreaInsets();
  const EXTRA_TOP = 4; // ← “조금” 내리고 싶을 때 6~12 사이로 조절
  const navigation = useNavigation<Nav>();

  const go = (route?: keyof RootStackParamList) => {
    if (!route) return;
    navigation.navigate(route);
  };

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs' as never);
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* ✅ FlatList<Row> 로 타입 고정 */}
      <FlatList<Row>
        data={rows as readonly Row[]}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => (
          <Pressable onPress={() => go(item.route)} style={styles.row}>
            <Text style={styles.rowText}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={() => (
          <Text style={styles.sectionLabel}>일반</Text>
        )}
        contentContainerStyle={{ paddingBottom: 12 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: '400',
    color: '#888',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: { fontSize: 16, color: '#111', fontWeight: '400' },
  separator: { height: 1, backgroundColor: '#eee', marginLeft: 16 },
});
