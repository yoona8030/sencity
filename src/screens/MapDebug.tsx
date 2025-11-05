import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, StatusBar } from 'react-native';
import { WebView } from 'react-native-webview';
import { KAKAO_JS_KEY } from '@env';

const getHtml = () => `
<!doctype html>
<html>
<head>
<meta charset="utf-8"/>
<title>Kakao Debug</title>
<style>html,body,#map{margin:0;padding:0;width:100vw;height:100vh}</style>
</head>
<body>
<div id="map"></div>
<script>
(function(){
  var RNW = window.ReactNativeWebView;
  function post(type, extra){
    try{ RNW && RNW.postMessage(JSON.stringify(Object.assign({type}, extra||{}))); }catch(e){}
  }
  function initKakao(){
    try{
      if(!window.kakao || !kakao.maps || !kakao.maps.load){
        post('KAKAO_NOT_READY',{ href: location.href, origin: location.origin });
        return;
      }
      kakao.maps.load(function(){
        try{
          var map = new kakao.maps.Map(document.getElementById('map'), {
            center: new kakao.maps.LatLng(37.5665,126.9780), level: 3
          });
          window.__map = map;
          post('KAKAO_READY', { ok:true });
        }catch(e){ post('KAKAO_INIT_ERROR', { error: String(e) }); }
      });
    }catch(e){ post('KAKAO_LOAD_WRAPPER_ERROR', { error: String(e) }); }
  }
  // 재시도용 훅
  window.__retry = initKakao;

  var img = new Image();
    img.onload  = function(){ post('DAPI_FAVICON_LOAD', { reachable: true }); };
    img.onerror = function(){ post('DAPI_FAVICON_LOAD', { reachable: false }); };
    img.src = 'https://dapi.kakao.com/favicon.ico?_t=' + Date.now();

  // SDK 동적 로드
  var s = document.createElement('script');
  s.src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services,clusterer,drawing";
  s.async = true; s.defer = true;
  s.onload = function(){ post('SDK_ONLOAD'); initKakao(); };
  s.onerror = function(){ post('KAKAO_SDK_LOAD_ERROR'); };
  document.head.appendChild(s);

  // 3초 후에도 kakao가 없으면 힌트
  setTimeout(function(){
    post('CHECK', { hasKakao: !!window.kakao, href: location.href, origin: location.origin });
  }, 3000);
})();
</script>
</body>
</html>
`;

export default function MapDebug(){
  const webRef = useRef<WebView>(null);

  return (
    <View style={{flex:1}}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content"/>
      <WebView
        ref={webRef}
        source={{ html: getHtml(), baseUrl: 'https://localhost' }}  // ★ baseUrl 필수
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        onMessage={(e)=>{
          try{
            const msg = JSON.parse(e.nativeEvent.data);
            console.log('[KAKAO_DEBUG]', msg);
            if (msg?.type && msg.type !== 'CHECK') {
              Alert.alert('WebView 메시지', `${msg.type}\n${JSON.stringify(msg).slice(0,200)}`);
            }
          }catch{}
        }}
        onError={(ev)=>console.warn('WebView error', ev.nativeEvent)}
      />

      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.btn}
          onPress={()=> webRef.current?.injectJavaScript(`
            (function(){
              var info = { hasKakao: !!window.kakao, hasMaps: !!(window.kakao&&kakao.maps), origin: location.origin, href: location.href };
              window.ReactNativeWebView.postMessage(JSON.stringify({type:'PING', info:info}));
              true;
            })();
          `)}
        >
          <Text style={styles.btnText}>SDK 존재 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btn}
          onPress={()=> webRef.current?.injectJavaScript(`window.__retry && window.__retry(); true;`)}>
          <Text style={styles.btnText}>지도 초기화 재시도</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const STATUSBAR = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
const styles = StyleSheet.create({
  toolbar:{
    position:'absolute', top: STATUSBAR + 10, left:10, right:10, flexDirection:'row', gap:10
  },
  btn:{
    backgroundColor:'#222', paddingHorizontal:12, paddingVertical:10, borderRadius:8
  },
  btnText:{ color:'#fff', fontWeight:'700' }
});
