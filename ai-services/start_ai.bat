@echo off
setlocal EnableDelayedExpansion

echo.
echo ================================================
echo   HireBlind AI Service — Start
echo ================================================
echo.

:: ── Find Python ──────────────────────────────────────────────────────────────
set PYEXE=

py --version >nul 2>&1
if %errorlevel%==0 ( set PYEXE=py & goto :run )

python --version >nul 2>&1
if %errorlevel%==0 ( set PYEXE=python & goto :run )

python3 --version >nul 2>&1
if %errorlevel%==0 ( set PYEXE=python3 & goto :run )

for %%V in (312 311 310 39 38) do (
    for %%P in (
        "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
        "%PROGRAMFILES%\Python%%V\python.exe"
        "C:\Python%%V\python.exe"
        "%USERPROFILE%\AppData\Local\Programs\Python\Python%%V\python.exe"
    ) do (
        if exist %%P ( set PYEXE=%%P & goto :run )
    )
)

echo [ERROR] Python not found. Run install.bat first.
pause
exit /b 1

:run
echo [OK] Using Python: %PYEXE%
%PYEXE% --version
echo.
echo Starting AI service on http://localhost:8001 ...
echo Press Ctrl+C to stop.
echo.
cd /d "%~dp0"
%PYEXE% app.py
pause
