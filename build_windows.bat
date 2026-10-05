@echo off
setlocal
cd /d "%~dp0"

python -c "import sys; sys.exit(0 if sys.version_info[:2] == (3, 11) else 1)" >nul 2>&1
if errorlevel 1 (
    echo This build uses Python 3.11. Install Python 3.11 for Windows and try again.
    if /I not "%CI%"=="true" pause
    exit /b 1
)

if not exist ".venv-windows-build\Scripts\python.exe" (
    python -m venv .venv-windows-build
    if errorlevel 1 goto :failed
)

set "BUILD_PY=.venv-windows-build\Scripts\python.exe"
"%BUILD_PY%" -m pip install --upgrade pip
if errorlevel 1 goto :failed
"%BUILD_PY%" -m pip install -r requirements-windows.txt
if errorlevel 1 goto :failed

if not exist "build\windows" mkdir "build\windows"
if not exist "dist\windows" mkdir "dist\windows"
"%BUILD_PY%" -m PyInstaller --noconfirm --clean --onedir --name LakeLoom ^
    --specpath "build\windows" --workpath "build\windows\work" --distpath "dist\windows" ^
    --add-data "%cd%\index.html;." --add-data "%cd%\app.js;." --add-data "%cd%\styles.css;." --add-data "%cd%\favicon.svg;." ^
    --collect-all databricks.connect --collect-all databricks.sdk ^
    --collect-all pyspark --collect-all py4j ^
    --copy-metadata databricks-connect --copy-metadata databricks-sdk --copy-metadata pyspark ^
    windows_launcher.py
if errorlevel 1 goto :failed

powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path 'dist\windows\LakeLoom\*' -DestinationPath 'dist\LakeLoom-Windows.zip' -Force"
if errorlevel 1 goto :failed

echo.
echo Build complete: dist\LakeLoom-Windows.zip
echo Extract the ZIP, then run LakeLoom.exe and keep its console window open.
if /I not "%CI%"=="true" pause
exit /b 0

:failed
echo.
echo The Windows build did not complete. Review the error above.
if /I not "%CI%"=="true" pause
exit /b 1
