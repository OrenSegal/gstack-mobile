---
name: analytics-audit
description: Analytics implementation review for mobile apps — event schemas, tracking completeness, platform SDK integration, privacy compliance, and data quality.
---

# /analytics-audit

Run this after `/mobile-qa` and before `/onboarding-audit`. This skill reviews analytics implementation to ensure events are well-structured, complete, privacy-compliant, and actionable for product decisions.

## Use when

- Adding new feature tracking.
- Implementing a new analytics SDK (Firebase, Amplitude, Mixpanel, etc.).
- Reviewing a PR for tracking gaps or quality issues.
- Preparing for a data audit or GDPR/CCPA compliance review.
- Setting up user identity and attribution.
- Debugging missing or duplicate events in production.

## Inputs

Collect or infer:

- Platform: `flutter`, `swift`, `kotlin`, or `expo`.
- Target OS: iOS, Android, or both.
- What changed: diff, PR, or feature description.
- Analytics SDKs: which tools are used (Firebase, Amplitude, Mixpanel, custom, etc.).
- User identity: how users are identified (anonymous ID, logged-in user ID, both).
- Event volume expectations: daily active users, events per session.
- Privacy regime: GDPR, CCPA, or no specific regulation.

If platform is missing:
- Read `~/.gstack/config` or project docs.
- If still unclear, ask one concise question before proceeding.

## Review standard

### 1. Event schema quality
- Event names are consistent, descriptive, and use snake_case or camelCase consistently.
- Properties are typed (string, number, boolean) and don't change type over time.
- No PII in event names or properties (email, name, phone in plain text).
- Required properties present (timestamp, session ID, platform, version).
- Property values are not null or "undefined" for important fields.

### 2. Tracking completeness
- Key user actions tracked (screen views, button taps, form submissions, errors).
- No redundant events (same action fired multiple times).
- Revenue events include currency and value in correct units.
- User identity set at the right time (after auth, not before).
- Out-of-band events (push opens, deep links) tracked.

### 3. Platform SDK integration
- Firebase: correct usage of logEvent, setUserId, setUserProperties.
- Amplitude: correct identification, group identification if applicable.
- Mixpanel: proper people and track calls, distinct ID management.
- No blocking on analytics calls (async, non-blocking).
- Offline events queued and sent when connectivity returns.

### 4. Privacy and compliance
- Consent collected before tracking (for GDPR/CCPA regimes).
- PII hashed or removed from events (email hashed, names not sent).
- User ID stable across sessions but regenerated on consent withdrawal.
- Privacy manifest declares data collection (iOS).
- Data retention policy documented and enforced.
- No sensitive categories in events (health, finance, kids) without explicit justification.

### 5. Attribution and identity
- Anonymous ID persists across sessions until login.
- User ID set consistently after authentication.
- Campaign attribution parameters captured (utm_source, utm_medium, etc.).
- Deep link tracking handled for both iOS and Android.
- No double-counting from both SDK and manual tracking.

### 6. Data quality
- No test events in production (verify event names don't include "test", "debug").
- No events fired in loops or on every render.
- Event volume is reasonable (not 1000+ events per session).
- Debug/verbose logging disabled in release builds.

## Output format

Use this exact structure:

### Verdict
One paragraph with a blunt recommendation:
- `PASS`
- `PASS WITH WARNINGS`
- `FAIL`

### Critical issues
Bullets only. Include only issues that should block merge or cause data quality problems.

### Warnings
Bullets only. Important but non-blocking.

### Platform-specific notes
Split into:
- `iOS`
- `Android`
- `Flutter / shared`
Only include sections that apply.

### Recommended tracking spec
Give a concise event schema for the change, if applicable.

### Build checklist
Provide a short, execution-ready checklist.

## Style

- Be direct and specific.
- Focus on actionable issues, not theoretical concerns.
- Recommend specific property names and types when possible.
- Flag issues that will cause problems in the analytics dashboard (nulls, type mismatches).
- Consider the downstream analyst who will use this data.

## Mobile-specific checks

Always check for:

- IDFA/GAID handling and consent.
- Deep link attribution across iOS Universal Links and Android App Links.
- Background/Foreground session handling.
- Push notification tracking.
- App update vs fresh install distinction.

## Examples

Good prompts:
- `/analytics-audit review this checkout flow tracking implementation`
- `/analytics-audit check if this feature has proper event schema`
- `/analytics-audit audit analytics for GDPR compliance`

Bad prompts:
- `/analytics-audit improve tracking`
- `/analytics-audit check analytics`