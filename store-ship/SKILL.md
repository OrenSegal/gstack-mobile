---
name: store-ship
preamble-tier: 4
version: 1.0.0
description: |
  Ship a mobile build to TestFlight (iOS) or Play Console internal track (Android).
  Checks version bump, builds in release mode, verifies privacy manifests, uploads,
  and posts the build link to Slack/Linear. Replaces /ship for mobile apps. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - AskUserQuestion
---
<!-- gstack-mobile: store-ship/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
source ~/.gstack/mobile.env 2>/dev/null || echo "WARN: ~/.gstack/mobile.env not found — credentials unavailable"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"store-ship","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /store-ship

Ships the mobile build. Does not ship until all gate checks pass.

---

## Step 1: Gate checks (run all, block on any FAIL)

```bash
# 1a. Version bump check
_CURRENT_VERSION=$(grep "^version:" pubspec.yaml 2>/dev/null | awk '{print $2}')
echo "CURRENT_VERSION: $_CURRENT_VERSION"

_IS_IOS=0
_IS_ANDROID=0
[ -d "ios" ] && [ -f "ios/Runner.xcodeproj/project.pbxproj" ] && _IS_IOS=1
[ -d "android" ] && [ -f "android/app/build.gradle" ] && _IS_ANDROID=1

if [ "$_IS_IOS" = "1" ]; then
  _IOS_BUILD=$(grep "CURRENT_PROJECT_VERSION" ios/Runner.xcodeproj/project.pbxproj 2>/dev/null | head -1 | awk -F'= ' '{print $2}' | tr -d ';')
  echo "IOS_BUILD_NUMBER: $_IOS_BUILD"
fi

if [ "$_IS_ANDROID" = "1" ]; then
  _ANDROID_BUILD=$(grep "versionCode" android/app/build.gradle 2>/dev/null | head -1 | awk '{print $NF}')
  echo "ANDROID_VERSION_CODE: $_ANDROID_BUILD"
fi

# 1b. Check analytics-audit was run on this branch
_AUDIT_LOG="$HOME/.gstack/analytics/skill-usage.jsonl"
_ANALYTICS_RUN=$(grep "analytics-audit" "$_AUDIT_LOG" 2>/dev/null | grep "$_BRANCH" | tail -1)
if [ -z "$_ANALYTICS_RUN" ]; then
  echo "WARN: analytics-audit not run on this branch"
fi

# 1c. Check mobile-qa was run
_MOBILEQA_RUN=$(grep "mobile-qa" "$_AUDIT_LOG" 2>/dev/null | grep "$_BRANCH" | tail -1)
if [ -z "$_MOBILEQA_RUN" ]; then
  echo "WARN: mobile-qa not run on this branch"
fi

# 1d. iOS Privacy manifest check (iOS 17+ requirement)
if [ "$_IS_IOS" = "1" ]; then
  _PRIVACY_MANIFEST=$(find . -name "PrivacyInfo.xcprivacy" 2>/dev/null | head -1)
  [ -z "$_PRIVACY_MANIFEST" ] && echo "WARN: No PrivacyInfo.xcprivacy found — required for iOS 17+"
fi

# 1e. No NSAllowsArbitraryLoads in production
if [ "$_IS_IOS" = "1" ]; then
  _ARBITRARY_LOADS=$(grep -r "NSAllowsArbitraryLoads" ios/ --include="*.plist" 2>/dev/null | grep -v "false" | head -5)
  [ -n "$_ARBITRARY_LOADS" ] && echo "WARN: NSAllowsArbitraryLoads found — may cause App Review rejection"
fi

# 1f. Android: check for minifyEnabled in release
if [ "$_IS_ANDROID" = "1" ]; then
  grep -r "minifyEnabled.*true" android/app/build.gradle 2>/dev/null | head -3 || echo "WARN: minifyEnabled not found in release build"
fi
```

If version has not been bumped since last ship, AskUserQuestion:
- A) Bump version now (show current → suggest next)
- B) Cancel ship

If the user picks A, STOP and let them run it. Do not proceed.

If `analytics-audit` or `mobile-qa` not run, AskUserQuestion:
- "You're about to ship to the store without running {skill-name} on this branch. Recommended before distributing to users."
- A) Run {skill-name} first (recommended)
- B) Ship anyway

If the user picks A, STOP and let them run it. Do not proceed.

---

## Step 2: Platform-specific build

```bash
_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
echo "PLATFORM: $_PLATFORM"
source ~/.gstack/mobile.env 2>/dev/null || echo "WARN: credentials not loaded"
```

### Flutter (iOS)

```bash
# Clean build
flutter clean && flutter pub get

# Build IPA (release)
flutter build ipa --release --obfuscate --split-debug-info=./debug-info/

# Check build output
ls -lh build/ios/ipa/*.ipa 2>/dev/null || echo "IPA not found — check build output above"
```

### Flutter (Android)

```bash
# Build AAB (preferred over APK for Play Console)
flutter build appbundle --release --obfuscate --split-debug-info=./debug-info/
ls -lh build/app/outputs/bundle/release/*.aab 2>/dev/null || echo "AAB not found"
```

### Expo

```bash
# iOS
eas build --platform ios --profile production 2>/dev/null
# Android
eas build --platform android --profile production 2>/dev/null
```

### Swift (iOS only)

```bash
xcodebuild -scheme "$_APP_SCHEME" \
  -configuration Release \
  -archivePath build/Release.xcarchive \
  archive | tail -20
xcodebuild -exportArchive \
  -archivePath build/Release.xcarchive \
  -exportPath build/Release \
  -exportOptionsPlist ios/ExportOptions.plist 2>/dev/null | tail -10
```

### Kotlin (Android only)

```bash
./gradlew bundleRelease | tail -20
ls -lh app/build/outputs/bundle/release/*.aab 2>/dev/null
```

If build fails: STOP. Show the last 30 lines of build output. Do not proceed to upload.

---

## Step 3: Upload

### iOS → TestFlight

```bash
# Upload IPA to App Store Connect via xcrun altool or notarytool
xcrun altool --upload-app \
  -t ios \
  -f build/ios/ipa/*.ipa \
  --apiKey "$ASC_KEY_ID" \
  --apiIssuer "$ASC_ISSUER_ID" \
  --private-key "$ASC_PRIVATE_KEY_PATH" 2>&1 | tail -20

# Or use Transporter (GUI) if altool is unavailable:
echo "If altool fails: open Transporter.app and drag the IPA."
```

### Android → Play Console Internal Track

```bash
# Upload AAB via bundletool or Gradle Play Publisher plugin
# Check for Gradle Play Publisher
grep -r "play-publisher\|com.github.triplet.play" android/app/build.gradle android/build.gradle 2>/dev/null | head -5

# If plugin found:
./gradlew publishReleaseBundle 2>&1 | tail -20

# If not, print the manual path:
echo "Play Console: https://play.google.com/console"
echo "Internal testing → Create new release → Upload the AAB from:"
ls -lh app/build/outputs/bundle/release/*.aab 2>/dev/null
```

### Expo (EAS Submit)

```bash
eas submit --platform ios --latest 2>/dev/null
eas submit --platform android --latest 2>/dev/null
```

---

## Step 4: Post-ship

```bash
# Tag the release commit
_VERSION=$(grep "^version:" pubspec.yaml 2>/dev/null | awk '{print $2}' || cat VERSION 2>/dev/null || echo "unknown")
git tag -a "v$_VERSION" -m "store-ship v$_VERSION" 2>/dev/null || echo "Tag already exists or version unknown"
git push origin "v$_VERSION" 2>/dev/null || true
```

Output a post-ship summary:

STORE SHIP
═══════════════════════════════════════════════════════════
Version: {version}
Build: {build number}
Platform: {iOS / Android / Both}
Target: {TestFlight / Play Internal / EAS}

iOS IPA: {size}
Android AAB: {size}

Upload: SUCCESS / FAILED
Tag: v{version} pushed

Next steps:
iOS: Check App Store Connect → TestFlight → wait for processing (~5-15 min)
Android: Check Play Console → Internal testing → review and promote
Both: Run /analytics-audit to verify events fire on the new build
After soak period: Promote to external TestFlight / open testing
═══════════════════════════════════════════════════════════

---

## Step 5: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"store-ship","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"store-ship","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","version":"'"$_VERSION"'","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `success`, `fail`, or `abort`.