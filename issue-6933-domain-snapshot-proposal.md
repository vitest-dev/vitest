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
- `matchDomain()`: takes an `isEqual(existingSnapshot) => DomainMatchResult` callback. The caller (`assertDomain`) wires this to `adapter.parseExpected` + `adapter.match`.

Critical behavior difference: **on pass, `matchDomain` does not overwrite the stored snapshot**. Regular snapshots refresh the stored value to fix escaping drift. Domain snapshots must preserve hand-edited patterns (regex, wildcards) that differ from the rendered output.

### `assertDomain` flow in `SnapshotClient`

```
assertDomain(options):
  captured = adapter.capture(received, context)
  rendered = adapter.render(captured, context)

  snapshotState.matchDomain({
    received: rendered,
    isEqual: (existingSnapshot) => {
      parsed = adapter.parseExpected(existingSnapshot, context)
      return adapter.match(captured, parsed, context)  // returns full DomainMatchResult
    },
  })
```

Domain snapshots bypass the regular `serialize()` / `prettyFormat()` path entirely. The rendered string is stored and loaded as-is in the snapshot file (backtick-wrapped, no quote wrapping).

## `DomainMatchResult`: semantic matching, updates, and diffs

### The type

```ts
interface DomainMatchResult {
  pass: boolean
  message?: string
  mergedExpected?: string // pattern-preserving merge for updates
  expected?: string // adapter-adjusted expected for diff
  actual?: string // adapter-adjusted actual for diff
}
```

`isEqual` returns the full `DomainMatchResult`. `matchDomain` uses it as follows:

- **On pass**: stored snapshot is preserved (not overwritten). Semantic patterns survive.
- **On update (`!pass`)**: stores `mergedExpected ?? received` — preserving matched patterns instead of overwriting with raw rendered output.
- **On failure (no update)**: uses `actual`/`expected` from the result if provided, falling back to raw rendered/stored strings.

### Pattern-preserving updates (`mergedExpected`)

Domain snapshots support richer-than-literal matching (regex, wildcards). Without `mergedExpected`, `--update` would destroy hand-edited semantic patterns by overwriting with the raw rendered output.

The adapter's `match()` traverses both trees and knows which nodes matched (including via regex). It returns `mergedExpected` — a merge of the old template and the new rendered output where matched patterns are kept and only genuinely changed nodes get literal values.

Example with a key-value adapter:

```
Stored snapshot (hand-edited):     score=/\d+/   status=active
Actual captured values:            score=42      status=inactive

score: regex /\d+/ matches "42"    → keep pattern   → score=/\d+/
status: literal "active" ≠ "inactive" → use literal  → status=inactive

mergedExpected:                    score=/\d+/   status=inactive
```

On `--update`, `matchDomain` stores `mergedExpected` instead of the raw rendered `score=42 status=inactive`.

### Diff quality (`actual`/`expected`)

Without adjusted diffs, every regex token appears as a mismatch because the rendered value (`score=42`) differs textually from the stored pattern (`score=/\d+/`), even when the regex matched.

The adapter produces adjusted `actual`/`expected` strings where matched patterns appear identically on both sides, so only genuinely mismatched entries show in the diff:

```diff
  name=bob
  score=/\d+/        ← regex matched, identical on both sides, no diff noise
- status=active      ← only the actual mismatch shows
+ status=inactive
```

### How the core uses it

`matchDomain` in `SnapshotState` receives the full `DomainMatchResult` from the `isEqual` callback:

- `mergedExpected` → used as the value for `_addSnapshot()` on update (instead of raw `received`)
- `actual` / `expected` → used in the failure return value (instead of raw rendered/stored strings)

The core is adapter-agnostic — it passes these fields through without interpreting them. Each adapter decides its own greedy match mapping strategy.

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

## ARIA adapter prototype

A prototype ARIA adapter exists as test fixtures (not shipped code) to validate the domain snapshot design:

### File structure

```
test/snapshots/test/fixtures/domain/
  basic.test.ts           — key-value adapter (toy domain with regex, mergedExpected)

test/snapshots/test/fixtures/domain-aria/
  aria.ts                 — standalone aria pipeline (no vitest dependency)
  aria.test.ts            — unit tests for capture/render/parse/match
  aria-snapshot.ts         — adapter wiring (imports aria.ts, implements DomainSnapshotAdapter)
  aria-snapshot.test.ts    — integration tests using toMatchDomainSnapshot

test/snapshots/test/
  domain.test.ts          — integration test: full snapshot lifecycle with pattern-preserving updates
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

Runtime policy: no attempt to align outputs across `jsdom`, `happy-dom`, and browsers. Determinism target is per-runtime, not cross-runtime identity.

### What it does not cover (intentionally)

- Full accessible name computation (only `aria-label`, `aria-labelledby`, `<label for>`, `alt`)
- `aria-owns` relationship traversal
- CSS visibility checks (relies on `aria-hidden`/`hidden` attributes only)
- `/children: equal | deep-equal` container modes (only contain mode)
- Shadow DOM / slot traversal
- `/url`, `/placeholder` and other property directives
- Regex codegen mode for dynamic content
- Greedy match mapping / `mergedExpected` / adjusted diffs (implemented in kv toy adapter, not yet in ARIA adapter)

## Implementation status

### Done

- `DomainSnapshotAdapter` interface with all four methods required
- `DomainMatchResult` type with `pass`, `message`, `expected`, `actual`, `mergedExpected`
- `matchDomain()` on `SnapshotState` — adapter-delegated comparison, pattern-preserving updates via `mergedExpected`
- `assertDomain()` on `SnapshotClient` — orchestrates capture/render/match flow, passes full `DomainMatchResult` through
- `isEqual` callback returns full `DomainMatchResult` (not just `boolean`)
- `toMatchDomainSnapshot` matcher wired in chai plugin
- `expect.addSnapshotDomain()` registration API
- Stored snapshots with hand-edited regex patterns are preserved on pass (no overwrite)
- Pattern-preserving updates: on `--update`, `mergedExpected` from adapter used instead of raw rendered output
- `DomainMatchResult.actual`/`expected` wired into failure diff path
- Key-value toy adapter (`kv`) with regex support, `mergedExpected`, and adjusted `actual`/`expected` — validates pattern-preserving updates and clean diffs
- ARIA adapter prototype with unit tests (39 tests) and integration tests (6 tests)
- Integration test (`domain.test.ts`) covering full lifecycle: create → hand-edit regex → pass preserves → partial mismatch → pattern-preserving update

### TODO

- Inline snapshot support (`toMatchDomainInlineSnapshot`)
- ARIA adapter: implement greedy match mapping + `mergedExpected` + adjusted `actual`/`expected` (currently only returns `pass`/`message`)
  - Domain-specific sugar matchers (`toMatchAriaSnapshot`)
