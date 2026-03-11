# Builtin ARIA domain + sugar matchers — implementation plan

Scope: Ship ARIA snapshot as a builtin domain in `@vitest/snapshot`, expose `toMatchAriaSnapshot` / `toMatchAriaInlineSnapshot` sugar matchers.

## Goals

1. Move ARIA pipeline (capture/render/parse/match) into `@vitest/snapshot` as shipped code
2. Export individual functions so they're independently unit-testable (like `pretty-format`)
3. Auto-register `'aria'` domain so users don't need `expect.addSnapshotDomain()`
4. Add `toMatchAriaSnapshot()` and `toMatchAriaInlineSnapshot(snapshot?)` sugar matchers — no hint parameter
5. Keep existing `toMatchDomainSnapshot('aria')` working (it's the generic API)

## Non-goals (this step)

- Greedy match mapping / `mergedExpected` / adjusted diffs for ARIA — separate follow-up
- Full accessible name computation, CSS visibility, shadow DOM, child policies
- Moving adapter wiring into `@vitest/snapshot` (adapter stays in vitest package, pipeline in snapshot package)

## Architecture

### Layering

```
@vitest/snapshot
  src/aria.ts          ← pure pipeline: captureAriaTree, renderAriaTree, parseAriaTemplate, matchAriaTree
  src/index.ts         ← re-exports pipeline functions

vitest (main package)
  src/integrations/snapshot/ariaAdapter.ts   ← DomainSnapshotAdapter wiring (thin)
  src/integrations/snapshot/chai.ts          ← auto-registers aria domain, adds sugar matchers
```

**Why this split**: `aria.ts` is a pure pipeline with four exported functions. It has no dependency on `DomainSnapshotAdapter` or snapshot state machinery. Keeping it in `@vitest/snapshot` means:

- Unit tests can import and test each function independently (just like `pretty-format` exports its serializers)
- The adapter wiring is a thin layer in `vitest` that imports the pipeline + the domain types
- No circular dependency: `@vitest/snapshot` exports types + pipeline, `vitest` imports both and wires them

The adapter itself (`ariaAdapter.ts`) lives in `vitest` because it uses `addDomain`/`getDomain` from the domain registry and is registered in the chai plugin alongside the sugar matchers.

### DOM dependency

`aria.ts` uses `Element`, `Node`, `document` — browser/jsdom globals. This is fine:
- The code only runs at test-time in a DOM environment (happy-dom, jsdom, or real browser)
- `@vitest/snapshot` is already used in browser mode
- TypeScript: add `lib: ["dom"]` to the snapshot package tsconfig, or use `/// <reference lib="dom" />` in `aria.ts`

### What gets exported from `@vitest/snapshot`

```ts
// Pipeline functions — independently testable
export { captureAriaTree, matchAriaTree, parseAriaTemplate, renderAriaTree } from './aria'

// Types
export type { AriaNode, AriaTemplateNode, AriaTemplateRoleNode, AriaTemplateTextNode } from './aria'
```

These are the building blocks. Users writing custom adapters or debugging can import them directly.

## Implementation steps

### Step 1: Move ARIA pipeline into `@vitest/snapshot`

Copy `test/snapshots/test/fixtures/domain-aria/aria.ts` → `packages/snapshot/src/aria.ts`.

No changes to the code itself — it's already a self-contained module with no vitest imports. Export all four functions and all types from `packages/snapshot/src/index.ts`.

### Step 2: Create adapter in vitest package

New file: `packages/vitest/src/integrations/snapshot/ariaAdapter.ts`

```ts
import type { AriaNode, AriaTemplateRoleNode, DomainMatchResult, DomainSnapshotAdapter } from '@vitest/snapshot'
import { captureAriaTree, matchAriaTree, parseAriaTemplate, renderAriaTree } from '@vitest/snapshot'

export const ariaDomainAdapter: DomainSnapshotAdapter<AriaNode, AriaTemplateRoleNode> = {
  name: 'aria',
  capture(received) {
    if (received instanceof Element) { return captureAriaTree(received) }
    if (typeof received === 'string') {
      document.body.innerHTML = received
      return captureAriaTree(document.body)
    }
    throw new TypeError('aria adapter expects an Element or HTML string')
  },
  render(captured) {
    return `\n${renderAriaTree(captured)}\n`
  },
  parseExpected(input) {
    return parseAriaTemplate(input.trim())
  },
  match(captured, expected): DomainMatchResult {
    if (typeof expected === 'string') { expected = parseAriaTemplate(expected.trim()) }
    const pass = matchAriaTree(captured, expected)
    return {
      pass,
      message: pass ? undefined : 'ARIA tree does not match expected template',
    }
  },
}
```

### Step 3: Auto-register + sugar matchers in chai plugin

In `packages/vitest/src/integrations/snapshot/chai.ts`:

```ts
import { addDomain } from '@vitest/snapshot'
import { ariaDomainAdapter } from './ariaAdapter'

// Auto-register at plugin init time
addDomain(ariaDomainAdapter)
```

Add sugar matchers:

```ts
// toMatchAriaSnapshot() — no arguments
utils.addMethod(
  chai.Assertion.prototype,
  'toMatchAriaSnapshot',
  wrapAssertion(utils, 'toMatchAriaSnapshot', function (this) {
    utils.flag(this, '_name', 'toMatchAriaSnapshot')
    const isNot = utils.flag(this, 'negate')
    if (isNot) { throw new Error('toMatchAriaSnapshot cannot be used with "not"') }
    const expected = utils.flag(this, 'object')
    const test = getTest('toMatchAriaSnapshot', this)
    const errorMessage = utils.flag(this, 'message')
    getSnapshotClient().assertDomain({
      received: expected,
      adapter: ariaDomainAdapter,
      isInline: false,
      errorMessage,
      ...getTestNames(test),
    })
  }),
)

// toMatchAriaInlineSnapshot(snapshot?) — snapshot only, no hint
utils.addMethod(
  chai.Assertion.prototype,
  'toMatchAriaInlineSnapshot',
  wrapAssertion(utils, 'toMatchAriaInlineSnapshot', function __INLINE_SNAPSHOT_OFFSET_3__(
    this,
    inlineSnapshot?: string,
  ) {
    utils.flag(this, '_name', 'toMatchAriaInlineSnapshot')
    const isNot = utils.flag(this, 'negate')
    if (isNot) { throw new Error('toMatchAriaInlineSnapshot cannot be used with "not"') }
    const test = getTest('toMatchAriaInlineSnapshot', this)
    const expected = utils.flag(this, 'object')
    const error = utils.flag(this, 'error')
    const errorMessage = utils.flag(this, 'message')
    if (inlineSnapshot) {
      inlineSnapshot = stripSnapshotIndentation(inlineSnapshot)
    }
    getSnapshotClient().assertDomain({
      received: expected,
      adapter: ariaDomainAdapter,
      isInline: true,
      inlineSnapshot,
      error,
      errorMessage,
      ...getTestNames(test),
    })
  }),
)
```

Note: `toMatchAriaInlineSnapshot` has no domain name argument — it hardcodes `ariaDomainAdapter`. This makes the API identical to `toMatchInlineSnapshot` arg structure, so `replaceInlineSnap()` works without domain-aware arg-skipping.

### Step 4: Add `toMatchAriaInlineSnapshot` to inline snapshot rewriting

In `packages/snapshot/src/port/inlineSnapshot.ts`, add `toMatchAriaInlineSnapshot` to:

- `startObjectRegex` alternation
- `startRegex` alternation
- `getCodeStartingAtIndex()` method name lookups
- `firstKeywordMatch` regex in `replaceInlineSnap()`

Same mechanical change as was done for `toMatchDomainInlineSnapshot`.

### Step 5: Type declarations

In `packages/vitest/src/types/global.ts`, add to `Assertion<T>`:

```
toMatchAriaSnapshot: () => void
toMatchAriaInlineSnapshot: (snapshot?: string) => void
```

### Step 6: Update test fixtures

Update `test/snapshots/test/fixtures/domain-aria/aria-snapshot.test.ts`:
- Remove `import { ariaDomainAdapter } from './aria-snapshot'`
- Remove `expect.addSnapshotDomain(ariaDomainAdapter)`
- Replace `toMatchDomainSnapshot('aria')` → `toMatchAriaSnapshot()`

Update `test/snapshots/test/fixtures/domain-aria/aria.test.ts`:
- Import pipeline functions from `@vitest/snapshot` instead of local `./aria`
- This validates that the exports work correctly

The fixture-local `aria.ts` and `aria-snapshot.ts` can be deleted once the pipeline is in the package.

### Step 7: Update integration test

Update `test/snapshots/test/domain-aria.test.ts`:
- Verify `toMatchAriaSnapshot()` works end-to-end
- Snapshot file format should be identical

## File changes summary

| File | Change |
|------|--------|
| `packages/snapshot/src/aria.ts` | **New** — ARIA pipeline (from fixture `aria.ts`) |
| `packages/snapshot/src/index.ts` | Export pipeline functions and types |
| `packages/vitest/src/integrations/snapshot/ariaAdapter.ts` | **New** — adapter wiring |
| `packages/vitest/src/integrations/snapshot/chai.ts` | Auto-register aria, add `toMatchAriaSnapshot` + `toMatchAriaInlineSnapshot` |
| `packages/snapshot/src/port/inlineSnapshot.ts` | Add `toMatchAriaInlineSnapshot` to regexes |
| `packages/vitest/src/types/global.ts` | Add type declarations |
| `test/snapshots/test/fixtures/domain-aria/aria-snapshot.test.ts` | Use sugar API |
| `test/snapshots/test/fixtures/domain-aria/aria.test.ts` | Import from `@vitest/snapshot` |
| `test/snapshots/test/domain-aria.test.ts` | Use sugar API |
| `test/snapshots/test/fixtures/domain-aria/aria.ts` | Delete (moved to package) |
| `test/snapshots/test/fixtures/domain-aria/aria-snapshot.ts` | Delete (moved to package) |

## Edge cases

- **DOM not available**: `captureAriaTree` will throw if called outside a DOM environment. This is expected — ARIA snapshots require a DOM. The error will be clear: `aria adapter expects an Element or HTML string`.
- **Inline snapshot rewriting**: `toMatchAriaInlineSnapshot` has no domain name argument, so the rewriter treats it identically to `toMatchInlineSnapshot` — first string arg is the snapshot. No arg-skipping needed.
- **Backward compat**: `toMatchDomainSnapshot('aria')` continues to work because the domain is auto-registered. Users who already use the generic API don't need to change anything.

## Test plan

1. **Unit tests**: Import `captureAriaTree`, `renderAriaTree`, `parseAriaTemplate`, `matchAriaTree` from `@vitest/snapshot` in fixture tests — validate each function independently
2. **Integration (file-backed)**: `domain-aria.test.ts` — create snapshots with `toMatchAriaSnapshot()`, verify snapshot file content
3. **Integration (inline)**: Add inline snapshot test fixture using `toMatchAriaInlineSnapshot()`, verify source rewriting
4. **Generic API still works**: Keep or add a test using `toMatchDomainSnapshot('aria')` to confirm auto-registration
