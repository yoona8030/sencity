@echo off
cd /d C:\Users\a9349\sencity

echo [STEP 1] Wi-Fi IPv4 기반으로 .env(API_BASE_URL) 자동 갱신...
powershell -ExecutionPolicy Bypass -File .\scripts\update_api_url.ps1
if errorlevel 1 (
    echo [X] .env 갱신 실패. 위 메시지를 확인하세요.
    pause
    exit /b 1
)

echo [STEP 2] 백엔드 서버 실행 창을 띄웁니다...
start cmd /k "cd /d C:\Users\a9349\sencity_backend && call venv311\Scripts\activate.bat && python manage.py runserver 0.0.0.0:8000"

echo [STEP 3] RN Metro + Android 앱 실행...
call .\scripts\run_app.bat
