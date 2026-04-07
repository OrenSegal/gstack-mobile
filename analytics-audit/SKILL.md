---
name: analytics-audit
preamble-tier: 4
version: 1.0.0
description: |
  Verifies analytics events fire correctly before shipping. Checks AARRR event coverage,
  user identity handoff, no PII in event properties, no duplicate events, and push
  notification open tracking. Run after /mobile-qa and before /store-ship on any branch
  touching user flows, onboarding, payments, or notifications. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - AskUserQuestion
---
<!-- gstack-mobile: analytics-audit/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"analytics-audit","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /analytics-audit

The most common analytics failure: you ship, the feature runs for a week, then you look at
the funnel and see a flat line. Either the event never fired, fired twice, or fired with
`user_id: null`. This audit catches that before ship.

---

## Step 0: Identify analytics provider

```bash
# Flutter
grep -E "amplitude|mixpanel|segment|posthog|firebase_analytics|rudderstack" pubspec.yaml 2>/dev/null
# Expo / React Native
cat package.json 2>/dev/null | grep -E "amplitude|mixpanel|segment|posthog|analytics" | head -10
# Swift
find . -name "Podfile" -o -name "Package.swift" 2>/dev/null | xargs grep -iE "amplitude|mixpanel|segment|posthog" 2>/dev/null | head -10
# Kotlin
find . -name "*.gradle" -o -name "*.gradle.kts" 2>/dev/null | xargs grep -iE "amplitude|mixpanel|segment|posthog|firebase" 2>/dev/null | head -10
```

Note the provider. This skill works the same regardless of provider — the patterns
(event fire, user identity, PII) are universal.

---

## Step 1: AARRR event coverage

Check that every funnel stage has a corresponding event. For each stage, grep for the
event call and verify it exists:

**Acquisition:**
```bash
grep -r "app_open\|AppOpen\|logEvent.*app_open\|track.*app_open\|logEvent.*open" \
  lib/ src/ --include="*.dart" --include="*.ts" --include="*.tsx" --include="*.swift" --include="*.kt" \
  -r . 2>/dev/null | head -10
grep -r "attribution\|UTM\|referrer\|campaign\|install_referrer" \
  lib/ src/ -r . 2>/dev/null | head -10
```

Required events:
- `app_open` with `source`, `campaign`, `referral_code` properties (if attribution used)
- `install` (first launch only — not on every open)

**Activation:**
```bash
grep -r "onboarding\|first_open\|signup_complete\|account_created\|first_action\|aha_moment" \
  lib/ src/ -r . 2>/dev/null | head -20
```

Required events:
- `onboarding_step_{N}_completed` for each onboarding step
- `signup_completed` with `method` (email, google, apple, etc.)
- `first_core_action` (the thing that proves value — app-specific, must be defined)

**Retention:**
```bash
grep -r "session_start\|session_end\|screen_view\|page_view" lib/ src/ -r . 2>/dev/null | head -10
```

Required:
- `session_start` (automatic in most SDKs, but verify it fires)
- Feature-level events for the primary retention loops

**Revenue:**
```bash
grep -r "purchase\|subscription\|payment\|checkout\|iap\|in_app_purchase\|revenue" \
  lib/ src/ -r . --include="*.dart" --include="*.ts" --include="*.swift" --include="*.kt" 2>/dev/null | head -20
```

Required events (all three required — missing any one kills funnel analysis):
- `purchase_initiated`
- `purchase_completed` with `product_id`, `price`, `currency`, `revenue`
- `purchase_failed` with `error_code`
- `subscription_renewed` (if subscriptions)

**Referral:**
```bash
grep -r "share\|invite\|referral\|refer_a_friend" lib/ src/ -r . 2>/dev/null | head -10
```

Required:
- `share_triggered` with `surface` (e.g., post-order, profile, share sheet)
- `invite_sent` with `channel` (SMS, email, social)
- `invite_accepted` (if trackable)

---

## Step 2: User identity handoff

This is the most common analytics implementation bug. Before signup, events fire with
an anonymous ID. After signup, all subsequent events should fire with a real user ID,
and the anonymous → identified handoff must be called once.

```bash
grep -r "identify\|setUserId\|alias\|userId\|user_id" \
  lib/ src/ -r . --include="*.dart" --include="*.ts" --include="*.swift" --include="*.kt" 2>/dev/null | head -20
```

Check:
- `identify(userId)` or equivalent is called exactly once per session, after signup or login
- It is NOT called before the user is authenticated (avoid `identify(null)`)
- After calling `identify`, subsequent `track()` calls include the user ID
- Anonymous events that occurred before signup should be associated (alias call, if SDK supports it)

Flag if `identify` is called in a loop, called with null/undefined, or not called at all.

---

## Step 3: PII in event properties

This matters for GDPR, CCPA, and App Store Review guideline 5.1.2.

```bash
grep -r "email\|phone\|name\|address\|dob\|date_of_birth\|ssn\|passport" \
  lib/ src/ -r . --include="*.dart" --include="*.ts" --include="*.swift" --include="*.kt" 2>/dev/null \
  | grep -i "track\|log_event\|logEvent\|capture\|record" | head -20
```

Flag any event that contains:
- Raw email address as a property value (use a hash if identification is needed)
- Full name
- Phone number
- Physical address
- Date of birth
- Any government ID

Safe patterns: user ID (internal UUID, not email), anonymized age bucket, country code.

---

## Step 4: Duplicate event detection

Common cause: events fired in both `initState` and `didChangeDependencies`, or in
both a widget and its parent, or on route change without a dedup guard.

```bash
# Find event calls and check for structural duplication
grep -rn "track\|logEvent\|capture" lib/ src/ -r . \
  --include="*.dart" --include="*.ts" --include="*.swift" --include="*.kt" 2>/dev/null \
  | grep -v "//" | sort | uniq -d | head -20
```

Manual check: navigate to a key screen, go back, navigate again. Verify the
`screen_view` event fires once per visit, not twice. Check for events inside
`build()` methods (Flutter) or `render()` (React Native) — these will fire on
every rebuild, not just once.

---

## Step 5: Push notification open tracking

```bash
grep -r "notification.*open\|push.*open\|notificationTapped\|onNotificationOpened\|getInitialNotification" \
  lib/ src/ -r . 2>/dev/null | head -10
```

Required:
- `notification_opened` event fires when user taps a push notification
- Event includes `campaign_id` or `notification_id` for attribution
- Event fires in both cold-start scenario (app was terminated) and warm-start (app was backgrounded)
- Deep link routing happens AFTER the event is fired, not before

---

## Step 6: Output

ANALYTICS AUDIT
═══════════════════════════════════════════════════════════

Provider: {name}
AARRR Coverage
Stage	Required event	Status	Notes
Acquisition	app_open	FOUND/MISSING	
Activation	onboarding_step_N_completed	FOUND/MISSING	
Activation	signup_completed	FOUND/MISSING	
Activation	first_core_action	FOUND/MISSING/UNDEFINED	
Retention	session_start	FOUND/MISSING	
Revenue	purchase_initiated	FOUND/MISSING	
Revenue	purchase_completed	FOUND/MISSING	
Revenue	purchase_failed	FOUND/MISSING	
Referral	share_triggered	FOUND/MISSING	
Identity

User identify call: FOUND/MISSING/INCORRECT
Issue: {describe problem if any}
PII

PII in events: NONE/FOUND
{List each violation if found}
Duplicate risk

{List any duplicate fire risks found}
Push

Push open tracking: FOUND/MISSING/PARTIAL
{Describe gap if any}

VERDICT: PASS / FAIL
═══════════════════════════════════════════════════════════

If any `MISSING` events exist for Revenue stages, this is CRITICAL — block `/store-ship`
and require them to be added. Missing Acquisition/Retention events are WARN.

---

## Step 7: Completion telemetry

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"analytics-audit","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
```