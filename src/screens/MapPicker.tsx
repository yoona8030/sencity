// src/screens/MapPicker.tsx
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
// .env에 KAKAO_JS_KEY 있으면 사용 (없으면 문자열로 직접 넣어도 됨)
import { KAKAO_JS_KEY } from '@env';

const AS = {
  defaultLat: 'loc_default_lat',
  defaultLng: 'loc_default_lng',
  defaultLabel: 'loc_default_label',
} as const;

type Nav = NativeStackNavigationProp<RootStackParamList, 'MapPicker'>;

type Pin = { lat: number; lng: number } | null;

export default function MapPicker() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<any>();
  const initial = route.params?.initial as
    | { lat: number; lng: number }
    | undefined;

  const webRef = useRef<WebView>(null);
  const [pin, setPin] = useState<Pin>(initial ?? null);

  // Kakao 지도 포함한 HTML (SDK를 외부에서 받아오고, 클릭 시 RN으로 좌표 postMessage)
  const html = useMemo(() => {
    const centerLat = initial?.lat ?? 37.5665;
    const centerLng = initial?.lng ?? 126.978;
    const appkey = (KAKAO_JS_KEY as string) || '여기에_카카오_JS_키';
    // 주의: 반드시 본인 JS 키로 교체
    return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
  />
  <style>
    html, body, #app { height: 100%; margin: 0; padding: 0; }
    #map { width: 100%; height: 100%; }
    .marker {
      width: 30px; height: 30px; border-radius: 50%;
      background: rgba(254,186,21,0.9); border: 2px solid #fff;
      box-shadow: 0 2px 6px rgba(0,0,0,.25);
    }
  </style>
  <script src="https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appkey}&autoload=false"></script>
</head>
<body>
  <div id="app">
    <div id="map"></div>
  </div>
  <script>
    (function() {
      const RN = window.ReactNativeWebView;
      function post(type, payload) {
        RN && RN.postMessage(JSON.stringify({ type, ...payload }));
      }

      kakao.maps.load(function () {
        const container = document.getElementById('map');
        const center = new kakao.maps.LatLng(${centerLat}, ${centerLng});
        const map = new kakao.maps.Map(container, {
          center,
          level: 4,
        });

        let marker = null;
        // 초기 핀
        ${
          initial
            ? `
          marker = new kakao.maps.Marker({ position: center, map });
          post('MAP_READY', { ok: true, lat: ${centerLat}, lng: ${centerLng} });
        `
            : `
          post('MAP_READY', { ok: true });
        `
        }

        // 지도 탭 → 마커 옮기고 RN으로 좌표 전달
        kakao.maps.event.addListener(map, 'click', function(mouseEvent) {
          const latlng = mouseEvent.latLng;
          if (marker) marker.setMap(null);
          marker = new kakao.maps.Marker({ position: latlng, map });
          post('MAP_CLICK', { lat: latlng.getLat(), lng: latlng.getLng() });
        });

        // RN → Web: 좌표로 센터 이동 (필요 시 사용)
        window.mapApi = {
          setCenter(lat, lng) {
            const c = new kakao.maps.LatLng(lat, lng);
            map.setCenter(c);
            if (marker) marker.setMap(null);
            marker = new kakao.maps.Marker({ position: c, map });
          }
        };
      });
    })();
  </script>
</body>
</html>`;
  }, [initial]);

  const onMessage = (e: any) => {
    try {
      const msg = JSON.parse(e?.nativeEvent?.data || '{}');
      if (msg.type === 'MAP_CLICK') {
        setPin({ lat: msg.lat, lng: msg.lng });
      }
      // MAP_READY 등 필요 시 처리 가능
    } catch (err) {
      // ignore
    }
  };

  const save = async () => {
    if (!pin) return;
    await AsyncStorage.multiSet([
      [AS.defaultLat, String(pin.lat)],
      [AS.defaultLng, String(pin.lng)],
      [AS.defaultLabel, ''], // 역지오코딩은 추후 추가
    ]);
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1 }}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.sideLeft}
        >
          <Ionicons name="chevron-back" size={24} color="#000" />
        </Pressable>
        <Text style={styles.headerTitle}>기본 위치 선택</Text>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={styles.sideRight}
        >
          <Ionicons name="close" size={24} color="#000" />
        </Pressable>
      </View>

      {/* WebView (카카오 지도) */}
      <WebView
        ref={webRef}
        originWhitelist={['*']}
        source={{ html }}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        // Android 하드웨어 가속/퍼포먼스 이슈가 있다면 아래 옵션도 고려
        // androidHardwareAccelerationDisabled={false}
        // mixedContentMode="always"
        style={{ flex: 1 }}
      />

      {/* 하단 저장 영역 */}
      <View style={styles.footer}>
        <Text style={styles.coord}>
          {pin
            ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`
            : '지도를 탭해서 위치를 선택하세요'}
        </Text>
        <Pressable
          onPress={save}
          disabled={!pin}
          style={[styles.saveBtn, !pin && { opacity: 0.5 }]}
        >
          <Text style={styles.saveBtnText}>이 위치로 저장</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 48,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  sideLeft: { width: 32, alignItems: 'flex-start', justifyContent: 'center' },
  sideRight: { width: 32, alignItems: 'flex-end', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },

  footer: {
    backgroundColor: '#fff',
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  coord: { color: '#555', marginBottom: 8 },
  saveBtn: {
    backgroundColor: '#FEBA15',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '800' },
});
