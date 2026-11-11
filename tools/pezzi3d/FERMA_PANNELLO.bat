@echo off
rem FAB · pezzi 3D - chiude il pannello (e, se vuoi, anche TRELLIS)
cd /d "%~dp0"
echo Chiudo il pannello...
call "%~dp0strumenti\ferma_porta.bat" 8078
echo Fatto.
choice /C SN /N /M "Vuoi fermare anche TRELLIS? [S/N] "
if errorlevel 2 goto fine
call "%~dp0strumenti\ferma_porta.bat" 7960
echo TRELLIS fermato.
:fine
timeout /t 3 >nul
