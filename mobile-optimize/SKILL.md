---
name: mobile-optimize
preamble-tier: 1
version: 1.0.0
description: |
  Mobile app optimization in two modes: ASO (App Store Optimization — keywords,
  metadata, screenshots, competitive positioning) and Performance (startup time,
  binary size, memory, battery usage). Default runs both. Each mode produces
  prioritized recommendations with AUTO-FIX for non-content changes.
  Use when: "optimize app", "ASO", "app store optimization", "app too slow",
  "reduce app size", "battery optimization", "startup time", "improve ranking",
  "increase downloads", "app store visibility".
  Proactively suggest after stable release once metrics are available. (gstack)
  Voice triggers (speech-to-text aliases): "app store optimization", "app performance", "optimize store listing".
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
  - Glob
  - AskUserQuestion
  - WebSearch
---
<!-- AUTO-GENERATED from SKILL.md.tmpl — do not edit directly -->
<!-- Regenerate: bun run gen:skill-docs -->

## Preamble (run first)

```bash
_UPD=$(~/.claude/skills/gstack/bin/gstack-update-check 2>/dev/null || .claude/skills/gstack/bin/gstack-update-check 2>/dev/null || true)
[ -n "$_UPD" ] && echo "$_UPD" || true
mkdir -p ~/.gstack/sessions
touch ~/.gstack/sessions/"$PPID"
_SESSIONS=$(find ~/.gstack/sessions -mmin -120 -type f 2>/dev/null | wc -l | tr -d ' ')
find ~/.gstack/sessions -mmin +120 -type f -exec rm {} + 2>/dev/null || true
_PROACTIVE=$(~/.claude/skills/gstack/bin/gstack-config get proactive 2>/dev/null || echo "true")
_PROACTIVE_PROMPTED=$([ -f ~/.gstack/.proactive-prompted ] && echo "yes" || echo "no")
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
echo "BRANCH: $_BRANCH"
_SKILL_PREFIX=$(~/.claude/skills/gstack/bin/gstack-config get skill_prefix 2>/dev/null || echo "false")
echo "PROACTIVE: $_PROACTIVE"
echo "PROACTIVE_PROMPTED: $_PROACTIVE_PROMPTED"
echo "SKILL_PREFIX: $_SKILL_PREFIX"
source <(~/.claude/skills/gstack/bin/gstack-repo-mode 2>/dev/null) || true
REPO_MODE=${REPO_MODE:-unknown}
echo "REPO_MODE: $REPO_MODE"
_LAKE_SEEN=$([ -f ~/.gstack/.completeness-intro-seen ] && echo "yes" || echo "no")
echo "LAKE_INTRO: $_LAKE_SEEN"
_TEL=$(~/.claude/skills/gstack/bin/gstack-config get telemetry 2>/dev/null || true)
_TEL_PROMPTED=$([ -f ~/.gstack/.telemetry-prompted ] && echo "yes" || echo "no")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "TELEMETRY: ${_TEL:-off}"
echo "TEL_PROMPTED: $_TEL_PROMPTED"
mkdir -p ~/.gstack/analytics
if [ "$_TEL" != "off" ]; then
echo '{"skill":"mobile-optimize","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","repo":"'$(basename "$(git rev-parse --show-toplevel 2>/dev/null)" 2>/dev/null || echo "unknown")'"}'  >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
# zsh-compatible: use find instead of glob to avoid NOMATCH error
for _PF in $(find ~/.gstack/analytics -maxdepth 1 -name '.pending-*' 2>/dev/null); do
  if [ -f "$_PF" ]; then
    if [ "$_TEL" != "off" ] && [ -x "~/.claude/skills/gstack/bin/gstack-telemetry-log" ]; then
      ~/.claude/skills/gstack/bin/gstack-telemetry-log --event-type skill_run --skill _pending_finalize --outcome unknown --session-id "$_SESSION_ID" 2>/dev/null || true
    fi
    rm -f "$_PF" 2>/dev/null || true
  fi
  break
done
# Learnings count
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
_LEARN_FILE="${GSTACK_HOME:-$HOME/.gstack}/projects/${SLUG:-unknown}/learnings.jsonl"
if [ -f "$_LEARN_FILE" ]; then
  _LEARN_COUNT=$(wc -l < "$_LEARN_FILE" 2>/dev/null | tr -d ' ')
  echo "LEARNINGS: $_LEARN_COUNT entries loaded"
  if [ "$_LEARN_COUNT" -gt 5 ] 2>/dev/null; then
    ~/.claude/skills/gstack/bin/gstack-learnings-search --limit 3 2>/dev/null || true
  fi
else
  echo "LEARNINGS: 0"
fi
# Session timeline: record skill start (local-only, never sent anywhere)
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"mobile-optimize","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
# Check if CLAUDE.md has routing rules
_HAS_ROUTING="no"
if [ -f CLAUDE.md ] && grep -q "## Skill routing" CLAUDE.md 2>/dev/null; then
  _HAS_ROUTING="yes"
fi
_ROUTING_DECLINED=$(~/.claude/skills/gstack/bin/gstack-config get routing_declined 2>/dev/null || echo "false")
echo "HAS_ROUTING: $_HAS_ROUTING"
echo "ROUTING_DECLINED: $_ROUTING_DECLINED"
# Vendoring deprecation: detect if CWD has a vendored gstack copy
_VENDORED="no"
if [ -d ".claude/skills/gstack" ] && [ ! -L ".claude/skills/gstack" ]; then
  if [ -f ".claude/skills/gstack/VERSION" ] || [ -d ".claude/skills/gstack/.git" ]; then
    _VENDORED="yes"
  fi
fi
echo "VENDORED_GSTACK: $_VENDORED"
# Detect spawned session (OpenClaw or other orchestrator)
[ -n "$OPENCLAW_SESSION" ] && echo "SPAWNED_SESSION: true" || true
```

If `PROACTIVE` is `"false"`, do not proactively suggest gstack skills AND do not
auto-invoke skills based on conversation context. Only run skills the user explicitly
types (e.g., /qa, /ship). If you would have auto-invoked a skill, instead briefly say:
"I think /skillname might help here — want me to run it?" and wait for confirmation.
The user opted out of proactive behavior.

If `SKILL_PREFIX` is `"true"`, the user has namespaced skill names. When suggesting
or invoking other gstack skills, use the `/gstack-` prefix (e.g., `/gstack-qa` instead
of `/qa`, `/gstack-ship` instead of `/ship`). Disk paths are unaffected — always use
`~/.claude/skills/gstack/[skill-name]/SKILL.md` for reading skill files.

If output shows `UPGRADE_AVAILABLE <old> <new>`: read `~/.claude/skills/gstack/gstack-upgrade/SKILL.md` and follow the "Inline upgrade flow" (auto-upgrade if configured, otherwise AskUserQuestion with 4 options, write snooze state if declined). If `JUST_UPGRADED <from> <to>`: tell user "Running gstack v{to} (just updated!)" and continue.

If `LAKE_INTRO` is `no`: Before continuing, introduce the Completeness Principle.
Tell the user: "gstack follows the **Boil the Lake** principle — always do the complete
thing when AI makes the marginal cost near-zero. Read more: https://garryslist.org/posts/boil-the-ocean"
Then offer to open the essay in their default browser:

```bash
open https://garryslist.org/posts/boil-the-ocean
touch ~/.gstack/.completeness-intro-seen
```

Only run `open` if the user says yes. Always run `touch` to mark as seen. This only happens once.

If `TEL_PROMPTED` is `no` AND `LAKE_INTRO` is `yes`: After the lake intro is handled,
ask the user about telemetry. Use AskUserQuestion:

> Help gstack get better! Community mode shares usage data (which skills you use, how long
> they take, crash info) with a stable device ID so we can track trends and fix bugs faster.
> No code, file paths, or repo names are ever sent.
> Change anytime with `gstack-config set telemetry off`.

Options:
- A) Help gstack get better! (recommended)
- B) No thanks

If A: run `~/.claude/skills/gstack/bin/gstack-config set telemetry community`

If B: ask a follow-up AskUserQuestion:

> How about anonymous mode? We just learn that *someone* used gstack — no unique ID,
> no way to connect sessions. Just a counter that helps us know if anyone's out there.

Options:
- A) Sure, anonymous is fine
- B) No thanks, fully off

If B→A: run `~/.claude/skills/gstack/bin/gstack-config set telemetry anonymous`
If B→B: run `~/.claude/skills/gstack/bin/gstack-config set telemetry off`

Always run:
```bash
touch ~/.gstack/.telemetry-prompted
```

This only happens once. If `TEL_PROMPTED` is `yes`, skip this entirely.

If `PROACTIVE_PROMPTED` is `no` AND `TEL_PROMPTED` is `yes`: After telemetry is handled,
ask the user about proactive behavior. Use AskUserQuestion:

> gstack can proactively figure out when you might need a skill while you work —
> like suggesting /qa when you say "does this work?" or /investigate when you hit
> a bug. We recommend keeping this on — it speeds up every part of your workflow.

Options:
- A) Keep it on (recommended)
- B) Turn it off — I'll type /commands myself

If A: run `~/.claude/skills/gstack/bin/gstack-config set proactive true`
If B: run `~/.claude/skills/gstack/bin/gstack-config set proactive false`

Always run:
```bash
touch ~/.gstack/.proactive-prompted
```

This only happens once. If `PROACTIVE_PROMPTED` is `yes`, skip this entirely.

If `HAS_ROUTING` is `no` AND `ROUTING_DECLINED` is `false` AND `PROACTIVE_PROMPTED` is `yes`:
Check if a CLAUDE.md file exists in the project root. If it does not exist, create it.

Use AskUserQuestion:

> gstack works best when your project's CLAUDE.md includes skill routing rules.
> This tells Claude to use specialized workflows (like /ship, /investigate, /qa)
> instead of answering directly. It's a one-time addition, about 15 lines.

Options:
- A) Add routing rules to CLAUDE.md (recommended)
- B) No thanks, I'll invoke skills manually

If A: Append this section to the end of CLAUDE.md:

```markdown

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
```

Then commit the change: `git add CLAUDE.md && git commit -m "chore: add gstack skill routing rules to CLAUDE.md"`

If B: run `~/.claude/skills/gstack/bin/gstack-config set routing_declined true`
Say "No problem. You can add routing rules later by running `gstack-config set routing_declined false` and re-running any skill."

This only happens once per project. If `HAS_ROUTING` is `yes` or `ROUTING_DECLINED` is `true`, skip this entirely.

If `VENDORED_GSTACK` is `yes`: This project has a vendored copy of gstack at
`.claude/skills/gstack/`. Vendoring is deprecated. We will not keep vendored copies
up to date, so this project's gstack will fall behind.

Use AskUserQuestion (one-time per project, check for `~/.gstack/.vendoring-warned-$SLUG` marker):

> This project has gstack vendored in `.claude/skills/gstack/`. Vendoring is deprecated.
> We won't keep this copy up to date, so you'll fall behind on new features and fixes.
>
> Want to migrate to team mode? It takes about 30 seconds.

Options:
- A) Yes, migrate to team mode now
- B) No, I'll handle it myself

If A:
1. Run `git rm -r .claude/skills/gstack/`
2. Run `echo '.claude/skills/gstack/' >> .gitignore`
3. Run `~/.claude/skills/gstack/bin/gstack-team-init required` (or `optional`)
4. Run `git add .claude/ .gitignore CLAUDE.md && git commit -m "chore: migrate gstack from vendored to team mode"`
5. Tell the user: "Done. Each developer now runs: `cd ~/.claude/skills/gstack && ./setup --team`"

If B: say "OK, you're on your own to keep the vendored copy up to date."

Always run (regardless of choice):
```bash
eval "$(~/.claude/skills/gstack/bin/gstack-slug 2>/dev/null)" 2>/dev/null || true
touch ~/.gstack/.vendoring-warned-${SLUG:-unknown}
```

This only happens once per project. If the marker file exists, skip entirely.

If `SPAWNED_SESSION` is `"true"`, you are running inside a session spawned by an
AI orchestrator (e.g., OpenClaw). In spawned sessions:
- Do NOT use AskUserQuestion for interactive prompts. Auto-choose the recommended option.
- Do NOT run upgrade checks, telemetry prompts, routing injection, or lake intro.
- Focus on completing the task and reporting results via prose output.
- End with a completion report: what shipped, decisions made, anything uncertain.

## Voice

**Tone:** direct, concrete, sharp, never corporate, never academic. Sound like a builder, not a consultant. Name the file, the function, the command. No filler, no throat-clearing.

**Writing rules:** No em dashes (use commas, periods, "..."). No AI vocabulary (delve, crucial, robust, comprehensive, nuanced, etc.). Short paragraphs. End with what to do.

The user always has context you don't. Cross-model agreement is a recommendation, not a decision — the user decides.

## Completion Status Protocol

When completing a skill workflow, report status using one of:
- **DONE** — All steps completed successfully. Evidence provided for each claim.
- **DONE_WITH_CONCERNS** — Completed, but with issues the user should know about. List each concern.
- **BLOCKED** — Cannot proceed. State what is blocking and what was tried.
- **NEEDS_CONTEXT** — Missing information required to continue. State exactly what you need.

### Escalation

It is always OK to stop and say "this is too hard for me" or "I'm not confident in this result."

Bad work is worse than no work. You will not be penalized for escalating.
- If you have attempted a task 3 times without success, STOP and escalate.
- If you are uncertain about a security-sensitive change, STOP and escalate.
- If the scope of work exceeds what you can verify, STOP and escalate.

Escalation format:
```
STATUS: BLOCKED | NEEDS_CONTEXT
REASON: [1-2 sentences]
ATTEMPTED: [what you tried]
RECOMMENDATION: [what the user should do next]
```

## Operational Self-Improvement

Before completing, reflect on this session:
- Did any commands fail unexpectedly?
- Did you take a wrong approach and have to backtrack?
- Did you discover a project-specific quirk (build order, env vars, timing, auth)?
- Did something take longer than expected because of a missing flag or config?

If yes, log an operational learning for future sessions:

```bash
~/.claude/skills/gstack/bin/gstack-learnings-log '{"skill":"SKILL_NAME","type":"operational","key":"SHORT_KEY","insight":"DESCRIPTION","confidence":N,"source":"observed"}'
```

Replace SKILL_NAME with the current skill name. Only log genuine operational discoveries.
Don't log obvious things or one-time transient errors (network blips, rate limits).
A good test: would knowing this save 5+ minutes in a future session? If yes, log it.

## Telemetry (run last)

After the skill workflow completes (success, error, or abort), log the telemetry event.
Determine the skill name from the `name:` field in this file's YAML frontmatter.
Determine the outcome from the workflow result (success if completed normally, error
if it failed, abort if the user interrupted).

**PLAN MODE EXCEPTION — ALWAYS RUN:** This command writes telemetry to
`~/.gstack/analytics/` (user config directory, not project files). The skill
preamble already writes to the same directory — this is the same pattern.
Skipping this command loses session duration and outcome data.

Run this bash:

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
rm -f ~/.gstack/analytics/.pending-"$_SESSION_ID" 2>/dev/null || true
# Session timeline: record skill completion (local-only, never sent anywhere)
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"SKILL_NAME","event":"completed","branch":"'$(git branch --show-current 2>/dev/null || echo unknown)'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
# Local analytics (gated on telemetry setting)
if [ "$_TEL" != "off" ]; then
echo '{"skill":"SKILL_NAME","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","browse":"USED_BROWSE","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
# Remote telemetry (opt-in, requires binary)
if [ "$_TEL" != "off" ] && [ -x ~/.claude/skills/gstack/bin/gstack-telemetry-log ]; then
  ~/.claude/skills/gstack/bin/gstack-telemetry-log \
    --skill "SKILL_NAME" --duration "$_TEL_DUR" --outcome "OUTCOME" \
    --used-browse "USED_BROWSE" --session-id "$_SESSION_ID" 2>/dev/null &
fi
```

Replace `SKILL_NAME` with the actual skill name from frontmatter, `OUTCOME` with
success/error/abort, and `USED_BROWSE` with true/false based on whether `$B` was used.
If you cannot determine the outcome, use "unknown". The local JSONL always logs. The
remote binary only runs if telemetry is not off and the binary exists.

## Plan Mode Safe Operations

When in plan mode, these operations are always allowed because they produce
artifacts that inform the plan, not code changes:

- `$B` commands (browse: screenshots, page inspection, navigation, snapshots)
- `$D` commands (design: generate mockups, variants, comparison boards, iterate)
- `codex exec` / `codex review` (outside voice, plan review, adversarial challenge)
- Writing to `~/.gstack/` (config, analytics, review logs, design artifacts, learnings)
- Writing to the plan file (already allowed by plan mode)
- `open` commands for viewing generated artifacts (comparison boards, HTML previews)

These are read-only in spirit — they inspect the live site, generate visual artifacts,
or get independent opinions. They do NOT modify project source files.

## Skill Invocation During Plan Mode

If a user invokes a skill during plan mode, that invoked skill workflow takes
precedence over generic plan mode behavior until it finishes or the user explicitly
cancels that skill.

Treat the loaded skill as executable instructions, not reference material. Follow
it step by step. Do not summarize, skip, reorder, or shortcut its steps.

If the skill says to use AskUserQuestion, do that. Those AskUserQuestion calls
satisfy plan mode's requirement to end turns with AskUserQuestion.

If the skill reaches a STOP point, stop immediately at that point, ask the required
question if any, and wait for the user's response. Do not continue the workflow
past a STOP point, and do not call ExitPlanMode at that point.

If the skill includes commands marked "PLAN MODE EXCEPTION — ALWAYS RUN," execute
them. The skill may edit the plan file, and other writes are allowed only if they
are already permitted by Plan Mode Safe Operations or explicitly marked as a plan
mode exception.

Only call ExitPlanMode after the active skill workflow is complete and there are no
other invoked skill workflows left to run, or if the user explicitly tells you to
cancel the skill or leave plan mode.

## Plan Status Footer

When you are in plan mode and about to call ExitPlanMode:

1. Check if the plan file already has a `## GSTACK REVIEW REPORT` section.
2. If it DOES — skip (a review skill already wrote a richer report).
3. If it does NOT — run this command:

\`\`\`bash
~/.claude/skills/gstack/bin/gstack-review-read
\`\`\`

Then write a `## GSTACK REVIEW REPORT` section to the end of the plan file:

- If the output contains review entries (JSONL lines before `---CONFIG---`): format the
  standard report table with runs/status/findings per skill, same format as the review
  skills use.
- If the output is `NO_REVIEWS` or empty: write this placeholder table:

\`\`\`markdown
## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | \`/plan-ceo-review\` | Scope & strategy | 0 | — | — |
| Codex Review | \`/codex review\` | Independent 2nd opinion | 0 | — | — |
| Eng Review | \`/plan-eng-review\` | Architecture & tests (required) | 0 | — | — |
| Design Review | \`/plan-design-review\` | UI/UX gaps | 0 | — | — |
| DX Review | \`/plan-devex-review\` | Developer experience gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run \`/autoplan\` for full review pipeline, or individual reviews above.
\`\`\`

**PLAN MODE EXCEPTION — ALWAYS RUN:** This writes to the plan file, which is the one
file you are allowed to edit in plan mode. The plan file review report is part of the
plan's living status.

# /mobile-optimize: ASO + Performance Optimization

Two modes: `--aso` for store listing optimization, `--perf` for runtime performance.
Default (no flag): run both.

**Parse the user's request:**
- "ASO" / "app store optimization" / "ranking" / "keywords" → ASO mode only
- "slow" / "startup" / "battery" / "size" / "memory" → Perf mode only
- "optimize" / no qualifier → both modes

---

## Setup

## Mobile Ecosystem Detection

Run this detection block to determine the project's mobile ecosystem. Read
`CLAUDE.md` first — if a `## Mobile Stack` section exists with an
`ecosystem:` entry, use those cached values and skip the rest of detection.

```bash
setopt +o nomatch 2>/dev/null || true  # zsh compat

# 1. Read cached values from CLAUDE.md first
_MOBILE=$(grep -A1 "## Mobile Stack" CLAUDE.md 2>/dev/null | grep "ecosystem:" | cut -d: -f2 | tr -d ' ')
_HAS_IOS=$(grep -A5 "## Mobile Stack" CLAUDE.md 2>/dev/null | grep "has_ios:" | cut -d: -f2 | tr -d ' ')
_HAS_ANDROID=$(grep -A5 "## Mobile Stack" CLAUDE.md 2>/dev/null | grep "has_android:" | cut -d: -f2 | tr -d ' ')

# 2. Auto-detect if no cached values
if [ -z "$_MOBILE" ] || [ "$_MOBILE" = "unknown" ]; then
  _MOBILE="unknown"
  # Flutter: pubspec.yaml with flutter dependency
  [ -f pubspec.yaml ] && grep -q "flutter:" pubspec.yaml 2>/dev/null && _MOBILE="flutter"
  # Expo: package.json with expo dependency (check before react-native)
  [ "$_MOBILE" = "unknown" ] && [ -f package.json ] && grep -q '"expo"' package.json 2>/dev/null && _MOBILE="expo"
  [ "$_MOBILE" = "unknown" ] && [ -f eas.json ] && _MOBILE="expo"
  # React Native: package.json with react-native (but not expo)
  [ "$_MOBILE" = "unknown" ] && [ -f package.json ] && grep -q '"react-native"' package.json 2>/dev/null && _MOBILE="react-native"
  # Swift/iOS: .xcodeproj or .xcworkspace at root or in ios/ subdir
  [ "$_MOBILE" = "unknown" ] && ls *.xcodeproj *.xcworkspace 2>/dev/null | grep -q . && _MOBILE="swift"
  [ "$_MOBILE" = "unknown" ] && ls ios/*.xcodeproj ios/*.xcworkspace 2>/dev/null | grep -q . && _MOBILE="react-native"
  # Kotlin/Android: android/app/build.gradle or root build.gradle with android block
  [ "$_MOBILE" = "unknown" ] && [ -f android/app/build.gradle ] && _MOBILE="kotlin"
  [ "$_MOBILE" = "unknown" ] && [ -f app/build.gradle ] && _MOBILE="kotlin"
fi

# 3. Platform presence — independent of ecosystem
_HAS_IOS="${_HAS_IOS:-false}"
_HAS_ANDROID="${_HAS_ANDROID:-false}"
ls *.xcodeproj *.xcworkspace 2>/dev/null | grep -q . && _HAS_IOS="true"
[ -f ios/Podfile ] && _HAS_IOS="true"
[ -d ios ] && ls ios/*.xcodeproj ios/*.xcworkspace 2>/dev/null | grep -q . && _HAS_IOS="true"
[ -f android/app/build.gradle ] && _HAS_ANDROID="true"
[ -d android ] && _HAS_ANDROID="true"
[ "$_MOBILE" = "kotlin" ] && _HAS_ANDROID="true"
[ "$_MOBILE" = "swift" ] && _HAS_IOS="true"

# 4. Ecosystem-specific commands
case "$_MOBILE" in
  flutter)
    _TEST_CMD="flutter test"
    _BUILD_CMD="flutter build appbundle --release"
    _ANALYZE_CMD="flutter analyze"
    ;;
  expo)
    _TEST_CMD="npx jest"
    _BUILD_CMD="eas build --platform all --profile production"
    _ANALYZE_CMD="expo doctor && npx tsc --noEmit 2>/dev/null || true"
    ;;
  react-native)
    _TEST_CMD="npx jest"
    _BUILD_CMD="npx react-native build-android --mode release"
    _ANALYZE_CMD="npx tsc --noEmit"
    ;;
  swift)
    _SCHEME=$(ls *.xcodeproj 2>/dev/null | head -1 | sed 's/.xcodeproj//')
    _TEST_CMD="xcodebuild test -scheme ${_SCHEME:-App} -destination 'platform=iOS Simulator,name=iPhone 16' 2>&1 | tail -30"
    _BUILD_CMD="xcodebuild archive -scheme ${_SCHEME:-App} -archivePath /tmp/${_SCHEME:-App}.xcarchive 2>&1 | tail -20"
    _ANALYZE_CMD="xcodebuild analyze -scheme ${_SCHEME:-App} 2>&1 | grep -E 'warning|error' | head -20"
    ;;
  kotlin)
    _TEST_CMD="./gradlew test"
    _BUILD_CMD="./gradlew bundleRelease"
    _ANALYZE_CMD="./gradlew lint"
    ;;
  *)
    _TEST_CMD="echo 'MOBILE_ECOSYSTEM=unknown: no mobile test command'"
    _BUILD_CMD="echo 'MOBILE_ECOSYSTEM=unknown: no mobile build command'"
    _ANALYZE_CMD="echo 'MOBILE_ECOSYSTEM=unknown: no mobile analyze command'"
    ;;
esac

echo "MOBILE_ECOSYSTEM: $_MOBILE"
echo "MOBILE_HAS_IOS: $_HAS_IOS"
echo "MOBILE_HAS_ANDROID: $_HAS_ANDROID"
echo "MOBILE_TEST_CMD: $_TEST_CMD"
echo "MOBILE_BUILD_CMD: $_BUILD_CMD"
echo "MOBILE_ANALYZE_CMD: $_ANALYZE_CMD"
```

**If `MOBILE_ECOSYSTEM=unknown`:** The project is not a recognized mobile app.
Mobile-specific steps below do not apply — proceed with web/generic workflow.

**On first successful detection**, persist to `CLAUDE.md` under a
`## Mobile Stack` section (create if absent):

```markdown
## Mobile Stack

- ecosystem: <detected value>
- has_ios: <true|false>
- has_android: <true|false>
- test: <test command>
- build_android: <android build command>
- build_ios: <ios build command>
- analyze: <analyze command>
- bundle_id: (fill in: e.g. com.company.appname)
- min_ios: (fill in: e.g. 16.0)
- min_android: (fill in: e.g. 24)
```

If `MOBILE_ECOSYSTEM=unknown`: output "This doesn't appear to be a mobile project."
and stop.

---

# Part A: ASO (App Store Optimization)

## A1: Read Current Metadata

```bash
# iOS: Fastlane metadata
ls fastlane/metadata/en-US/ 2>/dev/null
cat fastlane/metadata/en-US/name.txt 2>/dev/null
cat fastlane/metadata/en-US/subtitle.txt 2>/dev/null
cat fastlane/metadata/en-US/keywords.txt 2>/dev/null
cat fastlane/metadata/en-US/description.txt 2>/dev/null
ls fastlane/screenshots/ 2>/dev/null

# Android: Fastlane metadata
ls fastlane/metadata/android/en-US/ 2>/dev/null
cat fastlane/metadata/android/en-US/title.txt 2>/dev/null
cat fastlane/metadata/android/en-US/short_description.txt 2>/dev/null
cat fastlane/metadata/android/en-US/full_description.txt 2>/dev/null
ls fastlane/metadata/android/en-US/images/ 2>/dev/null

# Expo
grep '"name"\|"description"\|"slug"' app.json 2>/dev/null | head -5
```

If no metadata files found: note that ASO metadata isn't tracked in the repo yet.
Offer to create `fastlane/metadata/` structure.

## A2: Competitive Keyword Research

Use WebSearch for:
1. `"<app category> app store keywords 2026"` — find high-volume keywords
2. `"<app name> competitor" site:apps.apple.com OR site:play.google.com` — find top 3 competitors
3. For each competitor found, search `"<competitor app> keywords"` — identify their strategy

Report: top 10 candidate keywords with estimated relevance (high/medium/low) for the app.

## A3: Metadata Audit

Check against 2026 guidelines:

**iOS:**
- Title: ≤30 chars (AUTO-FIX: trim to limit) — include primary keyword
- Subtitle: ≤30 chars — secondary keyword opportunity (often missed)
- Keywords field: ≤100 chars, comma-separated, no spaces after commas (AUTO-FIX formatting)
- Description: first 3 lines appear before "more" fold — most valuable real estate
- Does description front-load the value prop? Or bury it in the 4th paragraph?

**Android:**
- Title: ≤50 chars — include primary keyword (more space than iOS)
- Short description: ≤80 chars — appears on search results, crucial for CTR
- Full description: first 167 chars appear above fold

**Screenshots (both platforms):**
- Count: iOS supports up to 10 per device size; Android up to 8
- First screenshot: does it communicate the core value prop?
- Text overlays: are screenshots "annotated" to show features? (Higher conversion)
- Device frames: framed screenshots convert better
- Portrait vs landscape: verify orientation matches app

## A4: ASO Recommendations

Produce prioritized list:

```
ASO OPTIMIZATION REPORT
══════════════════════
HIGH IMPACT (implement this sprint):
  [1] Add subtitle — currently empty, wastes 30 chars of keyword real estate
      Suggested: "<key benefit> · <secondary keyword>"
  [2] Keyword field gaps — missing high-volume terms: X, Y, Z
      Current keywords (87/100 chars): ...
      Suggested keywords: (optimized for volume + relevance)

MEDIUM IMPACT:
  [3] First screenshot doesn't show the main feature — [description of what to change]
  [4] Description buries value prop — move paragraph 4 to paragraph 1

AUTO-FIXED:
  ✅ Keyword formatting: removed spaces after commas
  ✅ Title trimmed to 30 chars
```

AUTO-FIX formatting issues. ASK for content changes via AskUserQuestion.

---

# Part B: Performance Optimization

## B1: Binary Size Analysis

```bash
# iOS: IPA size
find . -name "*.ipa" 2>/dev/null | xargs -I{} sh -c 'echo "IPA: {}"; ls -lh {}'

# iOS: framework breakdown
find . -name "*.ipa" 2>/dev/null | head -1 | xargs -I{} sh -c \
  'unzip -l {} 2>/dev/null | grep -E "\.framework|\.dylib|Assets" | sort -k3 -rn | head -20'

# Android: AAB size
find . -name "*.aab" 2>/dev/null | xargs -I{} sh -c 'echo "AAB: {}"; ls -lh {}'

# Flutter: analyze size
[ "$MOBILE_ECOSYSTEM" = "flutter" ] && \
  flutter build apk --analyze-size --target-platform android-arm64 2>/dev/null | tail -30

# React Native: bundle size
[ "$MOBILE_ECOSYSTEM" = "react-native" ] || [ "$MOBILE_ECOSYSTEM" = "expo" ] && \
  npx react-native bundle --entry-file index.js --bundle-output /tmp/bundle.js \
    --platform android 2>/dev/null && ls -lh /tmp/bundle.js 2>/dev/null
```

**Targets:**
- iOS IPA: <50MB (downloads require Wi-Fi above 200MB per carrier limit; app installs above 4GB are rejected)
- Android AAB: <30MB baseline (app modules can be deferred via Play Feature Delivery)

## B2: Cold Startup Time

```bash
# iOS: measure via simctl
_BUNDLE=$(grep "bundle_id:" CLAUDE.md 2>/dev/null | cut -d: -f2 | tr -d ' ')
_SIM=$(xcrun simctl list devices booted 2>/dev/null | grep "iPhone" | head -1 | grep -oE '[A-F0-9-]{36}')
if [ -n "$_SIM" ] && [ -n "$_BUNDLE" ]; then
  xcrun simctl terminate "$_SIM" "$_BUNDLE" 2>/dev/null
  xcrun simctl launch --console "$_SIM" "$_BUNDLE" 2>&1 | head -20
fi

# Android: measure via adb
_PKG=$(grep "bundle_id:" CLAUDE.md 2>/dev/null | cut -d: -f2 | tr -d ' ')
if adb devices 2>/dev/null | grep -q "device$"; then
  adb shell am force-stop "$_PKG" 2>/dev/null
  adb shell am start-activity -W -n "${_PKG}/.MainActivity" 2>/dev/null | \
    grep -E "TotalTime|WaitTime|ThisTime"
fi

# Flutter
[ "$MOBILE_ECOSYSTEM" = "flutter" ] && \
  echo "Run: flutter run --profile and enable performance overlay in DevTools"
```

**Targets:**
- Cold launch <2s (OS kills apps that don't render in 20s; App Store measures perception)
- Android TotalTime <1000ms (Play Store "cold start bad behavior" = >5000ms)

## B3: Memory and Battery

```bash
# Android memory snapshot
_PKG=$(grep "bundle_id:" CLAUDE.md 2>/dev/null | cut -d: -f2 | tr -d ' ')
adb shell dumpsys meminfo "$_PKG" 2>/dev/null | grep -E "TOTAL|Dalvik|Native|Other" | head -10

# Android battery stats (run after 5 minutes of app use)
adb shell dumpsys batterystats --reset 2>/dev/null
echo "Use the app for 5 minutes, then run:"
echo "  adb shell dumpsys batterystats $_PKG | grep -E 'Computed drain|wake_lock|running'"

# Check for common battery drain patterns
grep -rn "Timer\|RunLoop\|DispatchQueue.main.asyncAfter\|setInterval\|NSTimer" \
  --include="*.swift" --include="*.kt" --include="*.dart" --include="*.ts" \
  . 2>/dev/null | grep -v "test\|spec" | head -10
```

## B4: Code-Level Optimizations

```bash
setopt +o nomatch 2>/dev/null || true  # zsh compat
# Swift: check for known performance anti-patterns
# - Force cast on hot paths
grep -rn " as! " --include="*.swift" . 2>/dev/null | grep -v "test\|Test" | head -10
# - Main thread dispatch for UI already on main thread (noop overhead)
grep -rn "DispatchQueue.main.async" --include="*.swift" . 2>/dev/null | head -5

# Kotlin: check for common leaks
# - Context stored in companion/static
grep -rn "companion object.*Context\|object.*Context\|static.*Context" \
  --include="*.kt" . 2>/dev/null | head -5
# - Missing weak reference in coroutine callbacks
grep -rn "GlobalScope\|runBlocking" --include="*.kt" . 2>/dev/null | head -5

# Flutter: check for build method anti-patterns
grep -rn "\.then\|await.*build\|setState.*heavy" --include="*.dart" . 2>/dev/null | head -5

# RN: check for FlatList missing keyExtractor
grep -rn "<FlatList" --include="*.tsx" --include="*.jsx" . 2>/dev/null | head -5
grep -rn "keyExtractor" --include="*.tsx" --include="*.jsx" . 2>/dev/null | head -5
```

## B5: Performance Report

```
PERFORMANCE OPTIMIZATION REPORT
═══════════════════════════════

BINARY SIZE
  iOS IPA:         XX MB  [TARGET: <50MB] ✅/⚠️/❌
  Android AAB:     XX MB  [TARGET: <30MB] ✅/⚠️/❌
  Largest frameworks: ...

STARTUP TIME
  iOS cold launch: X.Xs   [TARGET: <2s]  ✅/⚠️/❌
  Android TotalTime: Xms  [TARGET: <1s]  ✅/⚠️/❌

MEMORY
  Android foreground: XX MB [TARGET: <150MB] ✅/⚠️/❌

RECOMMENDATIONS (prioritized)
  HIGH: [recommendation with file:line evidence]
  MEDIUM: [recommendation]
  LOW: [recommendation]
```

---

## Final Output

Combine ASO and Perf reports (if both modes run). Write to
`.gstack/optimize-reports/{YYYY-MM-DD}-mobile-optimize.md`.

AUTO-FIX changes commit: `perf(mobile): apply automated optimization fixes`
