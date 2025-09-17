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

const AS = {
  enabled: 'notif_enabled',
  report: 'notif_report',
  marketing: 'notif_marketing',
} as const;

const ANDROID_POST_NOTIF: Permission | undefined = (PERMISSIONS as any)?.ANDROID
  ?.POST_NOTIFICATIONS;

// ✅ 플랫폼별 권한 선택 (없으면 null 반환)
const notifPermForPlatform = (): Permission | null => {
  if (Platform.OS === 'android' && ANDROID_POST_NOTIF) {
    return ANDROID_POST_NOTIF;
  }
  // iOS는 checkNotifications()/requestNotifications() 사용
  return null;
};

export default function SettingsNotifications() {
  const [enabled, setEnabled] = useState(true);
  const [report, setReport] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [osGranted, setOsGranted] = useState<boolean>(false);

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
    if (Platform.OS === 'ios') {
      const { status } = await checkNotifications();
      setOsGranted(status === 'granted');
      return;
    }
    const p = notifPermForPlatform();
    if (!p) return;
    const r = await check(p);
    setOsGranted(r === RESULTS.GRANTED || r === RESULTS.LIMITED);
  }, []);

  const reqPermission = useCallback(async () => {
    if (Platform.OS === 'ios') {
      const { status } = await requestNotifications([
        'alert',
        'badge',
        'sound',
      ]);
      setOsGranted(status === 'granted');
      if (status === 'blocked')
        Alert.alert('안내', '설정에서 알림을 허용해 주세요.');
      return;
    }
    const p = notifPermForPlatform();
    if (!p) return;
    const r = await request(p);
    const ok = r === RESULTS.GRANTED || r === RESULTS.LIMITED;
    setOsGranted(ok);
    if (!ok) Alert.alert('안내', '설정에서 알림을 허용해 주세요.');
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
    const supported = await Linking.canOpenURL('app-settings:');
    if (supported) openSettings();
    else Linking.openURL('app-settings:');
  };

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
          >
            <Ionicons
              name={osGranted ? 'checkmark-circle' : 'alert-circle'}
              size={16}
              color={osGranted ? '#17a34a' : '#e11d48'}
            />
            <Text
              style={[
                s.badgeText,
                { color: osGranted ? '#0f5132' : '#7f1d1d' },
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
