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

Nothing to compare against. Wait for first successful `thing` (non-null, no error), capture, commit as the new snapshot.

No retry needed. There is no expected value to retry toward.

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

| Mode | Retry? | Behavior |
|------|--------|----------|
| `"new"` (no snapshot) | No | First successful `thing` → create |
| `"none"` (compare) | Yes | Retry until match or timeout |
| `"all"` (update) | No | First successful `thing` → overwrite |

**Retry only happens when comparing against an existing snapshot in non-update mode.**

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

## What changes in `expect.poll`

Two possible implementation approaches:

### Approach A: Matcher owns retry (current direction)

Each snapshot-like matcher detects it's inside a poll context (via flags) and runs its own probe loop internally. `expect.poll()` sees the matcher run once (with `_poll.assert_once` semantics).

Pro: No changes to `expect.poll` core. Each matcher controls its own retry.
Con: Every snapshot matcher must implement the probe/commit split independently.

### Approach B: `expect.poll` learns the protocol

`expect.poll()` gains awareness of snapshot matchers. Instead of blocking them, it cooperates:

1. Before the loop: let the matcher read existing snapshot state (without mutating).
2. During the loop: run a "probe-only" mode of the matcher.
3. After the loop: run the full matcher once for the commit.

This requires a protocol between `expect.poll` and snapshot matchers — e.g. a matcher can export `probe()` and `commit()` phases.

Pro: Clean separation. New snapshot matchers get poll support without reimplementing retry.
Con: New abstraction. Requires refactoring matcher interface.

### Current recommendation

**Approach A for now.** ARIA snapshot is the concrete use case. Implement the probe/commit split inside the ARIA matcher. If a second snapshot matcher needs poll support, the pattern is proven and we can extract the protocol (Approach B) then.

The `_poll.assert_once` flag already exists as the escape hatch for matchers that handle their own retry. This is the same mechanism `toMatchScreenshot` uses.

## Open questions

- **Should `expect.poll(() => thing).toMatchSnapshot()` ever be unblocked?** Regular string snapshots could theoretically use the same probe/commit split. But the use case is weaker — `expect.poll` is primarily for values that settle, and string snapshot comparison is just `===`. If the serialized value is flapping, that's usually a test design problem, not something retry solves. Leave blocked for now.

- **Timeout semantics on create/update**: Should the poll even run when there's nothing to compare? Currently we say "wait for first successful thing." But `expect.poll` already handles this — if `fn()` throws, it retries. So on create/update, the poll retries until `fn()` succeeds, then the snapshot matcher captures and commits. The poll's own element-resolution retry handles the "wait for thing to exist" part naturally.
