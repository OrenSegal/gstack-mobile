# gstack-mobile

Mobile-native extension for gstack. Adds the full lifecycle missing from the web-first stack:
platform design review, mobile security, simulator QA, analytics verification, onboarding
auditing, store ship, jank removal, push auditing, and mobile retro.

Supports Flutter, Expo, Swift, and Kotlin. Platform-aware: each skill reads `mobile_platform`
from `~/.gstack/config` and branches behavior accordingly.

## Setup

```bash
./setup --platform flutter    # or expo, swift, kotlin, none
```

Config is saved to `~/.gstack/config` via `gstack-config`. Secrets go in `~/.gstack/mobile.env`
(generated from `mobile/.env.example`). Never commit that file.

## Workflow

/office-hours
↓ /plan-ceo-review + /plan-eng-review
↓ /hig-review ← before code, not after
↓ [build]
↓ /review + /mobile-security
↓ /mobile-qa [simulator matrix]
↓ /jank-removal
↓ /analytics-audit
↓ /onboarding-audit ← only if touching activation flows
↓ /push-audit ← only if touching notification flows
↓ /store-ship [testflight|internal]
↓ /canary --platform mobile
↓ /aso ← after each major version
↓ /mobile-retro [weekly]

## AARRR map

| Funnel stage | Skill |
|---|---|
| Acquisition | `/aso`, `/office-hours` |
| Activation | `/onboarding-audit`, `/hig-review` |
| Retention | `/push-audit`, `/mobile-retro`, `/jank-removal` |
| Revenue | `/mobile-security`, `/store-ship` |
| Referral | `/analytics-audit`, `/mobile-retro` |

## Platform support

| Platform | HIG/Material | Build tool | Ship target |
|---|---|---|---|
| `flutter` | Both (platform-adaptive) | `flutter build ipa` / `appbundle` | TestFlight + Play Internal |
| `expo` | Both (Expo Router) | `eas build` | EAS Submit |
| `swift` | HIG (iOS/macOS) | `xcodebuild` | TestFlight |
| `kotlin` | Material 3 (Android) | Gradle | Play Internal |

## Secrets

Copy `mobile/.env.example` to `~/.gstack/mobile.env` and fill in values.
Skills source this file at runtime. It is never committed.