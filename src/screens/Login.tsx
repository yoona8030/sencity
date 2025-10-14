// src/screens/Login.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Pressable,
  GestureResponderEvent,
  ActivityIndicator,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAppAlert } from '../components/AppAlertProvider';
import Checkbox from '../components/Checkbox';
import { useAuth } from '../context/AuthContext';

// ⬇️ 추가: 서버 로그인 + 토큰 저장
import { login, handleLoginSuccess } from '../api/auth';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function Login({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const topGap = Math.max(insets.top, 0) + 20;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const { notify, confirm } = useAppAlert();
  const { signIn } = useAuth(); // (email, password) 시그니처

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('savedEmail');
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (loading) return; // 더블탭 방지
    if (!email || !password) {
      await notify({ title: '알림', message: '이메일과 비밀번호를 모두 입력해주세요.' });
      return;
    }

    try {
      setLoading(true);

      const cleanedEmail = email.trim().toLowerCase();
      const cleanedPassword = password.trim();

      // 1) 서버 로그인 (한 번만)
      const data = await login(cleanedEmail, cleanedPassword);

      // 2) 토큰 저장 (반드시 await, 한 번만)
      await handleLoginSuccess(data); // 내부에서 access/refresh AsyncStorage 저장

      // 3) 이메일 저장 옵션
      if (remember) await AsyncStorage.setItem('savedEmail', cleanedEmail);
      else await AsyncStorage.removeItem('savedEmail');

      // 4) (선택) 전역 컨텍스트에 "로그인됨" 표시만 하고 끝내세요.
      //    signIn(email, password)처럼 서버 재호출하는 함수는 사용하지 않는 게 안전합니다.
      //    만약 반드시 컨텍스트를 갱신해야 한다면, signIn 대신 setAuthenticated(true) 같은 토큰기반 API를 쓰세요.
      // await setAuthenticated(true); // 예시(컨텍스트 구현에 따라)

      // 5) 메인으로 이동 (토큰 저장 완료 후)
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });

    } catch (e: any) {
      await notify({ title: '로그인 실패', message: e?.message ?? '다시 시도해주세요.' });
    } finally {
      setLoading(false);
    }
  };
  
  type LoginButtonProps = {
    iconName?: string;
    iconSource?: any;
    text: string;
    onPress: (event: GestureResponderEvent) => void;
    imageStyle?: any;
  };

  const LoginButton = ({
    iconName,
    iconSource,
    text,
    onPress,
    imageStyle,
  }: LoginButtonProps) => (
    <TouchableOpacity
      style={styles.snsButton}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {iconSource ? (
        <Image source={iconSource} style={[styles.snsIconImage, imageStyle]} />
      ) : (
        <Icon
          name={iconName || 'question'}
          size={24}
          color="#000"
          style={styles.snsIcon}
        />
      )}
      <Text style={styles.snsButtonText}>{text}</Text>
    </TouchableOpacity>
  );

  const handleGoogleLogin = async () => {
    const ok = await confirm({
      title: '알림',
      message: 'SENCITY에서 Google을 열려고 합니다',
    });
    if (ok) console.log('Google 로그인');
  };
  const handleNaver = async () => {
    const ok = await confirm({
      title: '알림',
      message: 'SENCITY에서 Naver를 열려고 합니다',
    });
    if (ok) console.log('Naver 로그인');
  };
  const handleFacebookLogin = async () => {
    const ok = await confirm({
      title: '알림',
      message: 'SENCITY에서 Facebook을 열려고 합니다',
    });
    if (ok) console.log('Facebook 로그인');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* 상단: 로고 + 타이틀 */}
      <View style={[styles.header, { marginTop: topGap }]}>
        <Image
          source={require('../../assets/images/logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title} numberOfLines={2}>
          SENCITY{'\n'}로그인
        </Text>
      </View>

      {/* 본문 */}
      <View style={styles.body}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>이메일</Text>
          <TextInput
            style={styles.input}
            onChangeText={setEmail}
            value={email}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>비밀번호</Text>
          <TextInput
            style={[styles.input, { color: '#000' }]}
            onChangeText={setPassword}
            value={password}
            secureTextEntry
          />
        </View>

        <View style={{ width: '100%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Checkbox checked={remember} onChange={setRemember} size={18} />
            <Text
              style={{
                marginLeft: 10,
                fontSize: 14,
                color: '#000',
                fontWeight: '500',
              }}
            >
              로그인 정보 저장
            </Text>
          </View>
        </View>

        <Pressable
          style={[styles.loginButton, loading && { opacity: 0.6 }]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>로그인</Text>
          )}
        </Pressable>

        <View style={styles.orContainer}>
          <View style={styles.line} />
          <Text style={styles.orText}>OR</Text>
          <View style={styles.line} />
        </View>

        <View style={styles.snsButtons}>
          <LoginButton
            iconSource={require('../../assets/images/google.png')}
            text="Google 로그인"
            onPress={handleGoogleLogin}
          />
          <LoginButton
            iconSource={require('../../assets/images/naver.png')}
            text="Naver 로그인"
            onPress={handleNaver}
            imageStyle={styles.naverIcon}
          />
          <LoginButton
            iconSource={require('../../assets/images/facebook.png')}
            text="Facebook 로그인"
            onPress={handleFacebookLogin}
          />

          <View style={styles.findContainer}>
            <Text
              style={styles.findText}
              onPress={() => navigation.navigate('FindEmail')}
            >
              이메일 찾기
            </Text>
            <Text
              style={styles.findText}
              onPress={() => navigation.navigate('FindPassword')}
            >
              비밀번호 찾기
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  logo: { width: 103, height: 94, marginBottom: 16 },
  title: {
    fontSize: 35,
    lineHeight: 38,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#000',
  },
  body: { flex: 1, width: '100%', paddingHorizontal: 20, alignItems: 'center' },

  inputContainer: { width: '100%', marginBottom: 8 },
  label: { marginBottom: 5, fontSize: 15, fontWeight: '600', color: '#000000' },
  input: {
    width: '100%',
    backgroundColor: '#F8F4E1',
    padding: 10,
    borderRadius: 5,
  },

  loginButton: {
    backgroundColor: '#FEBA15',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 5,
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  loginButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 20 },

  orContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 0,
    width: '100%',
  },
  line: { flex: 1, height: 1, backgroundColor: '#D2D2D2' },
  orText: {
    marginHorizontal: 10,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },

  snsButtons: { marginTop: 12, alignItems: 'center', width: '100%' },
  snsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 5,
    marginVertical: 3,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  snsIcon: { marginRight: 10 },
  snsIconImage: { width: 24, height: 24, marginRight: 10, resizeMode: 'contain' },
  naverIcon: { transform: [{ scale: 1.2 }] },
  snsButtonText: { fontSize: 16, color: '#000', fontWeight: '600' },

  findContainer: {
    flexDirection: 'column',
    marginTop: 15,
    width: '100%',
    alignItems: 'center',
    paddingBottom: 30,
  },
  findText: {
    color: 'red',
    textDecorationLine: 'underline',
    fontWeight: '600',
    fontSize: 14,
  },
});
