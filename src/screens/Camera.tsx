import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Image,
  StyleSheet,
  Platform,
  Modal,
} from 'react-native';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
} from 'react-native-vision-camera';
import Geolocation from 'react-native-geolocation-service';
import {
  check,
  request,
  RESULTS,
  PERMISSIONS,
  Permission,
} from 'react-native-permissions';
import { launchImageLibrary } from 'react-native-image-picker';

import type { RootStackParamList } from '../navigation/RootNavigator';
import { recognizeAnimal, reverseGeocodeKakao } from '../api';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Stage = 'camera' | 'preview';

const BOTTOM_BTN_H = 52;
const EXTRA_GAP = 12; // 버튼과 카메라 사이 여유 간격

export default function CameraScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const tabBarH = useBottomTabBarHeight();

  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();
  const isFocused = useIsFocused();
  const camRef = useRef<Camera>(null);

  const [askingCam, setAskingCam] = useState(false);
  const [stage, setStage] = useState<Stage>('camera');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [address, setAddress] = useState<string | null>(null);
  const [aiLabel, setAiLabel] = useState<string | null>(null);
  const [recogError, setRecogError] = useState(false); // 인식 실패 여부

  const [localDoneVisible, setLocalDoneVisible] = useState(false); // 즉시 안내
  const [serverDoneVisible, setServerDoneVisible] = useState(false); // 서버 완료

  useEffect(() => {
    (async () => {
      if (!hasPermission && !askingCam) {
        setAskingCam(true);
        const ok = await requestPermission();
        setAskingCam(false);
        if (!ok)
          Alert.alert('권한 필요', '설정 > 앱 권한에서 카메라를 허용해주세요.');
      }
    })();
  }, [hasPermission, requestPermission, askingCam]);

  const locPerm: Permission | null = useMemo(() => {
    if (Platform.OS === 'ios') return PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
    if (Platform.OS === 'android')
      return PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
    return null;
  }, []);

  const ensureLocationPermission = async (): Promise<boolean> => {
    if (!locPerm) return true;
    const st = await check(locPerm);
    if (st === RESULTS.GRANTED || st === RESULTS.LIMITED) return true;
    if (st === RESULTS.DENIED) {
      const r = await request(locPerm);
      return r === RESULTS.GRANTED || r === RESULTS.LIMITED;
    }
    if (st === RESULTS.BLOCKED) {
      Alert.alert('위치 권한 필요', '설정에서 위치 권한을 허용해주세요.');
      return false;
    }
    return false;
  };

  const fetchMyLocation = async () => {
    const ok = await ensureLocationPermission();
    if (!ok) {
      setAddress(null);
      return;
    }
    Geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        try {
          const addr = await reverseGeocodeKakao(latitude, longitude);
          setAddress(addr);
        } catch {
          setAddress(`${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        }
      },
      _err => {
        setAddress(null);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 },
    );
  };

  useEffect(() => {
    fetchMyLocation();
  }, []);

  // ✅ 공통 인식 실행 유틸 (recognizeAnimal -> 단일 객체 반환)
  async function runRecognize(uri: string) {
    setRecogError(false);
    setAiLabel(null);

    try {
      const top = await recognizeAnimal(uri); // 문자열 그대로 전달
      if (!top?.label || top.label === '-') {
        setRecogError(true);
      } else {
        setAiLabel(top.label);
        setRecogError(false);
      }
    } catch {
      setRecogError(true);
    }
  }

  const handleTakePhoto = async () => {
    if (!device || stage !== 'camera') return;
    try {
      const photo = await camRef.current?.takePhoto({
        flash: 'off',
        enableShutterSound: true,
      });
      if (!photo?.path) throw new Error('사진 촬영 실패');
      const uri = 'file://' + photo.path;

      setPhotoUri(uri);
      setStage('preview');
      setAiLabel(null);
      setRecogError(false);

      await runRecognize(uri); // <-- { uri } 아님
    } catch (e: any) {
      Alert.alert('촬영 오류', e?.message ?? '사진 촬영에 실패했습니다.');
    }
  };

  const handlePickFromGallery = async () => {
    const r = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 1,
      quality: 0.9,
    });
    const uri = r.assets?.[0]?.uri;
    if (!uri) return;

    setPhotoUri(uri);
    setStage('preview');
    setAiLabel(null);
    setRecogError(false);

    await runRecognize(uri); // <-- { uri } 아님
  };

  const handleReport = async () => {
    // 1) 즉시 사용자 안내
    setLocalDoneVisible(true);

    // 2) (추후) 서버 전송 로직 연결
    try {
      await new Promise(res => setTimeout(res, 900));
      setLocalDoneVisible(false);
      setServerDoneVisible(true);
    } catch {
      setLocalDoneVisible(false);
      Alert.alert('전송 실패', '네트워크 상태를 확인해주세요.');
    }
  };

  const bottomSafePad = 12 + tabBarH + insets.bottom + BOTTOM_BTN_H;

  if (!device) {
    return (
      <View style={[styles.safe, styles.centerBlack]}>
        <Text style={{ color: '#fff' }}>카메라 장치를 찾을 수 없습니다.</Text>
      </View>
    );
  }
  if (!hasPermission) {
    return (
      <View style={[styles.safe, styles.centerBlack]}>
        <Text style={{ color: '#fff' }}>카메라 권한이 필요합니다.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ padding: 6 }}
        >
          <Ionicons name="chevron-back" size={30} color="#111" />
        </TouchableOpacity>

        <Image
          source={require('../../assets/images/logo.png')}
          style={{ width: 56, height: 56 }}
          resizeMode="contain"
        />

        <View style={{ width: 36 }} />
      </View>

      {/* 위치: pill/버튼 공통 → 가운데 정렬 */}
      {address ? (
        <View style={styles.locationPill}>
          <Text style={styles.locationText} numberOfLines={1}>
            {address}
          </Text>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.locationPill, styles.locationBtn]}
          onPress={fetchMyLocation}
        >
          <Text style={styles.locationText}>내 위치 보기</Text>
        </TouchableOpacity>
      )}

      {/* 카메라 카드 */}
      <View
        style={[styles.photoCard, { marginBottom: bottomSafePad + EXTRA_GAP }]}
      >
        {stage === 'camera' && (
          <Camera
            ref={camRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={isFocused && stage === 'camera'}
            photo
          />
        )}
        {stage === 'preview' && !!photoUri && (
          <>
            <Image source={{ uri: photoUri }} style={styles.previewImg} />
            {/* 실패 시 어둡게 */}
            {recogError && <View style={styles.dim} />}
          </>
        )}

        {/* 성공 시 중앙 배지 */}
        {!recogError && aiLabel != null && (
          <View pointerEvents="none" style={styles.aiPillCenter}>
            <Text style={styles.aiText}>AI 인식 결과: {aiLabel}</Text>
          </View>
        )}

        {/* 실패 시 빨간 경고 배지 */}
        {recogError && (
          <View style={styles.errorCard}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 6,
              }}
            >
              <Ionicons name="alert-circle-outline" size={18} color="#fff" />
              <Text style={[styles.errorTitle, { marginLeft: 6 }]}>
                경고 알림
              </Text>
            </View>
            <Text style={styles.errorMsg}>사진을 인식할 수 없습니다</Text>
          </View>
        )}
      </View>

      {/* 하단 컨트롤 */}
      {stage === 'camera' && (
        <TouchableOpacity
          onPress={handleTakePhoto}
          style={[
            styles.bottomBtn,
            { bottom: 12 + tabBarH + insets.bottom, height: BOTTOM_BTN_H },
          ]}
          activeOpacity={0.85}
        >
          <Text style={styles.bottomBtnText}>촬영</Text>
        </TouchableOpacity>
      )}

      {stage === 'preview' && !recogError && (
        <TouchableOpacity
          onPress={handleReport}
          style={[
            styles.bottomBtn,
            { bottom: 12 + tabBarH + insets.bottom, height: BOTTOM_BTN_H },
          ]}
          activeOpacity={0.85}
        >
          <Text style={styles.bottomBtnText}>신고하기</Text>
        </TouchableOpacity>
      )}

      {/* 인식 실패 시: 재촬영 / 갤러리 */}
      {stage === 'preview' && recogError && (
        <View
          style={[styles.bottomRow, { bottom: 12 + tabBarH + insets.bottom }]}
        >
          <TouchableOpacity
            onPress={() => {
              setPhotoUri(null);
              setAiLabel(null);
              setRecogError(false);
              setStage('camera');
            }}
            style={[styles.smallBtn, styles.smallBtnYellow]}
            activeOpacity={0.85}
          >
            <Text style={[styles.smallBtnText, { color: '#000' }]}>재촬영</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePickFromGallery}
            style={[styles.smallBtn, styles.smallBtnGrey]}
            activeOpacity={0.85}
          >
            <Text style={[styles.smallBtnText, { color: '#333' }]}>앨범</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 신고 즉시 안내 모달 */}
      <Modal
        transparent
        visible={localDoneVisible}
        animationType="fade"
        onRequestClose={() => setLocalDoneVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalMessage}>
              신고가 완료되었습니다.{'\n'}
              안전한 지역으로 대피하시길 바랍니다.
            </Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => setLocalDoneVisible(false)}
            >
              <Text style={styles.modalBtnText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* 서버 전송 완료 모달 */}
      <Modal
        transparent
        visible={serverDoneVisible}
        animationType="fade"
        onRequestClose={() => setServerDoneVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalMessage}>신고가 완료되었습니다.</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => {
                setServerDoneVisible(false);
                // 초기 상태로 복귀
                setPhotoUri(null);
                setAiLabel(null);
                setRecogError(false);
                setStage('camera');
              }}
            >
              <Text style={styles.modalBtnText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  centerBlack: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },

  header: {
    height: 64,
    paddingTop: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  locationPill: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    backgroundColor: '#FEBA15',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    justifyContent: 'center',
    marginTop: 15,
  },
  locationBtn: { backgroundColor: '#FEBA15' },

  locationText: {
    color: '#111',
    fontWeight: '600',
    fontSize: 20,
    textAlign: 'center',
  },

  photoCard: {
    flex: 1,
    marginTop: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#EEE',
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  previewImg: { width: '100%', height: '100%', resizeMode: 'cover' },

  aiPillCenter: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    elevation: 2,
  },
  aiText: { color: '#222', fontWeight: '800' },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  errorCard: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#DD0000',
    paddingHorizontal: 18,
    paddingVertical: 20,
    borderRadius: 12,
    bottom: '40%',
    minWidth: 250,
    minHeight: 100,
    alignItems: 'center',
  },
  errorTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  errorMsg: { color: '#fff', marginTop: 2, fontWeight: '600' },

  bottomBtn: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    backgroundColor: '#DD0000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  bottomRow: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  smallBtn: {
    height: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 110,
  },
  smallBtnYellow: { backgroundColor: '#FEBA15' },
  smallBtnGrey: { backgroundColor: '#D2D2D2' },
  smallBtnText: { fontWeight: '800', fontSize: 15 },

  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '80%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: '#D8D8D8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
    alignItems: 'center',
  },
  modalMessage: {
    color: '#111',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '700',
  },
  modalBtn: {
    marginTop: 16,
    minWidth: 96,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BDBDBD',
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#111',
    fontWeight: '700',
  },
});
