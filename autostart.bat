@echo off
setlocal
cd /d C:\Users\user\Documents\esim_ai

set "LOG_DIR=%CD%\logs"
set "LOG_FILE=%LOG_DIR%\webapp.log"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

REM 1. Ollama 沒跑就啟動
tasklist /FI "IMAGENAME eq ollama app.exe" 2>NUL | find /I "ollama app.exe" >NUL
if errorlevel 1 (
    start "" "C:\Users\user\AppData\Local\Programs\Ollama\ollama app.exe"
    timeout /t 8 /nobreak >NUL
)

REM 2. 啟動 uvicorn，所有輸出寫 webapp.log
echo. >> "%LOG_FILE%"
echo ============================================ >> "%LOG_FILE%"
echo [%date% %time%] autostart 啟動 webapp >> "%LOG_FILE%"
echo ============================================ >> "%LOG_FILE%"
py -m uvicorn webapp.server:app --port 8000 --log-level info >> "%LOG_FILE%" 2>&1
