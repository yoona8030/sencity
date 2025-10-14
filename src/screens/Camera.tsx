// src/screens/CameraScreen.tsx
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

// --- API 유틸/함수 ---
import { API_BASE, authFetch, getAccessTokenSync, hasRefreshToken } from '../utils/auth';
import { createReportAuto } from '../api/report';
import {
  recognizeAnimal,
  reverseGeocodeKakao,
  postReportNoAuth_LatLng,
  resolveAnimalByLabel,
} from '../api';
import type { RecognizeTop } from '../api/recognize';

// 🔍 Pinch/Double-tap zoom (worklet-safe)
import Animated, { useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { sendEvent } from '../utils/metrics';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Stage = 'camera' | 'preview';

const BOTTOM_BTN_H = 52;
const EXTRA_GAP = 12;
const FALLBACK_UNKNOWN_ID = 31;

const UNKNOWN_LABELS = new Set(['-', 'unknown', '미상', '__background__']);
const PROB_THRESHOLD = 0.55;

// 영/한 라벨 매핑
const KO_ALIAS: Record<string, string> = {
  goat: '고라니',
  'roe deer': '노루',
  egret: '중대백로',
  'great egret': '중대백로',
  'intermediate egret': '중대백로',
  'little egret': '중대백로',
  heron: '왜가리',
  'grey heron': '왜가리',
  'gray heron': '왜가리',
  squirrel: '다람쥐',
  chipmunk: '청설모',
  'wild boar': '멧돼지',
  hare: '멧토끼',
  weasel: '족제비',
  dog: '개',
  cat: '고양이',
  raccoon: '너구리',
  'black bear': '반달가슴곰',
};

function formatLabel(raw?: string | null) {
  const z = (raw ?? '').trim();
  if (!z) return '';
  if (z.includes(' 또는 ')) return z;
  if (z.includes('/')) {
    const seen = new Set<string>();
    return z
      .split('/')
      .map(p => p.trim())
      .filter(Boolean)
      .map(p => KO_ALIAS[p.toLowerCase()] ?? p)
      .filter(p => (seen.has(p) ? false : (seen.add(p), true)))
      .join(' 또는 ');
  }
  return KO_ALIAS[z.toLowerCase()] ?? z;
}

// ===================== Location 헬퍼 ======================
/** 좌표(+선택 주소)로 Location 생성 후 PK 반환. 실패 시 null */
async function createLocationByLatLng(lat: number, lng: number, address?: string | null) {
  try {
    const fd = new FormData();
    fd.append('latitude', String(lat));
    fd.append('longitude', String(lng));
    if (address) fd.append('address', address);

    // 인증 사용자 기준: LocationViewSet에 POST 허용(일반 ModelViewSet 기본동작 가정)
    const res = await authFetch(`${API_BASE}/locations/`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      // 권한/파서 문제 등으로 실패하면 null
      return null;
    }
    const json = await res.json();
    // 응답 키 둘 다 방어 (location_id 또는 id)
    return json?.location_id ?? json?.id ?? null;
  } catch {
    return null;
  }
}

// ===================== 컴포넌트 ======================
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

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  const [aiLabel, setAiLabel] = useState<string | null>(null);
  const [aiAnimalId, setAiAnimalId] = useState<number | null>(null);

  const [recogError, setRecogError] = useState(false);
  const [localDoneVisible, setLocalDoneVisible] = useState(false);
  const [serverDoneVisible, setServerDoneVisible] = useState(false);

  // ==== Zoom (worklet-safe) ====
  const minZoom = Math.max(device?.minZoom ?? 1, 1);
  const maxZoom = Math.min(Math.max(device?.maxZoom ?? 1, 1), 5);
  const neutral = device?.neutralZoom ?? minZoom;
  const startZoom = Math.min(Math.max(neutral, minZoom), maxZoom);

  const [zoomNum, setZoomNum] = useState(startZoom);

  const zoomSV = useSharedValue(startZoom);
  const minSV = useSharedValue(minZoom);
  const maxSV = useSharedValue(maxZoom);

  const applyZoomJS = (z: number) => {
    const clamped = Math.min(Math.max(z, minZoom), maxZoom);
    setZoomNum(clamped);
  };

  const pinch = Gesture.Pinch()
    .onUpdate(e => {
      'worklet';
      const next = zoomSV.value * Math.pow(e.scale, 0.85);
      const lo = minSV.value, hi = maxSV.value;
      const clamped = next < lo ? lo : next > hi ? hi : next;
      zoomSV.value = clamped;
      runOnJS(applyZoomJS)(clamped);
    })
    .onEnd(() => {
      'worklet';
      const target = zoomSV.value;
      zoomSV.value = withTiming(target, { duration: 120 });
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      'worklet';
      const lo = minSV.value, hi = maxSV.value;
      const mid = (lo + hi) / 2;
      const target = zoomSV.value < mid ? hi : lo;
      zoomSV.value = target;
      runOnJS(applyZoomJS)(target);
    });

  const gestures = Gesture.Simultaneous(pinch, doubleTap);

  // 카메라 권한
  useEffect(() => {
    (async () => {
      if (!hasPermission && !askingCam) {
        setAskingCam(true);
        const ok = await requestPermission();
        setAskingCam(false);
        if (!ok) Alert.alert('권한 필요', '설정 > 앱 권한에서 카메라를 허용해주세요.');
      }
    })();
  }, [hasPermission, requestPermission, askingCam]);

  // 위치 권한
  const locPerm: Permission | null = useMemo(() => {
    if (Platform.OS === 'ios') return PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
    if (Platform.OS === 'android') return PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
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

  // ==== 인식 공통 ====
  async function runRecognize(uri: string): Promise<void> {
    setRecogError(false);
    setAiLabel(null);
    setAiAnimalId(null);

    try {
      const res: RecognizeTop = await recognizeAnimal(uri);

      const rawKo = (res?.label_ko ?? '').trim();
      const rawEn = (res?.label ?? '').trim();
      const raw = rawKo || rawEn;
      const display = formatLabel(raw);
      const displayLc = display.toLowerCase();

      const prob = typeof res?.prob === 'number' ? res.prob : undefined;
      const probOk = prob === undefined ? true : prob >= PROB_THRESHOLD;
      const isUnknown = display && !UNKNOWN_LABELS.has(displayLc) ? false : true;

      const detCount =
        Array.isArray((res as any)?.boxes) ? (res as any).boxes.length :
        typeof (res as any)?.det_count === 'number' ? (res as any).det_count :
        undefined;
      const hasDetection = detCount === undefined ? true : detCount > 0;

      if (!display || isUnknown || !probOk || !hasDetection) {
        setRecogError(true);
        return;
      }

      let mappedId: number | null =
        typeof res.animal_id === 'number' ? res.animal_id : null;

      if (mappedId == null) {
        const candidates = display
          .split(' 또는 ')
          .map(s => s.trim())
          .filter(Boolean);

        const tryLabels = [
          ...candidates,
          rawEn || rawKo || display,
        ].filter(Boolean);

        for (const lab of tryLabels) {
          try {
            const r = await resolveAnimalByLabel(lab);
            if (r && typeof r.animal_id === 'number') {
              mappedId = r.animal_id;
              break;
            }
          } catch {}
        }
      }

      if (mappedId == null) {
        setRecogError(true);
        setAiAnimalId(null);
        return;
      }

      setAiLabel(display);
      setAiAnimalId(mappedId);
      setRecogError(false);
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes('413') || /too\s*large/i.test(msg)) {
        Alert.alert('사진 용량이 큽니다', '사진 크기를 줄여 다시 시도해주세요.');
      } else if (/Network request failed/i.test(msg)) {
        Alert.alert('네트워크 오류', '서버에 연결할 수 없습니다. 같은 Wi-Fi인지 확인하세요.');
      }
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
      setAiAnimalId(null);
      setRecogError(false);

      await runRecognize(uri);
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
    setAiAnimalId(null);
    setRecogError(false);

    await runRecognize(uri);
  };

  /** 신고 제출(로그인/비로그인 자동 분기 + location_id 확보) */
  const handleReport = async () => {
    if (!photoUri) {
      Alert.alert('사진 확인', '사진을 먼저 촬영 또는 선택해 주세요.');
      return;
    }
    if (!coords) {
      Alert.alert('위치 확인', '위치 정보를 가져온 뒤 신고할 수 있어요.');
      return;
    }

    setLocalDoneVisible(true);
    await sendEvent('report_submit_click', { screen: 'camera' }).catch(() => {});

    try {
      const isLoggedIn = !!getAccessTokenSync() || hasRefreshToken();
      const aid = aiAnimalId ?? FALLBACK_UNKNOWN_ID;

      if (isLoggedIn) {
        // 1) 좌표로 Location 생성 → PK 확보
        const locId = await createLocationByLatLng(coords.lat, coords.lng, address);

        if (locId) {
          // 2) 인증 신고 (/api/reports/) : *_id 규약
          await createReportAuto({
            mode: 'auth',
            animalId: aid,
            locationId: Number(locId),
            imageUri: photoUri,
            status: 'checking',
          });
        } else {
          // 2-보: 혹시 Location 생성이 실패하면, 안전하게 무인증 엔드포인트로 우회 (실패 회피)
          await postReportNoAuth_LatLng({
            animalId: aid,
            photoUri: photoUri,
            lat: coords.lat,
            lng: coords.lng,
            address,
            status: 'checking',
          });
        }
      } else {
        // 비로그인: 무인증 신고 (/api/reports/no-auth) lat,lng 사용
        await postReportNoAuth_LatLng({
          animalId: aid,
          photoUri: photoUri,
          lat: coords.lat,
          lng: coords.lng,
          address,
          status: 'checking',
        });
      }

      await sendEvent('report_submit_success', { screen: 'camera' }).catch(() => {});
      setLocalDoneVisible(false);
      setServerDoneVisible(true);
    } catch (e: any) {
      await sendEvent('report_submit_fail', {
        screen: 'camera',
        message: String(e?.message ?? e),
      }).catch(() => {});
      setLocalDoneVisible(false);
      Alert.alert('전송 실패', e?.message ?? '네트워크 상태를 확인해주세요.');
    }
  };

  // 프리뷰 → 카메라 복귀 시 줌 리셋
  useEffect(() => {
    if (stage === 'camera') {
      setZoomNum(startZoom);
      zoomSV.value = withTiming(startZoom, { duration: 120 });
    }
  }, [stage, startZoom, zoomSV]);

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

      {/* 위치 */}
      {address ? (
        <View style={styles.locationPill}>
          <Text style={styles.locationText} numberOfLines={1}>
            {address}
          </Text>
        </View>
      ) : (
        <TouchableOpacity style={[styles.locationPill, styles.locationBtn]} onPress={fetchMyLocation}>
          <Text style={styles.locationText}>내 위치 보기</Text>
        </TouchableOpacity>
      )}

      {/* 카메라 카드 */}
      <View style={[styles.photoCard, { marginBottom: bottomSafePad + EXTRA_GAP }]}>
        {stage === 'camera' && (
          <GestureDetector gesture={gestures}>
            <Camera
              ref={camRef}
              style={StyleSheet.absoluteFillObject}
              device={device}
              isActive={isFocused && stage === 'camera'}
              photo
              zoom={zoomNum}
            />
          </GestureDetector>
        )}

        {stage === 'preview' && !!photoUri && (
          <>
            <Image source={{ uri: photoUri }} style={styles.previewImg} />
            {recogError && <View style={styles.dim} />}
          </>
        )}

        {!recogError && aiAnimalId != null && (
          <View pointerEvents="none" style={styles.aiPillCenter}>
            <Text style={styles.aiText}>AI 인식 결과: {aiLabel}</Text>
          </View>
        )}

        {recogError && (
          <View style={styles.errorCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="alert-circle-outline" size={18} color="#fff" />
              <Text style={[styles.errorTitle, { marginLeft: 6 }]}>경고 알림</Text>
            </View>
            <Text style={styles.errorMsg}>사진을 인식할 수 없습니다</Text>
          </View>
        )}
      </View>

      {/* 하단 컨트롤 */}
      {stage === 'camera' && (
        <TouchableOpacity
          onPress={handleTakePhoto}
          style={[styles.bottomBtn, { bottom: 12 + tabBarH + insets.bottom, height: BOTTOM_BTN_H }]}
          activeOpacity={0.85}
        >
          <Text style={styles.bottomBtnText}>촬영</Text>
        </TouchableOpacity>
      )}

      {stage === 'preview' && (
        <View style={[styles.bottomRow3, { bottom: 12 + tabBarH + insets.bottom }]}>
          <TouchableOpacity
            onPress={() => {
              setPhotoUri(null);
              setAiLabel(null);
              setAiAnimalId(null);
              setRecogError(false);
              setStage('camera');
            }}
            style={[styles.smallBtn, styles.smallBtnYellow, styles.flex1]}
            activeOpacity={0.85}
          >
            <Text style={[styles.smallBtnText, { color: '#000' }]}>재촬영</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReport}
            style={[styles.smallBtn, styles.smallBtnRed, styles.flex1]}
            activeOpacity={0.85}
          >
            <Text style={[styles.smallBtnText, { color: '#fff' }]}>신고하기</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePickFromGallery}
            style={[styles.smallBtn, styles.smallBtnGrey, styles.flex1]}
            activeOpacity={0.85}
          >
            <Text style={[styles.smallBtnText, { color: '#333' }]}>앨범</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 모달들 */}
      <Modal transparent visible={localDoneVisible} animationType="fade" onRequestClose={() => setLocalDoneVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalMessage}>
              신고를 전송 중입니다.{'\n'}
              잠시만 기다려 주세요.
            </Text>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setLocalDoneVisible(false)}>
              <Text style={styles.modalBtnText}>확인</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={serverDoneVisible} animationType="fade" onRequestClose={() => setServerDoneVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalMessage}>신고가 완료되었습니다.</Text>
            <TouchableOpacity
              style={styles.modalBtn}
              onPress={() => {
                setServerDoneVisible(false);
                setPhotoUri(null);
                setAiLabel(null);
                setAiAnimalId(null);
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
  centerBlack: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },

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

  locationText: { color: '#111', fontWeight: '600', fontSize: 20, textAlign: 'center' },

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
  dim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },

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

  bottomRow3: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  smallBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
  },
  smallBtnYellow: { backgroundColor: '#FEBA15' },
  smallBtnGrey: { backgroundColor: '#D2D2D2' },
  smallBtnRed: { backgroundColor: '#DD0000' },
  smallBtnText: { fontWeight: '800', fontSize: 15 },
  flex1: { flex: 1, marginHorizontal: 4 },

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
  modalMessage: { color: '#111', textAlign: 'center', lineHeight: 22, fontWeight: '700' },
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
  modalBtnText: { color: '#111', fontWeight: '700' },
});
