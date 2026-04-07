---
name: store-compliance
preamble-tier: 4
version: 1.0.0
description: |
  App Store and Play Store submission readiness audit. Scans for compliance issues
  that cause automatic rejection: missing privacy descriptions, private API usage,
  64-bit compliance, data safety declarations, and guideline violations. Run before
  /store-ship to prevent silent rejection. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---
<!-- gstack-mobile: store-compliance/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"store-compliance","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /store-compliance

Rejections are silent killers of ship momentum. This audit catches the issues that
cause automatic App Store or Play Store rejection before they reach review.

---

## Step 0: Detect platform and framework

```bash
# Detect mobile platform
_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
echo "Mobile platform: $_PLATFORM"

# Detect target platforms
_IS_IOS=0
_IS_ANDROID=0
[ -d "ios" ] && _IS_IOS=1
[ -d "android" ] && _IS_ANDROID=1
echo "iOS: $_IS_IOS, Android: $_IS_ANDROID"

# Detect framework
if [ -f "pubspec.yaml" ]; then
  _FRAMEWORK="Flutter"
elif [ -f "package.json" ] && grep -q '"expo"' package.json 2>/dev/null; then
  _FRAMEWORK="Expo"
elif [ -f "package.json" ]; then
  _FRAMEWORK="React Native"
elif find . -maxdepth 1 -name "*.xcodeproj" -type d 2>/dev/null | grep -q .; then
  _FRAMEWORK="Swift"
elif [ -f "app/build.gradle" ] || [ -f "app/build.gradle.kts" ]; then
  _FRAMEWORK="Kotlin"
else
  _FRAMEWORK="unknown"
fi
echo "Framework: $_FRAMEWORK"
```

---

## Step 1: iOS App Store compliance

### 1a. Privacy descriptions (required for iOS 17+)

```bash
# PrivacyInfo.xcprivacy — required for iOS 17+ submissions
find . -name "PrivacyInfo.xcprivacy" 2>/dev/null | head -5
[ -z "$(find . -name "PrivacyInfo.xcprivacy" 2>/dev/null)" ] && echo "CRITICAL: No PrivacyInfo.xcprivacy — required for iOS 17+"

# If PrivacyInfo.xcprivacy exists, check for required-reason API declarations
if [ -f "$(find . -name "PrivacyInfo.xcprivacy" 2>/dev/null | head -1)" ]; then
  cat "$(find . -name "PrivacyInfo.xcprivacy" 2>/dev/null | head -1)"
fi

# Required-reason APIs — if any of these are used, PrivacyInfo must declare why
echo "Checking for required-reason API usage:"
grep -rn "UserDefaults\|NSUserDefaults" ios/ --include="*.swift" 2>/dev/null | head -3 \
  && echo "  → NSPrivacyAccessedAPICategoryUserDefaults required"
grep -rn "NSFileSystemFreeSize\|NSFileSystemSize\|volumeAvailableCapacity" \
  ios/ --include="*.swift" 2>/dev/null | head -3 \
  && echo "  → NSPrivacyAccessedAPICategoryDiskSpace required"
grep -rn "\.bootTime\|systemUptime\|mach_absolute_time\|clock_gettime" \
  ios/ --include="*.swift" ios/ --include="*.m" 2>/dev/null | head -3 \
  && echo "  → NSPrivacyAccessedAPICategorySystemBootTime required"

# Info.plist usage descriptions
grep -r "NS.*UsageDescription" ios/ --include="*.plist" 2>/dev/null | head -20
```

**Required Info.plist descriptions** (auto-reject if using API without description):
- `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSPhotoLibraryUsageDescription`
- `NSLocationWhenInUseUsageDescription`, `NSContactsUsageDescription`, `NSCalendarsUsageDescription`
- `NSUserTrackingUsageDescription` — required if using `ATTrackingManager.requestTrackingAuthorization`
- `NSFaceIDUsageDescription` — required if using `LAContext.evaluatePolicy`

### 1a-flutter. Flutter plugin → permission declaration cross-check

```bash
# Flutter plugins that require iOS permission strings in Info.plist
if [ -f "pubspec.yaml" ]; then
  echo "Flutter plugins detected — checking for required permission declarations:"
  grep -q "camera\b" pubspec.yaml 2>/dev/null && \
    { grep -q "NSCameraUsageDescription" ios/Runner/Info.plist 2>/dev/null || \
      echo "  CRITICAL: camera plugin present but NSCameraUsageDescription missing"; }
  grep -q "geolocator\|location\b" pubspec.yaml 2>/dev/null && \
    { grep -q "NSLocationWhenInUseUsageDescription" ios/Runner/Info.plist 2>/dev/null || \
      echo "  CRITICAL: location plugin present but NSLocationWhenInUseUsageDescription missing"; }
  grep -q "image_picker\|photo_manager" pubspec.yaml 2>/dev/null && \
    { grep -q "NSPhotoLibraryUsageDescription" ios/Runner/Info.plist 2>/dev/null || \
      echo "  CRITICAL: image_picker/photo_manager present but NSPhotoLibraryUsageDescription missing"; }
  grep -q "microphone\|record\b\|audio_record" pubspec.yaml 2>/dev/null && \
    { grep -q "NSMicrophoneUsageDescription" ios/Runner/Info.plist 2>/dev/null || \
      echo "  CRITICAL: audio plugin present but NSMicrophoneUsageDescription missing"; }
  grep -q "contacts_service\|flutter_contacts" pubspec.yaml 2>/dev/null && \
    { grep -q "NSContactsUsageDescription" ios/Runner/Info.plist 2>/dev/null || \
      echo "  CRITICAL: contacts plugin present but NSContactsUsageDescription missing"; }
fi
```

### 1a-flutter-android. Flutter plugin → Android manifest permission cross-check

```bash
if [ -f "pubspec.yaml" ] && [ -f "android/app/src/main/AndroidManifest.xml" ]; then
  _MANIFEST="android/app/src/main/AndroidManifest.xml"
  grep -q "camera\b" pubspec.yaml 2>/dev/null && \
    { grep -q "CAMERA" "$_MANIFEST" 2>/dev/null || \
      echo "  CRITICAL: camera plugin present but android.permission.CAMERA missing from manifest"; }
  grep -q "geolocator\|location\b" pubspec.yaml 2>/dev/null && \
    { grep -q "ACCESS_FINE_LOCATION\|ACCESS_COARSE_LOCATION" "$_MANIFEST" 2>/dev/null || \
      echo "  CRITICAL: location plugin present but ACCESS_*_LOCATION missing from manifest"; }
  grep -q "image_picker\|photo_manager" pubspec.yaml 2>/dev/null && \
    { grep -q "READ_MEDIA_IMAGES\|READ_EXTERNAL_STORAGE" "$_MANIFEST" 2>/dev/null || \
      echo "  CRITICAL: image_picker present but READ_MEDIA_IMAGES missing from manifest"; }
  grep -q "microphone\|record\b\|audio_record" pubspec.yaml 2>/dev/null && \
    { grep -q "RECORD_AUDIO" "$_MANIFEST" 2>/dev/null || \
      echo "  CRITICAL: audio plugin present but RECORD_AUDIO missing from manifest"; }
  grep -q "contacts_service\|flutter_contacts" pubspec.yaml 2>/dev/null && \
    { grep -q "READ_CONTACTS" "$_MANIFEST" 2>/dev/null || \
      echo "  CRITICAL: contacts plugin present but READ_CONTACTS missing from manifest"; }
fi
```

### 1a-expo. Expo / React Native permission declarations

```bash
if [ "$_FRAMEWORK" = "Expo" ]; then
  echo "Expo app.json / app.config.js permission checks:"

  # iOS infoPlist permissions in app.json
  _APP_JSON=$(cat app.json app.config.js 2>/dev/null | head -200)
  echo "$_APP_JSON" | grep -q "NSCameraUsageDescription" \
    || { grep -q "expo-camera\|expo-image-picker" package.json 2>/dev/null && \
         echo "  CRITICAL: Camera plugin present but NSCameraUsageDescription missing from app.json expo.ios.infoPlist"; }
  echo "$_APP_JSON" | grep -q "NSLocationWhenInUseUsageDescription" \
    || { grep -q "expo-location" package.json 2>/dev/null && \
         echo "  CRITICAL: expo-location present but NSLocationWhenInUseUsageDescription missing"; }
  echo "$_APP_JSON" | grep -q "NSMicrophoneUsageDescription" \
    || { grep -q "expo-av\|expo-audio" package.json 2>/dev/null && \
         echo "  CRITICAL: Audio plugin present but NSMicrophoneUsageDescription missing"; }

  # Android permissions array in app.json
  echo "$_APP_JSON" | grep -q '"permissions"' \
    || echo "  WARN: No expo.android.permissions declared in app.json — defaults may over-request"

  # EAS build config
  cat eas.json 2>/dev/null | head -20 \
    || echo "  INFO: No eas.json — using Expo Go or local build"

  # SDK version
  grep '"sdkVersion"\|"expo":' app.json 2>/dev/null | head -3
fi
```

### 1b. Private API usage (auto-reject)

```bash
# Banned APIs — auto-reject
grep -rn "UIWebView\|_UIApplication\|LSApplicationWorkspace\|sendSynchronousRequest\|UDID\|advertisingIdentifier" \
  lib/ ios/ --include="*.dart" --include="*.swift" --include="*.m" --include="*.plist" 2>/dev/null | head -20

# Swift 6 strict concurrency — not a rejection but causes crashes Apple reviewers notice
grep -rn "nonisolated(unsafe)\|@unchecked Sendable" ios/ --include="*.swift" 2>/dev/null | head -5
```

**Banned APIs** (auto-reject):
- `UIWebView` → use `WKWebView`
- `UDID` / `advertisingIdentifier` without ATT consent → use `identifierForVendor`
- Private APIs starting with `_` (Apple scans for symbol names in binary)
- `sendSynchronousRequest` (blocks main thread + deprecated)

Flag any found as CRITICAL.

### 1c. App icon and assets

```bash
# Locate app icon set — works for Flutter (Runner) and pure Swift (any .xcassets)
_ICON_SET=$(find . -name "AppIcon.appiconset" -maxdepth 6 2>/dev/null | head -1)
if [ -n "$_ICON_SET" ]; then
  ls -la "$_ICON_SET/" 2>/dev/null | head -10
  file "$_ICON_SET"/*1024*.png 2>/dev/null | grep -v "PNG" | head -5 || echo "Icon format OK"
else
  find . -name "AppIcon-*.png" -o -name "icon-*.png" 2>/dev/null | head -10
fi
echo "iOS requires: 1024x1024 (App Store), @2x/@3x for all device sizes"
```

**Required:**
- 1024x1024 PNG (App Store)
- No alpha channel (solid background)
- All device sizes (@2x, @3x)

### 1d. Minimum deployment target

```bash
# Check iOS deployment target
grep -r "IPHONEOS_DEPLOYMENT_TARGET\|deploymentTarget" ios/ --include="*.plist" --include="*.pbxproj" 2>/dev/null | head -5

# Check for iOS 17+ APIs without availability guards
grep -rn "@available\|if #available" lib/ --include="*.dart" 2>/dev/null | head -10
```

**Target:**
- iOS 14+ recommended for 2025+ apps
- iOS 17+ required for some new APIs (PrivacyInfo)

### 1e. Entitlements and capabilities

```bash
# Check entitlements match App Store Connect
ls -la ios/Runner/*.entitlements 2>/dev/null | head -5
grep -r "aps-environment\|com.apple.developer" ios/Runner/*.entitlements 2>/dev/null | head -10
```

### 1f. Privacy policy URL (required by both stores)

```bash
# iOS: privacy policy URL in App Store Connect metadata (not in code, but flag if missing from app)
grep -rn "privacyPolicyURL\|privacy.policy\|privacy-policy" \
  ios/ --include="*.plist" --include="*.swift" 2>/dev/null | head -5

# Android: privacy policy in Play Console metadata
grep -rn "privacyPolicy\|privacy_policy" \
  android/ --include="*.xml" --include="*.kt" 2>/dev/null | head -5

# Expo: privacyPolicyUrl in app.json
grep -rn "privacyPolicyUrl\|privacyPolicy" app.json app.config.js 2>/dev/null | head -3 \
  || echo "  WARN: No privacyPolicyUrl in app.json — required for both App Store and Play Store"
```

**Required:**
- App Store: Privacy Policy URL in App Store Connect (apps that collect any data)
- Play Store: Privacy Policy URL in store listing (mandatory for all apps since 2022)
- Both reject apps without a working privacy policy URL

---

## Step 2: Google Play compliance

### 2a. SDK version requirements

```bash
# Check Android SDK versions
grep -r "compileSdkVersion\|targetSdkVersion\|minSdkVersion" android/app/build.gradle android/build.gradle 2>/dev/null | head -10

# Check for targetSdkVersion >= 35 (2026 requirement)
grep "targetSdkVersion" android/app/build.gradle 2>/dev/null
```

**Google Play API level timeline:**
- targetSdkVersion < 34: Play Store **blocked new uploads** after Aug 31, 2024
- targetSdkVersion < 35: Play Store **will block new uploads** in 2025 (confirm exact date in Play Console)
- Run `grep "targetSdkVersion" android/app/build.gradle` and compare to current requirements

**Requirements:**
- targetSdkVersion >= 35 (2026 requirement)
- compileSdkVersion matches targetSdkVersion
- minSdkVersion >= 21 (recommended)

### 2b. 64-bit compliance

```bash
# Check for 32-bit-only native libraries
find android/app/src/main/jniLibs -name "*.so" 2>/dev/null | head -10
file android/app/build/intermediates/cmake/*/obj/*.so 2>/dev/null | head -5

# Check ndk.abiFilters
grep -r "ndk.abiFilters" android/app/build.gradle 2>/dev/null | head -5
```

**Requirement:**
- All .so files must include 64-bit variants (arm64-v8a, x86_64)
- No 32-bit-only native code

### 2c. Data Safety declaration (Play Store — required)

```bash
# Data safety JSON (if generated from Play Console)
find . -name "play_data_safety.json" -o -name "data_safety.json" 2>/dev/null | head -5

# Check what data the app actually collects — match against declaration
grep -rn "Advertising\|Analytics\|Firebase\|Amplitude\|Segment\|Mixpanel\|Sentry\|Crashlytics" \
  android/ --include="*.kt" --include="*.xml" 2>/dev/null | head -10

# Kotlin/Android: check permissions vs data safety alignment
grep -rn "uses-permission" android/app/src/main/AndroidManifest.xml 2>/dev/null | head -20

# READ_PHONE_STATE, PROCESS_OUTGOING_CALLS — high scrutiny
grep -rn "READ_PHONE_STATE\|PROCESS_OUTGOING_CALLS\|READ_CALL_LOG" \
  android/app/src/main/AndroidManifest.xml 2>/dev/null | head -5 \
  && echo "WARN: Telephony permissions require explicit justification"
```

**Play Store Data Safety requirements:**
- Every SDK that collects data must be declared (Firebase, Crashlytics, analytics)
- Google Play SDK Index: verify no SDK is flagged for policy violations
- `android:hasFragileUserData="true"` in manifest if app stores payment/health data
- DELETE_ACCOUNT deeplink required if app offers account deletion (Play policy 2024)

### 2d. Exported components

```bash
# Check AndroidManifest for exported activities/receivers
grep -rn "exported=" android/app/src/main/AndroidManifest.xml 2>/dev/null | head -20

# Check for MANAGE_EXTERNAL_STORAGE
grep -rn "MANAGE_EXTERNAL_STORAGE\|WRITE_EXTERNAL_STORAGE\|READ_EXTERNAL_STORAGE" \
  android/app/src/main/AndroidManifest.xml 2>/dev/null | head -10
```

**Requirements:**
- Exported components should have intent filters or be explicitly set
- MANAGE_EXTERNAL_STORAGE requires justification and rare approval

### 2e. App Bundle (not APK for production)

```bash
# Check build output type
ls -la build/app/outputs/bundle/release/*.aab 2>/dev/null || echo "No AAB found — use flutter build appbundle"
```

**Requirement:**
- Use .aab (Android App Bundle) for Play Store, not .apk

---

## Step 3: Cross-platform checks

### 3a. Hardcoded secrets scan

```bash
# Check for API keys, tokens, credentials
grep -rn "api[_-]key\|api[_-]secret\|password\|secret\|token\|credential\|bearer\|authorization" \
  lib/ --include="*.dart" --include="*.swift" --include="*.kt" 2>/dev/null \
  | grep -v "// " | grep -v "null\|undefined\|placeholder\|YOUR_" | head -30

# Check .env files are not committed
find . -name ".env*" -not -path "./.git/*" 2>/dev/null | head -10
```

### 3b. Deep link security

```bash
# Check universal links / app links configuration
grep -rn "universalLinks\|appLinks\|associatedDomains\|android:scheme" \
  ios/ android/ --include="*.plist" --include="*.xml" --include="*.json" 2>/dev/null | head -15
```

### 3c. SSL pinning (if implemented)

```bash
# Check for SSL pinning implementation
grep -rn "certificatePinning\|sslPinning\|allowBadCertificates\|validateServerTrust" \
  lib/ --include="*.dart" --include="*.swift" --include="*.kt" 2>/dev/null | head -10
```

### 3d. Push notification compliance

```bash
# iOS: push notification entitlement
grep -rn "aps-environment" ios/Runner/*.entitlements ios/*.entitlements 2>/dev/null | head -3 \
  || find . -name "*.entitlements" -maxdepth 4 2>/dev/null | \
     xargs grep -l "aps-environment" 2>/dev/null | head -3 \
  || echo "  WARN: No aps-environment entitlement found — required for push notifications"

# Android: FCM config
find . -name "google-services.json" 2>/dev/null | head -3 \
  || echo "  WARN: No google-services.json — required for FCM push notifications"

# Permission timing: asking on first launch = ~80% deny rate (App Store review risk)
# Flutter
grep -rn "requestPermission\|FirebaseMessaging.instance.requestPermission" \
  lib/ --include="*.dart" 2>/dev/null | head -5
# iOS
grep -rn "requestAuthorization\|UNUserNotificationCenter" \
  ios/ --include="*.swift" 2>/dev/null | head -5
# Android (Expo/RN)
grep -rn "requestPermissionsAsync\|Notifications.requestPermissionsAsync" \
  src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -5
```

**Push compliance rules:**
- Never request push permission on first launch or before user understands the value
- iOS: show a pre-permission prompt explaining why ("Get notified when your order ships") before the OS dialog
- Android 13+: POST_NOTIFICATIONS permission required (runtime request, same rules as iOS)
- App Review red flag: push permission prompt on first screen with no context

---

## Step 4: Output

STORE COMPLIANCE AUDIT
═══════════════════════════════════════════════════════════

Date: {date}
Platform: {iOS / Android / Both}
Framework: {Flutter / Expo / Swift / Kotlin}

iOS APP STORE
[CRITICAL] Missing privacy description: {description} — add to Info.plist
[CRITICAL] Private API usage: {api} — replace with public alternative
[CRITICAL] Missing app icon: {size} — add to Assets.xcassets
[WARN] Deployment target: {version} — recommend iOS 14+
[WARN] Missing entitlement: {capability} — add to entitlements

GOOGLE PLAY
[CRITICAL] targetSdkVersion: {version} — must be >= 35
[CRITICAL] 32-bit native code: {file} — add 64-bit variants
[CRITICAL] Missing Data Safety declaration — create in Play Console
[WARN] Exported component without protection: {component}
[WARN] MANAGE_EXTERNAL_STORAGE used — requires rare approval

CROSS-PLATFORM
[CRITICAL] Hardcoded secret: {file:line} — move to secure storage
[CRITICAL] Deep link without validation — implement host validation
[WARN] SSL pinning not implemented — add for sensitive endpoints

VERDICT: PASS / FAIL / BLOCKS_SHIP
═══════════════════════════════════════════════════════════

If FAIL, fix each CRITICAL item before proceeding to /store-ship.

---

## Step 5: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"store-compliance","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"store-compliance","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `pass`, `fail`, or `blocked`.