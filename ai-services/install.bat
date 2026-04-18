@echo off
setlocal EnableDelayedExpansion

echo.
echo ================================================
echo   HireBlind AI Service — Dependency Installer
echo ================================================
echo.

:: ── Step 1: Find Python ──────────────────────────────────────────────────────
set PYEXE=

:: Try 'py' launcher first (Windows Python Launcher — most reliable)
py --version >nul 2>&1
if %errorlevel%==0 (
    set PYEXE=py
    echo [OK] Found Python via 'py' launcher:
    py --version
    goto :install
)

:: Try 'python' on PATH
python --version >nul 2>&1
if %errorlevel%==0 (
    set PYEXE=python
    echo [OK] Found Python via 'python':
    python --version
    goto :install
)

:: Try 'python3' on PATH
python3 --version >nul 2>&1
if %errorlevel%==0 (
    set PYEXE=python3
    echo [OK] Found Python via 'python3':
    python3 --version
    goto :install
)

:: Search common Windows install paths
for %%V in (312 311 310 39 38) do (
    for %%P in (
        "%LOCALAPPDATA%\Programs\Python\Python%%V\python.exe"
        "%PROGRAMFILES%\Python%%V\python.exe"
        "%PROGRAMFILES(X86)%\Python%%V\python.exe"
        "C:\Python%%V\python.exe"
        "%USERPROFILE%\AppData\Local\Programs\Python\Python%%V\python.exe"
    ) do (
        if exist %%P (
            set PYEXE=%%P
            echo [OK] Found Python at %%P
            %%P --version
            goto :install
        )
    )
)

echo [ERROR] Python not found! Please install Python 3.9+ from https://python.org
echo         Make sure to check "Add Python to PATH" during installation.
pause
exit /b 1

:install
echo.
echo ── Step 2: Upgrade pip ──────────────────────────────────────────────────
%PYEXE% -m pip install --upgrade pip
echo.

echo ── Step 3: Install all AI service dependencies ──────────────────────────
echo Installing: flask, flask-cors, pdfplumber, PyMuPDF, pdfminer.six,
echo             python-docx, scikit-learn, numpy, spacy, python-dotenv
echo.
%PYEXE% -m pip install ^
    flask ^
    flask-cors ^
    pdfplumber ^
    PyMuPDF ^
    "pdfminer.six" ^
    python-docx ^
    scikit-learn ^
    numpy ^
    spacy ^
    python-dotenv

if %errorlevel% neq 0 (
    echo.
    echo [WARNING] Some packages may have failed. Trying one by one...
    %PYEXE% -m pip install flask
    %PYEXE% -m pip install flask-cors
    %PYEXE% -m pip install pdfplumber
    %PYEXE% -m pip install PyMuPDF
    %PYEXE% -m pip install "pdfminer.six"
    %PYEXE% -m pip install python-docx
    %PYEXE% -m pip install scikit-learn
    %PYEXE% -m pip install numpy
    %PYEXE% -m pip install spacy
    %PYEXE% -m pip install python-dotenv
)

echo.
echo ── Step 4: Download spaCy model (optional, for better name detection) ──
%PYEXE% -m spacy download en_core_web_sm
echo.

echo ── Step 5: Verify critical imports ──────────────────────────────────────
%PYEXE% -c "import flask; print('[OK] flask', flask.__version__)"
%PYEXE% -c "import pdfplumber; print('[OK] pdfplumber', pdfplumber.__version__)"
%PYEXE% -c "import fitz; print('[OK] PyMuPDF', fitz.__version__)"
%PYEXE% -c "import pdfminer; print('[OK] pdfminer.six')"
%PYEXE% -c "import docx; print('[OK] python-docx')"
%PYEXE% -c "import sklearn; print('[OK] scikit-learn', sklearn.__version__)"
%PYEXE% -c "import numpy; print('[OK] numpy', numpy.__version__)"
echo.

echo ================================================
echo   Installation complete!
echo   Now run: start_ai.bat
echo ================================================
echo.
pause
