---
name: mobile-retro
preamble-tier: 4
version: 1.0.0
description: |
  Weekly mobile retro scoped to AARRR metrics, crash rates, ANR/jank trends, store
  review velocity, and activation funnel performance. Reads from crash reporting dashboards,
  analytics, and App Store Connect / Play Console data. Produces a focused retrospective
  with ranked action items for the next week. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - WebSearch
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
# Read previous retro if it exists
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
_RETRO_DIR="${GSTACK_HOME:-$HOME/.gstack}/projects/${SLUG:-unknown}/retros"
mkdir -p "$_RETRO_DIR"
_LAST_RETRO=$(ls -t "$_RETRO_DIR"/mobile-retro-*.md 2>/dev/null | head -1)
[ -n "$_LAST_RETRO" ] && echo "LAST_RETRO: $_LAST_RETRO" || echo "LAST_RETRO: none"
```

If `LAST_RETRO` is not `none`, read it before starting — compare this week against last week.

---

# /mobile-retro

One hour, once a week. What worked, what broke, what to fix next. This retro focuses on
the metrics that predict long-term retention — not vanity numbers.

---

## Step 0: Collect data

Ask the user for or look up from dashboards:

**Required:**
- D1 retention rate (last week vs. week before)
- D7 retention rate
- Crash-free sessions rate (Sentry / Crashlytics / Firebase)
- App Store rating (current + trend)
- New reviews this week (positive / negative ratio)

**If available:**
- Activation rate (installs → first core action)
- Push notification open rate
- Session length trend
- Revenue / IAP conversion rate (if applicable)
- App Store impressions and conversion rate (App Store Connect data)

If the user cannot provide these, ask which dashboard they use and guide them to the
specific numbers. Don't proceed with a retro without at least D1 retention and crash rate.

---

## Step 1: Crash analysis

```bash
# Check for recent crash/error logs in the repo
find . -name "*.crash" -o -name "crash_log*" 2>/dev/null | head -5
# Check Sentry or Crashlytics integration
grep -r "Sentry\|Crashlytics\|firebase_crashlytics" pubspec.yaml lib/ 2>/dev/null | head -5
```

For each crash that affected > 0.1% of sessions this week:
- Read the stack trace (ask the user to paste if not in the repo)
- Identify the root cause
- Classify: regression (new this week) or pre-existing
- Estimate fix time (human vs. cc+gstack)
- Recommend priority: P0 (fix now), P1 (fix this week), P2 (fix next sprint)

Target: crash-free sessions > 99.5%. Flag anything below 99%.
Below 99%: CRITICAL — blocks next ship.
Below 99.5%: WARN — fix this sprint.

---

## Step 2: Retention analysis

Retention benchmarks by app type:

| App type | D1 | D7 | D30 |
|---|---|---|---|
| Games | 35-40% | 15-20% | 5-8% |
| Social | 40-50% | 25-35% | 15-25% |
| Utility / productivity | 25-35% | 10-20% | 5-15% |
| E-commerce | 35-45% | 15-25% | 8-15% |
| Health / fitness | 30-40% | 15-25% | 8-18% |

Compare the user's numbers against benchmarks. For each metric below benchmark:
- Is the drop gradual (feature quality issue) or sudden (regression from a recent ship)?
- Which cohort is affected (new users, returning users, specific device)?
- What is the most likely cause?

---

## Step 3: Week's ships review

```bash
# Review what shipped this week
git log --since="7 days ago" --oneline --decorate 2>/dev/null | head -15
```

For each ship this week:
- Did it include a crash regression? (flag if so)
- Did it include a feature that likely impacts retention (positive or negative)?
- Are there store reviews mentioning the new version?

---

## Step 4: Store review velocity

```bash
# Check recent reviews (manual or via API if available)
echo "Check App Store Connect and Play Console for this week's reviews"
```

Track:
- Number of new reviews this week
- Rating trend (improving, stable, declining)
- Top recurring complaint
- Top recurring praise

---

## Step 5: Action items

Rank action items by impact:

PRIORITY TEMPLATE
═══════════════════════════════════════════════════════════

P0 (block next ship):
- [ ] {critical crash fix}
- [ ] {critical regression}

P1 (this week):
- [ ] {metric improvement}
- [ ] {store review response}

P2 (next sprint):
- [ ] {nice-to-have improvement}
- [ ] {technical debt}

P3 (backlog):
- [ ] {investigation needed}
═══════════════════════════════════════════════════════════

---

## Step 6: Output

MOBILE RETRO — Week of {date}
═══════════════════════════════════════════════════════════

RETENTION
- D1: {N}% (vs last week: {+N% / -N%})
- D7: {N}% (vs last week: {+N% / -N%})
- Verdict: {on track / below benchmark / critical}

CRASH RATE
- Crash-free sessions: {N}%
- New crashes this week: {N}
- Verdict: {on track / needs work / critical}

STORE
- Rating: {N} stars (trend: ↑/↓/→)
- Reviews this week: {N} ({P} positive, {N} negative)
- Top complaint: {theme}
- Top praise: {theme}

SHIPS THIS WEEK
- {commit message}
- {commit message}

PRIORITY ACTIONS

P0 (blocks ship):
1. {action}

P1 (this week):
1. {action}
2. {action}

P2 (next sprint):
1. {action}

NEXT RETRO: {date + 7 days}
═══════════════════════════════════════════════════════════

Save to: `~/.gstack/projects/{project}/retros/mobile-retro-{date}.md`

---

## Step 7: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-retro","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"mobile-retro","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `success`, `fail`, or `abort`.