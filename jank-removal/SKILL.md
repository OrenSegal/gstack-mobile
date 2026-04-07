---
name: jank-removal
preamble-tier: 4
version: 1.0.0
description: |
  Systematic Flutter jank elimination. Profiles the primary feed/list using Flutter
  DevTools Performance tab, identifies expensive builds, jank-causing widgets, and
  heavy async operations on the UI thread. Produces concrete widget refactors with
  before/after frame time targets. Run after /mobile-qa identifies scroll failures.
  (gstack-mobile)
allowed-tools:
  - Bash
  - Read
  - Write
  - Grep
  - Glob
  - AskUserQuestion
---
<!-- gstack-mobile: jank-removal/SKILL.md -->

## Preamble (run first)

```bash
_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
_MOBILE_PLATFORM=$(~/.claude/skills/gstack/bin/gstack-config get mobile_platform 2>/dev/null || echo "unknown")
_TEL_START=$(date +%s)
_SESSION_ID="$$-$(date +%s)"
echo "BRANCH: $_BRANCH"
echo "MOBILE_PLATFORM: $_MOBILE_PLATFORM"
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"jank-removal","event":"started","branch":"'"$_BRANCH"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null &
```

If platform is not Flutter, note that this skill is Flutter-specific and provide general
performance guidance for Expo/Swift/Kotlin instead, then offer to continue with the
Flutter-specific steps anyway if the user wants.

---

# /jank-removal

60fps = 16ms per frame. 120fps (ProMotion) = 8.3ms. If your frame pipeline takes longer than
that budget, the user sees a dropped frame. This skill finds exactly which widget is blowing
the budget and tells you how to fix it.

---

## Step 0: Profile setup

```bash
# Confirm profile mode (not debug, not release)
# Profile mode = real performance without debugger overhead
flutter run --profile 2>/dev/null | head -5 || echo "Run: flutter run --profile in your terminal"
echo ""
echo "Open Flutter DevTools:"
echo "  1. flutter run --profile"
echo "  2. DevTools URL will print to console"
echo "  3. Open Performance tab"
echo "  4. Enable 'Record widget rebuilds' and 'Track repaints'"
```

---

## Step 1: Static analysis (before profiling)

Find the most likely jank sources before running the profiler. These are
code-level issues that cause jank regardless of specific data.

### 1a. Expensive builds in lists

```bash
# Find ListView/GridView without builder pattern (allocates all children upfront)
grep -rn "ListView\s*(" lib/ --include="*.dart" 2>/dev/null \
  | grep -v "ListView.builder\|ListView.separated\|ListView.custom\|// " | head -20

# Find GridView without builder
grep -rn "GridView\s*(" lib/ --include="*.dart" 2>/dev/null \
  | grep -v "GridView.builder\|GridView.count\|GridView.extent\|// " | head -10
```

`ListView(children: [...])` allocates all children upfront. Any list with more than ~8
items should use `ListView.builder`. Flag each occurrence.

### 1b. setState in list items

```bash
# setState calls inside widget that appears to be inside a list
grep -rn "setState\b" lib/ --include="*.dart" 2>/dev/null | head -30
```

`setState` on a list item widget causes the entire list to potentially rebuild.
Prefer `ValueNotifier` + `ValueListenableBuilder` for local state in list items,
or Riverpod `ConsumerWidget` with fine-grained providers.

### 1c. Non-const constructors for static widgets

```bash
# Find widgets that could be const but aren't
# These rebuild on every parent rebuild even if their data hasn't changed
grep -rn "Text(\"\|SizedBox(\|Icon(\|Padding(" lib/ --include="*.dart" 2>/dev/null \
  | grep -v "const " | grep -v "//" | head -20
```

Any static widget (no variable data) must be `const`. Non-const widgets rebuild on
every parent rebuild even when nothing changed.

### 1d. Images without cache sizing

```bash
grep -rn "Image\.network\|Image\.asset\|CachedNetworkImage" lib/ --include="*.dart" 2>/dev/null \
  | grep -v "cacheWidth\|cacheHeight\|maxWidth\|maxHeight" | head -10
```

Loading a 2000×2000 image to display at 100×100 decodes and stores 16x more memory
than needed. Use `cacheWidth` / `cacheHeight` or `ResizeImage`. Flag any image load
without explicit cache sizing.

### 1e. Opacity widget over animated content

```bash
grep -rn "Opacity(" lib/ --include="*.dart" 2>/dev/null | grep -v "const \|// " | head -10
```

`Opacity` composites on the GPU every frame. If the opacity value changes (animations,
show/hide), use `AnimatedOpacity` or `FadeTransition` instead. If the opacity is static
(always 0.5), wrap with `RepaintBoundary` to isolate.

### 1f. ClipRRect / ClipPath on large surfaces

```bash
grep -rn "ClipRRect\|ClipPath\|ClipOval" lib/ --include="*.dart" 2>/dev/null | head -20
```

Clipping is expensive. `ClipRRect` on every list card with a border radius is a
common jank source. Use `BoxDecoration(borderRadius: ...)` instead — same visual
result, no clip.

---

## Step 2: Runtime profile analysis

This step requires manual interaction with Flutter DevTools. Provide the checklist:

DEVTOOLS PERFORMANCE CHECKLIST
═══════════════════════════════════════════════════════════

Setup:
[] App running in --profile mode (not --debug)
[] DevTools Performance tab open
[] "Record widget rebuilds" enabled (toggle in Performance tab)
[] "Track widget build stats" enabled

Recording a scroll:
[] Click Record
[] Scroll the primary feed/list for 10 seconds at normal speed
[] Scroll rapidly for 5 seconds
[] Click Stop

In the frame chart:
[] Identify frames > 16ms (red/orange in the frame chart)
[] Click the worst frames
[] Look at "Rebuild Stats" — which widgets rebuilt most?
[] Note: widget name + rebuild count + average build time

In the widget inspector:
[] Find the widgets with highest rebuild counts
[] Note their position in the tree (parent chain)
[] Check: is this widget getting setState from a parent unnecessarily?

Paste DevTools output here (or describe the highest-rebuild widgets):
═══════════════════════════════════════════════════════════

After the user provides DevTools findings (or describes the symptom), analyze and produce
targeted fixes in Step 3.

---

## Step 3: Targeted fixes

For each jank source identified (from static analysis or runtime profile), produce a
concrete fix. Use this format for each:

JANK FIX: {widget/file}
───────────────────────────────────────────────
Problem: {what is slow and why — specific numbers if available}
Frame budget impact: ~{N}ms per frame
Fix: {specific code change}
Expected improvement: {what the frame time should drop to}
Confidence: {HIGH/MEDIUM/LOW}

### Common fix templates

**ListView.builder migration:**
```dart
// Before (allocates all N children upfront):
ListView(
  children: items.map((item) => ItemWidget(item: item)).toList(),
)

// After (builds only visible items):
ListView.builder(
  itemCount: items.length,
  itemBuilder: (context, index) => ItemWidget(item: items[index]),
)
```

**const extraction:**
```dart
// Before (rebuilds on every parent setState):
Padding(
  padding: const EdgeInsets.all(16),
  child: Text("Static label"),
)

// After (never rebuilds — created once):
const Padding(
  padding: EdgeInsets.all(16),
  child: Text("Static label"),
)
```

**ClipRRect → BoxDecoration:**
```dart
// Before (triggers clip composite every frame):
ClipRRect(
  borderRadius: BorderRadius.circular(12),
  child: Image.network(url),
)

// After (decoration: no clip, same visual):
Container(
  decoration: BoxDecoration(
    borderRadius: BorderRadius.circular(12),
    image: DecorationImage(image: NetworkImage(url), fit: BoxFit.cover),
  ),
)
```

**Image caching:**
```dart
// Before (decodes full resolution into memory):
Image.network(imageUrl, width: 80, height: 80)

// After (decodes at display resolution):
Image.network(
  imageUrl,
  width: 80, height: 80,
  cacheWidth: 160, // 2x for retina
  cacheHeight: 160,
)
```

**RepaintBoundary for isolated animations:**
```dart
// Wrap any independently animating widget to prevent parent repaints:
RepaintBoundary(
  child: AnimatedWidget(...),
)
```

---

## Step 4: Output

After analysis and fixes:

JANK REMOVAL REPORT
═══════════════════════════════════════════════════════════

Branch: {branch}
Date: {date}

Static issues found: N
- N1 ListView without .builder (file:line)
- N2 non-const static widgets
- N3 image loads without cache sizing
- N4 ClipRRect over large surfaces

Runtime issues (from DevTools profile):
- {widget}: {rebuild count} rebuilds, avg {N}ms

Fixes applied: N
[AUTO-FIXED] lib/widgets/feed_list.dart — ListView → ListView.builder
[AUTO-FIXED] lib/screens/home.dart:42 — ClipRRect → BoxDecoration (8 instances)
[MANUAL REQUIRED] lib/widgets/story_card.dart — setState scope too broad, refactor needed

Frame budget impact:
Before: p99 frame time ~{N}ms
After (estimated): p99 frame time ~{N}ms
Target: <16ms (60fps) / <8.3ms (ProMotion 120fps)
═══════════════════════════════════════════════════════════

Commit auto-fixes: `git add -p && git commit -m "perf: eliminate jank sources in feed + card widgets"`

---

## Step 5: Completion

```bash
_TEL_END=$(date +%s)
_TEL_DUR=$(( _TEL_END - _TEL_START ))
~/.claude/skills/gstack/bin/gstack-timeline-log '{"skill":"jank-removal","event":"completed","branch":"'"$(git branch --show-current 2>/dev/null || echo unknown)"'","outcome":"OUTCOME","duration_s":"'"$_TEL_DUR"'","session":"'"$_SESSION_ID"'"}' 2>/dev/null || true
if [ "$_TEL" != "off" ]; then
echo '{"skill":"jank-removal","duration_s":"'"$_TEL_DUR"'","outcome":"OUTCOME","session":"'"$_SESSION_ID"'","ts":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}' >> ~/.gstack/analytics/skill-usage.jsonl 2>/dev/null || true
fi
```

Replace `OUTCOME` with `success`, `fail`, or `abort`.