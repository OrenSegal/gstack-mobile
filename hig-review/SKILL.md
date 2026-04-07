---
name: hig-review
description: Review a mobile UI plan or diff against iOS Human Interface Guidelines, Android Material guidance, accessibility, platform conventions, and app-store-risky UX before code is written.
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