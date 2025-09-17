// src/screens/SettingsLocation.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import Geolocation from 'react-native-geolocation-service';
import {
  check,
  request,
  openSettings,
  RESULTS,
  PERMISSIONS,
  Permission,
} from 'react-native-permissions';

type Nav = NativeStackNavigationProp<RootStackParamList, 'SettingsLocation'>;

const AS = {
  useCurrent: 'loc_useCurrent',
  defaultLat: 'loc_default_lat',
  defaultLng: 'loc_default_lng',
  defaultLabel: 'loc_default_label',
  accuracy: 'loc_accuracy',
} as const;

const permForPlatform = (): Permission =>
  Platform.OS === 'android'
    ? PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION
    : PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;

export default function SettingsLocation() {
  const navigation = useNavigation<Nav>();

  const [useCurrent, setUseCurrent] = useState<boolean>(true);
  const [defaultPos, setDefaultPos] = useState<{
    lat: number | null;
    lng: number | null;
    label?: string | null;
  }>({
    lat: null,
    lng: null,
    label: null,
  });
  const [accuracy, setAccuracy] = useState<'high' | 'balanced' | 'low'>(
    'balanced',
  );
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  // 초기 로드
  useEffect(() => {
    (async () => {
      const [u, lat, lng, label, acc] = await Promise.all([
        AsyncStorage.getItem(AS.useCurrent),
        AsyncStorage.getItem(AS.defaultLat),
        AsyncStorage.getItem(AS.defaultLng),
        AsyncStorage.getItem(AS.defaultLabel),
        AsyncStorage.getItem(AS.accuracy),
      ]);
      setUseCurrent(u !== '0');
      setDefaultPos({
        lat: lat ? +lat : null,
        lng: lng ? +lng : null,
        label: label ?? null,
      });
      setAccuracy((acc as any) || 'balanced');
    })();
    ensurePermission();
  }, []);

  const ensurePermission = async () => {
    const p = permForPlatform();
    const r = await check(p);
    if (r === RESULTS.GRANTED || r === RESULTS.LIMITED) {
      setHasPermission(true);
      return true;
    }
    if (r === RESULTS.DENIED) {
      const rq = await request(p);
      const ok = rq === RESULTS.GRANTED || rq === RESULTS.LIMITED;
      setHasPermission(ok);
      return ok;
    }
    setHasPermission(false);
    return false;
  };

  const saveUseCurrent = async (next: boolean) => {
    setUseCurrent(next);
    await AsyncStorage.setItem(AS.useCurrent, next ? '1' : '0');
    if (next) {
      const ok = await ensurePermission();
      if (!ok) return;
      Geolocation.getCurrentPosition(
        pos => {
          // 미리보기만 갱신 (기본 위치는 유지)
          console.log('current position', pos.coords);
        },
        err => console.warn(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 },
      );
    }
  };

  const openMapPicker = () => {
    navigation.navigate(
      'MapPicker',
      defaultPos.lat && defaultPos.lng
        ? { initial: { lat: defaultPos.lat, lng: defaultPos.lng } }
        : undefined,
    );
  };

  // MapPicker에서 돌아와 좌표를 받을 때 사용할 리스너 (navigate 대신 goBack 시 params로 돌려줘도 됨)
  useEffect(() => {
    const unsub = navigation.addListener('focus', async () => {
      // no-op: 필요하면 여기서 리프레시
    });
    return unsub;
  }, [navigation]);

  const saveAccuracy = async (v: 'high' | 'balanced' | 'low') => {
    setAccuracy(v);
    await AsyncStorage.setItem(AS.accuracy, v);
  };

  const clearDefault = async () => {
    setDefaultPos({ lat: null, lng: null, label: null });
    await AsyncStorage.multiRemove([
      AS.defaultLat,
      AS.defaultLng,
      AS.defaultLabel,
    ]);
  };

  const gotoOSSettings = async () => {
    const supported = await Linking.canOpenURL('app-settings:');
    if (supported) openSettings(); // react-native-permissions helper
    else Linking.openURL('app-settings:');
  };

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      {/* 권한 상태 */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>권한</Text>
        <View style={s.row}>
          <Text style={s.rowText}>위치 권한</Text>
          <Pressable onPress={gotoOSSettings} style={s.badge}>
            <Ionicons
              name={hasPermission ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={hasPermission ? '#17a34a' : '#e11d48'}
            />
            <Text
              style={[
                s.badgeText,
                { color: hasPermission ? '#0f5132' : '#7f1d1d' },
              ]}
            >
              {hasPermission ? '허용됨' : '허용 필요'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* 현재 위치 사용 */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>기본 동작</Text>
        <View style={s.row}>
          <Text style={s.rowText}>현재 위치 사용</Text>
          <Switch
            value={useCurrent}
            onValueChange={saveUseCurrent}
            trackColor={{ false: '#ccc', true: '#FEBA15' }}
            thumbColor="#ffffff" // ✅ 안드로이드 썸 색 흰색
            ios_backgroundColor="#ccc" // ✅ iOS에서 OFF일 때 트랙 뒷배경
          />
        </View>

        {!useCurrent && (
          <>
            <Pressable onPress={openMapPicker} style={s.row}>
              <Text style={s.rowText}>기본 위치 선택</Text>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </Pressable>

            <View style={s.subNote}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={s.subNoteText}>
                {defaultPos.lat && defaultPos.lng
                  ? `${defaultPos.label ?? ''} (${defaultPos.lat.toFixed(
                      5,
                    )}, ${defaultPos.lng.toFixed(5)})`
                  : '아직 선택되지 않았습니다.'}
              </Text>
              {!!defaultPos.lat && (
                <Pressable onPress={clearDefault} style={s.clearBtn}>
                  <Text style={s.clearBtnText}>지우기</Text>
                </Pressable>
              )}
            </View>
          </>
        )}
      </View>

      {/* 정확도 */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>정확도 · 배터리</Text>
        {(['high', 'balanced', 'low'] as const).map(v => (
          <Pressable key={v} onPress={() => saveAccuracy(v)} style={s.row}>
            <Text style={s.rowText}>
              {v === 'high'
                ? '높은 정확도'
                : v === 'balanced'
                ? '균형'
                : '저전력'}
            </Text>
            <Ionicons
              name={accuracy === v ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color="#FEBA15"
            />
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
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

  row: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: { fontSize: 16, color: '#111' },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f5f5f5',
  },
  badgeText: { marginLeft: 6, fontSize: 12, fontWeight: '700' },

  subNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  subNoteText: { flex: 1, color: '#555' },
  clearBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  clearBtnText: { fontWeight: '700', color: '#444' },
});
