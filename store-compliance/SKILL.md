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
  grep -q "flutter:" pubspec.yaml && _FRAMEWORK="Flutter" || _FRAMEWORK="Expo"
elif [ -f "package.json" ]; then
  _FRAMEWORK="React Native"
elif [ -d "ios" ] && [ -f "ios/Runner.xcodeproj/project.pbxproj" ]; then
  _FRAMEWORK="Swift"
else
  _FRAMEWORK="unknown"
fi
echo "Framework: $_FRAMEWORK"
```

---

## Step 1: iOS App Store compliance

### 1a. Privacy descriptions (required for iOS 17+)

```bash
# Check for PrivacyInfo.xcprivacy (iOS 17+ required)
find . -name "PrivacyInfo.xcprivacy" 2>/dev/null | head -5
[ -z "$(find . -name "PrivacyInfo.xcprivacy" 2>/dev/null)" ] && echo "WARN: No PrivacyInfo.xcprivacy — required for iOS 17+"

# Check Info.plist for usage descriptions
grep -r "NS.*UsageDescription\|NS.*UsageString" ios/ --include="*.plist" 2>/dev/null | head -20
```

**Required descriptions** (add to Info.plist if missing):
- NSCameraUsageDescription — "This app uses the camera to [feature]"
- NSMicrophoneUsageDescription — "This app uses the microphone for [feature]"
- NSPhotoLibraryUsageDescription — "This app accesses your photos to [feature]"
- NSPhotoLibraryAddUsageDescription — "This app saves photos to your library"
- NSLocationWhenInUseUsageDescription — "This app uses your location to [feature]"
- NSLocationAlwaysAndWhenInUseUsageDescription — "This app needs background location for [feature]"
- NSContactsUsageDescription — "This app accesses your contacts to [feature]"
- NSCalendarsUsageDescription — "This app accesses your calendar to [feature]"
- NSUserTrackingUsageDescription — "This app uses advertising tracking" (if IDFA used)

Flag any missing descriptions as CRITICAL — auto-reject.

### 1b. Private API usage (auto-reject)

```bash
# Check for banned APIs
grep -rn "_UIApplication\|UIWebView\|LSApplicationWorkspace\|CLLocationManagerSignificantChange\|sendSynchronousRequest" \
  lib/ ios/ --include="*.dart" --include="*.swift" --include="*.m" --include="*.plist" 2>/dev/null | head -20
```

**Banned APIs** (cause immediate rejection):
- UIWebView — deprecated, use WKWebView
- UDID — useidentifierforvendor
- Private APIs starting with _

Flag any found as CRITICAL.

### 1c. App icon and assets

```bash
# Check icon sizes
ls -la ios/Runner/Assets.xcassets/AppIcon.appiconset/ 2>/dev/null | head -10
find . -name "AppIcon-*.png" -o -name "icon-*.png" 2>/dev/null | head -10

# Check for alpha channel in icon
file ios/Runner/Assets.xcassets/AppIcon.appiconset/*1024*.png 2>/dev/null | grep -v "PNG" | head -5 || echo "Icon format OK"

# Check required icon sizes (iOS)
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

---

## Step 2: Google Play compliance

### 2a. SDK version requirements

```bash
# Check Android SDK versions
grep -r "compileSdkVersion\|targetSdkVersion\|minSdkVersion" android/app/build.gradle android/build.gradle 2>/dev/null | head -10

# Check for targetSdkVersion >= 35 (2026 requirement)
grep "targetSdkVersion" android/app/build.gradle 2>/dev/null
```

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

### 2c. Data Safety declaration

```bash
# Check for data safety JSON
find . -name "play_data_safety.json" -o -name "data_safety.json" 2>/dev/null | head -5
find . -name "app.*.json" -path "*/firebase/*" 2>/dev/null | head -5
```

**Required for Play Store:**
- Data Safety section in Play Console
- Must declare: data collection, sharing, security practices

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