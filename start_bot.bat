@echo off
title MAKER BOT (24/7 ONLINE)
cd /d "%~dp0"
echo ====================================================
echo 🚀 TELEGRAM BOT KONSTRUKTORI ISHGA TUSHMOQDA...
echo ====================================================
"C:\Program Files\nodejs\node.exe" index.js
if %errorlevel% neq 0 (
  echo Bot xatolik tufayli to'xtadi. Qayta ishga tushirilmoqda...
  timeout /t 3
  "C:\Program Files\nodejs\node.exe" index.js
)
pause
