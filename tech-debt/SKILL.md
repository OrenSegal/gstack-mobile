---
name: tech-debt
preamble-tier: 4
version: 1.0.0
description: |
  Technical debt audit and removal. Scans for deprecated APIs, dead code, dependency
  freshness, file/function size violations, and hardcoded strings. Produces a ranked
  debt score with auto-fixable vs. manual items. Run monthly or before major releases.
  (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---
<!-- gstack-mobile: tech-debt/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"tech-debt","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /tech-debt

Deprecated APIs break on OS upgrades with no warning. This audit surfaces the
technical debt that compounds over time and provides a prioritized removal plan.

---

## Step 0: Detect framework

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

# Flutter: check for Dart SDK
if [ "$_FRAMEWORK" = "Flutter" ]; then
  dart --version 2>/dev/null | head -1 || echo "Dart not found"
fi
```

---

## Step 1: Static analysis (flutter analyze)

```bash
if [ "$_FRAMEWORK" = "Flutter" ]; then
  _ANALYSIS=$(flutter analyze --no-pub 2>&1)
  echo "$_ANALYSIS" | head -50
  _ERRORS=$(echo "$_ANALYSIS" | grep -c "error •" || echo "0")
  _WARNINGS=$(echo "$_ANALYSIS" | grep -c "warning •" || echo "0")
  echo "Errors: $_ERRORS, Warnings: $_WARNINGS"
  echo "$_ANALYSIS" | sort | uniq -c | sort -rn | head -20
else
  echo "flutter analyze: not applicable for $_FRAMEWORK — use Xcode Analyze (iOS) or Android Lint (Android)"
fi
```

**Target:** 0 errors, warnings < 10.

---

## Step 2: Deprecated API usage

### Flutter deprecated APIs

```bash
# Check for deprecated Flutter APIs
grep -rn "withOpacity\|TextTheme\.headline\|FlatButton\|RaisedButton\|DefaultTabController" \
  lib/ --include="*.dart" 2>/dev/null | head -20

# Check for deprecated Material widgets
grep -rn "Card theme\|ButtonTheme\|PopupMenuButton" lib/ --include="*.dart" 2>/dev/null | head -10

# Check for deprecated Riverpod patterns
grep -rn "Provider\|FutureProvider\|StreamProvider" lib/ --include="*.dart" 2>/dev/null \
  | grep -v "riverpod\|flutter_riverpod" | head -10
```

**Common deprecations:**
- `withOpacity()` → use `withValues(alpha: x)` (2024+)
- `FlatButton` / `RaisedButton` → use `TextButton` / `FilledButton`
- `TextTheme.headline` → use `TextTheme.displayLarge` etc.
- `Scaffold.showSnackBar` → use `ScaffoldMessenger.of(context).showSnackBar`

### Swift deprecated APIs and modernization debt

```bash
# UIKit → SwiftUI migration debt
grep -rn "UIViewController\|UITableView\|UICollectionView\|UINavigationController\|UITabBarController" \
  ios/ --include="*.swift" 2>/dev/null | grep -v "Representable\|Hosting" | wc -l | xargs echo "UIKit screens not yet migrated:"

# Deprecated NavigationView → NavigationStack (iOS 16+)
grep -rn "NavigationView\b" ios/ --include="*.swift" 2>/dev/null | head -10

# Deprecated ObservableObject → @Observable macro (iOS 17+)
grep -rn "ObservableObject\|@Published\|@StateObject\|@ObservedObject" \
  ios/ --include="*.swift" 2>/dev/null | head -20

# Combine → Swift Concurrency debt (async/await preferred for new code)
grep -rn "\.sink(\|\.assign(\|AnyCancellable\|PassthroughSubject\|CurrentValueSubject" \
  ios/ --include="*.swift" 2>/dev/null | head -20

# CoreData → SwiftData migration candidates (iOS 17+)
grep -rn "NSManagedObject\|NSFetchRequest\|NSPersistentContainer\|@NSManaged" \
  ios/ --include="*.swift" 2>/dev/null | head -15

# Deprecated UIWebView (auto-reject by App Store)
grep -rn "UIWebView\|WebView" ios/ --include="*.swift" 2>/dev/null | head -5

# @objc bridging overhead (performance + maintenance debt)
grep -rn "^@objc\b\|@objc func\|@objcMembers" ios/ --include="*.swift" 2>/dev/null | head -15

# State management: check for TCA, vanilla ObservableObject patterns
grep -rn "ComposableArchitecture\|TCAFeature\|@Reducer\|Store<\|WithViewStore" \
  ios/ --include="*.swift" 2>/dev/null | head -5 \
  && echo "TCA detected" || echo "No TCA — check if ObservableObject pattern is consistent"
```

**Common Swift modernization targets:**
- `NavigationView` → `NavigationStack` / `NavigationSplitView` (iOS 16+, avoids double-column bugs)
- `@Published` + `ObservableObject` → `@Observable` macro (iOS 17+, fewer redraws)
- `Combine` pipelines for simple async → `async/await` with `AsyncStream` or `AsyncSequence`
- `CoreData` → `SwiftData` for new models on iOS 17+ targets
- State management: TCA for complex flows, `@Observable` + `@State` for simple screens

### Kotlin deprecated APIs and modernization debt

```bash
# XML layouts → Jetpack Compose migration debt
find android/ -name "*.xml" -path "*/layout/*" 2>/dev/null | wc -l | xargs echo "XML layout files (Compose migration candidates):"
grep -rn "setContentView\|inflate\|LayoutInflater\|ViewBinding\|DataBinding" \
  android/ --include="*.kt" 2>/dev/null | head -20

# LiveData → StateFlow/SharedFlow migration debt (modern coroutine-based)
grep -rn "LiveData\|MutableLiveData\|observe(\|observeAsState()" \
  android/ --include="*.kt" 2>/dev/null | head -20

# Deprecated ViewModel patterns
grep -rn "ViewModelProvider\|viewModelScope\|lifecycleScope" \
  android/ --include="*.kt" 2>/dev/null | head -10

# Dagger → Hilt migration (Hilt is the recommended DI since 2020)
grep -rn "@Component\|@Module\|@Inject\|DaggerAppComponent\|AppComponent" \
  android/ --include="*.kt" 2>/dev/null | grep -v "@HiltAndroidApp\|@HiltViewModel\|@Inject" | head -15

# SharedPreferences → DataStore migration (SharedPreferences not safe for coroutines)
grep -rn "SharedPreferences\|getSharedPreferences\|PreferenceManager" \
  android/ --include="*.kt" 2>/dev/null | head -15

# Legacy threading: Handler, AsyncTask (removed API 30+), Thread
grep -rn "AsyncTask\|Handler()\|Looper.getMainLooper\|Thread {" \
  android/ --include="*.kt" 2>/dev/null | head -15

# findViewById (View Binding / Compose should replace all)
grep -rn "findViewById<" android/ --include="*.kt" 2>/dev/null | head -10

# Jetpack Navigation: FragmentManager → NavController
grep -rn "getSupportFragmentManager\|beginTransaction\|FragmentTransaction" \
  android/ --include="*.kt" 2>/dev/null | head -10
```

**Common Kotlin modernization targets:**
- `LiveData` → `StateFlow` + `collectAsStateWithLifecycle()` (Compose-safe, lifecycle-aware)
- `SharedPreferences` → `DataStore<Preferences>` (coroutine-safe, no ANR risk)
- Dagger → Hilt (less boilerplate, first-class ViewModel integration via `@HiltViewModel`)
- `AsyncTask` (removed) / `Handler` → Kotlin coroutines with `Dispatchers.Main`
- XML layouts → Jetpack Compose (incremental: `ComposeView` in fragments as bridge)
- `Room` + `LiveData` → `Room` + `Flow` (reactive queries without LiveData overhead)
- WorkManager for background: check for raw `Service` / `IntentService` (deprecated)

### Expo / React Native deprecated APIs and modernization debt

```bash
if [ "$_FRAMEWORK" = "Expo" ] || [ "$_FRAMEWORK" = "React Native" ]; then
  # React Navigation: v5 patterns deprecated in v6+
  grep -rn "NavigationContainer\|useNavigation\|createStackNavigator" \
    src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -10
  grep -rn "createStackNavigator\b" src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -5 \
    && echo "  WARN: createStackNavigator (v5) → createNativeStackNavigator (v6+) for native feel"

  # Reanimated 1 (incompatible with Fabric/New Architecture)
  grep -rn "Animated\.Value\|Animated\.event\b" \
    src/ --include="*.tsx" --include="*.ts" 2>/dev/null | head -10 \
    && echo "  WARN: Animated API (v1 style) → Reanimated 2+ useSharedValue/useAnimatedStyle"

  # AsyncStorage direct from react-native (removed, use @react-native-async-storage)
  grep -rn "from 'react-native'.*AsyncStorage\|AsyncStorage.*from 'react-native'" \
    src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -5 \
    && echo "  CRITICAL: AsyncStorage removed from react-native core — use @react-native-async-storage/async-storage"

  # Expo SDK: check for deprecated modules
  grep -rn "expo-permissions\|Permissions\.askAsync" \
    src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -5 \
    && echo "  CRITICAL: expo-permissions removed in SDK 46 — use module-specific permission hooks"

  # FlatList missing keyExtractor (performance debt)
  grep -rn "<FlatList" src/ --include="*.tsx" 2>/dev/null \
    | grep -v "keyExtractor" | head -10 \
    && echo "  WARN: FlatList without keyExtractor — add for stable list rendering"
fi
```

**Common Expo/React Native modernization targets:**
- `createStackNavigator` → `createNativeStackNavigator` (React Navigation 6+, uses native UINavigationController/Fragment)
- `Animated.Value` → Reanimated 2 `useSharedValue` (runs on UI thread, no JS bridge)
- `AsyncStorage` from `react-native` → `@react-native-async-storage/async-storage`
- `expo-permissions` → module-specific hooks (`useCameraPermissions`, `useMediaLibraryPermissions`)
- Class components → functional components with hooks

---

## Step 3: Dead code detection

```bash
# Find unused functions (basic heuristic)
grep -rn "void \|function \|def \|func " lib/ --include="*.dart" 2>/dev/null | head -30

# Find unreachable code
grep -rn "return;\|throw \|assert(false)" lib/ --include="*.dart" 2>/dev/null | head -20

# Find commented-out code blocks
grep -rn "//.*function\|//.*class\|//.*void" lib/ --include="*.dart" 2>/dev/null | head -10

# Check for TODO/FIXME that are stale
grep -rn "TODO\|FIXME\|HACK\|XXX" lib/ --include="*.dart" 2>/dev/null | head -30
```

---

## Step 4: File and function size analysis

### Large files

```bash
# Find files > 500 lines
find lib/ -name "*.dart" -exec wc -l {} \; 2>/dev/null | awk '$1 > 500' | sort -rn | head -15
```

**Target:** No file > 500 lines (refactor into smaller modules).

### Large functions

```bash
# Find functions > 50 lines (basic heuristic)
grep -rn "^\s*void\|^\s*Future\|^\s*Widget\|^\s*Widget? " lib/ --include="*.dart" 2>/dev/null | head -30

# Check for setState with >20 lines
grep -rn "setState(" lib/ --include="*.dart" 2>/dev/null | head -20
```

**Target:** No function > 50 lines (extract to smaller methods).

---

## Step 5: Dependency analysis

### Flutter dependencies

```bash
if [ "$_FRAMEWORK" = "Flutter" ]; then
  # Check for outdated dependencies
  flutter pub outdated 2>&1 | head -30

  # Check for dependency freshness
  flutter pub deps --style=tree 2>&1 | head -20
fi
```

**Target:** All dependencies up-to-date or pinned to known-good versions.

### Swift dependencies (CocoaPods/SPM)

```bash
# Check Podfile for outdated pods
cat ios/Podfile 2>/dev/null | head -30

# Check Package.swift for outdated packages
cat ios/Package.swift 2>/dev/null | head -30
```

### Expo / React Native dependencies

```bash
if [ "$_FRAMEWORK" = "Expo" ]; then
  # expo-doctor catches SDK version mismatches, incompatible packages, config issues
  which npx 2>/dev/null && npx expo-doctor 2>&1 | head -40 \
    || echo "npx not found — run: npx expo-doctor"

  # Check for outdated packages
  npx expo install --check 2>&1 | head -20 \
    || echo "Run: npx expo install --check to find incompatible package versions"
elif [ "$_FRAMEWORK" = "React Native" ]; then
  npm outdated 2>&1 | head -20 || yarn outdated 2>&1 | head -20 || true
fi
```

---

## Step 6: Code quality issues

### Hardcoded strings

```bash
# Flutter: hardcoded strings in Text() widgets (not localized)
if [ "$_FRAMEWORK" = "Flutter" ]; then
  grep -rn 'Text("[^"]\+")' lib/ --include="*.dart" 2>/dev/null \
    | grep -v "//\|l10n\|intl\|AppLocalizations\|S\.of" | head -20
fi
# Swift: hardcoded user-facing strings (not NSLocalizedString)
if [ "$_IS_IOS" = "1" ]; then
  grep -rn '"[A-Z][a-z]' ios/ --include="*.swift" 2>/dev/null \
    | grep -v "//\|NSLocalizedString\|\.localized\b" | head -20
fi
# Kotlin: hardcoded user-facing strings (not getString/stringResource)
if [ "$_IS_ANDROID" = "1" ]; then
  grep -rn '"[A-Z][a-z]' android/ --include="*.kt" 2>/dev/null \
    | grep -v "//\|getString\|stringResource\|R\.string" | head -20
fi
```

### Missing const constructors

```bash
# Find widgets that could be const
grep -rn "Text(\|Icon(\|Padding(\|SizedBox(" lib/ --include="*.dart" 2>/dev/null \
  | grep -v "const " | head -20
```

### Type safety bypasses

```bash
# Find dynamic usage
grep -rn "dynamic\|Object?\|Any" lib/ --include="*.dart" 2>/dev/null | head -20

# Find unsafe casts
grep -rn "as\|is\|runtimeType" lib/ --include="*.dart" 2>/dev/null | head -20
```

---

## Step 7: Output

TECH DEBT AUDIT
═══════════════════════════════════════════════════════════

Date: {date}
Framework: {Flutter / Expo / Swift / Kotlin}

ANALYSIS
- Flutter analyze errors: {N}
- Flutter analyze warnings: {N}
- Large files (>500 lines): {N}
- Large functions (>50 lines): {N}
- Deprecated APIs found: {N}
- Hardcoded strings: {N}

DEPRECATED APIs (fix first)
[CRITICAL] {api} in {file:line} — use {replacement}
...

DEAD CODE
[MEDIUM] Unused function: {file:line}
[MEDIUM] Stale TODO: {file:line}

FILE/FUNCTION SIZE
[MEDIUM] {file}: {N} lines — refactor into smaller modules

DEPENDENCY ISSUES
[LOW] Outdated: {package} {current} → {latest}
...

CODE QUALITY
[HIGH] Hardcoded strings: {N} — move to l10n
[HIGH] Missing const constructors: {N} — add const

DEBT SCORE: {0-100}
Top 10 items by effort × impact:

1. {item} — {effort} effort, {impact} impact
2. {item} — {effort} effort, {impact} impact
...

VERDICT: HEALTHY / NEEDS_WORK / CRITICAL
═══════════════════════════════════════════════════════════

---

## Step 8: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"tech-debt","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"tech-debt","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `healthy`, `needs_work`, or `critical`.