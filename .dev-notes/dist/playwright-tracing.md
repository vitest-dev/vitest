# Playwright Tracing Findings

Playwright source in `~/code/others/playwright`

## `test.step` implementation

- `test.step` is implemented in `packages/playwright/src/common/testType.ts`.
- Wiring:
  - `test.step = this._step.bind(this, 'pass')`
  - `test.step.skip = this._step.bind(this, 'skip')`
- Core logic is in `TestTypeImpl._step(...)`.

## How `test.step` relates to tracing

- `test.step` creates a runner step via `testInfo._addStep(...)` and executes within `stepZone`.
- When a step starts/ends, `TestInfo` emits trace events through:
  - `appendBeforeActionForStep(...)`
  - `appendAfterActionForStep(...)`
- Those are recorded by `TestTracing` as trace `before/after` events with runner semantics (`class: 'Test'`, method = step category).

## `TestTracing` vs core `Tracing`

### `TestTracing` (`packages/playwright/src/worker/testTracing.ts`)

- Per-test, runner-owned trace stream (`origin: 'testRunner'`).
- Captures test-level semantics:
  - `test.step`, `expect` steps, hooks/fixtures
  - test errors
  - stdout/stderr
  - test attachments
- Applies retention policy (`on`, `retain-on-failure`, retries variants).
- Produces final `trace.zip` attached to test output.

### core `Tracing` (`packages/playwright-core/src/server/trace/recorder/tracing.ts`)

- Per-browser-context / API-request-context recorder (`origin: 'library'`).
- Captures Playwright protocol/library actions, network HAR entries, snapshots, screencast frames, and resources.
- Handles chunking (`startChunk/stopChunk`) and resource collection.

## How both streams are stitched together

- API call steps receive a `stepId` in client instrumentation.
- `stepId` flows through client metadata -> protocol -> server call metadata -> trace events.
- Trace model merges runner and library actions by shared `stepId`.
- Result: trace viewer shows unified timeline/tree with test semantics + low-level browser actions.

## Is `trace.TraceEvent` public API?

- Underlying event union is defined in `packages/trace/src/trace.ts`.
- This is imported internally via tsconfig path alias (`@trace/*`).
- It is not exported as a documented stable public API from npm package exports.
- Practical implication: treat trace JSON/event schema as internal/versioned contract (currently version 8), not guaranteed stable as public API.

## What Playwright Test adds over manual `context.tracing`

- Manual tracing API captures browser/library operations and network activity.
- Playwright Test tracing adds runner-level semantics and artifacts:
  - assertions / `expect` steps
  - test steps and hierarchy
  - hooks/fixtures
  - test-level errors, stdio, attachments
  - per-test retention behavior and automatic lifecycle management

## Snapshot recording: what triggers it

- Snapshots are triggered by instrumented API calls marked with `snapshot: true` in protocol metainfo.
- Snapshot capture happens in tracing instrumentation callbacks (`onBeforeCall`, `onBeforeInputAction`, `onAfterCall`) when enabled.
- `tracing.group()` / `tracing.groupEnd()` only create grouping structure; they do **not** directly trigger snapshots.
- There is no public API to explicitly "capture snapshot now".

## Assertion behavior in traces

- `expect(locator).toBeVisible()` becomes a protocol `Frame.expect` call via `locator._expect(...)`.
- `Frame.expect` is marked snapshot-eligible, so with `snapshots: true` it captures snapshots around that call.
- In Playwright Test, this is also represented as runner `expect` step and linked to library events through `stepId`.
- Non-locator assertions (pure JS value assertions) do not issue browser protocol calls, so they do not trigger library snapshots.

## Workaround for explicit-ish snapshot point

- Since there is no explicit snapshot API, perform a benign snapshot-eligible Playwright action while tracing is on.
- Examples:
  - `await page.locator('body').click({ position: { x: 1, y: 1 } });`
  - `await expect(page.locator('...')).toBeVisible();` (locator-based expect)

## Vitest integration direction (public API only)

- Current limitation in Vitest browser runner integration: traces depend heavily on user actions that hit snapshot-eligible Playwright APIs.
- `tracing.group()` / `tracing.groupEnd()` can improve structure/readability, but do not produce snapshots by themselves.
- Direction:
  - keep using `start/startChunk/stopChunk` for lifecycle and retention policy;
  - use `group/groupEnd` for semantic grouping only;
  - add explicit Vitest-level trace anchors ("marks") that intentionally execute a low-impact snapshot-eligible action to create deterministic snapshot points.
- Candidate anchor points:
  - before test body;
  - after test body;
  - around retries/repeats;
  - before teardown/failure artifact collection.
- Design goal: deterministic trace density and better debugging even when tests do not call interaction APIs (or only perform non-browser assertions).

## Should Playwright expose a public `tracing.mark(...)` API?

- Requesting this upstream is reasonable and aligns with real runner integration needs outside Playwright Test.
- Expected value:
  - deterministic, user-controlled trace checkpoints;
  - no need for synthetic user interactions as snapshot workaround;
  - portable semantics for frameworks that cannot rely on private Playwright internals.
- But implementation is not fully trivial:
  - API needs cross-language design parity (JS/TS, Python, Java, .NET);
  - behavior must be defined for browser contexts vs API request contexts;
  - semantics for `snapshot: true/false`, stack/location, and trace-viewer rendering need to be stable;
  - side-effect guarantees are important (mark should not mutate page state);
  - interaction with existing `group/groupEnd` and chunk boundaries should be specified.
- Practical complexity estimate:
  - API surface and docs: moderate;
  - protocol + server/client plumbing: moderate;
  - making it robust and backward-compatible across bindings/viewer: moderate-to-high.

### Minimal viable shape to propose

- Conceptual API:
  - `await context.tracing.mark(name, { snapshot?: boolean, location?: { file, line, column }, metadata?: Record<string, string> })`
- Recommended semantics:
  - always emits an explicit marker event visible in Trace Viewer;
  - optional `snapshot: true` captures a DOM snapshot at the mark point;
  - no user-visible page interaction side effects.

## Practical Vitest workaround today: snapshot poke action

- If only public Playwright API is available, the best low-impact snapshot anchor is:
  - `await page.evaluate(() => 0)`
- Rationale:
  - routes through `Frame.evaluateExpression`, which is snapshot-eligible in protocol metainfo;
  - typically no DOM mutation and minimal side effects;
  - avoids synthetic click/focus interactions that can trigger app handlers.
- Usage note:
  - ensure tracing started with `snapshots: true`;
  - perform after a page exists;
  - optionally wrap with `tracing.group()/groupEnd()` to label the anchor in the viewer.

Example:

```ts
await context.tracing.group('before assertion phase')
try {
  await page.evaluate(() => 0)
}
finally {
  await context.tracing.groupEnd()
}
```

Alternative (usually safe but less preferred):

- `await page.locator('html').isVisible()`
- `await page.content()`

Avoid as default workaround:

- synthetic click/tap-based pokes, because they may trigger handlers, focus changes, or scrolling.

## Vitest wrapper callsite in trace: approach matrix

Goal: show end-user test source location (not Vitest wrapper internals) for actions like wrapped `click`.

### 1) Preferred if available: explicit location option on API

- If the API supports `location` (for example `tracing.group(..., { location })`), pass the test callsite explicitly.
- Pros:
  - deterministic and clear;
  - no global runtime side effects.
- Cons:
  - only works on APIs that expose a location option;
  - does not help generic Playwright actions like `locator.click()` directly.

### 2) Internal Playwright mechanism: boxed stack prefixes

- Playwright filters stack frames using an internal prefix list (`setBoxedStackPrefixes(...)`).
- `@playwright/test` uses this internally to hide runner/framework frames.
- Idea for Vitest POC: register Vitest wrapper directories as boxed prefixes so Playwright selects the next user frame.
- Pros:
  - aligns with Playwright's own frame-filtering strategy;
  - works for ordinary actions (`locator.click`, etc.) without per-call metadata.
- Cons:
  - private/internal API (`playwright-core/lib/utils`), not stability-guaranteed;
  - may break on Playwright upgrades and across packaging variants.

#### Critical limitation for Vitest browser mode

- `setBoxedStackPrefixes(...)` only filters frames that are already present in the runtime stack where Playwright API call executes.
- In Vitest browser mode architecture, end-user test code frame and `locator.click()` execution can be in different runtimes.
- Therefore, end-user frames may not exist in Playwright-captured stack at all.
- Implication: boxed prefixes can hide wrapper/internal frames, but cannot recover or synthesize missing end-user frames.
- Conclusion for this architecture: boxed prefixes are not a complete solution for true end-user callsite attribution.

### 3) Global `Error.prepareStackTrace` interception

- Technically can influence stack formatting/parsing, but strongly discouraged.
- Risks:
  - global process-wide side effects;
  - interference with test runner/tooling;
  - async timing hazards and hard-to-debug behavior.
- Treat as experimental-only, not production approach.

### 4) Public API direction (upstream)

- A future `tracing.mark(...)` (or equivalent action-level location override) would provide stable explicit callsite/anchor semantics.
- This is the most maintainable long-term approach for non-Playwright-test runners.

## Recommendation for Vitest (today)

- Near-term POC: boxed stack prefixes may still improve noise, but are insufficient for true end-user callsite when runtimes are split.
- Medium-term: keep explicit trace anchors (`group` + snapshot poke) for deterministic snapshots.
- Long-term: propagate explicit user-runtime location metadata (where possible) and push upstream for stable public marker/callsite APIs.

## Appendix: Playwright snapshot format and Trace Viewer reconstruction

### Is this browser-native replay?

- No. Playwright does not use a browser-native "replay" artifact for trace snapshots.
- Snapshot capture/reconstruction is mostly Playwright-owned:
  - capture pipeline in injected script + server-side recorder;
  - custom serialized DOM/resource model in trace events;
  - Trace Viewer-side HTML reconstruction + post-processing script.

### Snapshot data model (what is stored)

- Trace event type: `frame-snapshot` with payload `FrameSnapshot`.
- Core fields include:
  - `callId`, `snapshotName`, `pageId`, `frameId`, `frameUrl`, `timestamp`, `viewport`, `doctype`;
  - `html: NodeSnapshot`;
  - `resourceOverrides`.
- `NodeSnapshot` is compact and incremental:
  - text node: string;
  - element subtree: tuple-like `[tagName, attrs?, ...children]`;
  - subtree reference: `[[deltaSnapshots, nodeIndex]]` (reuses node from prior snapshot).

### Capture pipeline (high level)

- `Tracing` decides when to capture (`before/input/after`) based on snapshot-eligible protocol metainfo.
- `Snapshotter` injects `frameSnapshotStreamer(...)` into pages and calls `captureSnapshot(...)` in each frame.
- Injected capture performs DOM traversal + state extraction, including:
  - shadow DOM encoding;
  - form values/checked/selected state;
  - scroll positions;
  - iframe linkage;
  - stylesheet/adopted stylesheet capture and CSS override tracking;
  - URL sanitization and security-related filtering.
- Resource/content blobs are stored in trace resources and referenced by sha1.

### Reconstruction in Trace Viewer

- Viewer loads snapshots/resources into `SnapshotStorage` and resolves by `(pageOrFrameId, snapshotName)`.
- `SnapshotRenderer` rebuilds HTML from `NodeSnapshot` recursively, resolving subtree references against earlier snapshots.
- Viewer serves reconstructed HTML via `/snapshot/...` and resources via `/sha1/...` or snapshot resource resolution (`SnapshotServer`).
- A post-load script then restores runtime-ish state in the rendered snapshot document:
  - input values, checked/selected state;
  - scroll offsets;
  - shadow roots/adopted stylesheets;
  - iframe nested snapshot URLs.
- Result: replay-like inspection, but it is deterministic reconstruction from recorded DOM + resources (not video replay).

### Action target highlighting in snapshots

- Highlighted "action element" is implemented via explicit metadata, not inferred visually.
- During action resolution/execution, Playwright marks matched target elements with current `callId` via injected events:
  - `__playwright_mark_target__` / `__playwright_unmark_target__`.
- Snapshot capture records this as element attribute `__playwright_target__` inside serialized DOM.
- Trace Viewer script finds nodes matching the relevant target id and applies outline/background highlight.

### Pointer/click marker

- Pointer dot comes from action metadata `point` (recorded on input/after action events), passed to snapshot URL params (`pointX`, `pointY`).
- Snapshot script renders pointer indicator; if target element exists and layout differs, viewer may center marker on target and annotate mismatch.

### Practical implication for Vitest

- What we can influence with public API today:
  - when snapshots get captured (through snapshot-eligible calls);
  - grouping/labels (`group/groupEnd`) for readability;
  - deterministic anchors (`page.mark` + low-impact snapshot poke).
- What we cannot directly control via stable public API:
  - direct custom injection of Playwright target-highlight metadata;
  - arbitrary explicit snapshot capture primitive separate from snapshot-eligible actions.

## Appendix: mark/target highlight API layering notes

Context for current draft (`group` + `mark`) in Playwright tracing recorder:

- `Tracing.group(...)` and `Tracing.mark(...)` are implemented in recorder layer and emit synthetic `before/after` action events with `class: 'Tracing'` and methods `tracingGroup` / `tracingMark`.
- `mark` currently supports optional `snapshot` + `location`, and captures `beforeSnapshot = mark@<callId>` when snapshotter is active.

### How action layer currently communicates with tracing/snapshot layer

- Communication is primarily via instrumentation callbacks + `CallMetadata`:
  - dispatcher emits `onBeforeCall` / `onAfterCall` around protocol calls;
  - DOM/frame action paths emit `onBeforeInputAction` for input phases;
  - recorder (`Tracing`) listens and writes trace events + triggers snapshot capture.
- Target highlighting uses a separate but coordinated path:
  - action/locator resolution in `frames.ts` / `dom.ts` calls injected `markTargetElements(..., callId)`;
  - injected script marks target nodes (`__playwright_target__ = callId`) via custom events;
  - snapshotter serializes those attributes into `frame-snapshot`;
  - viewer highlights nodes matching `[__playwright_target__="<callId>"]`.

### Implication for `tracing.mark(...)` API design

- Adding arbitrary metadata to mark events is straightforward via `BeforeActionTraceEvent.params` and will appear in Trace Viewer call details.
- But element highlight is not just event metadata:
  - passing `params.targetSelector` alone does not produce snapshot highlight;
  - highlight requires target marking in page/injected world before snapshot capture.
- Therefore, extending `context.tracing.mark(...)` with element targeting would couple tracing layer to DOM/action concerns (potential layering smell).

### Practical recommendation (current stance)

- Keep `context.tracing.mark(...)` minimal and timeline-oriented (name + optional snapshot + optional location).
- If highlight is desired, prefer one of:
  - action-layer API that already has selector/element resolution semantics;
  - a separate explicit API near page/locator domain, not in generic tracing surface.
- If upstream still wants mark-level highlight, it should be specified as best-effort and internally routed through existing `markTargetElements(..., callId)` pipeline, not solely as trace event params.

### Locator-level hook idea (future ask)

Vitest-specific context:

- Vitest browser-playwright commands already operate at locator level (e.g. `context.iframe.locator(selector).click(...)`), which naturally enters Playwright action instrumentation and trace pipeline.
- Additional Vitest need is assertion-timing anchors with selector context (not generic tracing marks).

Design direction:

- Keep `context.tracing.mark(...)` as a pure timeline primitive.
- Add a separate locator/page-level `mark` API for element-aware snapshots/highlight.
- This preserves layering: selector resolution and DOM marking stay in frame/locator domain.

Candidate API shapes (in increasing ambition):

1) Minimal locator anchor

- `await locator.mark({ name?: string, snapshot?: boolean })`
- Semantics:
  - resolve selector using strict locator path;
  - call existing injected `markTargetElements(new Set(elements), callId)`;
  - emit trace action event with optional title/name;
  - optionally capture snapshot at this anchor.

2) Page/frame selector anchor

- `await page.mark(selector, { strict?: boolean, name?: string, snapshot?: boolean })`
- Same internals, but string-selector entry point for non-locator ecosystems.

3) Assertion-integrated anchor (runner/internal)

- Reuse expect path (`Frame.expect`-style internals) to anchor around assertion attempts/failures.
- Useful for tools like Vitest that already hold selector + matcher context.
- This can remain internal/private API if public surface is undesirable.

Expected behavior contract

- Best effort only: if target resolution fails, still record timeline action; skip highlight.
- No persistent DOM side effects beyond transient mark attributes used for snapshot serialization.
- Use existing `callId` correlation so viewer works without new snapshot schema.

Why this is preferable to `tracing.mark({ target })`

- Avoids pulling selector/element semantics into context-tracing API.
- Reuses mature locator/action code paths that already handle strictness, frame targeting, and mark-to-snapshot plumbing.
- Aligns with Vitest architecture where browser commands originate from locator-level operations.

Near-term Vitest workaround (without new Playwright API)

- Continue using `page.mark` for generic timeline points.
- For selector-aware anchors, trigger a low-impact locator call that goes through selector resolution paths that invoke `markTargetElements` (careful per-method behavior), then pair with mark/group as needed.

## Appendix: `Frame.expect` / `locator._expect` mechanics

### How assertions connect to trace/snapshot

- Playwright assertions are wired through protocol action `Frame.expect`, not directly through snapshotter calls inside matcher code.
- High-level matcher flow:
  - `expect(locator).toX(...)` in `playwright/src/matchers/matchers.ts` calls `locator._expect('<expression>', options)`.
  - `locator._expect(...)` forwards `{ selector: this._selector, ... }` to `frame._expect(...)`.
  - client `frame._expect(...)` sends protocol `Frame.expect`.
  - server dispatcher calls `frame.expect(progress, selector, options)`.
- Since `Frame.expect` is a regular instrumented protocol call and metainfo marks it as `snapshot: true`, tracing captures snapshots naturally via `onBeforeCall/onAfterCall` instrumentation path.

### Is `Frame.expect` selector-aware?

- Yes. `Frame.expect` receives selector and resolves it in frame context.
- Inside `_expectInternal`, server code evaluates injected script with selector info and current `callId`.
- It explicitly calls `injected.markTargetElements(new Set(elements), callId)` before running expectation logic.
- This is why snapshots can highlight target elements for expect steps.

### What `expression` looks like

- `expression` is an internal matcher opcode string consumed by injected expect engine.
- Common values include:
  - `to.be.visible`, `to.be.hidden`, `to.be.checked`, `to.be.attached`;
  - `to.have.text`, `to.have.text.array`, `to.contain.text.array`;
  - `to.have.attribute`, `to.have.attribute.value`, `to.have.css`, `to.have.count`;
  - `to.have.value`, `to.have.values`, `to.have.title`, `to.have.url`, `to.match.aria`.

### Workaround potential for Vitest

- Technical workaround: call `locator._expect(...)` from Vitest to trigger:
  - selector resolution + target marking;
  - snapshot-eligible `Frame.expect` action;
  - natural trace entry with highlight.
- Trade-off: `_expect` is private/internal API (underscore) and not a stable public contract.
- Recommendation: treat `_expect`-based integration as a pragmatic short-term workaround only; keep pursuing public API shape for long-term stability.

### Concrete short-term workaround shape

- Goal: create selector-aware trace anchor with highlight, while preserving custom Vitest mark title/location.
- Suggested sequence:
  1. `context.tracing.group(name, { location })`
  2. `await (context.iframe.locator(selector) as any)._expect('to.be.attached', { isNot: false, timeout: 1 })`
  3. `context.tracing.groupEnd()` in `finally`
- Why this works:
  - `_expect` routes to `Frame.expect` (snapshot-enabled action);
  - server `Frame.expect` resolves selector and calls `markTargetElements(..., callId)`;
  - trace snapshot captures target metadata; viewer highlights target.
- Safety notes:
  - wrap in `try/catch/finally` so trace anchoring never changes test result;
  - feature-detect `_expect` and fallback to existing no-op snapshot poke if missing;
  - treat this as temporary due to private API status.
  - use test iframe locator (`context.iframe.locator`) rather than top-level page locator.
  - avoid `timeout: 0` for this internal anchor call (`0` means no timeout in Playwright); use a tiny bounded timeout (e.g. `1`).

### Validation note (important)

- Manual validation shows this iframe `locator._expect('to.be.attached', { timeout: 1 })` approach already produces the exact desired trace-view UX (snapshot timing + target highlight).
- Conclusion: Playwright tracing internals are already sufficient; the main gap is public API surface/stability for this pattern.

## Appendix: upstream RFC draft (Playwright)

### Title

`[Feature]: Custom tracing marker API with selector and snapshot`

### 🚀 Feature Request

A public API on `page` and `locator` for inserting custom markers into Playwright traces, with optional DOM snapshot capture and selector-aware element highlighting.

```ts
await page.mark(name, { snapshot?, location? })
await locator.mark(name, { snapshot?, location? })
```

- `page.mark(name)` — inserts a named timeline marker visible in Trace Viewer, with optional snapshot capture.
- `locator.mark(name)` — same, but also resolves the locator's selector and highlights the target element in the snapshot. This is the same highlight behavior that `expect(locator)` assertions already produce internally.

### Example

```ts
// page-level marker (snapshot, no element highlight)
await page.mark('before assertion phase', {
  location: { file: testFile, line: 42 },
  snapshot: true,
})

// locator-level marker (snapshot with element highlight)
await page.locator('#submit-button').mark('assertion target', {
  snapshot: true,
})
```

### Motivation (short version)

We are enhancing Playwright trace support in Vitest browser mode (in https://github.com/vitest-dev/vitest/pull/9652). There is currently no stable way to insert custom trace markers with snapshots or element highlighting. Our workarounds today:

```ts
// page.mark workaround — snapshot without element highlight
await context.tracing.group(name, { location })
await page.evaluate(() => 0)
await context.tracing.groupEnd()

// locator.mark workaround — snapshot with element highlight (private API)
await context.tracing.group(name, { location })
await (locator as any)._expect('to.be.attached', { isNot: false, timeout: 1 })
await context.tracing.groupEnd()
```

The `page.evaluate(() => 0)` workaround is a no-op just to trigger a snapshot-eligible action, and `locator._expect(...)` is a private API that may break across versions.

Public `page.mark()` / `locator.mark()` APIs would make this a stable, first-class capability for the broader Playwright ecosystem. We are happy to help prototype or test any proposed API shape.

### Motivation (detailed)

Third-party test runners that use Playwright's library tracing can produce rich traces today, but there is no stable public API for inserting custom markers with snapshot capture or selector-aware element highlighting.

Playwright internals already support the needed behavior — snapshot capture around instrumented protocol calls, and target element highlighting via the existing mark-target pipeline. We validated that calling internal expect APIs from an iframe context produces the exact desired Trace Viewer output (timeline entry, snapshot, element highlight). The main gap is a stable public API surface for this pattern.

Our current workaround depends on the private `locator._expect(...)` API, which may change without notice across Playwright versions. Public `page.mark()` / `locator.mark()` APIs would:

- Let external runners insert named trace markers with snapshots without side-effect-laden workarounds.
- Enable selector-aware snapshot points with element highlighting through stable, documented APIs.
- Benefit the broader Playwright ecosystem beyond `@playwright/test`.

We treat our current workaround as a stopgap and will migrate to public APIs once available. We are happy to help prototype or test any proposed API shape.

## Appendix: upstream bug report draft (`sources` + `group location`)

### Proposed issue title

- Tracing source packaging misses files referenced by `tracing.group({ location })` when using `tracing.start({ sources: true })`

### Problem statement

- With library tracing (`context.tracing`), `start({ sources: true })` does not always include source files for stack locations emitted by tracing APIs.
- In particular, locations provided via `tracing.group(name, { location })` can appear in trace event stacks, but corresponding `resources/src@<sha1>.txt` entries may be missing from the final trace zip.

### Why this is user-visible

- Local `playwright show-trace` appears to work because Source tab falls back to local `file?path=...` endpoint.
- Hosted `https://trace.playwright.dev` cannot read local filesystem and therefore only shows sources present in archive resources.
- Result: same trace can show source locally but not in hosted viewer.

### Minimal repro outline

1. `await context.tracing.start({ snapshots: true, sources: true })`
2. `await context.tracing.startChunk({ title: 'repro' })`
3. `await context.tracing.group('anchor', { location: { file: '/abs/path/to/test.ts', line: 10, column: 1 } })`
4. optional low-impact snapshot action (e.g. `await page.evaluate(() => 0)`)
5. `await context.tracing.groupEnd()`
6. `await context.tracing.stopChunk({ path: 'trace.zip' })`
7. open in `https://trace.playwright.dev` and inspect Source tab for group action

Expected:

- source for `/abs/path/to/test.ts` is available from bundled `resources/src@...`.

Actual:

- location is visible in stack, but source may be unavailable unless local-file fallback exists.

### Suspected root cause

- Source inclusion for `start({ sources: true })` is implemented in local zip step (`localUtils.zip`) by collecting files from `stackSession.callStacks`.
- `group` locations are written into trace events, but do not necessarily feed `stackSession.callStacks` source collection.
- Therefore event-stack file paths and packaged source-file set can diverge.

## Appendix: solution ideas (upstream)

### Option A: targeted fix (smallest)

- When processing `tracing.group` with `location.file`, register that file path in the same source-file collector used by `includeSources`.
- Pros: minimal behavioral change, small patch, direct bug fix.
- Cons: adds one more special path into collector plumbing.

### Option B: packaging robustness fix

- During zip with `includeSources`, also collect source paths from trace event stacks (including synthetic tracing actions like group), not only `stackSession.callStacks`.
- Pros: resilient to future tracing actions carrying explicit locations.
- Cons: extra parsing/plumbing; should dedupe and avoid perf regressions.

### Option C: instrumentation unification (larger)

- Route `group` through the same client-side stack capture/instrumentation channel as ordinary API calls, so one source collector naturally covers all.
- Pros: cleaner architecture long-term.
- Cons: bigger refactor with higher risk.

### Recommended upstream path

- Start with Option A for quick correctness fix.
- Consider Option B afterward for defense-in-depth and future-proofing.

## Appendix: Why `show-trace` shows source but `trace.playwright.dev` does not

Observed behavior:

- Local CLI viewer (`pnpm exec playwright show-trace ...`) can show user source files even when they are not inside the trace zip.
- Hosted PWA viewer (`https://trace.playwright.dev`) only shows sources that are actually embedded in the trace archive.

### Source loading path in Trace Viewer UI

In `packages/trace-viewer/src/ui/sourceTab.tsx`, source loading is:

1. Try embedded source first:

- fetch `sha1/src@<sha1(filePath)>.txt` from trace resources.

2. If missing (404), fallback to host file endpoint:

- fetch `file?path=<absolute-file-path>`.

So the viewer itself has a two-step strategy: bundled source first, local file fallback second.

### What `show-trace` provides that hosted viewer cannot

`show-trace` starts a local HTTP server (`packages/playwright-core/src/server/trace/viewer/traceViewer.ts`) with a `/trace/file?path=...` route that reads from local disk via Node `fs`.

That means local viewer can resolve source content directly from your machine when `resources/src@...` is missing.

`trace.playwright.dev` runs as a PWA/service-worker app and does not have a Node file-serving endpoint for your local filesystem. It can only read what is in the uploaded trace blob (`.trace/.network/resources/*`).

### Why user TS source can still be absent from zip with `sources: true`

Even when tracing is started with `sources: true`, source embedding is driven by Playwright's stack-session zip step (`localUtils.zip`), which collects files only from `stackSession.callStacks` and writes them as `resources/src@<sha1>.txt`.

Important limitation:

- This collection does **not** scan all stack file paths present in trace events.
- In particular, explicit location stacks injected via APIs like `tracing.group(..., { location })` can appear in trace event `stack`, yet not be included in `stackSession.callStacks` source collection.

Net effect:

- Local `show-trace`: still shows these files through `/trace/file` fallback.
- Hosted `trace.playwright.dev`: cannot load them unless `resources/src@...` exists in the zip.

### Practical conclusion for Vitest traces

For portable traces (especially when sharing to `trace.playwright.dev`), we must ensure needed source files are truly embedded in `resources/src@...` and not rely on local-file fallback behavior of `show-trace`.

## Appendix: `test.step({ location })` vs `_stackSessions`

Question checked: if `test.step` allows explicit `location`, does that location flow into `_stackSessions` (same channel used by library tracing source packaging)?

Answer:

- No, it does not flow into `_stackSessions`.
- `_stackSessions` is populated from client protocol call metadata in `playwright-core` (`Connection.sendMessageToServer` -> `LocalUtils.addStackToTracingNoReply`), i.e. ordinary library API call stacks.
- `test.step` is runner-level (`playwright` package), not that protocol-call path.

Why `test.step({ location })` still works for source embedding:

- `test.step` stores explicit location on step creation (`testType._step(..., options.location)`).
- Runner trace emission writes this as event stack directly: `stack: step.location ? [step.location] : []` in `TestInfo._addStep` -> `TestTracing.appendBeforeActionForStep`.
- Runner trace packaging with `sources: true` scans `before` event stacks and embeds `resources/src@<sha1>.txt` from those files.

Implication:

- For Playwright Test traces, custom `test.step` location is source-portable even without `_stackSessions`.
- For library `context.tracing` traces, `group({ location })` can still diverge from `_stackSessions` source collection unless fixed in library tracing path.

## Appendix: `locator.describe(...)` assessment for Vitest use case

Context: follow-up after upstream response in https://github.com/microsoft/playwright/issues/39308#issuecomment-3921247838.

### What `locator.describe(...)` actually does

- Implemented in client locator layer (`playwright-core/src/client/locator.ts`) as selector rewriting:
  - `describe(description)` returns a new locator with ` >> internal:describe=<json-string>` appended.
  - `description()` extracts this trailing custom description.
- `internal:describe` is a built-in selector engine (`injectedScript.ts`) whose `queryAll` returns the current root element unchanged.
  - Practically: it is selector metadata, not an action.
  - It does not change which element is targeted.
- Trace Viewer action list renders selector labels via `asLocatorDescription(...)` (`trace-viewer/src/ui/actionList.tsx`).
  - If selector tail is `internal:describe`, the description string is shown instead of generated locator text.
- Docs/release notes position it as trace viewer/report readability feature (v1.53), not tracing control primitive.

### What it helps with

- Better human-readable locator label in Trace Viewer and reports for events carrying `params.selector`.
- Useful to replace noisy generated selector text with domain wording (e.g. "Subscribe button").

### What it does **not** solve for our `mark` use case

- No explicit timeline marker event (unlike our `page/locator.mark` wrapper).
- No deterministic snapshot anchor by itself.
- No stack/callsite/source-location override; stack metadata still comes from normal API call capture.
- No page-level equivalent (`page.describe(...)` is not the feature).

### Semantics detail that matters

- Description is only recognized when `internal:describe` is the trailing selector part.
- If further chained, custom description does not automatically propagate to the new locator unless re-applied (matches existing tests).

### Practical conclusion for Vitest

- `locator.describe(...)` is a good readability improvement and likely worth optional adoption where we already have semantic names.
- It is not a replacement for `page/locator.mark(...)` in Vitest:
  - we still need explicit marker primitives for deterministic anchoring,
  - and we still need our location-aware mark path for source-linking behavior.
