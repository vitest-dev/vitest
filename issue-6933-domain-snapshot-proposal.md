# Issue #6933: Domain snapshot design document

Date: 2026-02-15 (initial), 2026-03-11 (revised)
Scope: `vitest-dev/vitest#6933`

## Executive summary

- Playwright's ARIA snapshots are a semantic matcher pipeline (`capture -> parse -> match -> render`), not only string serialization.
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

Notable parser/matcher features:

- Name/text regex support (`/pattern/`).
- Child policies: `/children: contain | equal | deep-equal`.
- Additional node properties (e.g. `/url`, placeholder-like props).
- Subtree-search semantics (`matchesNodeDeep`) rather than root-only exactness.

## Architecture: domain snapshots

### Principle

- Snapshot core owns policy (state, update behavior, persistence).
- Domain adapter owns semantics (capture/parse/match/render).
- All four adapter methods are required — no optional fallbacks to string comparison.

### Adapter contract

```ts
interface DomainSnapshotAdapter<Captured, Expected, Options> {
  name: string
  capture(received: unknown, context: DomainSnapshotContext, options?: Options): Captured
  render(captured: Captured, context: DomainSnapshotContext, options?: Options): string
  parseExpected(input: string, context: DomainSnapshotContext, options?: Options): Expected
  match(captured: Captured, expected: Expected | string, context: DomainSnapshotContext, options?: Options): DomainMatchResult
}
```

Design decisions:

- `parseExpected` and `match` are **required**, not optional. If you register a domain adapter, you commit to the full contract. No half-baked adapters that silently fall back to string comparison.
- `render` has no `mode` parameter. There is one canonical rendering. Presentation concerns (e.g. wrapping newlines for snapshot file readability) belong in the adapter, not the core type.

### Snapshot lifecycle for domain snapshots

```
received
  → adapter.capture()     → domain model (Captured)
  → adapter.render()      → canonical string (for storage on first run / update)

stored snapshot string
  → adapter.parseExpected() → parsed template (Expected)
  → adapter.match(captured, parsed) → DomainMatchResult

DomainMatchResult
  → pass: snapshot core records matched
  → fail: snapshot core reports mismatch, using adapter-provided diff hints
```

Key difference from regular snapshots: **comparison is delegated to the adapter**, not done by string `===`. This is what makes domain snapshots meaningful — an ARIA adapter can match semantically (contain semantics, regex patterns, attribute subset) rather than requiring byte-identical strings.

### Snapshot state integration (`matchDomain`)

Added `matchDomain()` on `SnapshotState` alongside the existing `match()`. It reuses all existing snapshot state machinery (key counters, unchecked tracking, update/add logic, stats) but replaces the comparison step:

- Regular `match()`: serializes received, compares with `===`.
- `matchDomain()`: takes an `isEqual(existingSnapshot) => boolean` callback. The caller (`assertDomain`) wires this to `adapter.parseExpected` + `adapter.match`.

Critical behavior difference: **on pass, `matchDomain` does not overwrite the stored snapshot**. Regular snapshots refresh the stored value to fix escaping drift. Domain snapshots must preserve hand-edited patterns (regex, wildcards) that differ from the rendered output.

### `assertDomain` flow in `SnapshotClient`

```ts
assertDomain(options):
  captured = adapter.capture(received, context)
  rendered = adapter.render(captured, context)

  snapshotState.matchDomain({
    received: rendered,
    isEqual: (existingSnapshot) => {
      parsed = adapter.parseExpected(existingSnapshot, context)
      result = adapter.match(captured, parsed, context)
      return result.pass
    },
  })
```

Domain snapshots bypass the regular `serialize()` / `prettyFormat()` path entirely. The rendered string is stored and loaded as-is in the snapshot file (backtick-wrapped, no quote wrapping).

## `DomainMatchResult` and diff quality

### Current state

```ts
interface DomainMatchResult {
  pass: boolean
  message?: string
  expected?: string // adapter-adjusted expected for diff
  actual?: string // adapter-adjusted actual for diff
  mismatches?: Array<{
    path: string
    reason: string
    expected?: string
    actual?: string
  }>
}
```

The type is defined but **`expected`/`actual` are not yet wired into the failure path**. Currently on failure, `matchDomain` returns the raw rendered string as `actual` and the raw stored snapshot as `expected`. This produces noisy diffs when the stored snapshot contains regex/pattern tokens.

### The problem

When a stored snapshot contains semantic patterns:

```yaml
- button /User \d+/: Profile
- paragraph: /You have \d+ notifications/
```

And the test fails on an unrelated change (say the paragraph text changed), the diff shows every regex token as a mismatch because the rendered actual (`button "User 42"`) differs textually from the pattern (`button /User \d+/`).

### The solution (next steps)

The adapter's `match()` already traverses both trees and knows which nodes matched (including via regex). It should return adjusted `actual`/`expected` strings in `DomainMatchResult`. This serves **two distinct purposes**:

#### 1. Pattern-preserving updates

When `--update` is used and the adapter provides a greedy match mapping, the **update value** should be a merge of the old template and the new rendered output — not a full overwrite. Nodes where the old regex/pattern matched the new captured value should keep their pattern form; only genuinely changed nodes get their literal rendered value.

Example: stored snapshot has `- button /User \d+/: Profile`. The actual DOM now has `button "User 99"`. The regex matches, so on update the stored snapshot keeps `- button /User \d+/: Profile` instead of replacing it with `- button "User 99": Profile`.

Without this, `--update` destroys hand-edited semantic patterns, which defeats the purpose of domain snapshots supporting richer-than-literal matching.

The mechanism:

1. **Greedy match mapping**: during semantic matching, record which template nodes matched which captured nodes.
2. **Merged rendering**: produce a string that preserves template tokens (regex, wildcards) for matched nodes, and substitutes literal rendered values only for unmatched/new nodes.
3. The merged string becomes the value written to the snapshot file on update, instead of the raw `rendered` output.

#### 2. Diff quality on failure

When a test fails, the diff should not show every regex token as a mismatch. The same greedy match mapping can produce adjusted `actual`/`expected` strings where matched regex tokens are substituted so only genuinely mismatched nodes appear as differences.

This is a presentation concern — the match decision stays the same; only the failure output gets cleaner.

#### Plumbing changes needed

Both purposes require the same core change:

- `isEqual` callback (or a replacement) must return the full `DomainMatchResult`, not just `boolean`.
- `DomainMatchResult` carries `mergedExpected` (pattern-preserving merge for updates) and `actual`/`expected` (adjusted strings for diffs).
- `matchDomain` uses `mergedExpected` as the stored value on update instead of raw rendered string.
- `assertDomain` uses `result.actual` / `result.expected` for the error on failure.

These are separable steps — pattern-preserving updates and diff quality can be implemented independently, but both depend on the greedy match mapping in the adapter.

## API surface

### Current (implemented)

```ts
// Register adapter
expect.addSnapshotDomain(adapter)

// File-backed domain snapshot
expect(value).toMatchDomainSnapshot('domain-name')
expect(value).toMatchDomainSnapshot('domain-name', 'hint')
```

### Deferred (commented out, not yet wired)

```ts
// Inline domain snapshot
expect(value).toMatchDomainInlineSnapshot('domain-name', 'template')
```

### Possible future sugar

```ts
// Domain-specific matchers (e.g. for ARIA)
expect(element).toMatchAriaSnapshot()
```

## Runtime policy

- Do not attempt to align outputs across `jsdom`, `happy-dom`, and browsers.
- Determinism target is per-runtime, not cross-runtime identity.
- Divergence is runtime/user choice, not a Vitest normalization responsibility.

## ARIA adapter prototype

A prototype ARIA adapter exists as test fixtures (not shipped code) to validate the domain snapshot design:

### File structure

```
test/snapshots/test/fixtures/domain/
  aria.ts                 — standalone aria pipeline (no vitest dependency)
  aria.test.ts            — unit tests for capture/render/parse/match
  aria-snapshot.ts         — adapter wiring (imports aria.ts, implements DomainSnapshotAdapter)
  aria-snapshot.test.ts    — integration tests using toMatchDomainSnapshot
```

### Separation of concerns

`aria.ts` is a pure aria pipeline with four exported functions:

- `captureAriaTree(root: Element) → AriaNode` — walks DOM, builds accessibility tree
- `renderAriaTree(node: AriaNode) → string` — serializes to Playwright-compatible YAML format
- `parseAriaTemplate(text: string) → AriaTemplateRoleNode` — parses YAML template with regex/attribute support
- `matchAriaTree(root: AriaNode, template: AriaTemplateNode) → boolean` — semantic matching with contain semantics and deep search

`aria-snapshot.ts` is the thin adapter layer:

- `capture` — accepts `Element` or HTML string, calls `captureAriaTree`
- `render` — calls `renderAriaTree`, adds newline wrapping for snapshot readability
- `parseExpected` — calls `parseAriaTemplate`
- `match` — calls `matchAriaTree`, returns `DomainMatchResult`

### What the prototype covers

Capture: implicit ARIA roles from HTML elements (subset of Playwright's mapping), explicit `role` attribute, `aria-label`/`aria-labelledby` for name, `aria-checked`/`disabled`/`expanded`/`pressed`/`selected` states, heading levels, hidden element exclusion, text normalization.

Render: Playwright-compatible YAML-like format (`- role "name" [attrs]: text`), nested indentation, inline text children.

Parse: role entries with quoted or regex names, `[attr]`/`[attr=value]` syntax, inline text children (string or regex), nested children via indentation.

Match: contain semantics (template children match in order, can skip), deep subtree search, regex name/text matching, attribute constraints.

### What it does not cover (intentionally)

- Full accessible name computation (only `aria-label`, `aria-labelledby`, `<label for>`, `alt`)
- `aria-owns` relationship traversal
- CSS visibility checks (relies on `aria-hidden`/`hidden` attributes only)
- `/children: equal | deep-equal` container modes (only contain mode)
- Shadow DOM / slot traversal
- `/url`, `/placeholder` and other property directives
- Regex codegen mode for dynamic content
- Diff-aware rendering (the `DomainMatchResult.actual`/`expected` path described above)

## Implementation status

### Done

- `DomainSnapshotAdapter` interface with all four methods required
- `DomainMatchResult` type with `pass`, `message`, `expected`, `actual`, `mismatches`
- `matchDomain()` on `SnapshotState` — snapshot state management with adapter-delegated comparison
- `assertDomain()` on `SnapshotClient` — orchestrates capture/render/match flow
- `toMatchDomainSnapshot` matcher wired in chai plugin
- `expect.addSnapshotDomain()` registration API
- ARIA adapter prototype with full unit test coverage (33 tests) and integration tests (6 tests)
- Stored snapshots with hand-edited regex patterns are preserved across runs

### Next

- Greedy match mapping in adapter `match()` — record which template nodes matched which captured nodes
- Pattern-preserving updates — use merged rendering (keeps matched regex tokens) as the stored value on `--update`, instead of raw rendered output
- Wire `DomainMatchResult.actual`/`expected` into failure diff path (diff quality)
- Inline snapshot support (`toMatchDomainInlineSnapshot`)
- Consider whether `DomainMatchResult.mismatches` should influence reporter output

### Deferred

- Domain-specific sugar matchers (`toMatchAriaSnapshot`)
- Standard parser diagnostics (error code, line/column)
- Domain-aware reporter formatting
- Update UX for semantic snapshots (communicating why an update happened)
