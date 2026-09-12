@echo off
setlocal EnableExtensions

if /I "%~1"=="--help" goto :help
if not "%~1"=="" (
    echo Usage: BuildQuestApk.bat [--help]
    exit /b 2
)

pushd "%~dp0"
if errorlevel 1 exit /b 1

rem Gradle also accepts quest/local.properties or an explicitly set SDK path.
if not defined ANDROID_HOME if not defined ANDROID_SDK_ROOT if exist "%LOCALAPPDATA%\Android\Sdk\platforms" set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
if not defined ANDROID_HOME if not defined ANDROID_SDK_ROOT if not exist "quest\local.properties" (
    echo Android SDK is not configured.
    echo Install Android SDK Platform 34 using Android Studio's SDK Manager.
    echo Then set ANDROID_HOME or set sdk.dir in quest\local.properties.
    echo Meta Quest Developer Hub can install the resulting APK; the build needs the Android SDK.
    popd
    exit /b 1
)

call npm.cmd run quest:sync
if errorlevel 1 goto :failed

call android\gradlew.bat -p quest :app:assembleDebug
if errorlevel 1 goto :failed

if not exist "quest\app\build\outputs\apk\debug\app-debug.apk" (
    echo Gradle finished, but the expected debug APK was not found.
    popd
    exit /b 1
)

echo.
echo NetHack 3D VR APK ready:
echo "%CD%\quest\app\build\outputs\apk\debug\app-debug.apk"
echo Sideload this file using Meta Quest Developer Hub.
popd
exit /b 0

:failed
set "QUEST_APK_EXIT_CODE=%ERRORLEVEL%"
echo.
echo Quest APK build failed. See the error above.
popd
exit /b %QUEST_APK_EXIT_CODE%

:help
echo BuildQuestApk.bat builds and stages the web assets, then assembles the Quest debug APK.
echo Requires installed npm dependencies, Java 17 or newer compatible with Gradle, and Android SDK Platform 34.
echo Configure the SDK using ANDROID_HOME or quest\local.properties; the default Android Studio SDK is detected automatically.
echo Output: quest\app\build\outputs\apk\debug\app-debug.apk
exit /b 0
