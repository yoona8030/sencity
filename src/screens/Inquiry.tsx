import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  View,
  LayoutAnimation,
  Platform,
  UIManager,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';

export const BACKEND_URL = 'http://127.0.0.1:8000/api';

/* ===== (선택) DEV 자동 로그인 설정 — 배포 전 삭제/비활성 권장 ===== */
const DEV_USERNAME = 'yuna';
const DEV_PASSWORD = 'yuna';

/* ===== JWT 유틸 ===== */
async function refreshAccessToken() {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');
  const res = await fetch(`${BACKEND_URL}/auth/jwt/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  });
  if (!res.ok) throw new Error('Refresh token failed');
  const { access, refresh } = await res.json();
  await AsyncStorage.setItem('accessToken', access);
  if (refresh) await AsyncStorage.setItem('refreshToken', refresh);
  return access;
}

async function authFetch(url: string, init: RequestInit = {}) {
  const access = await AsyncStorage.getItem('accessToken');
  const doFetch = (token: string | null) =>
    fetch(url, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  let res = await doFetch(access);
  if (res.status === 401) {
    try {
      const newAccess = await refreshAccessToken();
      res = await doFetch(newAccess);
    } catch {}
  }
  return res;
}

async function devEnsureLogin() {
  // 이미 로그인되어 있으면 패스
  try {
    const who = await authFetch(`${BACKEND_URL}/whoami/`);
    if (who.ok) return;
  } catch {}
  // 토큰 생성
  const r = await fetch(`${BACKEND_URL}/auth/jwt/create/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: DEV_USERNAME, password: DEV_PASSWORD }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`DEV 로그인 실패: ${r.status} ${t}`);
  }
  const j = await r.json();
  await AsyncStorage.setItem('accessToken', j.access);
  await AsyncStorage.setItem('refreshToken', j.refresh);
}

/* ===== 타입 ===== */
type Tab = 'form' | 'history';
type InquiryHistoryItem = {
  id: number;
  title: string;
  content: string;
  created_at: string;
  status: '처리중' | '답변완료' | '대기' | '종료';
};

const CATEGORY_MAP: Record<string, string> = {
  '일반 문의': '기타',
  '버그/오류 제보': '버그',
  '신고 내역 관련': '신고/제보',
  '개발/연동 문의': '기능요청',
  기타: '기타',
};

const STATUS_KO: Record<string, string> = {
  open: '대기',
  pending: '처리중',
  answered: '답변완료',
  closed: '종료',
};

export default function Inquiry() {
  const [tab, setTab] = useState<Tab>('form');
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const COLORS = {
    brand: '#FEBA15',
    grayDim: '#E0E0E0',
    textOnBrand: '#111',
  };

  // 🔐 인증 상태(DEV 배너 표시용)
  const [authProblem, setAuthProblem] = useState<
    'none' | 'unauth' | 'forbidden' | 'network'
  >('none');

  /* ===== 폼 상태 ===== */
  const categories = useMemo(
    () => [
      '일반 문의',
      '버그/오류 제보',
      '신고 내역 관련',
      '개발/연동 문의',
      '기타',
    ],
    [],
  );
  const [category, setCategory] = useState('일반 문의');
  const [catOpen, setCatOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [agree, setAgree] = useState(false);

  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (
      Platform.OS === 'android' &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const canSubmit = !!title.trim() && !!body.trim() && agree;
  const submitBgColor = agree ? COLORS.brand : COLORS.grayDim;

  const submit = async () => {
    if (!canSubmit) {
      Alert.alert('확인', '분류/제목/내용 입력과 개인정보 동의가 필요합니다.');
      return;
    }
    try {
      const payload = {
        category: CATEGORY_MAP[category] ?? '기타',
        title,
        priority: 'normal',
        content: body,
      };

      const r = await authFetch(`${BACKEND_URL}/inquiries/`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());

      Alert.alert('완료', '문의가 접수되었습니다.');
      setTitle('');
      setBody('');
      setAgree(false);
      setTab('history');
      await loadHistory();
    } catch (e: any) {
      Alert.alert('전송 실패', e?.message || '잠시 후 다시 시도해주세요.');
    }
  };

  function toggleExpand(id: number) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  /* ===== 내 계정 표시(DEV만) ===== */
  const [me, setMe] = useState<{
    username?: string;
    is_staff?: boolean;
  } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // DEV 자동 로그인(옵션)
        if (__DEV__) {
          try {
            await devEnsureLogin();
          } catch {
            /* noop */
          }
        }

        const res = await authFetch(`${BACKEND_URL}/whoami/`);
        if (res.ok) {
          const m = await res.json();
          setMe({ username: m?.username, is_staff: !!m?.is_staff });
          setAuthProblem('none');
        } else if (res.status === 401) {
          setMe(null);
          setAuthProblem('unauth');
        } else if (res.status === 403) {
          setMe(null);
          setAuthProblem('forbidden');
        } else {
          setMe(null);
          setAuthProblem('unauth');
        }
      } catch {
        setMe(null);
        setAuthProblem('unauth');
      }
    })();
  }, []);

  /* ===== 내역 상태 ===== */
  const [history, setHistory] = useState<InquiryHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadHistory = async () => {
    setLoading(true);
    try {
      // 1) 기본 목록
      let listRes = await authFetch(`${BACKEND_URL}/inquiries/`);
      let raw: any = {};
      try {
        raw = await listRes.json();
      } catch {}
      if (!listRes.ok) {
        if (listRes.status === 404) {
          throw new Error('서버 라우팅(문의 API)이 설정되지 않았습니다.');
        }
        throw new Error(raw?.detail || `목록 요청 실패 (${listRes.status})`);
      }

      let rows: any[] = Array.isArray(raw) ? raw : raw.results ?? [];

      // 2) staff이고 0건이면 all 쿼리로 재시도(백엔드 커스텀 필터 대비)
      if ((me?.is_staff ?? false) && rows.length === 0) {
        const res2 = await authFetch(`${BACKEND_URL}/inquiries/?all=1`);
        const raw2 = await res2.json().catch(() => ({}));
        if (res2.ok) rows = Array.isArray(raw2) ? raw2 : raw2.results ?? rows;
      }

      // 3) 마지막 메시지 프리뷰
      const items: InquiryHistoryItem[] = await Promise.all(
        rows.map(async (it: any) => {
          let preview = '';
          try {
            const mRes = await authFetch(
              `${BACKEND_URL}/inquiries/${it.id}/messages/`,
            );
            if (mRes.ok) {
              const msgs: any[] = await mRes.json();
              const last = msgs[msgs.length - 1];
              if (last?.body) preview = String(last.body);
            }
          } catch {}

          const created =
            it?.updated_at || it?.created_at || new Date().toISOString();

          return {
            id: it?.id,
            title: it?.title ?? '(제목 없음)',
            content: preview || '(메시지 없음)',
            created_at: new Date(created).toLocaleDateString(),
            status:
              (STATUS_KO[String(it?.status)] as InquiryHistoryItem['status']) ||
              '대기',
          };
        }),
      );

      setHistory(items);
    } catch (e: any) {
      Alert.alert(
        '불러오기 실패',
        e?.message ?? '문의 내역을 가져오지 못했습니다.',
      );
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'history') loadHistory();
  }, [tab, me?.is_staff]);

  /* ===== UI ===== */
  return (
    <SafeAreaView style={st.container}>
      {/* 헤더 */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={st.headerLogo}
          />
          <Text style={st.headerTitle}>문의하기</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="close" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      {/* DEV 배너: 권한 문제 있을 때만 노출 */}
      {__DEV__ && authProblem !== 'none' && (
        <View style={st.devBanner}>
          <Text style={st.devText}>
            {authProblem === 'unauth'
              ? '로그인이 필요합니다 (개발용)'
              : '권한이 없습니다 (개발용)'}
            {me?.username ? ` — 현재: ${me.username}` : ''}
          </Text>

          <TouchableOpacity
            onPress={async () => {
              try {
                await devEnsureLogin();
                const res = await authFetch(`${BACKEND_URL}/whoami/`);
                if (res.ok) {
                  const m = await res.json();
                  setMe({ username: m?.username, is_staff: !!m?.is_staff });
                  setAuthProblem('none');
                }
              } catch (e: any) {
                Alert.alert('개발 로그인 실패', e?.message ?? '토큰 발급 실패');
              }
            }}
            style={st.devLoginBtn}
            activeOpacity={0.85}
          >
            <Text style={st.devLoginBtnText}>개발 로그인</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 탭 */}
      <View style={st.tabBar}>
        <TouchableOpacity
          style={[st.tab, tab === 'form' && st.tabActive]}
          onPress={() => setTab('form')}
          activeOpacity={0.9}
        >
          <Text style={[st.tabText, tab === 'form' && st.tabTextActive]}>
            문의하기
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.tab, tab === 'history' && st.tabActive]}
          onPress={() => setTab('history')}
          activeOpacity={0.9}
        >
          <Text style={[st.tabText, tab === 'history' && st.tabTextActive]}>
            문의내역 확인
          </Text>
        </TouchableOpacity>
      </View>

      {/* 콘텐츠 */}
      {tab === 'form' ? (
        <>
          <View style={st.formArea}>
            <Text style={st.label}>문의 분류</Text>

            <View style={st.catBox}>
              <TouchableOpacity
                style={st.inputBox}
                onPress={() => setCatOpen(o => !o)}
                activeOpacity={0.9}
              >
                <Text style={[st.inputText, !!category && st.inputFilled]}>
                  {category || '일반 문의'}
                </Text>
                <Icon
                  name={catOpen ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#C3C3C3"
                />
              </TouchableOpacity>

              {catOpen && (
                <View style={st.dropdownAbsolute}>
                  {categories.map(c => {
                    const selected = c === category;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[st.dropdownItem, selected && st.dropdownItemOn]}
                        onPress={() => {
                          setCategory(c);
                          setCatOpen(false);
                        }}
                        activeOpacity={0.85}
                      >
                        <Text
                          style={[
                            st.dropdownText,
                            selected && st.dropdownTextOn,
                          ]}
                        >
                          {c}
                        </Text>
                        {selected && (
                          <Icon name="checkmark" size={18} color="#222" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* 제목 */}
            <Text style={[st.label, { marginTop: 14 }]}>문의 제목</Text>
            <View style={[st.inputBox, { height: 44 }]}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="제목을 입력해주세요"
                placeholderTextColor="#BDBDBD"
                style={st.textInput}
              />
            </View>

            {/* 내용 */}
            <Text style={[st.label, { marginTop: 14 }]}>문의 내용</Text>
            <View
              style={[
                st.inputBox,
                { height: 132, alignItems: 'flex-start', paddingTop: 10 },
              ]}
            >
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder=""
                placeholderTextColor="#BDBDBD"
                style={[
                  st.textInput,
                  { height: '100%', textAlignVertical: 'top' },
                ]}
                multiline
              />
            </View>

            {/* 파일 첨부 (추후) */}
            <Text style={[st.label, { marginTop: 14 }]}>파일 첨부</Text>
            <View
              style={[
                st.inputBox,
                { height: 44, justifyContent: 'flex-start', paddingRight: 44 },
              ]}
            >
              <Text style={st.attachText}>+ 파일 첨부</Text>
              <TouchableOpacity style={st.attachIconBtn} activeOpacity={0.8}>
                <Icon name="attach-outline" size={18} color="#777" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 하단 */}
          <View style={st.bottomBar}>
            <View style={st.agreeRow}>
              {/* 커스텀 체크박스 (외부 라이브러리 제거) */}
              <Pressable
                onPress={() => setAgree(v => !v)}
                hitSlop={8}
                style={({ pressed }) => [
                  st.checkboxBase,
                  agree && st.checkboxOn,
                  pressed && { opacity: 0.9 },
                ]}
              >
                {agree ? (
                  <Icon name="checkmark" size={16} color="#fff" />
                ) : null}
              </Pressable>
              <Text style={st.agreeText}>개인정보 수집 및 이용</Text>
            </View>

            <TouchableOpacity
              disabled={!canSubmit}
              onPress={submit}
              style={[st.submitBtn, { backgroundColor: submitBgColor }]}
              activeOpacity={0.9}
            >
              <Text style={st.submitText}>문의 접수</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <View style={st.historyArea}>
          {loading ? (
            <View style={st.emptyWrap}>
              <Text style={st.emptySub}>불러오는 중…</Text>
            </View>
          ) : history.length === 0 ? (
            <View style={st.emptyWrap}>
              <Text style={st.emptyTitle}>표시할 문의 내역이 없습니다</Text>
              <Text style={st.emptySub}>
                새 문의를 등록하거나 잠시 후 다시 시도해 주세요.
              </Text>
              <TouchableOpacity style={st.reloadBtn} onPress={loadHistory}>
                <Text style={st.reloadText}>새로고침</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={history}
              keyExtractor={it => String(it.id)}
              ItemSeparatorComponent={() => <View style={st.divider} />}
              renderItem={({ item }) => {
                const color =
                  item.status === '처리중'
                    ? '#FEBA15'
                    : item.status === '답변완료'
                    ? '#DD0000'
                    : '#666666';

                const isExpanded = expandedIds.has(item.id);

                return (
                  <View style={st.histRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={st.histTitle}>[문의제목] {item.title}</Text>

                      <View style={st.summaryRow}>
                        <Text
                          style={[st.histSummary, { flex: 1 }]}
                          numberOfLines={isExpanded ? undefined : 1}
                          ellipsizeMode="tail"
                        >
                          [문의내용] {item.content}
                        </Text>
                        <Text
                          style={[st.statusPlain, { color }]}
                          numberOfLines={1}
                        >
                          {item.status}
                        </Text>
                      </View>

                      <View style={st.histFooterInline}>
                        <Text style={st.histDate}>
                          [날짜] {item.created_at}
                        </Text>
                        <Text style={st.dot}> | </Text>
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => toggleExpand(item.id)}
                          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                        >
                          <Text style={st.histLink}>
                            {isExpanded ? '[접기]' : '[자세히 보기]'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              }}
              contentContainerStyle={{ paddingBottom: 16 }}
            />
          )}
        </View>
      )}

      {catOpen && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setCatOpen(false)}
          style={st.scrim}
        />
      )}
    </SafeAreaView>
  );
}

/* ===== 스타일 ===== */
const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  header: {
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerLogo: { width: 50, height: 50, resizeMode: 'contain', marginRight: 8 },
  headerTitle: { fontSize: 23, fontWeight: '700', color: '#111' },

  /* DEV banner */
  devBanner: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#FFF6E5',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE4B5',
  },
  devText: { color: '#7A4B00', fontSize: 12, fontWeight: '700' },
  devLoginBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#FFE4B5',
    borderRadius: 6,
  },
  devLoginBtnText: { fontSize: 12, fontWeight: '700', color: '#7A4B00' },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
  },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#111' },
  tabText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#A9A9A9',
    textAlign: 'center',
  },
  tabTextActive: { color: '#111' },

  formArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 120,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginTop: 8,
    marginBottom: 8,
  },
  inputBox: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E6E6E6',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputText: { color: '#BDBDBD', fontSize: 15 },
  inputFilled: { color: '#222' },
  textInput: { flex: 1, fontSize: 15, color: '#222' },

  catBox: { position: 'relative', zIndex: 20 },
  dropdownAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E6E6E6',
    backgroundColor: '#fff',
    overflow: 'hidden',
    zIndex: 30,
    elevation: 12,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F8F4E1',
  },
  dropdownItemOn: { backgroundColor: '#F8F4E1' },
  dropdownText: { fontSize: 15, color: '#222' },
  dropdownTextOn: { fontWeight: '700', color: '#111' },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    bottom: 120,
    zIndex: 15,
    elevation: 8,
  },

  attachText: { fontSize: 15, color: '#777', fontWeight: '700' },
  attachIconBtn: {
    position: 'absolute',
    right: 10,
    height: 28,
    width: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F6F6F6',
  },

  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
    zIndex: 1,
    elevation: 1,
  },
  agreeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  agreeText: { fontSize: 13, fontWeight: '700', color: '#333' },
  checkboxBase: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#D2D2D2',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxOn: {
    backgroundColor: '#DD0000',
    borderColor: '#DD0000',
  },
  submitBtn: {
    height: 50,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontSize: 16, color: '#111', fontWeight: '700' },

  historyArea: { flex: 1, paddingHorizontal: 14, paddingTop: 10 },
  histRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  histTitle: { fontSize: 15, fontWeight: '600', color: '#111' },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  histSummary: { marginTop: 8, color: '#555', fontWeight: '600' },
  statusPlain: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 64,
    flexShrink: 0,
  },

  histFooterInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  histDate: { color: '#666', fontSize: 12, fontWeight: '600' },
  histLink: { color: '#666', fontSize: 12, fontWeight: '600' },
  dot: { marginHorizontal: 6, color: '#666', fontSize: 12, fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#EEE' },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  emptySub: { marginTop: 6, fontSize: 13, color: '#777' },
  reloadBtn: {
    marginTop: 12,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 9,
    backgroundColor: '#F3F3F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reloadText: { fontSize: 13, fontWeight: '700', color: '#333' },
});
