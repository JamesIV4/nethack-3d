# Quest VR

This isolated Android application hosts the bundled game in a WebView on a native immersive compositor panel. Start with [the implementation plan and headset acceptance checklist](../docs/quest-vr-plan.md). The game now opens first. The toolbar switches between Windowed MR and Immersive VR while preserving the running game. See [stereo modes and validation](../docs/quest-stereo-vr.md); the original UI probe remains available under UI test.

The app is `com.nethack3d.quest.uiproof`, labeled **NetHack 3D VR**. Its game assets come only from `app/build/generated/gameAssets/game/`, populated by the repository's Quest staging script. The manifest removes the Internet permission, and both normal WebView requests and service-worker requests resolve against the APK through `BundledGameContent`. Its HTTPS asset origin is virtual; there is no HTTP server or remote game host.

The user confirmed the original UI APK works on the headset. Native stereo geometry, transparent panel composition, mode switching and performance are new and require a fresh build/device check. The package identity and app data remain unchanged.

## Build an APK for sideloading

On Windows, from the repository root:

```powershell
npm.cmd run quest:apk
```

You can also run `./BuildQuestApk.bat`. It builds the web assets, stages them and assembles the debug APK. On success, sideload `quest/app/build/outputs/apk/debug/app-debug.apk` using Meta Quest Developer Hub, then launch **NetHack 3D VR**. This builds the standalone native stereo app; the wired PCVR UI development host is separate.

You need installed npm dependencies, a compatible JDK (Java 17 or newer), and Android SDK Platform 34. Configure `ANDROID_HOME` or `quest/local.properties`; the script also detects Android Studio's default SDK under `%LOCALAPPDATA%/Android/Sdk`. Developer Hub handles sideloading; it does not replace the Android build toolchain. `npm.cmd run quest:apk -- --help` prints usage without building. macOS/Linux users can use the two commands in the implementation plan.

## Version and API provenance

- Meta Spatial SDK and Gradle plugin are pinned to **0.13.2**, with **AGP 8.11.1**, **Kotlin 2.2.0**, **Java 17** and Android API **34**, based on the official [StarterSample version catalog](https://github.com/meta-quest/Meta-Spatial-SDK-Samples/blob/main/StarterSample/gradle/libs.versions.toml) and [app configuration](https://github.com/meta-quest/Meta-Spatial-SDK-Samples/blob/main/StarterSample/app/build.gradle.kts), inspected September 12, 2026.
- `LayoutXMLPanelRegistration` hosting a WebView and the XR focus/shutdown hooks follow APIs demonstrated in Meta's [MediaPlayerSample activity](https://github.com/meta-quest/Meta-Spatial-SDK-Samples/blob/main/MediaPlayerSample/app/src/main/java/com/meta/spatial/samples/mediaplayersample/MediaPlayerSampleActivity.kt). Panel API constructor types were also checked with `javap` against the official Maven Central `meta-spatial-sdk-toolkit:0.13.2` AAR, without compiling this app.
- The native panel explicitly uses [alpha compositor layer rendering](https://developers.meta.com/horizon/documentation/spatial-sdk/spatial-sdk-blend-modes/). It is created in Kotlin; Meta Spatial Editor and exported scene files are not needed.
- Local loading follows Android's [WebViewAssetLoader approach](https://developer.android.com/develop/ui/views/layout/webapps/load-local-content). AndroidX WebKit is pinned to **1.11.0** for the API 34 baseline.
- The repository's existing `android/gradlew.bat` uses Gradle **8.14.3** and can target this independent project using `-p quest`. The root `buildEnvironment` dependency report succeeds with KGP and the embedded compiler both resolved to 2.2.0. App compilation and APK packaging still need to be retried; the repository rules reserve build validation for the user.

Kotlin deliberately overrides the sample catalog: Spatial Gradle plugin 0.13.2 adds `kotlin-compiler-embeddable:2.2.0` to the build classpath. KGP must match that version; using 2.1.0 causes the `IncrementalCompilationFeatures` constructor linkage failure. The embedded-compiler warning may remain until the upstream plugin isolates its compiler, but the versions here now agree.

The official sample links track upstream `main`; the explicit dependency versions above determine this project's SDK surface.
