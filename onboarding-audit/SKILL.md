---
name: onboarding-audit
preamble-tier: 4
version: 1.0.0
description: |
  Onboarding and activation audit for mobile apps. Reviews first-run experience, activation
  funnel metrics, signup-to-value distance, permission timing, and AARRR activation traps.
  Run AFTER /analytics-audit if onboarding was modified, or standalone when activation
  metrics are poor. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---
<!-- gstack-mobile: onboarding-audit/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"onboarding-audit","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /onboarding-audit

The #1 killer of mobile apps: users download, open, see a signup wall, and leave.
This audit measures the distance from cold launch to "aha moment" and flags anything
that blocks activation.

---

## Step 0: Identify onboarding surfaces

Find all onboarding-related code:

```bash
# Flutter
grep -r "onboarding\|welcome\|intro\|first_time\|onboard" lib/ --include="*.dart" -l 2>/dev/null | head -10

# iOS Swift
find . -name "*Onboarding*" -o -name "*Welcome*" -o -name "*Intro*" 2>/dev/null | grep -v Pods | head -10

# Android Kotlin
find . -name "*Onboarding*" -o -name "*Welcome*" -o -name "*Intro*" 2>/dev/null | head -10

# Expo/React Native
grep -r "onboarding\|welcome\|intro" src/ --include="*.tsx" --include="*.ts" -l 2>/dev/null | head -10
```

Identify the onboarding flow:
- How many screens/steps?
- What gates exist (signup, email verify, permission asks)?
- What is the "aha moment" — the first action that proves value?

---

## Step 1: Distance to value (tap count)

Walk through the flow from cold launch:

1. Splash / loading → time to first meaningful screen
2. First screen → what does user see? (value prop, or signup wall?)
3. Each subsequent tap → what extra action is required before value?

**Target:** 3 taps or fewer to experience core value.

Check for:
- [ ] Signup wall before any value shown (CRITICAL — App Store rejection risk)
- [ ] Email verification required before any value (CRITICAL)
- [ ] Multiple permission asks on first launch (WARN)
- [ ] Tutorial/interstitial before first action (WARN if >1 screen)
- [ ] Paywall before core value demonstrated (CRITICAL)

---

## Step 2: Permission timing

This is the most common activation killer.

```bash
# Find permission requests in onboarding flow
grep -r "permission\|requestPermission\|authorize\|request.*location\|request.*camera\|request.*notification" \
  lib/ src/ --include="*.dart" --include="*.tsx" --include="*.swift" --include="*.kt" -l 2>/dev/null | head -10
```

Check:
- [ ] Notification permission: NOT on first screen. Asked after user demonstrates intent.
- [ ] Location permission: NOT on first screen. Asked when location feature is invoked.
- [ ] Camera/Microphone: only when user explicitly invokes the feature.
- [ ] Contacts: only if core functionality requires it, not as "discover more friends."
- [ ] If permission denied: does the app work without it, or does it block the user?

---

## Step 3: Analytics events for onboarding

Verify the right events exist:

```bash
grep -r "onboarding_start\|onboarding_complete\|onboarding_step\|first_open\|signup_start\|signup_complete" \
  lib/ src/ --include="*.dart" --include="*.tsx" --include="*.swift" --include="*.kt" -r . 2>/dev/null | head -20
```

Required:
- `onboarding_start` — fires on first launch
- `onboarding_step_{N}_completed` — fires when each step is done
- `onboarding_complete` — fires when onboarding ends (success)
- `onboarding_abandoned` — fires if user exits during onboarding

If not present: missing this means you can't measure activation funnel. This is WARN.

---

## Step 4: Activation funnel analysis

If analytics data exists (from `/analytics-audit` or production):

Query the funnel:
- What % of users start onboarding?
- What % complete each step?
- Where is the biggest drop-off?
- What is median time to complete?
- What is time from install to first core action?

**Red flags:**
- >30% drop-off between step 1 and step 2
- >50% drop-off from start to complete
- Time to core value > 60 seconds

---

## Step 5: Platform-specific checks

**iOS:**
- [ ] Respects Dynamic Type (scales in Settings → Accessibility)
- [ ] Works with VoiceOver (can complete onboarding without seeing)
- [ ] Does not use custom signup UI that mimics Apple ID prompt (rejection risk)
- [ ] Uses Sign in with Apple if offering social login (App Store requirement if applicable)

**Android:**
- [ ] Predictive back gesture works correctly in onboarding screens
- [ ] Uses Material 3 components, not custom UI that mimics system dialogs
- [ ] Navigation back works correctly on every screen
- [ ] Does not request background location during onboarding

**Flutter:**
- [ ] `SafeArea` wraps onboarding screens
- [ ] Keyboard handling correct on any form fields
- [ ] `ListView.builder` for any scrollable content (not expensive `ListView` with children)

**Expo:**
- [ ] `SafeAreaView` from `react-native-safe-area-context` used
- [ ] `KeyboardAvoidingView` handles keyboard correctly

---

## Step 6: Output format

ONBOARDING AUDIT
═══════════════════════════════════════════════════════════

Activation distance: {N} taps to core value
Aha moment: {describe what it is}

Permission timing
Notification: FIRST SCREEN / POST-VALUE / NEVER
Location: FIRST SCREEN / POST-VALUE / NEVER
Camera/Mic: FIRST SCREEN / POST-VALUE / NEVER

Events present: YES/NO
- onboarding_start: FOUND/MISSING
- onboarding_step_N_completed: FOUND/MISSING
- onboarding_complete: FOUND/MISSING
- onboarding_abandoned: FOUND/MISSING

Platform issues: {list any issues}

VERDICT: PASS / PASS WITH WARNINGS / FAIL
═══════════════════════════════════════════════════════════

If VERDICT is FAIL, this blocks `/store-ship`. Fix onboarding first.

---

## Step 7: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"onboarding-audit","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
```