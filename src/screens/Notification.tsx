// src/screens/NotificationScreen.tsx
import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  useSafeAreaInsets,
  SafeAreaView,
} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Notification'>;
type Rt = RouteProp<RootStackParamList, 'Notification'>;

const BACKEND_URL = 'http://127.0.0.1:8000/api';

/* ----------------------------- Auth utils ----------------------------- */
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

async function authFetch(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: any } = {},
) {
  const access = await AsyncStorage.getItem('accessToken');
  const doFetch = async (token: string | null) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    return fetch(url, { ...init, headers });
  };
  let res = await doFetch(access);
  if (res.status === 401) {
    try {
      const newAccess = await refreshAccessToken();
      res = await doFetch(newAccess);
    } catch {}
  }
  return res;
}

/* --------------------------- Small helpers ---------------------------- */
const normalizeNL = (s: any) =>
  String(s ?? '')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n');

const buildGroupTitle = (g: any) => {
  const typeMap: Record<string, string> = {
    maintenance: '서비스 점검 안내',
    release: '업데이트 안내',
    policy: '정책 변경 안내',
    event: '이벤트 안내',
    outage: '서비스 장애 안내',
    recovery: '서비스 정상화 안내',
    location_fix: '위치 정보 오류 수정 안내',
    new_feature: '새로운 기능 추가 안내',
    weather_alert: '기상 악화 주의 안내',
    animal_aggression: '동물 공격성 증가 주의',
    report_surge: '신고 급증 주의',
    safety_alert: '주의/위험 안내',
    wildfire_alert: '산불 주의 안내',
    environment: '환경 보호 안내',
    cleanup: '환경 정화 활동 안내',
    litter: '쓰레기/무단 투기 주의',
  };
  if (g?.notice_type && typeMap[g.notice_type]) return typeMap[g.notice_type];

  const hay = `${g?.title ?? ''} ${g?.reply ?? ''} ${
    g?.content ?? ''
  }`.toLowerCase();

  if (/(복구|정상화|recovered|recovery|restored|resolved)/.test(hay))
    return '서비스 정상화 안내';
  if (
    /(장애|오류|접속\s*불가|에러|error|5\d{2}|outage|downtime|service\s*unavailable)/.test(
      hay,
    )
  )
    return '서비스 장애 안내';

  const weatherHit =
    /(태풍|호우|폭우|강풍|폭설|대설|적설|한파|폭염|미세먼지|초미세먼지|황사|우천|우박|비바람|기상\s*특보|bad\s*weather|storm|typhoon|hail|hailstorm|heavy\s*(rain|snow)|snow\s*accumulation|strong\s*wind|heat\s*wave|cold\s*wave|fine\s*dust)/i.test(
      hay,
    );
  const cautionHit =
    /(주의|주의보|경보|특보|경계|위험|유의|조심|advisory|watch|warning|alert|caution|danger|notice|발효|발령)/i.test(
      hay,
    );
  const softWeatherCaution =
    /(으로\s*인한|예상|가능|우려|발생)/.test(hay) ||
    /(우박|적설|강풍|폭설|한파)[^\n]{0,6}시(?:\s|,|:|\.|…|·|-|$)/.test(hay);

  if (weatherHit && (cautionHit || softWeatherCaution))
    return '기상 악화 주의 안내';
  if (weatherHit) return '기상 관련 안내';

  const aggressionHit =
    /(공격성|공격적|사납|위협적|aggressive|attack(s)?|biting|charging)/.test(
      hay,
    ) && /(증가|높아졌|상승|급증|spike|uptick|빈번|더\s*자주)/.test(hay);
  if (aggressionHit) return '동물 공격성 증가 주의';

  const reportSurgeHit =
    /(신고|제보|report(s)?)/.test(hay) &&
    /(다수|급증|폭증|많음|많이|many|surge|spike|sudden\s*increase)/.test(hay);
  if (reportSurgeHit) return '신고 급증 주의';

  if (cautionHit) return '주의/위험 안내';

  if (
    /(위치|gps|좌표|geolocation|location|정확도)/.test(hay) &&
    /(수정|해결|고침|fix|fixed|patch|정정|보완|버그\s*수정|오류\s*수정)/.test(
      hay,
    )
  ) {
    return '위치 정보 오류 수정 안내';
  }

  if (
    /(신규\s*기능|새로운\s*기능|feature|기능\s*추가|added|add(ed)?\s+feature|beta\s+feature)/.test(
      hay,
    )
  )
    return '새로운 기능 추가 안내';
  if (/(점검|maintenance)/.test(hay)) return '서비스 점검 안내';
  if (/(업데이트|release|버전|패치\s*노트|patch)/.test(hay))
    return '업데이트 안내';
  if (/(정책|약관|privacy|policy)/.test(hay)) return '정책 변경 안내';
  if (/(이벤트|event|캠페인|campaign)/.test(hay)) return '이벤트 안내';

  const wildfireHit =
    /(산불|산림\s*화재|임야\s*화재|들불|forest\s*fire|wild\s*fire|bush\s*fire)/.test(
      hay,
    ) ||
    /(red\s*flag\s*warning|건조\s*(주의보|경보|특보)|화재\s*위험\s*(지수|경보)|불조심)/.test(
      hay,
    );
  if (wildfireHit) return '산불 주의 안내';

  const cleanupHit = /(정화\s*활동|클린업|clean[-\s]?up|cleanup)/.test(hay);
  const litterHit =
    /(쓰레기|무단\s*투기|illegal\s*dumping|litter|trash|garbage|waste|폐기물|담배꽁초|플라스틱|비닐|재활용|recycl(e|ing))/.test(
      hay,
    );
  const environmentHit =
    /(환경\s*보호|환경\s*캠페인|환경\s*오염|eco|sustainability|탄소\s*(중립|감축)|탄소\s*배출)/.test(
      hay,
    );

  if (cleanupHit) return '환경 정화 활동 안내';
  if (litterHit && /(주의|단속|제보|신고|경고|warning|alert)/.test(hay))
    return '쓰레기/무단 투기 주의';
  if (litterHit || environmentHit) return '환경 보호 안내';

  return g?.title?.trim() ? g.title : '공지';
};

function labelStatus(sc?: string | null) {
  if (!sc) return '-';
  const map: Record<string, string> = {
    'checking->on_hold': '접수 완료 → 보류',
    'checking->completed': '접수 완료 → 답변 완료',
    'on_hold->completed': '보류 → 답변 완료',
  };
  return map[sc] || sc;
}

function fmt(dt?: string | null) {
  if (!dt) return '';
  try {
    const d = new Date(dt);
    const p = (n: number) => (n < 10 ? `0${n}` : String(n));
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(
      d.getHours(),
    )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch {
    return String(dt);
  }
}

/** report_id 배열 → 최신 피드백 한 줄씩 맵 */
async function fetchOneFeedbackByReportIds(reportIds: number[]) {
  const uniq = Array.from(
    new Set(reportIds.filter(v => Number.isFinite(v) && v > 0)),
  );
  const map: Record<string, string> = {};
  await Promise.all(
    uniq.map(async rid => {
      try {
        const r = await authFetch(`${BACKEND_URL}/feedbacks/?report=${rid}`);
        if (!r.ok) return;
        const arr = await r.json();
        if (Array.isArray(arr) && arr.length) {
          const one = arr.reduce((a: any, b: any) =>
            String(a.feedback_datetime || '') >
            String(b.feedback_datetime || '')
              ? a
              : b,
          );
          map[String(rid)] = String(one.content || '').trim();
        }
      } catch {}
    }),
  );
  return map;
}

/* --------------------------- HeaderTabs UI ---------------------------- */
/** 리포트 화면처럼 “검은 밑줄” 탭 */
function HeaderTabs({
  value,
  onChange,
}: {
  value: 'group' | 'individual';
  onChange: (v: 'group' | 'individual') => void;
}) {
  return (
    <View style={styles.headerTabsRow}>
      {(
        [
          ['group', '전체 공지'],
          ['individual', '내 알림'],
        ] as const
      ).map(([k, label]) => {
        const active = value === k;
        return (
          <TouchableOpacity
            key={k}
            onPress={() => onChange(k)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerTab}
          >
            <Text
              style={[
                styles.headerTabText,
                active ? styles.headerTabTextActive : styles.headerTabTextDim,
              ]}
            >
              {label}
            </Text>
            <View
              style={[
                styles.headerUnderline,
                active
                  ? styles.headerUnderlineActive
                  : styles.headerUnderlineInactive,
              ]}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/* --------------------------- Main Screen ------------------------------ */
export default function NotificationScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const insets = useSafeAreaInsets();

  // 초기 탭은 route 파라미터 우선
  const routeTab: 'group' | 'individual' = route.params?.tab ?? 'group';
  const [tab, setTab] = useState<'group' | 'individual'>(routeTab);

  const [groupNotices, setGroupNotices] = useState<any[]>([]);
  const [personalNotices, setPersonalNotices] = useState<any[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 헤더에 탭 UI 배치 + 동기화 (최종 권한 setOptions)
  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      headerShadowVisible: false,
      headerStyle: { backgroundColor: '#fff' },
      headerBackground: () => (
        <View style={{ flex: 1, backgroundColor: '#fff' }} />
      ),
      headerTitle: () => (
        <HeaderTabs
          value={tab}
          onChange={v => navigation.setParams({ tab: v })}
        />
      ),
      headerRight: () => null,
    });
  }, [navigation, tab]);

  // route.params.tab 변경되면 상태 동기화
  useEffect(() => {
    if (tab !== routeTab) setTab(routeTab);
  }, [routeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // 최초 로딩: 두 리스트 모두 가져오기
  useEffect(() => {
    (async () => {
      try {
        // 전체 공지
        const g = await fetch(`${BACKEND_URL}/notifications/?type=group`);
        let groupList: any[] = [];
        try {
          const gj = await g.json();
          groupList = Array.isArray(gj) ? gj : gj?.results ?? [];
        } catch {
          groupList = [];
        }
        setGroupNotices(groupList);

        // 내 알림
        const n = await authFetch(
          `${BACKEND_URL}/notifications/?type=individual&scope=mine`,
        );
        let raw: any[] = [];
        try {
          const nj = await n.json();
          raw = Array.isArray(nj) ? nj : nj?.results ?? [];
        } catch {
          raw = [];
        }

        const rids = raw
          .map(x => Number(x.report_id))
          .filter(v => Number.isFinite(v) && v > 0);
        const fbMap = await fetchOneFeedbackByReportIds(rids);

        const normalized = raw.map(it => {
          const username =
            it?.user_name ||
            it?.user?.first_name ||
            it?.user?.username ||
            (it?.user_id ? `사용자 #${it.user_id}` : '사용자');
          const animal =
            it?.animal_name || it?.report?.animal?.name_kor || '미상';
          const rid = Number(it?.report_id) || null;

          const feedbackOne = rid != null ? fbMap[String(rid)] || '' : '';
          const replyOne = String(it?.reply || '').trim();
          const detailText = normalizeNL(replyOne || feedbackOne);

          return {
            id: Number(it?.id ?? it?.notification_id ?? 0),
            created_at: it?.created_at,
            title: `${username} - ${animal}`,
            animal,
            report_id: rid,
            status_text: labelStatus(it?.status_change),
            detailText,
          };
        });

        setPersonalNotices(normalized);
      } catch (e) {
        console.error('알림 로드 실패:', e);
        setGroupNotices([]);
        setPersonalNotices([]);
      }
    })();
  }, []);

  const data = useMemo(
    () => (tab === 'group' ? groupNotices : personalNotices),
    [tab, groupNotices, personalNotices],
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <FlatList
        data={data}
        keyExtractor={(item, idx) => String(item?.id ?? idx)}
        ListEmptyComponent={() => (
          <View style={{ padding: 16 }}>
            <Text style={{ color: '#666' }}>
              {tab === 'group' ? '공지 없음' : '내 알림 없음'}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          if (tab === 'group') {
            return (
              <View style={styles.noticeItem}>
                <Text style={styles.noticeTitle}>{buildGroupTitle(item)}</Text>
                <Text style={styles.noticeContent}>
                  {normalizeNL(item?.content || item?.reply || '')}
                </Text>
                <Text style={styles.noticeDate}>{fmt(item?.created_at)}</Text>
              </View>
            );
          }

          const isExpanded = expandedId === item.id;
          return (
            <TouchableOpacity
              style={styles.noticeItem}
              onPress={() => setExpandedId(isExpanded ? null : item.id)}
            >
              <Text style={styles.noticeTitle}>{item.title || '내 알림'}</Text>
              <Text style={styles.noticeDate}>{fmt(item.created_at)}</Text>

              {isExpanded && (
                <View>
                  <Text style={styles.meta}>
                    동물: {item.animal} · 신고 ID: {item.report_id ?? '-'}
                  </Text>
                  <Text style={styles.meta}>상태: {item.status_text}</Text>
                  {item.detailText ? (
                    <Text style={styles.feedbackText}>{item.detailText}</Text>
                  ) : null}
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  // --- Header tabs (검은 밑줄) ---
  headerTabsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 24,
    paddingBottom: 2,
  },
  headerTab: {
    alignItems: 'center',
  },
  headerTabText: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerTabTextActive: {
    color: '#000',
  },
  headerTabTextDim: {
    color: '#B0B0B0',
  },
  headerUnderline: {
    marginTop: 6,
    height: 2,
    alignSelf: 'stretch',
  },
  headerUnderlineActive: {
    backgroundColor: '#000',
  },
  headerUnderlineInactive: {
    backgroundColor: 'transparent',
  },

  // --- List items ---
  noticeItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  noticeTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  noticeContent: { fontSize: 14, color: '#444', marginTop: 6, lineHeight: 20 },
  noticeDate: { fontSize: 12, color: '#888' },
  meta: { fontSize: 13, color: '#666', marginTop: 2 },
  feedbackText: { fontSize: 13, color: '#444', marginTop: 6, lineHeight: 19 },
});
