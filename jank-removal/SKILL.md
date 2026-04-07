---
name: jank-removal
preamble-tier: 4
version: 1.0.0
description: |
  Mobile performance diagnosis and fixing. Measures cold start time, detects dropped frames
  (jank), finds memory leaks, identifies battery drain sources, and optimizes list scroll.
  Run AFTER /mobile-qa when performance regresses, or standalone when users report lag.
  (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - AskUserQuestion
  - WebSearch
---
<!-- gstack-mobile: jank-removal/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"jank-removal","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /jank-removal

Mobile performance is UX. Users who experience jank churn at 2x the rate of smooth apps.
This skill finds and fixes the specific things that make your app feel slow.

---

## Step 0: Identify symptom

Ask the user or check the issue:
- **Cold start slow?** (time from tap to interactive)
- **Jank during scroll?** (dropped frames, stuttering)
- **Memory growth?** (app gets slower over time)
- **Battery drain?** (unusual background activity)
- **Specific screen slow?** (which screen?)

---

## Step 1: Cold start measurement

```bash
# iOS: measure with Instruments or quick timing
echo "iOS: Use Flutter DevTools timeline or manual stopwatch"
echo "Target: <1s on iPhone 13+, <2s on mid-range Android"

# Android: use ADB
adb shell am force-stop $(grep applicationId android/app/build.gradle 2>/dev/null | head -1 | awk -F'"' '{print $2}') 2>/dev/null
adb shell am start-activity -W -n "$(grep applicationId android/app/build.gradle | head -1 | awk -F'"' '{print $2}')/$(grep mainActivity AndroidManifest.xml | head -1)" 2>/dev/null | grep TotalTime
```

**Targets:**
- iOS: < 1 second to interactive
- Android: < 2 seconds to interactive (mid-range device)

If over: check for synchronous initialization, heavy widgets in `main()`, large splash.

---

## Step 2: Jank detection (scroll/animation)

```bash
# Flutter: use DevTools Performance view
# flutter run --profile
# Open DevTools -> Performance -> record 30s of scrolling

# Or: check for common jank patterns in code
grep -r "setState\|StreamBuilder\|FutureBuilder" lib/ --include="*.dart" -l 2>/dev/null | head -10
grep -r "Builder\|builder:" lib/ --include="*.dart" -l 2>/dev/null | head -10
```

Common jank causes:
- [ ] `setState` in `build()` — use `const`, memoize, or move to provider notifier
- [ ] Missing `const` constructors on static widgets
- [ ] `ListView` with `children` instead of `ListView.builder`
- [ ] Images without `cacheWidth`/`cacheHeight` — decoded at full size
- [ ] Unnecessary repaints — missing `RepaintBoundary` on static areas

---

## Step 3: Memory leak detection

```bash
# Flutter: use DevTools Memory view
# flutter run --profile
# Open DevTools -> Memory -> track allocations over time

# Check for common leak patterns
grep -r "StreamSubscription\|controller\.add\|listener" lib/ --include="*.dart" -l 2>/dev/null | head -10

# Check for missing dispose
grep -r "dispose\|onDispose\|close" lib/ --include="*.dart" -l 2>/dev/null | head -10
```

Common leaks:
- [ ] `StreamSubscription` not cancelled in `dispose()`
- [ ] `AnimationController` not disposed
- [ ] `TextEditingController` not disposed
- [ ] Listeners not removed (bloc, ChangeNotifier)
- [ ] Captured closures holding `this`

---

## Step 4: Battery drain investigation

```bash
# Check for background activity
grep -r "Timer\|PeriodicTimer\|BackgroundTasks\|workmanager\|flutter_background_service" \
  lib/ --include="*.dart" -l 2>/dev/null | head -10

# Check for excessive network calls
grep -r "timer\|interval\|periodic" lib/ --include="*.dart" -l 2>/dev/null | head -10
```

Battery killers:
- [ ] Background timers running too frequently
- [ ] Location updates in background without significant movement
- [ ] Continuous network polling
- [ ] Excessive analytics events (batching not used)
- [ ] Animations that don't respect reduced motion

---

## Step 5: List scroll optimization

```bash
# Check list implementation
grep -r "ListView\|ListView.builder\|SliverList\|RecyclerView" lib/ --include="*.dart" -l 2>/dev/null | head -10

# Check for images in lists
grep -r "Image\|CachedNetworkImage\|network" lib/ --include="*.dart" -l 2>/dev/null | head -10
```

List optimizations:
- [ ] Use `ListView.builder` (lazy loading), not `ListView` with children array
- [ ] Images in lists MUST have `cacheWidth`/`cacheHeight` or `fit: BoxFit.cover`
- [ ] Use `AutomaticKeepAliveClientMixin` if keeping items alive
- [ ] Pagination: load more when within 5-10 items of end

---

## Step 6: Platform-specific checks

**iOS:**
- [ ] Use `debugPrint` sparingly in release builds
- [ ] No `print()` statements in production
- [ ] Test on actual device, not simulator (simulator is faster)

**Android:**
- [ ] `minifyEnabled true` in release (R8 removes dead code)
- [ ] `shrinkResources true` removes unused resources
- [ ] Test on mid-range device (Pixel 6a), not flagship

**Flutter:**
- [ ] Run in profile mode (`flutter run --profile`), not debug
- [ ] Profile in DevTools shows actual frame times

---

## Step 7: Output format

JANK REMOVAL REPORT
═══════════════════════════════════════════════════════════
Symptom: {cold start / scroll jank / memory / battery / specific screen}

Root causes found:
1. {issue} - {file:line} - {fix}
2. ...

Quick wins available: YES / NO
Estimated improvement: {% or time reduction}

Next steps:
1. {first fix to apply}
2. {second fix to apply}

VERDICT: FIXED / NEEDS MORE WORK / UNABLE TO REPRODUCE
═══════════════════════════════════════════════════════════

---

## Step 8: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"jank-removal","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
```