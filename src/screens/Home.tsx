import React, { useCallback, useEffect, useState, useRef } from 'react';
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
  Platform,
  // ScrollView,
  NativeScrollEvent,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { KAKAO_JS_KEY } from '@env';
import { WebView } from 'react-native-webview';
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RouteProp } from '@react-navigation/native';
import type { TabParamList } from '../navigation/TabNavigator';

type ReportTab = 'stats' | 'history';

export default function Home() {
  const insets = useSafeAreaInsets();
  const TOP_SHAVE = 8; // 4~10 사이에서 취향대로 조절
  const topPadding = Math.max(insets.top - TOP_SHAVE, 0);
  // 1초마다 갱신되는 시계
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const route = useRoute<RouteProp<TabParamList, 'Report'>>();
  const focus = route.params?.focus; // 'history' | undefined
  const [tab, setTab] = useState<'overview' | 'history'>('overview');

  const focusParam = route.params?.focus; // 'history' | undefined
  const trigger = route.params?._t; // number | undefined

  useEffect(() => {
    if (focusParam === 'history') {
      setTab('history');
    }
  }, [focusParam, trigger]);

  useFocusEffect(
    useCallback(() => {
      if (focusParam === 'history') setTab('history');
    }, [focusParam, trigger]),
  );

  const dateString = `${now.getFullYear()}년 ${String(
    now.getMonth() + 1,
  ).padStart(2, '0')}월 ${String(now.getDate()).padStart(2, '0')}일`;
  const hour = now.getHours();
  const meridiem = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const timeString = `${meridiem} ${String(hour12).padStart(2, '0')}시 ${String(
    now.getMinutes(),
  ).padStart(2, '0')}분`;

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

  const navigation = useNavigation<BottomTabNavigationProp<TabParamList>>();
  const goReport = () => navigation.navigate('Report'); // Report 탭으로 이동
  const goReportHistory = () =>
    navigation.navigate('Report', { focus: 'history', _t: Date.now() }); // ← 포커스+트리거

  const kakaoMapHtml = `
    <!DOCTYPE html><html><head>
      <meta name="viewport" content="initial-scale=1.0, maximum-scale=1.0"/>
      <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}"></script>
      <style>html,body,#map{margin:0;padding:0;height:100%;}</style>
    </head><body>
      <div id="map"></div>
      <script>
        const map = new kakao.maps.Map(
          document.getElementById('map'),
          { center: new kakao.maps.LatLng(37.54217,126.9368), level: 4 }
        );
        new kakao.maps.Marker({ position: map.getCenter(), map });
      </script>
    </body></html>
  `;

  return (
    <>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <SafeAreaView
        // top은 직접 처리하므로 제외
        edges={['left', 'right', 'bottom']}
        style={[styles.safeArea, { paddingTop: topPadding }]}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Image
              source={require('../../assets/images/logo.png')}
              style={styles.logo}
            />
            <View style={styles.headerText}>
              <Text style={styles.appName}>SENCITY</Text>
              <Text style={styles.date}>{dateString}</Text>
              <Text style={styles.time}>{timeString}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <TouchableOpacity
              style={styles.statCard}
              onPress={goReport}
              activeOpacity={0.8}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.statTitle}>총 신고 수</Text>
              <Text style={styles.statValue}>16건</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={goReport}
              activeOpacity={0.8}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Text style={styles.statTitle}>가장 많이 신고한 동물</Text>
              <Text style={styles.statValue}>고라니</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              onPress={goReportHistory}
              activeOpacity={0.8}
            >
              <Text style={styles.statTitle}>마지막 신고일</Text>
              <Text style={styles.statValue}>2025.04.20</Text>
            </TouchableOpacity>
          </View>

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
                  <Icon name="expand" size={24} color="#fff" />
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
          <View style={styles.mapSection}>
            <WebView
              originWhitelist={['*']}
              source={{ html: kakaoMapHtml }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
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
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },

  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'flex-start', // 화면 상단부터 차게
    paddingBottom: 0,
  },

  // 1. Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 0, // 위/아래 여백 감소
    marginBottom: 10, // 카드와 간격 소폭 축소
  },
  logo: {
    width: 100,
    height: 90,
    resizeMode: 'contain',
  },
  headerText: {
    marginLeft: 12,
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00000',
  },
  date: {
    fontSize: 14,
    color: '#00000',
    marginTop: 2,
  },
  time: {
    fontSize: 14,
    color: '#00000',
    marginTop: 2,
  },

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
  },
  statValue: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  newsCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  newsImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  expandBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    padding: 4,
  },
  carouselWrap: {
    position: 'relative',
    marginBottom: 2, // ← 지도와의 간격 최소화 (원하면 0~8 사이로 조절)
  },
  dotsAbsolute: {
    position: 'absolute',
    bottom: 8, // 도트를 카드 하단 쪽으로 붙임
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
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  activeDot: { backgroundColor: '#fff' },
  inactiveDot: { backgroundColor: 'rgba(255,255,255,0.5)' },

  mapSection: {
    height: 330,
    // flex: 1,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 0,
    marginBottom: 5,
  },
  webview: {
    ...StyleSheet.absoluteFillObject,
  },
});
