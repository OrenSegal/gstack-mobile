---
name: hig-review
<<<<<<< HEAD
description: Review a mobile UI plan or diff against iOS Human Interface Guidelines, Android Material guidance, accessibility, platform conventions, and app-store-risky UX before code is written.
=======
preamble-tier: 4
version: 1.0.0
description: |
  Mobile Human Interface Guidelines audit. Reviews iOS HIG and Material Design
  compliance across navigation, typography, spacing, icons, gestures, and accessibility.
  Run before /store-ship on any UI change or on first mobile implementation. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - WebSearch
  - AskUserQuestion
---
<!-- gstack-mobile: hig-review/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"hig-review","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

If platform is not Flutter/Expo/Swift/Kotlin (native), note the limitation and proceed
with code-level analysis. Physical device review is out of scope for this skill.

>>>>>>> f076cd8e (feat(mobile): add hig-review skill for iOS HIG and Material Design audit)
---

# /hig-review

<<<<<<< HEAD
Run this before writing code for any user-facing mobile change. This skill reviews proposed UX, screenshots, mockups, specs, or diffs for platform correctness and flags App Store / Play risk early.

## Use when

- Adding or changing onboarding, navigation, tabs, sheets, settings, forms, paywalls, permission prompts, or notifications.
- Porting a web flow directly into a mobile app.
- Building the same feature across Flutter, Swift, Kotlin, or Expo and you want platform-aware guidance.
- Preparing a feature for implementation and you want to avoid "design review after code."

## Inputs

Collect or infer:

- Platform: `flutter`, `swift`, `kotlin`, or `expo`.
- Target OS: iOS, Android, or both.
- Entry surface: onboarding, home, details, paywall, settings, etc.
- Artifacts: screenshots, mocks, PRD, spec, component tree, or current implementation diff.
- Whether this flow touches permissions, payments, account creation, push, or sensitive data.

If platform is missing:
- Read `~/.gstack/config` or project docs if available.
- If still unclear, ask one concise question before proceeding.

## Review standard

Audit the change across these dimensions:

1. Navigation model
- iOS should feel native to iOS, Android to Android.
- Flag web-style modal stacks, broken back behavior, missing swipe-to-go-back support, and tab misuse.

2. Layout and ergonomics
- Safe areas, keyboard avoidance, one-handed reachability, bottom CTA visibility, notch/home-indicator conflicts.
- Flag tap targets below platform minimums and dense layouts that break at larger text sizes.

3. Typography and platform tone
- Check hierarchy, legibility, Dynamic Type / font scaling resilience, truncation, and visual weight.
- Flag visually "webby" UI that ignores platform rhythm.

4. Components
- Sheets vs dialogs vs full-screen covers; segmented controls vs tabs; native date/time pickers; destructive action placement.
- Flag cross-platform abstractions that erase useful platform conventions.

5. Accessibility
- VoiceOver/TalkBack semantics, focus order, labels, contrast, reduced motion, loading-state announcements.
- Flag icon-only controls without labels and inaccessible gesture-only interactions.

6. Permissions and trust
- Notification, location, camera, contacts prompts must happen after user intent, not on first launch.
- Flag premature permission asks and vague rationale copy.

7. App store risk
- Forced signup before value, deceptive subscription framing, hidden pricing, misleading CTAs, broken restore purchase, abusive review prompts.
- Flag likely App Review / Play policy issues explicitly.

## Output format

Use this exact structure:

### Verdict
One paragraph with a blunt recommendation:
- `PASS`
- `PASS WITH WARNINGS`
- `FAIL`

### Critical issues
Bullets only. Include only issues that should block implementation or ship.

### Warnings
Bullets only. Important but non-blocking.

### Platform-specific notes
Split into:
- `iOS`
- `Android`
- `Flutter / shared`
Only include sections that apply.

### Recommended implementation
Give the most opinionated implementation path, not a menu of equal options.

### Build checklist
Provide a short, execution-ready checklist for the engineer and designer.

## Style

- Be direct and specific.
- Prefer "do this" over "consider this."
- Optimize for native feel, activation, clarity, and review safety.
- Do not praise mediocre work.
- Do not default to web conventions when mobile-native patterns exist.

## Mobile-specific checks

Always check for:

- Safe area handling.
- Keyboard overlap on forms.
- Back navigation correctness.
- Loading and empty states.
- Error state clarity.
- Offline or slow-network behavior.
- Dynamic text scaling.
- Dark mode resilience.
- Notification permission timing if relevant.
- Subscription / restore purchase compliance if relevant.

## AARRR lens

When relevant, include:
- Acquisition risk: weak first impression, store-screenshot mismatch.
- Activation risk: too many steps before core value.
- Retention risk: annoying permissions, push misuse, jank, poor empty states.
- Revenue risk: paywall confusion, failed trust signals, unclear pricing.
- Referral risk: missing shareability or no post-success delight.

## Examples

Good prompts:
- `/hig-review review this onboarding redesign for a Flutter app before implementation`
- `/hig-review evaluate this paywall flow for iOS and Android store risk`
- `/hig-review check whether this tab/nav structure feels native for Expo`

Bad prompts:
- `/hig-review make it nicer`
- `/hig-review review app`
=======
The app must feel like it belongs on the platform. iOS users expect iOS patterns.
Android users expect Material Design. This audit catches the common violations that
make an app feel "off" — inconsistent navigation, wrong typography scales, missing
platform idioms, and accessibility gaps.

---

## Step 0: Detect platform and framework

```bash
# Detect mobile platform
_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
echo "Mobile platform: $_PLATFORM"

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

## Step 1: Navigation patterns audit

### iOS-specific checks

```bash
# Flutter: Check for CupertinoPageRoute / iOS-style transitions
grep -rn "CupertinoPageRoute\|CupertinoNavigationBar\|CupertinoSliverNavigationBar" \
  lib/ --include="*.dart" 2>/dev/null | head -10

# Check for back gesture support
grep -rn "automaticallyImplyLeading\|iOS\|swipe" lib/ --include="*.dart" 2>/dev/null | head -10

# Check for iOS-style tab bar
grep -rn "CupertinoTabBar\|BottomNavigationBar" lib/ --include="*.dart" 2>/dev/null | head -10
```

**iOS Requirements:**
- Navigation bar should use large titles where appropriate (scroll-to-collapse pattern)
- Back gesture must be enabled (default in NavigationComponent, but verify)
- Tab bar uses bottom position with icons + labels (no top tabs unless settings)
- Modal presentations use iOS-style cards/sheets, not full-screen dialogs

### Android-specific checks

```bash
# Check for Material Design components
grep -rn "MaterialApp\|Scaffold\|AppBar\|BottomNavigationBar\|FloatingActionButton" \
  lib/ --include="*.dart" 2>/dev/null | head -10

# Check for proper back handling
grep -rn "onWillPop\|onBackPressed\|BackPressInterceptor" \
  lib/ --include="*.dart" --include="*.kt" 2>/dev/null | head -5
```

**Android Requirements:**
- Uses Material Design 3 components (not custom widget lookalikes)
- Proper back stack handling (system back button works correctly)
- FAB follows Material guidelines (one primary action, proper placement)
- Navigation drawer or bottom nav (not both unless iOS port)

### Cross-platform violations

```bash
# Find custom navigation that bypasses platform patterns
grep -rn "CustomPageRoute\|slide\|transition" lib/ --include="*.dart" 2>/dev/null | head -15
```

Flag any custom page transitions that override platform defaults.

---

## Step 2: Typography audit

```bash
# Find hardcoded font sizes
grep -rn "fontSize:.*[0-9]\|TextStyle(fontSize:" lib/ --include="*.dart" 2>/dev/null | head -20
```

### iOS Typography

iOS uses SF Pro with specific type scale:
- Large Title: 34pt (bold)
- Title 1: 28pt
- Title 2: 22pt
- Title 3: 20pt
- Headline: 17pt (semibold)
- Body: 17pt
- Callout: 16pt
- Subhead: 15pt
- Footnote: 13pt
- Caption 1: 12pt
- Caption 2: 11pt

Check: Is typography using the system font (San Francisco on iOS)? Any custom fonts
should have fallback to system.

### Android Typography

Material Design type scale:
- Display: 57/45/34/24sp
- Headline: 32/28/24/20sp
- Title: 22/16sp
- Body: 16/14sp
- Label: 14/12/11sp

Check: Is typography using Material type scale? Are text styles consistent with
theme?

---

## Step 3: Spacing and layout audit

```bash
# Find inconsistent padding/margins
grep -rn "EdgeInsets\|padding:\|margin:" lib/ --include="*.dart" 2>/dev/null | head -30

# Find hardcoded dimensions
grep -rn "height:.*[0-9]\|width:.*[0-9]" lib/ --include="*.dart" 2>/dev/null | head -20
```

### iOS Safe Areas

```bash
# Check safe area handling
grep -rn "SafeArea\|safeArea\|MediaQuery.of\|SafeAreaView" lib/ --include="*.dart" 2>/dev/null | head -10
```

iOS requires:
- Safe area insets respected on all screens (notch, home indicator)
- Bottom tab bar avoids home indicator area
- Content not hidden under status bar or notch
- Modal sheets respect safe areas

### Android Elevation and Shadows

```bash
# Check for elevation usage
grep -rn "elevation:\|elevation\b" lib/ --include="*.dart" 2>/dev/null | head -10
```

Material Design:
- App bar: 4dp elevation
- FAB: 6dp (12dp when pressed)
- Cards: 1-2dp
- Modals: 24dp

---

## Step 4: Iconography audit

```bash
# Find icon usage
grep -rn "Icon(\|Icons\." lib/ --include="*.dart" 2>/dev/null | head -20
```

**iOS:**
- SF Symbols are preferred (CupertinoIcons in Flutter)
- Icons should be monochrome and match the action they represent
- Minimum touch target: 44x44pt

**Android:**
- Material Icons are standard
- Outlined style for inactive, filled for active (Material 3)
- Minimum touch target: 48x48dp

Check:
- Are icons consistent in style (not mixing filled/outlined)?
- Do icons have appropriate labels for accessibility?
- Are touch targets large enough?

---

## Step 5: Gesture audit

```bash
# Find gesture detectors
grep -rn "GestureDetector\|onTap\|onLongPress\|onDoubleTap\|Dismissible\|Draggable" \
  lib/ --include="*.dart" 2>/dev/null | head -20
```

**iOS Gestures:**
- Swipe from left edge = system back (must be preserved)
- Pull to refresh = standard pattern for lists
- Long press = context menus
- Edge swipe = system apps/camera

**Android Gestures:**
- System back button (no edge swipe for back unless explicitly requested)
- Swipe to refresh = standard
- Long press = context menus or multi-select
- FAB tap = standard primary action

---

## Step 6: Accessibility audit

```bash
# Find accessibility labels
grep -rn "semanticLabel\|accessibilityLabel\|accessibilityHint\|excludeFromSemantics" \
  lib/ --include="*.dart" 2>/dev/null | head -20

# Find interactive elements without labels
grep -rn "onTap\|onPressed\|onChanged" lib/ --include="*.dart" 2>/dev/null | head -30
```

**Requirements:**
- All interactive elements have semantic labels
- Images have alt text or are decorative (marked as such)
- Text has sufficient contrast (4.5:1 for normal text, 3:1 for large text)
- Touch targets are at least 44x44pt (iOS) or 48x48dp (Android)
- Screen reader can navigate in logical order
- Color is not the only means of conveying information

---

## Step 7: Platform-specific checklist

### iOS Checklist

- [ ] Uses Cupertino widgets where available (CupertinoButton, CupertinoTextField, etc.)
- [ ] Large titles in navigation bars where content warrants
- [ ] System back gesture preserved
- [ ] Tab bar at bottom with icons and labels
- [ ] Safe area respected
- [ ] Haptic feedback for important interactions (selection, success, error)
- [ ] Dynamic Type support (scalable text)
- [ ] No custom navigation patterns that conflict with iOS paradigms

### Android Checklist

- [ ] Uses Material 3 components
- [ ] Proper back stack handling
- [ ] FAB follows Material guidelines
- [ ] Bottom navigation or drawer (not both unless iOS port)
- [ ] Elevation appropriate for component hierarchy
- [ ] System back button handled correctly
- [ ] Dark theme follows Material 3 dark color scheme
- [ ] Ripple effects on touchable surfaces

---

## Step 8: Output

HIG REVIEW
═══════════════════════════════════════════════════════════

Platform: {iOS / Android / Both}
Framework: {Flutter / Expo / Swift / Kotlin}
Date: {date}

NAVIGATION
- iOS large titles: PASS / FAIL — {notes}
- Back gesture: PASS / FAIL
- Tab bar placement: PASS / FAIL
- Modal style: PASS / FAIL

TYPOGRAPHY
- System fonts: PASS / FAIL
- Type scale: PASS / FAIL — {issues}
- Dynamic Type / scalable: PASS / FAIL

SPACING
- Safe areas: PASS / FAIL
- Touch targets: PASS / FAIL
- Consistent spacing: PASS / FAIL

ICONS
- Icon style consistency: PASS / FAIL
- Touch target size: PASS / FAIL

GESTURES
- Platform gestures preserved: PASS / FAIL
- Custom gesture conflicts: PASS / FAIL

ACCESSIBILITY
- Semantic labels: PASS / FAIL
- Contrast: PASS / FAIL
- Screen reader order: PASS / FAIL

CRITICAL ISSUES
[CRITICAL] {issue} — {fix}
...

RECOMMENDATIONS
[HIGH] {issue} — {recommendation}
[MEDIUM] {issue} — {recommendation}

VERDICT: PASS / NEEDS WORK / CRITICAL (blocks store-ship)
═══════════════════════════════════════════════════════════

---

## Step 9: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"hig-review","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"hig-review","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `success`, `fail`, or `abort`.
>>>>>>> f076cd8e (feat(mobile): add hig-review skill for iOS HIG and Material Design audit)
