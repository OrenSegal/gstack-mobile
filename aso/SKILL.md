---
name: aso
description: App Store Optimization audit — review app listing, keywords, screenshots, metadata, ratings, and competitive positioning for iOS App Store and Google Play.
---

# /aso

Run this before `/store-ship` and after `/onboarding-audit`. This skill audits your app store presence to ensure maximum discoverability and conversion from search impressions to installs.

## Use when

- Preparing for initial App Store / Play launch.
- Updating store listing for a new version.
- Investigating low download numbers or poor search ranking.
- Researching competitors for keyword opportunities.
- Optimizing screenshots and preview videos for conversion.
- Setting up ASO tracking and monitoring.
- Reviewing a PR that changes store listing assets.

## Inputs

Collect or infer:

- Platform: `flutter`, `swift`, `kotlin`, or `expo`.
- Target OS: iOS, Android, or both.
- App name and current subtitle/tagline.
- Current keyword set (iOS) or short description (Android).
- Primary category and any secondary categories.
- Competitor apps (2-3 direct competitors).
- Current ratings and review count.
- Download/install volume if known.

If platform is missing:
- Read `~/.gstack/config` or project docs.
- If still unclear, ask one concise question before proceeding.

## Review standard

### 1. App name and brand
- Name is memorable, spellable, and searchable.
- Name includes primary keyword if not already obvious from brand.
- No trademark conflicts or policy violations.
- Subtitle (iOS) / tagline (Android) expands on name with secondary keywords.
- Name is unique enough to avoid confusion or ambiguity.

### 2. Keywords (iOS)
- 100 characters fully utilized.
- No redundant or overlapping terms.
- High-volume terms balanced with medium-volume, lower-competition terms.
- No competitor brand names (rejection risk).
- Localization considered for different markets.

### 3. Description
- iOS: First paragraph is the "hook" — most users don't expand.
- Android: First 175 characters visible in search — critical.
- Primary value prop in first 2 sentences.
- Feature list uses bullet points, not walls of text.
- No keyword stuffing (reads naturally).
- Updated regularly with new features.

### 4. Screenshots and preview
- First 2-3 screenshots are your "ad" — show the best feature.
- Different screenshots show different value props.
- Localized screenshots for key markets.
- Text overlay explains what's happening (if not obvious).
- Video preview (if used) is polished and shows real UI.
- No device frames (against guidelines on some stores).

### 5. Ratings and reviews
- Rating is visible in search results — need 4+ to compete.
- Response rate to reviews is high.
- Negative reviews addressed professionally.
- Review volume supports conversion (need 50+ for social proof).
- Recent reviews reflect current version quality.

### 6. Category and competitors
- Category choice maximizes discoverability.
- Competitor analysis reveals keyword gaps.
- Differentiation is clear in listing.

### 7. Localization
- At minimum, English (US) metadata is excellent.
- Top 2-3 markets have localized screenshots.
- Consider localized keywords for non-English markets.

### 8. Store-specific
- iOS: App previews (video) optimized, privacy nutrition labels accurate.
- Android: Feature graphic is compelling, early access/beta not enabled in production.

## Output format

Use this exact structure:

### Verdict
One paragraph with a blunt recommendation:
- `PASS`
- `PASS WITH WARNINGS`
- `FAIL`

### Critical issues
Bullets only. Include only issues that will hurt discoverability or conversion.

### Warnings
Bullets only. Important but non-blocking.

### Platform-specific notes
Split into:
- `iOS`
- `Android`
Only include sections that apply.

### Recommended keywords
Give a sample keyword set for iOS or improved short description for Android.

### Build checklist
Provide a short, execution-ready checklist.

## Style

- Be direct and specific.
- Focus on high-impact changes first (name, first screenshot, keywords).
- Don't suggest 100 changes — prioritize the top 5.
- Consider the user's search intent.
- Don't over-engineer for a new app — build ratings first.

## Mobile-specific checks

- Name searchable without exact match.
- Screenshots work on all supported device sizes.
- Description reads well on mobile (short paragraphs).
- Privacy disclosures don't contradict ASO messaging.

## Examples

Good prompts:
- `/aso optimize this Flutter app's App Store listing for launch`
- `/aso review keywords for an iOS productivity app`
- `/aso audit the Play Store listing for visibility issues`

Bad prompts:
- `/aso improve downloads`
- `/aso optimize the app`