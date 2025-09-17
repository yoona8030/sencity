// src/screens/Mypage.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Switch,
  TouchableOpacity,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { useAppAlert } from '../components/AppAlertProvider';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  check,
  request,
  RESULTS,
  PERMISSIONS,
  Permission,
} from 'react-native-permissions';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ROW_HEIGHT = 56;
const AS_KEYS = {
  profileName: 'profileName',
  profileAvatar: 'profileAvatar',
  notifEnabled: 'notifEnabled',
} as const;

const SETTINGS_ROUTE: keyof RootStackParamList = 'SettingsHome';

const Mypage: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { confirm, notify } = useAppAlert();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [displayName, setDisplayName] = useState('이름');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);

  // ---- 초기 로드
  useEffect(() => {
    (async () => {
      const [name, avatar, notif] = await Promise.all([
        AsyncStorage.getItem(AS_KEYS.profileName),
        AsyncStorage.getItem(AS_KEYS.profileAvatar),
        AsyncStorage.getItem(AS_KEYS.notifEnabled),
      ]);
      setDisplayName(name ?? '이름');
      setAvatarUri(avatar || null);
      if (notif != null) setNotificationsEnabled(notif === '1');
    })();
  }, []);

  const persistNotif = async (next: boolean) => {
    setNotificationsEnabled(next);
    try {
      await AsyncStorage.setItem(AS_KEYS.notifEnabled, next ? '1' : '0');
    } catch (e: any) {
      await notify({
        title: '오류',
        message: e?.message ?? '알림 설정 저장 중 오류가 발생했습니다.',
      });
    }
  };

  // ---- 로그아웃/탈퇴
  const doLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'accessToken',
        'refreshToken',
        'userEmail',
      ]);
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Login' as never }] }),
      );
    } catch (e: any) {
      await notify({
        title: '오류',
        message: e?.message ?? '로그아웃 중 오류가 발생했습니다.',
      });
    }
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: '로그아웃',
      message: '정말 로그아웃하시겠습니까?',
    });
    if (ok) await doLogout();
  };

  const doWithdraw = async () => {
    try {
      await AsyncStorage.clear();
      navigation.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Login' as never }] }),
      );
    } catch (e: any) {
      await notify({
        title: '오류',
        message: e?.message ?? '회원탈퇴 중 오류가 발생했습니다.',
      });
    }
  };

  const handleWithdraw = async () => {
    const ok = await confirm({
      title: '회원탈퇴',
      message: '정말 회원탈퇴하시겠습니까?\n(모든 정보가 삭제됩니다)',
    });
    if (ok) await doWithdraw();
  };

  // ---- 사진 권한 & 선택
  const photoPermissionForPlatform = (): Permission | null => {
    if (Platform.OS === 'android') {
      return PERMISSIONS.ANDROID.READ_MEDIA_IMAGES; // RN-permissions가 버전에 맞춰 내부 처리
    }
    if (Platform.OS === 'ios') return PERMISSIONS.IOS.PHOTO_LIBRARY;
    return null;
  };

  const ensurePhotoPermission = async (): Promise<boolean> => {
    const perm = photoPermissionForPlatform();
    if (!perm) return true;

    try {
      const res = await check(perm);
      if (res === RESULTS.GRANTED || res === RESULTS.LIMITED) return true;
      if (res === RESULTS.DENIED) {
        const req = await request(perm);
        return req === RESULTS.GRANTED || req === RESULTS.LIMITED;
      }
      if (res === RESULTS.BLOCKED) {
        await notify({
          title: '권한 필요',
          message: '설정에서 사진 권한을 허용해 주세요.',
        });
        return false;
      }
      return false;
    } catch {
      return false;
    }
  };

  const pickImage = async () => {
    const ok = await ensurePhotoPermission();
    if (!ok) return;

    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });

    if (!res.didCancel && res.assets?.[0]?.uri) {
      setAvatarUri(res.assets[0].uri);
    }
  };

  const saveProfile = async () => {
    try {
      await AsyncStorage.setItem(AS_KEYS.profileName, displayName);
      await AsyncStorage.setItem(AS_KEYS.profileAvatar, avatarUri || '');
      await notify({ title: '완료', message: '프로필이 저장되었습니다.' });
      setEditVisible(false);
    } catch (e: any) {
      await notify({
        title: '오류',
        message: e?.message ?? '프로필 저장 중 오류가 발생했습니다.',
      });
    }
  };

  // ---- 공용 메뉴 아이템
  const MenuItem: React.FC<{
    icon: string;
    label: string;
    onPress?: () => void;
    right?: React.ReactNode; // 우측 커스텀(스위치 등)
  }> = ({ icon, label, onPress, right }) => (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={!onPress}
    >
      <View style={styles.menuLeft}>
        <Icon name={icon} size={22} />
        <Text style={styles.menuText}>{label}</Text>
      </View>
      <View style={styles.menuRight}>
        {right ?? <Icon name="chevron-forward" size={22} color="#666" />}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* 프로필 */}
      <View style={styles.profileSection}>
        <Image
          source={
            avatarUri
              ? { uri: avatarUri }
              : require('../../assets/images/logo2.png')
          }
          style={styles.avatar}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.name}>{displayName}</Text>
          <TouchableOpacity onPress={() => setEditVisible(true)}>
            <Text style={styles.editProfile}>프로필 변경 &gt;</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>로그아웃</Text>
        </TouchableOpacity>
      </View>

      {/* 메뉴 */}
      <View style={styles.menuSection}>
        {/* 알림 설정 (우측 스위치) */}
        <MenuItem
          icon="notifications-outline"
          label="알림 설정"
          right={
            <Switch
              value={notificationsEnabled}
              onValueChange={persistNotif}
              trackColor={{ false: '#ccc', true: '#FEBA15' }}
              thumbColor="#ffffff"
              ios_backgroundColor="#ccc"
            />
          }
        />

        <MenuItem
          icon="headset-outline"
          label="고객센터"
          onPress={() => navigation.navigate('CustomerCenter' as never)}
        />

        <MenuItem
          icon="person-circle-outline"
          label="내 정보 관리"
          onPress={() => navigation.navigate('AccountInfo' as never)}
        />

        {/* 설정 - 다른 행과 동일 규격 */}
        <MenuItem
          icon="settings-outline"
          label="설정"
          onPress={() => navigation.navigate(SETTINGS_ROUTE as never)}
        />

        <MenuItem
          icon="exit-outline"
          label="회원 탈퇴"
          onPress={handleWithdraw}
        />
      </View>

      {/* 프로필 편집 모달 */}
      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalBackdrop}
          onPress={() => setEditVisible(false)}
        />
        <View style={styles.modalCenter} pointerEvents="box-none">
          <View style={styles.editCard}>
            <Text style={styles.editTitle}>프로필 변경</Text>

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>이름 변경</Text>
              <TextInput
                style={styles.formInput}
                placeholder="이름을 입력하세요"
                placeholderTextColor="#999"
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>

            <View style={[styles.formRow, { marginTop: 8 }]}>
              <Text style={styles.formLabel}>사진 변경</Text>
              <View style={styles.photoRow}>
                <Image
                  source={
                    avatarUri
                      ? { uri: avatarUri }
                      : require('../../assets/images/logo2.png')
                  }
                  style={styles.avatarPreview}
                />
                <TouchableOpacity style={styles.pickBtn} onPress={pickImage}>
                  <Text style={styles.pickBtnText}>사진 선택</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => setEditVisible(false)}
              >
                <Text style={[styles.modalBtnText, styles.cancelBtnText]}>
                  취소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={saveProfile}
              >
                <Text style={[styles.modalBtnText, styles.saveBtnText]}>
                  저장
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    marginTop: -10,
  },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  profileInfo: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: 'bold' },
  editProfile: { color: '#888', marginTop: 4, fontWeight: 'bold' },
  logout: { color: '#ff5a5f', fontWeight: 'bold' },

  menuSection: { flex: 1 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    height: ROW_HEIGHT, // 고정 높이로 아이콘/텍스트 정렬 통일
  },

  // 왼쪽: 아이콘 + 텍스트
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // 오른쪽: 화살표 아이콘 또는 스위치 (정중앙)
  menuRight: {
    height: ROW_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 32,
  },

  // 텍스트 통일
  menuText: {
    fontSize: 16,
    lineHeight: 22,
    marginLeft: 12,
    fontWeight: 'bold',
    color: '#000',
  },

  // 모달
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  modalCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  editCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  editTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  formRow: { marginTop: 6 },
  formLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 6,
    fontWeight: '600',
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#FFF',
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarPreview: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#eee',
  },
  pickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D0D0D0',
    backgroundColor: '#fff',
  },
  pickBtnText: { color: '#333', fontWeight: '700' },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 16,
    gap: 10,
  },
  modalBtn: {
    minWidth: 90,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnText: { color: '#333', fontWeight: '700' },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFF',
  },
  cancelBtnText: { color: '#8A8A8A', fontWeight: '700' },
  saveBtn: { backgroundColor: '#F5C64D' },
  saveBtnText: { color: '#fff', fontWeight: '800' },
});

export default Mypage;
