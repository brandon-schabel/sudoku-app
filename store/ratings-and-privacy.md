# Ratings & privacy answers

## Apple age rating questionnaire (all "None"/"No")
Cartoon/Fantasy Violence: None · Realistic Violence: None · Prolonged Graphic/Sadistic Violence: None · Profanity/Crude Humor: None · Mature/Suggestive Themes: None · Horror/Fear: None · Medical/Treatment Info: None · Alcohol, Tobacco, Drugs: None · Sexual Content/Nudity: None · Gambling (simulated): None · Contests: None · Unrestricted Web Access: No · Gambling & Loot boxes: No.
Expected result: **4+**. (Apple's questionnaire changes over time; re-read each question.)

## Google Play IARC content rating
Category: Game (not social, not user-generated content). Answer **No** to violence, fear, sexual content, language, controlled substances, gambling, user interaction/sharing of location/personal info, digital purchases. Expected: **Everyone / PEGI 3 / USK 0**.

## Target audience (Play)
18+ only is not required. Choose age groups including 5 and under? **No recommended**: if you target children, Play's Families policy applies (extra requirements). Recommended selection: **13+ / 18+**, not designed for children, to avoid the Families program; the app is nonetheless child-safe.

## Apple App Privacy ("nutrition label")
**Data Not Collected** – answer "No, we do not collect data from this app". No tracking; no third-party SDKs. (Capacitor plugins used: App, Haptics, in-app-review. They collect nothing.)
Also: `ITSAppUsesNonExemptEncryption = NO` is set in `ios/App/App/Info.plist` (standard HTTPS/OS crypto only) → export compliance answer "No" / exempt.
Apple privacy manifest (`PrivacyInfo.xcprivacy`): Capacitor 7 ships one for its core; verify in Xcode 'Product → Archive → Generate Privacy Report' that no required-reason API is flagged. **Not verified on this Linux box.**

## Google Play Data safety form
- Does your app collect or share any of the required user data types? **No**
- Is all of the user data collected by your app encrypted in transit? N/A (no data collected)
- Do you provide a way for users to request that their data be deleted? N/A (no data collected; local data is removed on uninstall)
- Data types: none selected. Security practices: leave defaults. Ads: **No ads**. Account creation: **No**.
- Permissions: app declares only `INTERNET` (Capacitor default). Consider removing it if unused: edit `android/app/src/main/AndroidManifest.xml`; the webview loads local assets only. (Left in place as the Capacitor default.)
