---
name: onboarding-audit
preamble-tier: 4
version: 1.0.0
description: |
  Audits the mobile onboarding flow against AARRR activation best practices. Counts
  taps to core value, checks permission timing, identifies friction that kills activation,
  and compares against benchmarks (Superhuman, Duolingo, Notion, Calm). Run on any branch
  touching signup, first launch, permission prompts, or tutorial screens. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - WebSearch
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

Every tap between launch and core value is a leak in your activation funnel. This audit
counts the leaks and tells you which ones to fix first.

---

## Step 0: Collect onboarding context

Accept any of: screenshots, mockups, screen descriptions in the conversation, or code.
If code is provided:

```bash
# Find onboarding-related screens/routes
grep -rn "onboard\|welcome\|signup\|register\|permission\|tutorial\|intro" \
  lib/ src/ --include="*.dart" --include="*.tsx" --include="*.ts" --include="*.swift" \
  -rl 2>/dev/null | head -20

# Flutter: find Navigator routes for onboarding
grep -rn "pushNamed\|pushReplacementNamed\|GoRouter\|MaterialPageRoute" \
  lib/ --include="*.dart" 2>/dev/null | grep -i "onboard\|welcome\|signup\|intro" | head -10
```

Ask the user to describe the core value moment: "What is the first thing a new user does
that proves the app is worth keeping?" If they can't answer this in one sentence, that is
the first finding.

---

## Step 1: Tap count to core value

Map every screen from cold launch to the core value moment. Count screens and required
taps. Include:
- Splash / loading screen (counts as a tap if user must do anything)
- Welcome / hero screen
- Signup / login
- Permission requests (each permission = a screen interruption)
- Profile setup
- Tutorial / walkthrough steps
- Any "skip" options (note if the user can accelerate)

**Benchmarks (2025):**

| App | Taps to core value | What "core value" means |
|---|---|---|
| Duolingo | 3 (start lesson) | First exercise starts immediately |
| Calm | 4 (first meditation) | Goal → goal set → first audio begins |
| Superhuman | 8 (first email sent) | Justified — high intent, pro users |
| Notion | 5 (first note created) | Template chosen → editing |
| TikTok | 1 (content starts) | Autoplays immediately, sign up is optional |

**Targets by app type:**

| App type | Target taps | Rationale |
|---|---|---|
| Consumer entertainment | 1-2 | Immediate gratification — delay kills |
| Consumer utility | 3-5 | User needs to see value before committing |
| Productivity / pro | 5-8 | Acceptable if each step has clear value |
| High-trust (medical, finance) | 6-10 | Trust-building is justified |

If tap count exceeds the target for the app type, it is a CRITICAL activation risk.

---

## Step 2: Friction audit

For each screen in the onboarding flow:

**Mandatory fields check:**
- Does the user have to provide name, email, or phone number BEFORE seeing value?
  If yes, flag. Apps that show value before requiring signup convert 3-5x better.
- Is sign-in with Apple / Google available? Required on iOS if any other social login
  is offered (App Store Guideline 4.8).

**Permission timing check:**
- Camera, microphone, location, contacts, notifications — when are they requested?
- Notification permission: MUST NOT appear before the user has experienced value.
  The optimal moment is after the user completes the first core action.
- Location permission: only when a location-dependent feature is first invoked.
- Camera/microphone: only when the user taps an action requiring it.

**Progress and skip:**
- Is there a progress indicator (step 1 of 4)? Users complete flows faster when
  they can see the end.
- Can the user skip tutorial/walkthrough steps?
- Is there a "skip to app" option for returning users?

**Value demonstration:**
- Does the app show a preview/demo before asking for signup?
- Is there a single clear headline on each screen that states the benefit (not the feature)?
- Are there social proof signals (user count, reviews, or brand logos)?

---

## Step 3: Permission strategy review

Ideal permission ask sequence:

1. **Cold launch** — no permission asks
2. **Onboarding step 1-2** — show value, no asks
3. **Core value moment** — user experiences the app working (demo, preview, first action)
4. **Post-value ask** — notification opt-in with specific, honest copy: "Get reminded when your streak is at risk" not "Allow notifications"
5. **Contextual asks** — camera when user taps camera button, location when user taps a location feature

Flag any deviation from this sequence as CRITICAL if it precedes value demonstration.

**iOS-specific:** In-app pre-prompt before the OS dialog is strongly recommended.
The OS dialog gives one shot — reject = no second chance without going to Settings.
A pre-prompt with clear benefit copy dramatically improves accept rate.

**Android-specific:** `shouldShowRequestPermissionRationale()` should be checked.
If false AND permission was denied, show an in-app settings deep-link rather than
requesting again (will be auto-denied).

---

## Step 4: Copy audit

For each onboarding screen, evaluate the primary headline and CTA copy:

**Headline checks:**
- Does it describe a benefit ("Keep your pantry waste-free") not a feature ("AI-powered food tracking")?
- Is it under 6 words?
- Would a 12-year-old understand it?

**CTA copy checks:**
- Is the CTA specific ("Start my first lesson") not generic ("Continue" or "Next")?
- Does the CTA set accurate expectations for what happens next?
- Is the CTA the most visually prominent element on the screen?

**Permission request copy checks:**
- Does the pre-prompt explain specifically how the permission is used?
- Does it include a benefit ("so you never miss an expiration") not just a description ("to send you notifications")?
- Is there a "Not now" option?

---

## Step 5: Output

ONBOARDING AUDIT
═══════════════════════════════════════════════════════════

App type: {consumer utility / entertainment / productivity / high-trust}
Core value moment: {what the user does first}
Taps to core value: N (target: M for this app type)

VERDICT: PASS / NEEDS WORK / CRITICAL ACTIVATION RISK
Critical Issues (block next ship if activation is a priority)

[CRITICAL] {screen} — {problem} — {specific fix}
...
Friction Reduction Opportunities

[HIGH] {screen} — {problem} — {specific fix}
[MEDIUM] {screen} — {problem} — {specific fix}
...
Permission Timing
Permission	Current placement	Recommended placement	Risk
Push notifications	Step 1	After first core action	HIGH
Camera	Step 3	On first camera tap	MEDIUM
Copy Quality
Screen	Headline	CTA	Issue
Welcome	"AI-powered tracking"	"Get Started"	Feature-focused + generic CTA
Step 2	"Keep things fresh"	"Allow notifications"	Good headline / premature CTA
Estimated Impact

Fixing critical issues: +{N}% estimated activation improvement
Fixing all high issues: +{N}% estimated activation improvement
(Estimates based on industry benchmarks for similar app types)
Recommended priority order

    {most impactful change}

    {second most impactful}

    ...
    ═══════════════════════════════════════════════════════════

---

## Step 6: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"onboarding-audit","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"onboarding-audit","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `success`, `fail`, or `abort`.