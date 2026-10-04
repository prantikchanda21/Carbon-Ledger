@echo off
setlocal EnableExtensions
cd /d "%~dp0"

title Dual-Engine Carbon ^& Treasury Controller v5 - Local

echo.
echo ============================================================
echo   Dual-Engine Carbon ^& Treasury Controller v5
echo   LOCAL Next.js + Qiskit simulator
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
where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python is not installed or not on PATH.
  echo Install Python 3.12-3.14 and run this file again.
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
) else (
  echo [OK] node_modules already installed.
)

if not exist "qiskit_train\.venv\Scripts\python.exe" (
  echo [SETUP] Creating Qiskit virtual environment...
  python -m venv "qiskit_train\.venv"
  if errorlevel 1 (
    echo [ERROR] Could not create the Qiskit virtual environment.
    pause
    exit /b 1
  )
)

call "qiskit_train\.venv\Scripts\python.exe" -c "import qiskit; print('Qiskit', qiskit.__version__)"
if errorlevel 1 (
  echo [SETUP] Installing Qiskit dependencies...
  call "qiskit_train\.venv\Scripts\python.exe" -m pip install -r requirements.txt
  if errorlevel 1 (
    echo [ERROR] Qiskit installation failed.
    pause
    exit /b 1
  )
)

call "qiskit_train\.venv\Scripts\python.exe" -c "import qiskit; print('[OK] Qiskit', qiskit.__version__)"
if errorlevel 1 (
  echo [ERROR] Qiskit still cannot be imported from the project virtual environment.
  echo Check the Python installation and the pip output above.
  pause
  exit /b 1
)

if not exist ".env.local" if exist ".env.example" (
  echo [SETUP] Creating .env.local from .env.example...
  copy /Y ".env.example" ".env.local" >nul
)

set NEXT_TELEMETRY_DISABLED=1
set NEXT_PUBLIC_QUANTUM_LOCAL=1
set QUANTUM_PYTHON_PATH=%CD%\qiskit_train\.venv\Scripts\python.exe

echo.
echo [READY] Local Qiskit simulator uses a per-request Python process.
echo [READY] No separate port 8765 helper is required.
echo.
echo [START] Launching Next.js on http://localhost:3000 ...
start "Carbon Treasury - Browser" http://localhost:3000
call npm run dev
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" echo [ERROR] Next.js exited with code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%
