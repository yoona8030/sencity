import React, { useState, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Pressable,
} from 'react-native';
import { Svg, G, Circle } from 'react-native-svg';
import BottomSheet, {
  BottomSheetView,
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

export default function Report() {
  const [activeTab, setActiveTab] = useState('신고 통계');
  const [selectedPeriod, setSelectedPeriod] = useState('날짜 조회');

  // Plain BottomSheet (포탈 불필요)
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['25%', '50%'], []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0} // 열리면 나타남
        disappearsOnIndex={-1} // 닫히면 사라짐
        pressBehavior="close" // 배경 탭 시 닫기
        opacity={0.5} // 어둡기
      />
    ),
    [],
  );

  const DonutChart = () => {
    const radius = 48;
    const circumference = 2 * Math.PI * radius;

    const data = [
      { percent: 0.0, color: '#FFDE8E' },
      { percent: 0.18, color: '#FFF4DA' },
      { percent: 0.07, color: '#C3AB72' },
      { percent: 0.01, color: '#F6A800' },
    ];

    let offset = 0;

    return (
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>동물별 신고 건수</Text>
        <View style={styles.donutContainer}>
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, { backgroundColor: '#F6A800' }]}
              />
              <Text style={styles.legendText}>고라니 : 74%</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, { backgroundColor: '#FFDE8E' }]}
              />
              <Text style={styles.legendText}>너구리 : 18%</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, { backgroundColor: '#FFF4DA' }]}
              />
              <Text style={styles.legendText}>여우 : 7%</Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendColor, { backgroundColor: '#C3AB72' }]}
              />
              <Text style={styles.legendText}>그 외 : 1%</Text>
            </View>
          </View>
          <View style={styles.chartContainer}>
            <Svg width="195" height="195" viewBox="3 5 140 140">
              <G rotation="-181" origin="75, 75">
                {data.map((segment, index) => {
                  const dashArray = `${
                    circumference * segment.percent
                  } ${circumference}`;
                  const strokeDashoffset = circumference * (1 - offset);
                  offset += segment.percent;
                  return (
                    <Circle
                      key={index}
                      cx="75"
                      cy="70"
                      r={radius}
                      stroke={segment.color}
                      strokeWidth="35"
                      strokeDasharray={`${dashArray} ${circumference}`}
                      strokeDashoffset={strokeDashoffset}
                      fill="transparent"
                    />
                  );
                })}
              </G>
            </Svg>
          </View>
        </View>
      </View>
    );
  };

  const StackedBarChart = () => {
    const bottom = 0.105;
    const data = [
      { region: '전라도', animals: { 고라니: 10, 너구리: 30, 여우: 50 } },
      { region: '서울', animals: { 고라니: 65, 너구리: 25, 여우: 15 } },
      { region: '충청도', animals: { 고라니: 70, 너구리: 20, 여우: 30 } },
      { region: '강원도', animals: { 고라니: 50, 너구리: 30, 여우: 20 } },
      { region: '인천', animals: { 고라니: 60, 너구리: 55, 여우: 15 } },
      { region: '경기', animals: { 고라니: 70, 너구리: 20, 여우: 10 } },
    ];

    const animalColors = {
      고라니: '#C3AB72',
      너구리: '#FFF3D5',
      여우: '#FEBA15',
    } as const;

    const maxTotal = Math.max(
      ...data.map(d => Object.values(d.animals).reduce((sum, v) => sum + v, 0)),
    );

    return (
      <View style={styles.barChartSection}>
        <Text style={styles.sectionTitle}>지역별 신고 건수</Text>
        <View style={styles.barChartWrapper}>
          <View style={StyleSheet.absoluteFill}>
            {[
              bottom,
              0.25 + bottom,
              0.5 + bottom,
              0.75 + bottom,
              1 + bottom,
            ].map((ratio, idx) => (
              <View
                key={idx}
                style={[styles.gridLine, { bottom: `${ratio * 100}%` }]}
              />
            ))}
          </View>
          <View style={styles.barsContainer}>
            {data.map((regionData, idx) => {
              const total = Object.values(regionData.animals).reduce(
                (sum, v) => sum + v,
                0,
              );
              const heightRatio = total / maxTotal;
              const barHeight = 200 * heightRatio;
              return (
                <View key={idx} style={styles.barContainer}>
                  <View style={[styles.barStack, { height: barHeight }]}>
                    {Object.entries(regionData.animals).map(
                      ([animal, value], i) => (
                        <View
                          key={i}
                          style={{
                            height: (value / total) * barHeight,
                            width: '100%',
                            backgroundColor:
                              animalColors[animal as keyof typeof animalColors],
                          }}
                        />
                      ),
                    )}
                  </View>
                  <Text style={styles.barLabel}>{regionData.region}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const RecordList = () => {
    const [searchText, setSearchText] = useState('');
    const records = [
      {
        id: 1,
        animal: '고라니',
        location: 'XX시 XX구',
        date: '2024.05.15',
        status: '확인중',
        statusColor: '#666666',
        image: require('../../assets/images/goat.png'),
      },
      {
        id: 2,
        animal: '너구리',
        location: 'XX시 XX구',
        date: '2024.04.02',
        status: '보류',
        statusColor: '#FEBA15',
        image: require('../../assets/images/raccoon.png'),
      },
      {
        id: 3,
        animal: '멧돼지',
        location: 'XX시 XX구',
        date: '2024.03.01',
        status: '처리 완료',
        statusColor: '#DD0000',
        image: require('../../assets/images/wild_boar.png'),
      },
    ];

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
              bottomSheetRef.current?.snapToIndex(1); // 50%로 열기
              // bottomSheetRef.current?.expand();    // 완전 확장으로 열고 싶으면 이걸 사용
            }}
          >
            <Text style={styles.dropdownButtonText}>{selectedPeriod}</Text>
            <Text style={styles.dropdownArrow}>▼</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.recordList}>
          {filteredRecords.length > 0 ? (
            filteredRecords.map(record => (
              <View key={record.id} style={styles.recordItem}>
                <View style={styles.recordImageContainer}>
                  <Image source={record.image} style={styles.recordImage} />
                </View>
                <View style={styles.recordInfo}>
                  <Text style={styles.recordAnimal}>{record.animal}</Text>
                  <Text style={styles.recordLocation}>{record.location}</Text>
                  <Text style={styles.recordDate}>{record.date}</Text>
                </View>
                <View style={styles.recordStatus}>
                  <Text
                    style={[
                      styles.recordStatusText,
                      { color: record.statusColor },
                    ]}
                  >
                    {record.status}
                  </Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noResultsText}>검색 결과가 없습니다.</Text>
          )}
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
          <RecordList />
        )}
      </View>

      {/* Plain BottomSheet: 포털 없이 최상단에 겹치게 올림 */}
      <View pointerEvents="box-none" style={styles.overlayHost}>
        <BottomSheet
          ref={bottomSheetRef}
          index={-1} // 초기 닫힘
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
                      pressed && styles.chipPressed, // 터치 중일 때 아주 살짝 음영
                      selected && styles.chipSelected, // 선택 상태
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

            {/* 액션 버튼들 */}
            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={styles.ghostButton}
                onPress={() => setSelectedPeriod('날짜 조회')}
              >
                <Text style={styles.ghostButtonText}>재설정</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  console.log('조회하기:', selectedPeriod);
                  bottomSheetRef.current?.close();
                }}
              >
                <Text style={styles.primaryButtonText}>조회하기</Text>
              </TouchableOpacity>
            </View>

            {/* 조회하기
            <TouchableOpacity
              style={{
                marginTop: 30,
                backgroundColor: '#FEBA15',
                paddingVertical: 12,
                borderRadius: 20,
                alignItems: 'center',
              }}
              onPress={() => {
                console.log('[Report] 조회하기:', selectedPeriod);
                bottomSheetRef.current?.close();
              }}
            >
              <Text style={{ fontWeight: 'bold', color: '#fff' }}>
                조회하기
              </Text>
            </TouchableOpacity> */}
          </BottomSheetView>
        </BottomSheet>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 신고 통계
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
    // overflow: 'hidden', // ← 가려질 수 있으니 주석 유지
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
  donutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendContainer: {
    flex: 1,
    paddingLeft: 15,
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
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#000000',
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

  // 기록 조회
  recordContainer: {
    flex: 1,
  },
  searchSection: {
    marginBottom: 20,
  },
  sheetHeader: {
    alignItems: 'center', // 가로 가운데
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

  // ⬇️ Plain BottomSheet를 최상단에 겹치게 올리기 위한 레이어
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
    borderColor: '#D2D2D2', // 연한 테두리
    backgroundColor: '#FFFFFF', // 시트가 흰색이므로 투명과 동일한 톤
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
