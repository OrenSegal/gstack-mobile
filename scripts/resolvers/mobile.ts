import type { TemplateContext } from './types';

/**
 * {{MOBILE_DETECT}} — Detect the mobile project ecosystem.
 *
 * Emits a bash detection block that all mobile skills run in their setup phase.
 * Detection cascade order matters: RN/Expo projects also have package.json, so
 * Flutter/Expo/RN are checked before generic xcodeproj/Kotlin signals.
 *
 * Outputs (echo to stdout for the skill to read):
 *   MOBILE_ECOSYSTEM: flutter | expo | react-native | swift | kotlin | unknown
 *   MOBILE_HAS_IOS:   true | false
 *   MOBILE_HAS_ANDROID: true | false
 *   MOBILE_TEST_CMD:  ecosystem-specific test invocation
 *   MOBILE_BUILD_CMD: ecosystem-specific release build invocation
 *   MOBILE_ANALYZE_CMD: ecosystem-specific static analysis invocation
 *
 * Persists to CLAUDE.md ## Mobile Stack on first run; subsequent runs read
 * the cached values instead of re-detecting.
 */
export function generateMobileDetect(_ctx: TemplateContext): string {
  return `## Mobile Ecosystem Detection

Run this detection block to determine the project's mobile ecosystem. Read
\`CLAUDE.md\` first — if a \`## Mobile Stack\` section exists with an
\`ecosystem:\` entry, use those cached values and skip the rest of detection.

\`\`\`bash
setopt +o nomatch 2>/dev/null || true  # zsh compat

# 1. Read cached values from CLAUDE.md first
_MOBILE=$(grep -A1 "## Mobile Stack" CLAUDE.md 2>/dev/null | grep "ecosystem:" | cut -d: -f2 | tr -d ' ')
_HAS_IOS=$(grep -A5 "## Mobile Stack" CLAUDE.md 2>/dev/null | grep "has_ios:" | cut -d: -f2 | tr -d ' ')
_HAS_ANDROID=$(grep -A5 "## Mobile Stack" CLAUDE.md 2>/dev/null | grep "has_android:" | cut -d: -f2 | tr -d ' ')

# 2. Auto-detect if no cached values
if [ -z "$_MOBILE" ] || [ "$_MOBILE" = "unknown" ]; then
  _MOBILE="unknown"
  # Flutter: pubspec.yaml with flutter dependency
  [ -f pubspec.yaml ] && grep -q "flutter:" pubspec.yaml 2>/dev/null && _MOBILE="flutter"
  # Expo: package.json with expo dependency (check before react-native)
  [ "$_MOBILE" = "unknown" ] && [ -f package.json ] && grep -q '"expo"' package.json 2>/dev/null && _MOBILE="expo"
  [ "$_MOBILE" = "unknown" ] && [ -f eas.json ] && _MOBILE="expo"
  # React Native: package.json with react-native (but not expo)
  [ "$_MOBILE" = "unknown" ] && [ -f package.json ] && grep -q '"react-native"' package.json 2>/dev/null && _MOBILE="react-native"
  # Swift/iOS: .xcodeproj or .xcworkspace at root or in ios/ subdir
  [ "$_MOBILE" = "unknown" ] && ls *.xcodeproj *.xcworkspace 2>/dev/null | grep -q . && _MOBILE="swift"
  [ "$_MOBILE" = "unknown" ] && ls ios/*.xcodeproj ios/*.xcworkspace 2>/dev/null | grep -q . && _MOBILE="react-native"
  # Kotlin/Android: android/app/build.gradle or root build.gradle with android block
  [ "$_MOBILE" = "unknown" ] && [ -f android/app/build.gradle ] && _MOBILE="kotlin"
  [ "$_MOBILE" = "unknown" ] && [ -f app/build.gradle ] && _MOBILE="kotlin"
fi

# 3. Platform presence — independent of ecosystem
_HAS_IOS="\${_HAS_IOS:-false}"
_HAS_ANDROID="\${_HAS_ANDROID:-false}"
ls *.xcodeproj *.xcworkspace 2>/dev/null | grep -q . && _HAS_IOS="true"
[ -f ios/Podfile ] && _HAS_IOS="true"
[ -d ios ] && ls ios/*.xcodeproj ios/*.xcworkspace 2>/dev/null | grep -q . && _HAS_IOS="true"
[ -f android/app/build.gradle ] && _HAS_ANDROID="true"
[ -d android ] && _HAS_ANDROID="true"
[ "$_MOBILE" = "kotlin" ] && _HAS_ANDROID="true"
[ "$_MOBILE" = "swift" ] && _HAS_IOS="true"

# 4. Ecosystem-specific commands
case "$_MOBILE" in
  flutter)
    _TEST_CMD="flutter test"
    _BUILD_CMD="flutter build appbundle --release"
    _ANALYZE_CMD="flutter analyze"
    ;;
  expo)
    _TEST_CMD="npx jest"
    _BUILD_CMD="eas build --platform all --profile production"
    _ANALYZE_CMD="expo doctor && npx tsc --noEmit 2>/dev/null || true"
    ;;
  react-native)
    _TEST_CMD="npx jest"
    _BUILD_CMD="npx react-native build-android --mode release"
    _ANALYZE_CMD="npx tsc --noEmit"
    ;;
  swift)
    _SCHEME=$(ls *.xcodeproj 2>/dev/null | head -1 | sed 's/.xcodeproj//')
    _TEST_CMD="xcodebuild test -scheme \${_SCHEME:-App} -destination 'platform=iOS Simulator,name=iPhone 16' 2>&1 | tail -30"
    _BUILD_CMD="xcodebuild archive -scheme \${_SCHEME:-App} -archivePath /tmp/\${_SCHEME:-App}.xcarchive 2>&1 | tail -20"
    _ANALYZE_CMD="xcodebuild analyze -scheme \${_SCHEME:-App} 2>&1 | grep -E 'warning|error' | head -20"
    ;;
  kotlin)
    _TEST_CMD="./gradlew test"
    _BUILD_CMD="./gradlew bundleRelease"
    _ANALYZE_CMD="./gradlew lint"
    ;;
  *)
    _TEST_CMD="echo 'MOBILE_ECOSYSTEM=unknown: no mobile test command'"
    _BUILD_CMD="echo 'MOBILE_ECOSYSTEM=unknown: no mobile build command'"
    _ANALYZE_CMD="echo 'MOBILE_ECOSYSTEM=unknown: no mobile analyze command'"
    ;;
esac

echo "MOBILE_ECOSYSTEM: $_MOBILE"
echo "MOBILE_HAS_IOS: $_HAS_IOS"
echo "MOBILE_HAS_ANDROID: $_HAS_ANDROID"
echo "MOBILE_TEST_CMD: $_TEST_CMD"
echo "MOBILE_BUILD_CMD: $_BUILD_CMD"
echo "MOBILE_ANALYZE_CMD: $_ANALYZE_CMD"
\`\`\`

**If \`MOBILE_ECOSYSTEM=unknown\`:** The project is not a recognized mobile app.
Mobile-specific steps below do not apply — proceed with web/generic workflow.

**On first successful detection**, persist to \`CLAUDE.md\` under a
\`## Mobile Stack\` section (create if absent):

\`\`\`markdown
## Mobile Stack

- ecosystem: <detected value>
- has_ios: <true|false>
- has_android: <true|false>
- test: <test command>
- build_android: <android build command>
- build_ios: <ios build command>
- analyze: <analyze command>
- bundle_id: (fill in: e.g. com.company.appname)
- min_ios: (fill in: e.g. 16.0)
- min_android: (fill in: e.g. 24)
\`\`\``;
}

/**
 * {{MOBILE_TEST_RUN}} — Run the detected ecosystem's test suite.
 *
 * Emits a step that reads MOBILE_TEST_CMD (set by {{MOBILE_DETECT}}) and
 * runs it, capturing pass/fail output. Used by qa and health skills.
 */
export function generateMobileTestRun(_ctx: TemplateContext): string {
  return `## Mobile Test Run

Run the mobile test suite using the command detected by the Mobile Ecosystem Detection step:

\`\`\`bash
setopt +o nomatch 2>/dev/null || true  # zsh compat
# Re-read ecosystem from CLAUDE.md
_MOBILE=$(grep -A1 "## Mobile Stack" CLAUDE.md 2>/dev/null | grep "ecosystem:" | cut -d: -f2 | tr -d ' ')
_MOBILE="\${_MOBILE:-unknown}"

case "$_MOBILE" in
  flutter)
    flutter test --reporter expanded 2>&1 | tail -40
    ;;
  expo|react-native)
    npx jest --passWithNoTests 2>&1 | tail -40
    ;;
  swift)
    _SCHEME=$(ls *.xcodeproj 2>/dev/null | head -1 | sed 's/.xcodeproj//')
    xcodebuild test \
      -scheme "\${_SCHEME:-App}" \
      -destination 'platform=iOS Simulator,name=iPhone 16,OS=latest' \
      -resultBundlePath /tmp/TestResults.xcresult \
      2>&1 | grep -E "Test (Case|Suite|session)|PASSED|FAILED|error:" | tail -40
    ;;
  kotlin)
    ./gradlew test 2>&1 | tail -40
    ;;
  *)
    echo "MOBILE_TEST_SKIP: ecosystem unknown or not mobile"
    ;;
esac
\`\`\`

**Pass criteria:** All tests pass (exit code 0). For Swift, no \`FAILED\` in output.
**On failure:** Report failing tests by name. Do NOT proceed to build/deploy steps.`;
}

/**
 * {{SIMULATOR_SETUP}} — Boot an iOS simulator or Android emulator for testing.
 *
 * Emits a setup block that ensures a running simulator/emulator is available.
 * Used by qa and mobile-monitor skills.
 */
export function generateSimulatorSetup(_ctx: TemplateContext): string {
  return `## Simulator / Emulator Setup

\`\`\`bash
_MOBILE=$(grep -A1 "## Mobile Stack" CLAUDE.md 2>/dev/null | grep "ecosystem:" | cut -d: -f2 | tr -d ' ')
_MOBILE="\${_MOBILE:-unknown}"

if [ "$_MOBILE" = "swift" ] || [ "$_MOBILE" = "expo" ] || [ "$_MOBILE" = "react-native" ] || [ "$_MOBILE" = "flutter" ]; then
  # iOS: boot the most recent iPhone simulator if none is running
  _BOOTED=$(xcrun simctl list devices booted 2>/dev/null | grep "iPhone" | head -1)
  if [ -z "$_BOOTED" ]; then
    echo "Booting iPhone 16 simulator..."
    xcrun simctl boot "iPhone 16" 2>/dev/null || xcrun simctl boot "iPhone 15" 2>/dev/null || true
    sleep 5
  fi
  SIMULATOR_ID=$(xcrun simctl list devices booted 2>/dev/null | grep "iPhone" | head -1 | grep -oE '[A-F0-9-]{36}')
  echo "IOS_SIMULATOR_ID: $SIMULATOR_ID"
fi

if [ "$_MOBILE" = "kotlin" ] || [ "$_MOBILE" = "expo" ] || [ "$_MOBILE" = "react-native" ] || [ "$_MOBILE" = "flutter" ]; then
  # Android: check for running emulator or start one
  _ADB_DEVICES=$(adb devices 2>/dev/null | grep "emulator" | head -1)
  if [ -z "$_ADB_DEVICES" ]; then
    _AVD=$(avdmanager list avd 2>/dev/null | grep "Name:" | tail -1 | awk '{print $2}')
    if [ -n "$_AVD" ]; then
      echo "Starting Android emulator: $_AVD"
      emulator -avd "$_AVD" -no-snapshot -no-audio -no-window &
      sleep 15
      adb wait-for-device
    else
      echo "ANDROID_EMULATOR_UNAVAILABLE: no AVD found — skipping Android simulator tests"
    fi
  fi
  _ADB_ID=$(adb devices 2>/dev/null | grep "emulator" | head -1 | awk '{print $1}')
  echo "ANDROID_DEVICE_ID: $_ADB_ID"
fi
\`\`\`

**If simulator/emulator tools are unavailable** (xcrun/adb not found):
Skip simulator-based testing and note in the QA report:
"Simulator testing skipped — Xcode / Android SDK not found on this machine."`;
}
