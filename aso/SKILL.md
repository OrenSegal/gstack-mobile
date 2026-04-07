---
name: aso
preamble-tier: 4
version: 1.0.0
description: |
  App Store Optimization audit. Reviews app name, subtitle, keywords, screenshots,
  description, ratings, and competitive positioning for iOS App Store and Google Play.
  Run BEFORE /store-ship on initial launch or major version update. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
  - WebSearch
---
<!-- gstack-mobile:aso/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"aso","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /aso

ASO is the highest-leverage growth channel for mobile apps. A well-optimized listing
can 2-3x installs without paid spend. This audit ensures your store listing is ready
for discovery and conversion.

---

## Step 0: Gather current listing

Collect current state:

```bash
echo "Gather current listing data:"
echo "- iOS: App Store Connect -> App Information"
echo "- Android: Play Console -> Main store listing"
echo ""
echo "Record:"
echo "- App name:"
echo "- Subtitle (iOS) / Short description (Android):"
echo "- Full description:"
echo "- Keywords (iOS):"
echo "- Screenshots (which ones, order):"
echo "- Rating and review count:"
```

Ask the user for this data or find in project docs.

---

## Step 1: App name audit

**Requirements:**
- Unique, searchable name
- Includes primary keyword if brand doesn't make it obvious
- Not too long (<30 characters)
- No trademark conflicts

**Check:**
- [ ] Name clearly communicates what the app does
- [ ] Name is searchable (users can find it with core keyword)
- [ ] No generic name like "App Name" or "My App"

---

## Step 2: Keywords (iOS)

```bash
# Current keyword usage
echo "Current iOS keywords (100 char limit):"
echo "Record current keywords:"
```

**Requirements:**
- All 100 characters used
- No duplicate or redundant terms
- Keywords separated by commas (no spaces)
- No competitor brand names (rejection risk)
- High-volume + medium-volume mix

**Common mistakes:**
- Repeating the same word with different forms ("run, running, runner")
- Using stop words ("the", "and", "best" — Apple ignores these)
- Using competitor names

---

## Step 3: Description audit

**iOS:**
- First paragraph is critical (most users don't expand)
- Lead with the value proposition
- Feature list in bullet points
- No keyword stuffing (read naturally)

**Android:**
- First 175 characters visible in search results
- Primary keyword in first sentence
- Feature list in bullet points

**Check:**
- [ ] First sentence hooks the user
- [ ] Primary features listed
- [ ] No spelling/grammar errors
- [ ] Updated recently (not stale)

---

## Step 4: Screenshots audit

```bash
echo "Screenshot review checklist:"
echo "- First 2 screenshots visible without scrolling"
echo "- Different value prop on each screenshot"
echo "- Text overlay explains the feature"
echo "- Works at thumbnail size"
echo "- Localized for key markets (if applicable)"
```

**iOS requirements:**
- 6-10 screenshots (iPhone), 6-10 (iPad separate)
- Different orientations
- No device frames

**Android requirements:**
- 2-8 screenshots
- Feature graphic (1024x500)
- TV banner (for TV Leanback)

---

## Step 5: Ratings and reviews

- Current rating: {_}
- Review count: {_}
- Recent rating trend: improving / stable / declining
- Any 1-star reviews needing response?

**Response strategy:**
- Respond to negative reviews within 24 hours
- Be professional, not defensive
- Offer to help (take off-platform)

---

## Step 6: Category and competition

```bash
echo "Category analysis:"
echo "- Primary category: "
echo "- Secondary categories (if any): "
echo "- Competitor apps: "
```

**Check:**
- Category choice maximizes discoverability
- Competitors identified for keyword research
- Differentiation clear in listing

---

## Step 7: Output format

ASO AUDIT
═══════════════════════════════════════════════════════════
App: {name}
Platform: iOS / Android / Both

NAME
- Name: {current}
- Issues: NONE / {list}
- Recommendation: {keep / change}

KEYWORDS (iOS)
- Current: {keyword string}
- Used: {N}/100 chars
- Issues: NONE / {list}

DESCRIPTION
- Hook quality: GOOD / NEEDS WORK
- Issues: NONE / {list}

SCREENSHOTS
- Count: {N}
- First 2 showing value: YES / NO
- Issues: NONE / {list}

RATING
- Current: {_} stars
- Review count: {N}

VERDICT: READY / NEEDS WORK / NOT STARTED
═══════════════════════════════════════════════════════════

If VERDICT is NEEDS WORK, prioritize top 5 changes to make before launch.

---

## Step 8: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"aso","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
```