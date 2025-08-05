import React, { useRef, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Image,
  Alert,
  Button,
  Keyboard,
  StatusBar,
  Platform,
  Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { KAKAO_JS_KEY, KAKAO_REST_API_KEY } from '@env';

import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import Geolocation from 'react-native-geolocation-service';
import {
  check,
  request,
  PERMISSIONS,
  RESULTS,
  Permission,
} from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SearchHistoryItem {
  id: number;
  keyword: string;
}
interface AnimalInfo {
  name: string;
  english: string;
  image_url: string;
  features: string[];
  precautions: string[];
}
interface PlaceItem {
  id: string;
  type: string;
  location: string;
  lat: number;
  lng: number;
}

const windowHeight = Dimensions.get('window').height;
const windowWidth = Dimensions.get('window').width;
const BACKEND_URL = 'http://10.0.2.2:8000/api'; // 애뮬레이터
// const BACKEND_URL = 'http://192.168.45.122:8000/api'; // 실제 기기

const getKakaoMapHtml = (lat = 37.5611, lng = 127.0375) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Kakao Map</title>
  <style>
    html, body, #map { margin:0; padding:0; width:100vw; height:100vh; }
  </style>
</head>
<body>
  <div id="map" style="width:100vw; height:100vh;"></div>

  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false"></script>
  <script>
    kakao.maps.load(function() {
      var mapContainer = document.getElementById('map');
      var mapOption = {
        center: new kakao.maps.LatLng(${lat}, ${lng}),
        level: 1
      };
      window.map = new kakao.maps.Map(mapContainer, mapOption);

      var markerPosition = new kakao.maps.LatLng(${lat}, ${lng});
      var marker = new kakao.maps.Marker({ position: markerPosition });
      marker.setMap(window.map);
    });
  </script>
</body>
</html>
`;

async function requestLocationPermission() {
  let permission: Permission;

  if (Platform.OS === 'android') {
    permission = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
  } else if (Platform.OS === 'ios') {
    permission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
  } else {
    return false;
  }

  try {
    const result = await check(permission);
    console.log('현재 권한 상태:', result);

    if (result === RESULTS.GRANTED) return true;

    if (result === RESULTS.DENIED || result === RESULTS.LIMITED) {
      const requestResult = await request(permission);
      console.log('권한 요청 결과:', requestResult);
      return requestResult === RESULTS.GRANTED;
    }

    if (result === RESULTS.BLOCKED) {
      Alert.alert('권한 설정 필요', '설정에서 위치 권한을 허용해주세요.');
      return false;
    }

    return false;
  } catch (e) {
    console.error('권한 요청 오류:', e);
    return false;
  }
}

//
async function refreshAccessToken() {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${BACKEND_URL}/token/refresh/`, {
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

export default function Map() {
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(
    () => [windowHeight * 0.33, windowHeight * 0.75],
    [],
  );
  const animatedPosition = useSharedValue(0);
  const mapRef = useRef<WebView>(null);

  const [tab, setTab] = useState<'장소' | '정보'>('장소');
  const [input, setInput] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [animalInfo, setAnimalInfo] = useState<AnimalInfo | null>(null);
  const [placeToSave, setPlaceToSave] = useState<PlaceItem | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<PlaceItem[]>([
    {
      id: 'init1',
      type: '카페',
      location: '서울특별시 중구 을지로 100',
      lat: 37.5665,
      lng: 126.978,
    },
  ]);

  const [selectedPlace, setSelectedPlace] = useState<PlaceItem | null>(
    savedPlaces[0],
  );
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [mapHtml, setMapHtml] = useState(
    getKakaoMapHtml(savedPlaces[0].lat, savedPlaces[0].lng),
  );

  const [searchResultPlace, setSearchResultPlace] = useState<PlaceItem | null>(
    null,
  );

  const [saveModalVisible, setSaveModalVisible] = useState<boolean>(false);

  useEffect(() => {
    if (selectedPlace) {
      setMapHtml(getKakaoMapHtml(selectedPlace.lat, selectedPlace.lng));
    }
  }, [selectedPlace]);

  useEffect(() => {
    if (currentLocation) {
      setMapHtml(getKakaoMapHtml(currentLocation.lat, currentLocation.lng));
      setSelectedPlace(null);
    }
  }, [currentLocation]);

  useEffect(() => {
    //useEffect로 토큰 불러오기
    const loadToken = async () => {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        console.log('✅ accessToken 읽음:', token);
        setAccessToken(token);
      } else {
        console.warn('❌ accessToken 없음');
      }
    };
    loadToken();
  }, []);

  useEffect(() => {
    //accessToken 있을 때만 fetchHistory 실행
    if (accessToken) {
      fetchHistory();
    }
  }, [accessToken]);

  async function saveSearchKeyword(keyword: string) {
    const token = await AsyncStorage.getItem('accessToken');
    if (!token) return;

    try {
      await fetch(`${BACKEND_URL}/search-history/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keyword }),
      });
      console.log('✅ 검색 기록 저장 성공:', keyword);
    } catch (e) {
      console.warn('❌ 검색 기록 저장 실패:', e);
    }
  }
  // const bannerAnimatedStyle = useAnimatedStyle(() => {
  //   const bannerHeight = 54,
  //     extraMargin = 20;
  //   const top = interpolate(
  //     animatedPosition.value,
  //     [snapPoints[1], snapPoints[0]],
  //     [
  //       snapPoints[1] - bannerHeight - extraMargin,
  //       snapPoints[0] - bannerHeight - extraMargin,
  //     ],
  //     Extrapolate.CLAMP,
  //   );
  //   return { top };
  // });
  const bannerHeight = 54;
  const bannerMargin = 5;

  const bannerAnimatedStyle = useAnimatedStyle(() => {
    const top = animatedPosition.value - bannerHeight - bannerMargin;
    return {
      position: 'absolute',
      left: 8,
      right: 8,
      top,
      zIndex: 999,
    };
  });

  function getUniqueHistory(historyArr: SearchHistoryItem[]) {
    const seen = new Set<string>();
    return historyArr.filter(item => {
      if (seen.has(item.keyword)) return false;
      seen.add(item.keyword);
      return true;
    });
  }

  async function fetchHistory() {
    try {
      if (!accessToken) throw new Error('No token');

      const res = await fetch(`${BACKEND_URL}/search-history/`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`, // ← 토큰 빠짐 없이
          // 'Content-Type': 'application/json', // (GET에는 없어도 되지만)
        },
      });
      if (!res.ok) throw new Error('기록 조회 실패');

      const data: SearchHistoryItem[] = await res.json();
      console.log('fetchHistory data:', data); // ✅ 여기서 확인 필요
      setHistory(data);
    } catch (e) {
      console.error('fetchHistory error:', e);
      setHistory([]);
    }
  }

  useEffect(() => {
    if (animalInfo?.image_url) {
      console.log('✅ 이미지 URL:', animalInfo.image_url);
    }
  }, [animalInfo]);

  useEffect(() => {
    // 앱 시작 시 바텀시트를 항상 열어두기
    setTimeout(() => {
      bottomSheetRef.current?.snapToIndex(0);
    }, 0);
  }, []);

  async function handleSearch(keyword: string) {
    const animalList = [
      '고라니',
      '멧돼지',
      '청설모',
      '다람쥐',
      '너구리',
      '반달가슴곰',
      '노루',
      '멧토끼',
      '족제비',
      '왜가리',
      '중대백로',
    ];
    const trimmed = keyword.trim().toLowerCase();
    const isAnimal = animalList.some(a => a.toLowerCase() === trimmed);

    if (!trimmed) return;
    await saveSearchKeyword(trimmed);

    Keyboard.dismiss();
    if (isAnimal) {
      await searchAnimal(trimmed);
      setTab('정보');
    } else {
      await searchPlace(trimmed);
      setTab('장소');
    }
  }

  async function searchAnimal(keyword: string) {
    try {
      const infoRes = await fetch(
        `${BACKEND_URL}/animal-info?name=${encodeURIComponent(keyword)}`,
      );
      const infoData = await infoRes.json();
      console.log('animalInfo API 응답:', infoData);

      if (!infoRes.ok || !infoData.name) throw new Error('정보 없음');
      setAnimalInfo(infoData);

      const unique = getUniqueHistory(history);
      if (!unique.find(h => h.keyword === keyword)) {
        const token = await AsyncStorage.getItem('accessToken');
        console.log('[🔑 accessToken]', token);
        if (!token) {
          console.warn('⚠️ 토큰 없음');
          Alert.alert('로그인이 필요합니다');
          return; // 더 이상 실행 안 함
        }
        await fetch(`${BACKEND_URL}/search-history/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`, // ✅ 여기 추가!
          },
          body: JSON.stringify({ keyword }),
        });
        fetchHistory();
        bottomSheetRef.current?.snapToIndex(0);
      }
      setDropdownOpen(false);
      setSelectedId(null);
    } catch (e) {
      console.error('searchAnimal error: ', e);
      Alert.alert('검색 실패', '검색 결과를 불러오지 못했습니다.');
      setAnimalInfo(null);
    }
  }

  async function searchPlace(keyword: string) {
    try {
      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
        keyword,
      )}`;

      const res = await fetch(url, {
        method: 'GET', // ← 명시적으로 GET
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`, // ← Kakao REST API 키
        },
      });

      console.log('searchPlace status:', res.status);
      if (!res.ok) throw new Error('장소 검색 실패: ' + res.status);

      const data = await res.json();
      if (!data.documents || data.documents.length === 0) {
        Alert.alert('검색 결과가 없습니다.');
        setSearchResultPlace(null);
        return;
      }

      const place = data.documents[0];
      const lat = parseFloat(place.y);
      const lng = parseFloat(place.x);

      const unique = getUniqueHistory(history);
      if (!unique.find(h => h.keyword === keyword)) {
        await fetch(`${BACKEND_URL}/search-history/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keyword }),
        });
        fetchHistory(); // 새로 불러오기
      }

      const jsCode = `
        var moveLatLon = new kakao.maps.LatLng(${lat}, ${lng});
        window.map.setCenter(moveLatLon);
        true;
      `;
      mapRef.current?.injectJavaScript(jsCode);

      setSearchResultPlace({
        id: place.id,
        type: place.place_name,
        location: place.address_name,
        lat,
        lng,
      });

      setSelectedPlace(null); // 선택된 장소 초기화 (필요 시)
      setSaveModalVisible(true); // 저장 모달

      bottomSheetRef.current?.snapToIndex(0);
    } catch (e) {
      console.error('searchPlace error:', e);
      Alert.alert('검색 실패', '장소 검색 중 오류가 발생했습니다.');
    }
  }

  function confirmSavePlace() {
    if (!searchResultPlace) return;
    setSavedPlaces(prev => {
      if (prev.find(p => p.id === searchResultPlace.id)) return prev;
      return [...prev, searchResultPlace];
    });
    setSaveModalVisible(false);
    setSearchResultPlace(null);
    Alert.alert('저장 완료', '장소가 저장되었습니다.');
  }

  async function handleSelectHistory(id: number, keyword: string) {
    setInput(keyword);
    setSelectedId(id);
    setDropdownOpen(false);
    await handleSearch(keyword);
  }

  const handleRemoveHistory = async (id: number) => {
    try {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        Alert.alert('삭제 실패', '로그인이 필요합니다.');
        return;
      }

      const res = await fetch(
        `${BACKEND_URL}/search-history/${id}/`, // URL 끝에 slash(/) 꼭 챙기세요
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        },
      );
      console.log('delete status:', res.status);
      if (!res.ok) {
        throw new Error(`삭제 실패: ${res.status}`);
      }
      await fetchHistory();
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      console.warn('handleRemoveHistory error:', e);
      Alert.alert('삭제 실패', '검색 기록 삭제 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    console.log('dropdownOpen:', dropdownOpen, 'history:', history);
  }, [dropdownOpen, history]);

  async function moveToCurrentLocation() {
    const hasPermission = await requestLocationPermission();
    console.log('최종 권한:', hasPermission);
    if (!hasPermission) {
      Alert.alert('권한 필요', '위치 권한이 필요합니다.');
      return;
    }

    Geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
      },
      error => {
        console.log('getCurrentPosition error:', error);
        Alert.alert('오류', '현재 위치를 가져올 수 없습니다.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }

  return (
    <>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <View style={styles.container}>
        <View style={styles.mapWrapper}>
          <WebView
            ref={mapRef}
            originWhitelist={['*']}
            source={{ html: mapHtml }}
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled={false}
            cacheMode="LOAD_NO_CACHE"
            onError={({ nativeEvent }) => {
              console.warn('WebView error: ', nativeEvent);
            }}
          />
        </View>

        <View style={styles.searchBarWrapper}>
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={22}
              color="#bbb"
              style={{ marginRight: 6 }}
            />
            <TextInput
              style={styles.searchInput}
              value={input}
              onFocus={() => setDropdownOpen(true)}
              onChangeText={setInput}
              onSubmitEditing={() => handleSearch(input)}
              placeholder="주소 및 야생 동물 검색"
              placeholderTextColor="#aaa"
            />
          </View>

          {dropdownOpen && (
            <View style={styles.dropdown}>
              <FlatList
                data={getUniqueHistory(history)}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item, index }) => {
                  const uniqueHistory = getUniqueHistory(history);
                  const isFirst = index === 0;
                  const isLast = index === uniqueHistory.length - 1;
                  const isCurrent = input.trim() === item.keyword;
                  return (
                    <View
                      style={[
                        styles.dropdownItem,
                        isFirst && styles.dropdownItemFirst,
                        isLast && styles.dropdownItemLast,
                        isCurrent && styles.dropdownItemActive,
                      ]}
                    >
                      <Ionicons
                        name="time-outline"
                        size={18}
                        color="#bbb"
                        style={{ marginRight: 8 }}
                      />
                      <TouchableOpacity
                        style={{ flex: 1 }}
                        onPress={() =>
                          handleSelectHistory(item.id, item.keyword)
                        }
                        activeOpacity={0.8}
                      >
                        <Text style={styles.dropdownText}>{item.keyword}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleRemoveHistory(item.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        style={{ marginLeft: 8 }}
                      >
                        <Ionicons name="close" size={18} color="#bbb" />
                      </TouchableOpacity>
                    </View>
                  );
                }}
              />
            </View>
          )}
        </View>
        {/* 저장 확인 모달 */}
        <Modal
          visible={saveModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSaveModalVisible(false)}
        >
          <View style={styles.modalBackground}>
            <View style={styles.modalContainer}>
              <Text>검색된 장소를 저장하시겠습니까?</Text>
              <Text style={{ fontWeight: 'bold' }}>
                {searchResultPlace?.type}
              </Text>
              <Text>{searchResultPlace?.location}</Text>
              <View style={{ flexDirection: 'row', marginTop: 20 }}>
                <Button
                  title="취소"
                  onPress={() => setSaveModalVisible(false)}
                />
                <View style={{ width: 20 }} />
                <Button title="저장" onPress={confirmSavePlace} />
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.fabGroup}>
          <TouchableOpacity style={styles.fabButton}>
            <Image
              source={require('../../assets/images/logo2.png')}
              style={{ width: 41, height: 37, borderRadius: 14 }}
              resizeMode="cover"
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fabButton}
            onPress={moveToCurrentLocation}
          >
            <MaterialIcons name="place" size={27} color="#DD0000" />
          </TouchableOpacity>
        </View>

        <Animated.View style={[bannerAnimatedStyle]}>
          <View style={styles.banner}>
            <Text style={styles.bannerText} numberOfLines={1}>
              오후 9시 30분경 \"##역\" 반경 2KM 이내에 고라니 출현
            </Text>
          </View>
        </Animated.View>

        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={snapPoints}
          // initialSnapIndex={0}
          animatedPosition={animatedPosition}
          enablePanDownToClose={false}
          backgroundStyle={{
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: '#fff',
          }}
          handleIndicatorStyle={{ backgroundColor: '#ccc' }}
        >
          <BottomSheetView style={{ padding: 24, paddingTop: 6 }}>
            <View style={styles.switchContainer}>
              <TouchableOpacity
                style={[
                  styles.switchItem,
                  tab === '장소' && styles.switchItemActive,
                ]}
                onPress={() => setTab('장소')}
                activeOpacity={0.9}
              >
                <Text
                  style={[
                    styles.switchText,
                    tab === '장소' && styles.switchTextActive,
                  ]}
                >
                  장소
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.switchItem,
                  tab === '정보' && styles.switchItemActive,
                ]}
                onPress={() => setTab('정보')}
                activeOpacity={0.9}
              >
                <Text
                  style={[
                    styles.switchText,
                    tab === '정보' && styles.switchTextActive,
                  ]}
                >
                  정보
                </Text>
              </TouchableOpacity>
            </View>

            {tab === '장소' ? (
              <>
                <Text style={styles.sectionTitle}>전체 리스트</Text>
                <View style={styles.divider} />
                <FlatList
                  data={savedPlaces}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <View style={styles.placeRow}>
                      <View style={styles.greenCircleSmall} />
                      <View style={{ marginLeft: 6 }}>
                        <Text style={styles.placeTitle}>{item.type}</Text>
                        <View style={styles.placeMetaRow}>
                          <MaterialIcons
                            name="place"
                            size={15}
                            color="#444"
                            style={{ marginRight: 2 }}
                          />
                          <Text style={styles.placeMetaText}>
                            {item.location}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}
                />
              </>
            ) : animalInfo ? (
              <View>
                <Text style={styles.animalTitle}>{animalInfo.name}</Text>
                <Text style={styles.animalSubtitle}>{animalInfo.english}</Text>
                <Image
                  source={{ uri: animalInfo.image_url }}
                  style={styles.animalImage}
                  resizeMode="cover"
                />
                <Text style={styles.animalSectionTitle}>특징</Text>
                <View style={{ marginLeft: 8, marginBottom: 12 }}>
                  {(Array.isArray(animalInfo.features)
                    ? animalInfo.features
                    : []
                  ).map((txt: string, i: number) => (
                    <Text key={i} style={styles.animalFeature}>
                      • {txt}
                    </Text>
                  ))}
                </View>
                <Text style={styles.animalSectionTitle}>대처법</Text>
                <View style={{ marginLeft: 8 }}>
                  {(Array.isArray(animalInfo.precautions)
                    ? animalInfo.precautions
                    : []
                  ).map((txt: string, i: number) => (
                    <Text key={i} style={styles.animalPrecaution}>
                      • {txt}
                    </Text>
                  ))}
                </View>
              </View>
            ) : (
              <Text
                style={{ textAlign: 'center', marginTop: 20, color: '#999' }}
              >
                동물 이름을 검색하면 정보가 나옵니다.
              </Text>
            )}
          </BottomSheetView>
        </BottomSheet>
      </View>
    </>
  );
}

const STATUSBAR_HEIGHT =
  Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f1ea',
    //paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  mapWrapper: {
    height: windowHeight * 0.4,
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: STATUSBAR_HEIGHT,
  },
  searchBarWrapper: {
    position: 'absolute',
    top: STATUSBAR_HEIGHT + 10,
    left: 16,
    right: 16,
    zIndex: 30,
  },
  searchBar: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  searchInput: { flex: 1, fontSize: 16, color: '#222' },
  dropdown: {
    backgroundColor: '#fff',
    borderRadius: 18,
    marginTop: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#eee',
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: 0,
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderBottomWidth: 1,
    borderColor: '#f1f1f1',
    backgroundColor: '#fff',
  },
  dropdownItemFirst: { marginTop: 2 },
  dropdownItemLast: { borderBottomWidth: 0 },
  dropdownItemActive: { backgroundColor: '#faf7e9' },
  dropdownText: {
    fontSize: 17,
    color: '#444',
    fontWeight: 'bold',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)', // 반투명 검은 배경
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 5, // 그림자 효과 (안드로이드)
    shadowColor: '#000', // 그림자 효과 (iOS)
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabGroup: {
    position: 'absolute',
    right: 18,
    top: STATUSBAR_HEIGHT + 100,
    alignItems: 'center',
  },
  fabButton: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  switchContainer: {
    flexDirection: 'row',
    backgroundColor: '#faf7e9',
    borderRadius: 32,
    padding: 3,
    marginVertical: 2,
    marginBottom: 12,
  },
  switchItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 30,
    height: 59,
    paddingVertical: 9,
    backgroundColor: 'transparent',
  },
  switchItemActive: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#FEBE10',
    borderRadius: 30,
  },
  switchText: {
    fontWeight: 'bold',
    fontSize: 21,
    color: '#222',
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  switchTextActive: { color: '#222' },
  placeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  greenCircleSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 5,
    borderColor: '#46771f',
    backgroundColor: '#fff',
  },
  placeTitle: { fontWeight: 'bold', fontSize: 16, marginTop: 3, color: '#222' },
  placeMetaRow: { flexDirection: 'row', alignItems: 'center' },
  placeMetaText: {
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 1,
    color: '#444',
  },
  // banner: {
  //   position: 'absolute',
  //   left: 24,
  //   zIndex: 20,
  //   backgroundColor: '#FEBE10',
  //   borderRadius: 10,
  //   padding: 12,
  //   alignItems: 'center',
  // },
  // bannerText: { color: '#222', fontWeight: 'bold', fontSize: 15 },
  banner: {
    height: 54,
    backgroundColor: '#FEBE10',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },

  bannerText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222',
  },

  sectionTitle: { fontWeight: 'bold', fontSize: 25, marginVertical: 8 },
  animalTitle: {
    fontWeight: 'bold',
    fontSize: 22,
    marginTop: 8,
    marginBottom: 2,
  },
  animalSubtitle: { color: '#666', fontSize: 15, marginBottom: 9 },
  animalImage: {
    width: '100%',
    height: 170,
    borderRadius: 14,
    backgroundColor: '#eee',
    marginBottom: 14,
    marginTop: 4,
  },
  animalSectionTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginTop: 6,
    marginBottom: 4,
    color: '#a58519',
  },
  animalFeature: { fontSize: 15, color: '#393939', marginBottom: 2 },
  animalPrecaution: { fontSize: 15, color: '#2f5d19', marginBottom: 2 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.8,
    borderBottomColor: '#eaeaea',
  },
  divider: {
    height: 1,
    backgroundColor: '#7B7B7B',
    marginVertical: 4,
    marginBottom: 0,
  },
});
