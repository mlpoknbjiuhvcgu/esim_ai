@echo off
setlocal

cd /d C:\Users\user\Documents\esim_ai

REM 由 Python logging 自己寫 logs\scraper.log（含輪轉）
py chictrip_scraper.py
exit /b %errorlevel%
