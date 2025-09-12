// src/screens/SettingsHome.tsx
import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ✅ 한 줄: 각 행 타입을 명확히
type Row = { label: string; route?: keyof RootStackParamList };

const HEADER_ICON_SIZE = 24;

// ✅ rows를 Row[]로 고정 (satisfies 또는 명시적 타입 사용)
const rows = [
  { label: '화면 스타일 · 폰트 설정', route: 'SettingsStyle' },
  { label: '알림 설정' },
  { label: '지도 · 위치 설정', route: 'SettingsLocation' },
  { label: '데이터 · 저장공간' },
  { label: '오프라인 모드' },
  { label: '개인정보 · 권한' },
  { label: '앱 정보' },
] as const satisfies readonly Row[];

export default function SettingsHome() {
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
      {/* 헤더: 중앙 타이틀 + 우측 X (상단에 더 붙도록 height 낮춤) */}
      <View style={styles.header}>
        <View style={styles.side} />
        <Text style={styles.headerTitle}>설정</Text>
        <Pressable onPress={close} hitSlop={12} style={styles.side}>
          <Ionicons name="close" size={HEADER_ICON_SIZE} color="#000" />
        </Pressable>
      </View>

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
  header: {
    paddingHorizontal: 16,
    height: 48, // 살짝 낮춰 상단에 더 붙이기
    flexDirection: 'row',
    alignItems: 'center',
  },
  side: { width: 32, alignItems: 'flex-end', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
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
