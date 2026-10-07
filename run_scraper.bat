@echo off
setlocal

set "PROJECT_DIR=C:\Users\user\Documents\esim_ai"
set "LOG_DIR=%PROJECT_DIR%\logs"
set "LOG_FILE=%LOG_DIR%\scraper.log"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

cd /d "%PROJECT_DIR%"

for /f "tokens=1-5 delims=/: " %%a in ("%date% %time%") do (
    set "TS=%%a-%%b-%%c %%d:%%e"
)

echo. >> "%LOG_FILE%"
echo ============================================ >> "%LOG_FILE%"
echo [%TS%] 開始爬取 chictrip eSIM 商品 >> "%LOG_FILE%"
echo ============================================ >> "%LOG_FILE%"

py chictrip_scraper.py >> "%LOG_FILE%" 2>&1
set "RC=%errorlevel%"

echo [%TS%] 完成，exit code = %RC% >> "%LOG_FILE%"

exit /b %RC%
