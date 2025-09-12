// src/screens/SignUp.tsx
import React, { useState } from 'react';
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
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
// ⛔️ react-native-elements CheckBox 제거(피어 의존 충돌). Ionicons로 대체
import Ionicons from 'react-native-vector-icons/Ionicons';

import { NativeStackNavigationProp } from '@react-navigation/native-stack';
// ✅ 루트 네비 타입은 RootNavigator에서 가져와 일관 유지
import type { RootStackParamList } from '../navigation/RootNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SignUpScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SignUp'
>;

type Props = { navigation: SignUpScreenNavigationProp };

type EmailCheckResponse = { is_duplicate: boolean };

// ✔️ 간단 체크박스(아이콘 기반)
function Checkbox({
  checked,
  onPress,
}: {
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ padding: 4, marginRight: 8 }}
      hitSlop={8}
    >
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={22}
        color={checked ? '#DD0000' : '#D2D2D2'}
      />
    </Pressable>
  );
}

// ⚠️ 실제 기기/에뮬레이터 주소 주의!
// - AVD: http://10.0.2.2:8000
// - 물리기기: PC의 LAN IP (예: http://192.168.x.x:8000)
// 지금은 에뮬레이터 기준으로 둡니다.
const API_BASE = 'http://10.0.2.2:8000/api';

const SignUp: React.FC<Props> = ({ navigation }) => {
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
      // const res = await fetch(`${API_BASE}/signup/`, {
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
      if (data.token) {
        await AsyncStorage.setItem('accessToken', data.token);
      }

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
      // ⚠️ 백엔드에 실제 "중복확인" 엔드포인트가 따로 있다면 거기로 변경하세요.
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

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <ScrollView
              contentContainerStyle={styles.scrollContainer}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.formSection}>
                <Text style={styles.title}>SENCITY{'\n'}회원가입</Text>

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

            <View style={styles.fixedBottom}>
              <View style={styles.checkboxWrapper}>
                <Checkbox checked={agree} onPress={() => setAgree(!agree)} />
                <Text style={styles.checkboxLabel}>
                  약관 및 개인정보 처리방침에 동의합니다.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.signupButton}
                onPress={handleSignUp}
                activeOpacity={0.8}
              >
                <Text style={styles.signupButtonText}>회원가입</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  scrollContainer: { padding: 20, paddingBottom: 160 },
  formSection: { flex: 1 },
  title: {
    fontSize: 35,
    marginBottom: 20,
    textAlign: 'center',
    alignSelf: 'center',
    marginTop: 20,
    fontWeight: 'bold',
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#D2D2D2',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  input: { paddingHorizontal: 10, height: 40, borderRadius: 5 },
  checkboxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 10,
    width: '100%',
  },
  checkboxLabel: { fontSize: 16, fontWeight: 'bold', color: '#000000' },
  checkButton: {
    borderWidth: 1,
    borderColor: '#D2D2D2',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginLeft: 10,
    justifyContent: 'center',
    height: 40,
  },
  checkButtonText: { color: '#000', fontSize: 14 },
  signupButton: {
    backgroundColor: '#FEBA15',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  signupButtonText: { color: 'black', fontSize: 16, fontWeight: 'bold' },
  fixedBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
  },
});

export default SignUp;
