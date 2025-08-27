import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  Switch,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type MypageNavProp = NativeStackNavigationProp<
  RootStackParamList,
  'CustomerCenter'
>;
type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;
};

const Mypage: React.FC = () => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const navigation = useNavigation<MypageNavProp>();

  const toggleNotifications = () => setNotificationsEnabled(prev => !prev);

  // 실제 로그아웃 처리
  const doLogout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userEmail');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' as never }],
        }),
      );
    } catch {
      Alert.alert('오류', '로그아웃 중 오류가 발생했습니다.');
    }
  };

  // 로그아웃 전 확인
  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '정말 로그아웃하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '확인', onPress: doLogout },
      ],
      { cancelable: true },
    );
  };

  // 실제 회원탈퇴 처리 (예: 서버 API 호출 포함)
  const doWithdraw = async () => {
    try {
      // TODO: 서버 API로 탈퇴 요청 (예: await api.delete('/user'))
      await AsyncStorage.clear();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Login' as never }],
        }),
      );
    } catch {
      Alert.alert('오류', '회원탈퇴 중 오류가 발생했습니다.');
    }
  };

  // 회원탈퇴 전 확인
  const handleWithdraw = () => {
    Alert.alert(
      '회원탈퇴',
      '정말 회원탈퇴하시겠습니까?\n(모든 정보가 삭제됩니다)',
      [
        { text: '취소', style: 'cancel' },
        { text: '확인', onPress: doWithdraw },
      ],
      { cancelable: true },
    );
  };

  const [displayName, setDisplayName] = useState('이름');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [editVisible, setEditVisible] = useState(false);

  // 추가: 저장된 프로필 로드
  useEffect(() => {
    (async () => {
      const name = (await AsyncStorage.getItem('profileName')) ?? '이름';
      const avatar = await AsyncStorage.getItem('profileAvatar');
      setDisplayName(name);
      setAvatarUri(avatar || null);
    })();
  }, []);

  // 추가: 사진 선택
  const pickImage = async () => {
    const res = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
    });
    if (!res.didCancel && res.assets?.[0]?.uri) {
      setAvatarUri(res.assets[0].uri);
    }
  };

  // 추가: 저장
  const saveProfile = async () => {
    await AsyncStorage.setItem('profileName', displayName);
    await AsyncStorage.setItem('profileAvatar', avatarUri || '');
    Alert.alert('완료', '프로필이 저장되었습니다.');
    setEditVisible(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>마이페이지</Text>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => navigation.navigate('Notification')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="notifications-outline" size={24} color="black" />
        </TouchableOpacity>
      </View>

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

      <View style={styles.menuSection}>
        <View style={styles.menuItem}>
          <View style={styles.menuIconText}>
            <Icon name="notifications-outline" size={24} />
            <Text style={styles.menuText}>알림 설정</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ false: '#ccc', true: '#FEBA15' }}
            thumbColor="#ffffff"
            ios_backgroundColor="#ccc"
          />
        </View>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('CustomerCenter')}
        >
          <View style={styles.menuIconText}>
            <Icon name="headset-outline" size={24} />
            <Text style={styles.menuText}>고객센터</Text>
          </View>
          <Icon name="chevron-forward" size={24} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('AccountInfo')}
        >
          <View style={styles.menuIconText}>
            <Icon name="person-circle-outline" size={24} />
            <Text style={styles.menuText}>내 정보 관리</Text>
          </View>
          <Icon name="chevron-forward" size={24} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem}>
          <View style={styles.menuIconText}>
            <Icon name="settings-outline" size={24} />
            <Text style={styles.menuText}>설정</Text>
          </View>
          <Icon name="chevron-forward" size={24} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.menuItem} onPress={handleWithdraw}>
          <View style={styles.menuIconText}>
            <Icon name="exit-outline" size={24} />
            <Text style={styles.menuText}>회원 탈퇴</Text>
          </View>
          <Icon name="chevron-forward" size={24} />
        </TouchableOpacity>
      </View>
      {/* 추가: 프로필 편집 모달 */}
      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditVisible(false)}
      >
        {/* 반투명 배경 */}
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalBackdrop}
          onPress={() => setEditVisible(false)}
        />
        {/* 중앙 카드 */}
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

  titleContainer: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center', // 세로 가운데 맞춤
    paddingHorizontal: 16,
    marginVertical: 10,
  },
  titleText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginRight: 8,
    textAlign: 'center', // 텍스트 자체는 가운데 정렬
    flex: 1, // 남은 공간 차지 → 중앙 정렬 효과
  },
  headerIconBtn: {
    position: 'absolute',
    right: 16,
    top: 20, // 헤더 높이에 맞춰 세로 위치 미세조정 (8~12 권장)
    padding: 4, // 터치 영역 보강
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  profileInfo: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: 'bold' },
  editProfile: { color: '#888', marginTop: 4, fontWeight: 'bold' },
  logout: { color: '#ff5a5f', fontWeight: 'bold' },

  menuSection: { flex: 1 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuIconText: { flexDirection: 'row', alignItems: 'center' },
  menuText: { fontSize: 16, marginLeft: 12, fontWeight: 'bold' },
  // 추가: 모달 스타일들
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
  modalBtnText: {
    color: '#333',
    fontWeight: '700',
  },
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
