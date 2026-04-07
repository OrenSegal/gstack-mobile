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
if [ "$_IS_IOS" = "1" ]; then
  echo "iOS Cold Start — Instruments Time Profiler:"
  echo "  Xcode → Profile → Time Profiler → Cold Launch template"
  echo "  Target: TTID (Time to Initial Display) < 400ms, TTFD < 1s on iPhone 12+"
  echo ""
  echo "Code-level checks:"
  # Expensive work in AppDelegate/application(_:didFinishLaunchingWithOptions:)
  grep -rn "didFinishLaunchingWithOptions\|applicationDidBecomeActive" \
    ios/ --include="*.swift" 2>/dev/null | head -5
  # @MainActor synchronous blocking
  grep -rn "@MainActor\|DispatchQueue.main.sync\|Thread.sleep" \
    ios/ --include="*.swift" 2>/dev/null | head -10
  echo ""
  echo "Pre-main time checks (dylib count, +initialize methods):"
  echo "  Xcode: DYLD_PRINT_STATISTICS=1 in scheme environment"
  echo "  Target: < 400ms pre-main time"
  echo ""
  echo "Swift Concurrency cold-start anti-patterns:"
  # Tasks launched before first frame
  grep -rn "Task {" ios/ --include="*.swift" 2>/dev/null | head -5
  echo "  Audit Task {} in init() — should be lazy/triggered by view appearance"
fi
```

**iOS perf staples:**
- `TimeProfiler` in Instruments — Time Profiler + App Launch template
- `os_signpost` for custom intervals: `os_signpost(.begin/.end, log:, name:)`
- MetricKit for field data: `MXAppLaunchMetric`, `MXCPUMetric`, `MXMemoryMetric`
- `@MainActor` isolation: never call blocking work from `@MainActor` context
- `Task` leak detection: unstructured Tasks that capture `self` and never cancel

### Android cold start

```bash
if [ "$_IS_ANDROID" = "1" ]; then
  # adb measurement
  echo "adb cold start measurement:"
  echo "  adb shell am start -W -S -n <package>/.MainActivity"
  echo "  Check TotalTime. Target: < 1.5s on Pixel 5, < 2s on mid-range"
  echo ""
  # Check for blocking main thread in Application.onCreate
  grep -rn "class.*Application\|fun onCreate" android/ --include="*.kt" 2>/dev/null | head -10
  # Coroutine leaks or GlobalScope usage (expensive, causes background work on startup)
  grep -rn "GlobalScope\|runBlocking\|Dispatchers.Main.immediate" \
    android/ --include="*.kt" 2>/dev/null | head -10
  echo ""
  echo "Baseline Profiles:"
  grep -r "BaselineProfile\|MacrobenchmarkRule" android/ 2>/dev/null | head -3 \
    || echo "  No Baseline Profile found — add one for 20-30% launch improvement"
  echo ""
  echo "StrictMode (catches accidental disk/network on main thread):"
  grep -rn "StrictMode\|detectDiskReads\|detectNetworkOnMainThread" \
    android/ --include="*.kt" 2>/dev/null | head -5 \
    || echo "  StrictMode not configured in debug builds — add to Application.onCreate"
fi
```

**Android perf staples:**
- Android Profiler (CPU, Memory, Network, Energy tabs)
- Baseline Profiles: `generateBaselineProfile` Gradle task — 20-30% cold start improvement
- `StrictMode` in debug builds: catches disk/network on main thread before prod
- `Macrobenchmark` library for reproducible cold start measurement in CI
- Compose: `@Stable`, `@Immutable` annotations on state classes to reduce recomposition
- ViewModel startup: defer heavy init to `viewModelScope.launch { }`, not `init {}`
- `Dispatchers.Default` for CPU work, `Dispatchers.IO` for disk/network — never block `Main`

### Common cold start optimizations

```bash
# Flutter: lazy loading and async init
grep -rn "FutureBuilder\|StreamBuilder\|lazy\|deferred" lib/ --include="*.dart" 2>/dev/null | head -15
grep -rn "async\|Future\|await" lib/ --include="*.dart" 2>/dev/null | head -20
cat lib/main.dart 2>/dev/null | head -30

# Swift: lazy properties and deferred init
grep -rn "lazy var\|lazy let" ios/ --include="*.swift" 2>/dev/null | head -10

# Kotlin: lazy delegation and coroutine startup
grep -rn "by lazy\|lazyOf\|viewModelScope.launch" android/ --include="*.kt" 2>/dev/null | head -10
```

### Expo / React Native cold start

```bash
if [ "$_FRAMEWORK" = "Expo" ] || [ "$_FRAMEWORK" = "React Native" ]; then
  echo "Expo/RN Cold Start checks:"
  echo "  Target: < 2s JS bundle load on mid-range device (Pixel 5 / iPhone 12)"
  echo ""

  # Hermes engine (required for best perf — enabled by default Expo SDK 48+)
  grep -rn "hermes" package.json android/app/build.gradle 2>/dev/null | head -5 \
    || echo "  WARN: Hermes engine not detected — verify it's enabled in android/app/build.gradle"

  # JS bundle size proxy (large bundle = slow startup)
  if [ -d "node_modules" ]; then
    du -sh node_modules/ 2>/dev/null | head -1
    echo "  Large node_modules may bloat JS bundle via Metro"
  fi

  # Inline requires (deferred module loading — major cold start win)
  grep -rn "getDefaultExport\|inlineRequires" metro.config.js babel.config.js 2>/dev/null | head -5 \
    || echo "  TIP: Enable inline requires in metro.config.js for faster cold start"

  # Heavy imports at top level (should be lazy)
  grep -rn "^import.*from" src/App.tsx src/app/_layout.tsx 2>/dev/null | wc -l | \
    xargs echo "  Top-level imports in App entry:"
  echo "  Review each — defer any that are not needed for first screen"
fi
```

**Expo/RN perf staples:**
- Hermes: bytecode pre-compilation cuts JS parse time 50-70%
- Inline requires (`metro.config.js`): defers module loading until first use
- `expo-splash-screen` keepSplashScreenVisible: hide only after first frame is fully rendered
- `react-native-fast-image` over `Image` for network images (better caching, less re-render)
- `useWindowDimensions` over `Dimensions.get` (reactive to screen size changes)

---

## Step 2: Binary size audit

### Flutter size report

```bash
if [ "$_FRAMEWORK" = "Flutter" ]; then
  # Read existing build artifacts — don't trigger a build here
  ls -lh build/app/outputs/flutter-apk/app-release.apk 2>/dev/null \
    || echo "No APK found — run: flutter build apk --analyze-size"
  ls -lh build/app/outputs/bundle/release/app-release.aab 2>/dev/null || true

  echo "Check build/flutter_assets size:"
  du -sh build/flutter_assets/ 2>/dev/null || echo "Build not found — run flutter build first"

  echo ""
  echo "To get a full size breakdown: flutter build apk --analyze-size"
fi
```

**Targets:**
- iOS IPA: < 100MB (App Store max 150MB)
- Android AAB: < 50MB (Play Console limit)
- Flutter engine: should be stripped

### iOS size breakdown

```bash
if [ "$_IS_IOS" = "1" ]; then
  ls -la ios/Frameworks/ 2>/dev/null | head -10

  # Asset catalog — works for Flutter (Runner) and pure Swift (any .xcassets)
  find . -name "*.xcassets" -maxdepth 4 2>/dev/null | while read d; do
    du -sh "$d" 2>/dev/null
  done
  find ios/ -name "*.png" -o -name "*.jpg" 2>/dev/null | wc -l
fi
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

### Expo / React Native bundle size

```bash
if [ "$_FRAMEWORK" = "Expo" ] || [ "$_FRAMEWORK" = "React Native" ]; then
  # Check if EAS build config exists
  cat eas.json 2>/dev/null | head -30 \
    || echo "No eas.json found — Expo Go or local build only"

  # Source map / bundle size estimate
  find . -name "*.bundle" -o -name "index.android.bundle" 2>/dev/null | \
    xargs ls -lh 2>/dev/null | head -5 \
    || echo "No pre-built bundle found — run: npx react-native bundle --dev false --platform android"

  # Check for unused assets
  find assets/ -name "*.png" -o -name "*.jpg" 2>/dev/null | wc -l | \
    xargs echo "Asset files:"
fi
```

**Targets:**
- JS bundle: < 1MB for fast OTA updates
- Android AAB: < 30MB (EAS managed workflow)
- iOS IPA: < 50MB

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

## Step 4: Memory baseline and concurrency safety

### Flutter memory
```bash
grep -rn "Image\.network\|CachedNetworkImage\|ListView\|GridView" \
  lib/ --include="*.dart" 2>/dev/null | head -20
grep -rn "context\.mounted\|if \(mounted\)" lib/ --include="*.dart" 2>/dev/null | head -10
grep -rn "List<\|Map<\|Array\[" lib/ --include="*.dart" 2>/dev/null | head -20
```

### Swift Concurrency memory and threading
```bash
# Unstructured Task that captures self strongly (potential retain cycle + leak)
grep -rn "Task {" ios/ --include="*.swift" 2>/dev/null | head -15
# Missing [weak self] in async closures
grep -rn "Task {" ios/ --include="*.swift" 2>/dev/null | grep -v "weak self\|\[weak" | head -10
# actor isolation violations — sending non-Sendable across actor boundaries
grep -rn "nonisolated\|@Sendable\|Sendable\b" ios/ --include="*.swift" 2>/dev/null | head -10
# Combine subscription retention — missing store in Set<AnyCancellable>
grep -rn "\.sink(\|AnyCancellable" ios/ --include="*.swift" 2>/dev/null | head -10
```

**Swift perf targets:**
- No `Task {}` in `init()` without structured lifecycle (use `.task {}` modifier in SwiftUI)
- `@Observable` classes (iOS 17+) over `ObservableObject` — fewer redundant redraws
- `actor` for shared mutable state — avoids data races caught by Swift 6 strict concurrency
- Avoid `MainActor.run {}` in hot paths — use `@MainActor` annotation instead

### Kotlin/Compose memory and coroutine safety
```bash
# Coroutine leaks: GlobalScope instead of viewModelScope/lifecycleScope
grep -rn "GlobalScope\." android/ --include="*.kt" 2>/dev/null | head -10
# runBlocking on main thread (UI freeze)
grep -rn "runBlocking" android/ --include="*.kt" 2>/dev/null | head -10
# Compose recomposition: unstable lambdas
grep -rn "onClick = {" android/ --include="*.kt" 2>/dev/null | head -10
# Missing @Stable/@Immutable on data classes passed to Composables
grep -rn "data class\|class.*State" android/ --include="*.kt" 2>/dev/null | head -10
```

**Kotlin/Compose perf targets:**
- `remember { derivedStateOf { } }` for derived Compose state — avoids redundant recomposition
- `@Stable` / `@Immutable` on data classes used in Compose parameters
- `StateFlow.collectAsStateWithLifecycle()` (not `collectAsState`) for lifecycle safety
- No `GlobalScope` — use `viewModelScope` (auto-cancelled on ViewModel clear)
- `LazyColumn`/`LazyRow` key parameter: always supply `key = { item.id }` to enable stable reuse
- Avoid capturing `Context` in `ViewModel` — use `Application` context or Hilt's `@ActivityRetainedScoped`

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

## Step 6: Jank and frame drop detection

### Flutter frame timing

```bash
if [ "$_FRAMEWORK" = "Flutter" ]; then
  echo "Flutter jank detection:"
  echo "  1. Run: flutter run --profile"
  echo "  2. Open DevTools: flutter pub global run devtools"
  echo "  3. Performance overlay: WidgetsApp.showPerformanceOverlay = true"
  echo ""
  echo "Code-level jank signals:"
  # Heavy build() methods
  grep -rn "setState\|notifyListeners\|ref\.invalidate\|ref\.refresh" \
    lib/ --include="*.dart" 2>/dev/null | wc -l | xargs echo "  State updates (audit for frequency):"
  # Synchronous image decoding in build()
  grep -rn "Image\.file\|Image\.memory\b" lib/ --include="*.dart" 2>/dev/null | head -5 \
    && echo "  WARN: Image.file/memory in build() — decode async with ImageProvider"
  # Missing const constructors (forces rebuild every frame)
  grep -rn "new Icon\|new Text\|new Padding\|new SizedBox" lib/ --include="*.dart" 2>/dev/null | head -10 \
    && echo "  WARN: Non-const widgets — add const for widgets with fixed values"
  # RepaintBoundary missing on heavy custom painters
  grep -rn "CustomPainter\|CustomPaint" lib/ --include="*.dart" 2>/dev/null | head -5
  grep -rn "RepaintBoundary" lib/ --include="*.dart" 2>/dev/null | wc -l | \
    xargs echo "  RepaintBoundary usage count (should wrap each CustomPainter):"
fi
```

**Flutter jank targets:**
- UI thread: < 8ms per frame (120fps) / < 16ms (60fps)
- Raster thread: < 8ms per frame
- Use `flutter run --profile` + DevTools timeline to isolate which thread drops frames
- `RepaintBoundary` around expensive widgets prevents full-tree repaint

### iOS frame performance

```bash
if [ "$_IS_IOS" = "1" ]; then
  echo "iOS jank signals:"
  # CALayer animating on main thread
  grep -rn "CALayer\|CAAnimation\|beginDisplayLink\|CADisplayLink" \
    ios/ --include="*.swift" 2>/dev/null | head -10
  # Synchronous disk I/O on main thread
  grep -rn "FileManager\.default\.\(contents\|data\)\|try.*Data(contentsOf" \
    ios/ --include="*.swift" 2>/dev/null | head -5 \
    && echo "  WARN: Synchronous file I/O — move to background queue"
  echo ""
  echo "  Use Instruments → Core Animation to profile frames"
  echo "  Target: < 8ms render time per frame at 120Hz (ProMotion devices)"
fi
```

### Android frame performance

```bash
if [ "$_IS_ANDROID" = "1" ]; then
  echo "Android jank signals:"
  # Blocking main thread operations in Compose
  grep -rn "runBlocking\|Dispatchers\.Main\.immediate" \
    android/ --include="*.kt" 2>/dev/null | head -5 \
    && echo "  WARN: Blocking main thread — move work to Dispatchers.Default/IO"
  # Missing @Stable annotations on Compose state
  grep -rn "data class.*State\|data class.*Ui" android/ --include="*.kt" 2>/dev/null | \
    grep -v "@Stable\|@Immutable" | head -10 \
    && echo "  WARN: Compose state classes missing @Stable/@Immutable — may cause extra recomposition"
  echo ""
  echo "  adb shell dumpsys gfxinfo <package> framestats"
  echo "  Target: < 16ms per frame (60fps). Check 'Janky frames' percentage."
  echo "  Use Android Studio Profiler → CPU → Trace System Calls for frame timeline"
fi
```

### Expo / React Native frame performance

```bash
if [ "$_FRAMEWORK" = "Expo" ] || [ "$_FRAMEWORK" = "React Native" ]; then
  echo "React Native jank signals:"
  # JS thread blocking (animations must be on UI thread)
  grep -rn "Animated\." src/ --include="*.tsx" --include="*.ts" 2>/dev/null | \
    grep -v "useNativeDriver.*true" | head -10 \
    && echo "  WARN: Animated without useNativeDriver: true — runs on JS thread, drops frames"
  # FlatList without getItemLayout (causes layout recalculation per scroll)
  grep -rn "<FlatList" src/ --include="*.tsx" 2>/dev/null | \
    grep -v "getItemLayout" | head -5 \
    && echo "  WARN: FlatList without getItemLayout — add for fixed-height items to prevent layout jank"
  echo ""
  echo "  Enable Systrace: npx react-native profile-hermes"
  echo "  Target: 60fps JS thread + UI thread. Jank budget: < 2 dropped frames per 100."
fi
```

---

## Step 7: Output

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

JANK
- Frame drops detected: {N}
- Flutter jank sources: {description or "none found"}
- Verdict: PASS / FAIL

IMAGES
- Unoptimized images (>1MB): {N}
- Missing @3x variants: {N}
- WebP opportunity: {N}

OVERALL VERDICT: PASS / FAIL / REGRESSION
═══════════════════════════════════════════════════════════

If FAIL, fix before proceeding to /store-ship.

---

## Step 8: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"perf-audit","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"perf-audit","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `pass`, `fail`, or `regression`.