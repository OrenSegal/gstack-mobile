---
name: perf-audit
preamble-tier: 4
version: 1.0.0
description: |
  Mobile performance audit: cold start time, bundle size, network waterfall,
  and memory baseline. Benchmarks against targets and flags regressions.
  Run before /store-ship and monthly. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---
<!-- gstack-mobile: perf-audit/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"perf-audit","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /perf-audit

Cold start & binary size compound over time. This audit measures the performance
metrics that directly impact user perception and flags regressions before ship.

---

## Step 0: Detect framework and platform

```bash
# Detect framework
if [ -f "pubspec.yaml" ]; then
  grep -q "flutter:" pubspec.yaml && _FRAMEWORK="Flutter" || _FRAMEWORK="Expo"
elif [ -f "package.json" ]; then
  _FRAMEWORK="React Native"
elif [ -d "ios" ] && [ -f "ios/Runner.xcodeproj/project.pbxproj" ]; then
  _FRAMEWORK="Swift"
elif [ -d "android" ] && [ -f "android/app/build.gradle" ]; then
  _FRAMEWORK="Kotlin"
else
  _FRAMEWORK="unknown"
fi
echo "Framework: $_FRAMEWORK"

# Detect target platforms
_IS_IOS=0
_IS_ANDROID=0
[ -d "ios" ] && _IS_IOS=1
[ -d "android" ] && _IS_ANDROID=1
echo "iOS: $_IS_IOS, Android: $_IS_ANDROID"
```

---

## Step 1: Cold start time

### Flutter cold start

```bash
# Enable startup tracing
echo "To measure Flutter cold start:"
echo "1. Run: flutter run --trace-startup"
echo "2. Look for 'FlutterEngine: AllowRendering' timestamp"
echo "3. First frame timestamp = cold start time"
echo ""
echo "Target: < 2 seconds for cold start on mid-range device"
echo ""

# Check for heavy initializers
grep -rn "initState\|constructor\|WidgetsFlutterBinding.ensureInitialized" \
  lib/ --include="*.dart" 2>/dev/null | head -10
```

### iOS cold start

```bash
# Check if measuring iOS cold start
if [ "$_IS_IOS" = "1" ]; then
  echo "iOS Cold Start Measurement:"
  echo "1. Open Xcode → Devices → select device"
  echo "2. Run: xcrun simctl launch --console booted <device_id>"
  echo "3. Measure time from launch to first frame"
  echo ""
  echo "Target: < 1 second for cold start on iPhone 12+"
fi
```

### Android cold start

```bash
# Check for Android cold start measurement
if [ "$_IS_ANDROID" = "1" ]; then
  echo "Android Cold Start Measurement:"
  echo "1. adb shell am start -W -S -n <package>/.MainActivity"
  echo "2. Check TotalTime in output"
  echo ""
  echo "Target: < 1.5 seconds for cold start on Pixel 5+"
fi
```

### Common cold start optimizations

```bash
# Check for lazy loading
grep -rn "FutureBuilder\|StreamBuilder\|lazy\|deferred" lib/ --include="*.dart" 2>/dev/null | head -15

# Check for async initialization
grep -rn "async\|Future\|await" lib/ --include="*.dart" 2>/dev/null | head -20

# Check main.dart for blocking operations
cat lib/main.dart 2>/dev/null | head -30
```

---

## Step 2: Binary size audit

### Flutter size report

```bash
# Run size analysis
flutter build apk --analyze-size 2>&1 | head -50

# Check APK/AAB size
ls -lh build/app/outputs/flutter-apk/app-release.apk 2>/dev/null || true
ls -lh build/app/outputs/bundle/release/app-release.aab 2>/dev/null || true

# Get breakdown by category
echo "Check build/flutter_assets size:"
du -sh build/flutter_assets/ 2>/dev/null || echo "Build not found"
```

**Targets:**
- iOS IPA: < 100MB (App Store max 150MB)
- Android AAB: < 50MB (Play Console limit)
- Flutter engine: should be stripped

### iOS size breakdown

```bash
# Check for unused frameworks
ls -la ios/Frameworks/ 2>/dev/null | head -10

# Check for asset bloat
du -sh ios/Runner/Assets.xcassets/ 2>/dev/null
find ios/ -name "*.png" -o -name "*.jpg" 2>/dev/null | wc -l
```

### Android size breakdown

```bash
# Check native libraries
find android/app/src/main/jniLibs -name "*.so" 2>/dev/null | head -10
du -sh android/app/src/main/jniLibs/ 2>/dev/null

# Check assets
find android/app/src/main/res -name "*.png" -o -name "*.jpg" 2>/dev/null | wc -l
du -sh android/app/src/main/res/ 2>/dev/null
```

### Size optimization checklist

```bash
# Check for uncompressed assets
find . -name "*.png" -size +500k 2>/dev/null | head -10
find . -name "*.jpg" -size +500k 2>/dev/null | head -10

# Check for missing WebP/AVIF
ls -la assets/ 2>/dev/null | head -10

# Check for debug symbols
ls -la build/app/intermediates/ 2>/dev/null | head -10
```

---

## Step 3: Network waterfall analysis

```bash
# Find network calls in codebase
grep -rn "http\|HttpClient\|Dio\|URLSession\|fetch\|axios" \
  lib/ --include="*.dart" 2>/dev/null | head -20

# Check for blocking initial network calls
grep -rn "initState\|main\|runApp" lib/ --include="*.dart" 2>/dev/null | head -10

# Look for parallel vs serial API calls
grep -rn "Future\.wait\|await\|then\|whenComplete" lib/ --include="*.dart" 2>/dev/null | head -20
```

**Issues to flag:**
- API calls in main() before first paint
- Serial (sequential) API calls that could be parallel
- No loading states for network-heavy initial screens
- Missing request batching

---

## Step 4: Memory baseline

```bash
# Check for memory-intensive operations
grep -rn "Image\.network\|CachedNetworkImage\|ListView\|GridView" \
  lib/ --include="*.dart" 2>/dev/null | head -20

# Check for memory leaks (static context references)
grep -rn "context\.mounted\|if \(mounted\)" lib/ --include="*.dart" 2>/dev/null | head -10

# Check for large data in memory
grep -rn "List<\|Map<\|Array\[" lib/ --include="*.dart" 2>/dev/null | head -20
```

**Target:** App stays under 150MB RSS at idle.

---

## Step 5: Image asset audit

```bash
# Find unoptimized images
find . -name "*.png" -size +1M 2>/dev/null | head -10
find . -name "*.jpg" -size +1M 2>/dev/null | head -10

# Check for missing 3x images
find . -name "*@2x.png" 2>/dev/null | wc -l
find . -name "*@3x.png" 2>/dev/null | wc -l

# Check for WebP opportunity
ls -la assets/images/ 2>/dev/null | head -10
```

---

## Step 6: Output

PERFORMANCE AUDIT
═══════════════════════════════════════════════════════════

Date: {date}
Framework: {Flutter / Expo / Swift / Kotlin}

COLD START
- Measured time: {N}s
- Target: < 2s (Flutter) / < 1s (iOS) / < 1.5s (Android)
- Blocking initializers found: {N}
- Verdict: PASS / FAIL

BINARY SIZE
- iOS IPA: {N}MB (target: <100MB)
- Android AAB: {N}MB (target: <50MB)
- Regression from last build: {+N% / -N%}
- Large assets found: {N}
- Verdict: PASS / FAIL

NETWORK WATERFALL
- Blocking initial API calls: {N}
- Serial calls that could be parallel: {N}
- Verdict: PASS / FAIL

MEMORY
- Memory-intensive operations: {N}
- Verdict: PASS / FAIL

IMAGES
- Unoptimized images (>1MB): {N}
- Missing @3x variants: {N}
- WebP opportunity: {N}

OVERALL VERDICT: PASS / FAIL / REGRESSION
═══════════════════════════════════════════════════════════

If FAIL, fix before proceeding to /store-ship.

---

## Step 7: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"perf-audit","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"perf-audit","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `pass`, `fail`, or `regression`.