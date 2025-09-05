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
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CheckBox } from 'react-native-elements';
import Icon from 'react-native-vector-icons/FontAwesome';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAppAlert } from '../components/AppAlertProvider'; // ✅ 전역 알림 훅

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const BACKEND_URL = 'http://127.0.0.1:8000/api';

export default function Login({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);

  const { notify, confirm } = useAppAlert(); // ✅ 사용

  // 저장된 이메일 불러오기
  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('savedEmail');
      if (saved) {
        setEmail(saved);
        setRemember(true);
      }
    })();
  }, []);

  // 실서버 연동 로그인
  const handleLogin = async () => {
    if (!email || !password) {
      await notify({
        title: '알림',
        message: '이메일과 비밀번호를 모두 입력해주세요.',
      });
      return;
    }

    try {
      setLoading(true);

      const cleanedEmail = email.trim().toLowerCase();
      const cleanedPassword = password.trim();

      const res = await fetch(`${BACKEND_URL}/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanedEmail,
          password: cleanedPassword,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        let message = '이메일 또는 비밀번호가 올바르지 않습니다.';
        try {
          const j = JSON.parse(txt);
          message = j?.detail || j?.message || message;
        } catch {
          /* ignore */
        }
        await notify({ title: '로그인 실패', message });
        return;
      }

      const data = await res.json();
      const access = data.access || data.token || null;
      const refresh = data.refresh || null;

      if (!access) {
        await notify({ title: '오류', message: '토큰을 받지 못했습니다.' });
        return;
      }

      await AsyncStorage.setItem('accessToken', access);
      if (refresh) await AsyncStorage.setItem('refreshToken', refresh);

      if (remember) {
        await AsyncStorage.setItem('savedEmail', cleanedEmail);
      } else {
        await AsyncStorage.removeItem('savedEmail');
      }

      await notify({ title: '완료', message: `${cleanedEmail}님 환영합니다!` });

      // 홈으로 전환(스택 리셋)
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (e: any) {
      await notify({
        title: '오류',
        message: e?.message ?? '서버와의 통신에 실패했습니다.',
      });
    } finally {
      setLoading(false);
    }
  };

  type LoginButtonProps = {
    iconName?: string;
    iconSource?: any;
    text: string;
    onPress: (event: GestureResponderEvent) => void;
  };

  const LoginButton = ({
    iconName,
    iconSource,
    text,
    onPress,
  }: LoginButtonProps) => {
    return (
      <TouchableOpacity
        style={styles.snsButton}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {iconSource ? (
          <Image source={iconSource} style={styles.snsIconImage} />
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
  };

  // SNS 로그인: 전역 confirm 사용 (취소=검정, 확인=#DD0000 은 기본값)
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
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { lineHeight: 38 }]}>
            SENCITY{'\n'}로그인
          </Text>
        </View>

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
            <CheckBox
              checked={remember}
              onPress={() => setRemember(!remember)}
              checkedColor="#DD0000"
              uncheckedColor="#D2D2D2"
              containerStyle={{
                backgroundColor: 'transparent',
                borderWidth: 0,
                padding: 0,
                margin: 0,
              }}
            />
            <Text style={{ fontSize: 14, color: '#000', fontWeight: '500' }}>
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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 0,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 30,
  },
  logo: {
    width: 103,
    height: 93.34,
    marginBottom: 20,
  },
  title: {
    fontSize: 35,
    marginBottom: 5,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 8,
  },
  label: {
    marginBottom: 5,
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
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
  loginButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 20,
  },
  orContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 0,
    width: '100%',
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#D2D2D2',
  },
  orText: {
    marginHorizontal: 10,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  snsButtons: {
    marginTop: 12,
    alignItems: 'center',
    width: '100%',
  },
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
  snsIconImage: {
    width: 24,
    height: 24,
    marginRight: 10,
    resizeMode: 'contain',
  },
  snsButtonText: {
    fontSize: 16,
    color: '#000',
    fontWeight: '600',
  },
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
