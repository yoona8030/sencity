# Sencity Frontend
React Native 기반 모바일 앱(Android)

#### 프로젝트 소개
+ 도심 내 야생동물 출현 알림 및 신고 서비스
+ 프로젝트명의 의미: Sensor + City로 도시의 위험을 알리는 센서가 되겠다는 의미를 지님
+ 프로젝트 목표
    + 야생동물 구조: 각 지자체 내 야생동물 구조센터와 공공사업/협업 가능
    + 민간 피해 감소: 접근선/사용성을 높여 1,2차 피해 예방 -> 어린이/청소년 안전 교육 공공 프로젝트 가능성
    + 로드킬 2차 사고 방지: 도로교통 서비스 출현 데이터 및 기능 제공으로 대형 서비스로의 진출 가능성

#### SWOT 분석
+ S
    + AI 기술 발전: 영상인식, 딥러닝 정확도 향상 -> 실시간 사진 분석 기능 -> 즉각적인 출현 알림 제공
    + 위치정보 기술 보편화: GPS/지도 연동이 정교해짐 -> 로드킬 다발 지점/위험 지역 시각화 가능
    + 사회적 필요성 반영: 야생동물 사고 급증으로 기술 활용 필요성이 커짐
+ W
    + 데이터 구축 필요성: AI 활용을 위해선 대규모 사진/영상 데이터 라벨링 필수 -> 초기 비용, 노력이 요구
    + 초기 사용자 기반 부족: 참여가 저조하면 데이터 수집이 지연 -> 알림, 예방 효과가 제한됨
+ O
    + 지자체/환경부 협력 가능
    + 공공기관과 데이터 공유 -> 정책, 관리 지원 가능
    + AI 기술의 발전: YOLO 등 모델 적용 시 동물 분류 및 추적 가능
    + 확장성: 산불, 홍수 등 다른 위협 요소 알림 시스템으로 발전 가능
+ T
    + 데이터 정확성 문제: 잘못된 신고/알림으로 불필요한 경고 발생 가능
    + 야생동물 행동 예측 불확실성: 예측이 어려움 -> 알림 효울성 저하 가능

#### 사전 요구사항
+ Node.js 18 LTS, npm 10+
+ JDK 17, Android Studio Koala (SDK 35)
+ ADB (실기기 테스트 시 필수)

#### 설치 및 실행 방법
+ .env.example 제공
+ 설치 -> 서버 연결 -> 실행 단계

1. 패키지 설치
   ```bash
   npm install

2. 환경 변수 설정
    + cp .env.example .env

3. Run (Android)
    + adb reverse tcp:8000 tcp:8000   # 실기기일 때 필수
    + npx react-native run-android

#### 환경변수
.env.example
```
API_BASE_URL=http://127.0.0.1:8000/api
KAKAO_JS_KEY=__REPLACE_ME__
KAKAO_REST_API_KEY=__REPLACE_ME__
```

#### 폴더 구조
```
src/
 ├─ screens/
 ├─ api/
 ├─ context/
 ├─ state/
 ├─ types/
 ├─ components/
 ├─ utils/
 ├─ navigation/
 ├─ config.ts
 └─ constants.ts
android/
ios/
App.tsx
```

#### 빌드/실행 시 유의사항
+ node_modules/는 제출본에 없음 -> 반드시 npm install
+ Android 실기기 -> adb reverse 필수
