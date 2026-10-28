# Release checklist

Before first upload
- [ ] Change **appId** `com.brandonschabel.stillsudoku` (PLACEHOLDER) everywhere if desired: `capacitor.config.json`, `android/app/build.gradle` (`namespace`, `applicationId`), `android/app/src/main/**/MainActivity.java` package path + `strings.xml`, `ios/App/App.xcodeproj` (`PRODUCT_BUNDLE_IDENTIFIER`). Or re-run `npx cap add` after deleting the folders. IDs are permanent once uploaded.
- [ ] Replace placeholder contact email in `privacy.html` and listing; host `privacy.html` at a public https URL.
- [ ] Confirm the name "Still Sudoku" is available / not infringing.
- [ ] `node --test` green; `npm run build:www`; `npx cap sync`.
- [ ] Final app UI lands (stream C), then `npm run screenshots` and review every image.
- [ ] Android: real keystore created and backed up (two places). Play App Signing enrolled.
- [ ] iOS: signing team set, deployment target ≥ 14, `ITSAppUsesNonExemptEncryption` = NO in Info.plist.
- [ ] Test on a real iPhone and Android phone and a tablet: offline launch, rotate, dark mode, safe areas, background/resume pause.
- [ ] Version: bump `versionCode`/`versionName` (Android) and `CFBundleVersion`/marketing version (iOS).
- [ ] Listing text, screenshots, privacy answers entered; review notes ("no login required").
After release: tag the commit `vX.Y.Z`, archive the AAB/IPA, keep the keystore backup.
