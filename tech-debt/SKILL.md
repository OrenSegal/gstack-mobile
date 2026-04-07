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

# Flutter: check for Dart SDK
if [ "$_FRAMEWORK" = "Flutter" ]; then
  dart --version 2>/dev/null | head -1 || echo "Dart not found"
fi
```

---

## Step 1: Static analysis (flutter analyze)

```bash
# Run Flutter analyzer
flutter analyze --no-pub 2>&1 | head -50

# Get error/warning counts
_ERRORS=$(flutter analyze --no-pub 2>&1 | grep -c "error •" || echo "0")
_WARNINGS=$(flutter analyze --no-pub 2>&1 | grep -c "warning •" || echo "0")
echo "Errors: $_ERRORS, Warnings: $_WARNINGS"

# Sort by frequency
flutter analyze --no-pub 2>&1 | sort | uniq -c | sort -rn | head -20
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

### Swift deprecated APIs

```bash
# Check for deprecated iOS APIs
grep -rn "UIWebView\|UILabelFont\|initWithFrame:" ios/ --include="*.swift" 2>/dev/null | head -10

# Check for deprecated Swift patterns
grep -rn "@objc\|UIStackView.distribution\|UITableViewStyle.plain" ios/ --include="*.swift" 2>/dev/null | head -10
```

### Kotlin deprecated APIs

```bash
# Check for deprecated Android APIs
grep -rn "setVisibility(View.GONE)\|View.VISIBLE\|findViewById<" android/ --include="*.kt" 2>/dev/null | head -10
```

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
# Check for outdated dependencies
flutter pub outdated --mode=null-safety 2>&1 | head -30

# Check for dependency freshness
flutter pub deps --style=tree 2>&1 | head -20
```

**Target:** All dependencies up-to-date or pinned to known-good versions.

### Swift dependencies (CocoaPods/SPM)

```bash
# Check Podfile for outdated pods
cat ios/Podfile 2>/dev/null | head -30

# Check Package.swift for outdated packages
cat ios/Package.swift 2>/dev/null | head -30
```

---

## Step 6: Code quality issues

### Hardcoded strings

```bash
# Find hardcoded strings that should be localized
grep -rn "'\"['\"]" lib/ --include="*.dart" 2>/dev/null | grep -v "const \|// " | head -30
grep -rn "Text(\|" lib/ --include="*.dart" 2>/dev/null | grep -v "l10n\|intl" | head -20
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