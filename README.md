## SENCITY
### 도심 내 야생동물 출현 신고 알림 및 신고 앱

#### 1. 주제 선정 배경
: 무분별한 산간 개발 등으로 서식지 파괴, 먹이 부족 현상이 증가함으로 인해 야생동물의 출현 빈도가 증가하고 있음. 하지만, 이를 신고하거나 주변에 알릴 수 있는 수단이 부족하다고 판단하여, 누구나 쉽고 빠르게 위험 정보를 공유할 수 있는 모바일 플랫폼을 구축하고자 함

#### 2. 과제의 목적
+ 도심 내 야생동물 출현 시 사용자에게 알림 전송하여 통계와 알림을 통해 위험정보를 공유
+ 전염병 감염이 있는 야생동물에 대한 정보 제공
+ 상황별 대처 요령을 제공하여 2차 피해 예방
+ 사용자의 신고와 IoT 센서를 통해 데이터를 수집하고, AI 모델로 분석하여 지역별 위험도 시각화

#### 3. 핵심 기능
+ 신고하기: 사진/위치 기반 신고 등록
+ 통계/지도 시각화: 동물별, 지역별 통계 차트 제공
+ 알림/공지 전갈: 위험 지역 사용자에게 FCM 푸시 알림 제공
+ AI 인식: 카메라 활영 이미지에서 동물 종 분류

#### 4. 기술 스택
+ 프론트엔드: React Native, TypeScript 기반 모바일 앱
  + 카메라 액세스, 위치 수집, 푸시 알림 기능
+ 백엔드: Django, Django REST Framework
  + REST API 제공, 사용자 인증(JWT), 비즈니스 로직 처리
+ 데이터베이스: SQLite
  + 사용자/신고/위치 데이터 저장, Django ORM 기반
+ AI 분석: TensorFlow(Keras EfficientNet-B0), OpenCV, Pillow
  + 동물 이미지 분류, CCTV 연동
  + 정확도, 속도, 모델 크기 사이 최적의 균형 찾도록 설계 -> 적은 파라미터로 높은 성능 달성 가능 
+ IoT 장치
  + CCTV -> 영상 촬영 및 서버 전송
  + Arduino -> 센서, 카메라 제어
+ 외부 서비스
  + Firebase Cloud Messaging (FCM): 지역 사용자 대상 실시간 푸시 알림
  + Kakao Map API: 위치 검색 및 지도 시각화 (WebView 기반 연동)
+ 개발/배포 도구: GitHub

#### 5. 데이터베이스
  + ORM 모델 - 주요 테이블
    + users_user: 사용자
    + api_report: 신고(사진/좌표/시간/분류결과)
    + api_location: 행정구역
    + api_animal: 동물(이름/사진/특징/주의/대처방법)
    + api_notification: 공지/알림 피드
    + api_devicetoken: 디바이스 FCM 토큰(유저별 다중)
    + api_saveplace: 사용자가 저장한 장소(앱 -> 서버 동기화)
    + api_searchhistory: 검색 기록(유저별 고유 키워드)
    + api_appbanner: 지도 화면 배너(기간, 우선순위)

  + 마이그레이션/슈퍼유저
  ```
  python manage.py makemigrations
  python manage.py migrate
  python manage.py createsuperuser
  ```  
#### 6. IoT/Arduino & CCTV 파이프라인
+ 아키텍처 개요:
```
[Arduino 카메라] --(이미지/센서데이터 업로드)--> [Django API]
   └ 센서 이벤트 시 캡처 → POST /api/reports/no-auth (또는 별도 ingest 엔드포인트)
[백엔드] --(TensorFlow 모델 inference)--> 종 분류 → Report 저장
[FCM] 위험도/구역 매칭 시 대상 유저에 푸시
[앱] 지도/배너/공지 피드에 반영
```

#### 7. AI 모델/성능 메모
+ 모델: EfficientNet-B0 (Keras/TensorFlow SavedModel)
+ 클래스 10(고라니/멧돼지/청설모/...)
+ 추론 파이프라인: Pillow/OpenCV -> resize/normalize -> SaveModel 호출
+ 이유: 파라미터 수 대비 정확도 우수 + 모바일/서버 유지 쉬움
+ 배포: sencity_classification_model/models/animal_classifier_savedmodel에서 로드

#### 8. 설치 및 실행 방법
+ 백엔드(Django) -- 윈도우 환경
```
REM 1) 백엔드 폴더로 이동

cd sencity_backend

REM 2) 가상환경 생성/활성화

py -3.11 -m venv venv311

venv311\Scripts\activate

REM 3) 의존성 설치 (clean 파일 사용 권장)

python -m pip install -r requirements.clean.txt

REM clean 파일이 없다면: python -m pip install -r requirements.txt

REM 4) 환경파일 예시 복사(없으면 건너뛰기)

if not exist .env copy .env.example .env

REM 5) 마이그레이션

python manage.py migrate

REM 6) 서버 실행 (외부 접속 허용)

python manage.py runserver 0.0.0.0:8000
```

+ 프론트엔드(React Native) 실행
```
REM 1) 프론트엔드 폴더로 이동

cd ..\sencity

REM 2) 의존성 설치

npm i

REM 3) 환경파일 준비

copy .env.example .env

REM 4) (실기기/USB 연결 또는 에뮬레이터) 백엔드 포워딩

adb reverse tcp:8000 tcp:8000

REM 5) (선택) 캐시 초기화 – 빌드 꼬임 방지

npx react-native start --reset-cache

REM 6) 실행 (Android)

npm run android
```
#### 9. 환경변수
+ 백엔드(sencity_backend/.env.example)
```
REM 1) 필수

SECRET_KEY=dev-secret-for-judge

REM 2) 선택(기본값 존재)

DEBUG=True
ALLOWED_HOSTS=127.0.0.1,localhost

CORS_ALLOW_ALL_ORIGINS=True
```

+ 프론트엔드(sencity_backend/.env.example)
```  
API_BASE_URL=http://127.0.0.1:8000/api
KAKAO_JS_KEY=b546dc26850ac5793ef1561229a7e072
KAKAO_REST_API_KEY=fc44c60ee56cd12cbe85e1a9d5c337e0
```
#### 10. API 퀵 레퍼런스

Base URL: http://127.0.0.1:8000/api
Auth: Authorization: Bearer <access_token> (JWT)

**Base URL**: `http://127.0.0.1:8000/api`  
**Auth**: `Authorization: Bearer <access_token>` (JWT)

### 요약

| 메서드 | 경로                          | 설명                           | 인증   |
|-------|-------------------------------|--------------------------------|--------|
| GET   | `http://127.0.0.1:8000/health/` | 서버 상태 체크 (루트 경로)      | -      |
| POST  | `/auth/token/`                | JWT 토큰 발급                   | -      |
| POST  | `/auth/token/refresh/`        | JWT 갱신                        | -      |
| GET   | `/reports/`                   | 신고 목록 조회(필터 지원)       | Bearer |
| POST  | `/reports/`                   | 신고 생성(사진/위치 업로드)     | Bearer |
| GET   | `/stats/summary/`             | 동물/지역 통계 요약             | Bearer |

---

### JWT 발급
```bash
curl -X POST http://127.0.0.1:8000/api/auth/token/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"pass1234"}'
```

++ 성공 예시 : {"access":"<...>","refresh":"<...>"}

+ JWT 갱신
```
curl -X POST http://127.0.0.1:8000/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh":"<refresh_token_here>"}'
```

+ 신고 목록 조회
```
curl "http://127.0.0.1:8000/api/reports/?ordering=-created_at&page=1" \
  -H "Authorization: Bearer <access>"
```

+ 통계 요약
```
curl "http://127.0.0.1:8000/api/stats/summary/?date_after=2025-07-01&date_before=2025-10-01" \
  -H "Authorization: Bearer <access>"
```

#### 11. 디렉터리 구조
```bash
sencity_backend/ # Django 백엔드
├─ api/ # DRF 앱 (모델/시리얼라이저/뷰)
├─ inquiries/ # 문의/게시 공지
├─ dashboard/ # 관리자/통계 대시보드
├─ manage.py
├─ requirements*.txt
└─ sencity_backend/
├─ settings.py
├─ urls.py
└─ utils/renderers.py

sencity/ # React Native 프론트
├─ src/
│ ├─ api/ # axios 클라이언트
│ ├─ components/ # UI 컴포넌트
│ ├─ screens/ # 신고/지도/통계 화면
│ ├─ config.ts # 환경값 단일 진입점
│ └─ types/env.d.ts # @env 타입 선언
├─ android/
├─ ios/
├─ .env.example
└─ package.json
```

#### 12. 관리자 대시보드(HTML/CSS 기반)
+ 개요
운영자가 신고 접수/처리, 사용자/디바이스 관리, 공지/푸시 발송, 콘텐츠 템플릿 발행, 통계/지도 시각화를 한 곳애서 수행하는 웹 UI

Django 템플릿 기반의 dashboard 앱과 DRF API(api 앱)가 함께 동작
  + 인증/권한: Django 세션 로그인 + IsAdminUser 또는 Staff 권한

+ 주요 화면 & 기능
  + 대시보드 홈
    + 신고 현황, 실시간 CCTV 등 요약
  + CCTV 관리
    + CCTV 스트림 연결(테스트/데모)
  + 신고 처리 및 관리
    + 최근 신고 현황
  + 통계/분석
    + 신고 현황
    + 동물 통계, 지역 X 동물 교차표, 월별 신고
  + 공지/푸시
    + 전체 공지: Notification 작성 -> FCM 푸시 옵션 선택 가능
    + 앱 "공지 화면"에 노출 + 푸시
    + 화면 상단 노출 -> 앱 외부에서도 확인 가능
  + 콘텐츠 템플릿
    + 추천 템플릿(공지/안전 수칙/..) -> 미리보기 -> 템플릿으로 작성
    + 생성한 공지 템플릿은 지도 화면 내 배너로 사용 가능
    
#### 13. 트러블 슈팅
+ 지도 안 보임(흰 화면)
  + 카카오 JS SDK는 허용 도메인에 현재 접속 URL이 등록되어 있어야 로드
  + .env의 KAKAO_JS_KEY가 비어있으면 SDK 초기화에 실패 → 키 추가 후 재빌드 필요(환경 변수는 빌드 타임 주입)
+ 프론트가 API에 못 붙음
  + 실기기/에뮬레이터에서 127.0.0.1:8000을 치면 기기 자신을 보게 됨
  + adb reverse tcp:8000 tcp:8000으로 기기의 8000 -> PC의 8000을 터널링
  + 추가 점검: 백엔드가 실제 켜져 있는지 http://127.0.0.1:8000/health/  200 응답 확인
+ JWT 인증 오류
  + Access 토큰 만료/형식 오류/헤더 누락
  + 만료면 POST /auth/token/refresh/로 새 Access 토큰 발급 후 Authorization: Bearer <access>로 재시도
  + 요청 헤더에 Bearer가 맞는지 재확인
  
#### 14. 보안/제출 가이드
+ 키: .env.example만 포함
+ kakao 키: 테스트 앱(심사용) 키 사용 -> 제출 후 키 회전/삭제
+ 라이선스: requirements.txt/package.json 참고

#### 15. 연락/문의
+ 팀명: F4
+ 신지윤(summerand000@gmail.com): 프로젝트 설계, 분류모델 구현 및 학습, IP 카메라 연동
+ 박윤아(ya8030@naver.com): DB 구현, 백엔드 서버 구현, 프론트엔드 코딩
+ 윤누리(yun14097@gmail.com): 프론트엔드 코딩, DB

