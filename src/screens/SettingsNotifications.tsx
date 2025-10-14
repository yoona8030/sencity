import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  Pressable,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  checkNotifications,
  requestNotifications,
  check,
  request,
  openSettings,
  RESULTS,
  PERMISSIONS,
  Permission,
} from 'react-native-permissions';
// ✅ 푸시 토큰 강제 재발급/재등록 유틸 추가
import { forceRefreshFcmTokenAndRegister } from '../utils/fcm';

const AS = {
  enabled: 'notif_enabled',
  report: 'notif_report',
  marketing: 'notif_marketing',
} as const;

/**
 * Android 13(API 33)+ 에서만 POST_NOTIFICATIONS 권한을 요청.
 * - 타입 정의가 구버전일 수 있으므로 any 캐스팅으로 안전 접근
 * - 상수가 없으면 null 반환 → 권한 요청 스킵
 */
const getAndroidPostNotif = (): Permission | null => {
  if (Platform.OS !== 'android') return null;
  if (typeof Platform.Version === 'number' && Platform.Version < 33) return null;

  const maybe = (PERMISSIONS.ANDROID as any)?.POST_NOTIFICATIONS;
  return maybe ? (maybe as Permission) : null;
};

export default function SettingsNotifications() {
  const [enabled, setEnabled] = useState(true);
  const [report, setReport] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [osGranted, setOsGranted] = useState<boolean>(false);
  const [fixing, setFixing] = useState(false); // ✅ 재설정 로딩 상태

  useEffect(() => {
    (async () => {
      const [e, r, m] = await Promise.all([
        AsyncStorage.getItem(AS.enabled),
        AsyncStorage.getItem(AS.report),
        AsyncStorage.getItem(AS.marketing),
      ]);
      setEnabled(e !== '0');
      setReport(r !== '0');
      setMarketing(m === '1');
    })();
    refreshPermission();
  }, []);

  const refreshPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        const { status } = await checkNotifications();
        setOsGranted(status === 'granted');
        return;
      }
      // ANDROID
      const perm = getAndroidPostNotif();
      if (!perm) {
        // Android 12 이하 또는 상수 미지원 → 런타임 권한 없음
        setOsGranted(true);
        return;
      }
      const r = await check(perm);
      setOsGranted(r === RESULTS.GRANTED || r === RESULTS.LIMITED);
    } catch {
      // 체크 실패 시 보수적으로 미허용 표시
      setOsGranted(false);
    }
  }, []);

  const reqPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'ios') {
        const { status } = await requestNotifications(['alert', 'badge', 'sound']);
        setOsGranted(status === 'granted');
        if (status === 'blocked') {
          Alert.alert('안내', '설정에서 알림을 허용해 주세요.');
        }
        return;
      }

      // ANDROID
      const perm = getAndroidPostNotif();
      if (!perm) {
        // Android 12 이하: 요청 다이얼로그 없음 → 허용으로 처리
        setOsGranted(true);
        return;
      }
      const r = await request(perm);
      const ok = r === RESULTS.GRANTED || r === RESULTS.LIMITED;
      setOsGranted(ok);
      if (!ok) Alert.alert('안내', '설정에서 알림을 허용해 주세요.');
    } catch {
      setOsGranted(false);
      Alert.alert('오류', '알림 권한 요청 중 문제가 발생했습니다.');
    }
  }, []);

  const saveEnabled = async (v: boolean) => {
    setEnabled(v);
    await AsyncStorage.setItem(AS.enabled, v ? '1' : '0');
    if (v) reqPermission();
  };
  const saveReport = async (v: boolean) => {
    setReport(v);
    await AsyncStorage.setItem(AS.report, v ? '1' : '0');
  };
  const saveMarketing = async (v: boolean) => {
    setMarketing(v);
    await AsyncStorage.setItem(AS.marketing, v ? '1' : '0');
  };

  const gotoOsSettings = async () => {
    try {
      await openSettings();
    } catch {
      const supported = await Linking.canOpenURL('app-settings:');
      if (supported) Linking.openURL('app-settings:');
      else Alert.alert('안내', '설정 화면을 열 수 없습니다. 수동으로 열어주세요.');
    }
  };

  // ✅ 푸시 연결 재설정: 토큰 삭제 → 재발급 → 서버 재등록
  const onFixPush = useCallback(async () => {
    if (fixing) return;
    setFixing(true);
    try {
      await forceRefreshFcmTokenAndRegister();
      Alert.alert('완료', '푸시 연결을 재설정했어요.');
    } catch {
      Alert.alert('오류', '재설정 중 문제가 발생했습니다.');
    } finally {
      setFixing(false);
    }
  }, [fixing]);

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      {/* 권한 */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>권한</Text>

        <View style={s.row}>
          <Text style={s.rowText}>푸시 알림 권한</Text>
          <Pressable
            onPress={osGranted ? refreshPermission : reqPermission}
            style={s.badge}
            pointerEvents="auto"
          >
            <Ionicons
              name={osGranted ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={osGranted ? '#17a34a' : '#DD0000'}
            />
            <Text
              style={[
                s.badgeText,
                { color: osGranted ? '#0f5132' : '#DD0000' },
              ]}
            >
              {osGranted ? '허용됨' : '허용 필요'}
            </Text>
          </Pressable>
        </View>

        <Pressable onPress={gotoOsSettings} style={s.row}>
          <Text style={s.rowText}>시스템 알림 설정 열기</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </Pressable>
      </View>

      {/* 앱 내 알림 */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>알림 종류</Text>

        <View style={s.row}>
          <Text style={s.rowText}>앱 푸시 알림 사용</Text>
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
            신고 처리/답변 알림
          </Text>
          <Switch
            value={report}
            onValueChange={saveReport}
            disabled={!enabled}
            trackColor={{ false: '#ccc', true: '#FEBA15' }}
            thumbColor="#ffffff"
            ios_backgroundColor="#ccc"
          />
        </View>

        <View style={s.row}>
          <Text style={[s.rowText, !enabled && { color: '#999' }]}>
            공지/소식 알림
          </Text>
          <Switch
            value={marketing}
            onValueChange={saveMarketing}
            disabled={!enabled}
            trackColor={{ false: '#ccc', true: '#FEBA15' }}
            thumbColor="#ffffff"
            ios_backgroundColor="#ccc"
          />
        </View>
      </View>

      {/* ✅ 문제시 즉시 복구: 푸시 연결 재설정 */}
      <View style={s.section}>
        <Text style={s.sectionLabel}>문제 해결</Text>
        <Pressable onPress={onFixPush} style={s.row} disabled={fixing}>
          <Text style={s.rowText}>
            {fixing ? '재설정 중…' : '푸시 연결 재설정'}
          </Text>
          <Ionicons name={fixing ? 'time' : 'refresh'} size={20} color="#999" />
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
});
