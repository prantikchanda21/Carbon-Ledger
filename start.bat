@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Dual-Engine Carbon ^& Treasury Controller - Local Launcher

:MENU
cls
echo.
echo ============================================================
echo   Dual-Engine Carbon ^& Treasury Controller
echo   LOCAL-FIRST DEVELOPMENT LAUNCHER
echo ============================================================
echo.
echo   1. Full local stack (Next.js + Qiskit simulator helper)
echo   2. Next.js only (no Qiskit helper)
echo   3. Full Vercel local emulator (no deployment)
echo   4. Exit
echo.
choice /C 1234 /N /M "Select an option: "
if errorlevel 4 exit /b 0
if errorlevel 3 goto FULL_LOCAL_VERCEL
if errorlevel 2 goto NEXT_LOCAL
if errorlevel 1 goto FULL_LOCAL_QISKIT

:FULL_LOCAL_QISKIT
call "%~dp0start-local.bat"
exit /b %ERRORLEVEL%

:NEXT_LOCAL
cls
echo.
echo ============================================================
echo   Starting Next.js locally (no Vercel deployment)
echo ============================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not available on PATH.
  pause
  exit /b 1
)
if not exist "node_modules\.bin\next.cmd" (
  echo [SETUP] Installing Node.js dependencies...
  set ONNXRUNTIME_NODE_INSTALL=skip
  call npm ci
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)
if not exist ".env.local" if exist ".env.example" copy /Y ".env.example" ".env.local" >nul
set NEXT_TELEMETRY_DISABLED=1
echo [INFO] http://localhost:3000
echo [INFO] Quantum buttons require start-local.bat or option 1.
start "Carbon Treasury Controller - Browser" http://localhost:3000
call npm run dev
set EXIT_CODE=%ERRORLEVEL%
pause
exit /b %EXIT_CODE%

:FULL_LOCAL_VERCEL
cls
echo.
echo ============================================================
echo   Starting FULL LOCAL Vercel emulator
echo   This is local only. Nothing is deployed.
echo ============================================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not available on PATH.
  pause
  exit /b 1
)
if not exist "node_modules\.bin\next.cmd" (
  echo [SETUP] Installing Node.js dependencies...
  set ONNXRUNTIME_NODE_INSTALL=skip
  call npm ci
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)
if not exist ".env.local" if exist ".env.example" copy /Y ".env.example" ".env.local" >nul
where vercel >nul 2>nul
if errorlevel 1 (
  echo [INFO] Vercel CLI not installed globally; using npx.
  start "Carbon Treasury Controller - Browser" http://localhost:3000
  call npx vercel@latest dev
) else (
  start "Carbon Treasury Controller - Browser" http://localhost:3000
  call vercel dev
)
set EXIT_CODE=%ERRORLEVEL%
pause
exit /b %EXIT_CODE%
