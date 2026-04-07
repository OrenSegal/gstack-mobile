---
name: mobile-retro
preamble-tier: 4
version: 1.0.0
description: |
  Mobile release retrospective. Analyzes crash rates, ANR rates, store reviews, user feedback,
  and velocity to improve the mobile development process. Run weekly or after each major
  mobile release stabilizes (1-2 weeks post-ship). (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - AskUserQuestion
  - WebSearch
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

Mobile releases are higher stakes than web. A bad release can't be hotfixed in 5 minutes
— it takes hours to get through App Review, and Play Console updates in 10-30 minutes but
users don't auto-update. This retro learns from each release to improve the next.

---

## Step 0: Gather data

Before the session, collect:

**Crash data:**
```bash
# iOS: check Firebase Crashlytics or Sentry
# Android: check Play Console -> Crashes & ANRs
echo "Pull crash reports for the past 2 weeks"
```

**Store data:**
```bash
# iOS: App Store Connect -> Ratings and Reviews
# Android: Play Console -> Statistics -> Ratings
echo "Pull rating trends and recent reviews"
```

**Release info:**
- What version shipped? When?
- What was the main change (feature, fix, update)?
- How long from code complete to store approval?

---

## Step 1: Stability metrics

For the retro period (typically 2 weeks):

**Crash metrics:**
- Crash-free sessions: target >99% (iOS), >99.5% (Android)
- Crash count: new crash signatures vs recurring
- ANR rate (Android): target <0.1%

**Review the data:**
- Did any new crash signatures appear post-release?
- Any crash clusters (same crash happening 100+ times)?
- Any device-specific issues?

---

## Step 2: Store reviews

**iOS:**
- Rating change (up/down/flat)
- Count of 1-2 star reviews post-release
- Key themes in negative reviews

**Android:**
- Rating change
- Reviews mentioning crashes, bugs, or issues
- Any policy warnings from Play

---

## Step 3: User feedback

- Support ticket volume change (up/down/flat)
- Common issues in tickets
- Any feature requests that came up repeatedly

---

## Step 4: Release process

- Time from code complete to TestFlight/Play internal: {_} hours/days
- Time from upload to App Store/Play approval: {_} hours/days
- Any submission issues or rejections?
- Rollout strategy: immediate / phased / manual

---

## Step 5: What went well

- Celebrate wins: stable launch, fast approval, positive reviews
- What practices should we repeat?

List specific things that worked:
1.
2.
3.

---

## Step 6: What to improve

- What went wrong or could be better?
- Process gaps (testing, review, monitoring)
- Communication gaps
- Planning gaps

List specific improvements:
1.
2.
3.

---

## Step 7: Action items

For each improvement above, create an action:

| Action | Owner | Due |
|--------|-------|-----|
| | | |
| | | |

---

## Step 8: Output format

MOBILE RETRO
═══════════════════════════════════════════════════════════
Period: {date range}
Version: {version}

STABILITY
- Crash-free sessions: {_}%
- New crash signatures: {N}
- ANR rate (Android): {_}%

STORE
- iOS rating: {_} (was {_})
- Android rating: {_} (was {_})
- 1-2 star reviews: {N}

RELEASE
- Code to TestFlight: {_} hours
- Upload to approval: {_} hours

WHAT WENT WELL
- {item 1}
- {item 2}

WHAT TO IMPROVE
- {item 1}
- {item 2}

ACTION ITEMS
- {action} ({owner}, {due})

VERDICT: SUCCESS / WARNING / NEEDS ATTENTION
═══════════════════════════════════════════════════

Save to `~/.gstack/projects/<slug>/mobile-retro-{date}.md` for history.

---

## Step 9: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-retro","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
```