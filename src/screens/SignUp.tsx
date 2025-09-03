import * as React from 'react';
import { useState } from 'react';
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
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CheckBox } from 'react-native-elements';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';

type RootStackParamList = {
  Login: undefined;
  SignUp: undefined;
  MainTabs: undefined;
};

type SignUpScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'SignUp'
>;

type Props = {
  navigation: SignUpScreenNavigationProp;
};

type EmailCheckResponse = {
  is_duplicate: boolean;
};

const SignUp: React.FC<Props> = ({ navigation }) => {
  const [name, setName] = useState<string>('');
  const [telphone, setTelphone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [password2, setPassword2] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [emailCheckResult, setEmailCheckResult] = useState<string>('');
  const [agree, setAgree] = useState<boolean>(false);

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
      console.log('전송 전 agree 값:', agree, typeof agree);
      // const response = await fetch('http://172.18.35.178/api/signup/', {
      const response = await fetch('http://127.0.0.1:8000/api/signup/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          username: name,
          telphone,
          email,
          password,
          address,
          agree: agree,
        }),
      });

      // ✅ 먼저 응답 상태 확인
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[회원가입 실패 응답]', errorText);
        Alert.alert('회원가입 실패', '입력값을 확인하거나 다시 시도해주세요');
        return;
      }

      // ✅ 여기서 JSON 파싱
      const data = await response.json();
      console.log('[회원가입 응답]', data);

      if (data.token) {
        await AsyncStorage.setItem('accessToken', data.token);
        console.log('[SignUp.tsx] 저장된 토큰:', data.token);
      }

      Alert.alert('회원가입 완료', `${name}님 환영합니다!`);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      console.error('[회원가입 중 에러]', error);
      Alert.alert('에러', '회원가입 중 문제가 발생했습니다');
    }
  };

  const handleEmailCheck = async () => {
    if (!email) {
      Alert.alert('알림', '이메일을 입력해주세요');
      return;
    }
    try {
      // 실제 기기
      const response = await fetch('http://127.0.0.1:8000/api/signup/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data: EmailCheckResponse = await response.json();

      if (data.is_duplicate) {
        setEmailCheckResult('이미 사용중인 이메일입니다.');
      } else {
        setEmailCheckResult('사용 가능한 이메일입니다.');
      }
    } catch (error) {
      console.error(error);
      setEmailCheckResult('오류가 발생했습니다');
    }
  };

  return (
    <SafeAreaProvider>
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

                  {emailCheckResult !== '' && (
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
                  <CheckBox
                    checked={agree}
                    onPress={() => setAgree(!agree)}
                    containerStyle={styles.checkboxContainer}
                    checkedColor="#DD0000" // ✅ 체크됐을 때 색상
                    uncheckedColor="#D2D2D2" // ✅ 체크 안됐을 때 색상
                  />
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
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  scrollContainer: {
    padding: 20,
    paddingBottom: 160, // 하단 고정 버튼 영역 확보
  },
  formSection: {
    flex: 1,
  },
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
  input: {
    paddingHorizontal: 10,
    height: 40,
    borderRadius: 5,
  },
  checkboxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 10,
    width: '100%',
  },
  checkboxContainer: {
    padding: 0,
    margin: 0,
    marginRight: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  checkboxLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
  },
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
  checkButtonText: {
    color: '#000',
    fontSize: 14,
  },
  signupButton: {
    backgroundColor: '#FEBA15',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  signupButtonText: {
    color: 'black',
    fontSize: 16,
    fontWeight: 'bold',
  },
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
