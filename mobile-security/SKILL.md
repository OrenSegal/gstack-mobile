---
name: mobile-security
preamble-tier: 4
version: 1.0.0
description: |
  Security audit for mobile apps. Reviews code, config, and architecture for secrets,
  data handling, certificate pinning, secure storage, and app-store compliance. Run
  before /store-ship on any change touching auth, payments, or sensitive data. (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---
<!-- gstack-mobile: mobile-security/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-security","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

---

# /mobile-security

Run this after `/hig-review` and before `/mobile-qa` for any mobile change that touches
authentication, payments, data storage, or network calls. This skill audits the implementation
for security gaps and flags issues that could fail App Store / Play review or expose user data.

---

## Step 0: Detect platform and gather context

```bash
# Detect mobile platform
_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
echo "Mobile platform: $_PLATFORM"

# Detect target platforms
_IS_IOS=0
_IS_ANDROID=0
[ -d "ios" ] && _IS_IOS=1
[ -d "android" ] && _IS_ANDROID=1
echo "iOS: $_IS_IOS, Android: $_IS_ANDROID"

# Detect framework
if [ -f "pubspec.yaml" ]; then
  grep -q "flutter:" pubspec.yaml && _FRAMEWORK="Flutter" || _FRAMEWORK="Expo"
elif [ -f "package.json" ]; then
  _FRAMEWORK="React Native"
elif [ -d "ios" ] && [ -f "ios/Runner.xcodeproj/project.pbxproj" ]; then
  _FRAMEWORK="Swift"
else
  _FRAMEWORK="unknown"
fi
echo "Framework: $_FRAMEWORK"
```

---

## Step 1: Secrets and credentials audit

```bash
# Check for hardcoded API keys, tokens, credentials
grep -rn "api[_-]key\|api[_-]secret\|password\|secret\|token\|credential\|bearer\|authorization" \
  lib/ --include="*.dart" --include="*.swift" --include="*.kt" 2>/dev/null \
  | grep -v "// " | grep -v "null\|undefined\|placeholder\|YOUR_" | head -30

# Check .env files are gitignored
cat .gitignore 2>/dev/null | grep -E "\.env|credentials|secrets" || echo "WARN: No .env in gitignore"

# Check for secrets in config files
find . -name "*.json" -o -name "*.yaml" 2>/dev/null | xargs grep -l "apiKey\|secret\|token" 2>/dev/null | head -10
```

---

## Step 2: Secure storage audit

### iOS Keychain

```bash
# Check for Keychain usage
grep -rn "Keychain\|SecItemAdd\|kSecClass" ios/ --include="*.swift" 2>/dev/null | head -10

# Check for UserDefaults storing sensitive data
grep -rn "UserDefaults\.standard\|NSUserDefaults" ios/ --include="*.swift" 2>/dev/null | head -10
```

**Required:** Use Keychain with `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`.

### Android secure storage

```bash
# Check for EncryptedSharedPreferences
grep -rn "EncryptedSharedPreferences\|Jetpack\|security" android/ --include="*.kt" 2>/dev/null | head -10

# Check for plain SharedPreferences
grep -rn "SharedPreferences\|getSharedPreferences" android/ --include="*.kt" 2>/dev/null | head -10
```

**Required:** Use EncryptedSharedPreferences or Keystore-backed encryption.

### Flutter secure storage

```bash
# Check for flutter_secure_storage
grep -rn "flutter_secure_storage\|flutter_secure_storage" pubspec.yaml lib/ 2>/dev/null | head -10

# Check for plain storage of tokens
grep -rn "SharedPreferences\|setString\|getString" lib/ --include="*.dart" 2>/dev/null | head -15
```

---

## Step 3: Network security audit

```bash
# Check for certificate pinning
grep -rn "certificatePinning\|sslPinning\|allowBadCertificates\|validateServerTrust" \
  lib/ --include="*.dart" --include="*.swift" --include="*.kt" 2>/dev/null | head -10

# Check for cleartext HTTP
grep -rn "http://\|HttpURLConnection\|NSAllowsArbitraryLoads" \
  lib/ ios/ android/ --include="*.dart" --include="*.swift" --include="*.kt" --include="*.plist" 2>/dev/null | head -10

# Check ATS (iOS)
grep -rn "NSAllowsArbitraryLoads\|NSExceptionAllowsInsecureHTTPLoads" ios/ --include="*.plist" 2>/dev/null | head -10

# Check network_security_config (Android)
find android/ -name "network_security_config.xml" 2>/dev/null | head -5
```

---

## Step 4: Authentication and sessions

```bash
# Check OAuth implementation
grep -rn "OAuth\|PKCE\|auth\|login\|signIn" lib/ --include="*.dart" 2>/dev/null | head -20

# Check for token storage
grep -rn "accessToken\|refreshToken\|session\|token" lib/ --include="*.dart" 2>/dev/null | head -20

# Check logout implementation
grep -rn "logout\|signOut\|clear\|revoke" lib/ --include="*.dart" 2>/dev/null | head -15
```

---

## Step 5: Binary and runtime security

```bash
# Check for debugging flags in release
grep -rn "debug\|Log\." lib/ --include="*.dart" 2>/dev/null | head -15

# Check for verbose error messages
grep -rn "print\|debugPrint\|console.log" lib/ --include="*.dart" 2>/dev/null | head -20

# Check ProGuard/R8 configuration (Android)
cat android/app/build.gradle 2>/dev/null | grep -A10 "proguard"
```

---

## Step 6: App store compliance

```bash
# Check privacy manifest (iOS)
find . -name "PrivacyInfo.xcprivacy" 2>/dev/null | head -5

# Check for private API usage
grep -rn "_UIApplication\|UIWebView\|LSApplicationWorkspace" lib/ ios/ 2>/dev/null | head -10

# Check permissions declared
grep -rn "NS.*UsageDescription\|uses-permission" ios/ android/ --include="*.plist" --include="AndroidManifest.xml" 2>/dev/null | head -20
```

---

## Step 7: Output

MOBILE SECURITY AUDIT
═══════════════════════════════════════════════════════════

Date: {date}
Platform: {iOS / Android / Both}
Framework: {Flutter / Expo / Swift / Kotlin}

SECRETS & CREDENTIALS
- Hardcoded secrets found: {N} — CRITICAL if any
- .env gitignored: YES / NO
- Credentials in logs: YES / NO

SECURE STORAGE
- Keychain/Keystore used: YES / NO
- Tokens in plain storage: YES / NO
- Encryption at rest: YES / NO

NETWORK SECURITY
- TLS 1.2+ enforced: YES / NO
- Certificate pinning: YES / NO
- Cleartext HTTP found: YES / NO
- ATS enabled (iOS): YES / NO

AUTHENTICATION
- OAuth with PKCE: YES / NO
- Secure token storage: YES / NO
- Proper logout: YES / NO

BINARY & RUNTIME
- Debug flags in release: YES / NO
- Verbose errors exposed: YES / NO

APP STORE COMPLIANCE
- Privacy manifest: YES / NO
- No private APIs: YES / NO

VERDICT: PASS / PASS_WITH_WARNINGS / FAIL
═══════════════════════════════════════════════════════════

If FAIL, fix each CRITICAL item before proceeding to /store-ship.

---

## Step 8: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-security","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"mobile-security","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `pass`, `pass_with_warnings`, or `fail`.