# `expect.poll().toMatchDomainInlineSnapshot()` — stack frame inference failure

## Symptom

```
Error: @vitest/snapshot: Couldn't infer stack frame for inline snapshot.
```

The `domain-poll-inline` combination fails. All other combinations work:

| Combination | Status |
|---|---|
| domain | pass |
| domain-inline | pass |
| domain-poll | pass |
| domain-aria | pass |
| domain-aria-inline | pass |
| domain-poll-inline | **FAIL** |

## Root cause

Inline snapshot rewriting requires knowing the source location of the assertion call. `matchDomain()` in `state.ts:529-533` parses an `Error` object's stack trace to find a frame named `__INLINE_SNAPSHOT_OFFSET_3__`, then walks 3 frames up to reach the test file call site.

The `error` object arrives via two paths:

1. **Explicit**: `.resolves`/`.rejects` capture `new Error()` eagerly and store it as `utils.flag(this, 'error')`.
2. **Fallback**: If no `error` flag is set (the common case), `matchDomain()` creates `new Error('snapshot')` internally at `state.ts:530`.

For **non-poll inline** (works), the entire call chain is synchronous:

```
test code                                    ← target line
  → wrapAssertion (utils.ts:110)
  → __INLINE_SNAPSHOT_OFFSET_3__ (chai.ts:249)
  → assertDomainSnapshot (chai.ts:186)
  → assertDomain (client.ts)
  → matchDomain (state.ts)
  → new Error('snapshot')                    ← stack captured HERE
```

All frames are on one synchronous stack. `_inferInlineSnapshotStack` finds `__INLINE_SNAPSHOT_OFFSET_3__` and walks +3 frames to the test file. Works.

For **poll + inline** (fails), the call crosses an async boundary:

```
test code                                    ← target line
  → poll proxy (poll.ts:107)
  → wrapAssertion (utils.ts:110)
  → __INLINE_SNAPSHOT_OFFSET_3__ (chai.ts:249)
  → assertDomainSnapshot (chai.ts:186)
  → assertDomainWithRetry (client.ts:240)    ← returns Promise
  ~~~ async boundary (await) ~~~
  → matchDomain (state.ts)                  ← resumes here
  → new Error('snapshot')                   ← stack captured HERE
```

The `new Error('snapshot')` fallback captures only the async continuation stack. The synchronous frames (`__INLINE_SNAPSHOT_OFFSET_3__`, `wrapAssertion`, test file) are gone. `_inferInlineSnapshotStack` finds no marker frame → throws.

## Fix

Follow the existing convention used by `__VITEST_RESOLVES__` / `__VITEST_REJECTS__`: name the async function so it appears as a marker in stack traces, then teach `_inferInlineSnapshotStack` to recognize it.

### 1. Name the poll promise function (`poll.ts`)

```diff
-          const promise = async () => {
+          const promise = async function __VITEST_POLL_PROMISE__() {
```

V8 async stack traces preserve the named async function. The test file frame is always directly above it (+1) since the test code is the immediate awaiter.

### 2. Add marker detection (`state.ts:_inferInlineSnapshotStack`)

```ts
const pollPromiseIndex = stacks.findIndex(i =>
  i.method.match(/__VITEST_POLL_PROMISE__/),
)
if (pollPromiseIndex !== -1) {
  return stacks[pollPromiseIndex + 1]
}
```

This mirrors the existing `__VITEST_RESOLVES__` / `__VITEST_REJECTS__` pattern. The `new Error('snapshot')` fallback inside `matchDomain` now works because the async stack trace contains the marker, and the test file call site is at `pollPromiseIndex + 1`.

## Relevant code locations

| File | Line | What |
|---|---|---|
| `packages/snapshot/src/port/state.ts` | 170 | `_inferInlineSnapshotStack` — marker-based frame walker |
| `packages/snapshot/src/port/state.ts` | 529-533 | `matchDomain` — error fallback + stack parse |
| `packages/snapshot/src/client.ts` | 240 | `assertDomainWithRetry` — async, breaks stack |
| `packages/vitest/src/integrations/snapshot/chai.ts` | 203-217 | `assertDomainSnapshot` poll detection — where to capture error |
| `packages/vitest/src/integrations/snapshot/chai.ts` | 249 | `__INLINE_SNAPSHOT_OFFSET_3__` — the marker frame |
| `packages/vitest/src/integrations/chai/poll.ts` | 96-114 | Poll proxy — snapshot matchers take the early-return path |
