import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  check,
  request,
  openSettings,
  RESULTS,
  PERMISSIONS,
  Permission,
  checkMultiple,
  requestMultiple,
} from 'react-native-permissions';

type PermItem = {
  key: string;
  label: string;
  perm: Permission | 'IOS_NOTIF_SPECIAL';
};

const PERMS: PermItem[] = [
  {
    key: 'camera',
    label: '카메라',
    perm:
      Platform.OS === 'android'
        ? PERMISSIONS.ANDROID.CAMERA
        : PERMISSIONS.IOS.CAMERA,
  },
  {
    key: 'media',
    label: Platform.OS === 'android' ? '사진/미디어' : '사진',
    perm:
      Platform.OS === 'android'
        ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES // Android 13+
        : PERMISSIONS.IOS.PHOTO_LIBRARY,
  },
  {
    key: 'microphone',
    label: '마이크',
    perm:
      Platform.OS === 'android'
        ? PERMISSIONS.ANDROID.RECORD_AUDIO
        : PERMISSIONS.IOS.MICROPHONE,
  },
];

function Badge({ ok }: { ok: boolean }) {
  return (
    <View style={s.badge}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'alert-circle'}
        size={16}
        color={ok ? '#17a34a' : '#e11d48'}
      />
      <Text style={[s.badgeText, { color: ok ? '#0f5132' : '#7f1d1d' }]}>
        {ok ? '허용됨' : '허용 필요'}
      </Text>
    </View>
  );
}

export default function SettingsPrivacy() {
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});

  const refresh = async () => {
    const result: Record<string, boolean> = {};
    for (const p of PERMS) {
      try {
        const r = await check(p.perm as Permission);
        result[p.key] = r === RESULTS.GRANTED || r === RESULTS.LIMITED;
      } catch {
        result[p.key] = false;
      }
    }
    setStatuses(result);
  };

  useEffect(() => {
    refresh();
  }, []);

  const ask = async (p: PermItem) => {
    try {
      const r = await request(p.perm as Permission);
      const ok = r === RESULTS.GRANTED || r === RESULTS.LIMITED;
      if (!ok) Alert.alert('안내', '설정에서 권한을 허용해 주세요.');
      refresh();
    } catch {
      Alert.alert('오류', '권한 요청 중 문제가 발생했습니다.');
    }
  };

  const gotoSettings = async () => {
    const supported = await Linking.canOpenURL('app-settings:');
    if (supported) openSettings();
    else Linking.openURL('app-settings:');
  };

  return (
    <SafeAreaView style={s.container} edges={['left', 'right']}>
      <View style={s.section}>
        <Text style={s.sectionLabel}>권한 관리</Text>
        {PERMS.map(p => (
          <View key={p.key} style={s.row}>
            <Text style={s.rowText}>{p.label}</Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Badge ok={!!statuses[p.key]} />
              <Pressable onPress={() => ask(p)} style={s.reqBtn}>
                <Text style={s.reqBtnText}>요청</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Pressable onPress={gotoSettings} style={s.row}>
          <Text style={s.rowText}>앱 권한 설정 열기</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </Pressable>
      </View>

      <View style={s.section}>
        <Text style={s.sectionLabel}>개인정보</Text>
        <Pressable
          onPress={() => Linking.openURL('https://example.com/privacy')}
          style={s.row}
        >
          <Text style={s.rowText}>개인정보 처리방침</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </Pressable>
        <Pressable
          onPress={() => Linking.openURL('https://example.com/licenses')}
          style={s.row}
        >
          <Text style={s.rowText}>오픈소스 라이선스</Text>
          <Ionicons name="chevron-forward" size={20} color="#999" />
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
  reqBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  reqBtnText: { fontWeight: '700', color: '#444' },
});
