import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';

// ✅ 백엔드 URL (고정)
const BACKEND_URL = 'http://127.0.0.1:8000/api';

// 🔹 그룹 공지 타이틀 생성 규칙
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
  };
  if (g.notice_type && typeMap[g.notice_type]) return typeMap[g.notice_type];

  const hay = `${g.title ?? ''} ${g.reply ?? ''} ${
    g.content ?? ''
  }`.toLowerCase();

  const hasRecovery = /(복구|정상화|recovered|recovery|restored|resolved)/.test(
    hay,
  );
  const hasOutage =
    /(장애|오류|접속\s*불가|에러|error|5\d{2}|outage|downtime|service\s*unavailable)/.test(
      hay,
    );
  const hasLocation = /(위치|gps|좌표|geolocation|location|정확도)/.test(hay);
  const hasFix =
    /(수정|해결|고침|fix|fixed|patch|정정|보완|버그\s*수정|오류\s*수정)/.test(
      hay,
    );
  const hasNewFeature =
    /(신규\s*기능|새로운\s*기능|feature|기능\s*추가|added|add(ed)?\s+feature|beta\s+feature)/.test(
      hay,
    );
  const hasMaintenance = /(점검|maintenance)/.test(hay);
  const hasUpdate = /(업데이트|release|버전|패치\s*노트|patch)/.test(hay);
  const hasPolicy = /(정책|약관|privacy|policy)/.test(hay);
  const hasEvent = /(이벤트|event|캠페인|campaign)/.test(hay);

  if (hasRecovery) return '서비스 정상화 안내';
  if (hasOutage) return '서비스 장애 안내';
  if (hasLocation && hasFix) return '위치 정보 오류 수정 안내';
  if (hasNewFeature) return '새로운 기능 추가 안내';
  if (hasMaintenance) return '서비스 점검 안내';
  if (hasUpdate) return '업데이트 안내';
  if (hasPolicy) return '정책 변경 안내';
  if (hasEvent) return '이벤트 안내';

  return g.title?.trim() ? g.title : '공지';
};

export default function NotificationScreen() {
  const [selectedTab, setSelectedTab] = useState<'all' | 'personal'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [groupNotices, setGroupNotices] = useState<any[]>([]);
  const [personalNotices, setPersonalNotices] = useState<any[]>([]);
  const navigation = useNavigation();

  // ✅ userId: 로그인한 사용자 id (임시 1번)
  const userId = 1;

  useEffect(() => {
    async function loadData() {
      try {
        // 전체 공지
        const groupRes = await fetch(
          `${BACKEND_URL}/notifications/?type=group`,
        );
        const groupData = await groupRes.json();
        setGroupNotices(groupData);

        // 개인 공지
        const notiRes = await fetch(
          `${BACKEND_URL}/notifications/?user_id=${userId}&type=individual`,
        );
        const notiData = await notiRes.json();

        // 피드백
        const fbRes = await fetch(
          `${BACKEND_URL}/feedbacks/?user_id=${userId}`,
        );
        const fbData = await fbRes.json();

        // 개인 공지 + 피드백 합치기
        const merged = notiData.map((n: any) => {
          const relatedFeedbacks = fbData
            .filter((fb: any) => fb.report_id === n.report_id)
            .map((fb: any) => fb.content);
          return {
            ...n,
            feedbacks: relatedFeedbacks,
          };
        });

        setPersonalNotices(merged);
      } catch (err) {
        console.error('공지 불러오기 오류:', err);
      }
    }
    loadData();
  }, []);

  const data = selectedTab === 'all' ? groupNotices : personalNotices;

  return (
    <View style={styles.container}>
      {/* 상단 헤더 */}
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

      {/* 알림 목록 */}
      <FlatList
        data={data}
        keyExtractor={(item, index) => String(item.id ?? index)}
        renderItem={({ item }) => {
          if (selectedTab === 'all') {
            // 전체 공지 → 제목 자동 생성
            return (
              <View style={styles.noticeItem}>
                <Text style={styles.noticeTitle}>{buildGroupTitle(item)}</Text>
                <Text style={styles.noticeContent}>
                  {(item.content || item.reply || '').replace(/\\n/g, '\n')}
                </Text>
                <Text style={styles.noticeDate}>{item.created_at}</Text>
              </View>
            );
          } else {
            // 내 알림 → 상세 펼침
            const isExpanded = expandedId === item.id;
            return (
              <TouchableOpacity
                style={styles.noticeItem}
                onPress={() => setExpandedId(isExpanded ? null : item.id)}
              >
                <Text style={styles.noticeTitle}>
                  {item.status_change || '내 알림'}
                </Text>
                <Text style={styles.noticeDate}>{item.created_at}</Text>
                {isExpanded && (
                  <>
                    <Text style={styles.noticeContent}>
                      {(item.reply || '').replace(/\\n/g, '\n')}
                    </Text>
                    {item.feedbacks?.map((fb: string, idx: number) => (
                      <Text key={idx} style={styles.feedbackText}>
                        • {fb}
                      </Text>
                    ))}
                  </>
                )}
              </TouchableOpacity>
            );
          }
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
  feedbackText: { fontSize: 13, color: '#666', marginTop: 4 },
});
