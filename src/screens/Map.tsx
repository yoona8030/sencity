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
  Keyboard,
  StatusBar,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { KAKAO_JS_KEY, KAKAO_REST_API_KEY } from '@env';

import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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
  id: string; // 클라이언트 고유 id (카카오 place.id 등)
  remoteId?: number; // 서버에 저장된 row PK
  type: string;
  location: string;
  lat: number;
  lng: number;
}

const windowHeight = Dimensions.get('window').height;
const windowWidth = Dimensions.get('window').width;
// const BACKEND_URL = 'http://10.0.2.2:8000/api'; // 안드로이드 에뮬레이터
const BACKEND_URL = 'http://127.0.0.1:8000/api'; // 실제 기기/아이폰 시뮬이면 로컬 네트워크 IP 권장

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

      // --- 동그라미 2겹 마커 이미지 유틸 ---
      function circleSvgDataURL(d, ring, ringColor, fillColor) {
        var r = d / 2;
        var svg =
          "<svg xmlns='http://www.w3.org/2000/svg' width='" + d + "' height='" + d + "' viewBox='0 0 " + d + " " + d + "'>" +
          "<circle cx='" + r + "' cy='" + r + "' r='" + (r - ring/2) + "' fill='" + fillColor + "' stroke='" + ringColor + "' stroke-width='" + ring + "'/>" +
          "</svg>";
        return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
      }
      function makeCircleMarkerImage(d, ring, ringColor, fillColor) {
        var src  = circleSvgDataURL(d, ring, ringColor, fillColor);
        var size = new kakao.maps.Size(d, d);
        return new kakao.maps.MarkerImage(src, size, { offset: new kakao.maps.Point(d/2, d/2) });
      }
      
      window._savedMarkers = {};
      window._tempMarkers = {};
      window._savedVisible = true;

      // 저장 마커 전체 세팅
      window.setSavedMarkers = function (places) {
        try { if (typeof places === 'string') places = JSON.parse(places); } catch (e) {}
        for (var id in window._savedMarkers) {
          var mk = window._savedMarkers[id];
          if (mk) mk.setMap(null);
        }
        window._savedMarkers = {};
        (places || []).forEach(function (p) {
          var pos = new kakao.maps.LatLng(p.lat, p.lng);
          var img = makeCircleMarkerImage(18, 5, '#FEBE10', '#ffffff');
          var marker = new kakao.maps.Marker({ position: pos, map: window._savedVisible ? window.map : null, image: img });
          window._savedMarkers[p.id] = marker;
        });
      };

      // 저장 마커 가시성 토글
      window.setSavedMarkersVisible = function (visible) {
        window._savedVisible = !!visible;
        for (var id in window._savedMarkers) {
          var mk = window._savedMarkers[id];
          if (mk) mk.setMap(window._savedVisible ? window.map : null);
        }
      };

      // 저장 마커 1개 추가
      window.addSavedMarker = function (place) {
        try { if (typeof place === 'string') place = JSON.parse(place); } catch (e) {}
        if (!place) return;
        var pos = new kakao.maps.LatLng(place.lat, place.lng);
        var img = makeCircleMarkerImage(18, 5, '#FEBE10', '#ffffff');
        var marker = new kakao.maps.Marker({ position: pos, map: window._savedVisible ? window.map : null, image: img });
        window._savedMarkers[place.id] = marker;
      };

      // id로 포커스(저장/임시 모두)
      window.focusMarker = function (id) {
        var m = window._savedMarkers[id] || window._tempMarkers[id];
        if (!m) return false;
        window.map.panTo(m.getPosition());
        return true;
      };
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
    if (result === RESULTS.GRANTED) return true;

    if (result === RESULTS.DENIED || result === RESULTS.LIMITED) {
      const requestResult = await request(permission);
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
  const COMPACT_HEIGHT = 130;
  const snapPoints = React.useMemo(() => ['35%', '50%', '80%'], []);
  // 로컬 저장 키
  const SAVED_PLACES_KEY = '@savedPlaces.v1';

  const animatedPosition = useSharedValue(0);
  const mapRef = useRef<WebView>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [tab, setTab] = useState<'장소' | '정보'>('장소');
  const [input, setInput] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [history, setHistory] = useState<SearchHistoryItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [animalInfo, setAnimalInfo] = useState<AnimalInfo | null>(null);
  const [placeToSave, setPlaceToSave] = useState<PlaceItem | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<PlaceItem[]>([]);
  const [savedVisible, setSavedVisible] = useState(true);

  const syncSavedMarkers = (places: PlaceItem[]) => {
    const payload = JSON.stringify(places);
    const js = `window.setSavedMarkers(${payload}); true;`;
    mapRef.current?.injectJavaScript(js);
  };

  const [selectedPlace, setSelectedPlace] = useState<PlaceItem | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [mapHtml, setMapHtml] = useState(getKakaoMapHtml());
  const [searchResultPlace, setSearchResultPlace] = useState<PlaceItem | null>(
    null,
  );
  const [saveModalVisible, setSaveModalVisible] = useState<boolean>(false);

  // ====== authFetch (401 → refresh 재시도) ======
  const authFetch = React.useCallback(
    async (input: any, init?: RequestInit) => {
      const access = await AsyncStorage.getItem('accessToken');
      const doFetch = async (token: string | null) =>
        fetch(input, {
          ...(init || {}),
          headers: {
            'Content-Type': 'application/json',
            ...(init?.headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

      let res = await doFetch(access);
      if (res.status === 401) {
        try {
          const newAccess = await refreshAccessToken();
          res = await doFetch(newAccess);
        } catch {
          // refresh 실패 시 그냥 401 반환
        }
      }
      return res;
    },
    [],
  );

  // Kakao 주소 지오코딩 보조 함수
  const geocodeAddress = async (address: string) => {
    try {
      const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(
        address,
      )}`;
      const r = await fetch(url, {
        headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
      });
      const j = await r.json();
      const doc = j?.documents?.[0];
      if (!doc) return null;
      return { lat: parseFloat(doc.y), lng: parseFloat(doc.x) };
    } catch {
      return null;
    }
  };
  // ====== 서버 동기화 유틸 ======
  const fetchServerPlaces = async (): Promise<PlaceItem[]> => {
    const res = await authFetch(`${BACKEND_URL}/saved-places/`, {
      method: 'GET',
    });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const rows = await res.json();
    const out: PlaceItem[] = [];
    for (const r of rows) {
      let lat: number | undefined = (r as any).lat; // 대부분 없음
      let lng: number | undefined = (r as any).lng;

      // 좌표가 없으면 주소로 지오코딩
      if ((lat == null || lng == null) && r.location) {
        const g = await geocodeAddress(r.location);
        if (g) {
          lat = g.lat;
          lng = g.lng;
        }
      }

      out.push({
        id: String(r.id), // 서버에 client_id가 없으니 PK를 id로 사용
        remoteId: r.id,
        type: r.name, // ← name을 앱 내부 필드 type으로 사용
        location: r.location,
        lat: lat ?? 0, // 없으면 0(혹은 표기/마커 스킵 로직)
        lng: lng ?? 0,
      });
    }
    return out;
  };

  const pushPlaceToServer = async (place: PlaceItem) => {
    const body: any = {
      type: place.type,
      name: place.type, // ← 서버 스키마에 맞춤
      location: place.location,
      client_id: place.id, // 서버 모델에 있으면 중복 방지에 유리
    };
    const res = await authFetch(`${BACKEND_URL}/saved-places/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`post ${res.status}`);
    const saved = await res.json();
    // 서버 PK 덮어쓰기
    setSavedPlaces(prev =>
      prev.map(p => (p.id === place.id ? { ...p, remoteId: saved.id } : p)),
    );
  };

  const deletePlaceRemote = async (remoteId: number) => {
    await authFetch(`${BACKEND_URL}/saved-places/${remoteId}/`, {
      method: 'DELETE',
    });
  };

  const syncWithServer = async () => {
    try {
      // 1) 로컬에 있는데 서버에 없는 것 업로드
      const unsynced = savedPlaces.filter(p => !p.remoteId);
      for (const p of unsynced) {
        await pushPlaceToServer(p);
      }
      // 2) 서버 최신 목록과 머지(클라 id 기준)
      const mergedById = new globalThis.Map<string, PlaceItem>();
      const serverList: PlaceItem[] = await fetchServerPlaces(); // 서버에서 받아오는 리스트 타입 명시
      serverList.forEach((s: PlaceItem) => mergedById.set(s.id, s)); // 병합 로직에서 타입 힌트
      savedPlaces.forEach((l: PlaceItem) => {
        if (!mergedById.has(l.id)) mergedById.set(l.id, l);
      });
      const merged: PlaceItem[] = Array.from(mergedById.values()); // Array.from 의 unknown[] 방지
      setSavedPlaces(merged);
    } catch (e) {
      console.warn('syncWithServer error:', e);
    }
  };

  // ====== 로컬 저장 불러오기 / 저장하기 ======
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_PLACES_KEY);
        if (raw) {
          const parsed: PlaceItem[] = JSON.parse(raw);
          setSavedPlaces(parsed);
        }
      } catch (e) {
        console.warn('load savedPlaces error', e);
      }
    })();
  }, []);

  useEffect(() => {
    // 로컬에 즉시 반영 + 지도 마커 동기화
    AsyncStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(savedPlaces)).catch(
      () => {},
    );
    syncSavedMarkers(savedPlaces);
  }, [savedPlaces]);

  // ====== 토큰 로드 및 로그인 이후 동기화 ======
  useEffect(() => {
    const loadToken = async () => {
      const token = await AsyncStorage.getItem('accessToken');
      setAccessToken(token);
    };
    loadToken();
  }, []);

  useEffect(() => {
    if (accessToken) {
      // 로그인 됐다면 서버와 2-way 동기화
      syncWithServer();
    }
  }, [accessToken]);

  // ====== 나머지 기존 로직 ======
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
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setIsSearching(true);
      requestAnimationFrame(() => bottomSheetRef.current?.snapToIndex(0));
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setIsSearching(false);
      requestAnimationFrame(() => bottomSheetRef.current?.snapToIndex(0));
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
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
    } catch (e) {}
  }

  const handleDeletePlace = (place: PlaceItem) => {
    Alert.alert('삭제', '이 장소를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          // 1) 서버 삭제(있다면)
          if (place.remoteId) {
            try {
              await deletePlaceRemote(place.remoteId);
            } catch (e) {
              console.warn(e);
            }
          }
          // 2) 로컬 삭제
          setSavedPlaces(prev => prev.filter(p => p.id !== place.id));
        },
      },
    ]);
  };

  const bannerHeight = 54;
  const bannerMargin = 5;

  const bannerAnimatedStyle = useAnimatedStyle(() => {
    const top = animatedPosition.value - bannerHeight - bannerMargin;
    return { position: 'absolute', left: 8, right: 8, top, zIndex: 999 };
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
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('기록 조회 실패');
      const data: SearchHistoryItem[] = await res.json();
      setHistory(data);
    } catch (e) {
      setHistory([]);
    }
  }

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
      if (!infoRes.ok || !infoData.name) throw new Error('정보 없음');
      setAnimalInfo(infoData);
      setDropdownOpen(false);
      setSelectedId(null);
      bottomSheetRef.current?.snapToIndex(0);
    } catch (e) {
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
        method: 'GET',
        headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
      });
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

      const jsCode = `
        (function() {
          try {
            var moveLatLon = new kakao.maps.LatLng(${lat}, ${lng});
            if (window.map) { window.map.setCenter(moveLatLon); }
          } catch (e) { console.log('inject err', e); }
          true;
        })();
      `;
      mapRef.current?.injectJavaScript(jsCode);

      setSearchResultPlace({
        id: place.id,
        type: place.place_name,
        location: place.address_name,
        lat,
        lng,
      });

      setSelectedPlace(null);
      setSaveModalVisible(true);
      bottomSheetRef.current?.snapToIndex(1);
    } catch (e) {
      Alert.alert('검색 실패', '장소 검색 중 오류가 발생했습니다.');
    }
  }

  function confirmSavePlace() {
    if (!searchResultPlace) return;
    const p = searchResultPlace;

    // 로컬 추가
    setSavedPlaces(prev => {
      if (prev.find(sp => sp.id === p.id)) return prev;
      return [...prev, p];
    });

    // 서버에도 즉시 업로드(로그인 상태라면)
    (async () => {
      const token = await AsyncStorage.getItem('accessToken');
      if (token) {
        try {
          await pushPlaceToServer(p);
        } catch (e) {
          console.warn(e);
        }
      }
    })();

    setSaveModalVisible(false);
    setSearchResultPlace(null);
    Alert.alert('저장 완료', '장소가 저장되었습니다.');

    // 저장 마커가 보이는 상태에서만 즉시 주입/포커스
    if (savedVisible) {
      const js = `
        (function(){
          try {
            if (window.addSavedMarker) window.addSavedMarker(${JSON.stringify(
              p,
            )});
            if (window.focusMarker) window.focusMarker(${JSON.stringify(p.id)});
          } catch (e) { console.log('inject err', e); }
          true;
        })();
      `;
      mapRef.current?.injectJavaScript(js);
    }
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
      const res = await fetch(`${BACKEND_URL}/search-history/${id}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`삭제 실패: ${res.status}`);
      await fetchHistory();
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      Alert.alert('삭제 실패', '검색 기록 삭제 중 오류가 발생했습니다.');
    }
  };

  async function moveToCurrentLocation() {
    const hasPermission = await requestLocationPermission();
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
            onLoadEnd={() => {
              // WebView가 준비되면 현재 savedPlaces를 마커로 반영
              syncSavedMarkers(savedPlaces);
            }}
            onError={({ nativeEvent }) => {
              console.warn('WebView error: ', nativeEvent);
            }}
          />
        </View>

        {dropdownOpen && (
          <Pressable
            style={styles.dropdownBackdrop}
            onPress={() => {
              setDropdownOpen(false);
              Keyboard.dismiss();
            }}
          />
        )}

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
          transparent
          animationType="fade"
          onRequestClose={() => setSaveModalVisible(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setSaveModalVisible(false)}
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.saveCard}>
              <View style={styles.saveHeaderRow}>
                <View style={styles.saveIconWrap}>
                  <MaterialIcons name="place" size={22} color="#DD0000" />
                </View>
                <Text style={styles.saveTitle}>장소 저장</Text>
              </View>

              <Text style={styles.saveSubtitle}>검색된 장소를 저장할까요?</Text>

              {!!searchResultPlace?.type && (
                <Text style={styles.savePlaceName}>
                  {searchResultPlace?.type}
                </Text>
              )}
              {!!searchResultPlace?.location && (
                <Text style={styles.saveAddress}>
                  {searchResultPlace?.location}
                </Text>
              )}

              <View style={styles.saveActions}>
                <TouchableOpacity
                  onPress={() => setSaveModalVisible(false)}
                  activeOpacity={0.8}
                  style={[styles.btn, styles.btnOutline]}
                >
                  <Text style={[styles.btnText, styles.btnOutlineText]}>
                    취소
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={confirmSavePlace}
                  activeOpacity={0.9}
                  style={[styles.btn, styles.btnPrimary]}
                >
                  <Text style={[styles.btnText, styles.btnPrimaryText]}>
                    저장
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.fabGroup}>
          <TouchableOpacity
            style={[styles.fabButton]}
            onPress={() => {
              setSavedVisible(prev => {
                const next = !prev;
                const js = `
                  (function(){
                    try { if (window.setSavedMarkersVisible) window.setSavedMarkersVisible(${next}); } catch(e){}
                    true;
                  })();`;
                mapRef.current?.injectJavaScript(js);
                return next;
              });
            }}
          >
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

        {/* (예시) 상단 배너 */}
        <Animated.View style={[bannerAnimatedStyle]}>
          <View style={styles.banner}>
            <Text style={styles.bannerText} numberOfLines={1}>
              오후 9시 30분경 "##역" 반경 2KM 이내에 고라니 출현
            </Text>
          </View>
        </Animated.View>

        <BottomSheet
          ref={bottomSheetRef}
          snapPoints={snapPoints}
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

            {!isSearching && (
              <>
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
                          <View style={{ marginLeft: 6, flex: 1 }}>
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

                          {/* 삭제 버튼 */}
                          <TouchableOpacity
                            onPress={() => handleDeletePlace(item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={{ padding: 6, marginLeft: 8 }}
                          >
                            <Ionicons
                              name="trash-outline"
                              size={20}
                              color="#888"
                            />
                          </TouchableOpacity>
                        </View>
                      )}
                    />
                  </>
                ) : animalInfo ? (
                  <View>
                    <Text style={styles.animalTitle}>{animalInfo.name}</Text>
                    <Text style={styles.animalSubtitle}>
                      {animalInfo.english}
                    </Text>
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
                    style={{
                      textAlign: 'center',
                      marginTop: 20,
                      color: '#999',
                    }}
                  >
                    동물 이름을 검색하면 정보가 나옵니다.
                  </Text>
                )}
              </>
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
  },
  mapWrapper: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  searchBarWrapper: {
    position: 'absolute',
    top: STATUSBAR_HEIGHT - 5,
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
  dropdownText: { fontSize: 17, color: '#444', fontWeight: 'bold' },

  // 모달 공통
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    zIndex: 999,
  },
  modalCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  saveCard: {
    width: '86%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  saveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  saveIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  saveTitle: { fontSize: 18, fontWeight: '700', color: '#222' },
  saveSubtitle: { marginTop: 2, marginBottom: 10, color: '#666', fontSize: 14 },
  savePlaceName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  saveAddress: { fontSize: 14, color: '#555', marginBottom: 14 },
  saveActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 10,
  },

  // 버튼들
  btn: {
    minWidth: 78,
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '700' },
  btnOutline: {
    borderWidth: 1.5,
    borderColor: '#D0D0D0',
    backgroundColor: '#fff',
  },
  btnOutlineText: { color: '#333' },
  btnPrimary: { backgroundColor: '#DD0000' },
  btnPrimaryText: { color: '#fff' },

  fabGroup: {
    position: 'absolute',
    right: 18,
    top: STATUSBAR_HEIGHT + 60,
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
    borderColor: '#FEBE10',
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

  banner: {
    height: 54,
    backgroundColor: '#FEBE10',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  bannerText: { fontSize: 15, fontWeight: 'bold', color: '#222' },

  sectionTitle: { fontWeight: 'bold', fontSize: 20, marginVertical: 8 },
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
  divider: {
    height: 1,
    backgroundColor: '#7B7B7B',
    marginVertical: 4,
    marginBottom: 0,
  },
});
