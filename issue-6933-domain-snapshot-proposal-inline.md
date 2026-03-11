# Domain inline snapshots — implementation plan

Scope: `toMatchDomainInlineSnapshot` support.

## Signature (proof of concept)

```ts
expect(value).toMatchDomainInlineSnapshot(`
  name=bob
  score=999
  status=active
`, 'kv')
```

- Arg 1: snapshot template (string, optional, rewritten by vitest on update)
- Arg 2: domain name (string, required, never rewritten)
- Arg 3: message (string, optional)

Snapshot-first argument order is chosen deliberately: it matches `toMatchInlineSnapshot` where arg 1 is the snapshot. This means the existing `replaceInlineSnap()` regex works as-is — no need to teach it to skip a leading string argument.

> **TODO**: Final API may change. If we only ship `toMatchAriaSnapshot()` (no user-facing custom domains), the domain name argument disappears entirely. The `replaceInlineSnap()` generalization (skip N leading args) is deferred until the API stabilizes.

## How regular inline snapshots work

### Runtime flow

1. `chai.ts` registers `toMatchInlineSnapshot` with `wrapAssertion()`.
2. The wrapper function is named `__INLINE_SNAPSHOT_OFFSET_3__` — encodes the stack frame depth for call site detection.
3. Extracts the `error` flag (set by `.resolves`/`.rejects` wrappers, or a new `Error('snapshot')` is created).
4. Determines which argument is the snapshot via `typeof` checks:
   - `(string)` → arg 1 is snapshot
   - `(object, string?)` → arg 2 is snapshot
5. Calls `snapshotClient.assert({ isInline: true, inlineSnapshot, error, ... })`.
6. `SnapshotClient.assert()` → `SnapshotState.match()` with inline parameters.
7. `SnapshotState.match()` parses the error stack to find the call site (file, line, column), records an `InlineSnapshot` entry for later rewriting.

### Source rewriting flow

After all tests run, `saveInlineSnapshots()` is called:

1. Groups `InlineSnapshot` entries by file.
2. For each file, reads the source and calls `replaceInlineSnap()` per snapshot.
3. `replaceInlineSnap()` uses a regex to find the method call at the recorded line/column:

```ts
startRegex = /(?:toMatchInlineSnapshot|toThrowErrorMatchingInlineSnapshot)\s*\((?:[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]*[\n\r\u2028\u2029])*(?:\S.+|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF](?:\S.*|[\t\v\f \xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]+(?:\S.*)?))(['"`)])/
```

4. The regex captures the opening quote of the snapshot argument, or `)` if no snapshot yet.
5. If quote found → replace from opening quote to matching closing quote.
6. If `)` found → insert `, \`snapshot\`` before the closing paren.

## What changes for domain inline (proof of concept)

### No argument position problem

By putting snapshot as arg 1 and domain name as arg 2, the existing `replaceInlineSnap()` logic works. It finds the first string argument after `(` — which is the snapshot, exactly as with regular `toMatchInlineSnapshot`.

On first run (no snapshot yet), the call looks like:

```ts
expect(value).toMatchDomainInlineSnapshot('kv')
```

The rewriter sees `'kv'` as the first string and `)` — but since `'kv'` is what it would try to replace as the snapshot, we need to handle this. The runtime distinguishes: if only one string arg is provided and it matches a registered domain name, it's the domain, not the snapshot.

Actually, the cleaner path: on first run, the call is:

```ts
// no snapshot arg — rewriter inserts before the domain arg:
expect(value).toMatchDomainInlineSnapshot('kv')
// becomes:
expect(value).toMatchDomainInlineSnapshot(`
  name=bob
  score=999
`, 'kv')
```

The rewriter inserts the snapshot as arg 1 (before the existing args), which is exactly what `replaceInlineSnap()` does when it finds `)` — it inserts `` `snapshot` `` as the first argument.

> **TODO**: Verify that `replaceInlineSnap()` inserts before existing args (not after). If it appends, we may need a minor tweak. The alternative is to require the user to always write `toMatchDomainInlineSnapshot('', 'kv')` with an empty placeholder on first run.

### Changes needed

#### 1. Add method name to `inlineSnapshot.ts` regexes

Add `toMatchDomainInlineSnapshot` to the method name alternation in `startRegex` and `startObjectRegex`. No other changes to the rewriting logic.

#### 2. Chai registration (`chai.ts`)

```ts
utils.addMethod(
  chai.Assertion.prototype,
  'toMatchDomainInlineSnapshot',
  wrapAssertion(utils, 'toMatchDomainInlineSnapshot', function __INLINE_SNAPSHOT_OFFSET_3__(
    this,
    inlineSnapshot?: string,
    domain?: string,
    message?: string,
  ) {
    // If only one string arg, it's the domain name (no snapshot yet)
    if (typeof inlineSnapshot === 'string' && domain === undefined) {
      domain = inlineSnapshot
      inlineSnapshot = undefined
    }
    getSnapshotClient().assertDomain({
      received: expected,
      message,
      adapter: getDomain(domain),
      isInline: true,
      inlineSnapshot,
      error,
      ...getTestNames(test),
    })
  }),
)
```

#### 3. `assertDomain()` in `client.ts`

Extend `AssertDomainOptions` with inline fields:

```ts
interface AssertDomainOptions<Options> {
  // ... existing fields
  isInline?: boolean
  inlineSnapshot?: string
  error?: Error
}
```

When `isInline: true`:
- Still run `adapter.capture()` and `adapter.render()` for the rendered value.
- If `inlineSnapshot` is provided, use `adapter.parseExpected(inlineSnapshot)` + `adapter.match()` for comparison.
- If no `inlineSnapshot` (first run), always add.
- Pass to `matchDomain()` with inline parameters for stack recording.

#### 4. `matchDomain()` in `state.ts`

Add inline support to `SnapshotDomainMatchOptions`:

```ts
interface SnapshotDomainMatchOptions {
  // ... existing fields
  isInline?: boolean
  inlineSnapshot?: string
  error?: Error
}
```

When `isInline: true`:
- Parse error stack for call site position (reuse `_inferInlineSnapshotStack()`).
- Compare `inlineSnapshot` (if provided) using `isEqual` callback.
- On update/add, push to `_inlineSnapshots` array instead of `_snapshotData`.
- The snapshot value pushed is `mergedExpected ?? rendered`.

#### 5. Type declarations (`global.ts`)

```ts
toMatchDomainInlineSnapshot(snapshot?: string, domain?: string, message?: string): T
```

## Hardcoded locations to update

| File | What | Change |
|------|------|--------|
| `packages/snapshot/src/port/inlineSnapshot.ts` | `startRegex` | Add `toMatchDomainInlineSnapshot` to alternation |
| `packages/vitest/src/integrations/snapshot/chai.ts` | Method registration | Uncomment / wire `toMatchDomainInlineSnapshot` |
| `packages/vitest/src/types/global.ts` | Type declaration | Add `toMatchDomainInlineSnapshot` |
| `packages/snapshot/src/client.ts` | `assertDomain()` | Add `isInline`, `inlineSnapshot`, `error` handling |
| `packages/snapshot/src/types/index.ts` | `SnapshotDomainMatchOptions` | Add inline fields |
| `packages/snapshot/src/port/state.ts` | `matchDomain()` | Add inline snapshot recording path |

## Edge cases

- **Backslash escaping**: `escapeBacktickString()` handles this — converts `\d` to `\\d` in template literals.
- **`mergedExpected` in inline context**: the value written to the `InlineSnapshot` record should be `mergedExpected ?? rendered`, same as file-backed.
- **First run (no snapshot yet)**: only the domain name arg exists. Runtime detects this (single string arg = domain). Rewriter inserts snapshot as arg 1.

## Deferred

- **`replaceInlineSnap()` generalization**: teach it to skip N leading string args. Needed if final API puts domain name before snapshot (`toMatchDomainInlineSnapshot('aria', template)`). Deferred until API stabilizes — may not be needed if we only ship `toMatchAriaSnapshot()`.
- **`toMatchAriaSnapshot()` sugar**: domain-specific matcher with no domain name arg at all. Inline snapshot would be arg 1, identical to `toMatchInlineSnapshot` pattern.

## Test plan

Integration test in `test/snapshots/test/domain.test.ts` (extend existing):

1. Create fixture with `toMatchDomainInlineSnapshot('kv')` (no snapshot arg).
2. Run with `update: 'new'` — verify source file is rewritten with rendered value as arg 1.
3. Hand-edit the inline snapshot to introduce regex pattern.
4. Re-run — verify regex matches, source unchanged.
5. Change test input, run with `update: 'all'` — verify `mergedExpected` is written (preserves matched regex).
