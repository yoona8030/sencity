# scripts/update_api_url.ps1
# 1) 현재 Wi-Fi IPv4 주소 구하기
$wifi = Get-NetIPAddress -AddressFamily IPv4 `
         | Where-Object { $_.InterfaceAlias -like "*Wi-Fi*" -and $_.IPAddress -notlike "169.*" } `
         | Select-Object -First 1

if (-not $wifi) {
    Write-Host "[-] Wi-Fi IPv4 주소를 찾지 못했습니다." -ForegroundColor Red
    exit 1
}

$ip = $wifi.IPAddress
Write-Host "[+] 감지된 Wi-Fi IPv4 = $ip"

# 2) .env 경로 지정
$envPath = "C:\Users\a9349\sencity\.env"

if (-not (Test-Path $envPath)) {
    Write-Host "[-] .env 파일을 찾을 수 없습니다: $envPath" -ForegroundColor Red
    exit 1
}

# 3) .env에서 API_BASE_URL 라인만 현재 IP로 교체
$lines = Get-Content $envPath
$found = $false

$newLines = $lines | ForEach-Object {
    if ($_ -match "^API_BASE_URL=") {
        $found = $true
        "API_BASE_URL=http://$ip:8000/api"
    } else {
        $_
    }
}

if (-not $found) {
    # 기존에 API_BASE_URL 줄이 없으면 맨 끝에 추가
    $newLines += "API_BASE_URL=http://$ip:8000/api"
}

$newLines | Set-Content $envPath -Encoding UTF8

Write-Host "[+] .env 갱신 완료:"
Write-Host "    API_BASE_URL=http://$ip:8000/api"
