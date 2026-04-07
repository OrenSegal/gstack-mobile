---
name: push-audit
preamble-tier: 4
version: 1.0.0
description: |
  Audits push notification implementation and strategy. Checks APNS/FCM setup, permission
  ask timing, deep link routing on tap, tracking, content personalization, and delivery
  timing. Also reviews the notification strategy against retention benchmarks (too many
  pushes = uninstall). Run on any branch touching notification code. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
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

Push notifications are the highest-retention lever in mobile. They are also the fastest
path to an uninstall. This audit covers both the technical implementation (will it actually
deliver?) and the strategy (will it make users come back, or will it make them delete the app?).

---

## Step 0: Detect push implementation

```bash
# Flutter: detect push provider
grep -rn "firebase_messaging\|flutter_local_notifications\|onesignal\|braze\|customer.io\|airship" \
  pubspec.yaml lib/ --include="*.dart" 2>/dev/null | head -10

# Expo: detect push provider
cat package.json 2>/dev/null | grep -E "expo-notifications|onesignal|braze" | head -5

# Swift: detect push setup
grep -rn "UNUserNotificationCenter\|UNNotification\|APNs\|application.*registerForRemoteNotifications" \
  --include="*.swift" -r . 2>/dev/null | head -10

# Kotlin: detect push setup
grep -rn "FirebaseMessaging\|NotificationManager\|FCM\|NotificationChannel" \
  --include="*.kt" -r . 2>/dev/null | head -10

# Check for push handler
grep -rn "onMessage\|onMessageOpenedApp\|getInitialMessage\|didReceiveRemoteNotification\|onNotificationTap" \
  lib/ src/ --include="*.dart" --include="*.ts" --include="*.swift" --include="*.kt" \
  -r . 2>/dev/null | head -15
```

---

## Step 1: Technical implementation audit

### APNS / FCM registration

Check that the push token registration flow is correct:

```bash
# Flutter / Firebase: token refresh handler
grep -rn "onTokenRefresh\|getToken\|FirebaseMessaging.instance.getToken" \
  lib/ --include="*.dart" 2>/dev/null | head -10

# Swift: token registration
grep -rn "didRegisterForRemoteNotificationsWithDeviceToken\|application.*didRegisterFor" \
  --include="*.swift" -r . 2>/dev/null | head -5

# Kotlin: FCM token
grep -rn "onNewToken\|getToken\b" --include="*.kt" -r . 2>/dev/null | head -5
```

Required:
- Token refresh is handled (tokens rotate — old token = missed notifications)
- Token is sent to the backend on every refresh, not just on first launch
- Token is associated with the authenticated user ID after login
  (unauthenticated token = notification goes to wrong device after logout)

Flag if token refresh is not handled or if token is only registered once.

### Notification channel setup (Android)

```bash
# Android requires notification channels for API 26+
grep -rn "NotificationChannel\|createNotificationChannel" --include="*.kt" -r . 2>/dev/null | head -10
grep -rn "importance\b" --include="*.kt" -r . 2>/dev/null | grep "NotificationManager\|IMPORTANCE" | head -5
```

Required for Android O (API 26) and above:
- Notification channel created with appropriate importance level
- `IMPORTANCE_DEFAULT` for most notifications
- `IMPORTANCE_HIGH` only for urgent/time-sensitive (alerts user from lock screen)
- Channel name and description user-visible — make them meaningful

### Foreground handling

```bash
grep -rn "onMessage\b\|didReceiveNotification\|UNUserNotificationCenterDelegate" \
  lib/ src/ --include="*.dart" --include="*.ts" --include="*.swift" -r . 2>/dev/null | head -10
```

Required: When the app is in the foreground and a notification arrives, the app must
handle it explicitly. On iOS, the system does NOT show the notification banner if the
app is in the foreground — the app must present it locally or handle it in-app.
Flag if `UNUserNotificationCenterDelegate.userNotificationCenter(_:willPresent:)` is missing.

### Background and terminated state

```bash
grep -rn "getInitialNotification\|getInitialMessage\|launchNotification\|onLaunchNotification" \
  lib/ src/ --include="*.dart" --include="*.ts" -r . 2>/dev/null | head -5
```

Three states to handle:
1. **Foreground** — app open, notification arrives
2. **Background** — app suspended, user taps notification
3. **Terminated** — app not running, user taps notification from lock screen

`getInitialNotification()` / `getInitialMessage()` handles the terminated state.
Flag if it's missing — any deep link from a terminated-state notification will silently fail.

### Deep link routing on tap

```bash
grep -rn "onMessageOpenedApp\|notificationTapped\|handleNotificationTap\|navigateTo\b" \
  lib/ src/ --include="*.dart" --include="*.ts" -r . 2>/dev/null | head -10
```

Required:
- Tapping a notification routes the user to the relevant content, not the app home screen
- Deep link data is extracted from the notification payload
- Navigation happens AFTER auth check (notification tap while logged out should route to login first, then redirect to content after login)
- The routing works in all three states (foreground, background, terminated)

---

## Step 2: Strategy audit

### Notification types inventory

Ask the user to list every notification type they send (or extract from backend code
if it's in this repo). For each type:

| Type | Trigger | User benefit | Urgency | Frequency |
|---|---|---|---|---|
| e.g. "Expiry reminder" | Item expires in 2 days | Prevents food waste | Low | Daily max 1 |

Evaluate each type:
- **Transactional** (order confirmed, payment received) — always acceptable
- **Behavioral trigger** (your streak is at risk) — high value, use with care
- **Promotional** (sale today only) — low tolerance, require explicit opt-in
- **Re-engagement** (we miss you) — often backfires, do not use more than once a month

### Frequency check

Industry benchmarks for consumer apps:
- > 3 pushes/week: uninstall rate increases significantly for most app categories
- 1-2 pushes/week: optimal for most retention-focused apps
- Daily or more: acceptable only for apps with daily-use habit (fitness, language learning, news)

If the notification types would result in >3/week for the average user, flag as WARN.

### Personalization check

Are notifications personalized? "Your onions expire Sunday" is 10x more effective than
"You have expiring items." Generic notifications train users to ignore. Personalized
notifications drive re-opens.

Check if notifications include:
- User's name or item names
- Specific counts or dates
- Actionable CTA in the notification body (not just the app name)

### Opt-in segmentation

Check if notification types are independently toggleable in app settings. Users should
be able to disable promotional notifications without disabling transactional ones.

```bash
grep -rn "notification.*setting\|push.*preference\|notification.*toggle\|notif.*switch" \
  lib/ src/ --include="*.dart" --include="*.ts" -r . 2>/dev/null | head -10
```

---

## Step 3: Output

PUSH AUDIT
═══════════════════════════════════════════════════════════

Provider: {Firebase / APNS direct / OneSignal / etc.}
Platform: {iOS / Android / Both}

TECHNICAL IMPLEMENTATION
Token registration: PASS / FAIL — {notes}
Token refresh handling: PASS / FAIL
Android notification channels: PASS / FAIL / N/A
Foreground handling: PASS / FAIL
Background tap routing: PASS / FAIL
Terminated-state routing: PASS / FAIL
Deep link routing on tap: PASS / FAIL — {notes}

STRATEGY
Notification types: N types
Estimated frequency: {N/week for average user}
Personalization: {High / Medium / Low / None}
Independent opt-out per type: PASS / FAIL
Critical Issues

[CRITICAL] {issue} — {fix}
...
Warnings

[WARN] {issue} — {recommendation}
...

VERDICT: PASS / NEEDS WORK / CRITICAL (will silently drop notifications)
═══════════════════════════════════════════════════════════

---

## Step 4: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"push-audit","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"push-audit","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `success`, `fail`, or `abort`.