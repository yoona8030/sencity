// NotificationScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKEND_URL = 'http://127.0.0.1:8000/api';

/** 토큰 유틸 */
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

/** 그룹 공지 타이틀 */
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
  if (g.notice_type && typeMap[g.notice_type]) return typeMap[g.notice_type];

  const hay = `${g.title ?? ''} ${g.reply ?? ''} ${
    g.content ?? ''
  }`.toLowerCase();

  // 1) 서비스 정상화/장애 (가장 높은 우선순위 유지)
  if (/(복구|정상화|recovered|recovery|restored|resolved)/.test(hay))
    return '서비스 정상화 안내';
  if (
    /(장애|오류|접속\s*불가|에러|error|5\d{2}|outage|downtime|service\s*unavailable)/.test(
      hay,
    )
  )
    return '서비스 장애 안내';

  // 2) 기상 악화 주의
  const weatherHit =
    /(태풍|호우|폭우|강풍|폭설|대설|적설|적설량|한파|폭염|미세먼지|초미세먼지|황사|우천|우박|비바람|기상\s*특보|bad\s*weather|storm|typhoon|hail|hailstorm|heavy\s*(rain|snow)|snow\s*accumulation|accumulated\s*snow|strong\s*wind|heat\s*wave|cold\s*wave|fine\s*dust)/i.test(
      hay,
    );

  const cautionHit =
    /(주의|주의보|경보|특보|경계|위험|유의|조심|advisory|watch|warning|alert|caution|danger|notice|발효|발령)/i.test(
      hay,
    );

  // 🌟 소프트 주의: "우박으로 인한", "적설 시 ..." 같은 표현도 주의로 간주
  const softWeatherCaution =
    /(으로\s*인한|예상|가능|우려|발생)/.test(hay) ||
    // "우박|적설|강풍|폭설|한파 + '시' ..." 패턴 (예: "적설 시 주의")
    /(우박|적설|강풍|폭설|한파)[^\n]{0,6}시(?:\s|,|:|\.|…|·|-|$)/.test(hay);

  // 강한 타이틀
  if (weatherHit && (cautionHit || softWeatherCaution)) {
    return '기상 악화 주의 안내';
  }

  // (선택) 폴백: 주의 단어가 없어도 날씨 이슈면 안내
  if (weatherHit) {
    return '기상 관련 안내';
  }

  // 3) 동물 공격성 증가 주의
  const aggressionHit =
    /(공격성|공격적|사납|위협적|aggressive|attack(s)?|biting|charging)/.test(
      hay,
    ) && /(증가|높아졌|상승|급증|spike|uptick|빈번|더\s*자주)/.test(hay);
  if (aggressionHit) return '동물 공격성 증가 주의';

  // 4) 신고 급증 주의
  const reportSurgeHit =
    /(신고|제보|report(s)?)/.test(hay) &&
    /(다수|급증|폭증|많음|많이|many|surge|spike|sudden\s*increase)/.test(hay);
  if (reportSurgeHit) return '신고 급증 주의';

  // 5) 일반 주의/위험
  if (cautionHit) return '주의/위험 안내';

  // 6) 위치 정보 오류 수정
  if (
    /(위치|gps|좌표|geolocation|location|정확도)/.test(hay) &&
    /(수정|해결|고침|fix|fixed|patch|정정|보완|버그\s*수정|오류\s*수정)/.test(
      hay,
    )
  )
    return '위치 정보 오류 수정 안내';

  // 7) 신규 기능/점검/업데이트/정책/이벤트
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

  // 8) 🔥 산불 경보/주의 (고우선)
  const wildfireHit =
    /(산불|산림\s*화재|임야\s*화재|들불|forest\s*fire|wild\s*fire|bush\s*fire)/.test(
      hay,
    ) ||
    /(red\s*flag\s*warning|건조\s*(주의보|경보|특보)|화재\s*위험\s*(지수|경보)|불조심)/.test(
      hay,
    );
  if (wildfireHit) return '산불 주의 안내';

  // 9) 🌱 환경(정화/무단투기/보호)
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

  // 8) 마지막: 제목 있으면 제목, 없으면 기본값
  return g.title?.trim() ? g.title : '공지';
};

/** 상태 라벨 */
function labelStatus(sc?: string | null) {
  if (!sc) return '-';
  const map: Record<string, string> = {
    'checking->on_hold': '접수 완료 → 보류',
    'checking->completed': '접수 완료 → 답변 완료',
    'on_hold->completed': '보류 → 답변 완료',
  };
  return map[sc] || sc;
}

/** 날짜 포맷 */
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

/** report_id → 최신 피드백 1줄만(없으면 빈문자열) */
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

export default function NotificationScreen() {
  const [selectedTab, setSelectedTab] = useState<'all' | 'personal'>('all');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [groupNotices, setGroupNotices] = useState<any[]>([]);
  const [personalNotices, setPersonalNotices] = useState<any[]>([]);
  const navigation = useNavigation();

  useEffect(() => {
    (async () => {
      try {
        // 전체 공지
        const g = await fetch(`${BACKEND_URL}/notifications/?type=group`);
        setGroupNotices(g.ok ? (await g.json()) ?? [] : []);

        // 내 알림
        const n = await authFetch(
          `${BACKEND_URL}/notifications/?type=individual&scope=mine`,
        );
        const list: any[] = n.ok ? (await n.json()) ?? [] : [];

        // report_id별 피드백 1줄 확보
        const rids = list
          .map(x => Number(x.report_id))
          .filter(v => Number.isFinite(v) && v > 0);
        const fbMap = await fetchOneFeedbackByReportIds(rids);

        // 화면용 데이터(제목/상세 동일 소스 + 내용은 1줄만)
        const normalized = list.map(it => {
          const username =
            it.user_name ||
            it.user?.first_name ||
            it.user?.username ||
            (it.user_id ? `사용자 #${it.user_id}` : '사용자');
          const animal =
            it.animal_name || it.report?.animal?.name_kor || '미상';
          const rid = Number(it.report_id) || null;

          // ✅ 표시할 본문: feedback(있으면) 1줄, 아니면 reply 1줄. 그 외 일절 렌더 X
          const feedbackOne = rid != null ? fbMap[String(rid)] || '' : '';
          const replyOne = String(it.reply || '').trim();
          const detailText = (replyOne || feedbackOne).replace(/\\n/g, '\n');

          return {
            id: Number(it.id ?? it.notification_id ?? 0),
            created_at: it.created_at,
            title: `${username} - ${animal}`,
            animal,
            report_id: rid,
            status_text: labelStatus(it.status_change),
            detailText, // ← 단 한 줄만!
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
    () => (selectedTab === 'all' ? groupNotices : personalNotices),
    [selectedTab, groupNotices, personalNotices],
  );

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.tabContainer}>
          <TouchableOpacity onPress={() => setSelectedTab('all')}>
            <Text
              style={[styles.tab, selectedTab === 'all' && styles.activeTab]}
            >
              전체 공지
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSelectedTab('personal')}>
            <Text
              style={[
                styles.tab,
                selectedTab === 'personal' && styles.activeTab,
              ]}
            >
              내 알림
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="close-outline" size={28} color="black" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={data}
        keyExtractor={(item, idx) => String(item.id ?? idx)}
        renderItem={({ item }) => {
          if (selectedTab === 'all') {
            return (
              <View style={styles.noticeItem}>
                <Text style={styles.noticeTitle}>{buildGroupTitle(item)}</Text>
                <Text style={styles.noticeContent}>
                  {(item.content || item.reply || '').replace(/\\n/g, '\n')}
                </Text>
                <Text style={styles.noticeDate}>{fmt(item.created_at)}</Text>
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
                <>
                  <Text style={styles.meta}>
                    동물: {item.animal} · 신고 ID: {item.report_id ?? '-'}
                  </Text>
                  <Text style={styles.meta}>상태: {item.status_text}</Text>

                  {/* ✅ 단 하나의 본문만 렌더 */}
                  {item.detailText ? (
                    <Text style={styles.feedbackText}>{item.detailText}</Text>
                  ) : null}
                </>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabContainer: { flexDirection: 'row' },
  tab: { marginHorizontal: 20, fontSize: 16, color: '#888' },
  activeTab: {
    color: 'black',
    fontWeight: 'bold',
    borderBottomWidth: 2,
    borderBottomColor: 'black',
  },
  closeButton: { position: 'absolute', right: 16 },
  noticeItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  noticeTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  noticeContent: { fontSize: 14, color: '#444', marginTop: 6 },
  noticeDate: { fontSize: 12, color: '#888' },
  meta: { fontSize: 13, color: '#666', marginTop: 2 },
  feedbackText: { fontSize: 13, color: '#444', marginTop: 6, lineHeight: 19 },
});
