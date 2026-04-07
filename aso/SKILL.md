---
name:aso
preamble-tier: 4
version: 1.0.0
description: |
  App Store Optimization audit and improvement. Reviews title, subtitle, keywords,
  description, screenshots, preview video, ratings strategy, and A/B testing setup.
  Benchmarks against top-ranked competitors in your category. Run after each major
  version ship, when organic downloads plateau, or when launching in a new category.
  (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - WebSearch
  - AskUserQuestion
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

Downloads are determined before the user touches your app. Title, icon, first two
screenshots, and the first line of the description — that's what most users see.
This audit makes every pixel of that impression count.

---

## Step 0: Gather current metadata

Ask the user for or read from the project:

```bash
# App name and bundle ID
grep -r "CFBundleName\|CFBundleDisplayName" ios/ --include="*.plist" 2>/dev/null | head -3
grep "applicationId\|namespace" android/app/build.gradle 2>/dev/null | head -3

# Current version for App Store link
grep "^version:" pubspec.yaml 2>/dev/null | head -1

# Any existing ASO metadata
find . -name "metadata" -type d 2>/dev/null | head -5
find . -name "*.json" -path "*/fastlane/*" 2>/dev/null | head -5
```

Also ask:
1. What category is the app listed in (primary)?
2. What are the 3-5 keywords you're currently using?
3. What are the 2-3 apps you consider direct competitors?
4. What is the app's core value in one sentence?

---

## Step 1: Competitive keyword research

```bash
# Research top competitors in the category
echo "Researching competitor ASO..."
```

Use WebSearch to research:
- Top 5 apps in the same category on App Store and Play Store
- Their titles, subtitles, and keyword fields (where visible)
- Their review counts and average ratings
- Their first two screenshot themes (what value do they lead with?)

Search queries:
- `"[competitor name] app store keywords ASO"`
- `"[category] app store optimization keywords 2025"`
- `"[category] top apps app store 2025"`

Identify:
- High-volume keywords competitors are ranking for that you are not
- Long-tail keywords with lower competition that match your value prop
- Keywords in your category that appear in top-ranked titles and subtitles

---

## Step 2: Title and subtitle audit

**App Store (iOS):**
- Title: max 30 characters. Must include the primary keyword.
- Subtitle: max 30 characters. Second most important keyword placement.
- Character counts matter: every unused character in title/subtitle is a missed keyword slot.

**Play Store (Android):**
- Title: max 30 characters. Keyword weight is highest here.
- Short description: max 80 characters. Second-most indexed field.
- The long description also contributes to indexing — keyword density matters.

Evaluate the current title and subtitle:
- Does the title include the most searched keyword for the app's core function?
- Is the subtitle differentiated from the title (not just a tagline)?
- Are both title and subtitle under the character limit?
- Is there obvious keyword stuffing (which triggers App Review penalties)?

---

## Step 3: Keyword field audit (iOS only)

iOS has a 100-character keywords field (comma-separated, no spaces around commas).

Rules:
- Do NOT include the app name — it's already indexed
- Do NOT include competitor names — against App Store policy
- Do NOT repeat words already in the title or subtitle
- Use singular OR plural, not both (the store indexes both automatically)
- Include misspellings only if the volume justifies it
- Use all 100 characters

Evaluate current keywords:
- Are there duplicates with the title/subtitle?
- Are there low-volume keywords wasting slots?
- Are there high-volume category keywords missing?

---

## Step 4: Screenshots audit

The first two screenshots are visible in search results without expanding. They determine
click-through rate more than any other element.

For each screenshot position, evaluate:
1. What is the headline message?
2. Is the benefit (not the feature) communicated at thumbnail size?
3. Is the CTA or primary action visible?
4. Is the design premium — does it look like a $10/month app or a free side project?

**Framework for effective screenshots:**

| Position | Purpose | Pattern |
|---|---|---|
| 1 | Hook | Strongest value prop — the one sentence that made you build this |
| 2 | Proof | Show the feature doing the thing (real UI, real data) |
| 3 | Second value prop | Second most compelling reason to download |
| 4 | Social proof | Real reviews, user count, press mentions |
| 5-10 | Feature depth | Details for high-intent users who want to understand before downloading |

**Common mistakes to flag:**
- Screenshot 1 shows a login screen or empty state (critical)
- Screenshot text is too small to read at thumbnail size (critical)
- All screenshots show the same mood/color — no visual variety to hold the eye
- Feature captions use internal terminology ("AI-powered semantic scanner") instead of benefits ("Never wonder what's expiring next")

---

## Step 5: Rating and review strategy

```bash
# Check for review request implementation
grep -rn "requestReview\|SKStoreReviewController\|ReviewManager\|inAppReview\|AskForReview" \
  lib/ src/ --include="*.dart" --include="*.ts" --include="*.swift" --include="*.kt" \
  -r . 2>/dev/null | head -10
```

Check:
- Is `SKStoreReviewController.requestReview()` (iOS) or `ReviewManager` (Android) called?
- When is it called? Must be after a positive action (completion, achievement, streak).
  Never on launch, never after an error, never before value is demonstrated.
- Is there a negative feedback path? ("Not satisfied → feedback form" prevents bad reviews
  from hitting the store while capturing feedback)
- iOS limits: `requestReview()` can only fire 3 times per 365 days per user. Use wisely.

---

## Step 6: Output

ASO AUDIT
═══════════════════════════════════════════════════════════

App: {name} | Category: {category}
Store: {App Store / Play Store / Both}
Date: {date}

CURRENT METADATA QUALITY

Title: {current title} ({N}/30 chars)
→ Issue: {does not include primary keyword} OR → ✓ Good
Subtitle: {current subtitle} ({N}/30 chars)
→ Issue: {...} OR → ✓ Good
Keywords (iOS): {N}/100 chars used
→ Wasted slots: {list}
→ Missing high-volume: {list}

SCREENSHOTS
Screenshot 1: {verdict and issue}
Screenshot 2: {verdict and issue}

RATINGS STRATEGY
Review request implemented: YES / NO
Placement: {after completion / on launch / missing}
Issue: {if any}

TOP 3 IMPROVEMENTS (ranked by estimated impact on downloads)

    {change} — {estimated impact: e.g., "3-5x improvement in search impressions"}

    {change} — {estimated impact}

    {change} — {estimated impact}

COMPETITOR KEYWORD GAPS
Keyword	Competitor using it	Monthly volume (est.)	Difficulty
{keyword}	{competitor}	{high/med/low}	{high/med/low}

RECOMMENDED TITLE REWRITE
Current: "{title}"
Suggested: "{title with primary keyword}" ({N}/30 chars)
Rationale: {why}

RECOMMENDED SUBTITLE REWRITE
Current: "{subtitle}"
Suggested: "{subtitle with secondary keyword}" ({N}/30 chars)
Rationale: {why}

RECOMMENDED KEYWORDS (iOS, 100 chars)
{keyword,keyword,keyword,...}
═══════════════════════════════════════════════════════════

---

## Step 7: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"aso","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"aso","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `success`, `fail`, or `abort`.