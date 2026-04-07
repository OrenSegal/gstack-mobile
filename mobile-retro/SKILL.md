---
name: mobile-retro
description: Mobile ship retrospective — analyze release metrics, crash rates, store reviews, user feedback, and velocity to improve mobile development process.
---

# /mobile-retro

Run this after a mobile release stabilizes (typically 1-2 weeks post-launch). This skill reviews the release to identify what worked, what didn't, and how to improve the mobile development process.

## Use when

- Shipped a new mobile version to production.
- Want to analyze release health and user feedback.
- Setting up regular mobile shipping retrospectives.
- Comparing release performance to previous releases.
- Identifying patterns in crash reports or store reviews.
- Improving mobile team velocity and process.

## Inputs

Collect or infer:

- Platform: `flutter`, `swift`, `kotlin`, or `expo`.
- Target OS: iOS, Android, or both.
- Release version: what was shipped.
- Release date: when it went live.
- Key metrics: crash rate, ANR rate, session length, DAU before/after.
- Store feedback: ratings, reviews, support contacts.
- What changed: major features, bug fixes, or changes in this release.

If platform is missing:
- Read `~/.gstack/config` or project docs.
- If still unclear, ask one concise question before proceeding.

## Review standard

### 1. Crash and stability metrics
- Crash-free sessions (target: 99%+ for stable apps, 95%+ for new apps).
- ANR rate (Android): target < 0.1%.
- Crash trends: is crash rate stable, increasing, or decreasing post-release?
- Specific crash signatures that need hotfixing.
- Compare to baseline (previous release or industry benchmarks).

### 2. Store reviews and ratings
- Rating change: up, down, or flat.
- Key themes in recent reviews (positive and negative).
- Any one-star reviews requiring immediate response.
- Comparison to competitor ratings.
- Review volume: are more people reviewing?

### 3. User feedback and support
- Support ticket volume change.
- Common issues reported (workarounds, work-stopping bugs).
- Feature requests that appear repeatedly.
- User sentiment: happy, frustrated, neutral?

### 4. Engagement and retention
- DAU/MAU change post-release.
- Session length and frequency changes.
- Funnel conversion changes (if measured).
- Any negative impact on retention metrics.

### 5. Release process
- Time from code complete to store approval.
- Any submission issues or rejections.
- Rollout strategy effectiveness (immediate vs phased).
- Build and submission automation status.

### 6. What went well
- Celebrate wins: stable launch, positive reviews, fast approval.
- Identify practices to repeat.

### 7. What to improve
- Specific issues that caused problems.
- Process gaps (testing, review, monitoring).
- Communication gaps (with users, within team).
- Planning gaps (underestimating effort or risk).

### 8. Action items
- Concrete improvements for next release.
- Assign owners and timelines.
- Track action item completion.

## Output format

Use this exact structure:

### Verdict
One paragraph summarizing the release health:
- `SUCCESS` — stable release, positive metrics
- `WARNING` — some issues, need monitoring
- `FAIL` — serious problems requiring hotfix

### Key metrics
Bullets with actual numbers (crash rate, rating, etc.).

### What went well
Bullets on positive outcomes and practices to repeat.

### What to improve
Bullets on issues and process gaps.

### Action items
Specific, assigned, time-boxed improvements for next release.

### Platform-specific notes
Split into:
- `iOS`
- `Android`
- `Flutter / shared`
Only include sections that apply.

## Style

- Be direct and specific.
- Focus on actionable insights, not just data.
- Celebrate wins but don't sugarcoat problems.
- Make action items specific enough to actually do.
- Compare to previous releases when possible.

## Mobile-specific checks

- Compare iOS vs Android metrics if both are shipped.
- Track Play Store vs App Store differences.
- Note any device-specific issues (certain models, OS versions).
- Consider regional differences if applicable.

## Examples

Good prompts:
- `/mobile-retro review the v2.5 release for crash rate and store reviews`
- `/mobile-retro analyze this Flutter app launch for improvement areas`
- `/mobile-retro set up a regular mobile release retrospective process`

Bad prompts:
- `/mobile-retro review the app`
- `/mobile-retro check how it went`