// src/screens/SignUp.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  Animated,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ✅ 커스텀 체크박스(Reanimated 버전)
import Checkbox from '../components/Checkbox';

type SignUpScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SignUp'
>;
type Props = { navigation: SignUpScreenNavigationProp };

type EmailCheckResponse = { is_duplicate: boolean };

const API_BASE = 'http://10.0.2.2:8000/api';

const SignUp: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const topGap = Math.max(insets.top, 0) + 20;

  const [name, setName] = useState('');
  const [telphone, setTelphone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [address, setAddress] = useState('');
  const [emailCheckResult, setEmailCheckResult] = useState('');
  const [agree, setAgree] = useState(false);

  const handleSignUp = async () => {
    if (!name || !telphone || !email || !password || !password2) {
      Alert.alert('알림', '모든 필수 입력값을 입력해주세요');
      return;
    }
    if (password !== password2) {
      Alert.alert('알림', '비밀번호가 일치하지 않습니다');
      return;
    }
    if (!agree) {
      Alert.alert('알림', '약관에 동의해야 회원가입이 가능합니다');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/signup/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username: name.trim(),
          telphone: telphone.trim(),
          email: email.trim().toLowerCase(),
          password,
          address: address.trim(),
          agree,
        }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => '');
        console.error('[회원가입 실패 응답]', err);
        Alert.alert('회원가입 실패', '입력값을 확인하거나 다시 시도해주세요');
        return;
      }

      const data = await res.json().catch(() => ({} as any));
      if (data.token) await AsyncStorage.setItem('accessToken', data.token);

      Alert.alert('회원가입 완료', `${name}님 환영합니다!`);
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) {
      console.error('[회원가입 중 에러]', e);
      Alert.alert('에러', '회원가입 중 문제가 발생했습니다');
    }
  };

  const handleEmailCheck = async () => {
    if (!email) {
      Alert.alert('알림', '이메일을 입력해주세요');
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/signup/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data: EmailCheckResponse = await res
        .json()
        .catch(() => ({ is_duplicate: false }));
      setEmailCheckResult(
        data.is_duplicate
          ? '이미 사용중인 이메일입니다.'
          : '사용 가능한 이메일입니다.',
      );
    } catch (error) {
      console.error(error);
      setEmailCheckResult('오류가 발생했습니다');
    }
  };

  // 푸터 높이(버튼 48 + 위 여백 10 + 기기 하단 insets)
  const footerPaddingBottom = insets.bottom + 12;
  const footerHeight = 48 + 10 + footerPaddingBottom;

  // ── 키보드 높이 측정 → 푸터 카운터 트랜스폼
  const kbY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const showEvt =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height ?? 0;
      Animated.timing(kbY, {
        toValue: h,
        duration: Platform.OS === 'ios' ? e?.duration ?? 250 : 0,
        useNativeDriver: true,
      }).start();
    };
    const onHide = (e: any) => {
      Animated.timing(kbY, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? e?.duration ?? 250 : 0,
        useNativeDriver: true,
      }).start();
    };

    const s1 = Keyboard.addListener(showEvt, onShow);
    const s2 = Keyboard.addListener(hideEvt, onHide);
    return () => {
      s1.remove();
      s2.remove();
    };
  }, [kbY]);

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
          SENCITY{'\n'}회원가입
        </Text>
      </View>

      {/* 폼만 KeyboardAvoidingView로 감싸기 (푸터는 바깥) */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1 }}>
            <ScrollView
              contentContainerStyle={{
                padding: 20,
                paddingBottom: footerHeight + 20, // 푸터와 겹치지 않게
              }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="이름"
                    placeholderTextColor="#7B7B7B"
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="전화번호"
                    placeholderTextColor="#7B7B7B"
                    value={telphone}
                    onChangeText={setTelphone}
                    keyboardType="phone-pad"
                  />
                </View>

                <View
                  style={[
                    styles.inputWrapper,
                    { flexDirection: 'row', alignItems: 'center' },
                  ]}
                >
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="이메일"
                    placeholderTextColor="#7B7B7B"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={handleEmailCheck}
                    style={styles.checkButton}
                  >
                    <Text style={styles.checkButtonText}>중복확인</Text>
                  </TouchableOpacity>
                </View>

                {!!emailCheckResult && (
                  <Text
                    style={{
                      marginBottom: 5,
                      marginTop: -13,
                      color: '#DD0000',
                    }}
                  >
                    {emailCheckResult}
                  </Text>
                )}

                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="비밀번호"
                    placeholderTextColor="#7B7B7B"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="비밀번호 재입력"
                    placeholderTextColor="#7B7B7B"
                    value={password2}
                    onChangeText={setPassword2}
                    secureTextEntry
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="주소(선택입력)"
                    placeholderTextColor="#7B7B7B"
                    value={address}
                    onChangeText={setAddress}
                  />
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* 🌟 항상 화면 하단에 고정되는 푸터(Animated로 카운터 트랜스폼) */}
      <Animated.View
        style={[
          styles.fixedBottom,
          {
            paddingBottom: footerPaddingBottom,
            transform: [{ translateY: kbY }],
          },
        ]}
      >
        <View style={styles.checkboxWrapper}>
          <Checkbox
            checked={agree}
            onChange={next => setAgree(next)}
            size={18}
            color="#C62828"
            radius={4}
            style={{ marginRight: 10 }} // 라벨과 간격
          />
          <Text style={styles.checkboxLabel}>
            약관 및 개인정보 처리방침에 동의합니다.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.footerButton}
          onPress={handleSignUp}
          activeOpacity={0.9}
        >
          <Text style={styles.footerButtonText}>회원가입</Text>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

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

  // 입력칸 슬림화
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#D2D2D2',
    borderRadius: 8,
    padding: 6,
    marginBottom: 12,
  },
  input: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    textAlignVertical: 'center',
    fontSize: 14,
  },

  checkButton: {
    borderWidth: 1,
    borderColor: '#D2D2D2',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginLeft: 10,
    justifyContent: 'center',
    height: 36,
  },
  checkButtonText: { color: '#2B2B2B', fontSize: 14 },

  // ✅ footerButton 패턴(항상 고정)
  fixedBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  checkboxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 10,
    width: '100%',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#2B2B2B',
    fontWeight: '500',
    marginLeft: 10,
  },

  footerButton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#FEBA15',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default SignUp;
