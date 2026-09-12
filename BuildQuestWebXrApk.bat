@echo off
setlocal
cd /d "%~dp0"
if /i "%~1"=="--help" goto help
if /i "%~1"=="--check" (
  node scripts\quest\webxr\prepare-runtime.mjs --check
  exit /b
)
node scripts\quest\webxr\prepare-runtime.mjs --check
if errorlevel 1 exit /b 1
node scripts\quest\webxr\prepare-runtime.mjs
if errorlevel 1 exit /b 1
call npm.cmd run quest:sync
if errorlevel 1 exit /b 1
call quest\runtime\wolvic\gradlew.bat -p quest\runtime\wolvic :app:assembleOculusvrArm64ChromiumGenericDebug
if errorlevel 1 (
  echo Standalone WebXR proof build failed. See the error above.
  exit /b 1
)
echo.
echo WebXR proof APK:
dir /s /b quest\runtime\wolvic\app\build\outputs\apk\*chromium*debug.apk
echo This is a separate proof app; the previous Quest app and its saves are preserved.
exit /b 0
:help
echo Build the fully bundled Three.js WebXR proof APK.
echo Required: QUEST_CHROMIUM_DIR, QUEST_OVR_PLATFORM_SDK and Android SDK.
echo Runtime setup: docs\quest-webxr-runtime.md
echo --check validates dependency files without building.
exit /b 0
