# Build results (stream D)

Built 2026-10-28 on Linux x64 from branch `feat/d-store`, Capacitor 7.6.9, `appId` **com.brandonschabel.stillsudoku (PLACEHOLDER, change before first upload)**.

## Toolchain notes
- Capacitor **7** (not 8): Capacitor 8's CLI requires Node ≥ 22, this box has Node 20.19.
- Capacitor 7's Android project compiles with **Java 21**; the shared `/workspace/toolchain/jdk` is 17 and fails with `invalid source release: 21`. A JDK 21 (Temurin 21.0.13) was added at `/workspace/toolchain/jdk21` and used via `JAVA_HOME`.
- `ANDROID_HOME=/workspace/toolchain/android-sdk` (platform 35, build-tools 35.0.0). No extra SDK packages were needed. Gradle 8.11.1, `--no-daemon`.
- Commands: `npm run build:www`, `npx cap sync android`, then in `android/`: `./gradlew assembleDebug`, `./gradlew bundleRelease assembleRelease`. Logs: `/workspace/shared/sudoku/logs/d-android-*.log`.
- Release artifacts were signed afterwards with a **throwaway** keystore (`/workspace/shared/sudoku/throwaway-keystore`, never committed, password is public-throwaway) via zipalign + apksigner (APK; v1+v2 verified) and jarsigner (AAB). These are test artifacts only and must never be uploaded to a store.

## Artifacts (`/workspace/shared/sudoku/artifacts/`, not in git)
| File | Bytes | sha256 |
|---|---|---|
| stillsudoku-debug.apk | 5474658 | 0f4a7140cb12429460f684eaa606918d774a7c80accf4fac232000862f1a3689 |
| stillsudoku-release-unsigned.apk | 4032666 | 7ffd428cefec22f1dfb9c3da5bfdf46a0bd09156ac0d146ab3292d5ca8486f33 |
| stillsudoku-release-throwaway-signed.apk | 4082769 | dfe841b7d27968c95805cd66249af7788edb98b4140398d9611ef8a311346cb1 |
| stillsudoku-release-unsigned.aab | 3580722 | 25d7b5dfdcf136464c3847fa69641daa3102dfd3ff99a9e5ce63540fee0e9992 |
| stillsudoku-release-throwaway-signed.aab | 3645584 | da257fb3d0b7fbde31defe28f6ed3a64d3d2c6b05c0c1f45d96dab379485eca1 |

`aapt2 dump badging` on the debug APK: package `com.brandonschabel.stillsudoku`, versionCode 1, versionName 1.0, minSdk 23, targetSdk 35.

## Not verified here
- App was **not launched** on an emulator/device (no emulator on this box); only compiled and packaged.
- **iOS was not built.** `npx cap add ios` generated the Xcode project on Linux; `pod install`/Swift Package resolution, signing and archive need a Mac with Xcode.
- Store-required target API level for new Play apps may be newer than 35 by submission time; check Play Console's current requirement.
- Screenshot script was smoke-tested against the current app (Chromium headless shell via Playwright); the app currently ignores `?seed=`/`?test=1`, so scenes are plain until stream C lands the hooks.
