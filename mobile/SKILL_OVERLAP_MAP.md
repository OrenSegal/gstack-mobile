# Mobile Skill Overlap Map

This file documents the relationship between each gstack-mobile skill and existing
gstack/installed skills. Every planned skill was audited for duplication before building.
Update this when adding new mobile skills.

## Pattern: delegate, don't duplicate

Mobile skills should invoke gstack skills for the generic layer, then add the mobile-specific
layer on top. Skills in this repo own only what gstack core cannot do.

---

## Skill-by-skill map

### /hig-review
**gstack equivalent:** none  
**Installed skills referenced in output:**
- `mobile-ios-design` — Swift/SwiftUI implementation patterns
- `building-native-ui` — Expo Router component patterns
- `flutter-adaptive-ui` — Flutter responsive/adaptive layout
- `flutter-animations` — Flutter motion and transitions

**Relationship:** `/hig-review` is the audit ("what to build"). The installed skills are the
implementation guides ("how to build"). Reference them in the `Recommended implementation`
section of the review output.

---

### /mobile-security
**gstack equivalent:** `/cso` (OWASP Top 10 web, secrets archaeology, dependency supply chain)  
**What /cso covers:** secrets scan, .env gitignore check, dependency supply chain, CI/CD pipeline
security, OWASP Top 10 (web surface). Full Phase 1 ("Secrets Archaeology") duplicates what
we'd otherwise do in Step 1.

**Delegation rule:** Step 1 invokes `/cso --daily`. Skips to Step 2 after cso completes.
Steps 2-7 are mobile-specific (Keychain/Keystore, ATS, certificate pinning, OWASP Mobile
Top 10, binary hardening) and have no equivalent in /cso.

**What NOT to duplicate:** secrets grep, .gitignore check, dep audit.

---

### /perf-audit
**gstack equivalent:** none (benchmark is web performance, not mobile runtime profiling)  
**Installed skills checked:** `flutter-expert` (implementation, not diagnostic)  
**Relationship:** original, no delegation needed.

---

### /store-compliance
**gstack equivalent:** none  
**Installed skills checked:** `asc-submission-health` (dynamic validation via ASC API)  
**Relationship:** complementary, not duplicate. `/store-compliance` = static analysis before
build. `asc-submission-health` = dynamic validation before submit. `/store-ship` calls both
in sequence.

---

### /tech-debt
**gstack equivalent:** none  
**Relationship:** original. Covers deprecated APIs, dead code, analyzer warnings for
mobile frameworks specifically. gstack's generic review skill doesn't know Flutter's
deprecated widget tree or Kotlin's evolving coroutine APIs.

---

### /jank-removal (planned)
**gstack equivalent:** none  
**Installed skills to reference:**
- `flutter-animations` — for animation jank fixes (explicit controller offscreen, shader
  compilation, heavy build methods in animation callbacks)

**Delegation rule:** after diagnosing animation-specific jank, reference `flutter-animations`
for the fix patterns.

---

### /push-audit (planned)
**gstack equivalent:** none  
**Relationship:** original.

---

### /analytics-audit (planned)
**gstack equivalent:** none  
**Installed skills checked:** `app-store-optimization` (store listing/keywords — different domain)  
**Relationship:** original. In-app event tracking ≠ ASO.

---

### /onboarding-audit (planned)
**gstack equivalent:** none  
**Installed skills checked:** `user-onboarding` (DESIGN skill — produces activation plan)  
**Relationship:** complementary. `/onboarding-audit` = "what's broken in current onboarding"
(audit). `user-onboarding` = "design a better onboarding" (design). Reference `user-onboarding`
at the end of audit output for the redesign phase.

---

### /store-ship (planned)
**gstack equivalent:** `/ship` (git workflow only — no mobile awareness)  
**Installed skills to delegate to by platform:**
- `asc-release-flow` — TestFlight + App Store submission via `asc` CLI
- `asc-submission-health` — preflight checks before submitting
- `asc-testflight-orchestration` — TestFlight group management
- `asc-signing-setup` — cert setup (onboarding only, not per-release)
- `expo-deployment` — EAS Build + EAS Submit (Expo/React Native)

**Delegation rule:**
1. Run `/store-compliance` (static pre-flight)
2. Detect platform → invoke the appropriate installed skill for build + upload
3. Post-flight: git tag, CHANGELOG note, telemetry

**What NOT to duplicate:** the actual `asc` CLI commands and EAS Build workflow.
These are in the installed skills and maintained there.

---

### /mobile-retro (planned)
**gstack equivalent:** `/retro` (commit analysis, work patterns, team breakdown)  
**Delegation rule:** Step 0 invokes `/retro` for the full engineering retro.
Steps 1+ add mobile-specific sections:
- Crash-free rate delta (Firebase/Sentry, reads from mobile.env)
- ANR rate (Android, Play Console or fastlane)
- Binary size delta (compare release builds)
- Store review sentiment delta
- App release count vs target

**What NOT to duplicate:** commit analysis, PR metrics, hotspot analysis, team breakdown —
all of that is `/retro`'s job.

---

### /mobile-qa (planned)
**gstack equivalent:** `/qa` (headless browser — does NOT apply to mobile)  
**Relationship:** replacement, not extension. No delegation to `/qa`. Explicitly
note in the skill that `/qa` is web-only and this skill is the mobile equivalent.

**Installed skills checked:** none overlap.

---

### /mobile-canary
**gstack equivalent:** `/canary` (headless browser — does NOT apply to mobile)  
**Relationship:** replacement, not extension. No delegation to `/canary`. Uses
Sentry/Firebase APIs and Play Console, not $B commands.

**Delegation note in routing table:** routing table now says `/mobile-canary`.
The `/canary` entry has been removed from the mobile routing table.

---

## Name conflict register

All names checked against installed skills at `~/.claude/skills/` on 2026-04-07.

| Mobile skill name | Conflict? | Notes |
|---|---|---|
| `hig-review` | none | |
| `mobile-security` | none | `cso` exists but different scope |
| `perf-audit` | none | `benchmark` is web perf, different |
| `store-compliance` | none | `asc-submission-health` is complementary |
| `tech-debt` | none | |
| `jank-removal` | none | |
| `push-audit` | none | |
| `analytics-audit` | none | `app-store-optimization` is different domain |
| `onboarding-audit` | none | `user-onboarding` is design not audit |
| `store-ship` | none | `ship` is git-only, different |
| `mobile-retro` | none | `retro` exists, mobile-retro extends it |
| `mobile-qa` | none | `qa` is web-only, explicitly different |
| `mobile-canary` | none | `canary` is web-only, explicitly different |

**Routing table fix (applied):**
- `/aso` → `/app-store-optimization` (the installed skill's actual `name:` field)
- `/canary` → `/mobile-canary` (web skill, not applicable to mobile)
