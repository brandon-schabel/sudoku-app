# Publishing Still Sudoku to the App Store and Google Play

What you (Brandon) must do yourself. Everything the repo can do is already done; this lists the rest.

**Legend:** ✅ verified on the Linux dev box · ⚠️ not verified (needs your Mac/accounts/devices).

## 0. Costs

| Item | Cost | Notes |
|---|---|---|
| Apple Developer Program | **$99 / year** | Required for TestFlight and the App Store. Individual enrolment can take 1–2 days. |
| Google Play Console | **$25 one-time** | Personal accounts created after Nov 2023 must run a **closed test with ≥12 testers for 14 days** before requesting production access (policy at time of writing; check Play Console). |
| A Mac with Xcode | hardware you own / borrow | iOS builds **cannot** be made on Linux. Xcode is free. |
| Hosting for privacy policy | $0 | GitHub Pages. |
| Everything else (Capacitor, Gradle, tooling) | $0 | |

## 1. Decisions to make BEFORE the first upload (permanent!)

1. **Bundle ID / applicationId.** Currently the placeholder `com.brandonschabel.stillsudoku` (set in `capacitor.config.json`, `android/app/build.gradle`, the iOS project, and the Android `MainActivity` package/`strings.xml`). It can never be changed after the first upload. Pick the final reverse-domain id now (e.g. one on a domain you own). Easiest way to change: edit `capacitor.config.json`, delete `android/` and `ios/`, then `npx cap add android && npx cap add ios && npm run icons`; re-apply `ITSAppUsesNonExemptEncryption=false` to `ios/App/App/Info.plist`.
2. **App name.** "Still Sudoku" is the working name. Confirm it is not taken or infringing in both stores.
3. **Support email** (replace the PLACEHOLDER in `privacy.html` and store listings).
4. **Privacy policy URL** — see §2.

## 2. Host the privacy policy
Both stores require a public https URL. GitHub Pages (static, no build): repo Settings → Pages → deploy from branch (the E stream adds a Pages workflow for `main`). The policy will be at `https://<user>.github.io/<repo>/privacy.html`. Edit the contact email first. ⚠️ nothing is published yet.

## 3. Android (can be done from Linux)

Prereqs: JDK **21** (Capacitor 7 needs it; JDK 17 fails with "invalid source release: 21"), Android SDK platform 35 + build-tools 35.0.0. ✅ built here with Temurin 21.0.13.

1. Create your upload keystore (once; **back it up in two places; never commit it**):
   ```
   keytool -genkeypair -v -keystore ~/stillsudoku-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Build + sign:
   ```
   npm install
   npm run build:www && npx cap sync android
   cd android && ./gradlew bundleRelease          # unsigned AAB: app/build/outputs/bundle/release/app-release.aab
   jarsigner -keystore ~/stillsudoku-upload.jks app/build/outputs/bundle/release/app-release.aab upload
   ```
   (✅ the unsigned bundle and a throwaway-signed bundle built here; see `docs/BUILD-RESULTS.md`. ⚠️ Gradle `signingConfigs` was deliberately not added so no secrets can be committed. Alternatively add a `signingConfig` reading `keystore.properties`, which is gitignored.)
3. Play Console → Create app → name, default language, "Game", "Free". Accept declarations.
4. **Play App Signing:** on first AAB upload choose "Use Play App Signing" (default). Your keystore becomes the *upload* key.
5. Testing → **Internal testing** → create release → upload the AAB → add your email as tester → install via the opt-in link. Test on a real phone.
6. App content (all required before production): Privacy policy URL; Ads = No; App access = all functionality available without login; **Data safety** = no data collected (`store/ratings-and-privacy.md`); **Content rating** questionnaire (same file); Target audience (13+/18+ recommended); News app = No; Government app = No.
7. Store listing: text from `store/listing.md`; icon `assets/icons/icon-512.png`; **feature graphic 1024×500 is required and not yet created** (⚠️ to do); phone screenshots (`npm run screenshots`, `store/screenshots/android/`).
8. Closed testing (if your account requires it, see §0) → Production → submit for review.
9. **Every later release:** bump `versionCode` (integer, must increase every upload) and `versionName` in `android/app/build.gradle`, rebuild, upload.

## 4. iOS (requires a Mac with Xcode; ⚠️ nothing below was run here)

`npx cap add ios` produced `ios/App` on Linux, but CocoaPods/SPM resolution, signing and archiving need macOS.

1. Join the Apple Developer Program; in App Store Connect → Apps → **+ New App**: platform iOS, name, primary language, bundle ID (register it first under Certificates, Identifiers & Profiles → Identifiers), SKU (any unique string).
2. On the Mac: install Xcode (current release), Node 20+ (22 recommended), `sudo gem install cocoapods` (or brew).
   ```
   git clone … && cd sudoku-app && npm install
   npm run build:www
   npx cap sync ios
   cd ios/App && pod install     # only if Capacitor created a Podfile-based project (it did: ios/App/Podfile)
   cd ../.. && npx cap open ios
   ```
3. In Xcode, select the **App** target → **Signing & Capabilities**: tick "Automatically manage signing", choose your Team; confirm Bundle Identifier. General tab: Version (marketing, e.g. 1.0.0) and Build (e.g. 1). Deployment target is iOS 14.
4. Add the launch/app icons: already generated into `Assets.xcassets` by `npm run icons`; check in Xcode that AppIcon has no warnings.
5. Choose destination **Any iOS Device (arm64)** → Product → **Archive** → Organizer → **Distribute App → App Store Connect → Upload**.
6. App Store Connect → TestFlight: wait for processing; **Export compliance**: answer No encryption beyond standard (Info.plist already has `ITSAppUsesNonExemptEncryption=false`). Add yourself as an internal tester; test on a device.
7. App Store tab: version page → screenshots (sizes: 6.7" 1290×2796, 6.5" 1284×2778, 5.5" 1242×2208, iPad 12.9" 2048×2732 — produced by `npm run screenshots` into `store/screenshots/ios/`), description/keywords/promo text/support URL (`store/listing.md`), **Privacy Policy URL**, **App Privacy → Data Not Collected**, **Age Rating** questionnaire (`store/ratings-and-privacy.md`), pricing = Free, availability, category. Pick the uploaded build. Review notes: "No login required; no network features."
8. **Add for Review → Submit.** Typical review 24–48 h.
9. **Every later release:** bump Build (`CURRENT_PROJECT_VERSION`, must increase per upload) and Version (`MARKETING_VERSION`) in Xcode, `npm run build:www && npx cap sync ios`, archive, upload.

## 5. Version bump cheat-sheet
| | Marketing version | Build number |
|---|---|---|
| Android | `versionName` in `android/app/build.gradle` | `versionCode` (increment every upload) |
| iOS | `MARKETING_VERSION` | `CURRENT_PROJECT_VERSION` |
| Web/PWA | automatic: `build:www` stamps `sw.js` with a content hash |

## 6. What was verified vs not
✅ `node --test` (34 tests), `npm run build:www`, `npx cap sync`, Android `assembleDebug` / `bundleRelease` / `assembleRelease` (+ throwaway signing, APK signature verified), icon/splash generation, screenshot script against current UI.
⚠️ Not verified: any iOS build, running the Android app on an emulator/device, the Play/App Store consoles' current policies, the real keystore flow, GitHub Pages hosting, feature graphic (missing), the app's UI hooks used by screenshots (`?seed=`, `?test=1`) which depend on stream C.
