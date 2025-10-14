// src/screens/Report.tsx
import React, {
  useState,
  useRef,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
  StyleSheet as RNStyleSheet,
  useWindowDimensions,
} from 'react-native';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetFooter,
} from '@gorhom/bottom-sheet';
import type { BottomSheetFooterProps } from '@gorhom/bottom-sheet';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import {
  useRoute,
  useFocusEffect,
  useNavigation,
  RouteProp,
} from '@react-navigation/native';

import { PieChart } from 'react-native-gifted-charts/dist/PieChart';
import { animalImages } from '../utils/animalImages';
import type { TabParamList } from '../navigation/TabNavigator';

import { getJSON } from '../api/client';

// --- 신고 관련 유틸/함수(통일) ---
import { API_BASE, authFetch, getAccessTokenSync, hasRefreshToken } from '../utils/auth';
import { createReportAuto } from '../api/report';

const H_PADDING = 16;
type TabLabel = 'stats' | 'history';

function getDateRange(period: string) {
  const today = new Date();
  let from: Date | null = null;

  switch (period) {
    case '최근 1개월':
      from = new Date(today);
      from.setMonth(today.getMonth() - 1);
      break;
    case '최근 3개월':
      from = new Date(today);
      from.setMonth(today.getMonth() - 3);
      break;
    case '최근 6개월':
      from = new Date(today);
      from.setMonth(today.getMonth() - 6);
      break;
    case '최근 1년':
      from = new Date(today);
      from.setFullYear(today.getFullYear() - 1);
      break;
    default:
      return null;
  }
  return {
    from: from.toISOString().split('T')[0],
    to: today.toISOString().split('T')[0],
  };
}

type AnimalStat = { animal: string; count: number };
type RegionByAnimal = { city: string; animal: string; count: number };

type ReportItemAPI =
  | {
      id?: number;
      report_id?: number;
      status?: string;
      report_date?: string;
      animal?: { name_kor?: string } | null;
      animal_name?: string;
      location?: { address?: string } | null;
    }
  | any;

export default function Report() {
  const TAB_TOP_GAP = 0;

  const [activeTab, setActiveTab] = useState<'신고 통계' | '기록 조회'>('신고 통계');
  const { height: SCREEN_H } = useWindowDimensions();
  const snapPoints = useMemo(() => {
    const MAX_PERCENT = 0.67;
    const maxPercentPoint = `${Math.round(MAX_PERCENT * 100)}%`;
    return ['40%', maxPercentPoint];
  }, [SCREEN_H]);

  const [selectedPeriod, setSelectedPeriod] = useState('날짜 조회');
  const [appliedPeriod, setAppliedPeriod] = useState('날짜 조회');

  const bottomSheetRef = useRef<BottomSheet>(null);
  const tabBarH = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const TABBAR_FALLBACK = 56;
  const bottomGap = Math.max(tabBarH || TABBAR_FALLBACK, insets.bottom, 12);

  const route = useRoute<RouteProp<TabParamList, 'Report'>>();
  const navigation = useNavigation();
  const focusParam = route.params?.focus as 'stats' | 'history' | undefined;
  const trigger = route.params?._t;

  // ======= 신고 예제(통일 규칙) =======
  const submitReportExample = useCallback(async (pickedUri: string) => {
    const isLoggedIn = !!getAccessTokenSync() || hasRefreshToken();

    if (isLoggedIn) {
      // 로그인 신고: *_id 규약
      await createReportAuto({
        mode: 'auth',
        animalId: 13,          // 예시값
        locationId: 1,         // 예시값 (실사용 시 선택값/가까운 PK 등)
        imageUri: pickedUri,
        status: 'checking',
      });
    } else {
      // 비로그인 신고: lat,lng
      const lat = 37.5665, lng = 126.9780; // 예시값
      const fd = new FormData();
      fd.append('animalId', String(13));
      fd.append('lat', String(lat));
      fd.append('lng', String(lng));
      fd.append('status', 'checking');
      fd.append('photo', { uri: pickedUri, type: 'image/jpeg', name: 'photo.jpg' } as any);

      // no-auth는 authFetch가 아니라 일반 fetch 사용
      await fetch(`${API_BASE}/reports/no-auth`, { method: 'POST', body: fd }).then(r => {
        if (!r.ok) return r.text().then(t => Promise.reject(new Error(`${r.status} ${t}`)));
      });
    }
  }, []);

  // 외부에서 탭 지정
  useEffect(() => {
    if (focusParam === 'history') setActiveTab('기록 조회');
    if (focusParam === 'stats') setActiveTab('신고 통계');
  }, [focusParam, trigger]);

  useFocusEffect(
    useCallback(() => {
      const f = route.params?.focus as 'stats' | 'history' | undefined;
      if (f === 'stats') setActiveTab('신고 통계');
      else if (f === 'history') setActiveTab('기록 조회');
    }, [route.params?.focus, route.params?._t]),
  );

  useEffect(() => {
    if (focusParam) {
      navigation.setParams({ focus: undefined, _t: undefined } as any);
    }
  }, [activeTab]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.5}
      />
    ),
    [],
  );

  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={bottomGap}>
        <View
          style={{
            paddingHorizontal: 10,
            paddingTop: 8,
            paddingBottom: 12,
            backgroundColor: '#fff',
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: '#E5E5E5',
          }}
        >
          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={styles.ghostButton}
              onPress={() => {
                setSelectedPeriod('날짜 조회');
                setAppliedPeriod('날짜 조회');
              }}
            >
              <Text style={styles.ghostButtonText}>재설정</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                setAppliedPeriod(selectedPeriod);
                bottomSheetRef.current?.close();
              }}
            >
              <Text style={styles.primaryButtonText}>조회하기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BottomSheetFooter>
    ),
    [bottomGap, selectedPeriod],
  );

  // 공통 팔레트
  const COLORS = ['#FFF4DA', '#FFDE8E', '#FFCD52', '#F6A800', '#C3AB72'];

  const Legend = ({ items }: { items: AnimalStat[] }) => {
    const total = items.reduce((sum, d) => sum + d.count, 0);
    return (
      <View style={styles.legendContainer}>
        {items.map((item, idx) => (
          <View key={`${item.animal}-${idx}`} style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: COLORS[idx % COLORS.length] },
              ]}
            />
            <Text style={styles.legendText}>
              {item.animal} : {total > 0 ? Math.round((item.count / total) * 100) : 0}%
            </Text>
          </View>
        ))}
      </View>
    );
  };

  /* ========= 도넛 차트 ========= */
  const DonutChart = () => {
    const [data, setData] = useState<AnimalStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
      const fetchData = async () => {
        try {
          setErrorMsg(null);
          const json = await getJSON<any>('/reports/stats/animal/');
          const arr: AnimalStat[] = Array.isArray(json) ? json : json?.data ?? [];
          setData(arr);
        } catch (err: any) {
          setErrorMsg(
            err?.message?.includes('세션')
              ? '세션이 만료되었습니다. 다시 로그인하세요.'
              : '데이터를 불러오지 못했습니다.',
          );
          setData([]);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }, []);

    if (loading) {
      return (
        <View style={{ alignItems: 'center', padding: 20 }}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    const sorted = [...data].sort((a, b) => b.count - a.count);
    const etcItem = sorted.find(d => d.animal === '기타');
    const nonEtc = sorted.filter(d => d.animal !== '기타');

    let finalData: AnimalStat[] = [];
    if (etcItem) {
      finalData = [...nonEtc.slice(0, 4), etcItem];
    } else {
      const top4 = nonEtc.slice(0, 4);
      const others = nonEtc.slice(4);
      const othersSum = others.reduce((sum, d) => sum + d.count, 0);
      finalData = othersSum > 0 ? [...top4, { animal: '기타', count: othersSum }] : top4;
    }

    if (finalData.length === 0) {
      return (
        <View style={styles.chartSection}>
          <Text style={styles.sectionTitle}>동물별 신고 건수</Text>
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <Text style={{ color: '#666', marginBottom: 6 }}>
              {errorMsg ?? '표시할 데이터가 없습니다.'}
            </Text>
          </View>
        </View>
      );
    }

    const total = finalData.reduce((s, d) => s + d.count, 0);
    const pieData = finalData.map((item, idx) => ({
      value: item.count,
      color: COLORS[idx % COLORS.length],
    }));

    return (
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>동물별 신고 건수</Text>
        <View style={styles.donutRow}>
          <PieChart
            data={pieData}
            donut
            radius={95}
            innerRadius={45}
            centerLabelComponent={() => (
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 12, color: '#444' }}>총합</Text>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#000' }}>{total}</Text>
              </View>
            )}
          />
          <Legend items={finalData} />
        </View>
      </View>
    );
  };

  /* ========= 스택 바 차트 ========= */
  const StackedBarChart: React.FC = () => {
    const [data, setData] = useState<RegionByAnimal[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const run = async () => {
        try {
          const json = await getJSON<RegionByAnimal[]>('/reports/stats/region-by-animal/');
          setData(Array.isArray(json) ? json : []);
        } catch (e) {
          setData([]);
        } finally {
          setLoading(false);
        }
      };
      run();
    }, []);

    if (loading) {
      return (
        <View style={{ alignItems: 'center', padding: 20 }}>
          <ActivityIndicator size="large" />
        </View>
      );
    }
    if (!data || data.length === 0) return <Text>데이터 없음</Text>;

    const grouped: Record<string, Record<string, number>> = data.reduce(
      (acc, cur) => {
        const city = cur.city || '미상';
        acc[city] = acc[city] || {};
        acc[city][cur.animal] = (acc[city][cur.animal] || 0) + cur.count;
        return acc;
      },
      {} as Record<string, Record<string, number>>,
    );

    const hasServerEtcCity = Object.prototype.hasOwnProperty.call(grouped, '기타');

    const realCityTotals = Object.entries(grouped)
      .filter(([city]) => city !== '기타')
      .map(([city, animals]) => ({
        city,
        total: Object.values(animals).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total);

    const top4Cities = realCityTotals.slice(0, 4).map(c => c.city);
    const otherCities = realCityTotals.slice(4).map(c => c.city);

    const makeAnimalSegments = (animals: Record<string, number>) => {
      const entries = Object.entries(animals);
      const etcSeg = entries.find(([a]) => a === '기타');
      const nonEtc = entries.filter(([a]) => a !== '기타').sort((a, b) => b[1] - a[1]);

      if (etcSeg) return [...nonEtc.slice(0, 4), etcSeg] as [string, number][];
      const top4 = nonEtc.slice(0, 4);
      const others = nonEtc.slice(4);
      const etcSum = others.reduce((sum, [, v]) => sum + v, 0);
      return etcSum > 0 ? [...top4, ['기타', etcSum] as [string, number]] : top4;
    };

    const cityData: Array<{ city: string; animals: Record<string, number> }> =
      top4Cities.map(city => {
        const animals = grouped[city] || {};
        const finalSegs = makeAnimalSegments(animals);
        return { city, animals: Object.fromEntries(finalSegs) };
      });

    if (hasServerEtcCity) {
      const etcAnimals = grouped['기타'] || {};
      const finalSegs = makeAnimalSegments(etcAnimals);
      cityData.push({ city: '기타', animals: Object.fromEntries(finalSegs) });
    } else if (otherCities.length > 0) {
      const etcAnimals: Record<string, number> = {};
      otherCities.forEach(city => {
        const animals = grouped[city] || {};
        Object.entries(animals).forEach(([animal, cnt]) => {
          etcAnimals[animal] = (etcAnimals[animal] || 0) + cnt;
        });
      });
      const finalSegs = makeAnimalSegments(etcAnimals);
      cityData.push({ city: '기타', animals: Object.fromEntries(finalSegs) });
    }

    const BAR_MAX_HEIGHT = 200;
    const maxTotal =
      cityData.length > 0
        ? Math.max(...cityData.map(d => Object.values(d.animals).reduce((s, v) => s + v, 0)))
        : 1;

    return (
      <View style={styles.barChartSection}>
        <Text style={styles.sectionTitle}>지역별 신고 건수</Text>

        <View style={styles.barChartWrapper}>
          <View style={RNStyleSheet.absoluteFillObject}>
            {[0.25, 0.5, 0.75, 1].map((ratio, idx) => (
              <View key={idx} style={[styles.gridLine, { bottom: `${ratio * 100}%` }]} />
            ))}
          </View>

          <View style={styles.barsContainer}>
            {cityData.map((entry, idx) => {
              const total = Object.values(entry.animals).reduce((s, v) => s + v, 0);
              const heightRatio = total / maxTotal || 0;
              const barHeight = Math.max(1, BAR_MAX_HEIGHT * heightRatio);

              const segments = Object.entries(entry.animals) as [string, number][];

              return (
                <View key={`${entry.city}-${idx}`} style={styles.barContainer}>
                  <View style={[styles.barStack, { height: barHeight }]}>
                    {segments.map(([animal, value], i) => {
                      const segHeight = total > 0 ? (value / total) * barHeight : 0;
                      return (
                        <View
                          key={`${entry.city}-${animal}-${i}`}
                          style={{
                            height: segHeight,
                            width: '100%',
                            backgroundColor: COLORS[i % COLORS.length],
                          }}
                        />
                      );
                    })}
                  </View>
                  <Text style={styles.barLabel}>{entry.city}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const RecordList = ({ appliedPeriod }: { appliedPeriod: string }) => {
    const [searchText, setSearchText] = useState('');
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const normalizeReportItem = (item: ReportItemAPI) => {
      const id = item.report_id ?? item.id ?? Math.random();
      const animalName = item.animal_name ?? item.animal?.name_kor ?? '미상';
      const address = item.location?.address ?? '';
      const date = item.report_date ? String(item.report_date).slice(0, 10) : '';

      const statusRaw = item.status ?? '';
      const statusKor =
        statusRaw === 'checking'
          ? '확인중'
          : statusRaw === 'on_hold'
          ? '보류'
          : statusRaw
          ? '처리 완료'
          : '확인중';
      const statusColor =
        statusKor === '확인중'
          ? '#666666'
          : statusKor === '보류'
          ? '#FEBA15'
          : '#DD0000';

      const image =
        animalImages[animalName] ?? require('../../assets/images/default.png');

      return {
        id,
        animal: animalName,
        location: address,
        date,
        status: statusKor,
        statusColor,
      };
    };

    const fetchReports = async () => {
      try {
        setLoading(true);
        const range = getDateRange(appliedPeriod);
        const q = range ? `?from=${range.from}&to=${range.to}` : '';
        const data = await getJSON<any>(`/reports/${q}`);
        const list: ReportItemAPI[] = Array.isArray(data) ? data : data?.results ?? [];
        setRecords(list.map(normalizeReportItem));
      } catch (error: any) {
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      fetchReports();
    }, [appliedPeriod]);

    const filteredRecords = records.filter(
      record =>
        record.animal.toLowerCase().includes(searchText.toLowerCase()) ||
        record.location.toLowerCase().includes(searchText.toLowerCase()),
    );

    return (
      <View style={styles.recordContainer}>
        <View style={styles.searchSection}>
          <Text style={styles.searchTitle}>신고한 동물 검색</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="동물 이름을 입력하세요"
            placeholderTextColor="#999"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>기간 선택</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => bottomSheetRef.current?.snapToIndex(1)}
          >
            <Text style={styles.dropdownButtonText}>{selectedPeriod}</Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.recordList}>
          {loading ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={filteredRecords}
              keyExtractor={item => String(item.id)}
              renderItem={({ item }) => (
                <View style={styles.recordItem}>
                  <View style={styles.recordImageContainer}>
                    {/* 이미지 파일은 require()로 읽기 → UI에서는 정적 예시만 표시 */}
                    <Image source={animalImages[item.animal] ?? require('../../assets/images/default.png')} style={{ width: 60, height: 60, resizeMode: 'contain' }} />
                  </View>
                  <View style={styles.recordInfo}>
                    <Text style={styles.recordAnimal}>{item.animal}</Text>
                    <Text style={styles.recordLocation}>{item.location}</Text>
                    <Text style={styles.recordDate}>{item.date}</Text>
                  </View>
                  <View style={styles.recordStatus}>
                    <Text style={[styles.recordStatusText, { color: item.statusColor }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.noResultsText}>검색 결과가 없습니다.</Text>}
              contentContainerStyle={{ paddingBottom: 100 }}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* 네이티브 헤더 아래 여백 */}
      <View style={{ height: TAB_TOP_GAP }} />

      {/* 탭 바 */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === '신고 통계' && styles.activeTab]}
          onPress={() => setActiveTab('신고 통계')}
        >
          <Text style={[styles.tabText, activeTab === '신고 통계' && styles.activeTabText]}>
            신고 통계
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === '기록 조회' && styles.activeTab]}
          onPress={() => setActiveTab('기록 조회')}
        >
          <Text style={[styles.tabText, activeTab === '기록 조회' && styles.activeTabText]}>
            기록 조회
          </Text>
        </TouchableOpacity>
      </View>

      {/* 본문 */}
      <View style={styles.content}>
        {activeTab === '신고 통계' ? (
          <>
            <DonutChart />
            <StackedBarChart />
          </>
        ) : (
          <RecordList appliedPeriod={appliedPeriod} />
        )}
      </View>

      {/* 바텀시트 */}
      <View pointerEvents="box-none" style={styles.overlayHost}>
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose
          bottomInset={bottomGap}
          topInset={12}
          onChange={i => console.log('[Report] sheet index =', i)}
          backdropComponent={renderBackdrop}
          backgroundStyle={{
            backgroundColor: '#fff',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
          }}
          handleIndicatorStyle={{
            backgroundColor: '#CFCFCF',
            width: 48,
            height: 4,
            borderRadius: 2,
          }}
        >
          <BottomSheetView style={{ padding: 10, paddingBottom: 8 }}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>날짜 조회</Text>
            </View>

            <View style={styles.chipsRow}>
              {['날짜 조회', '최근 1개월', '최근 3개월', '최근 6개월', '최근 1년'].map(label => {
                const selected = selectedPeriod === label;
                return (
                  <Pressable
                    key={label}
                    onPress={() => setSelectedPeriod(label)}
                    style={({ pressed }) => [
                      styles.chipBase,
                      pressed && styles.chipPressed,
                      selected && styles.chipSelected,
                    ]}
                    android_ripple={{ color: '#0000000F', borderless: false }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.ghostButton}
                onPress={() => {
                  setSelectedPeriod('날짜 조회');
                  setAppliedPeriod('날짜 조회');
                }}
              >
                <Text style={styles.ghostButtonText}>재설정</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setAppliedPeriod(selectedPeriod);
                  bottomSheetRef.current?.close();
                }}
              >
                <Text style={styles.primaryButtonText}>조회하기</Text>
              </TouchableOpacity>
            </View>
          </BottomSheetView>
        </BottomSheet>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },

  // 탭 바
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    marginHorizontal: H_PADDING,
  },
  tab: { flex: 1, paddingVertical: 15, alignItems: 'center' },
  activeTab: { borderBottomWidth: 2, borderBottomColor: '#000000' },
  tabText: { fontSize: 16, color: '#A9A9A9' },
  activeTabText: { color: '#000000', fontWeight: '600' },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

  chartSection: { marginBottom: 60 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 5, color: '#000000' },
  donutRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  legendContainer: { flex: 1, paddingLeft: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  legendColor: { width: 12, height: 12, borderRadius: 6, marginRight: 6 },
  legendText: { fontSize: 14, color: '#000' },

  barChartSection: { marginBottom: 40 },
  barChartWrapper: { height: 200, position: 'relative', paddingHorizontal: 20, marginTop: 25 },
  barsContainer: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: '100%' },
  barContainer: { alignItems: 'center', width: 50 },
  barStack: {
    width: 30,
    height: '100%',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    borderRadius: 5,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    overflow: 'hidden',
  },
  barLabel: { marginTop: 8, fontSize: 13, textAlign: 'center', fontWeight: 'bold', color: '#000000' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: '#ccc' },

  // 기록 조회
  recordContainer: { flex: 1 },
  searchSection: { marginBottom: 20 },
  searchTitle: { fontSize: 16, fontWeight: '600', marginBottom: 10, color: '#000000' },
  searchInput: {
    backgroundColor: '#F8F4E1',
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: '#7B7B7B',
  },
  filterSection: { marginBottom: 20 },
  filterTitle: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#000000' },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEBA15',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
    minWidth: 80,
  },
  dropdownButtonText: { color: '#2B2B2B', fontSize: 12, fontWeight: '500', marginRight: 10 },
  dropdownArrow: { color: '#2B2B2B', fontSize: 12 },

  recordList: { flex: 1 },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 10,
    borderRadius: 8,
  },
  recordImageContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  recordInfo: { flex: 1 },
  recordAnimal: { fontSize: 18, fontWeight: '600', color: '#000000', marginBottom: 5 },
  recordLocation: { fontSize: 14, color: '#666666', marginBottom: 3 },
  recordDate: { fontSize: 14, color: '#666666' },
  recordStatus: { alignItems: 'flex-end' },
  recordStatusText: { fontSize: 16, fontWeight: '600' },
  noResultsText: { fontSize: 16, textAlign: 'center', color: '#666666', marginTop: 50 },

  // 바텀시트 오버레이
  overlayHost: { ...RNStyleSheet.absoluteFillObject, zIndex: 9999, elevation: 9999 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginBottom: 16 },
  chipBase: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D2D2D2',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
    marginBottom: 8,
  },
  chipPressed: { backgroundColor: '#D2D2D2' },
  chipSelected: { backgroundColor: '#D2D2D2', borderColor: '#D2D2D2' },
  chipText: { fontSize: 13, color: '#333', fontWeight: '600' },
  chipTextSelected: { color: '#222', fontWeight: '800' },
  sheetHeader: { alignItems: 'center', marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontWeight: 'bold', color: '#000', textAlign: 'center' },
  sheetActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  ghostButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  ghostButtonText: { color: '#8A8A8A', fontWeight: '600' },
  primaryButton: { flex: 1, height: 44, borderRadius: 22, backgroundColor: '#F5C64D', justifyContent: 'center', alignItems: 'center' },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
});
