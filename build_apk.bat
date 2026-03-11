@echo off
setlocal EnableDelayedExpansion
set "SHOULD_PAUSE=1"
if defined NOTE_CONNECTION_NO_PAUSE set "SHOULD_PAUSE=0"
if /I "%CI%"=="true" set "SHOULD_PAUSE=0"

REM ========================================================
REM   NoteConnection APK Build Script
REM   Version: 1.1.1
REM   Description: Automated build pipeline from Web to Android APK
REM   Author: Jacob
REM ========================================================

echo.
echo ===============================================================================
echo   NoteConnection Mobile Build Pipeline
echo ===============================================================================
echo.

REM --------------------------------------------------------
REM 1. Environment Detection & Pre-checks
REM --------------------------------------------------------
echo [1/8] Inspecting Environment...

REM Check Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is NOT installed or NOT in your PATH.
    echo         Core build tools ^(npm^) are required.
    echo         [ACTION] Please install Node.js ^(LTS^) from: https://nodejs.org/
    echo.
    if "%SHOULD_PAUSE%"=="1" pause
    exit /b 1
)
for /f "delims=" %%v in ('node -v') do set NODE_VERSION=%%v
echo   [OK] Node.js Found: !NODE_VERSION!

REM Check Java (JDK)
where javac >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Java JDK is NOT installed or NOT in your PATH.
    echo         Android Gradle build requires JDK 21 or higher.
    echo         [ACTION] Please install OpenJDK 21+.
    echo.
    if "%SHOULD_PAUSE%"=="1" pause
    exit /b 1
)
for /f "tokens=2 delims= " %%v in ('javac -version 2^>^&1') do set JAVA_VERSION=%%v
echo   [OK] Java JDK Found: !JAVA_VERSION!
set "JAVA_MAJOR=!JAVA_VERSION!"
for /f "tokens=1 delims=." %%m in ("!JAVA_VERSION!") do set "JAVA_MAJOR=%%m"
if "!JAVA_MAJOR!"=="1" (
    for /f "tokens=2 delims=." %%m in ("!JAVA_VERSION!") do set "JAVA_MAJOR=%%m"
)
set /a JAVA_MAJOR_NUM=0+!JAVA_MAJOR! >nul 2>&1
if !JAVA_MAJOR_NUM! lss 21 (
    echo.
    echo [ERROR] Detected JDK major version !JAVA_MAJOR_NUM!, but this project requires JDK 21+.
    echo         [ACTION] Set JAVA_HOME to a JDK 21 installation and ensure javac resolves to that version.
    echo.
    if "%SHOULD_PAUSE%"=="1" pause
    exit /b 1
)

REM Check JAVA_HOME
if "%JAVA_HOME%"=="" (
    echo   [WARN] JAVA_HOME is not set. Gradle might assume a default JDK.
    echo          If build fails, set JAVA_HOME to your JDK installation path.
) else (
    echo   [OK] JAVA_HOME: %JAVA_HOME%
)

REM Check Android SDK
if "%ANDROID_HOME%"=="" (
    echo.
    echo [WARN] ANDROID_HOME environment variable is NOT set.
    echo        Gradle may fail if it cannot locate the Android SDK.
    echo        [ACTION] Set ANDROID_HOME to your SDK location ^(e.g., %%LOCALAPPDATA%%\Android\Sdk^).
) else (
    if exist "%ANDROID_HOME%" (
        echo   [OK] Android SDK: %ANDROID_HOME%
    ) else (
        echo   [WARN] ANDROID_HOME is set but the directory does not exist:
        echo          %ANDROID_HOME%
    )
)

REM --------------------------------------------------------
REM 2. Dependency Verification
REM --------------------------------------------------------
echo.
echo [2/8] Verifying Dependencies...
if not exist "node_modules" (
    echo   [INFO] 'node_modules' missing. Installing project dependencies...
    call npm install
    if !errorlevel! neq 0 (
        echo.
        echo [ERROR] 'npm install' failed.
        echo         Please check your internet connection or npm configuration.
        if "%SHOULD_PAUSE%"=="1" pause
        exit /b 1
    )
    echo   [OK] Dependencies installed.
) else (
    echo   [OK] 'node_modules' exists. Skipping install.
)

REM --------------------------------------------------------
REM 3. Web Assets Build
REM --------------------------------------------------------
echo.
echo [3/8] Building Web Frontend...
echo       (This may take a moment...)
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Web build failed ^(npm run build^).
    echo         Check the output above for compilation errors.
    if "%SHOULD_PAUSE%"=="1" pause
    exit /b 1
)
echo   [OK] Web assets compiled successfully.

REM --------------------------------------------------------
REM 4. Directory Standardization
REM --------------------------------------------------------
echo.
echo [4/8] Standardizing Output Directory...
REM Capacitor webDir is configured as dist/src/frontend in capacitor.config.ts.
if exist "dist\src\frontend" (
    echo   [OK] 'dist\src\frontend' exists.
) else (
    echo [ERROR] Expected build output 'dist\src\frontend' NOT found.
    echo         Build might have produced a different structure.
    if "%SHOULD_PAUSE%"=="1" pause
    exit /b 1
)

REM --------------------------------------------------------
REM 5. Capacitor Initialization
REM --------------------------------------------------------
echo.
echo [5/8] Configuring Capacitor Bridge...
if not exist "capacitor.config.ts" (
    echo   [INFO] Initializing Capacitor project...
    call npx cap init "Knowledge Planet" "com.jacob.noteconnection" --web-dir "dist/src/frontend"
) else (
    echo   [OK] Capacitor config found.
)

REM --------------------------------------------------------
REM 6. Android Platform Setup
REM --------------------------------------------------------
echo.
echo [6/8] Configuring Android Platform...
if not exist "android" (
    echo   [INFO] Adding Android platform support...
    call npx cap add android
    if !errorlevel! neq 0 (
        echo.
        echo [ERROR] Failed to add Android platform.
        if "%SHOULD_PAUSE%"=="1" pause
        exit /b 1
    )
) else (
    echo   [OK] Android platform directory exists.
)

REM --------------------------------------------------------
REM 7. Native Asset Sync
REM --------------------------------------------------------
echo.
echo [7/8] Syncing Web Assets to Native...
call npx cap sync android
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] 'npx cap sync android' failed.
    echo         Ensure you have a valid internet connection for Gradle dependencies.
    if "%SHOULD_PAUSE%"=="1" pause
    exit /b 1
)
echo   [OK] Assets synced to android/app/src/main/assets/public.

REM --------------------------------------------------------
REM 8. Gradle Build
REM --------------------------------------------------------
echo.
echo [8/8] compiling APK with Gradle...
echo       (This is the heavy lifting. Please wait...)
cd android

if not exist "gradlew.bat" (
    echo.
    echo [ERROR] 'gradlew.bat' not found in 'android' directory.
    echo         The Android platform might be corrupted.
    echo         Try deleting the 'android' folder and re-running this script.
    cd ..
    if "%SHOULD_PAUSE%"=="1" pause
    exit /b 1
)

call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Gradle build failed.
    echo.
    echo [TROUBLESHOOTING]
    echo   1. Check JAVA_HOME matches JDK 21+.
    echo   2. Ensure Android SDK is installed.
    echo   3. Try running 'cd android && gradlew clean' manually.
    cd ..
    if "%SHOULD_PAUSE%"=="1" pause
    exit /b 1
)
cd ..

REM --------------------------------------------------------
REM Success Summary
REM --------------------------------------------------------
echo.
echo ===============================================================================
echo   BUILD SUCCESSFUL
echo ===============================================================================
echo.
echo   APK Path:
echo   %~dp0android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo   [NEXT STEPS]
echo   1. Transfer the APK to your Android device.
echo   2. Enable "Install from Unknown Sources" if prompted.
echo   3. Enjoy NoteConnection Mobile!
echo.
if "%SHOULD_PAUSE%"=="1" pause
