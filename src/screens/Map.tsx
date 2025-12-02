// src/screens/Map.tsx
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
  Linking,
} from 'react-native';
import { fetchAllReportPoints } from '../api/report';
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
import { API_BASE_URL } from '@env';

interface SearchHistoryItem {
  id: number;
  keyword: string;
}
interface AnimalInfo {
  name: string;
  english: string;
  image?: string;
  features: string[] | string | null;
  precautions: string[] | string | null;
}
interface PlaceItem {
  id: string;
  remoteId?: number;
  name: string;
  location: string;
  lat: number;
  lng: number;
}

// ★ NEW: 배너 페이로드 형태(REST/WS 공용)
type BannerPayload = {
  text: string;
  until?: string | null; // ISO8601 (선택)
  ttlSeconds?: number | null; // 대안: 수신 시점 기준 유효 초 (선택)
};

const BANNER_CACHE_KEY = '@banner.last';
const ENABLE_BANNER_WS = false;

async function loadBannerFromCache() {
  try {
    const raw = await AsyncStorage.getItem(BANNER_CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && typeof obj.text === 'string' ? (obj as BannerPayload) : null;
  } catch {
    return null;
  }
}

async function saveBannerToCache(p: BannerPayload | null) {
  try {
    if (!p) {
      await AsyncStorage.removeItem(BANNER_CACHE_KEY);
      return;
    }
    await AsyncStorage.setItem(BANNER_CACHE_KEY, JSON.stringify(p));
  } catch {}
}

export const API_BASE = API_BASE_URL; // ← 필요시 .env로 이동 권장

// ★ NEW: 배너 REST/WS 엔드포인트 상수
const BANNER_POLL_ENDPOINT = `${API_BASE}/app-banners/active/`; // REST 폴링용
const BANNER_WS_PATH = '/ws/banner/'; // WS 경로(호스트는 BACKEND_URL에서 파생)

// =================== Kakao Map HTML ===================
const getKakaoMapHtml = (lat = 37.5611, lng = 127.0375) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Kakao Map</title>
  <style>
    html, body, #map { margin:0; padding:0; width:100vw; height:100vh; }
    .beacon-wrap { position:relative; width:24px; height:24px; transform: translate(-50%, -50%); }
    .beacon-core {
      width: 14px; height: 14px; border-radius: 7px;
      background: #fff; border: 3px solid #DD0000;
      box-shadow: 0 1px 3px rgba(0,0,0,0.25);
      position:absolute; left:50%; top:50%; transform: translate(-50%, -50%);
    }
    .beacon-ring {
      position:absolute; left:50%; top:50%;
      width: 42px; height: 42px; border-radius: 21px;
      background: #DD0000;
      transform: translate(-50%, -50%) scale(0.6);
      opacity: .45;
      animation: pulse 1.6s ease-out infinite;
    }
    @keyframes pulse {
      0% { transform: translate(-50%, -50%) scale(0.6); opacity:.45; }
      100% { transform: translate(-50%, -50%) scale(2.1); opacity:0; }
    }
  </style>
</head>
<body>
  <div id="map" style="width:100vw; height:100vh;"></div>

  <!-- 🔧 중요: SDK를 동적으로 로드하고, onload 후에만 kakao.maps.load 실행 -->
  <script>
    (function() {
      var RNW = window.ReactNativeWebView;

      function post(msg) {
        try { RNW && RNW.postMessage(JSON.stringify(msg)); } catch(e) {}
      }

      function initKakao() {
        try {
          if (!window.kakao || !kakao.maps || !kakao.maps.load) {
            post({ type: 'KAKAO_NOT_READY' });
            return;
          }
          kakao.maps.load(function() {
            try {
              var mapContainer = document.getElementById('map');
              var mapOption = {
                center: new kakao.maps.LatLng(${lat}, ${lng}),
                level: 1
              };
              window.map = new kakao.maps.Map(mapContainer, mapOption);

              window._reportOverlays = {};
              window._reportCoords   = [];
              window._reportsVisible = false;

              function isNum(v){ return typeof v === 'number' && isFinite(v); }
              window.safeRelayout = function(){
                try { if (window.map && typeof window.map.relayout === 'function') window.map.relayout(); } catch(e) {}
              };

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

              window._meMarker = null;
              window._meAccuracyCircle = null;

              function makeBlueMarkerImage(d) {
                return makeCircleMarkerImage(d, 5, '#2E7DFF', '#ffffff');
              }

              window.setMyLocation = function(lat, lng, accuracy) {
                try {
                  if (!isNum(lat) || !isNum(lng)) return false;
                  var pos = new kakao.maps.LatLng(lat, lng);
                  if (!window._meMarker) {
                    var img = makeBlueMarkerImage(22);
                    window._meMarker = new kakao.maps.Marker({
                      position: pos,
                      map: window.map,
                      image: img,
                      zIndex: 10000
                    });
                  } else {
                    window._meMarker.setPosition(pos);
                    window._meMarker.setMap(window.map);
                  }
                  if (isNum(accuracy) && accuracy > 0) {
                    if (window._meAccuracyCircle) window._meAccuracyCircle.setMap(null);
                    window._meAccuracyCircle = new kakao.maps.Circle({
                      center: pos,
                      radius: Math.min(accuracy, 300),
                      strokeWeight: 2, strokeColor: '#2E7DFF', strokeOpacity: 0.6, strokeStyle: 'shortdash',
                      fillColor: '#2E7DFF', fillOpacity: 0.12
                    });
                    window._meAccuracyCircle.setMap(window.map);
                  }
                  window.safeRelayout();
                  window.map.panTo(pos);
                  return true;
                } catch(e) { return false; }
              };

              window._savedMarkers = {};
              window._tempMarkers = {};
              window._savedVisible = true;

              window.setSavedMarkers = function (places) {
                try { if (typeof places === 'string') places = JSON.parse(places); } catch (e) {}
                for (var id in window._savedMarkers) { var mk = window._savedMarkers[id]; if (mk) mk.setMap(null); }
                window._savedMarkers = {};
                (places || []).forEach(function (p) {
                  var lat = Number(p.lat), lng = Number(p.lng);
                  if (!isNum(lat) || !isNum(lng)) return;
                  var pos = new kakao.maps.LatLng(lat, lng);
                  var img = makeCircleMarkerImage(18, 5, '#FEBA15', '#ffffff');
                  var marker = new kakao.maps.Marker({ position: pos, map: window._savedVisible ? window.map : null, image: img });
                  window._savedMarkers[p.id] = marker;
                });
              };
              window.setSavedMarkersVisible = function (visible) {
                window._savedVisible = !!visible;
                for (var id in window._savedMarkers) { var mk = window._savedMarkers[id]; if (mk) mk.setMap(window._savedVisible ? window.map : null); }
              };
              window.addSavedMarker = function (place) {
                try { if (typeof place === 'string') place = JSON.parse(place); } catch (e) {}
                if (!place) return;
                var lat = Number(place.lat), lng = Number(place.lng);
                if (!isNum(lat) || !isNum(lng)) return;
                var pos = new kakao.maps.LatLng(lat, lng);
                var img = makeCircleMarkerImage(18, 5, '#FEBA15', '#ffffff');
                var marker = new kakao.maps.Marker({ position: pos, map: window._savedVisible ? window.map : null, image: img });
                window._savedMarkers[place.id] = marker;
              };
              window.focusMarker = function (id) {
                var m = window._savedMarkers[id] || window._tempMarkers[id];
                if (!m) return false;
                window.safeRelayout();
                window.map.panTo(m.getPosition());
                return true;
              };

              window.clearReports = function () {
                try {
                  if (window._reportOverlays) {
                    Object.values(window._reportOverlays).forEach(function(ov){
                      try {
                        if (ov && ov.setMap) ov.setMap(null);
                        var content = ov.getContent && ov.getContent();
                        if (content && content.parentNode) content.parentNode.removeChild(content);
                      } catch (e) {}
                    });
                  }
                  var beacons = document.querySelectorAll('.beacon-wrap');
                  beacons.forEach(function(el){ try { el.remove(); } catch (e) {} });

                  window._reportOverlays = {};
                  window._reportCoords = [];
                  window._reportsVisible = false;
                  return true;
                } catch (e) {
                  console.log('[clearReports err]', e);
                  return false;
                }
              };

              function makeBeaconDom() {
                var wrap = document.createElement('div');
                wrap.className = 'beacon-wrap';
                var ring = document.createElement('div');
                ring.className = 'beacon-ring';
                var core = document.createElement('div');
                core.className = 'beacon-core';
                wrap.appendChild(ring);
                wrap.appendChild(core);
                return wrap;
              }

              window.setReports = function(reports) {
                try {
                  if (typeof reports === 'string') { try { reports = JSON.parse(reports); } catch (e) { reports = []; } }
                  if (window.clearReports) window.clearReports();

                  (reports || []).forEach(function(r) {
                    var lat = Number(r.lat), lng = Number(r.lng);
                    if (!isNum(lat) || !isNum(lng)) return;

                    var pos = new kakao.maps.LatLng(lat, lng);
                    window._reportCoords.push({ lat: lat, lng: lng });

                    var dom = makeBeaconDom();
                    var ov = new kakao.maps.CustomOverlay({
                      position: pos,
                      content: dom,
                      yAnchor: 0.5,
                      xAnchor: 0.5,
                      zIndex: 8000
                    });
                    if (window._reportsVisible) ov.setMap(window.map);
                    window._reportOverlays[r.id] = ov;
                  });
                } catch (e) {
                  console.log('[setReports err]', e);
                }
              };

              window.setReportsVisible = function(visible) {
                window._reportsVisible = !!visible;
                for (var id in window._reportOverlays) {
                  var ov = window._reportOverlays[id];
                  if (ov) ov.setMap(window._reportsVisible ? window.map : null);
                }
              };

              window.addReport = function(report) {
                try { if (typeof report === 'string') report = JSON.parse(report); } catch (e) {}
                if (!report) return;
                var lat = Number(report.lat), lng = Number(report.lng);
                if (!isNum(lat) || !isNum(lng)) return;

                var pos = new kakao.maps.LatLng(lat, lng);
                window._reportCoords.push({ lat: lat, lng: lng });
                var dom = makeBeaconDom();
                var ov = new kakao.maps.CustomOverlay({
                  position: pos,
                  content: dom,
                  yAnchor: 0.5,
                  xAnchor: 0.5,
                  zIndex: 8000
                });
                if (window._reportsVisible) ov.setMap(window.map);
                window._reportOverlays[report.id] = ov;
              };

              window.focusReports = function () {
                try {
                  if (!window.map) return false;
                  window.safeRelayout();

                  var ids = Object.keys(window._reportOverlays || {}).filter(function(id){
                    return !!window._reportOverlays[id] && !!window._reportOverlays[id].getPosition;
                  });
                  if (ids.length === 0) return false;

                  if (ids.length === 1) {
                    var ov = window._reportOverlays[ids[0]];
                    var pos = ov && ov.getPosition && ov.getPosition();
                    if (!pos) return false;
                    window.map.panTo(pos);
                    var lv = window.map.getLevel();
                    if (lv > 8) window.map.setLevel(8);
                    return true;
                  }

                  var bounds = new kakao.maps.LatLngBounds();
                  var valid = false;
                  ids.forEach(function(id){
                    var ov = window._reportOverlays[id];
                    if (!ov || !ov.getPosition) return;
                    var p = ov.getPosition();
                    if (p) { bounds.extend(p); valid = true; }
                  });
                  if (!valid) return false;

                  window.map.setBounds(bounds, 40, 40, 40, 40);
                  var lv2 = window.map.getLevel();
                  if (lv2 > 8) window.map.setLevel(8);

                  return true;
                } catch (e) {
                  console.log('focusReports err', e);
                  return false;
                }
              };

              post({ type: 'KAKAO_READY' });
            } catch (e) {
              post({ type: 'KAKAO_INIT_ERROR', error: String(e) });
            }
          });
        } catch (e) {
          post({ type: 'KAKAO_LOAD_WRAPPER_ERROR', error: String(e) });
        }
      }

      // 동적 스크립트 로드
      (function loadSdk() {
        var s = document.createElement('script');
        // autoload=false 필수. libraries 그대로 유지
        s.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services,clusterer,drawing";
        s.async = true;
        s.defer = true;
        s.onload = initKakao;
        s.onerror = function() { post({ type: 'KAKAO_SDK_LOAD_ERROR' }); };
        document.head.appendChild(s);
      })();
    })();
  </script>
</body>
</html>
`;

// =================== 권한 유틸 ===================
async function ensureLocationPermissionDetailed(): Promise<
  'granted' | 'denied' | 'blocked'
> {
  let permission: Permission;

  if (Platform.OS === 'android') {
    permission = PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION;
  } else if (Platform.OS === 'ios') {
    permission = PERMISSIONS.IOS.LOCATION_WHEN_IN_USE;
  } else {
    return 'denied';
  }

  try {
    const cur = await check(permission);
    if (cur === RESULTS.GRANTED) return 'granted';
    if (cur === RESULTS.BLOCKED) return 'blocked';

    const req = await request(permission);
    if (req === RESULTS.GRANTED) return 'granted';
    if (req === RESULTS.BLOCKED) return 'blocked';
    return 'denied';
  } catch (e) {
    console.warn('권한 체크 오류:', e);
    return 'denied';
  }
}

async function refreshAccessToken() {
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${API_BASE}/auth/jwt/refresh/`, {
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

// ★ NEW: 유틸 — API_BASE → WS URL 변환
function toWsUrl(httpApiBase: string, wsPath: string): string | null {
  try {
    // http://host:8000/api → ws://host:8000 + wsPath
    const u = new URL(httpApiBase);
    const proto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = u.host; // host:port
    return `${proto}//${host}${wsPath}`;
  } catch {
    return null;
  }
}

export default function Map() {
  // ★ 키 로드 확인(마스킹) — 콘솔에서 즉시 진단
  useEffect(() => {
    const mask = (s?: string) => (s ? `${s.slice(0, 6)}****` : 'EMPTY');
    console.log('[KAKAO_KEYS]', {
      JS: mask(KAKAO_JS_KEY as any),
      REST: mask(KAKAO_REST_API_KEY as any),
    });
    if (!KAKAO_REST_API_KEY) {
      Alert.alert(
        'Kakao REST 키 확인',
        'KAKAO_REST_API_KEY가 비어 있습니다. .env에 REST API 키를 넣고 앱을 다시 빌드하세요.',
      );
    }
  }, []);

  const [Reports, setReports] = useState<any[] | null>(null);
  const hasFocusedOnceRef = useRef(false);
  const [reportsVisible, setReportsVisible] = useState(false);
  const bottomSheetRef = useRef<BottomSheet>(null);
  const COMPACT_HEIGHT = 130;
  const LOGO = require('../../assets/images/logo2.png');

  const asiatic_black_bear = require('../../assets/map_images/asia_black_bear.png');
  const chipmunk = require('../../assets/map_images/chipmunk.png');
  const roe_deer = require('../../assets/map_images/roe_deer.png');
  const great_egret = require('../../assets/map_images/great_egret.png');
  const goat = require('../../assets/map_images/goat.png');
  const hare = require('../../assets/map_images/hare.png');
  const heron = require('../../assets/map_images/heron.png');
  const raccoon = require('../../assets/map_images/raccoon.png');
  const squirrel = require('../../assets/map_images/squirrel.png');
  const weasel = require('../../assets/map_images/weasel.png');
  const wild_boar = require('../../assets/map_images/wild_boar.png');

  const ANIMAL_IMAGES: Record<string, any> = {
  // 영어 이름
  'asiatic black bear': asiatic_black_bear,
  chipmunk: chipmunk,
  deer: roe_deer,
  'great egret': great_egret,
  goat: goat,
  hare: hare,
  heron: heron,
  raccoon: raccoon,
  squirrel: squirrel,
  weasel: weasel,
  'wild boar': wild_boar,

  // 한글 이름 매핑 (원하는 대로 연결)
  '반달가슴곰': asiatic_black_bear,
  '멧돼지': wild_boar,
  '족제비': weasel,
  '고라니': goat,
  '노루': roe_deer,
  '왜가리': heron,
  '중대백로': great_egret,
  '너구리': raccoon,
  '다람쥐': chipmunk,
  '청설모': squirrel,
  '멧토끼': hare,
};

  const snapPoints = useMemo(() => ['35%', '50%', '80%'], []);
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
  const [animalImgUri, setAnimalImgUri] = useState<string | undefined>(
    undefined,
  );

  // ★ NEW: 배너 상태
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerHideUntil, setBannerHideUntil] = useState<number | null>(null); // ms epoch
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const candidate = animalInfo?.image || ''; // "/media/animals/xxx.jpg" 또는 "http://..."

  const computedUri = candidate
    ? candidate.startsWith('http')
      ? candidate
      : `${API_BASE}${candidate}` // 상대 경로면 API_BASE 붙이기
    : '';

  useEffect(() => {
    setAnimalImgUri(computedUri || undefined);
  }, [computedUri]);

  useEffect(() => {
    async function loadReports() {
      try {
        const list = await fetchAllReportPoints();
        console.log(
          '[REPORT] fetched count:',
          Array.isArray(list) ? list.length : 'N/A',
        );
        setReports(list);

        const payload = JSON.stringify(list);
        const js = `
          (function(){
            try {
              if (window.setReports) window.setReports(${payload});
              if (window.setReportsVisible) window.setReportsVisible(false);
            } catch(e){ console.log('report inject err', e); }
            true;
          })();
        `;
        mapRef.current?.injectJavaScript(js);
      } catch (e) {
        console.warn('신고 포인트 로드 실패', e);
      }
    }
    loadReports();
  }, []);

  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<PlaceItem[]>([]);
  const [savedVisible, setSavedVisible] = useState(true);

  const [locationModalVisible, setLocationModalVisible] = useState(false);

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
        } catch {}
      }
      return res;
    },
    [],
  );

  // ===== Kakao 주소 지오코딩(미사용시 제거 가능) =====
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

  function syncReportsOnWebview(list: any[] | null, visible: boolean) {
    if (!mapRef.current) return;
    const payload = JSON.stringify(list || []);
    const js = `
      (function(){
        try {
          if (window.setReports) window.setReports(${payload});
          if (window.setReportsVisible) window.setReportsVisible(${visible});
        } catch(e){ console.log('reports sync err', e); }
        true;
      })();
    `;
    mapRef.current?.injectJavaScript(js);
  }

  const uniqueReports = React.useCallback((list: any[] | null) => {
    const out: any[] = [];
    const seen = new Set<string>();
    for (const r of list || []) {
      const id = String(r?.id ?? `${r?.lat},${r?.lng}`);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(r);
    }
    return out;
  }, []);

  function safeNameFromServerRow(r: any): string {
    const cand = r.name ?? r.alias ?? r.title ?? r.address ?? null;
    if (typeof cand === 'string' && cand.trim()) return cand.trim();
    const lat = Number(r.latitude);
    const lng = Number(r.longitude);
    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return `장소 ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
    return '장소';
  }

  // ===== 서버 동기화 =====
  const fetchServerPlaces = async (): Promise<PlaceItem[]> => {
    const res = await authFetch(`${API_BASE}/saved-places/`, { method: 'GET' });
    if (!res.ok) throw new Error(`fetch ${res.status}`);
    const rows = await res.json();

    const out: PlaceItem[] = [];
    for (const r of rows) {
      let lat: number | undefined = r.latitude;
      let lng: number | undefined = r.longitude;

      if ((lat == null || lng == null) && r.address) {
        const g = await geocodeAddress(r.address);
        if (g) {
          lat = g.lat;
          lng = g.lng;
        }
      }

      out.push({
        id: r.client_id ? String(r.client_id) : `srv-${r.id}`,
        remoteId: r.id,
        name: safeNameFromServerRow(r),
        location: r.address ?? '',
        lat: lat ?? 0,
        lng: lng ?? 0,
      });
    }
    return out;
  };

  const pushPlaceToServer = async (place: PlaceItem) => {
    const safeName = derivePlaceName(place);
    const body = {
      location: String(place.location || '').trim(),
      latitude: Number(place.lat),
      longitude: Number(place.lng),
      name: String(place.name || place.location || '장소'),
      client_id: String(place.id),
    };

    console.log('[saved-places POST body]', body);

    const res = await authFetch(`${API_BASE}/saved-places/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.log('[saved-places POST fail]', res.status, raw);
      throw new Error(`post ${res.status}: ${raw}`);
    }

    const saved = JSON.parse(raw);
    setSavedPlaces(prev =>
      prev.map(p => (p.id === place.id ? { ...p, remoteId: saved.id } : p)),
    );
  };

  const deletePlaceRemote = async (remoteId: number) => {
    await authFetch(`${API_BASE}/saved-places/${remoteId}/`, {
      method: 'DELETE',
    });
  };

  const syncWithServer = async () => {
    try {
      const unsynced = savedPlaces.filter(p => !p.remoteId);
      for (const p of unsynced) {
        await pushPlaceToServer(p);
      }

      const serverList = await fetchServerPlaces();

      const byId: Record<string, PlaceItem> = {};
      for (const s of serverList) {
        byId[s.id] = s;
      }
      const allIds = [
        ...savedPlaces.map(p => p.id),
        ...serverList.map(s => s.id),
      ].filter((v, i, arr) => arr.indexOf(v) === i);

      const merged: PlaceItem[] = [];
      for (const id of allIds) {
        const local = savedPlaces.find(p => p.id === id) || null;
        const remote = byId[id] || null;

        if (local && remote) {
          merged.push({
            id,
            remoteId: remote.remoteId ?? local.remoteId,
            name:
              (remote.name && remote.name.trim()) ||
              (local.name && local.name.trim()) ||
              derivePlaceName(local) ||
              '장소',
            location:
              (remote.location && remote.location.trim()) ||
              (local.location && local.location.trim()) ||
              '',
            lat: remote.lat ?? local.lat ?? 0,
            lng: remote.lng ?? local.lng ?? 0,
          });
        } else if (remote) {
          merged.push(remote);
        } else if (local) {
          merged.push(local);
        }
      }

      setSavedPlaces(merged);
    } catch (e) {
      console.warn('syncWithServer error:', e);
    }
  };

  // ===== 로컬 로드/저장 =====
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SAVED_PLACES_KEY);
        if (raw) setSavedPlaces(JSON.parse(raw));
      } catch (e) {
        console.warn('load savedPlaces error', e);
      }
    })();
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(SAVED_PLACES_KEY, JSON.stringify(savedPlaces)).catch(
      () => {},
    );
    syncSavedMarkers(savedPlaces);
  }, [savedPlaces]);

  // ===== 토큰 로드 및 동기화 =====
  useEffect(() => {
    const loadToken = async () => {
      const token = await AsyncStorage.getItem('accessToken');
      setAccessToken(token);
    };
    loadToken();
  }, []);

  useEffect(() => {
    if (accessToken) syncWithServer();
  }, [accessToken]);

  // ===== 지도 포커싱 =====
  useEffect(() => {
    if (selectedPlace) {
      setMapHtml(getKakaoMapHtml(selectedPlace.lat, selectedPlace.lng));
    }
  }, [selectedPlace]);

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
      await fetch(`${API_BASE}/search-history/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ keyword }),
      });
    } catch {}
  }

  const handleDeletePlace = (place: PlaceItem) => {
    Alert.alert('삭제', '이 장소를 삭제할까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          if (place.remoteId) {
            try {
              await deletePlaceRemote(place.remoteId);
            } catch (e) {
              console.warn(e);
            }
          }
          setSavedPlaces(prev => prev.filter(p => p.id !== place.id));
        },
      },
    ]);
  };

  const bannerHeight = 54;
  const bannerMargin = 5;

  const bannerAnimatedStyle = useAnimatedStyle(() => {
    // 최소 상단 고정(검색창 아래) 보정: 초기값이 0일 때도 화면 안에 보이도록
    const minTop = STATUSBAR_HEIGHT + 60; // 검색창 아래 정도
    const dynamicTop = animatedPosition.value - bannerHeight - bannerMargin;
    const top = Math.max(minTop, dynamicTop);
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
      const res = await fetch(`${API_BASE}/search-history/`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('기록 조회 실패');
      const data: SearchHistoryItem[] = await res.json();
      setHistory(data);
    } catch {
      setHistory([]);
    }
  }

  // =================== 검색 로직(개선) ===================
  async function handleSearch(keyword: string) {
    const raw = keyword.trim();
    if (!raw) return;

    const lowered = raw.toLowerCase();
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
    const isAnimal = animalList.some(a => a.toLowerCase() === lowered);

    await saveSearchKeyword(raw);
    Keyboard.dismiss();

    if (isAnimal && (await searchAnimal(raw))) {
      setTab('정보');
      return;
    }
    if (await searchAnimalLoose(raw)) {
      setTab('정보');
      return;
    }
    await searchPlace(raw);
    setTab('장소');
  }

  function toArray(v: unknown): string[] {
    if (Array.isArray(v)) {
      return (v as unknown[])
        .map(String)
        .map(s => s.replace(/^[•\-\*]\s*/, '').trim())
        .filter(Boolean);
    }
    if (typeof v === 'string') {
      return v
        .split(/\r?\n|,/)
        .map(s => s.replace(/^[•\-\*]\s*/, '').trim())
        .filter(Boolean);
    }
    return [];
  }

  async function searchAnimal(keyword: string) {
    try {
      const r = await fetch(
        `${API_BASE}/animal-info/?name=${encodeURIComponent(keyword)}`,
      );
      const j = await r.json();
      if (!r.ok || !j?.name) return false;

      setAnimalInfo({
        name: j.name,
        english: j.english,
        image: j.image ?? null, // "/media/animals/..." 예상
        features: toArray(j.features),
        precautions: toArray(j.precautions),
      });
      setDropdownOpen(false);
      setSelectedId(null);
      bottomSheetRef.current?.snapToIndex(0);
      return true;
    } catch {
      return false;
    }
  }

  async function searchAnimalLoose(q: string) {
    try {
      const r = await fetch(
        `${API_BASE}/animals/search/?q=${encodeURIComponent(q)}`,
      );
      if (!r.ok) return false;
      const list = await r.json();
      if (!Array.isArray(list) || list.length === 0) return false;

      const a = list[0];
      setAnimalInfo({
        name: a.name_kor,
        english: a.name_eng,
        image: a.image ?? null,
        features: toArray(a.features),
        precautions: toArray(a.precautions),
      });
      setDropdownOpen(false);
      setSelectedId(null);
      bottomSheetRef.current?.snapToIndex(0);
      return true;
    } catch {
      return false;
    }
  }

  // ★ 핵심 수정: Kakao Local API 호출 에러 로깅/가이드 강화
  async function searchPlace(keyword: string) {
    try {
      if (!KAKAO_REST_API_KEY) {
        Alert.alert(
          'Kakao REST 키 없음',
          'KAKAO_REST_API_KEY가 비어 있습니다. .env에 REST API 키를 넣고 앱을 다시 빌드하세요.',
        );
        return;
      }

      const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(
        keyword,
      )}`;
      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `KakaoAK ${KAKAO_REST_API_KEY}` },
      });

      // 상태코드별 상세 처리
      if (!res.ok) {
        const text = await res.text();
        console.warn('[KAKAO LOCAL] status:', res.status, 'body:', text);
        if (res.status === 401 || res.status === 403) {
          Alert.alert(
            '키/권한 오류',
            'Kakao REST API 키가 잘못되었거나 Local API 사용이 비활성화되었습니다.\n' +
              '1) .env에 REST 키가 맞는지 확인\n' +
              '2) 카카오 개발자 콘솔에서 “로컬(Local)” API 약관 동의/활성화\n' +
              '3) 키 재발급/재빌드 후 테스트',
          );
        } else if (res.status === 429) {
          Alert.alert(
            '요청 제한',
            'Kakao Local API 쿼터를 초과했습니다. 잠시 후 다시 시도하세요.',
          );
        } else {
          Alert.alert(
            '검색 실패',
            `장소 검색 중 오류가 발생했습니다. (HTTP ${res.status})`,
          );
        }
        return;
      }

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
        id: String(place.id),
        name: place.place_name,
        location: place.address_name,
        lat,
        lng,
      });

      setSelectedPlace(null);
      setSaveModalVisible(true);
      bottomSheetRef.current?.snapToIndex(1);
    } catch (e) {
      console.warn('searchPlace error:', e);
      Alert.alert('검색 실패', '장소 검색 중 예외가 발생했습니다.');
    }
  }

  function derivePlaceName(p?: {
    name?: string;
    location?: string;
    lat?: number;
    lng?: number;
  }) {
    const cand =
      (p?.name && p.name.trim()) || (p?.location && p.location.trim());
    if (cand) return cand;
    if (typeof p?.lat === 'number' && typeof p?.lng === 'number') {
      return `장소 ${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`;
    }
    return '장소';
  }

  function confirmSavePlace() {
    if (!searchResultPlace) return;
    const p: PlaceItem = {
      ...searchResultPlace,
      name: derivePlaceName(searchResultPlace),
    };

    setSavedPlaces(prev => {
      if (prev.find(sp => sp.id === p.id)) return prev;
      return [...prev, p];
    });

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
  
  // 동물 정보에서 로컬 이미지 찾는 헬퍼
  function getLocalAnimalImage(info: AnimalInfo | null): any | undefined {
    if (!info) return undefined;
    const keys: string[] = [];

    if (info.name) {
      keys.push(info.name.trim(), info.name.trim().toLowerCase());
    }
    if (info.english) {
      keys.push(info.english.trim(), info.english.trim().toLowerCase());
    }

    for (const key of keys) {
      const img = ANIMAL_IMAGES[key];
      if (img) return img;
    }
    return undefined;
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
      const res = await fetch(`${API_BASE}/search-history/${id}/`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error(`삭제 실패: ${res.status}`);
      await fetchHistory();
      if (selectedId === id) setSelectedId(null);
    } catch {
      Alert.alert('삭제 실패', '검색 기록 삭제 중 오류가 발생했습니다.');
    }
  };

  async function moveToCurrentLocation() {
    const status = await ensureLocationPermissionDetailed();

    if (status === 'blocked') {
      setLocationModalVisible(true);
      return;
    }
    if (status !== 'granted') {
      Alert.alert(
        '권한 필요',
        '현재 위치를 사용하려면 위치 권한이 필요합니다.',
      );
      return;
    }

    Geolocation.getCurrentPosition(
      position => {
        const { latitude, longitude, accuracy } = position.coords;

        setCurrentLocation({ lat: latitude, lng: longitude });

        const payload = JSON.stringify({
          lat: latitude,
          lng: longitude,
          accuracy: typeof accuracy === 'number' ? accuracy : null,
        });

        const js = `
          (function () {
            try {
              if (window.setMyLocation) {
                const d = ${payload};
                window.setMyLocation(d.lat, d.lng, d.accuracy);
              }
            } catch (e) { console.log('inject err', e); }
            true;
          })();
        `;
        mapRef.current?.injectJavaScript(js);
      },
      err => {
        console.warn('geo error', err);
        Alert.alert('오류', '현재 위치를 가져올 수 없습니다.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  }

  function openAppSettings() {
    Linking.openSettings().catch(() => {
      Alert.alert(
        '오류',
        '설정을 열 수 없습니다. 직접 앱 설정에서 권한을 허용해 주세요.',
      );
    });
  }
  

  // =================== ★ NEW: 배너 수신 로직 (WS + 폴링) ===================
  function scheduleAutoHide(msEpoch?: number | null) {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (!msEpoch) return;
    const delay = Math.max(0, msEpoch - Date.now());
    hideTimerRef.current = setTimeout(() => {
      setBannerMessage(null);
      setBannerHideUntil(null);
    }, delay);
  }

  // 서로 다른 백엔드 키를 받아 공통 포맷으로 맞춤
  function normalizeBanner(obj: any): BannerPayload | null {
    if (!obj) return null;
    const text =
      obj.text ??
      obj.message ?? // 대시보드가 message로 줄 수 있음
      obj.content ??
      obj.title ??
      null;
    const until =
      obj.until ??
      obj.expires_at ?? // 만료 필드 명 대체
      obj.expireAt ??
      null;
    const ttlSeconds = obj.ttlSeconds ?? obj.ttl ?? null;

    return text ? { text: String(text), until, ttlSeconds } : null;
  }
  // ★ NEW: 서버 응답에서 실제 배너 오브젝트 꺼내기
  function extractBannerRoot(obj: any): any {
    if (!obj) return null;

    // 1) { data: {...} }
    if (obj.data && typeof obj.data === 'object') {
      return obj.data;
    }

    // 2) { result: {...} } / { banner: {...} } 같은 경우 대비
    if (obj.result && typeof obj.result === 'object') {
      return obj.result;
    }
    if (obj.banner && typeof obj.banner === 'object') {
      return obj.banner;
    }

    // 3) [ {...} ] 배열로 오는 경우 첫 번째
    if (Array.isArray(obj) && obj.length > 0) {
      return obj[0];
    }

    // 4) 그 외에는 그대로 사용
    return obj;
  }

  function applyBannerPayload(p: BannerPayload) {
    if (!p?.text || typeof p.text !== 'string') return;
    let untilEpoch: number | null = null;
    if (p.until) {
      const t = Date.parse(p.until);
      if (!Number.isNaN(t)) untilEpoch = t;
    } else if (
      p.ttlSeconds &&
      typeof p.ttlSeconds === 'number' &&
      p.ttlSeconds > 0
    ) {
      untilEpoch = Date.now() + p.ttlSeconds * 1000;
    }

    setBannerMessage(p.text);
    setBannerHideUntil(untilEpoch);
    scheduleAutoHide(untilEpoch);

    // 캐시에 저장 → 다음 앱 실행 시 즉시 노출
    saveBannerToCache(p).catch(() => {});
  }

  // 응답을 정규화해서 반영, 그리고 예비 경로도 순차 시도
  async function pollBannerOnce() {
    const candidates = [`${BANNER_POLL_ENDPOINT}`];

    for (const url of candidates) {
      try {
        const r = await authFetch(url, { method: 'GET' });

        // 204 No Content → 활성 배너 없음으로 처리
        if (r.status === 204) {
          // 필요시 현재 배너를 숨기고 끝
          // setBannerMessage(null); setBannerHideUntil(null);
          continue;
        }

        if (!r.ok) continue;

        // 빈 바디 안전 처리
        const text = await r.text();
        if (!text || !text.trim()) {
          // 활성 배너 없음
          continue;
        }

        let j: any = null;
        try {
          j = JSON.parse(text);
        } catch {
          // 서버가 순수 문자열만 줄 수도 있으니 그 자체를 배너로 사용
          applyBannerPayload({ text });
          return;
        }

        const root = extractBannerRoot(j);

        const norm = normalizeBanner(root);
        if (norm) {
          applyBannerPayload(norm);
          return;
        }
      } catch {
        // 다음 후보로
      }
    }
  }

  useEffect(() => {
    // 앱 활성 상태(포그라운드)에서만 유효
    (globalThis as any).SENCITY_POLL_BANNER = async () => {
      try {
        await pollBannerOnce();
      } catch (e) {
        console.warn('[BANNER] poll failed:', e);
      }
    };
    return () => {
      delete (globalThis as any).SENCITY_POLL_BANNER;
    };
  }, []);

  // 폴링 시작/정지
  function startPolling() {
    if (pollingRef.current) return;
    let step = 0;
    const schedule = () => {
      // 0~5회: 5s 간격 → 그 이후: 30s 고정
      const delay = step < 6 ? 5000 : 30000;
      pollingRef.current = setTimeout(async () => {
        await pollBannerOnce();
        step += 1;
        schedule();
      }, delay);
    };
    pollBannerOnce(); // 즉시 1회
    schedule();
  }
  function stopPolling() {
    if (pollingRef.current) {
      clearTimeout(pollingRef.current as any);
      pollingRef.current = null;
    }
  }

  function startBannerWs() {
    const wsUrl = toWsUrl(API_BASE, BANNER_WS_PATH);
    if (!wsUrl) {
      startPolling();
      return;
    }
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        // WS가 열리면 폴링 중지
        // stopPolling();
      };
      ws.onmessage = ev => {
        try {
          const data = JSON.parse(ev.data);
          if (data?.type === 'banner' && data?.text) {
            applyBannerPayload(data as BannerPayload);
          }
        } catch {
          // 텍스트만 오는 경우 대비
          if (typeof ev.data === 'string' && ev.data.trim()) {
            applyBannerPayload({ text: String(ev.data) });
          }
        }
      };
      ws.onerror = () => {
        // 에러 시 폴링 백업 활성화
        startPolling();
      };
      ws.onclose = () => {
        // 닫히면 폴링 백업, 그리고 10초 후 재시도
        startPolling();
        setTimeout(() => {
          if (!wsRef.current) startBannerWs();
        }, 10000);
      };
    } catch {
      startPolling();
    }
  }

  useEffect(() => {
    // 1) 캐시된 배너를 즉시 표시
    loadBannerFromCache().then(p => {
      if (p) applyBannerPayload(p);
    });
    // 2) 서버에서 최신값 1회 가져오기
    pollBannerOnce();
    // 3) WebSocket은 옵션 – 지금은 끔
    if (ENABLE_BANNER_WS) {
      startBannerWs();
    }

    return () => {
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch {}
        wsRef.current = null;
      }
      stopPolling();
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    };
  }, []);

  // =================== 렌더 ===================
  return (
    <>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <View style={styles.container}>
        <View style={[styles.mapWrapper, { zIndex: 0 }]}>
          <WebView
            ref={mapRef}
            originWhitelist={['*']}
            source={{ html: mapHtml, baseUrl: 'https://localhost' }} // ✅ baseUrl 추가
            style={{ flex: 1 }}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            cacheEnabled={false}
            cacheMode="LOAD_NO_CACHE"
            geolocationEnabled={true}
            // ✅ 외부 접근/파일 접근 허용 (안전한 테스트용)
            allowFileAccess
            allowUniversalAccessFromFileURLs
            // (선택) WebView ↔ 내부 로그 모니터링
            onMessage={e => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg?.type) {
                  console.log('[KAKAO_MSG]', msg);
                }
              } catch {}
            }}
            {...(Platform.OS === 'android'
              ? {
                  // @ts-ignore
                  onGeolocationPermissionsShowPrompt: (
                    _origin: string,
                    callback: (allow: boolean, retain: boolean) => void,
                  ) => {
                    callback(true, true);
                    return true;
                  },
                }
              : null)}
            onLoadEnd={() => {
              mapRef.current?.injectJavaScript(`
                try {
                  if (window.setReportsVisible) window.setReportsVisible(false);
                  if (window.clearReports) window.clearReports();
                } catch(e) { console.log('init clearReports err', e); }
                true;
              `);
              syncSavedMarkers(savedPlaces);
              if (Reports && Reports.length > 0) {
                syncReportsOnWebview(Reports, reportsVisible);
              }
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

              {!!searchResultPlace?.name && (
                <Text style={styles.savePlaceName}>
                  {searchResultPlace?.name}
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

        <Modal
          visible={locationModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLocationModalVisible(false)}
        >
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setLocationModalVisible(false)}
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.saveCard}>
              <View style={styles.saveHeaderRow}>
                <View style={styles.saveIconWrap}>
                  <MaterialIcons name="my-location" size={22} color="#DD0000" />
                </View>
                <Text style={styles.saveTitle}>위치 권한이 꺼져 있어요</Text>
              </View>

              <Text style={styles.saveSubtitle}>
                현재 위치를 사용하려면 앱 설정에서 “위치” 권한을 허용해 주세요.
              </Text>

              <View style={styles.saveActions}>
                <TouchableOpacity
                  onPress={() => setLocationModalVisible(false)}
                  activeOpacity={0.8}
                  style={[styles.btn, styles.btnOutline]}
                >
                  <Text style={[styles.btnText, styles.btnOutlineText]}>
                    나중에
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => {
                    setLocationModalVisible(false);
                    openAppSettings();
                  }}
                  activeOpacity={0.9}
                  style={[styles.btn, styles.btnPrimary]}
                >
                  <Text style={[styles.btnText, styles.btnPrimaryText]}>
                    설정 열기
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <View style={styles.fabGroup}>
          <TouchableOpacity
            style={styles.fabButton}
            onPress={() => {
              if (!Reports || Reports.length === 0) {
                Alert.alert('신고 데이터가 아직 로드되지 않았습니다.');
                return;
              }

              const next = !reportsVisible;
              setReportsVisible(next);

              const safe = Reports;
              const payload = JSON.stringify(safe);

              const js = `
                (function(){
                  if (window.__reportToggleBusy) return true;
                  window.__reportToggleBusy = true;
                  try {
                    if (${next}) {
                      if (window.clearReports) window.clearReports();
                      setTimeout(function(){
                        if (window.setReports) window.setReports(${payload});
                        if (window.setReportsVisible) window.setReportsVisible(true);
                        ${
                          !hasFocusedOnceRef.current
                            ? 'if (window.focusReports) window.focusReports();'
                            : ''
                        }
                      }, 250);
                    } else {
                      if (window.clearReports) window.clearReports();
                      if (window.setReportsVisible) window.setReportsVisible(false);
                    }
                  } catch(e){
                    console.log('report toggle err', e);
                  }
                  window.__reportToggleBusy = false;
                  true;
                })();
              `;
              mapRef.current?.injectJavaScript(js);

              if (next && !hasFocusedOnceRef.current) {
                hasFocusedOnceRef.current = true;
              }
            }}
          >
            <Image source={LOGO} style={styles.fabLogo} resizeMode="contain" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.fabButton}
            onPress={moveToCurrentLocation}
          >
            <MaterialIcons name="place" size={27} color="#DD0000" />
          </TouchableOpacity>
        </View>

        {/* ★ NEW: 배너 — 메시지가 있을 때만 렌더 */}
        {bannerMessage && (
          <Animated.View style={[bannerAnimatedStyle, { zIndex: 9999 }]}>
            <View style={styles.banner}>
              <Text
                style={styles.bannerText}
                numberOfLines={1} // 두 줄까지 허용
                ellipsizeMode="tail" // 넘치면 뒤쪽 ... 처리
              >
                {bannerMessage}
              </Text>
            </View>
          </Animated.View>
        )}

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
                            <Text style={styles.placeTitle}>{item.name}</Text>
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

                    {(() => {
                      const localImg = getLocalAnimalImage(animalInfo);

                      // 1순위: 로컬 assets 이미지
                      if (localImg) {
                        return (
                          <Image
                            source={localImg}
                            style={styles.animalImage}
                            resizeMode="cover"
                          />
                        );
                      }

                      // 2순위: 백엔드에서 받은 URL (기존 로직 유지)
                      if (animalImgUri) {
                        return (
                          <Image
                            source={{ uri: animalImgUri }}
                            style={styles.animalImage}
                            resizeMode="cover"
                            onError={() => {
                              if (
                                animalImgUri.includes('/image-proxy/') &&
                                candidate
                              ) {
                                setAnimalImgUri(candidate);
                              } else {
                                setAnimalImgUri(undefined);
                              }
                            }}
                          />
                        );
                      }

                      // 둘 다 없으면 플레이스홀더
                      return (
                        <View
                          style={[
                            styles.animalImage,
                            { alignItems: 'center', justifyContent: 'center' },
                          ]}
                        >
                          <Text style={{ color: '#999' }}>
                            이미지를 불러올 수 없습니다.
                          </Text>
                        </View>
                      );
                    })()}
                    <Text style={styles.animalSectionTitle}>특징</Text>
                    <View style={{ marginLeft: 8, marginBottom: 12 }}>
                      {toArray(animalInfo.features).map((txt, i) => (
                        <Text key={i} style={styles.animalFeature}>
                          • {txt}
                        </Text>
                      ))}
                    </View>
                    <Text style={styles.animalSectionTitle}>대처법</Text>
                    <View style={{ marginLeft: 8 }}>
                      {toArray(animalInfo?.precautions).map((txt, i) => (
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
  container: { flex: 1, backgroundColor: '#f4f1ea' },
  mapWrapper: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  dropdownBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    backgroundColor: 'transparent',
  },
  searchBarWrapper: {
    position: 'absolute',
    top: STATUSBAR_HEIGHT + 5,
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
  fabButtonActive: { borderWidth: 2, borderColor: '#DD0000' },
  fabLogo: { width: 41, height: 37, borderRadius: 8 },

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
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  bannerText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#222',
  },
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
