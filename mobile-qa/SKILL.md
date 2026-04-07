---
name: mobile-qa
preamble-tier: 4
version: 1.0.0
description: |
  Mobile QA across a simulator/device matrix. Tests cold start time, keyboard handling,
  scroll jank, safe area rendering, accessibility traversal, rotation, background/foreground
  state, offline behavior, and permission dialogs. Run after build, before /store-ship.
  (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---
<!-- gstack-mobile: mobile-qa/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-qa","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /mobile-qa

Manual + automated QA checklist across the simulator matrix. Run in profile mode, not debug.
Debug mode hides real performance issues. Profile mode shows the truth.

---

## Step 0: Build mode check

```bash
# Flutter: confirm profile or release build, not debug
flutter build apk --profile 2>/dev/null | tail -5 || echo "Build check: run manually"
# Check that you're not using --debug flag anywhere in CI for QA runs
grep -r "flutter run --debug\|flutter test.*debug" .github/ Makefile 2>/dev/null | head -5
```

If the QA is being run against a debug build, warn the user: performance numbers are
meaningless in debug mode. Offer to rebuild in profile mode before continuing.

---

## Step 1: Simulator matrix

Run QA against this matrix. Skip simulators not installed — but flag the gap.

**iOS simulators:**
```bash
xcrun simctl list devices available 2>/dev/null | grep -E "iPhone SE|iPhone 16 Pro|iPhone 16 Pro Max|iPad Pro" | head -10
```

| Device | Why |
|---|---|
| iPhone SE (3rd gen) | Smallest screen, no Dynamic Island, oldest supported baseline |
| iPhone 16 Pro | Dynamic Island, ProMotion 120Hz, latest iOS |
| iPhone 16 Pro Max | Largest iPhone, layout stress test |
| iPad Pro 13" (if iPad supported) | Tablet layout, split-screen |

**Android emulators:**
```bash
emulator -list-avds 2>/dev/null | head -10
```

| Device | Why |
|---|---|
| Pixel 7 (API 33) | Stock Android, reference device |
| Pixel 6a (API 32) | Mid-range performance baseline |
| Samsung Galaxy S24 (API 35) | Most-used Android OEM skin (One UI) |
| API 26 emulator | Minimum supported SDK test |

For each device, record results in the output table at the end.

---

## Step 2: Cold start time

```bash
# Flutter iOS (Instruments)
# Open Instruments -> Time Profiler -> record launch
# Or use: flutter run --profile and check "UI thread" in DevTools

# Android: measure cold start with adb
adb shell am force-stop $(grep applicationId app/build.gradle | head -1 | awk -F'"' '{print $2}') 2>/dev/null
adb shell am start-activity -W -n "$(grep applicationId app/build.gradle | head -1 | awk -F'"' '{print $2}')/$(grep mainActivity AndroidManifest.xml 2>/dev/null | head -1)" 2>/dev/null | grep "TotalTime"
```

Targets:
- iOS on iPhone 13 or newer: cold start to interactive < 1 second
- Android on Pixel 6a (mid-range): cold start to interactive < 2 seconds

Anything over 2 seconds on mid-range Android is a retention risk. Users who wait > 3 seconds
on first open have 50%+ higher next-session churn. Flag if over target.

---

## Step 3: Scroll performance (jank)

```bash
# Flutter: open DevTools Performance tab
flutter run --profile
# In DevTools: open Performance tab, scroll the feed/list, look for red frames (>16ms)
# Target: 99% of frames under 16ms (60fps), 99.9% under 8.3ms (120fps ProMotion)
echo "Open Flutter DevTools -> Performance -> scroll the primary feed/list for 30 seconds"
echo "Record: avg frame time, p99 frame time, number of red frames"
```

Manual checklist:
- [ ] Primary list/feed: scroll at normal speed for 30 seconds — no visible stutter
- [ ] Primary list/feed: fast fling from top to bottom — smooth deceleration, no dropped frames
- [ ] Image-heavy screens: images load progressively, no layout jump when images appear
- [ ] Animated transitions between routes: no jank on push/pop
- [ ] Bottom sheet open/close: smooth, no stutter on first open
- [ ] Keyboard open/close: layout adjusts smoothly, no content jump

Flag any scenario where visible frame drops occur.

---

## Step 4: Keyboard and form behavior

Manual checklist per platform:

**iOS:**
- [ ] Form fields scroll above keyboard when focused (not hidden behind it)
- [ ] "Next" button on keyboard moves focus to the next field
- [ ] "Done" / "Return" on last field dismisses keyboard
- [ ] Dismissing keyboard by tapping outside works on all screens
- [ ] Floating-above-keyboard CTA remains visible when keyboard is open

**Android:**
- [ ] `adjustResize` or `adjustPan` correctly applied — form fields visible above keyboard
- [ ] Keyboard does not cover the primary CTA on any form screen
- [ ] Predictive text bar does not obscure content

**Flutter:**
- [ ] `resizeToAvoidBottomInset: true` (default) on all scaffolds with forms
- [ ] `SingleChildScrollView` wrapping form content — keyboard open → form scrollable

---

## Step 5: Safe area and notch rendering

```bash
# Check for SafeArea widget usage in Flutter
grep -r "SafeArea\|MediaQuery.of.*padding\|viewPadding" lib/ --include="*.dart" 2>/dev/null | wc -l
# Check for unsafe hardcoded top padding
grep -r "SizedBox(height: 44\|SizedBox(height: 48\|padding.*top.*44\|padding.*top.*48" lib/ --include="*.dart" 2>/dev/null | head -10
```

Manual checklist:
- [ ] iPhone 16 Pro (Dynamic Island): status bar area is not occluded by app content
- [ ] iPhone SE: no safe-area violation at bottom (home indicator area)
- [ ] Android with gesture navigation: bottom content not cut off by nav bar
- [ ] Android with 3-button navigation: bottom content not cut off
- [ ] Landscape orientation: safe areas applied on both sides (notch left or right)

---

## Step 6: Permission dialogs

Manual checklist. This matters for both UX and App Store review.

- [ ] Camera permission: dialog appears when user taps a camera-invoking action, not on launch
- [ ] Push notification permission: NOT asked on first launch. Asked after user demonstrates
  intent (e.g., after completing onboarding step 3, after first order, after 3rd session)
- [ ] Location permission: asked contextually, with in-app pre-prompt explaining the reason
- [ ] Contacts / microphone / calendar: only if feature-relevant, only at point of use
- [ ] If any permission is denied: app degrades gracefully, offers a settings deep-link

---

## Step 7: Background / foreground state

Manual checklist:
- [ ] Home button / swipe up → background: app state preserved correctly
- [ ] Return to app after 30 seconds: data not stale, no blank screen, no spinner stuck
- [ ] Return to app after 5 minutes: correct auth state (not logged out unless session expired)
- [ ] Return to app after phone call: UI state intact
- [ ] Low memory condition: app resumes correctly after OS terminates it in background

---

## Step 8: Offline behavior

Manual checklist:
- [ ] Airplane mode on cold launch: app shows offline state, not crash or blank screen
- [ ] Airplane mode mid-session: graceful error message, retry affordance, no data loss
- [ ] Slow network (throttled to 3G): app is usable — loading states visible, no silent timeout
- [ ] Offline → back online: app recovers without requiring manual reload on all key screens

---

## Step 9: Accessibility device tests

```bash
echo "Enable VoiceOver (iOS: Settings > Accessibility > VoiceOver) or TalkBack (Android)"
echo "Navigate the core user flow (onboarding → first key action) using only VoiceOver/TalkBack"
```

Manual checklist:
- [ ] Every interactive element is reachable via VoiceOver/TalkBack swipe navigation
- [ ] All icon-only buttons have semantic labels (not "button button" or empty)
- [ ] Modal/sheet correctly traps focus (VoiceOver cannot escape to content behind the modal)
- [ ] Loading indicators are announced to screen reader
- [ ] Error messages are announced to screen reader when they appear
- [ ] Reading order matches visual top-to-bottom, left-to-right order

---

## Step 10: QA results table

Output a results table for each device tested:

QA MATRIX RESULTS
═══════════════════════════════════════════════════════════
Date: {date}
Build: {version/build number}
Branch: {branch}
Device	OS	Cold Start	Scroll	Keyboard	Safe Area	Offline	A11y
iPhone SE 3	iOS 17	<time>ms	PASS/FAIL	PASS/FAIL	PASS/FAIL	PASS/FAIL	PASS/FAIL
iPhone 16 Pro	iOS 18	<time>ms	...	...	...	...	...
Pixel 7	Android 14	<time>ms	...	...	...	...	...

Critical failures: N
Warnings: N

[List each failure with: Device | Screen | Issue | Severity]
═══════════════════════════════════════════════════════════

Write this table to `~/.gstack/projects/<slug>/mobile-qa-<branch>-<date>.md` for historical
reference.

---

## Step 11: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-qa","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
```

If any CRITICAL failures, block progression to `/store-ship` and invoke AskUserQuestion
asking whether to fix now or defer with a documented known issue.