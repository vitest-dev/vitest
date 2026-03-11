# `expect.poll` + snapshot — design document

Scope: What does it mean to combine polling/retry with snapshot assertions?

## Status quo

`expect.poll()` retries a callback + matcher until pass or timeout. Works for stateless matchers (`toEqual`, `toHaveTextContent`) because each retry is idempotent.

Snapshot matchers are stateful. Each invocation of `SnapshotState.match()` / `matchDomain()`:
- Increments the snapshot key counter
- Records inline snapshot entries for source rewriting
- Mutates stats (added/matched/updated counts)

Today `expect.poll()` explicitly blocks all snapshot matchers in its `unsupported` list. The stated reason: "snapshots will always succeed as long as the poll method doesn't throw an error."

`toMatchScreenshot` sidesteps this — `_poll.assert_once` disables retry at the `expect.poll` level, and the real stability logic lives in a server-side command. The assertion itself never retries.

## The question

```ts
await expect.poll(() => thing).toMatchSnapshot()
```

What should this mean?

## First principles

`poll(() => thing)` produces a value that changes over time. A snapshot records a known-good value. The combination means: **keep probing `thing` until it matches the known-good snapshot, or timeout.**

But "matches the snapshot" depends on whether a snapshot exists and what the update mode is.

### `update: "new"` — no existing snapshot

Nothing to compare against. Retry `poll()` until it succeeds (value becomes available), capture, commit as the new snapshot.

No *match* retry needed — there is no expected value to retry toward. But `poll()` itself may need retries.

### `update: "none"` — compare against existing snapshot

Retry until `serialize(thing)` matches stored snapshot, or timeout.

This is the core value proposition. The polled value is settling (DOM rendering, async state, etc.) and we keep probing until it stabilizes into the expected shape.

### `update: "all"` — overwrite snapshot

Works like `"new"`: first successful `thing` → capture → overwrite.

The alternative — retry until match, then update — is nonsensical:
- If it matched, there's nothing to update.
- If it never matched (full timeout), you write whatever the last state was, but waited the full timeout for nothing.
- `--update` is a batch operation. Making every assertion wait for its timeout makes `--update` unusably slow.

### Summary

| Mode | Retry poll()? | Retry match? | Behavior |
|------|---------------|--------------|----------|
| `"new"` (no snapshot) | Yes | No | First successful `thing` → create |
| `"none"` (compare) | Yes | Yes | Retry until match or timeout |
| `"all"` (update) | Yes | No | First successful `thing` → overwrite |

`poll()` always retries until the value is available. **Match retry only happens when comparing against an existing snapshot in non-update mode.**

## The core pattern: separate probe from commit

A snapshot assertion has two phases:

1. **Probe** — compute the received value and compare against expected. Stateless. Safe to retry.
2. **Commit** — mutate snapshot state (increment counter, record result, queue inline rewrite). Stateful. Must happen exactly once.

Regular (non-poll) snapshots do both in a single call. Poll snapshots must split them: retry the probe, run the commit once after the loop settles.

```
// Probe phase (retried):
loop:
  value = poll()
  serialized = serialize(value)
  if existingSnapshot && !updating:
    if serialized === existingSnapshot → break (match)
  else:
    break (nothing to compare, or updating)
  if timeout → break
  sleep(interval) → loop

// Commit phase (once):
snapshotState.match({ received: serialized, ... })
```

The commit call to `snapshotState.match()` happens exactly once regardless of retry count. On the compare path, the commit will pass (we broke out because it matched) or fail (timeout, last value didn't match). On the create/update path, the commit records the new snapshot.

## Domain snapshots

Domain snapshots (`matchDomain`) add richness but the principle is identical.

The probe phase uses adapter semantics instead of string `===`:

```
// Probe phase (retried):
loop:
  value = poll()
  captured = adapter.capture(value)
  if existingSnapshot && !updating:
    parsed = adapter.parseExpected(existingSnapshot)  // can cache outside loop
    result = adapter.match(captured, parsed)
    if result.pass → break
  else:
    break
  if timeout → break
  sleep(interval) → loop

// Commit phase (once):
rendered = adapter.render(captured)
snapshotState.matchDomain({
  received: rendered,
  isEqual: () => result,  // pre-computed from probe
  ...
})
```

`parseExpected` can be hoisted out of the loop — the stored snapshot doesn't change between retries.

### `mergedExpected` on update

For domain snapshots with semantic patterns (regex, wildcards), `update: "all"` still captures once and commits. The adapter's `mergedExpected` preserves matched patterns while replacing mismatched literals. The retry question is orthogonal — no retry on update regardless.

## Inline snapshots

Same model. The `Error` for stack trace (locating the inline snapshot in source) must be captured before the retry loop. The probe compares against the inline snapshot string; the commit records the inline rewrite entry.

## Proposed implementation

### Overview

Two additions to `@vitest/snapshot` core:

1. `SnapshotState.probe()` — read existing snapshot + update mode without mutating state.
2. `SnapshotClient.assertDomainWithRetry()` — poll-aware counterpart to `assertDomain()`.

No changes to `expect.poll` or chai plugin in this step. The test fixture calls `assertDomainWithRetry` directly.

### Step 1: `SnapshotState.probe()`

Returns what a retry loop needs: the existing snapshot string and the update mode. Does NOT increment counters, record inline entries, or mutate stats.

```ts
// packages/snapshot/src/port/state.ts

interface SnapshotProbeResult {
  /** The existing snapshot string, or undefined if none */
  expected: string | undefined
  /** Current update mode */
  updateSnapshot: SnapshotUpdateState
}

// on SnapshotState:
probe(testName: string, options?: { isInline?: boolean; inlineSnapshot?: string }): SnapshotProbeResult {
  // Peek at the counter WITHOUT incrementing — we need the key
  // that match() will use when it's called later.
  const count = this._counters.get(testName) + 1
  const key = testNameToKey(testName, count)

  let expected: string | undefined
  if (options?.isInline) {
    expected = options.inlineSnapshot
  }
  else {
    expected = this._snapshotData[key]
  }

  return {
    expected,
    updateSnapshot: this._updateSnapshot,
  }
}
```

Key property: `probe` peeks at the counter (`get + 1` instead of `increment`) to compute the same key that the subsequent `match`/`matchDomain` call will use. Invariant: no other snapshot calls may happen between `probe` and `commit`.

### Step 2: `SnapshotClient.assertDomainWithRetry()`

Takes a `poll` function instead of a `received` value. Probes first, retries capture+match when appropriate, commits once via `matchDomain()`.

```ts
// packages/snapshot/src/client.ts

interface AssertDomainPollOptions<Options = unknown> extends Omit<AssertDomainOptions<Options>, 'received'> {
  poll: () => Promise<unknown> | unknown
  timeout?: number
  interval?: number
}

// on SnapshotClient:
async assertDomainWithRetry<Options = unknown>(options: AssertDomainPollOptions<Options>): Promise<void> {
  const {
    poll,
    filepath,
    name,
    testId = name,
    message,
    adapter,
    adapterOptions,
    isInline = false,
    inlineSnapshot,
    error,
    timeout = 1000,
    interval = 50,
  } = options

  if (!filepath) {
    throw new Error('Snapshot cannot be used outside of test')
  }

  const snapshotState = this.getSnapshotState(filepath)
  const testName = [name, ...(message ? [message] : [])].join(' > ')
  const context = { filepath, name, testId }

  // Probe: read existing snapshot without mutating state
  const { expected: existingSnapshot, updateSnapshot } = snapshotState.probe(testName, {
    isInline,
    inlineSnapshot,
  })

  const hasSnapshot = existingSnapshot != null && existingSnapshot.length > 0
  const shouldRetry = hasSnapshot && updateSnapshot !== 'all'

  let lastCaptured: any
  let lastRendered: string | undefined
  let lastResult: DomainMatchResult | undefined

  if (shouldRetry) {
    // Parse expected once — it doesn't change between retries
    const parsedExpected = adapter.parseExpected(existingSnapshot!, context, adapterOptions)
    const deadline = Date.now() + timeout

    // Retry loop: probe only, no state mutation
    while (true) {
      try {
        const received = await poll()
        lastCaptured = adapter.capture(received, context, adapterOptions)
        lastRendered = adapter.render(lastCaptured, context, adapterOptions)
        lastResult = adapter.match(lastCaptured, parsedExpected, context, adapterOptions)
        if (lastResult.pass) break
      }
      catch {
        // poll() threw — value not ready, keep retrying
      }

      if (Date.now() >= deadline) break
      await new Promise(r => setTimeout(r, interval))
    }
  }
  else {
    // No match retry, but still retry poll() until it succeeds.
    // The value may not be available yet (e.g. element doesn't exist).
    const deadline = Date.now() + timeout
    while (true) {
      try {
        const received = await poll()
        lastCaptured = adapter.capture(received, context, adapterOptions)
        lastRendered = adapter.render(lastCaptured, context, adapterOptions)
        break
      }
      catch {
        if (Date.now() >= deadline) throw
        await new Promise(r => setTimeout(r, interval))
      }
    }
  }

  // Commit: single matchDomain call
  const { actual, expected, key, pass } = snapshotState.matchDomain({
    testId,
    testName,
    received: lastRendered!,
    isInline,
    inlineSnapshot,
    error,
    isEqual: (snapshot) => {
      // If we already have a result from the probe loop, return it
      if (lastResult) return lastResult
      // Otherwise (no-retry path), compare now
      const parsed = adapter.parseExpected(snapshot, context, adapterOptions)
      return adapter.match(lastCaptured, parsed, context, adapterOptions)
    },
  })

  if (!pass) {
    throw createMismatchError(
      `Snapshot \`${key || 'unknown'}\` mismatched`,
      snapshotState.expand,
      actual?.trim(),
      expected?.trim(),
    )
  }
}
```

### How the pieces fit together

```
assertDomainWithRetry({ poll, adapter, ... })
  │
  ├─ snapshotState.probe(testName)
  │   → { expected: "name=bob\nscore=42", updateSnapshot: "none" }
  │   (read-only, no state mutation)
  │
  ├─ hasSnapshot && updateSnapshot !== "all" → shouldRetry = true
  │
  ├─ adapter.parseExpected(existingSnapshot) → parsedExpected
  │   (once, before loop)
  │
  ├─ retry loop:
  │   │  received = await poll()
  │   │  captured = adapter.capture(received)
  │   │  rendered = adapter.render(captured)
  │   │  result = adapter.match(captured, parsedExpected)
  │   │  if result.pass → break
  │   │  if timeout → break
  │   │  sleep(interval)
  │   └─ (loop)
  │
  ├─ snapshotState.matchDomain({ received: rendered, isEqual: () => result })
  │   (single commit — increments counter, records stats, writes snapshot)
  │
  └─ pass → return, !pass → throw mismatch error
```

### Test plan

Test fixture at `test/snapshots/test/fixtures/domain-poll/basic.test.ts` using the existing kv toy adapter:

```ts
// Simulates a value that changes over time
let counter = 0
function getState() {
  counter++
  if (counter < 3) { return { name: 'loading', score: 0 } }
  return { name: 'bob', score: 42, status: 'active' }
}

// Uses assertDomainWithRetry via a test helper or matcher
test('poll + domain snapshot', async () => {
  counter = 0
  await expect.poll(() => getState()).toMatchDomainSnapshot('kv')
})
```

Integration test at `test/snapshots/test/domain-poll.test.ts`:

1. **Create (update: "new")**: run fixture with no existing snapshot → poll calls once, snapshot created.
2. **Compare (update: "none")**: re-run → poll retries until `getState()` returns the matching value.
3. **Compare failure**: change `getState()` to never match → times out, reports mismatch with last captured value.
4. **Update (update: "all")**: run with `--update` → poll calls once, snapshot overwritten.
5. **Pattern-preserving update**: hand-edit snapshot with regex → run with `--update` → `mergedExpected` preserves matched patterns.

## Open questions

- **`probe` peeking at counters**: `probe` computes `counter + 1` without incrementing. This assumes no other snapshot calls interleave between `probe` and the subsequent `matchDomain`. True for our use case — the retry loop is a single async operation within one test. Worth noting as an invariant.

- **poll() throws on no-retry path**: On create/update, we still retry `poll()` until it succeeds (value may not be available yet). We just don't retry the match phase — once `poll()` succeeds, we capture and commit immediately.

- **Should this generalize to regular (non-domain) snapshots?** Same probe/commit split works with `serialize()` + `===` instead of adapter capture/match. But the use case is weaker. Leave regular snapshots blocked in `expect.poll` for now.
