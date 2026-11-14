@echo off
rem KumashAi - Windows baslatici. Cift tiklayin.
rem Python 3 gerekir. Python yoksa dist\KumashAi.html dosyasini cift tiklayin.
cd /d "%~dp0"
set PORT=8795
set PY=
where py >nul 2>nul && set PY=py -3
if not defined PY (
  python --version >nul 2>nul && set PY=python
)
if not defined PY goto nopython
start "KumashAi sunucu" /min %PY% app\server.py --port %PORT%
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:%PORT%
exit /b 0

:nopython
echo.
echo Python 3 bulunamadi.
echo.
echo  1) Kurulumsuz kullanim: dist\KumashAi.html dosyasini cift tiklayin.
echo  2) Ya da Python kurun: https://www.python.org/downloads/
echo     Kurulumda "Add python.exe to PATH" kutusunu isaretleyin, sonra bu dosyayi yeniden calistirin.
echo.
pause
exit /b 1
