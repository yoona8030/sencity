// src/screens/Home.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Linking,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  StatusBar,
  NativeScrollEvent,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { KAKAO_JS_KEY } from '@env';
import { WebView } from 'react-native-webview';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { TabParamList } from '../navigation/TabNavigator';
import { getJSON } from '../api/client';
import { useAppAlert } from '../components/AppAlertProvider';
import { handleApiError } from '../api/handleApiError';

type Summary = {
  total_reports: number;
  top_animal: { id: number; name: string; count: number } | null;
  last_report_date: string | null;
};

export default function Home() {
  const insets = useSafeAreaInsets();

  // ✅ 상단을 "더 내리고" 싶다면: EXTRA_TOP을 더한다
  const EXTRA_TOP = 0; // ← 취향에 따라 12~24
  const topPadding = insets.top + EXTRA_TOP;

  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const { notify } = useAppAlert();

  // 시계
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const dateString = `${now.getFullYear()}년 ${String(
    now.getMonth() + 1,
  ).padStart(2, '0')}월 ${String(now.getDate()).padStart(2, '0')}일`;
  const hour = now.getHours();
  const meridiem = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const timeString = `${meridiem} ${String(hour12).padStart(2, '0')}시 ${String(
    now.getMinutes(),
  ).padStart(2, '0')}분`;

  // 요약 데이터
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<Summary | null>(null);

  const formatDate = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${dy}`;
  };

  const fetchSummary = async () => {
    try {
      const data = await getJSON<Summary>(
        '/reports/summary/?scope=global&period=all',
      );
      setSummary(data);
    } catch (e) {
      await handleApiError(e, notify, navigation);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const total = summary?.total_reports ?? 0;
  const topAnimal = summary?.top_animal?.name ?? '-';
  const lastDate = formatDate(summary?.last_report_date ?? null);

  // 뉴스/맵
  const newsList = [
    {
      id: '1',
      title: '중계동에 멧돼지 출현, 은행 ATM 부스에 돌진',
      image: require('../../assets/images/news1.png'),
      url: 'https://www.yna.co.kr/view/AKR20220806025200004',
    },
    {
      id: '2',
      title: '고라니 도심 출몰, 시민 불안 고조',
      image: require('../../assets/images/news2.png'),
      url: 'https://www.chosun.com/…/',
    },
  ];
  const { width } = Dimensions.get('window');
  const H_PADDING = 16;
  const CARD_WIDTH = width - H_PADDING * 2;
  const CARD_HEIGHT = (CARD_WIDTH * 9) / 16;
  const SNAP_INTERVAL = CARD_WIDTH + 16;

  const [activeIndex, setActiveIndex] = useState(0);
  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SNAP_INTERVAL);
    setActiveIndex(idx);
  };

  const goReportStats = () =>
    navigation.navigate('Report', { focus: 'stats', _t: Date.now() });
  const goReportHistory = () =>
    navigation.navigate('Report', { focus: 'history', _t: Date.now() });

  const kakaoMapHtml = useMemo(() => {
    const key = KAKAO_JS_KEY || '';
    return `
    <!DOCTYPE html><html><head>
      <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0"/>
      ${
        key
          ? `<script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${key}"></script>`
          : ''
      }
      <style>html,body,#map{margin:0;padding:0;height:100%;}</style>
    </head><body>
      <div id="map"></div>
      <script>
        ${
          key
            ? `
          const map = new kakao.maps.Map(
            document.getElementById('map'),
            { center: new kakao.maps.LatLng(37.54217,126.9368), level: 4 }
          );
          new kakao.maps.Marker({ position: map.getCenter(), map });
        `
            : `
          document.getElementById('map').innerHTML =
            '<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#888">KAKAO_JS_KEY 누락</div>';
        `
        }
      </script>
    </body></html>
  `;
  }, [KAKAO_JS_KEY]);

  const StatCard = ({
    title,
    value,
    onPress,
    loading,
    style,
  }: {
    title: string;
    value: string | number;
    onPress?: () => void;
    loading?: boolean;
    style?: StyleProp<ViewStyle>;
  }) => (
    <TouchableOpacity
      style={[styles.statCard, style]}
      onPress={onPress}
      activeOpacity={0.8}
      disabled={loading}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <Text style={styles.statTitle}>{title}</Text>
      {loading ? (
        <ActivityIndicator size="small" style={{ marginTop: 6 }} />
      ) : (
        <Text style={styles.statValue}>{value}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <SafeAreaView
        edges={['left', 'right', 'bottom']}
        style={[
          styles.safeArea,
          { paddingTop: topPadding, paddingBottom: insets.bottom },
        ]}
      >
        <View style={styles.container}>
          {/* 그룹 2 헤더 */}
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
            />
            <View style={styles.headerText}>
              <Text style={styles.appName}>SENCITY</Text>
              <View style={{ gap: 2 }}>
                <Text style={styles.date}>{dateString}</Text>
                <Text style={styles.time}>{timeString}</Text>
              </View>
            </View>
          </View>

          {/* 통계 카드 */}
          <View style={styles.statsRow}>
            <StatCard
              title="총 신고 수"
              value={`${total}건`}
              onPress={goReportStats}
              loading={loading}
            />
            <StatCard
              title="가장 많이 신고한 동물"
              value={topAnimal}
              onPress={goReportStats}
              loading={loading}
            />
            <StatCard
              title="마지막 신고일"
              value={lastDate}
              onPress={goReportHistory}
              loading={loading}
            />
          </View>

          {/* 뉴스 캐러셀 */}
          <FlatList
            data={newsList}
            keyExtractor={item => item.id}
            horizontal
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            snapToInterval={SNAP_INTERVAL}
            snapToAlignment="start"
            onMomentumScrollEnd={onScrollEnd}
            contentContainerStyle={{ paddingHorizontal: H_PADDING }}
            style={{ marginBottom: 0 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.newsCard,
                  { width: CARD_WIDTH, height: CARD_HEIGHT, marginRight: 16 },
                ]}
                onPress={() => Linking.openURL(item.url)}
                activeOpacity={0.8}
              >
                <Image source={item.image} style={styles.newsImage} />
                <TouchableOpacity style={styles.expandBtn}>
                  <Icon name="expand-outline" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.newsOverlayText}>{item.title}</Text>
              </TouchableOpacity>
            )}
          />

          {/* Pagination Dots */}
          <View style={styles.dotsAbsolute}>
            {newsList.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === activeIndex ? styles.activeDot : styles.inactiveDot,
                ]}
              />
            ))}
          </View>

          {/* 지도 섹션 */}
          <View style={styles.mapSection}>
            <WebView
              originWhitelist={['*']}
              source={{ html: kakaoMapHtml }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              mixedContentMode="always"
            />
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Map')}
            />
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
    paddingBottom: 0,
  },

  // ── 그룹 2 헤더 (여유 있게)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14, // ⬅ 8 → 14 로 늘림 (내부 여백 증가)
    marginBottom: 12, // ⬅ 헤더와 콘텐츠 간 간격도 살짝 늘림
  },
  logo: {
    width: 92, // 필요 시 더 키워도 OK
    height: 82,
    resizeMode: 'contain',
  },
  headerText: { marginLeft: 14 }, // ⬅ 로고와 텍스트 간격 +2
  appName: { fontSize: 20, fontWeight: 'bold', color: '#000' }, // 그룹2 타이틀 20
  date: { fontSize: 14, color: '#000' }, // 그룹2 서브 14
  time: { fontSize: 14, color: '#000' },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FEBA15',
    borderRadius: 12,
    paddingVertical: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    height: 96,
  },
  statTitle: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    textAlignVertical: 'center',
    color: '#1b1b1b',
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
    marginTop: 6,
    color: '#1b1b1b',
  },

  newsCard: { borderRadius: 12, overflow: 'hidden' },
  newsImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  expandBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 4,
  },

  dotsAbsolute: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  newsOverlayText: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
    padding: 6,
    borderRadius: 4,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 4 },
  activeDot: { backgroundColor: '#fff' },
  inactiveDot: { backgroundColor: 'rgba(255,255,255,0.5)' },

  mapSection: {
    height: 335,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 0,
    marginBottom: 5,
  },
  webview: { ...StyleSheet.absoluteFillObject },
});
