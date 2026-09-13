@echo off
setlocal
cd /d "%~dp0"
if /i "%~1"=="--help" goto help
if not defined JAVA_HOME if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
if /i "%~1"=="--check" (
  node scripts\quest\webxr\prepare-gecko-runtime.mjs --check
  exit /b
)
node scripts\quest\webxr\prepare-gecko-runtime.mjs
if errorlevel 1 exit /b 1
call npm.cmd run quest:sync
if errorlevel 1 exit /b 1
call quest\runtime\wolvic\gradlew.bat -p quest\runtime\wolvic :app:assembleOculusvrArm64GeckoGenericDebug --console=plain --max-workers=4
if errorlevel 1 (
  echo Standalone WebXR APK build failed. See the error above.
  exit /b 1
)
node scripts\quest\webxr\publish-apk.mjs
exit /b %errorlevel%
:help
echo Build the fully bundled Three.js WebXR APK with automatic native VR entry.
echo Uses the Meta SDK in quest\runtime\OVRPlatformSDK or QUEST_OVR_PLATFORM_SDK.
echo Requires the patched GeckoView in quest\runtime\gecko or QUEST_GECKO_DIR.
echo Build it once with scripts/quest/webxr/build-gecko-runtime.sh in Linux/WSL.
echo --check validates SDK paths and the patched runtime without building.
exit /b 0
