// src/screens/SettingsStyle.tsx
import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  InteractionManager,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePreferences } from '../state/preferences';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SettingsStyle'>;

const HEADER_ICON_SIZE = 24;

const Tile: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
}> = ({ label, selected, onPress }) => (
  <Pressable
    onPress={onPress}
    style={[
      styles.tile,
      {
        borderWidth: selected ? 2 : 1,
        borderColor: selected ? '#FEBA15' : '#ddd',
        backgroundColor: label === '다크' ? '#222' : '#f7f7f7',
      },
    ]}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    accessibilityLabel={`${label} 테마 선택`}
  >
    <Text style={{ color: label === '다크' ? '#fff' : '#111' }}>{label}</Text>
  </Pressable>
);

// 안전한 숫자 변환(초기 undefined 방지)
const toNumber = (v: unknown, fb = 1): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fb;

export default function SettingsStyle() {
  const navigation = useNavigation<Nav>();
  const { prefs, setTheme, setFontScale } = usePreferences();

  // 로컬 상태로 제어 → 손 뗄 때 전역 저장
  const [localScale, setLocalScale] = React.useState(() =>
    toNumber(prefs.fontScale, 1),
  );
  React.useEffect(() => {
    setLocalScale(toNumber(prefs.fontScale, 1));
  }, [prefs.fontScale]);

  // Android 초기 렌더링 이슈 회피: 전환/레이아웃 끝난 뒤 슬라이더 마운트
  const [showSlider, setShowSlider] = React.useState(false);
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      const task = InteractionManager.runAfterInteractions(() => {
        if (!cancelled) setShowSlider(true);
      });
      return () => {
        cancelled = true;
        setShowSlider(false);
        task.cancel();
      };
    }, []),
  );

  const back = () => navigation.goBack();
  const close = () =>
    navigation.canGoBack()
      ? navigation.goBack()
      : navigation.navigate('MainTabs' as never);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable onPress={back} hitSlop={12} style={styles.sideLeft}>
          <Ionicons name="chevron-back" size={HEADER_ICON_SIZE} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>화면 스타일 · 폰트</Text>
        <Pressable onPress={close} hitSlop={12} style={styles.sideRight}>
          <Ionicons name="close" size={HEADER_ICON_SIZE} color="#000" />
        </Pressable>
      </View>

      {/* 화면 스타일 */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>화면 스타일</Text>
        <View style={styles.tilesRow}>
          <View style={{ marginRight: 12 }}>
            <Tile
              label="시스템"
              selected={prefs.theme === 'system'}
              onPress={() => setTheme('system')}
            />
          </View>
          <View style={{ marginRight: 12 }}>
            <Tile
              label="라이트"
              selected={prefs.theme === 'light'}
              onPress={() => setTheme('light')}
            />
          </View>
          <Tile
            label="다크"
            selected={prefs.theme === 'dark'}
            onPress={() => setTheme('dark')}
          />
        </View>
      </View>

      {/* 글자 크기 · 글꼴 */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>글자 크기 · 글꼴</Text>
        <View style={styles.sliderWrap} pointerEvents="box-none">
          {showSlider ? (
            <Slider
              testID="font-scale-slider"
              value={localScale}
              onValueChange={(v: number) => setLocalScale(v)}
              onSlidingComplete={(v: number) => setFontScale(v)}
              minimumValue={0.9}
              maximumValue={1.3}
              step={0.05}
              style={styles.slider}
              minimumTrackTintColor="#FEBA15"
              maximumTrackTintColor="#E0E0E0"
              thumbTintColor={Platform.OS === 'android' ? '#FEBA15' : undefined}
              accessibilityLabel="글자 크기 조절 슬라이더"
            />
          ) : (
            <View style={[styles.slider, { backgroundColor: 'transparent' }]} />
          )}

          <Text style={styles.scaleText}>
            현재 배율: {localScale.toFixed(2)}
          </Text>
          <Text
            style={[styles.preview, { fontSize: Math.round(16 * localScale) }]}
          >
            미리보기: 이 크기로 표시됩니다.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    paddingHorizontal: 16,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideLeft: { width: 32, alignItems: 'flex-start', justifyContent: 'center' },
  sideRight: { width: 32, alignItems: 'flex-end', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },

  section: { marginTop: 8 },
  sectionLabel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    fontSize: 12,
    color: '#888',
  },

  tilesRow: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tile: {
    width: 96,
    height: 72,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sliderWrap: {
    paddingHorizontal: 16,
    zIndex: 10,
    elevation: 10,
  },
  slider: {
    height: 40,
    width: '100%',
  },
  scaleText: { marginTop: 8, color: '#555' },
  preview: { marginTop: 12 },
});
