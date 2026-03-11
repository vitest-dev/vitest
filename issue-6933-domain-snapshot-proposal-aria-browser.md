# ARIA snapshots with `expect.poll` retry — design plan

Scope: `expect.element(locator).toMatchAriaSnapshot()` and the general question of `expect.poll` + snapshot semantics.

## The general problem: `expect.poll` + snapshots

`expect.poll()` retries a callback + matcher until pass or timeout. This works for stateless matchers (`toEqual`, `toHaveTextContent`) because each retry is idempotent.

Snapshot matchers are stateful. Each call to `matchDomain()` / `match()`:
- Increments the snapshot key counter
- Records inline snapshot entries for source rewriting
- Mutates `SnapshotState` stats (added/matched/updated counts)

Blindly retrying any snapshot matcher inside `expect.poll()` corrupts snapshot state. This is why `expect.poll()` explicitly blocks regular snapshot matchers (`toMatchSnapshot`, `toMatchInlineSnapshot`, etc.) in its `unsupported` list (see `packages/vitest/src/integrations/chai/poll.ts` lines 8-27).

Vitest already handles `toMatchScreenshot` specifically — `_poll.assert_once` disables retry and the real stability logic lives in a server-side command. But that sidestepped the problem rather than solving it. The assertion never actually retries; the server does.

ARIA snapshots force the real confrontation: the capture+match is client-side, there's no server escape hatch, and the retry loop must re-read DOM state each iteration while keeping snapshot state mutation to exactly once. This makes ARIA the right vehicle for working out poll + snapshot from first principles.

We implement this as ARIA-specific, but the design should naturally yield the general pattern: **separate the stateless probe (retried) from the stateful commit (once)**. If a second domain snapshot matcher needs poll support, the retry shape is already proven — no premature abstraction needed, but no artificial walls either.

## Reference: how existing matchers handle this

### Vitest `toMatchScreenshot`

Uses the `_poll.assert_once` flag pattern:

1. `expect.element()` wraps in `expect.poll()` — retries `locator.query()` until element exists.
2. When `toMatchScreenshot` is the matcher name, `expect-element.ts` sets `_poll.assert_once = true`.
3. `expect.poll()` checks this flag (line 120): if the assertion phase fails, stop immediately instead of retrying.
4. Result: element resolution is retried, but the screenshot assertion runs exactly once.
5. The screenshot command itself (`__vitest_screenshotMatcher`) has its own stability logic on the node side (takes multiple screenshots, compares for stability).

This works for screenshots because they have server-side retry. But for ARIA snapshots, we want client-side retry of the capture+match cycle (DOM may still be rendering).

### Playwright `toMatchAriaSnapshot`

Source: `~/code/others/playwright/packages/playwright/src/matchers/toMatchAriaSnapshot.ts` and `frames.ts`.

1. **Snapshot read once**: loads the snapshot file at matcher initialization, before retry.
2. **Retry with escalating delays**: uses `retryWithProgressAndTimeouts()` with delays `[100, 250, 500, 1000]` (prepends 0 for immediate first attempt).
3. **Each retry**: re-resolves the selector, generates a FRESH aria tree via `generateAriaTree()` in the browser, matches against the fixed template. Browser-side code is completely stateless between retries.
4. **First run (no snapshot)**: captures the aria tree, writes the snapshot file, and the test **passes** (unlike `toHaveScreenshot` which requires stability). No retry needed — just waits for the element to exist.
5. **Existing snapshot**: retries capture+match until the template matches or timeout. The expected template is fixed; only the received ARIA tree changes.
6. **No state corruption**: snapshot file is read once at start, written once after the loop settles. The retry loop only runs stateless capture+match operations.

Key difference from screenshots: Playwright's ARIA retry returns on the first successful match — no "two consecutive identical captures" stability check. This is a design choice, not a consequence of determinism. The ARIA tree can change between retries (e.g. a partial render might match the template, then more content appears). Playwright simply accepts the first match.

## First principles: `poll(() => thing)` + snapshot

Forget implementation. What should the semantics be for each snapshot update mode?

### `update: "new"` — no existing snapshot

Generate from first successful `thing`. No retry — there's nothing to compare against. Wait for `thing` to resolve (non-null, no error), capture, commit.

### `update: "none"` — compare against existing snapshot

Retry until `format(thing)` matches stored snapshot, or timeout. This is the core value of poll + snapshot — the DOM is settling, keep probing until it stabilizes into the expected shape.

### `update: "all"` — overwrite snapshot

Works like `"new"`: first successful `thing` → capture → overwrite. No retry.

The alternative — retry until match, then update — doesn't work:
- If it matched, there's nothing to update.
- If it never matched (full timeout), you write whatever the last state was, but you waited the full timeout for nothing.
- `--update` is a batch operation users run to refresh snapshots. Making every assertion wait for its timeout would be painfully slow and `--update` becomes unusable.

### Summary

| Mode | Retry? | Behavior |
|------|--------|----------|
| `"new"` (no snapshot) | No | First successful `thing` → create |
| `"none"` (compare) | Yes | Retry until match or timeout |
| `"all"` (update) | No | First successful `thing` → overwrite |

Retry only happens when there's an existing snapshot to compare against AND we're not in update mode.

### Domain snapshot nuance: `mergedExpected`

For domain snapshots with semantic patterns (regex, wildcards), `update: "all"` uses `mergedExpected` from the adapter — preserving matched patterns while replacing mismatched literals. But the retry question is the same: no retry, capture once, commit.

## API forms

### Without retry (`expect()`)

```ts
// Any environment: jsdom, happy-dom, or browser mode
expect(document.querySelector('nav')).toMatchAriaSnapshot()
expect('<button>Save</button>').toMatchAriaInlineSnapshot(`
  - button: Save
`)
```

Already works. Synchronous. Adapter `capture()` accepts `Element` or HTML string.

### With retry (`expect.element()`)

```ts
// Wraps in retry loop — typically used in browser mode
await expect.element(page.getByRole('main')).toMatchAriaSnapshot()
await expect.element(page.getByRole('main')).toMatchAriaInlineSnapshot(`
  - main:
    - heading [level=1]: Dashboard
`)
```

`expect.element()` is a retry wrapper. The locator is re-queried on each iteration. This is the integration point that needs special handling — snapshot state must only be mutated once.

## Solution: Snapshot matchers own their retry loop

Snapshot matchers do NOT use `expect.poll()`'s generic retry. Instead, when a locator is detected, the matcher runs its own retry loop that separates capture+match (retried) from snapshot state mutation (once).

This matches Playwright's model — `toMatchAriaSnapshot` has its own retry internally, separate from the general assertion retry mechanism.

### Why not `_poll.assert_once` (the `toMatchScreenshot` pattern)?

`_poll.assert_once` runs the assertion exactly once after element resolution. This is insufficient for ARIA because:

- The element may exist but its subtree may still be rendering (React async, Suspense, etc.)
- The ARIA tree should stabilize within the timeout
- Retrying capture+match provides flakiness robustness — same as Playwright's approach

`toMatchScreenshot` can use `_poll.assert_once` because its server-side command has its own stability logic. ARIA matching runs entirely client-side, so the matcher itself must retry.

### Retry flow

```
// Decide phase (once, before retry):
existingSnapshot = snapshotState.getSnapshot(key)
shouldRetry = existingSnapshot != null && updateMode !== 'all'

if shouldRetry:
  parsedExpected = adapter.parseExpected(existingSnapshot)

  // Retry phase (repeated until pass or timeout):
  loop:
    element = locator.query()
    if element:
      captured = adapter.capture(element)
      result = adapter.match(captured, parsedExpected)
      if result.pass → break
    if timeout → break
    sleep(interval) → loop
else:
  // No retry — wait for first successful element only
  element = await locator.waitFor()
  captured = adapter.capture(element)

// Commit phase (once):
rendered = adapter.render(captured)
snapshotState.matchDomain({
  received: rendered,
  isEqual: () => lastResult,
  ...
})
```

Key properties:
- `matchDomain()` is called exactly once regardless of retry iterations.
- Retry only happens when comparing against an existing snapshot (not on create or update).
- On `update: "all"` or first run: capture once from first available element, commit immediately.

## Detection: retry or not?

`expect.element()` already stores flags on the assertion object:
- `_poll.element = true` — identifies element-based polling
- Poll options (timeout, interval) are available via `processTimeoutOptions()`
- `kLocator = Symbol.for('$$vitest:locator')` already identifies locator objects

We additionally store the raw locator on the assertion:

```ts
// In expect-element.ts
chai.util.flag(expectation, '_locator', elementOrLocator)
chai.util.flag(expectation, '_pollOptions', { timeout, interval })
```

The snapshot matcher reads these flags to decide behavior:

| Entry point | Detection | Behavior |
|-------------|-----------|----------|
| `expect(value)` | No `_locator` flag | Synchronous `assertDomain()` |
| `expect.element(locator)` | `_locator` flag, value is Locator | Async retry loop, single `matchDomain()` |
| `expect.element(element)` | `_locator` flag, value is Element | Synchronous `assertDomain()` |

## Implementation

### `expect.element()`: store locator reference and set `_poll.assert_once`

In `packages/browser/src/client/tester/expect-element.ts`:

```ts
// Store locator for snapshot matchers to use directly
chai.util.flag(expectation, '_locator', elementOrLocator)
chai.util.flag(expectation, '_pollOptions', processTimeoutOptions(options))
```

Also add `toMatchAriaSnapshot` and `toMatchAriaInlineSnapshot` to the `_poll.assert_once` check alongside `toMatchScreenshot`:

```ts
if (['toMatchScreenshot', 'toMatchAriaSnapshot', 'toMatchAriaInlineSnapshot'].includes(name)
  && !chai.util.flag(this, '_poll.assert_once')) {
  chai.util.flag(this, '_poll.assert_once', true)
}
```

This ensures that if the snapshot matcher's own retry succeeds, `expect.poll()` doesn't try to re-run it. And if the snapshot matcher fails after its own retry, `expect.poll()` stops immediately rather than retrying.

### Matcher: detect locator and branch

In `packages/vitest/src/integrations/snapshot/chai.ts`, the `toMatchAriaSnapshot` matcher:

```ts
function toMatchAriaSnapshot(this) {
  const locator = utils.flag(this, '_locator')
  const kLocator = Symbol.for('$$vitest:locator')

  if (locator && typeof locator === 'object' && kLocator in locator) {
    // Browser mode with locator — async retry path
    return retryAriaSnapshot({
      locator,
      adapter: ariaDomainAdapter,
      pollOptions: utils.flag(this, '_pollOptions'),
      snapshotClient: getSnapshotClient(),
      ...getTestNames(test),
    })
  }

  // Synchronous path (jsdom, raw element, HTML string)
  const received = utils.flag(this, 'object')
  getSnapshotClient().assertDomain({
    received,
    adapter: ariaDomainAdapter,
    isInline: false,
    ...getTestNames(test),
  })
}
```

### `retryAriaSnapshot` function

```ts
async function retryAriaSnapshot(options) {
  const {
    locator,
    adapter,
    snapshotClient,
    pollOptions,
    testName,
    filepath,
    ...rest
  } = options
  const { timeout = 1000, interval = 50 } = pollOptions ?? {}
  const deadline = Date.now() + timeout

  const context = { filepath, name: testName, testId: rest.testId }

  // Read existing snapshot (if any) and parse once — same as Playwright
  const snapshotState = snapshotClient.snapshotState
  const key = snapshotClient.getSnapshotKey(rest)
  const existingSnapshot = snapshotState.getSnapshot(key)
  const parsedExpected = existingSnapshot
    ? adapter.parseExpected(existingSnapshot, context)
    : null

  let lastCaptured, lastRendered, lastResult

  // Retry phase: capture + match, no state mutation
  while (true) {
    const element = locator.query()
    if (element) {
      lastCaptured = adapter.capture(element, context)
      lastRendered = adapter.render(lastCaptured, context)

      if (parsedExpected) {
        lastResult = adapter.match(lastCaptured, parsedExpected, context)
        if (lastResult.pass) { break }
      }
      else {
        // First run — no snapshot to compare, will create
        break
      }
    }

    if (Date.now() >= deadline) { break }
    await new Promise(r => setTimeout(r, interval))
  }

  // Commit phase: single matchDomain call
  snapshotClient.assertDomain({
    received: lastCaptured
      ? utils.flag(this, 'object') // use last resolved element
      : locator.element(), // force resolve for error message
    adapter,
    isInline: false,
    ...rest,
    // Pass pre-computed result to avoid double capture
    _precomputed: lastResult
      ? { captured: lastCaptured, rendered: lastRendered, result: lastResult }
      : undefined,
  })
}
```

### `assertDomain`: accept precomputed result

Extend `assertDomain` to accept an optional `_precomputed` field. When present, skip `capture()` and `render()` — use the precomputed values directly. This avoids re-reading the DOM after the retry loop (element may have changed again).

```ts
assertDomain(options) {
  const { _precomputed, adapter, received, ...rest } = options
  const context = { filepath, name, testId }

  let captured, rendered
  if (_precomputed) {
    captured = _precomputed.captured
    rendered = _precomputed.rendered
  }
  else {
    captured = adapter.capture(received, context)
    rendered = adapter.render(captured, context)
  }

  snapshotState.matchDomain({
    received: rendered,
    isEqual: (existingSnapshot) => {
      if (_precomputed?.result) return _precomputed.result
      const parsed = adapter.parseExpected(existingSnapshot, context)
      return adapter.match(captured, parsed, context)
    },
    ...rest,
  })
}
```

### Inline variant

`toMatchAriaInlineSnapshot` follows the same pattern. One subtlety: the `Error` for stack trace (used to locate the inline snapshot in source for rewriting) must be captured at the call site, before the retry loop starts.

```ts
function toMatchAriaInlineSnapshot(this, inlineSnapshot?: string) {
  const error = utils.flag(this, 'error') || new Error('snapshot')
  const locator = utils.flag(this, '_locator')
  const kLocator = Symbol.for('$$vitest:locator')

  if (locator && typeof locator === 'object' && kLocator in locator) {
    return retryAriaSnapshot({
      ...commonOptions,
      isInline: true,
      inlineSnapshot,
      error, // captured before retry loop
    })
  }

  // Synchronous path
  getSnapshotClient().assertDomain({
    received: utils.flag(this, 'object'),
    adapter: ariaDomainAdapter,
    isInline: true,
    inlineSnapshot,
    error,
    ...getTestNames(test),
  })
}
```

### `_isLastPollAttempt` optimization

Browser mode uses a `_isLastPollAttempt` flag to avoid expensive `prettyDOM()` on non-final retries. The ARIA retry loop gets this for free — `locator.query()` is cheap (no error generation), and `locator.element()` is only called if the element was never found.

## Timeout and configuration

### Defaults

Use the same defaults as `expect.element()`:
- `timeout`: 1000ms (from `config.expect.poll.timeout` if set)
- `interval`: 50ms (from `config.expect.poll.interval` if set)

Users configure via `expect.element()` options:
```ts
await expect.element(loc, { timeout: 5000 }).toMatchAriaSnapshot()
```

The poll options are already stored on the assertion by `expect.element()`.

### Failure message on timeout

When the retry loop exhausts without a match, the failure message includes:
- The last captured ARIA tree (actual)
- The expected template (from snapshot)
- Standard snapshot diff format

This is the `DomainMatchResult.actual` / `expected` from the last `adapter.match()` call — no extra work needed.

## Edge cases

### Element never appears

If `locator.query()` returns `null` for every retry iteration, `lastCaptured` is never set. The commit phase falls through to the synchronous `assertDomain` path with `locator.element()`, which throws a locator-not-found error with a detailed message.

### Element appears then disappears

The retry loop captures the last successful state. If the element disappears on a later iteration, `locator.query()` returns null and we skip that iteration. The last valid capture is used for the final comparison.

### `.not` (negation)

Reject for now — same as non-browser path. `toMatchAriaSnapshot` cannot be used with `.not`. Rationale: "wait for ARIA tree to NOT match" is a valid but complex use case (what does updating mean?). Defer to follow-up.

### Concurrent snapshots

Multiple `await expect.element(...)` calls in the same test are sequential (each `await` blocks). No concurrent mutation of snapshot state.

### `--update` mode

No retry. Captures from first available element and overwrites (using `mergedExpected` for domain snapshots to preserve patterns). See "First principles" section.

## File changes

| File | Change |
|------|--------|
| `packages/browser/src/client/tester/expect-element.ts` | Store `_locator` and `_pollOptions` flags; add aria matchers to `_poll.assert_once` |
| `packages/vitest/src/integrations/snapshot/chai.ts` | Branch on `_locator` in aria matchers, add `retryAriaSnapshot` |
| `packages/snapshot/src/client.ts` | Accept `_precomputed` in `assertDomain` |
| `packages/snapshot/src/types/index.ts` | Add `_precomputed` to `AssertDomainOptions` |
| `test/browser/` | Add browser-mode ARIA snapshot tests |

## Deferred

- **`.not` support** — negated snapshot matching with retry
- **Cross-provider testing** — validate with both Playwright and WebDriverIO browser providers
- **`expect.poll()` integration** — teach `expect.poll()` to handle snapshot matchers generically (rather than per-matcher custom retry). Only worth it if more domain snapshot matchers emerge.
