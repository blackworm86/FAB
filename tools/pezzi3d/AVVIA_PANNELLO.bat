@echo off
rem ==========================================================================
rem  FAB · pezzi 3D - avvio del pannello
rem  Doppio clic su questo file:
rem   - chiude un eventuale pannello gia' aperto (anche di una versione vecchia)
rem   - la prima volta installa Python (se manca) e le librerie del kit
rem   - avvia il pannello e lo apre nel browser
rem  Lascia aperta questa finestra mentre lavori. Per chiudere: chiudi la
rem  finestra, oppure FERMA_PANNELLO.bat, oppure il pulsante nel pannello.
rem ==========================================================================
setlocal
cd /d "%~dp0"
title FAB · pezzi 3D - Pannello

echo Chiudo un eventuale pannello gia' aperto...
call "%~dp0strumenti\ferma_porta.bat" 8078

set "VENV_PY=%~dp0.venv\Scripts\python.exe"
if exist "%VENV_PY%" goto librerie

echo.
echo Prima configurazione: cerco Python...
set "PYBASE="
py -3 -c "import sys; assert sys.version_info >= (3, 10)" >nul 2>nul && set "PYBASE=py -3"
if defined PYBASE goto crea_venv
python -c "import sys; assert sys.version_info >= (3, 10)" >nul 2>nul && set "PYBASE=python"
if defined PYBASE goto crea_venv

echo Python non trovato: lo installo con winget (Python 3.12, solo per il tuo utente)...
winget install -e --id Python.Python.3.12 --scope user --silent --accept-package-agreements --accept-source-agreements
set "PYBASE=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
if exist "%PYBASE%" goto crea_venv
echo.
echo Non sono riuscito a installare Python automaticamente.
echo Installalo da https://www.python.org/downloads/ (spunta "Add python.exe to PATH")
echo e poi fai di nuovo doppio clic su questo file.
pause
exit /b 1

:crea_venv
echo Creo l'ambiente Python del kit nella cartella .venv ...
%PYBASE% -m venv "%~dp0.venv"
if not exist "%VENV_PY%" "%PYBASE%" -m venv "%~dp0.venv"
if not exist "%VENV_PY%" (
    echo Creazione dell'ambiente non riuscita.
    pause
    exit /b 1
)

:librerie
echo Controllo le librerie del kit...
"%VENV_PY%" -m pip install --disable-pip-version-check -q --upgrade pip
"%VENV_PY%" -m pip install --disable-pip-version-check -q -r "%~dp0strumenti\requisiti.txt"
if errorlevel 1 (
    echo Installazione delle librerie non riuscita: controlla la connessione e riprova.
    pause
    exit /b 1
)

set "APRI=--apri"
:avvio
echo.
echo Avvio il pannello. Lascia aperta questa finestra.
"%VENV_PY%" "%~dp0strumenti\server_pannello.py" %APRI%
rem codice 3 = riavvio chiesto dal pannello: ricarica il codice aggiornato
if errorlevel 3 if not errorlevel 4 (
    set "APRI="
    echo Riavvio in corso...
    "%VENV_PY%" -m pip install --disable-pip-version-check -q -r "%~dp0strumenti\requisiti.txt"
    goto avvio
)
echo.
echo Il pannello e' stato chiuso.
pause
