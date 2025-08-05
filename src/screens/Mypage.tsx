import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Image,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

type MypageNavProp = NativeStackNavigationProp<
  RootStackParamList,
  'CustomerCenter'
>;

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.titleContainer}>
        <Text style={styles.titleText}>마이페이지</Text>
      </View>

      <View style={styles.profileSection}>
        <Image
          source={require('../../assets/images/logo2.png')}
          style={styles.avatar}
        />
        <View style={styles.profileInfo}>
          <Text style={styles.name}>이름</Text>
          <TouchableOpacity>
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

        <TouchableOpacity style={styles.menuItem}>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  titleContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  titleText: {
    fontSize: 24,
    fontWeight: 'bold',
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
});

export default Mypage;
