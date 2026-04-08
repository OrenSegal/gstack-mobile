# App Store Compliance Checklist (2026)

Reference document for `/store-compliance`. Mirrors the structure of `review/checklist.md`.
Each item has a SEVERITY (BLOCKER / HIGH / MEDIUM), detection method, and remediation.

---

## iOS App Store Guidelines

### BLOCKER

**2.5.2 — Dynamic Code Execution**
- No downloading and executing arbitrary code at runtime
- Detection: grep for `dlopen`, `NSBundle.load`, `JSEvaluateScript`, `JavaScriptCore` eval with remote sources, custom hot-update mechanisms
- Exception: React Native and Expo bundles loaded from the app's own bundle are fine; remote JS execution is not
- Remediation: Remove dynamic code loading. Use standard app updates via TestFlight/App Store

**3.1.1 — In-App Purchase Required for Digital Goods**
- Apps may not use third-party payment for digital goods/subscriptions delivered inside the app
- Detection: grep for Stripe, Braintree, PayPal, direct credit card collection in code paths selling digital content
- Exception: physical goods, business-to-business services, reader apps (Netflix, Kindle)
- Remediation: Migrate digital purchases to StoreKit / Apple IAP

**Privacy Manifest (iOS 17+, mandatory for all submissions from May 2024)**
- `PrivacyInfo.xcprivacy` must exist and declare all Required Reason APIs used:
  - `NSUserDefaults` → category `CA92.1`
  - File timestamps → category `C617.1`
  - Disk space → category `E174.1`
  - Active keyboard → category `3EC4.1`
  - System boot time → category `35F9.1`
- Detection: check for `PrivacyInfo.xcprivacy` at project root or inside app bundle
- Remediation: Create `PrivacyInfo.xcprivacy` in Xcode, declare all accessed API categories with reasons

---

### HIGH

**5.1.2 — AI / Third-Party Data Sharing**
- Apps that share personal data with AI providers must disclose this in:
  1. App Privacy section of App Store listing
  2. Privacy Policy
  3. In-app disclosure before first use of AI features
- Detection: grep for `openai`, `anthropic`, `claude`, `gpt`, `gemini`, LLM API calls, AI SDK imports
- Remediation: Add `NSPrivacyAccessedAPITypes`, update App Privacy questionnaire, show in-app disclosure on first AI use

**5.1.1 — Permission Usage Descriptions**
- Every capability that requires user permission must have an `NSUsageDescription` in `Info.plist`
- Required keys for common capabilities:
  - Camera: `NSCameraUsageDescription`
  - Microphone: `NSMicrophoneUsageDescription`
  - Location (always): `NSLocationAlwaysAndWhenInUseUsageDescription`
  - Location (when in use): `NSLocationWhenInUseUsageDescription`
  - Contacts: `NSContactsUsageDescription`
  - Photos: `NSPhotoLibraryUsageDescription`
  - Health: `NSHealthShareUsageDescription`
  - Bluetooth: `NSBluetoothAlwaysUsageDescription`
  - Face ID: `NSFaceIDUsageDescription`
  - Notifications: (requested at runtime via `UNUserNotificationCenter`)
- Detection: cross-reference entitlements file + source code API usage vs Info.plist keys
- Remediation: Add missing keys with clear user-facing descriptions (not technical descriptions)

**4.0 — Accessibility (WCAG 2.2 AA)**
- Minimum touch target: 44×44pt for all interactive elements
- Dynamic Type: all text must scale with user's preferred font size (`UIFontMetrics`)
- Color contrast: 4.5:1 minimum for normal text (<18pt), 3:1 for large text (≥18pt)
- VoiceOver: all custom interactive elements must have `accessibilityLabel`
- Detection: audit `UIButton`, `UILabel`, custom views for size constraints and accessibility properties
- Remediation: Add size constraints, `.accessibilityLabel`, `.font = UIFont.preferredFont(forTextStyle:)` or `.adjustsFontForContentSizeCategory = true`

---

### MEDIUM

**2.3 — Accurate Metadata and Screenshots**
- Screenshots must show the actual app UI (no marketing-only images showing features not in app)
- Screenshot sizes must match platform requirements:
  - 6.9" display (iPhone 16 Pro Max): 1320×2868px
  - 6.7" display (iPhone 15 Plus/Pro Max): 1290×2796px
  - 12.9" iPad Pro: 2048×2732px (required for iPad support)
- No placeholder text in app name, subtitle, or description (e.g., "TODO", "Coming soon")
- Detection: check `fastlane/metadata/` for description.txt, keywords.txt length; check for placeholder text

**2.1 — App Completeness**
- No placeholder content visible to users (`Lorem ipsum`, `TODO`, stub screens)
- All advertised features must be functional at submission
- Detection: grep source code and assets for `Lorem ipsum`, `TODO`, `placeholder`, `stub`

**5.3 — Location Services**
- Apps using location must not request "Always On" unless the core use case requires it
- Detection: grep for `CLLocationManager.requestAlwaysAuthorization` — flag unless app is navigation/fitness/tracking category
- Remediation: Use `requestWhenInUseAuthorization` unless always-on is essential

---

## Google Play Policies

### BLOCKER

**Target API Level (Android 15 / API 35 — mandatory 2026)**
- New apps must target API 35; existing apps must update by Q3 2026
- Detection: grep `targetSdkVersion` in `android/app/build.gradle` or `build.gradle.kts`
- Remediation: Update `targetSdkVersion = 35` and `compileSdkVersion = 35`; test for API 35 behavior changes

**App Bundle Required**
- Play Store requires `.aab` (Android App Bundle) format, not `.apk`
- Detection: check build task — `bundleRelease` produces `.aab`, `assembleRelease` produces `.apk`
- Remediation: Use `./gradlew bundleRelease` for Play Store uploads

**64-bit Support Required**
- All native code must support 64-bit (arm64-v8a, x86_64)
- Detection: check `jniLibs/` for `armeabi-v7a` or `x86` only libraries
- Remediation: Recompile native libraries with 64-bit targets, or remove if no 64-bit version available

---

### HIGH

**Data Safety Section**
- Every sensitive permission must be declared in the Play Store Data Safety form
- Sensitive permissions requiring declaration: `CAMERA`, `RECORD_AUDIO`, `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `READ_CONTACTS`, `READ_CALL_LOG`, `READ_SMS`, `GET_ACCOUNTS`
- Detection: grep `AndroidManifest.xml` for `uses-permission` entries
- Remediation: Complete the Data Safety form in Play Console for each declared permission

**AI / Data Disclosure (since January 2025)**
- Apps using AI features that process user data must disclose in:
  1. Data Safety section
  2. App description
  3. In-app disclosure
- Detection: same as iOS — grep for AI SDK imports
- Remediation: Add disclosure to Play Store listing and in-app

**Accessibility (TalkBack / WCAG 2.2)**
- `contentDescription` required on all `ImageView`, `ImageButton`, `FloatingActionButton`
- Text sizes must use `sp` units (scales with user font preference)
- Touch targets minimum 48dp (Android material guideline)
- Detection: grep layout XML for `ImageView` without `contentDescription`, hardcoded `textSize` in `dp` or `px`
- Remediation: Add `android:contentDescription`, change `textSize` to use `sp`

---

### MEDIUM

**Content Rating**
- App must have an accurate content rating questionnaire completed in Play Console
- Interactive elements, user-generated content, and AI-generated content affect the rating
- Detection: manual check — verify rating in Play Console matches actual content

**Deceptive Behavior / Subscription Transparency**
- Subscription terms, price, and auto-renewal must be clearly visible before purchase
- Detection: search for subscription purchase flows — verify price and duration are shown in UI before payment
- Remediation: Show subscription terms on the paywall screen; provide cancellation instructions

**Families Policy (if targeting children)**
- If `targetAudience` includes children under 13: no advertising SDKs, no data collection without parental consent, no in-app purchases without parental gate
- Detection: check Play Console target audience settings + grep for `ads`, `admob`, `analytics` SDKs

---

## Cross-Platform Checks (Flutter / React Native / Expo)

### Flutter
- `integration_test` package (not deprecated `flutter_driver`) for E2E tests
- `flutter pub outdated` — check for dependency vulnerabilities
- `android/app/build.gradle` `compileSdkVersion` ≥ 35
- No deprecated `Scaffold.of(context)` without checking for null

### React Native / Expo
- `expo doctor` — run and resolve all warnings
- `app.json` / `app.config.js` `android.targetSdkVersion` ≥ 35
- `app.json` `ios.deploymentTarget` ≥ "16.0"
- Expo SDK version ≥ 51 (older SDKs have known compliance issues)
- For OTA updates: Expo Updates is allowed; custom OTA bypass of App Store review is not (Guideline 2.5.2)

---

## Privacy Policy Requirements

- Privacy policy URL must be set in both App Store Connect and Play Console
- Policy must describe: what data is collected, how it's used, who it's shared with, retention period, deletion rights
- For AI features: policy must specifically mention AI data processing and any third-party AI providers
- Detection: check `Info.plist` for privacy policy URL key; check `AndroidManifest.xml` for `android:privacyPolicy`
- Remediation: Create privacy policy at a public URL; add to store listing and in-app settings
