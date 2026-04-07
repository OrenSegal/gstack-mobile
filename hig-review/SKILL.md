---
name: hig-review
preamble-tier: 4
version: 1.0.0
description: |
  Mobile UI design review against iOS Human Interface Guidelines, Android Material 3,
  accessibility standards, and App Store / Play Store compliance. Run BEFORE writing code —
  not as a post-build polish pass. Use when planning or reviewing any user-facing mobile
  change: navigation, onboarding, paywalls, permission prompts, sheets, forms, or settings.
  Flags platform violations, App Review risks, and AARRR activation traps early. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
  - WebSearch
---
<!-- gstack-mobile: hig-review/SKILL.md -->

## Preamble (run first)

```bash
_UPD=$(~/.claude/skills/gstack/bin/gstack-update-check 2>/dev/null || .claude/skills/gstack/bin/gstack-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p ~/.gstack/sessions
touch ~/.gstack/sessions/"$PPID"
_SESSIONS=$(find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.gstack/sessions -mmin +120 -type f -exec rm {} + 2>/dev/null || true
_PROACTIVE=$(~/.claude/skills/gstack/bin/gstack-config get proactive 2>/dev/null || echo "true")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_SKILL_PREFIX=$(~/.claude/skills/gstack/bin/gstack-config get skill_prefix 2>/dev/null || echo "false")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.gstack/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
echo "SKILL_PREFIX: $_SKILL_PREFIX"
echo "PROACTIVE: $_PROACTIVE"
echo "TELEMETRY: ${_TEL:-off}"
mkdir -p ~/.gstack/analytics
if [ "$_TEL" != "off" ]; then
echo '{"skill":"hig-review","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"hig-review","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

If `MOBILE_PLATFORM` is `unknown` or `none`: ask the user which platform this review is
for (flutter, expo, swift, kotlin) before proceeding. If they confirm `none`, tell them
this skill is for mobile apps and stop.

If `SKILL_PREFIX` is `"true"`, use `/gstack-` prefixes when suggesting other skills.

---

# /hig-review

Run this before writing code for any user-facing mobile change. Catches platform violations,
App Review risks, and activation traps at design time — not after the code is merged.

---

## Step 0: Collect context

Determine what is being reviewed. Accept any of:
- Screenshots, mockups, Figma links, or image attachments
- A spec or PRD in the conversation
- A TODOS.md entry or plan file describing upcoming UI work
- A code diff (if review is post-implementation, note this and flag the timing)
- A description of the flow in natural language

Also collect:
```bash
_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
echo "PLATFORM: $_PLATFORM"
# Read project-level platform hints
[ -f pubspec.yaml ] && echo "DETECTED: flutter"
[ -f app.json ] || [ -f app.config.js ] && echo "DETECTED: expo"
[ -f *.xcodeproj ] 2>/dev/null || find . -maxdepth 2 -name "*.xcodeproj" -print -quit 2>/dev/null && echo "DETECTED: swift"
[ -f build.gradle ] || [ -f build.gradle.kts ] && echo "DETECTED: kotlin"
```

If platform cannot be determined, ask once before continuing.

Identify which surfaces are in scope. Common surfaces: onboarding, home feed, detail view,
search, settings, paywall, permission prompt, notification opt-in, share sheet, empty state,
error state, form / data entry, navigation / tab bar, modal / sheet, profile.

---

## Step 1: Platform-specific design standards

Apply the standards relevant to the detected platform. When targeting both iOS and Android
(Flutter or Expo), evaluate both.

### iOS (HIG)

**Navigation:**
- Is navigation stack-based (push/pop) for hierarchical content? Modals only for tasks
  that interrupt the flow — not as a substitute for navigation.
- Does swipe-to-go-back work on every pushed screen? Nothing should block the back gesture.
- Tab bar at the bottom (max 5 items). Never use a hamburger menu as the primary nav on iOS.
- Navigation bar title: centered on iOS 14 and below, large title on root screens (iOS 15+).

**Sheets and overlays:**
- Use `.sheet()` for tasks. Use `.fullScreenCover()` only when the task requires full
  screen focus (camera, video, document scanner).
- Avoid stacking sheets on sheets. One level deep maximum.
- Action sheets for destructive choices, not alerts.

**Controls:**
- `UISwitch` / `Toggle` for binary settings. Not a checkbox.
- `Stepper` for small increments. Not a text field.
- `DatePicker` in `.compact` or `.inline` style. Not a web-style month grid.
- Use SF Symbols where possible. Match symbol weight to surrounding text weight.

**Typography:**
- Use Dynamic Type text styles (`.largeTitle`, `.headline`, `.body`, etc.) not fixed sizes.
- Verify layout does not break at Accessibility Extra Large font sizes.
- Never truncate user-generated content without an expand affordance.

**Tap targets:** Minimum 44×44pt. Preferably 48×48pt for primary actions.

**Dark mode:** All custom colors must have light and dark variants via asset catalog or
`UIColor(dynamicProvider:)`. No hardcoded hex unless it has a dark-mode counterpart.

**Safe areas:** Nothing interactive below the home indicator. Nothing above the status bar.
`safeAreaInsets` must be respected on all screens, including modal sheets.

---

### Android (Material 3)

**Navigation:**
- `NavigationBar` (bottom, 3-5 destinations) or `NavigationRail` for tablet/large screen.
- `NavHost` + `NavController` for in-app navigation. Not manual fragment transactions.
- Predictive back gesture must be handled (`OnBackPressedCallback`) for Android 13+ targets.
- Drawer only for secondary navigation or settings, never as primary.

**Components:**
- `FloatingActionButton` for the primary action per screen. One per screen max.
- `BottomSheetDialogFragment` / `ModalBottomSheet` (Compose) for contextual tasks.
- `Snackbar` for transient feedback. Not Toast (deprecated UX pattern).
- `AlertDialog` only for decisions requiring an immediate response. Not for info.
- Avoid custom system dialogs that mimic OS permission dialogs (Play policy violation).

**Typography:**
- Material 3 type scale: `displayLarge` through `labelSmall`. Do not use raw `sp` values
  without a type scale reference.
- Verify layout at font scale 1.3 (accessibility setting on most devices).

**Tap targets:** 48×48dp minimum. Use `Modifier.minimumInteractiveComponentSize()` in Compose.

**Dynamic color:** Support Material You dynamic color theming via `dynamicColorScheme()`
where the platform supports it (Android 12+). Provide a static fallback.

**Safe areas / insets:**
- `WindowInsets` must be applied. Use `Modifier.windowInsetsPadding()` or
  `ViewCompat.setOnApplyWindowInsetsListener`. Never hardcode status bar / nav bar heights.

---

### Flutter (both platforms)

Evaluate Flutter UIs against BOTH sets of standards above. A Flutter app that ships on iOS
must feel iOS-native on iOS and Android-native on Android, or deliberately choose a branded
middle ground (acceptable, but must be stated as a product decision, not an accident).

Key Flutter-specific checks:
- `Platform.isIOS` / `Theme.of(context).platform` used to branch navigation patterns
  (CupertinoNavigationBar vs AppBar, CupertinoTabScaffold vs BottomNavigationBar).
- `SafeArea` widget wrapping all scaffolds. Not optional.
- `MediaQuery.of(context).viewInsets.bottom` used to handle keyboard on forms.
- `const` constructors used for static widgets to avoid unnecessary rebuilds.
- Images loaded with `cacheWidth` / `cacheHeight` to avoid excessive memory use.
- `ListView.builder` (not `ListView` with children array) for any list with more than ~10 items.

---

### Expo / React Native

- `SafeAreaView` from `react-native-safe-area-context` (not the built-in one, which is broken).
- `KeyboardAvoidingView` with `behavior="padding"` on iOS and `behavior="height"` on Android.
- Navigation via Expo Router or React Navigation `NavigationContainer`. No manual screen
  management.
- Platform-branching for native feel: `Platform.OS === 'ios'` to use `ActionSheetIOS`,
  Haptics, `DatePickerIOS` style variants.
- All images via `expo-image` (not the RN `Image` component) for caching and performance.
- `useColorScheme()` for dark mode. No hardcoded colors without a dark counterpart.

---

## Step 2: Accessibility audit

Run these for every platform:

- **VoiceOver / TalkBack traversal:** Can a blind user complete the core flow? Are
  interactive elements reachable and correctly labeled?
- **Semantic labels:** Icon-only buttons must have `accessibilityLabel` / `contentDescription`.
  Decorative images must be hidden from the accessibility tree.
- **Focus order:** Does the reading order match the visual order? Are modals and sheets
  trapping focus correctly (not letting VoiceOver fall through to the content behind)?
- **Contrast:** Text must meet WCAG AA: 4.5:1 for body, 3:1 for large text (18pt+ or 14pt+ bold).
  Use a contrast checker on any custom color pair.
- **Reduced motion:** Animations should respect `prefers-reduced-motion` /
  `UIAccessibility.isReduceMotionEnabled` / `AccessibilityManager.isAnimatorDurationScaleEnabled`.
- **Text scaling:** Verify key flows at 150% font scale. CTAs and form labels must not truncate.
- **Touch accommodation:** No gesture-only interactions without a tap alternative.

---

## Step 3: App Store and Play Store compliance

These are ship-blocking. Flag anything here as CRITICAL.

**Apple App Store (Guideline references):**
- **4.0 Design:** App must use native UI components and follow platform conventions.
  Custom components must not attempt to mimic system UI deceptively.
- **5.1.1 Data Collection:** Account creation must not be required before the user
  can explore the app or experience its core value.
- **5.1.2 Data Use and Sharing:** No PII collected without disclosure. No analytics
  events with raw email, name, device IDFA without consent.
- **3.1.1 Subscriptions / IAP:** All IAP must use StoreKit. No external payment links
  or "sign up on our website" to avoid the fee. Restore Purchase must be accessible.
- **3.1.2 Subscriptions:** Subscription terms must be clearly displayed before purchase.
  No deceptive free trial framing. No hidden price changes.
- **2.1 App Completeness:** Placeholder UI, "coming soon" screens, or disabled features
  that are clearly incomplete will be rejected.
- **Privacy manifests (iOS 17+):** If using NSUserDefaults, file timestamps, disk space,
  or certain other APIs, a `PrivacyInfo.xcprivacy` file with required reason codes is
  mandatory. Missing manifests = rejection.

**Google Play (Policy references):**
- **Deceptive behavior policy:** No UI that mimics system notifications, dialogs, or
  permission prompts. No fake progress indicators.
- **Subscription policy:** Subscription price and terms must be displayed before purchase.
  Downgrade and cancellation paths must be accessible within the app.
- **Permissions:** Only request permissions necessary for current functionality.
  Requesting contacts, SMS, or call log for non-core features triggers enhanced review.
- **Sensitive permissions at install-time:** Avoid `READ_CALL_LOG`, `READ_CONTACTS`,
  `ACCESS_FINE_LOCATION` at install. Request contextually.

---

## Step 4: AARRR lens

For each surface in scope, flag activation and retention risks:

**Acquisition:**
- Do the first two screenshots (visible in search results without scrolling) communicate
  the core value prop clearly at thumbnail size?
- Does the app icon have clear visual identity at 60pt (iPhone home screen) size?

**Activation:**
- Count taps from cold launch to the user experiencing core value. Target: 3 or fewer.
  Flag every unnecessary step.
- Is the value prop demonstrated before any signup or permission ask?
- Is there a clear "aha moment" hook in the onboarding flow?

**Retention:**
- Are empty states actionable, not just "nothing here yet"?
- Is the notification permission ask placed after demonstrated value, not on screen 1?
- Are error states recoverable with a clear CTA, not just a generic "something went wrong"?

**Revenue:**
- Is subscription pricing displayed clearly, with the per-period cost visible (not buried)?
- Is the "Restore Purchase" path accessible and clearly labeled?
- Is free trial duration shown in the CTA button copy, not just the fine print?

**Referral:**
- Is there a shareable artifact after a key action (completion, achievement, discovery)?
- Does the share sheet pre-fill meaningful content rather than a bare URL?

---

## Step 5: Output format

Use this exact structure. No deviations.

---

### Verdict

One of: `PASS` / `PASS WITH WARNINGS` / `FAIL`

One direct paragraph with the reasoning. No hedging. Say what is wrong and why it matters.

---

### Critical issues

`[CRITICAL]` — blocks implementation or ship.

One bullet per issue. Format: `[CRITICAL] (platform) Component/screen — problem — specific fix`

Example: `[CRITICAL] (iOS) Onboarding step 1 — notification permission asked on first screen before any value shown — move to post-activation, after user completes first core action (App Store Guideline 5.1.1)`

---

### Warnings

`[WARN]` — important, non-blocking, but should be fixed before next major version.

Same format as Critical.

---

### Platform-specific notes

Only include sections that apply:

**iOS**
**Android**
**Flutter / shared**
**Expo / React Native**

---

### Recommended implementation

The single most direct path. Not a menu of options. No "you could also consider."

If platform-specific, call out the exact API or widget: not "use a native bottom sheet"
but "use `DraggableScrollableSheet` with `initialChildSize: 0.4` in Flutter" or
"`.sheet(isPresented:)` in SwiftUI."

---

### Build checklist

Short, executable. The engineer + designer can use this as a done-done checklist.

[] ...
[] ...

---

## Step 6: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"hig-review","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"hig-review","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `success`, `fail`, or `abort`.

If the review produced CRITICAL findings, suggest running `/mobile-security` next if the
issues involve data handling, or `/onboarding-audit` next if the issues involve activation
flow.