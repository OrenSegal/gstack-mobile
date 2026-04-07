---
name: push-audit
preamble-tier: 4
version: 1.0.0
description: |
  Push notification implementation audit. Checks permission timing, payload content,
  frequency caps, opt-out handling, rich notification support, and platform compliance.
  Run AFTER /analytics-audit if push notifications were added, or standalone when
  investigating notification issues. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - AskUserQuestion
---
<!-- gstack-mobile: push-audit/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"push-audit","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /push-audit

Push is the most powerful retention tool in mobile — and the fastest way to lose users
if done wrong. This audit catches the things that cause opt-outs, low delivery, or
App Store rejection.

---

## Step 0: Identify push implementation

```bash
# Find push notification code
grep -r "push\|notification\|FCM\|APNs\|messaging\|OneSignal" \
  lib/ src/ --include="*.dart" --include="*.tsx" --include="*.swift" --include="*.kt" -l 2>/dev/null | head -10

# Flutter packages
cat pubspec.yaml 2>/dev/null | grep -E "firebase_messaging|flutter_local_notifications|onesignal" | head -5

# iOS capabilities
grep -r "Push Notifications\|Remote notifications" ios/ --include="*.plist" --include="*.entitlements" 2>/dev/null | head -5
```

Identify:
- Push provider (Firebase FCM, OneSignal, raw APNs, etc.)
- Notification types (transactional, marketing, news)
- Current opt-out rate if known

---

## Step 1: Permission timing

The #1 push mistake: asking for notification permission on first launch.

```bash
# Find permission request in app
grep -r "requestPermission\|requestAuthorization\|registerForRemoteNotifications" \
  lib/ src/ --include="*.dart" --include="*.tsx" --include="*.swift" --include="*.kt" -l 2>/dev/null | head -5

# Find where it's called (in which screen/on what trigger)
grep -r -B5 "requestPermission\|requestAuthorization" \
  lib/ src/ --include="*.dart" --include="*.tsx" --include="*.swift" --include="*.kt" 2>/dev/null | head -20
```

Check:
- [ ] Permission is NOT requested on first launch. EVER.
- [ ] Permission is requested AFTER user demonstrates intent:
  - After completing onboarding (step 3+)
  - After first purchase
  - After first meaningful action
  - After 2-3 sessions of active use
- [ ] Pre-prompt: in-app explanation shown BEFORE system dialog ("We'll notify you when...")

---

## Step 2: Notification content

Check payload and message content:

```bash
# Find notification handling code
grep -r "notification\|RemoteMessage\|UNNotification" \
  lib/ src/ --include="*.dart" --include="*.tsx" --include="*.swift" -l 2>/dev/null | head -10

# Find notification content templates (title, body)
grep -r "title.*notification\|body.*notification\|content-title\|mutable-content" \
  lib/ src/ --include="*.dart" --include="*.tsx" -r . 2>/dev/null | head -20
```

**Requirements:**
- Title: < 50 characters, meaningful without body
- Body: < 100 characters (truncated on lock screen)
- No PII in notification content (not "Your order is ready, John")
- No sensitive data visible on lock screen
- Images: optional, must be appropriate size (<1MB)
- Actions: optional, must be meaningful

---

## Step 3: Frequency and throttling

Check for frequency limits:

```bash
# Find notification triggers
grep -r "schedule\|deliver\|throttle\|rate.*limit\|batch" \
  lib/ src/ --include="*.dart" --include="*.tsx" --include="*.swift" --include="*.kt" -r . 2>/dev/null | head -10
```

**Rules:**
- No more than 3-5 notifications per user per day (including all types)
- No notifications during quiet hours (typically 9pm - 7am local time)
- Batch multiple events instead of individual notifications
- No repetitive notifications (same message every X minutes)

---

## Step 4: Opt-out handling

Check that opt-out works correctly:

```bash
# Find unsubscribe/notification settings
grep -r "unsubscribe\|opt.*out\|notification.*setting\|channel.*disable" \
  lib/ src/ --include="*.dart" --include="*.tsx" --include="*.swift" --include="*.kt" -r . 2>/dev/null | head -10
```

- [ ] Unsubscribe link available in every notification (or in-app settings)
- [ ] Unsubscribing works immediately — not "will take 24 hours"
- [ ] Can re-enable notifications in app settings (opt-in is allowed)
- [ ] No deceptive unsubscribe patterns (hidden button, extra steps)

---

## Step 5: Rich notifications and actions

If implemented:

```bash
# Find action buttons
grep -r "action\|category\|UNNotificationCategory\|NotificationChannel" \
  lib/ src/ --include="*.dart" --include="*.swift" --include="*.kt" -r . 2>/dev/null | head -10

# Find image/carousel support
grep -r "image\|attachment\|carousel\|breakpoint" \
  lib/ src/ --include="*.dart" --include="*.tsx" -r . 2>/dev/null | head -10
```

- [ ] Action buttons are useful, not just "Dismiss"
- [ ] Deep links from notifications go to the right screen
- [ ] Rich notifications (images, actions) have fallbacks for devices that don't support them
- [ ] Interactive notifications respect system limits

---

## Step 6: Platform-specific checks

**iOS:**
- [ ] Uses `UNUserNotificationCenter` for iOS 10+
- [ ] Handles `willPresent` for foreground notifications
- [ ] Critical alerts used only for actual emergencies (spamming = rejection)
- [ ] Notification categories registered for actionable notifications

**Android:**
- [ ] Uses `NotificationChannel` (Oreo+)
- [ ] Importance level appropriate (high for important, default for normal)
- [ ] Badging handled correctly
- [ ] Custom sound respects Do Not Disturb

**Flutter:**
- [ ] Uses `flutter_local_notifications` or `firebase_messaging`
- [ ] Handles `onMessage`, `onLaunch`, `onBackgroundMessage` correctly
- [ ] Notification permissions requested at right time (not on launch)

---

## Step 7: Output format

PUSH AUDIT
═══════════════════════════════════════════════════════════
Provider: {Firebase/OneSignal/APNs/other}
Permission timing: CORRECT / FIRST_LAUNCH / UNKNOWN
Daily volume: {N} notifications/day per user

Content:
- Title length: OK / TOO LONG (>50 chars)
- Body length: OK / TOO LONG (>100 chars)
- PII present: YES / NO
- Lock screen safe: YES / NO

Frequency:
- Daily cap: OBSERVED / NOT SET
- Quiet hours: RESPECTED / IGNORED

Opt-out: WORKING / NOT IMPLEMENTED / HARMFUL

Platform compliance: PASS / FAIL

VERDICT: PASS / FAIL
═══════════════════════════════════════════════════════════

If VERDICT is FAIL, fix before `/store-ship`.

---

## Step 8: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"push-audit","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
```