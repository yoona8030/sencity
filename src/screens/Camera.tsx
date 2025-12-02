// src/screens/Camera.tsx
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
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { createReportAuto } from '../api/report';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { recognizeAnimal, reverseGeocodeKakao } from '../api';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Stage = 'camera' | 'preview';

const BOTTOM_BTN_H = 52;
const EXTRA_GAP = 12;
const MIN_CONFIDENCE = 0.65; // (지금은 안 쓰지만 남겨둠)

// 비타깃 라벨(사람/사물/배경 등)
const NON_TARGET_LABELS = new Set<string>([
  '-',
  'unknown',
  'background',
  'bg',
  'others',
  'none',
  'person',
  'people',
  'human',
  'car',
  'truck',
  'bus',
  'bicycle',
  'motorcycle',
  'chair',
  'table',
  'bottle',
  'cup',
  'phone',
  'tv',
]);

// recognizeAnimal 반환(유연 처리)
type AiTop =
  | {
      label?: string | null;
      prob?: number | string | null;
    }
  | null
  | undefined;

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

  // 인식 결과(분리 관리)
  const [aiLabelKor, setAiLabelKor] = useState<string | null>(null); // 내부/신고용(한글)
  const [aiDisplay, setAiDisplay] = useState<string | null>(null); // 화면표시용(영어 그룹)
  const [aiScore, setAiScore] = useState<number | null>(null); // 0~1
  const [rawLabel, setRawLabel] = useState<string | null>(null); // 디버깅용 원라벨
  const [recogError, setRecogError] = useState(false); // 실패 배지 노출

  // 신고 UI
  const [serverDoneVisible, setServerDoneVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 카메라 권한
  useEffect(() => {
    (async () => {
      if (!hasPermission && !askingCam) {
        setAskingCam(true);
        const ok = await requestPermission();
        setAskingCam(false);
        if (!ok) {
          Alert.alert('권한 필요', '설정 > 앱 권한에서 카메라를 허용해주세요.');
        }
      }
    })();
  }, [hasPermission, requestPermission, askingCam]);

  // 토큰 관련 디버깅 로그(유지)
  useEffect(() => {
    (async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        const pairs = await AsyncStorage.multiGet(keys);
        const kv = Object.fromEntries(pairs);
        console.log('[AS_KEYS]', keys);
        const candidates = Object.entries(kv).filter(([k]) =>
          /access|token|jwt|auth/i.test(k),
        );
        console.log('[AS_TOKEN_CANDIDATES]', candidates);
        for (const [k, v] of candidates) {
          try {
            const j = JSON.parse(v ?? 'null');
            console.log(`[AS_JSON:${k}]`, j);
          } catch {}
        }
      } catch (e) {
        console.log('[AS_ERR]', e);
      }
    })();
  }, []);

  // 위치 권한
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

  // 서버 Animal ID 매핑(한글 기준)
  const labelToAnimalId: Record<string, number> = {
    멧토끼: 12,
    노루: 13,
    다람쥐: 14,
    고라니: 15,
    반달가슴곰: 16,
    멧돼지: 17,
    중대백로: 19,
    너구리: 23,
    족제비: 26,
    왜가리: 28,
    청설모: 30,
    강아지: 32,
    고양이: 33,
  };

  // 표기 규칙: 한글 → 영어 그룹(화면 표시용)
  const korToEnDisplay: Record<string, string> = {
    고라니: 'deer',
    노루: 'deer',
    청설모: 'squirrel',
    다람쥐: 'squirrel',
    중대백로: 'egret_heron',
    왜가리: 'egret_heron',
    멧돼지: 'wild boar',
    족제비: 'weasel',
    멧토끼: 'hare',
    반달가슴곰: 'asiatic black bear',
    강아지: 'dog',
    고양이: 'cat',
  };

  // 라벨 정규화: 앞에 붙은 번호/언더스코어(예: "08_Dog") 제거
  const norm = (s: string) =>
    (s ?? '')
      .toLowerCase()
      .replace(/^[0-9]+[_\s-]*/, '') // "08_Dog" -> "dog"
      .replace(/[_-]+/g, ' ')
      .replace(/[^a-z0-9가-힣\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // 영문 별칭 → 한글 타깃(키는 norm() 형태)
  const aliasToKor: Record<string, string> = {
    goat: '고라니',
    'roe deer': '노루',
    deer: '노루',
    'wild boar': '멧돼지',
    boar: '멧돼지',
    squirrel: '청설모',
    chipmunk: '다람쥐',
    raccoon: '너구리',
    'asiatic black bear': '반달가슴곰',
    bear: '반달가슴곰',
    hare: '멧토끼',
    weasel: '족제비',
    heron: '왜가리',
    haron: '왜가리', // 백엔드 보정 실패 대비용(방어 코드)
    egret: '중대백로',
    'great egret': '중대백로',
    dog: '강아지',
    cat: '고양이',
  };
  // 영문/한글 라벨 → 한글 타깃 라벨
  const toKorLabel = (raw: string) => {
    if (!raw) return '';

    const n = norm(raw);

    // dog / cat 하드코딩 fallback
    if (n === 'dog') return '강아지';
    if (n === 'cat') return '고양이';

    const alias = aliasToKor[n];
    if (alias) return alias;

    if (labelToAnimalId[raw]) {
      return raw;
    }

    return raw;
  };

  // 한글 라벨 → 화면 표시용 영어 그룹
  const toDisplayLabel = (kor: string) => korToEnDisplay[kor] ?? kor;

  // score 파싱(문자/숫자, 0~100 → 0~1 보정)
  const toUnitScore = (
    v: number | string | null | undefined,
  ): number | null => {
    if (v == null) return null;
    let num = typeof v === 'string' ? Number(v) : v;
    if (!isFinite(num)) return null;
    if (num > 1) num = num / 100;
    if (num < 0) num = 0;
    if (num > 1) num = 1;
    return num;
  };

  // 다양한 반환 구조에서 top1 추출
  const pickTop = (ret: any): AiTop => {
    if (!ret) return null;
    if (Array.isArray(ret)) return ret[0] ?? null;
    if (ret.top1 && typeof ret.top1 === 'object') return ret.top1;
    return ret;
  };

  // 인식 실행
  async function runRecognize(uri: string) {
    setRecogError(false);
    setAiLabelKor(null);
    setAiDisplay(null);
    setAiScore(null);
    setRawLabel(null);

    try {
      console.time('AI_REQ');
      const ret = await recognizeAnimal(uri);
      console.timeEnd('AI_REQ');
      const top = pickTop(ret) as AiTop;
      console.log('[AI RAW FULL]', JSON.stringify(ret, null, 2));
      console.log('[AI TOP]', top);

      const raw = (top?.label ?? '').trim();
      const scoreRaw = (top as any)?.prob ?? (top as any)?.score ?? null;
      const score = toUnitScore(scoreRaw);
      const rawN = norm(raw);

      const kor = toKorLabel(raw);
      const isTarget = typeof labelToAnimalId[kor] === 'number';

      console.log('[RECOG DEBUG]', {
        raw,
        rawN,
        kor,
        isTarget,
        scoreRaw,
        score,
      });

      setRawLabel(raw || null);
      if (typeof score === 'number') {
        setAiScore(score);
      }

      // 비타깃 즉시 실패
      if (!raw || NON_TARGET_LABELS.has(rawN)) {
        console.warn('[RECOG] non-target or empty → FAIL', raw);
        setRecogError(true);
        return;
      }

      // 타깃이면 점수와 무관하게 무조건 PASS
      if (isTarget) {
        setAiLabelKor(kor);
        setAiDisplay(toDisplayLabel(kor));
        setRecogError(false);
        console.log('[RECOG] PASS (target)', {
          raw,
          kor,
          score,
          display: toDisplayLabel(kor),
        });
        return;
      }

      // 미등록 종이면 실패
      setRecogError(true);
      console.warn('[RECOG] FAIL (non-target)', { raw, kor, score, isTarget });
      return;
    } catch (e) {
      console.log('[RECOG] exception', e);
      setRecogError(true);
      setAiLabelKor(null);
      setAiDisplay(null);
      setAiScore(null);
      setRawLabel(null);
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
      setAiLabelKor(null);
      setAiDisplay(null);
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
      quality: 0.5, // 0.9 --> 0.5 (속도 위해)
    });
    const uri = r.assets?.[0]?.uri;
    if (!uri) return;

    setPhotoUri(uri);
    setStage('preview');
    setAiLabelKor(null);
    setAiDisplay(null);
    setRecogError(false);

    await runRecognize(uri);
  };

  const handleReport = async () => {
    console.log('[DEBUG] 신고 버튼 클릭됨]');
    try {
      setSubmitting(true);

      if (recogError || !aiLabelKor) {
        Alert.alert(
          '인식 실패',
          '동물을 인식하지 못했습니다. 다시 찍어주세요.',
        );
        return;
      }
      if (!photoUri) {
        Alert.alert('신고 실패', '사진이 없습니다. 먼저 촬영해주세요.');
        return;
      }

      const animalId = labelToAnimalId[aiLabelKor];
      if (typeof animalId !== 'number') {
        Alert.alert(
          '신고 실패',
          `라벨(${aiLabelKor})에 매핑된 동물 ID가 없습니다.`,
        );
        return;
      }

      const resp = await createReportAuto({
        photoUri,
        animalId,
        status: 'checking',
        lat: coords?.lat,
        lng: coords?.lng,
        address: address ?? undefined,
      });

      console.log('[REPORT OK]', resp);
      setServerDoneVisible(true);
    } catch (e: any) {
      console.log('[DEBUG] 신고 실패', e);
      Alert.alert('신고 실패', String(e?.message ?? e));
    } finally {
      setSubmitting(false);
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

  const canReport =
    !submitting &&
    !recogError &&
    !!aiLabelKor &&
    typeof labelToAnimalId[aiLabelKor] === 'number';

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
        <TouchableOpacity
          style={[styles.locationPill, styles.locationBtn]}
          onPress={fetchMyLocation}
        >
          <Text style={styles.locationText}>내 위치 보기</Text>
        </TouchableOpacity>
      )}

      {/* 카메라 / 프리뷰 */}
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
            {recogError && <View style={styles.dim} />}
          </>
        )}

        {/* 결과 배지: 영어 그룹 라벨만 표시 */}
        {(aiDisplay != null || rawLabel != null) && (
          <View pointerEvents="none" style={styles.aiPillCenter}>
            <Text style={styles.aiText}>
              AI 인식 결과: {aiDisplay ?? rawLabel}
            </Text>
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

      {/* PREVIEW: 다시 찍기 / 신고하기 / 앨범 선택 */}
      {stage === 'preview' && (
        <View
          style={[styles.bottomRow, { bottom: 12 + tabBarH + insets.bottom }]}
        >
          <TouchableOpacity
            onPress={() => {
              setPhotoUri(null);
              setAiLabelKor(null);
              setAiDisplay(null);
              setAiScore(null);
              setRawLabel(null);
              setRecogError(false);
              setStage('camera');
            }}
            style={[
              styles.smallBtn,
              styles.smallBtnGrey,
              { flex: 1, marginRight: 6 },
            ]}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.smallBtnText,
                { color: '#333', textAlign: 'center' },
              ]}
            >
              다시 찍기
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleReport}
            disabled={!canReport}
            style={[
              styles.smallBtn,
              styles.smallBtnRed,
              { flex: 1, marginHorizontal: 6, opacity: canReport ? 1 : 0.5 },
            ]}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.smallBtnText,
                { color: '#fff', textAlign: 'center' },
              ]}
            >
              신고하기
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePickFromGallery}
            style={[
              styles.smallBtn,
              styles.smallBtnYellow,
              { flex: 1, marginLeft: 6 },
            ]}
            activeOpacity={0.85}
          >
            <Text
              style={[
                styles.smallBtnText,
                { color: '#000', textAlign: 'center' },
              ]}
            >
              앨범 선택
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 신고 완료 모달 */}
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
                setPhotoUri(null);
                setAiLabelKor(null);
                setAiDisplay(null);
                setAiScore(null);
                setRawLabel(null);
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
    zIndex: 2,
    elevation: 6,
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
    paddingHorizontal: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  smallBtnYellow: { backgroundColor: '#FEBA15' },
  smallBtnGrey: { backgroundColor: '#D2D2D2' },
  smallBtnRed: { backgroundColor: '#DD0000' },
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
  modalBtnText: { color: '#111', fontWeight: '700' },
});
