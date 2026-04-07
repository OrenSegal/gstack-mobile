---
name: mobile-retro
preamble-tier: 4
version: 1.0.0
description: |
  Post-ship mobile retrospective. Delegates to /retro for the engineering
  layer (commits, PRs, velocity), then adds mobile-specific metrics: crash-free
  rate delta, ANR rate delta, binary size delta, store review sentiment, and
  release cadence vs target. Run after each release or weekly. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---
<!-- gstack-mobile: mobile-retro/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-retro","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /mobile-retro

Run this after each release or at the end of a sprint. Step 0 delegates the full
engineering retrospective to `/retro`. Steps 1–5 add the mobile-specific layer that
`/retro` cannot produce: crash rates, ANR rates, store reviews, binary size, and
release velocity.

---

## Step 0: Engineering retro — delegate to /retro

Read `/retro` skill at `~/.claude/skills/gstack/retro/SKILL.md` and run the full
retro. It covers: commit analysis, PR metrics, file hotspot analysis, and team
velocity breakdown. Do not duplicate any of those checks here.

When `/retro` completes, continue with the mobile-specific sections below.

---

## Step 1: Detect framework and load crash baseline

```bash
# Detect framework
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

# Get current version
if [ "$_FRAMEWORK" = "Flutter" ]; then
  _VERSION=$(grep "^version:" pubspec.yaml 2>/dev/null | head -1 | awk '{print $2}')
elif [ "$_FRAMEWORK" = "Expo" ] || [ "$_FRAMEWORK" = "React Native" ]; then
  _VERSION=$(grep '"version"' package.json 2>/dev/null | head -1 | tr -d ' "version:,')
elif [ "$_FRAMEWORK" = "Swift" ]; then
  _VERSION=$(find . -name "Info.plist" -maxdepth 4 2>/dev/null | head -1 | \
    xargs grep -A1 "CFBundleShortVersionString" 2>/dev/null | grep string | \
    sed 's/.*<string>\(.*\)<\/string>/\1/')
elif [ "$_FRAMEWORK" = "Kotlin" ]; then
  _VERSION=$(grep "versionName" app/build.gradle app/build.gradle.kts 2>/dev/null | head -1 | \
    sed 's/.*versionName[[:space:]]*"\(.*\)".*/\1/')
fi
echo "Version: ${_VERSION:-unknown}"

# Load crash baseline written by /mobile-canary
_BASELINE_FILE=~/.gstack/mobile-baselines.json
if [ -f "$_BASELINE_FILE" ]; then
  echo "Baseline found:"
  cat "$_BASELINE_FILE"
else
  echo "No baseline found — run /mobile-canary after each release to build history"
fi
```

---

## Step 2: Crash-free rate delta

Read the crash dashboard for the release period and compare to the previous release.

**If Sentry is configured** (`SENTRY_AUTH_TOKEN` in `~/.gstack/mobile.env`):

```bash
[ -f ~/.gstack/mobile.env ] && source ~/.gstack/mobile.env || true
if [ -n "$SENTRY_AUTH_TOKEN" ] && [ -n "$SENTRY_ORG" ] && [ -n "$SENTRY_PROJECT" ]; then
  # Issues opened or regressed in the release window
  curl -s -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
    "https://sentry.io/api/0/projects/$SENTRY_ORG/$SENTRY_PROJECT/issues/?query=is:unresolved&sort=freq&limit=10" \
    2>/dev/null | jq -r '.[] | "\(.count) events: \(.title)"' 2>/dev/null \
    || echo "Sentry unavailable — check manually"
else
  echo "SENTRY_AUTH_TOKEN not set — check ~/.gstack/mobile.env"
fi
```

**If Firebase Crashlytics** is in use:

```bash
which firebase 2>/dev/null && \
  echo "firebase CLI available — check Crashlytics in Firebase Console for version ${_VERSION:-current}" \
  || echo "firebase CLI not installed — check manually in Firebase Console → Crashlytics"
```

**Targets:**
- Crash-free rate: > 99.5% (App Store average for top apps)
- New crash groups introduced this release: 0
- Regression from prior release: < 0.1%

---

## Step 3: ANR rate delta (Android)

```bash
# ANR check — Play Console API or fastlane
[ -n "$PLAY_JSON_KEY" ] || echo "PLAY_JSON_KEY not set in mobile.env — check ANR manually in Play Console → Android Vitals"
[ -n "$PLAY_PACKAGE_NAME" ] || echo "PLAY_PACKAGE_NAME not set"

echo "Manual check: Play Console → Android Vitals → ANR rate"
echo "  Target: < 0.47% (above this = Play Store 'bad behavior' badge)"
echo "  Healthy target: < 0.2%"
```

---

## Step 4: Binary size delta

```bash
echo "Binary size check for $_FRAMEWORK:"

if [ "$_FRAMEWORK" = "Flutter" ]; then
  # Compare current build to previous
  ls -lh build/app/outputs/bundle/release/app-release.aab 2>/dev/null \
    || echo "No AAB found — run flutter build appbundle"
  ls -lh build/ios/iphoneos/Runner.app 2>/dev/null || true
  echo "  Compare to previous release in App Store Connect → TestFlight → Builds"

elif [ "$_FRAMEWORK" = "Expo" ] || [ "$_FRAMEWORK" = "React Native" ]; then
  find . -name "*.aab" -o -name "*.ipa" 2>/dev/null | xargs ls -lh 2>/dev/null | head -5 \
    || echo "No build artifacts found locally — check EAS build dashboard"

elif [ "$_FRAMEWORK" = "Swift" ]; then
  find . -name "*.ipa" -maxdepth 4 2>/dev/null | xargs ls -lh 2>/dev/null | head -3 \
    || echo "No IPA found — check Xcode Organizer or App Store Connect"

elif [ "$_FRAMEWORK" = "Kotlin" ]; then
  find . -name "*.aab" -o -name "*.apk" 2>/dev/null | xargs ls -lh 2>/dev/null | head -5 \
    || echo "No AAB/APK found — run gradle assembleRelease"
fi

echo ""
echo "  Flag if size grew > 5% release-over-release — investigate with /perf-audit"
```

---

## Step 5: Store review sentiment delta

```bash
# iOS App Store reviews (if asc CLI available)
if which asc 2>/dev/null; then
  asc reviews list --limit 20 2>/dev/null | head -30 \
    || echo "asc reviews: check credentials or run: asc auth"
else
  echo "asc CLI not available — check manually in App Store Connect → Ratings and Reviews"
fi

# Android Play Store reviews (if fastlane supply configured)
if which fastlane 2>/dev/null && [ -n "$PLAY_JSON_KEY" ]; then
  echo "Run: fastlane run get_managed_play_store_publishing_rights"
  echo "Or check manually: Play Console → Reviews"
else
  echo "Manual check: Play Console → Ratings and Reviews"
fi

echo ""
echo "Sentiment targets:"
echo "  No new 1-star wave in first 24 hours"
echo "  Average rating delta: < -0.1 vs previous release"
```

---

## Step 6: Release cadence

```bash
# Count releases in the last 30 days via git tags
git tag --sort=-version:refname | head -10
git log --oneline --since="30 days ago" --merges | wc -l | xargs echo "Merge commits (last 30 days):"

echo ""
echo "Release cadence targets:"
echo "  Mobile: 1–2 releases/month (App Store review time: 1–3 days)"
echo "  Hotfix path: TestFlight → expedited review if crash-free dropped > 1%"
```

---

## Step 7: Output

MOBILE RETROSPECTIVE
═══════════════════════════════════════════════════════════

Date: {date}
Version: {version}   Framework: {Flutter / Expo / Swift / Kotlin}
Sprint / Period: {dates}

── ENGINEERING (from /retro) ──────────────────────────────
Commits: {N}   PRs merged: {N}   Hotfixes: {N}
Top hotspot: {file}
Velocity vs target: {N story points / N tickets}

── MOBILE METRICS ─────────────────────────────────────────
Crash-free rate: {N}%  (prev: {N}%,  delta: {+/-N%})
ANR rate:        {N}%  (prev: {N}%,  delta: {+/-N%})
Binary size:     {N}MB (prev: {N}MB, delta: {+/-N%})
Store rating:    {N}★  (prev: {N}★,  delta: {+/-N})

── REVIEW SENTIMENT ───────────────────────────────────────
New reviews:     {N}  (positive: {N}, neutral: {N}, negative: {N})
Top complaint:   {theme}
Top praise:      {theme}

── ACTION ITEMS ───────────────────────────────────────────
[CRITICAL] {item if crash-free dropped > 0.5%}
[HIGH]     {item}
[MEDIUM]   {item}

VERDICT: STRONG / HEALTHY / NEEDS_ATTENTION / CRITICAL
═══════════════════════════════════════════════════════════

---

## Step 8: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-retro","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
if [ "$_TEL" != "off" ]; then
echo '{"skill":"mobile-retro","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `strong`, `healthy`, `needs_attention`, or `critical`.
