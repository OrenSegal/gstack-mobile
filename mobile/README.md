# gstack-mobile

Mobile-native extension pack for gstack. Adds specialized skills for building, reviewing, shipping, and maintaining mobile apps alongside gstack's existing web-focused workflow.

## Supported platforms

- Flutter
- Expo (React Native)
- Swift (iOS)
- Kotlin (Android)

## Configuration

**Saved config:** `mobile_platform`

Set via `./setup --platform flutter|expo|swift|kotlin|none`

**Secrets file:** `~/.gstack/mobile.env`

Copy from `mobile/.env.example` and fill in your credentials.

## Mobile workflow

```
/office-hours
  → Problem definition, lean MVP scoping

/plan-ceo-review + /plan-eng-review
  → Strategy and architecture lock

/hig-review
  → Platform-native UI review before code

/review + /mobile-security
  → Code review + security audit

/mobile-qa
  → Simulator/device testing, accessibility audit

/analytics-audit
  → Event schema, tracking implementation

/onboarding-audit
  → First-run experience, activation funnel

/store-ship
  → App Store / Play submission, build management

/mobile-canary
  → Post-deploy crash monitoring, ANR rate, store rating delta

/app-store-optimization
  → App store optimization, keyword research

/mobile-retro
  → Ship retrospective, velocity metrics
```

## Directory structure

```
mobile/
  README.md           ← This file
  .env.example         ← Secrets template

hig-review/            ← Pre-build UI review (refs mobile-ios-design, flutter-adaptive-ui, building-native-ui)
mobile-security/      ← Security audit (extends /cso with OWASP Mobile Top 10)
mobile-qa/            ← Device testing, accessibility audit (replaces web /qa)
analytics-audit/      ← Event schema, funnel coverage
onboarding-audit/     ← Activation audit (refs user-onboarding for redesign)
store-ship/           ← Store submission (delegates to asc-release-flow, expo-deployment)
jank-removal/         ← Frame drop diagnosis (refs flutter-animations for fixes)
push-audit/           ← APNs/FCM delivery + permission UX
mobile-retro/         ← Ship retro (extends /retro with crash rate, store reviews)
mobile-canary/        ← Post-deploy crash monitoring (replaces web /canary for mobile)
```

## Quick start

```bash
# Configure your mobile platform
./setup --platform flutter

# Copy and fill secrets
cp mobile/.env.example ~/.gstack/mobile.env

# Run a mobile-focused skill
/hig-review
```