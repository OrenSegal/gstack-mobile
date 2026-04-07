---
name: mobile-canary
preamble-tier: 4
version: 1.0.0
description: |
  Post-deploy mobile monitoring. Watches crash-free rate, ANR rate, and store
  rating delta in the hours after a release using Firebase Crashlytics, Sentry,
  or Play Console. No browser required. Use when: "monitor deploy", "watch
  crash rate after release", "post-deploy check", "is the release healthy".
  Distinct from /canary (web/browser). (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---
<!-- gstack-mobile: mobile-canary/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-canary","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

## Step -1: Detect framework

```bash
if [ -f "pubspec.yaml" ]; then
  _FRAMEWORK="Flutter"
elif [ -f "package.json" ] && grep -q '"expo"' package.json 2>/dev/null; then
  _FRAMEWORK="Expo"
elif [ -f "package.json" ]; then
  _FRAMEWORK="React Native"
elif find . -maxdepth 1 -name "*.xcodeproj" -type d 2>/dev/null | grep -q .; then
  _FRAMEWORK="Swift"
elif [ -f "app/build.gradle" ] || [ -f "app/build.gradle.kts" ]; then
  _FRAMEWORK="Kotlin"
else
  _FRAMEWORK="unknown"
fi
echo "Framework: $_FRAMEWORK"
```

---

# /mobile-canary — Post-Deploy Crash Monitor

The web `/canary` watches a URL in a headless browser. Mobile apps don't have URLs
to screenshot — they have crash rates, ANR rates, and store reviews. This skill
watches those instead.

Run in the first 1-2 hours after a release rollout, or whenever someone says "is
this release healthy?"

---

## Step 0: Detect crash provider and get release version

```bash
# Detect crash reporting provider
_HAS_SENTRY=0
_HAS_FIREBASE=0
grep -r "sentry" pubspec.yaml package.json 2>/dev/null | head -3 && _HAS_SENTRY=1 || true
grep -r "firebase_crashlytics\|@firebase/crashlytics" pubspec.yaml package.json 2>/dev/null | head -3 && _HAS_FIREBASE=1 || true
echo "Sentry: $_HAS_SENTRY, Firebase: $_HAS_FIREBASE"

# Get current version — method depends on framework
if [ "$_FRAMEWORK" = "Flutter" ]; then
  grep "^version:" pubspec.yaml 2>/dev/null | head -1
elif [ "$_FRAMEWORK" = "Expo" ] || [ "$_FRAMEWORK" = "React Native" ]; then
  grep '"version"' package.json 2>/dev/null | head -1 | tr -d ' "version:,'
elif [ "$_FRAMEWORK" = "Swift" ]; then
  find . -name "Info.plist" -maxdepth 4 2>/dev/null | head -1 | \
    xargs grep -A1 "CFBundleShortVersionString" 2>/dev/null | grep string | \
    sed 's/.*<string>\(.*\)<\/string>/\1/'
elif [ "$_FRAMEWORK" = "Kotlin" ]; then
  grep "versionName" app/build.gradle app/build.gradle.kts 2>/dev/null | head -1
fi \
  || echo "VERSION: unknown — check manually"
```

```bash
# Read previous baseline for comparison
_BASELINE_FILE=~/.gstack/mobile-baselines.json
_PREV_CRASH_FREE="none"
_PREV_ANR="none"
_PREV_VERSION="none"
if [ -f "$_BASELINE_FILE" ]; then
  _PREV_CRASH_FREE=$(python3 -c "import json; d=json.load(open('$_BASELINE_FILE')); print(d.get('crash_free_rate','none'))" 2>/dev/null \
    || jq -r '.crash_free_rate // "none"' "$_BASELINE_FILE" 2>/dev/null \
    || echo "none")
  _PREV_ANR=$(python3 -c "import json; d=json.load(open('$_BASELINE_FILE')); print(d.get('anr_rate','none'))" 2>/dev/null \
    || jq -r '.anr_rate // "none"' "$_BASELINE_FILE" 2>/dev/null \
    || echo "none")
  _PREV_VERSION=$(python3 -c "import json; d=json.load(open('$_BASELINE_FILE')); print(d.get('version','none'))" 2>/dev/null \
    || jq -r '.version // "none"' "$_BASELINE_FILE" 2>/dev/null \
    || echo "none")
  echo "Previous baseline: v$_PREV_VERSION | crash-free: $_PREV_CRASH_FREE% | ANR: $_PREV_ANR%"
else
  echo "No baseline found — this run will establish the baseline"
fi
```

Read `~/.gstack/mobile.env` if it exists for SENTRY_DSN, SENTRY_AUTH_TOKEN,
FIREBASE_PROJECT, SENTRY_ORG, SENTRY_PROJECT.

---

## Step 1: Crash-free rate (last 1 hour vs previous 24 hours)

**If Sentry is configured** and `SENTRY_AUTH_TOKEN` is available:

```bash
_SENTRY_RESP=$(curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  "https://sentry.io/api/0/projects/$SENTRY_ORG/$SENTRY_PROJECT/issues/?query=is:unresolved&sort=date&limit=10" \
  2>/dev/null)
if [ -n "$_SENTRY_RESP" ]; then
  # Parse with jq if available, fall back to python3, fall back to raw
  echo "$_SENTRY_RESP" | jq -r '.[] | "\(.firstSeen) \(.culprit) count: \(.count)"' 2>/dev/null \
    || echo "$_SENTRY_RESP" | python3 -c "
import json,sys
data=json.load(sys.stdin)
for i in data[:10]: print(i.get('firstSeen','?'), i.get('culprit','?'), 'count:', i.get('count','?'))
" 2>/dev/null \
    || echo "$_SENTRY_RESP" | head -20
else
  echo "Sentry API call failed — check SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT in ~/.gstack/mobile.env"
fi
```

**If Firebase Crashlytics** is configured with `firebase` CLI:

```bash
if which firebase 2>/dev/null; then
  firebase crashlytics:symbols:download --app "$FIREBASE_APP_ID" 2>/dev/null \
    || echo "Manual check: Firebase Console → Crashlytics → filter by version"
else
  echo "firebase CLI not installed — install with: npm i -g firebase-tools"
  echo "Manual check: Firebase Console → Crashlytics → filter by current version"
fi
```

**If neither is configured:** Tell the user to check the crash dashboard manually
and provide direct links to Firebase Console or Sentry for the configured project.

---

## Step 2: ANR rate (Android only)

```bash
# Check if Play Console API is configured
[ -n "$PLAY_JSON_KEY" ] || echo "No PLAY_JSON_KEY in mobile.env — check ANR rate manually in Play Console"
[ -n "$PLAY_PACKAGE_NAME" ] || echo "No PLAY_PACKAGE_NAME in mobile.env"

# If play-cli or fastlane is available:
which fastlane 2>/dev/null && \
  echo "Run: fastlane supply run --track internal (check ANR rate in output)" || true
```

```bash
# R8/ProGuard mapping file — without it, Crashlytics stack traces are unreadable
if [ "$_IS_ANDROID" = "1" ]; then
  find . -name "mapping.txt" -path "*/release/*" 2>/dev/null | head -3 \
    || echo "  WARN: No mapping.txt found — upload to Firebase App Distribution or Play Console"
  echo "  Upload path: Firebase Console → App Distribution → Artifacts → Upload mapping file"
fi
```

Manual fallback: Play Console → Android Vitals → ANR rate. Threshold: >0.47% = Play
Store badge loss. Healthy target: <0.2%.

---

## Step 3: Store review sentiment (first 24 hours post-release)

```bash
# Check if app-store-optimization skill is available for review scraping
ls ~/.claude/skills/app-store-optimization/ 2>/dev/null && \
  echo "Use /app-store-optimization to pull recent store reviews" || true

# If asc CLI is available (iOS):
which asc 2>/dev/null && \
  asc reviews list --app "$ASC_APP_ID" --sort -createdDate --limit 10 2>/dev/null || \
  echo "Manual: App Store Connect → Ratings and Reviews → filter by version"
```

---

## Step 4: Verdict

Evaluate the health signal and write the baseline for next run:

```bash
# Write current metrics as new baseline (update after each canary run)
mkdir -p ~/.gstack
cat > ~/.gstack/mobile-baselines.json << EOF
{
  "version": "$_VERSION",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "crash_free_rate": "FILL_IN",
  "anr_rate": "FILL_IN",
  "new_crash_groups": "FILL_IN"
}
EOF
echo "Baseline written to ~/.gstack/mobile-baselines.json"
echo "Update FILL_IN values with actual metrics from Steps 1-2 above"
```

Format the output report including version-to-version comparison:

```
MOBILE CANARY REPORT
════════════════════════════════════════════════════
Version: {version}   (prev: {_PREV_VERSION})
Window: {time since deploy}
Baseline: {first run / compared to v{_PREV_VERSION}}

CRASH RATE
  Last hour crash-free: {N}%  (prev: {_PREV_CRASH_FREE}%)
  Delta: {+/-N%}
  New crash groups: {N}
  Regressions: {N}

ANR RATE (Android)
  Rate: {N}%  (prev: {_PREV_ANR}%)
  Delta: {+/-N%}

STORE REVIEWS
  New reviews: {N}
  Sentiment: {positive/neutral/negative split}
  New 1-stars: {N}

SYMBOLICATION
  Mapping file uploaded: YES / NO / N/A

VERDICT: HEALTHY / DEGRADED / CRITICAL / NO_DATA
════════════════════════════════════════════════════
```

**CRITICAL** = crash-free rate dropped >1% vs baseline OR new crash group with >10 occurrences in first hour
→ Recommend immediate rollback or pause rollout.

**DEGRADED** = crash-free dropped 0.3–1% vs baseline OR new ANR spike >50% vs baseline
→ Continue monitoring, prepare rollback, investigate top crash.

**HEALTHY** = all metrics within baseline ±0.3%
→ Continue rollout.

**NO_DATA** = crash provider not configured or API credentials missing
→ Check manually in Firebase Console / Sentry / Play Console. Set up credentials in `~/.gstack/mobile.env`.

---

## Step 5: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-canary","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
if [ "$_TEL" != "off" ]; then
echo '{"skill":"mobile-canary","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `healthy`, `degraded`, or `critical`.
