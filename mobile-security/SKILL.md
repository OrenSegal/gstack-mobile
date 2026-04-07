---
name: mobile-security
preamble-tier: 4
version: 1.0.0
description: |
  Mobile-specific security review. Checks keychain/keystore usage, certificate pinning,
  deep link validation, secret leakage, network security config, biometric gate integrity,
  obfuscation, screenshot prevention, and API key hygiene. Replaces /cso for mobile apps.
  Run after /review on any branch touching auth, payments, permissions, or data storage.
  (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Grep
  - Glob
  - Write
  - AskUserQuestion
  - WebSearch
---
<!-- gstack-mobile: mobile-security/SKILL.md -->

## Preamble (run first)

```bash
_UPD=$(~/.claude/skills/gstack/bin/gstack-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
mkdir -p ~/.gstack/analytics
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-security","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /mobile-security

The mobile threat model is not the web threat model. There's no SQLi, but there is plaintext
token storage, interceptable deep links, unobfuscated APKs, and screenshot leakage on payment
screens. This review covers all of it.

---

## Step 0: Detect platform and scope

```bash
_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
echo "PLATFORM: $_PLATFORM"
[ -f pubspec.yaml ] && echo "LOCKFILE: pubspec.lock" && cat pubspec.lock 2>/dev/null | grep -E "flutter_secure_storage|dio|http" | head -20
[ -f package.json ] && cat package.json 2>/dev/null | grep -E "expo-secure-store|axios|fetch" | head -10
find . -maxdepth 4 -name "*.plist" -not -path "*/node_modules/*" 2>/dev/null | head -5
find . -maxdepth 4 -name "AndroidManifest.xml" 2>/dev/null | head -3
find . -maxdepth 4 -name "network_security_config.xml" 2>/dev/null | head -3
```

---

## Step 1: Secret storage

**What to look for:**

For Flutter: search for `SharedPreferences` storing tokens, passwords, or session IDs.
These are unencrypted. Must use `flutter_secure_storage`.

```bash
grep -r "SharedPreferences\|prefs\.set" lib/ --include="*.dart" -l 2>/dev/null
grep -r "flutter_secure_storage\|SecureStorage" lib/ --include="*.dart" -l 2>/dev/null
```

For Swift: search for `UserDefaults` storing auth tokens or user credentials.
Must use `Keychain` (via `KeychainAccess` or `Security` framework directly).

```bash
grep -r "UserDefaults.*token\|UserDefaults.*password\|UserDefaults.*secret\|UserDefaults.*key" --include="*.swift" -ri . 2>/dev/null
grep -r "Keychain\|SecItemAdd\|KeychainAccess" --include="*.swift" -r . 2>/dev/null | head -10
```

For Kotlin/Android: search for `SharedPreferences` storing sensitive values.
Must use `EncryptedSharedPreferences` (Jetpack Security) or Android Keystore.

```bash
grep -r "getSharedPreferences\|putString.*token\|putString.*password" --include="*.kt" -r . 2>/dev/null
grep -r "EncryptedSharedPreferences\|KeyStore\|MasterKey" --include="*.kt" -r . 2>/dev/null | head -10
```

For Expo: search for `AsyncStorage` storing sensitive values.
Must use `expo-secure-store`.

```bash
grep -r "AsyncStorage.*token\|AsyncStorage.*password\|AsyncStorage.*secret" --include="*.ts" --include="*.tsx" -r . 2>/dev/null
grep -r "expo-secure-store\|SecureStore" --include="*.ts" --include="*.tsx" -r . 2>/dev/null | head -10
```

Flag any token, password, session ID, or secret stored outside the secure enclave equivalent.
This is CRITICAL.

---

## Step 2: Network security

**iOS — ATS (App Transport Security):**

```bash
find . -name "Info.plist" -not -path "*/node_modules/*" 2>/dev/null | xargs grep -l "NSAllowsArbitraryLoads" 2>/dev/null
find . -name "Info.plist" -not -path "*/node_modules/*" 2>/dev/null | xargs grep -A2 "NSAllowsArbitraryLoads" 2>/dev/null
```

`NSAllowsArbitraryLoads: true` in a production build is a CRITICAL finding and will trigger
App Review scrutiny. It must be `false` or not present. Exceptions for specific domains
(`NSExceptionDomains`) are acceptable if the domains are necessary and documented.

**Android — Network Security Config:**

```bash
find . -name "AndroidManifest.xml" 2>/dev/null | xargs grep "usesCleartextTraffic\|networkSecurityConfig" 2>/dev/null
find . -name "network_security_config.xml" 2>/dev/null | xargs cat 2>/dev/null
```

`android:usesCleartextTraffic="true"` in the production manifest is CRITICAL.
`cleartextTrafficPermitted="true"` in network security config for non-debug domains is CRITICAL.

**Certificate pinning:**

```bash
grep -r "TrustManager\|SSLPinning\|CertificatePinner\|TrustKit\|PublicKeyPins" \
  --include="*.dart" --include="*.swift" --include="*.kt" --include="*.ts" \
  -r . 2>/dev/null | head -20
```

Flag if no certificate pinning is present on production HTTP clients in apps handling
payments, medical data, or PII. Note whether a pin rotation strategy exists.

---

## Step 3: Deep link and URL scheme security

```bash
find . -name "Info.plist" 2>/dev/null | xargs grep -A5 "CFBundleURLSchemes\|LSApplicationQueriesSchemes" 2>/dev/null
find . -name "AndroidManifest.xml" 2>/dev/null | xargs grep -B2 -A10 "intent-filter" 2>/dev/null | grep -E "scheme|host|VIEW" | head -20
grep -r "openURL\|handleDeepLink\|onDeepLink\|Uri.parse" \
  --include="*.dart" --include="*.swift" --include="*.kt" --include="*.ts" \
  -r . 2>/dev/null | head -20
```

Check:
- Custom URL schemes (`myapp://`) can be intercepted by any app on the device.
  Auth callbacks must use Universal Links (iOS) or App Links (Android), not custom schemes.
- Universal Links: `apple-app-site-association` file must be hosted at `/.well-known/apple-app-site-association`.
- App Links: `assetlinks.json` must be hosted at `/.well-known/assetlinks.json`.
- Deep link handler must validate the incoming URL before trusting any parameters.
  Flag if URL params are used directly in auth or navigation without validation.

---

## Step 4: API key and secret hygiene

```bash
# Check assets and config files for hardcoded secrets
grep -r "api_key\|apiKey\|secret\|password\|token\|private_key" \
  --include="*.json" --include="*.yaml" --include="*.yml" --include="*.env" \
  --include="*.plist" --include="*.xml" \
  -r . --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null \
  | grep -v ".env.example\|placeholder\|YOUR_KEY\|REPLACE_ME\|TODO" | head -30

# Flutter: check pubspec.yaml and assets/
grep -r "key\|secret\|token" assets/ --include="*.json" --include="*.yaml" 2>/dev/null | head -10

# Expo: check app.config.js / app.json for exposed secrets
grep -E "apiKey|secret|token|password" app.config.js app.json 2>/dev/null | head -10

# Check if .env files are gitignored
cat .gitignore 2>/dev/null | grep -E "\.env$|\.env\." | head -5
```

Any real secret value in a committed file is CRITICAL. API keys embedded in `app.config.js`
or `app.json` are exposed in the built JS bundle — also CRITICAL.

---

## Step 5: Build configuration (release-mode security)

**Flutter:**
```bash
grep -r "kDebugMode\|kProfileMode\|kReleaseMode" lib/ --include="*.dart" 2>/dev/null | grep -v "kReleaseMode.*assert\|kDebugMode.*false" | head -10
# Check for obfuscation flags in build scripts / CI
grep -r "obfuscate\|split-debug-info" . --include="*.sh" --include="*.yaml" --include="*.yml" -r 2>/dev/null | head -10
```

Release builds must use `--obfuscate --split-debug-info=./debug-info`. Flag if missing from
CI build scripts.

**Android:**
```bash
grep -r "minifyEnabled\|proguardFiles\|shrinkResources" --include="*.gradle" --include="*.gradle.kts" -r . 2>/dev/null
```

`minifyEnabled false` in the release build type is a WARN. ProGuard/R8 rules must be present.

**iOS:**
```bash
find . -name "*.xcconfig" 2>/dev/null | xargs grep -l "DEBUG\|RELEASE" 2>/dev/null
grep -r "DEBUG\b" --include="*.swift" -r . 2>/dev/null | grep -v "//\|#if DEBUG" | head -10
```

Production builds must not have debug logging, analytics verbose mode, or network proxying
enabled.

---

## Step 6: Biometric and auth gate integrity

```bash
grep -r "LocalAuthentication\|BiometricPrompt\|TouchID\|FaceID\|LAContext\|BiometricManager" \
  --include="*.dart" --include="*.swift" --include="*.kt" --include="*.ts" \
  -r . 2>/dev/null | head -20
```

Check:
- Is the biometric gate used to protect sensitive operations (payments, viewing secrets),
  or is it only used as a login convenience?
- Does failure fallback to passcode (acceptable) or to no auth (CRITICAL)?
- On Android: is `BiometricPrompt.AuthenticationCallback.onAuthenticationFailed` handled,
  or does failure silently succeed?

---

## Step 7: Screenshot prevention (sensitive screens)

```bash
grep -r "FLAG_SECURE\|WindowManager.LayoutParams.FLAG_SECURE" --include="*.kt" --include="*.java" -r . 2>/dev/null
grep -r "allowsScreenshots\|UIScreen.main.isCaptured\|\.secured\b" --include="*.swift" -r . 2>/dev/null
grep -r "PreventScreenCapture\|preventScreenCapture" --include="*.dart" --include="*.ts" -r . 2>/dev/null
```

Payment screens, credentials screens, and screens showing sensitive personal data must
prevent screenshots. Flag if `FLAG_SECURE` (Android) is absent on such screens.

---

## Step 8: Output format

Use this structure:

---

### Security verdict

`PASS` / `PASS WITH WARNINGS` / `FAIL`

One paragraph. Direct. What the biggest risk is and what it enables for an attacker.

---

### Critical findings

`[CRITICAL]` — MUST fix before shipping to production.

Format: `[CRITICAL] (check category) file:line — problem — fix`

---

### Warnings

`[WARN]` — fix before next major version or before handling sensitive user data.

---

### What's covered

Quick table for traceability:

| Check | Status | Notes |
|---|---|---|
| Secret storage (Keychain/Keystore) | PASS/FAIL/SKIP | |
| ATS / Network Security Config | PASS/FAIL/SKIP | |
| Certificate pinning | PASS/FAIL/SKIP | |
| Deep link validation | PASS/FAIL/SKIP | |
| API key hygiene | PASS/FAIL/SKIP | |
| Release obfuscation | PASS/FAIL/SKIP | |
| Biometric gate integrity | PASS/FAIL/SKIP | |
| Screenshot prevention | PASS/FAIL/SKIP | |

SKIP = not applicable to this platform or not relevant to the current diff.

---

## Step 9: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-security","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"mobile-security","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `success`, `fail`, or `abort`.