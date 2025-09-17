// screens/AccountInfo.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

const BACKEND_URL = 'http://127.0.0.1:8000/api'; // 프로젝트에 맞게 조정
// const BACKEND_URL = 'http://172.18.35.178/api'; // wifi

type Profile = {
  name: string;
  email: string;
  address: string;
  phone: string;
  consent_marketing: boolean;
  consent_terms: boolean;
  consent_location: boolean;
};

export default function AccountInfo() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState<Profile>({
    name: '',
    email: '',
    address: '',
    phone: '',
    consent_marketing: false,
    consent_terms: false,
    consent_location: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- 비밀번호 변경 필드 (확인 입력 제거) ---
  const [currentPwd, setCurrentPwd] = useState(''); // 변경
  const [newPwd, setNewPwd] = useState(''); // 변경

  // 전화번호 포맷팅
  const formatPhone = (raw: string) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.startsWith('02')) {
      if (digits.length <= 2) return digits;
      if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
      if (digits.length <= 9)
        return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(
        6,
        10,
      )}`;
    }
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
  };

  const emailOk = (e: string) => /^\S+@\S+\.\S+$/.test(e);

  const validateProfile = () => {
    if (!profile.name.trim()) {
      Alert.alert('확인', '이름을 입력하세요.');
      return false;
    }
    if (!emailOk(profile.email.trim())) {
      Alert.alert('확인', '올바른 이메일 형식을 입력하세요.');
      return false;
    }
    const phoneOk = /^\d{2,3}-\d{3,4}-\d{4}$/.test(profile.phone);
    if (profile.phone && !phoneOk) {
      Alert.alert('확인', '휴대폰 번호 형식을 확인하세요. (예: 010-1234-5678)');
      return false;
    }
    if (!profile.consent_terms) {
      // 추가: 이용약관 미동의 시 저장 불가
      Alert.alert('확인', '이용약관 동의가 필요합니다.');
      return false;
    }
    return true;
  };

  // --- 비밀번호 검증 (현재/새 둘 중 하나라도 입력되면 둘 다 필수) ---
  const wantChangePassword = () =>
    currentPwd.trim().length > 0 || newPwd.trim().length > 0; // 변경

  const validatePassword = () => {
    // 변경
    if (!wantChangePassword()) return true;
    if (!currentPwd.trim() || !newPwd.trim()) {
      Alert.alert(
        '확인',
        '현재 비밀번호(선택)와 새 비밀번호를 모두 입력하세요.',
      );
      return false;
    }
    if (newPwd.length < 8) {
      Alert.alert('확인', '새 비밀번호는 8자 이상이어야 합니다.');
      return false;
    }
    if (newPwd === currentPwd) {
      Alert.alert('확인', '새 비밀번호가 기존 비밀번호와 같습니다.');
      return false;
    }
    return true;
  };

  // 토큰 기반 요청(401 시 refresh 재시도)
  const authFetch = useCallback(
    async (input: RequestInfo, init?: RequestInit) => {
      const access = await AsyncStorage.getItem('accessToken');
      const doFetch = async (token: string | null) =>
        fetch(input, {
          ...(init || {}),
          headers: {
            'Content-Type': 'application/json',
            ...(init?.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

      let res = await doFetch(access);
      if (res.status === 401) {
        const refresh = await AsyncStorage.getItem('refreshToken');
        if (refresh) {
          const r = await fetch(`${BACKEND_URL}/token/refresh/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh }),
          });
          if (r.ok) {
            const json = await r.json();
            if (json.access) {
              await AsyncStorage.setItem('accessToken', json.access);
              res = await doFetch(json.access);
            }
          }
        }
      }
      return res;
    },
    [],
  );

  // 프로필 조회
  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${BACKEND_URL}/user/profile/`);
      if (!res.ok) throw new Error(`load ${res.status}`);
      const data = await res.json();
      setProfile({
        name: data.name ?? data.first_name ?? '',
        email: data.email ?? '',
        address: data.address ?? '',
        phone: data.phone ? formatPhone(String(data.phone)) : '',
        consent_marketing: !!data.consent_marketing,
        consent_terms: !!data.consent_terms,
        consent_location: !!data.consent_location,
      });
    } catch (e) {
      Alert.alert('오류', '내 정보 불러오기에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  // 저장
  const saveProfile = async () => {
    if (!validateProfile()) return;
    if (!validatePassword()) return;

    setSaving(true);
    try {
      // 1) 프로필 저장
      const payload = {
        name: profile.name.trim(),
        first_name: profile.name.trim(),
        email: profile.email.trim(),
        user_address: profile.address.trim(), // ← 주소
        address: profile.address.trim(), // ← 별칭도 같이(무해)
        telphone: profile.phone.replace(/\D/g, ''), // ← 숫자만
        phone: profile.phone.replace(/\D/g, ''), // ← 별칭도 같이(무해)
        agree: profile.consent_terms, // ← 약관동의
        consent_terms: profile.consent_terms, // ← 별칭도 같이(무해)
        consent_location: profile.consent_location,
        consent_marketing: profile.consent_marketing,
      };
      await authFetch(`${BACKEND_URL}/user/profile/`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      // 2) 비밀번호 변경 (선택)
      if (wantChangePassword()) {
        const pwPayload = {
          current_password: currentPwd,
          new_password: newPwd,
        };
        let ok = false;
        let pwRes = await authFetch(`${BACKEND_URL}/user/change-password/`, {
          method: 'POST',
          body: JSON.stringify(pwPayload),
        });
        if (pwRes.status === 404) {
          pwRes = await authFetch(`${BACKEND_URL}/auth/password/change/`, {
            method: 'POST',
            body: JSON.stringify(pwPayload),
          });
        }
        if (pwRes.ok) ok = true;
        if (!ok) {
          const text = await pwRes.text();
          throw new Error(`password change failed: ${pwRes.status} ${text}`);
        }
      }

      Alert.alert('완료', '변경사항이 저장되었습니다.');
      setCurrentPwd(''); // 추가
      setNewPwd(''); // 추가
    } catch (e: any) {
      Alert.alert(
        '오류',
        e?.message?.includes('password')
          ? '비밀번호 변경에 실패했습니다.'
          : '저장에 실패했습니다.',
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>불러오는 중…</Text>
      </View>
    );
  }

  // 추가: 저장 가능 여부(이용약관 동의 ON & 저장중 아님)
  const canSave = profile.consent_terms && !saving; // 추가

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.field}>
          <Text style={styles.label}>이름</Text>
          <TextInput
            style={styles.input}
            placeholder="이름"
            placeholderTextColor="#999"
            value={profile.name}
            onChangeText={t => setProfile(p => ({ ...p, name: t }))}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
            placeholder="example@email.com"
            placeholderTextColor="#999"
            value={profile.email}
            onChangeText={t => setProfile(p => ({ ...p, email: t }))}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>주소</Text>
          <TextInput
            style={styles.input}
            placeholder="주소"
            placeholderTextColor="#999"
            value={profile.address}
            onChangeText={t => setProfile(p => ({ ...p, address: t }))}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>휴대폰 번호</Text>
          <TextInput
            keyboardType="phone-pad"
            style={styles.input}
            placeholder="010-1234-5678"
            placeholderTextColor="#999"
            value={profile.phone}
            onChangeText={t =>
              setProfile(p => ({ ...p, phone: formatPhone(t) }))
            }
            maxLength={13}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>현재 비밀번호 (선택)</Text>
          <TextInput
            style={styles.input}
            placeholder="현재 비밀번호"
            placeholderTextColor="#999"
            value={currentPwd}
            onChangeText={setCurrentPwd}
            secureTextEntry
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>새 비밀번호</Text>
          <TextInput
            style={styles.input}
            placeholder="새 비밀번호"
            placeholderTextColor="#999"
            value={newPwd}
            onChangeText={setNewPwd}
            secureTextEntry
          />
        </View>

        <Text style={[styles.sectionTitle, { marginTop: 15 }]}>동의 항목</Text>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>이용약관 동의 (필수)</Text>
          <Switch
            value={profile.consent_terms}
            onValueChange={v => setProfile(p => ({ ...p, consent_terms: v }))}
            trackColor={{ false: '#ccc', true: '#FEBA15' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>위치정보 수집 동의</Text>
          <Switch
            value={profile.consent_location}
            onValueChange={v =>
              setProfile(p => ({ ...p, consent_location: v }))
            }
            trackColor={{ false: '#ccc', true: '#FEBA15' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>마케팅 수신 동의</Text>
          <Switch
            value={profile.consent_marketing}
            onValueChange={v =>
              setProfile(p => ({ ...p, consent_marketing: v }))
            }
            trackColor={{ false: '#ccc', true: '#FEBA15' }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.saveBtn,
            canSave ? styles.saveBtnEnabled : styles.saveBtnDisabled, // 추가
          ]}
          onPress={saveProfile}
          disabled={!canSave} // 추가
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>저장</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 15, paddingBottom: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#000' },
  field: { marginTop: 10 },
  label: { fontSize: 13, color: '#333', marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 0,
    height: 44,
    lineHeight: 16, // ← 고정 (fontSize 대비 20~22 추천)
    fontWeight: '400',
    fontSize: 16,
    color: '#222',
    backgroundColor: '#FFF',
    textAlignVertical: 'center', // ← 세로 정렬 고정
    includeFontPadding: false, // ← 안드로이드 폰트 내부패딩 제거
    // 폰트 패밀리 고정(디바이스별 폴백 차이 방지)
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  switchRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchLabel: { fontSize: 16, color: '#000' },
  saveBtn: {
    marginTop: 18,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnEnabled: { backgroundColor: '#F5C64D' }, // 노란색 (활성)
  saveBtnDisabled: { backgroundColor: '#CFCFCF' }, // 회색 (비활성)
  saveBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
