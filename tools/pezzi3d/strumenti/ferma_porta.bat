@echo off
rem Chiude il programma in ascolto sulla porta indicata (8078 pannello, 7960 TRELLIS).
rem Prima chiede al pannello di chiudersi da solo, poi, se serve, lo termina.
set "PORTA=%~1"
if "%PORTA%"=="" set "PORTA=8078"
if "%PORTA%"=="8078" powershell -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -Method Post -Uri http://127.0.0.1:8078/api/ferma -Body '{}' -TimeoutSec 3 | Out-Null; Start-Sleep -Seconds 2 } catch {}" >nul 2>nul
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort %PORTA% -State Listen -ErrorAction SilentlyContinue | ForEach-Object { taskkill /T /F /PID $_.OwningProcess | Out-Null }" >nul 2>nul
exit /b 0
