---
name: hig-review
preamble-tier: 4
version: 1.0.0
description: |
  Pre-build UI review against iOS Human Interface Guidelines, Android Material Design,
  accessibility standards, and app-store-risky UX patterns. Run before writing code
  for any user-facing mobile change: onboarding, navigation, paywalls, sheets, forms,
  permission prompts. References mobile-ios-design, flutter-adaptive-ui, building-native-ui
  for implementation guidance. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
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

---

# /hig-review

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
- **SwiftUI:** `.sheet` / `.fullScreenCover` / `.popover` — use the right one for context. `NavigationStack` (not `NavigationView`, deprecated). `TabView` + `.tabItem`. `confirmationDialog` for destructive actions (not `Alert`). `Form` + `Section` for settings. `.toolbar` items (not custom `HStack` headers).
- **Jetpack Compose:** `ModalBottomSheet`, `AlertDialog`, `DropdownMenu`. `Scaffold` + `TopAppBar`. `NavigationBar` for bottom tabs. `LazyColumn` / `LazyRow` (not `Column` in `ScrollState` for lists). Material3 components over Material2 — `FilledButton`, `OutlinedButton`, `ElevatedCard`.
- **Flutter:** `ListView.builder` not `ListView` (lazy rendering). `Scaffold` with `SafeArea` for safe-area handling. `MediaQuery.of(context).padding` for insets. `Semantics` wrapping for a11y labels. `const` constructors on all static widgets. `BottomSheet` / `showModalBottomSheet` for sheets; `showDialog` for destructive confirmations; `AlertDialog` with `actions`. `NavigationBar` (Material 3) or `CupertinoTabBar` (iOS-look). Never `Navigator.push` directly — use named routes or `go_router`.
- **Expo / React Native:** `createNativeStackNavigator` (React Navigation 6+) not `createStackNavigator` — native stack uses UINavigationController/Fragment for real native feel. `BottomSheetModal` (Gorhom) for sheets. `FlatList` not `ScrollView` for lists. `Modal` with `presentationStyle="pageSheet"` for iOS-native sheets. Platform-split with `Platform.OS === 'ios'` only for genuine platform differences, not styling.

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

When the implementation path is clear, reference the appropriate installed skill by
platform: `mobile-ios-design` (Swift/SwiftUI patterns), `building-native-ui` (Expo
Router components), `flutter-adaptive-ui` (Flutter responsive/adaptive layouts),
`flutter-animations` (Flutter motion and transitions). These skills have the
implementation specifics; this review tells you what to build, they tell you how.

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
- Dark mode resilience: no hardcoded colors (`Color(0xFF...)` in Flutter, `UIColor(red:...)` in Swift, `Color.parseColor("#...")` in Kotlin) — use semantic/adaptive colors (`Theme.of(context).colorScheme`, `UIColor.systemBackground`, `MaterialTheme.colorScheme`).
- Notification permission timing if relevant.
- Subscription / restore purchase compliance if relevant.
- Localization readiness: all user-visible strings externalized (no inline string literals in widgets/views). Test with longest locale (German text runs ~40% longer than English). RTL layout mirroring verified for Arabic/Hebrew (`Directionality` in Flutter, `layoutDirection` in Android).
- Landscape and tablet layout: check that content is not broken at wider aspect ratios. At minimum verify it does not crash or overflow.

## AARRR lens

When relevant, include:
- Acquisition risk: weak first impression, store-screenshot mismatch.
- Activation risk: too many steps before core value.
- Retention risk: annoying permissions, push misuse, jank, poor empty states.
- Revenue risk: paywall confusion, failed trust signals, unclear pricing.
- Referral risk: missing shareability or no post-success delight.

## Accessibility requirements

These are not optional. App Store and Play Store both reject apps with severe a11y failures, and WCAG 2.1 AA is increasingly a legal requirement.

### Touch targets
- iOS: minimum 44×44pt (prefer 48×48pt)
- Android: minimum 48×48dp
- Flutter: wrap with `SizedBox(width: 48, height: 48)` or `InkWell` with `minRadius`
- Flag any interactive element smaller than minimum — common offenders: close buttons, back arrows, icon-only toolbar items

### Labels and semantics
- Every interactive control needs a text label accessible to VoiceOver/TalkBack
- Icon-only buttons must have `semanticsLabel` (Flutter), `accessibilityLabel` (iOS/RN), or `contentDescription` (Android)
- Images must have `excludeFromSemantics: true` (Flutter) if decorative, or a meaningful label if informative
- Form fields: label must be programmatically associated, not just visually adjacent

### Contrast
- Normal text: minimum 4.5:1 contrast ratio (WCAG AA)
- Large text (18pt+ or 14pt bold+): minimum 3:1
- Interactive components and focus indicators: minimum 3:1
- Flag low-contrast placeholder text, disabled-state text, and secondary labels

### Dynamic type / font scaling
- iOS: all text must respect Dynamic Type (use `UIFont.preferredFont` or SwiftUI `.font(.body)`, never hardcode pt sizes)
- Android: use `sp` not `dp` for text sizes
- Flutter: `textScaleFactor` must not be clamped below 1.0
- Test at 200% text size — flag truncation, overflow, and broken layouts

### Reduced motion
- Never autoplay animations or looping motion
- Respect `MediaQuery.of(context).disableAnimations` (Flutter), `UIAccessibility.isReduceMotionEnabled` (iOS), `AccessibilityManager.isAnimationEnabled` (Android)
- Flag any required animation that communicates meaning (meaning must also be conveyed without motion)

## Examples

Good prompts:
- `/hig-review review this onboarding redesign for a Flutter app before implementation`
- `/hig-review evaluate this paywall flow for iOS and Android store risk`
- `/hig-review check whether this tab/nav structure feels native for Expo`

Bad prompts:
- `/hig-review make it nicer`
- `/hig-review review app`

---

## Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"hig-review","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"success","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
if [ "$_TEL" != "off" ]; then
echo '{"skill":"hig-review","duration_s":"'"$_TEL_DUR"'","outcome":"success","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```