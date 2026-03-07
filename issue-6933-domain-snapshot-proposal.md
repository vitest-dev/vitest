# Issue #6933 consolidated notes: Playwright survey, Vitest comparison, and domain snapshot proposal

Date: 2026-02-15
Scope: `vitest-dev/vitest#6933`

## Executive summary

- Playwright's ARIA snapshots are a semantic matcher pipeline (`capture -> parse -> match -> render/update`), not only string serialization.
- Vitest already has strong snapshot policy/plumbing (state, inline updates, file IO, update modes), but historically compares serialized strings.
- Recommended direction: keep Vitest snapshot policy core, add domain adapters for semantics.
- ARIA can be first adapter, but design must be generic and not Browser Mode specific.
- Runtime differences (`jsdom`/`happy-dom`/browser engines) are expected and should not be normalized by Vitest.

## Playwright model (what matters conceptually)

Main behavior of `expect(locator).toMatchAriaSnapshot(...)`:

- Captures a normalized accessibility-oriented tree from DOM subtree.
- Parses YAML template into typed AST with positional errors.
- Matches semantically by role/name/state/text, with per-node child strictness.
- Renders canonical snapshot text for diff and update.
- Supports inline and file-backed snapshot forms.

Where logic lives:

- Matcher orchestration/update: `packages/playwright/src/matchers/toMatchAriaSnapshot.ts`
- Parser/types: `packages/playwright-core/src/utils/isomorphic/ariaSnapshot.ts`
- Capture + semantic match + renderer: `packages/injected/src/ariaSnapshot.ts`

Notable parser/matcher features:

- Name/text regex support (`/pattern/`).
- Child policies: `/children: contain | equal | deep-equal`.
- Additional node properties (e.g. `/url`, placeholder-like props).
- Subtree-search semantics (`matchesNodeDeep`) rather than root-only exactness.

## Vitest current snapshot baseline

Existing strengths:

- Snapshot lifecycle/state in `@vitest/snapshot` (`setup/match/assert/pack/save`).
- Inline snapshot rewriting and source update plumbing.
- Raw file snapshot support (`toMatchFileSnapshot`).
- Configurable snapshot path resolution.
- Browser-side snapshot fs bridge exists, but concept should remain environment-agnostic.

Current gap (historically):

- Core flow is mostly value serialization/string comparison, not domain parser + semantic matcher.

## Proposed architecture: domain snapshots

Principle:

- Snapshot core owns policy (state, update behavior, persistence).
- Domain adapter owns semantics (capture/parse/match/render).

Conceptual flow:

- `received -> adapter.capture() -> domain model`
- `expected text -> adapter.parseExpected()` (optional)
- `adapter.match(captured, expected)`
- `adapter.render(captured, mode)`
- core snapshot policy decides pass/update/report persistence

Minimal adapter contract:

```ts
interface DomainSnapshotAdapter<Captured, Expected, Options> {
  name: string
  capture(received: unknown, context: DomainContext, options?: Options): Captured
  render(captured: Captured, context: DomainContext, mode: 'assert' | 'update', options?: Options): string
  parseExpected?(input: string, context: DomainContext, options?: Options): Expected
  match?(captured: Captured, expected: Expected | string, context: DomainContext, options?: Options): { pass: boolean }
}
```

## Runtime policy

- Do not attempt to align outputs across `jsdom`, `happy-dom`, and browsers.
- Determinism target is per-runtime, not cross-runtime identity.
- Divergence is runtime/user choice, not a Vitest normalization responsibility.

## Initial API direction

- Generic matcher shapes:
  - `expect(value).toMatchDomainSnapshot(domain, hint?: string)`
  - `expect(value).toMatchDomainInlineSnapshot(domain, template?: string, hint?: string)`
- Extension API shape: `expect.addSnapshotDomain(adapter)`
- Domain-specific sugar matchers (e.g. `toMatchAriaSnapshot`) can be optional follow-ups.

Current draft extension contract:

```ts
expect.addSnapshotDomain({
  name: 'my-domain',
  capture(received, context, options) {
    return received
  },
  render(captured, context, mode, options) {
    return String(captured)
  },
  parseExpected(input, context, options) {
    return input
  },
  match(captured, expected, context, options) {
    return { pass: captured === expected }
  },
})

expect(value).toMatchDomainSnapshot('my-domain')
expect(value).toMatchDomainInlineSnapshot('my-domain', 'expected')
```

Current draft `DomainMatchResult` (now included):

```ts
interface DomainMatchResult {
  pass: boolean
  message?: string
  expected?: string // normalized expected-for-diff
  actual?: string // normalized actual-for-diff
  mismatches?: Array<{
    path: string
    reason: string
    expected?: string
    actual?: string
  }>
}
```

Behavior in current draft:

- `actual` / `expected` can be used to normalize display diff input.
- `message` is appended to assertion failure message when mismatch happens.
- `mismatches` is attached on thrown error as `error.domainMatchResult` for reporter consumption.

## Implementation status in this branch (draft)

Implemented:

- Added domain adapter concept and `assertDomain` path in `@vitest/snapshot`.
- Wired `toMatchAriaSnapshot` to domain path (no longer plain serializer-only wiring).
- Added a simple first ARIA adapter and jsdom test coverage as draft.

Meaning:

- Foundation is now adapter-based; current ARIA semantics are intentionally simplified.

## Known limitations (accepted for v1)

Accepted initial limitation (same class seen in Playwright issue):

- Semantic matching can support pattern-like expected input, but failure output can still be text-diff dominated.
- This can produce noisy diffs where matcher tokens look "wrong" despite not being the root mismatch.
- Reference example: `https://github.com/microsoft/playwright/issues/34555`

Why acceptable initially:

- Unblocks shipping domain adapter foundation.
- Keeps scope tight while validating adapter API.

## Note on diff-noise difficulty and practical fix

This limitation is not fundamentally hard to solve.

- Matching already happens on a semantic node model (captured domain model vs expected template model).
- The noisy output comes later, when failure UI falls back to plain text diff of rendered snapshots.

Practical fix (reporter-layer, no major matcher rewrite):

1. During semantic matching, produce a deterministic match mapping.
- Map expected matcher tokens (e.g. regex/pattern tokens) to matched actual nodes/values.
- Reuse existing traversal order and matching decisions; no global optimization needed.

2. Build a display-oriented actual snapshot.
- For locations that matched dynamic tokens, rewrite actual value to expected token form (or a stable marker).
- Keep true mismatches unchanged.

3. Diff expected vs display-oriented actual.
- Matched regex/wildcard tokens stop showing as false-positive diffs.
- Real mismatch remains highlighted and easier to identify.

Why this should work well:

- Domain match is already structural (similar in spirit to `toEqual` object matching).
- We only improve presentation by carrying semantic match information into diff rendering.
- Determinism follows matcher traversal order; ambiguous regex spans do not require complex global matching.

## Near-term follow-ups after v1

1. Expand `DomainMatchResult`
- Include mismatch path, reason code, expected token kind, actual value.

2. Domain-aware reporter formatting
- Show semantic mismatch first, text context second.
- Avoid flagging wildcard/regex tokens as hard diffs when they matched.

3. Standard parser diagnostics
- Unified shape: error code, line/column, source frame.

4. Better update UX for semantic snapshots
- Communicate whether update came from strict mismatch vs tolerated matcher patterns.

5. Optional artifact strategy polish
- Domain-specific extensions/path templates if needed later.

## Bottom line

- Copying Playwright fully is feasible, but not the best long-term fit.
- Domain snapshots let Vitest absorb the concept at framework level and naturally support ARIA.
- Start with adapter foundation + simple ARIA draft, accept known reporting limits, then iterate quickly on semantic diagnostics/reporting.
