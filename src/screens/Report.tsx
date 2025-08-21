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
} from 'react-native';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PieChart, BarChart, Grid, XAxis } from 'react-native-svg-charts';
import { animalImages } from '../utils/animalImages';

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

export default function Report() {
  const [activeTab, setActiveTab] = useState('신고 통계');
  const [selectedPeriod, setSelectedPeriod] = useState('날짜 조회');
  const [appliedPeriod, setAppliedPeriod] = useState('날짜 조회');

  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['25%', '50%'], []);

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

  const COLORS = ['#FFF4DA', '#FFDE8E', '#FFCD52', '#F6A800', '#C3AB72'];

  const Legend = ({
    items,
  }: {
    items: { animal: string; count: number }[];
  }) => {
    const total = items.reduce((sum, d) => sum + d.count, 0);

    return (
      <View style={styles.legendContainer}>
        {items.map((item, idx) => (
          <View key={idx} style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: COLORS[idx % COLORS.length] },
              ]}
            />
            <Text style={styles.legendText}>
              {item.animal} :{' '}
              {total > 0 ? Math.round((item.count / total) * 100) : 0}%
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const DonutChart = () => {
    const [data, setData] = useState<{ animal: string; count: number }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const fetchData = async () => {
        try {
          const token = await AsyncStorage.getItem('accessToken');
          if (!token) return;

          const res = await fetch(
            'http://127.0.0.1:8000/api/reports/stats/animal',
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            },
          );
          const json = await res.json();
          if (Array.isArray(json)) setData(json);
          else if (json.data && Array.isArray(json.data)) setData(json.data);
        } catch (err) {
          console.error(err);
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
    const top4 = sorted.slice(0, 4);
    const others = sorted.slice(4);
    const othersSum = others.reduce((sum, d) => sum + d.count, 0);
    const finalData =
      othersSum > 0 ? [...top4, { animal: '기타', count: othersSum }] : top4;

    return (
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>동물별 신고 건수</Text>
        <View style={styles.donutRow}>
          <Legend items={finalData} />
          <PieChart
            style={{ height: 200, width: 200 }}
            data={finalData.map((item, idx) => ({
              key: idx,
              value: item.count,
              svg: { fill: COLORS[idx % COLORS.length] },
              arc: { outerRadius: '100%', innerRadius: '40%' },
            }))}
            padAngle={0}
          />
        </View>
      </View>
    );
  };

  // ===== 스택 바 차트 (도시 Top4 + 기타, 각 도시 동물도 Top4 + 기타) =====
  const StackedBarChart = () => {
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
      const fetchData = async () => {
        try {
          const token = await AsyncStorage.getItem('accessToken');
          if (!token) return;

          const res = await fetch(
            'http://127.0.0.1:8000/api/reports/stats/region-by-animal',
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
            },
          );

          const json = await res.json();
          setData(Array.isArray(json) ? json : []);
        } catch (err) {
          console.error(err);
        }
      };
      fetchData();
    }, []);

    if (!data || data.length === 0) {
      return <Text>데이터 없음</Text>;
    }

    // ✅ city 기준 그룹핑
    const grouped = data.reduce((acc: any, cur: any) => {
      const city = cur.city || '미상';
      if (!acc[city]) acc[city] = {};
      acc[city][cur.animal] = (acc[city][cur.animal] || 0) + cur.count;
      return acc;
    }, {});

    // 도시별 총합
    const cityTotals = Object.entries(grouped).map(([city, animals]) => ({
      city,
      total: Object.values(animals as number[]).reduce(
        (a, b) => a + (b as number),
        0,
      ),
    }));

    // Top4 도시 + 기타
    const sortedCities = cityTotals.sort((a, b) => b.total - a.total);
    const top4Cities = sortedCities.slice(0, 4).map(c => c.city);
    const otherCities = sortedCities.slice(4).map(c => c.city);

    const cityData = top4Cities.map(city => {
      const animals = grouped[city];

      // 동물 Top4 + 기타
      const sortedAnimals = Object.entries(animals).sort(
        (a, b) => (b[1] as number) - (a[1] as number),
      );
      const top4Animals = sortedAnimals.slice(0, 4);
      const otherAnimals = sortedAnimals.slice(4);
      const etcSum = otherAnimals.reduce(
        (sum, [, v]) => sum + (v as number),
        0,
      );

      const finalAnimals =
        etcSum > 0 ? [...top4Animals, ['기타', etcSum]] : top4Animals;

      return { city, animals: Object.fromEntries(finalAnimals) };
    });

    // 기타 도시 묶기
    if (otherCities.length > 0) {
      const etcAnimals: Record<string, number> = {};
      otherCities.forEach(city => {
        const animals = grouped[city];
        Object.entries(animals).forEach(([animal, cnt]) => {
          etcAnimals[animal] = (etcAnimals[animal] || 0) + (cnt as number);
        });
      });

      // 기타 도시 동물 Top4 + 기타
      const sortedAnimals = Object.entries(etcAnimals).sort(
        (a, b) => b[1] - a[1],
      );
      const top4Animals = sortedAnimals.slice(0, 4);
      const otherAnimals = sortedAnimals.slice(4);
      const etcSum = otherAnimals.reduce((sum, [, v]) => sum + v, 0);

      const finalAnimals =
        etcSum > 0 ? [...top4Animals, ['기타', etcSum]] : top4Animals;

      cityData.push({
        city: '기타',
        animals: Object.fromEntries(finalAnimals),
      });
    }

    // 전체 최대치 계산
    const maxTotal =
      cityData.length > 0
        ? Math.max(
            ...cityData.map(d =>
              (Object.values(d.animals) as number[]).reduce(
                (sum, v) => sum + v,
                0,
              ),
            ),
          )
        : 1;

    return (
      <View style={styles.barChartSection}>
        <Text style={styles.sectionTitle}>지역별 신고 건수</Text>
        <View style={styles.barChartWrapper}>
          {/* 그리드 라인 */}
          <View style={StyleSheet.absoluteFill}>
            {[0.25, 0.5, 0.75, 1].map((ratio, idx) => (
              <View
                key={idx}
                style={[styles.gridLine, { bottom: `${ratio * 100}%` }]}
              />
            ))}
          </View>

          {/* 바 차트 */}
          <View style={styles.barsContainer}>
            {cityData.map((cityData, idx) => {
              const total = (
                Object.values(cityData.animals) as number[]
              ).reduce((sum, v) => sum + v, 0);
              const heightRatio = total / maxTotal;
              const barHeight = 200 * heightRatio;

              return (
                <View key={idx} style={styles.barContainer}>
                  <View style={[styles.barStack, { height: barHeight }]}>
                    {(
                      Object.entries(cityData.animals) as [string, number][]
                    ).map(([animal, value], i) => (
                      <View
                        key={i}
                        style={{
                          height: (value / total) * barHeight,
                          width: '100%',
                          backgroundColor: COLORS[i % COLORS.length],
                        }}
                      />
                    ))}
                  </View>
                  <Text style={styles.barLabel}>{cityData.city}</Text>
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

    const fetchReports = async () => {
      try {
        setLoading(true);
        const token = await AsyncStorage.getItem('accessToken');
        if (!token) {
          console.error('[RecordList] No access token found');
          return;
        }

        let url = 'http://127.0.0.1:8000/api/reports/';

        const range = getDateRange(appliedPeriod);
        if (range) {
          url += `?from=${range.from}&to=${range.to}`;
        }

        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();
        console.log('[API 응답]', data);

        setRecords(
          data.map((item: any) => ({
            id: item.report_id,
            animal: item.animal_name,
            location: item.location?.address ?? '',
            date: item.report_date.slice(0, 10),
            status:
              item.status === 'checking'
                ? '확인중'
                : item.status === 'on_hold'
                ? '보류'
                : '처리 완료',
            statusColor:
              item.status === 'checking'
                ? '#666666'
                : item.status === 'on_hold'
                ? '#FEBA15'
                : '#DD0000',
            image:
              animalImages[item.animal_name] ??
              require('../../assets/images/default.png'),
          })),
        );
      } catch (error) {
        console.error('Failed to fetch reports:', error);
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
            onPress={() => {
              console.log('[Report] 날짜 조회 버튼 눌림 → snapToIndex(1)');
              bottomSheetRef.current?.snapToIndex(1);
            }}
          >
            <Text style={styles.dropdownButtonText}>{selectedPeriod}</Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.recordList}>
          <FlatList
            data={filteredRecords}
            keyExtractor={item => String(item.id)}
            renderItem={({ item }) => (
              <View style={styles.recordItem}>
                <View style={styles.recordImageContainer}>
                  <Image source={item.image} style={styles.recordImage} />
                </View>
                <View style={styles.recordInfo}>
                  <Text style={styles.recordAnimal}>{item.animal}</Text>
                  <Text style={styles.recordLocation}>{item.location}</Text>
                  <Text style={styles.recordDate}>{item.date}</Text>
                </View>
                <View style={styles.recordStatus}>
                  <Text
                    style={[
                      styles.recordStatusText,
                      { color: item.statusColor },
                    ]}
                  >
                    {item.status}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.noResultsText}>검색 결과가 없습니다.</Text>
            }
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>신고 통계 및 기록 조회</Text>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === '신고 통계' && styles.activeTab]}
            onPress={() => setActiveTab('신고 통계')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === '신고 통계' && styles.activeTabText,
              ]}
            >
              신고 통계
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === '기록 조회' && styles.activeTab]}
            onPress={() => setActiveTab('기록 조회')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === '기록 조회' && styles.activeTabText,
              ]}
            >
              기록 조회
            </Text>
          </TouchableOpacity>
        </View>
      </View>

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

      <View pointerEvents="box-none" style={styles.overlayHost}>
        <BottomSheet
          ref={bottomSheetRef}
          index={-1}
          snapPoints={['35%']}
          enablePanDownToClose
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
          <BottomSheetView style={{ padding: 20 }}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>날짜 조회</Text>
            </View>

            <View style={styles.chipsRow}>
              {[
                '날짜 조회',
                '최근 1개월',
                '최근 3개월',
                '최근 6개월',
                '최근 1년',
              ].map(label => {
                const selected = selectedPeriod === label;
                return (
                  <Pressable
                    key={label}
                    onPress={() => setSelectedPeriod(label as any)}
                    style={({ pressed }) => [
                      styles.chipBase,
                      pressed && styles.chipPressed,
                      selected && styles.chipSelected,
                    ]}
                    android_ripple={{ color: '#0000000F', borderless: false }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
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
                  console.log('조회하기:', selectedPeriod);
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
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 35,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 15,
    color: '#000000',
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
  },
  tabText: {
    fontSize: 16,
    color: '#666666',
  },
  activeTabText: {
    color: '#000000',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  chartSection: {
    marginBottom: 60,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
    color: '#000000',
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  legendContainer: {
    flex: 1,
    paddingLeft: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 14,
    color: '#000',
  },
  chartContainer: {
    alignItems: 'center',
    marginRight: 10,
  },
  barChartSection: {
    marginBottom: 40,
  },
  barChartWrapper: {
    height: 200,
    position: 'relative',
    paddingHorizontal: 20,
    marginTop: 40,
  },
  barsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    height: '100%',
  },
  barContainer: {
    alignItems: 'center',
    width: 50,
  },
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
  barLabel: {
    marginTop: 8,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#000000',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#ccc',
  },
  recordContainer: {
    flex: 1,
  },
  searchSection: {
    marginBottom: 20,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
  },
  searchTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#000000',
  },
  searchInput: {
    backgroundColor: '#F8F4E1',
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#7B7B7B',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#000000',
  },
  dropdownContainer: {
    position: 'relative',
    zIndex: 1000,
  },
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
  dropdownButtonText: {
    color: '#2B2B2B',
    fontSize: 12,
    fontWeight: '500',
    marginRight: 10,
  },
  dropdownArrow: {
    color: '#2B2B2B',
    fontSize: 12,
    transform: [{ rotate: '0deg' }],
  },
  dropdownArrowUp: {
    transform: [{ rotate: '180deg' }],
  },
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1001,
  },
  dropdownItem: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedDropdownItem: {
    backgroundColor: '#FFF3E0',
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#000000',
  },
  selectedDropdownItemText: {
    color: '#FFA500',
    fontWeight: '500',
  },
  recordList: {
    flex: 1,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
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
  recordImage: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
  },
  recordInfo: {
    flex: 1,
  },
  recordAnimal: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 5,
  },
  recordLocation: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 3,
  },
  recordDate: {
    fontSize: 14,
    color: '#666666',
  },
  recordStatus: {
    alignItems: 'flex-end',
  },
  recordStatusText: {
    fontSize: 16,
    fontWeight: '600',
  },
  noResultsText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666666',
    marginTop: 50,
  },
  placeholder: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666666',
    marginTop: 50,
  },
  overlayHost: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginBottom: 16,
  },
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
  chipPressed: {
    backgroundColor: '#D2D2D2',
  },
  chipSelected: {
    backgroundColor: '#D2D2D2',
    borderColor: '#D2D2D2',
  },
  chipText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#222',
    fontWeight: '800',
  },
  sheetActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
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
  primaryButton: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5C64D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontWeight: '800' },
});
