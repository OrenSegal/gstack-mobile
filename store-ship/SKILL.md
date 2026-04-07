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
# Flutter
_CURRENT_VERSION=$(grep "^version:" pubspec.yaml 2>/dev/null | awk '{print $2}')
echo "CURRENT_VERSION: $_CURRENT_VERSION"
# iOS
_IOS_BUILD=$(grep "CURRENT_PROJECT_VERSION" ios/Runner.xcodeproj/project.pbxproj 2>/dev/null | head -1 | awk -F'= ' '{print $2}' | tr -d ';')
echo "IOS_BUILD_NUMBER: $_IOS_BUILD"
# Android
_ANDROID_BUILD=$(grep "versionCode" android/app/build.gradle 2>/dev/null | head -1 | awk '{print $NF}')
echo "ANDROID_VERSION_CODE: $_ANDROID_BUILD"

# 1b. Check analytics-audit was run on this branch
_AUDIT_LOG="$HOME/.gstack/analytics/skill-usage.jsonl"
grep "analytics-audit" "$_AUDIT_LOG" 2>/dev/null | grep "$_BRANCH" | tail -1 || echo "WARN: analytics-audit not run on this branch"

# 1c. Check mobile-qa was run
grep "mobile-qa" "$_AUDIT_LOG" 2>/dev/null | grep "$_BRANCH" | tail -1 || echo "WARN: mobile-qa not run on this branch"

# 1d. iOS Privacy manifest check (iOS 17+ requirement)
find . -name "PrivacyInfo.xcprivacy" 2>/dev/null | head -5
[ -z "$(find . -name "PrivacyInfo.xcprivacy" 2>/dev/null)" ] && echo "WARN: No PrivacyInfo.xcprivacy found — required for iOS 17+"

# 1e. No NSAllowsArbitraryLoads in production
grep -r "NSAllowsArbitraryLoads" ios/ --include="*.plist" 2>/dev/null | grep -v "false" | head -5

# 1f. Android: check for minifyEnabled in release
grep -r "minifyEnabled.*true" android/app/build.gradle 2>/dev/null | head -3 || echo "WARN: minifyEnabled not found in release build"
```

If version has not been bumped since last ship, AskUserQuestion:
- A) Bump version now (show current → suggest next)
- B) Cancel ship

If `analytics-audit` or `mobile-qa` not run: warn but do not block (these may have been run on a different branch).

---

## Step 2: Determine ship target

```bash
_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
echo "Shipping to: $_PLATFORM"

# Determine if iOS, Android, or both
_IS_IOS=0
_IS_ANDROID=0
[ -d "ios" ] && [ -f "ios/Runner.xcodeproj/project.pbxproj" ] && _IS_IOS=1
[ -d "android" ] && [ -f "android/app/build.gradle" ] && _IS_ANDROID=1
echo "iOS: $_IS_IOS, Android: $_IS_ANDROID"
```

---

## Step 3: iOS ship (if applicable)

**3a. Build iOS for App Store / TestFlight**

```bash
# Verify certificates
security find-identity -v -p codesigning ios/ 2>/dev/null | head -5

# Build for App Store (or TestFlight if not ready for full submission)
cd ios
# For TestFlight: use --simulator=NO and proper provisioning
xcodebuild -workspace Runner.xcworkspace -scheme Runner \
  -configuration Release \
  -sdk iphoneos \
  -archivePath ~/Desktop/build.xcarchive \
  archive 2>&1 | tail -30

# Export for upload
xcodebuild -exportArchive \
  -archivePath ~/Desktop/build.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath ~/Desktop/build-output \
  2>&1 | tail -20
```

**3b. Upload to App Store Connect**

```bash
# Option 1: Transporter (manual, reliable)
# open ~/Desktop/build-output/Runner.ipa (will open Transporter)

# Option 2: Fastlane (if configured)
# fastlane deliver --ipa_path ~/Desktop/build-output/Runner.ipa

# Option 3: ASC CLI (if configured)
# xcrun altool --upload-app -f ~/Desktop/build-output/Runner.ipa -t ios -u "$ASC_KEY_ID" -k "$ASC_PRIVATE_KEY_PATH"
```

**3c. Create TestFlight build record**

After upload, the build appears in App Store Connect. Note the build number and
submit for TestFlight review if required.

---

## Step 4: Android ship (if applicable)

**4a. Build Android release**

```bash
# Flutter: build app bundle (preferred for Play)
flutter build appbundle --release 2>&1 | tail -20

# Or APK if needed
# flutter build apk --release

# Check output
ls -la build/app/outputs/flutter-apk/ 2>/dev/null || ls -la build/app/outputs/bundle/release/ 2>/dev/null
```

**4b. Upload to Play Console**

```bash
# Option 1: Play Console UI (manual)

# Option 2: Fastlane (if configured)
# fastlane supply --apk build/app/outputs/flutter-apk/app-release.apk

# Option 3: Play Developer API (if credentials configured)
# Upload using https://github.com/codepath/android-upload-plugin or similar
```

**4c. Configure release track**

In Play Console:
- Internal testing: fast feedback, all testers get access
- Closed beta: specific tester groups
- Production: phased rollout or full release

---

## Step 5: Notify (post-ship)

```bash
# Determine what to post
_BUILD_URL=""
_BUILD_NOTES=""

# iOS: App Store Connect build URL (if available)
# Android: Play Console internal track link

echo "Ship complete!"
echo "iOS: $_IS_IOS"
echo "Android: $_IS_ANDROID"
echo "Branch: $_BRANCH"
echo "Build: $_CURRENT_VERSION / $_IOS_BUILD / $_ANDROID_BUILD"
echo ""
echo "Next: /canary to monitor for crashes"
```

---

## Step 6: Output

STORE-SHIP RESULTS
═══════════════════════════════════════════════════════════
Platform: {flutter|expo|swift|kotlin}
Ship target: {TestFlight|Play Internal|Production}
iOS Build: {build number}
Android Build: {version code}
Status: SHIPPED / BLOCKED

Gates passed:
- Version bump: YES/NO
- analytics-audit: RUN/NOT RUN
- mobile-qa: RUN/NOT RUN
- Privacy manifest: YES/NO/MISSING (iOS 17+)
- ATS disabled: YES/NO

Ship location: {URL or console path}

Next steps:
1. /canary --platform mobile (monitor for crashes)
2. Wait for review (iOS: hours to days, Android: typically faster)
3. Monitor store listing after approval
═══════════════════════════════════════════════════════════

---

## Step 7: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"store-ship","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"store-ship","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `success`, `fail`, or `abort`.