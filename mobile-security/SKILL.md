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
  _FRAMEWORK="Flutter"
elif [ -f "package.json" ] && grep -q '"expo"' package.json 2>/dev/null; then
  _FRAMEWORK="Expo"
elif [ -f "package.json" ]; then
  _FRAMEWORK="React Native"
elif find . -maxdepth 1 -name "*.xcodeproj" -type d 2>/dev/null | grep -q .; then
  _FRAMEWORK="Swift"
elif [ -f "app/build.gradle" ] || [ -f "app/build.gradle.kts" ]; then
  _FRAMEWORK="Kotlin"
else
  _FRAMEWORK="unknown"
fi
echo "Framework: $_FRAMEWORK"
```

---

## Step 1: Base security audit — delegate to /cso

Run `/cso --daily` first. It covers secrets archaeology, dependency supply chain, CI/CD
pipeline security, and OWASP Top 10 (web surface). Do not duplicate those checks here.

```bash
# Verify /cso is available before delegating
if [ -f ~/.claude/skills/gstack/cso/SKILL.md ]; then
  echo "/cso available — delegating secrets archaeology to /cso --daily"
else
  echo "WARN: /cso not found at ~/.claude/skills/gstack/cso/SKILL.md — running fallback scan below"
fi
```

Read the `/cso` skill file at `~/.claude/skills/gstack/cso/SKILL.md` and follow its
`--daily` mode (high-confidence findings only). When `/cso` completes, continue below
with the mobile-specific layers that `/cso` does not cover.

If `/cso` is not available (not installed or preamble fails), run the fallback:

```bash
# Fallback secrets scan (only if /cso unavailable)
grep -rn "api[_-]key\|api[_-]secret\|password\|secret\|token\|credential\|bearer" \
  lib/ ios/ android/ src/ \
  --include="*.dart" --include="*.swift" --include="*.kt" --include="*.ts" --include="*.tsx" \
  --exclude-dir=".dart_tool" --exclude-dir="build" --exclude-dir="node_modules" \
  --exclude-dir=".gradle" --exclude="*.lock" --exclude="*.g.dart" \
  2>/dev/null \
  | grep -v "^\s*//" \
  | grep -v "null\|undefined\|placeholder\|YOUR_\|example\|test\|spec\|mock" \
  | head -30

cat .gitignore 2>/dev/null | grep -E "\.env|credentials|secrets" || echo "WARN: No .env in gitignore"
```

---

## Step 2: Secure storage audit

### iOS Keychain

```bash
if [ "$_IS_IOS" = "1" ]; then
  # Keychain usage — required for all sensitive values
  grep -rn "SecItemAdd\|SecItemCopyMatching\|kSecClass\|kSecAttrAccessible" \
    ios/ --include="*.swift" 2>/dev/null | head -10

  # UserDefaults storing sensitive data (never store tokens/keys here)
  grep -rn "UserDefaults\.standard\.\(set\|string\|object\)" \
    ios/ --include="*.swift" 2>/dev/null | head -10

  # CryptoKit usage (preferred for on-device crypto)
  grep -rn "CryptoKit\|SymmetricKey\|AES\.GCM\|ChaChaPoly" \
    ios/ --include="*.swift" 2>/dev/null | head -10

  # LocalAuthentication (biometric) — FaceID/TouchID permission required
  grep -rn "LocalAuthentication\|LAContext\|evaluatePolicy" \
    ios/ --include="*.swift" 2>/dev/null | head -10
  grep -rn "NSFaceIDUsageDescription" ios/ --include="*.plist" 2>/dev/null | head -3 \
    || echo "WARN: NSFaceIDUsageDescription missing — required if using biometrics"

  # App Transport Security — any exceptions are audit flags
  grep -rn "NSExceptionAllowsInsecureHTTPLoads\|NSAllowsArbitraryLoads" \
    ios/ --include="*.plist" 2>/dev/null | head -5
fi
```

**iOS secure storage requirements:**
- Keychain: `kSecAttrAccessibleWhenUnlockedThisDeviceOnly` for auth tokens
- Never: `UserDefaults` for secrets, `NSCoder` for sensitive model properties
- CryptoKit for symmetric encryption over CommonCrypto (memory-safe, Swift-native)
- App Attest (iOS 14+) for server-side integrity validation against jailbroken devices

### Android secure storage

```bash
if [ "$_IS_ANDROID" = "1" ]; then
  # Android Keystore (hardware-backed key storage — strongest option)
  grep -rn "KeyStore\|KeyPairGenerator\|KeyGenerator\|AndroidKeyStore" \
    android/ --include="*.kt" 2>/dev/null | head -10

  # EncryptedSharedPreferences (MasterKey backed by Android Keystore)
  grep -rn "EncryptedSharedPreferences\|MasterKey\|MasterKeys" \
    android/ --include="*.kt" 2>/dev/null | head -10

  # Plain SharedPreferences storing secrets (never acceptable for tokens)
  grep -rn "getSharedPreferences\|PreferenceManager" \
    android/ --include="*.kt" 2>/dev/null | head -10

  # DataStore (Preferences/Proto) — safer than SharedPreferences for structured data
  grep -rn "DataStore\|dataStore\|preferencesDataStore" \
    android/ --include="*.kt" 2>/dev/null | head -10

  # BiometricPrompt (unified fingerprint/FaceID API, replaces FingerprintManager)
  grep -rn "BiometricPrompt\|BiometricManager\|FingerprintManager" \
    android/ --include="*.kt" 2>/dev/null | head -10

  # ProGuard/R8 — is obfuscation enabled for release builds?
  grep -rn "minifyEnabled\|proguardFiles\|shrinkResources" \
    android/app/build.gradle android/app/build.gradle.kts 2>/dev/null | head -10
fi
```

**Android secure storage requirements:**
- Android Keystore for private keys — hardware-backed on modern devices
- `EncryptedSharedPreferences` (Jetpack Security) for sensitive preferences
- `DataStore<Preferences>` (not `SharedPreferences`) for non-secret structured data
- `minifyEnabled true` + ProGuard/R8 in release builds — obfuscates against reverse engineering
- `FLAG_SECURE` on sensitive Activities to prevent screenshots/screen recording

### Flutter secure storage

```bash
if [ "$_FRAMEWORK" = "Flutter" ]; then
  # Check for flutter_secure_storage
  grep -rn "flutter_secure_storage" pubspec.yaml lib/ 2>/dev/null | head -10

  # Check for plain storage of tokens
  grep -rn "SharedPreferences\|setString\|getString" lib/ --include="*.dart" 2>/dev/null | head -15
fi
```

### Expo / React Native secure storage

```bash
if [ "$_FRAMEWORK" = "Expo" ] || [ "$_FRAMEWORK" = "React Native" ]; then
  # expo-secure-store (correct — uses iOS Keychain / Android Keystore)
  grep -rn "expo-secure-store\|SecureStore\." \
    src/ --include="*.ts" --include="*.tsx" package.json 2>/dev/null | head -10

  # @react-native-async-storage for tokens (WRONG — plaintext storage)
  grep -rn "@react-native-async-storage\|AsyncStorage" \
    src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -10 \
    | grep -i "token\|secret\|key\|auth\|session\|password" \
    && echo "  CRITICAL: AsyncStorage used for sensitive data — move to expo-secure-store or react-native-keychain"

  # react-native-keychain (correct for bare RN)
  grep -rn "react-native-keychain\|Keychain\." \
    src/ --include="*.ts" --include="*.tsx" package.json 2>/dev/null | head -5
fi
```

**Expo/RN secure storage requirements:**
- `expo-secure-store` (Expo) or `react-native-keychain` (bare RN) for all tokens and credentials
- `AsyncStorage` is plaintext — never use for secrets, tokens, or auth state
- Keychain Services (iOS) / Android Keystore backed by expo-secure-store are hardware-backed on modern devices

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

# iOS URLCache: tokens cached in /Library/Caches survive app restart
if [ "$_IS_IOS" = "1" ]; then
  grep -rn "URLCache\|\.cachePolicy\|useProtocolCachePolicy\|returnCacheDataElseLoad" \
    ios/ --include="*.swift" 2>/dev/null | head -5 \
    || echo "  WARN: No explicit URLCache policy — sensitive responses may be cached on disk"
fi

# Check network_security_config (Android)
find android/ -name "network_security_config.xml" 2>/dev/null | head -5
```

---

## Step 4: Authentication and sessions

```bash
if [ "$_FRAMEWORK" = "Flutter" ] || [ "$_FRAMEWORK" = "Expo" ] || [ "$_FRAMEWORK" = "React Native" ]; then
  grep -rn "OAuth\|PKCE\|auth\|login\|signIn" lib/ --include="*.dart" \
    src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20
  grep -rn "accessToken\|refreshToken\|session\|token" lib/ --include="*.dart" \
    src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20
  grep -rn "logout\|signOut\|clear\|revoke" lib/ --include="*.dart" \
    src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -15
fi
if [ "$_IS_IOS" = "1" ]; then
  grep -rn "OAuth\|PKCE\|ASWebAuthenticationSession\|signIn\|logout" \
    ios/ --include="*.swift" 2>/dev/null | head -20
fi
if [ "$_IS_ANDROID" = "1" ]; then
  grep -rn "OAuth\|PKCE\|signIn\|logout\|revoke" \
    android/ --include="*.kt" 2>/dev/null | head -20
fi
```

---

## Step 5: Binary and runtime security

```bash
if [ "$_FRAMEWORK" = "Flutter" ]; then
  grep -rn "kDebugMode\|kReleaseMode\|debugPrint\|print(" lib/ --include="*.dart" 2>/dev/null | head -20
fi
if [ "$_FRAMEWORK" = "Expo" ] || [ "$_FRAMEWORK" = "React Native" ]; then
  grep -rn "console\.log\|console\.error\|__DEV__" src/ --include="*.ts" --include="*.tsx" 2>/dev/null | head -20
fi
if [ "$_IS_IOS" = "1" ]; then
  grep -rn "print(\|NSLog(\|os_log" ios/ --include="*.swift" 2>/dev/null | head -15
fi
if [ "$_IS_ANDROID" = "1" ]; then
  grep -rn "Log\.\(d\|e\|w\|i\|v\)\|println" android/ --include="*.kt" 2>/dev/null | head -15
  grep -rn "minifyEnabled\|proguardFiles" \
    android/app/build.gradle android/app/build.gradle.kts 2>/dev/null | grep -v "//"
  # FLAG_IMMUTABLE on PendingIntent — required Android 12+ (API 31), security vulnerability without it
  grep -rn "PendingIntent\." android/ --include="*.kt" 2>/dev/null | \
    grep -v "FLAG_IMMUTABLE\|FLAG_MUTABLE" | head -10 \
    && echo "  CRITICAL: PendingIntent without FLAG_IMMUTABLE — required on Android 12+ (targetSdk 31+)"
fi
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