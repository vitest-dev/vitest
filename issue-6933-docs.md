# PR #9668 — documentation and framing

## PR title

`feat: aria snapshot matching via domain snapshot adapters`

## PR description

### Summary

Adds `toMatchAriaSnapshot()` and `toMatchAriaInlineSnapshot()` matchers for asserting DOM accessibility trees, inspired by Playwright's aria snapshot feature. Works in jsdom, happy-dom, and Browser Mode.

Under the hood, this introduces **domain snapshot adapters** — a generic extension point that lets snapshot matchers delegate comparison to a semantic pipeline (`capture → parse → match → render`) instead of string `===`. ARIA is the first shipped adapter. The domain adapter API is experimental and not yet documented for public use.

### What's new for users

```ts
// file-backed — snapshot auto-generated on first run
expect(document.querySelector('nav')).toMatchAriaSnapshot()

// inline — editable in source
expect(document.body).toMatchAriaInlineSnapshot(`
  - navigation "Actions":
    - button: Save
    - button: Cancel
`)

// with expect.element (Browser Mode) — retries until DOM matches
await expect.element(page.getByRole('navigation')).toMatchAriaInlineSnapshot(`
  - button: Save
  - button: Cancel
`)

// with expect.poll — retries a callback
await expect.poll(() => document.body).toMatchAriaInlineSnapshot(`
  - heading "Dashboard" [level=1]
`)
```

Snapshots support hand-edited regex patterns (`/pattern/`) that survive `--update`:

```yaml
- button /User \d+/: Profile # regex preserved on update
- paragraph: You have 7 items # literal overwritten if value changes
```

### Architecture

- **Snapshot core** (`@vitest/snapshot`) owns policy: state management, update modes, inline rewriting, persistence.
- **Domain adapter** owns semantics: how to capture a value, render it, parse an expected template, and match them.
- `matchDomain()` on `SnapshotState` parallels `match()` but delegates comparison via an `isEqual` callback that returns a `DomainMatchResult` (pass, mergedExpected for pattern-preserving updates, adjusted actual/expected for diffs).
- ARIA pipeline lives in `@vitest/snapshot/src/aria/` — pure functions with no snapshot state dependency, independently unit-testable.

### Poll + snapshot: probe/commit split

`expect.poll()` historically blocked all snapshot matchers (stateful retry corrupts snapshot state). Domain snapshot matchers solve this with a probe/commit split:

- **Probe phase** (retried): `poll()` → `capture()` → `match()` against existing snapshot. Stateless, safe to retry.
- **Commit phase** (once): single `matchDomain()` call after the loop settles. Increments counters, records stats, writes snapshot.

`SnapshotState.probe()` peeks at the expected snapshot without mutating state. `SnapshotClient.assertDomainWithRetry()` orchestrates the loop.

Retry only happens when comparing against an existing snapshot in non-update mode. On create (`update: "new"`) or update (`update: "all"`), captures once and commits immediately — no timeout wait.

### Inline snapshot stack inference

Inline snapshots need the source location of the assertion call for rewriting. This is inferred from `Error` stack traces using named function markers.

Two issues solved:

1. **Poll + inline**: `assertDomainWithRetry` is async, so `new Error()` inside `matchDomain` loses the synchronous caller frames. Fix: name the poll promise function `__VITEST_POLL_PROMISE__` and teach `_inferInlineSnapshotStack` to find it (same pattern as `__VITEST_RESOLVES__`/`__VITEST_REJECTS__`).

2. **WebKit proper tail calls**: `return assertDomainSnapshot(...)` inside `__INLINE_SNAPSHOT_OFFSET_3__` is a tail call that WebKit eliminates, removing the marker frame from the stack. Fix: wrap in `try/finally {}` (same pattern as `wrapAssertion`).

WebKit poll + inline still doesn't work — WebKit async stack traces don't preserve named function markers. Skipped in browser tests pending upstream WebKit fix ([WebKit#57832](https://github.com/WebKit/WebKit/pull/57832)).

### ARIA adapter scope

Captures: implicit ARIA roles (subset of Playwright's mapping), explicit `role`, `aria-label`/`aria-labelledby`, states (`checked`/`disabled`/`expanded`/`pressed`/`selected`), heading levels, hidden element exclusion, text normalization.

Not yet: full accessible name computation, `aria-owns`, CSS visibility, shadow DOM, child policies (`/children: equal`), `/url`/`/placeholder` directives, greedy match mapping for diffs.

### Test coverage

| Area | Tests |
|---|---|
| `test/snapshots/test/fixtures/domain/` | kv toy adapter — validates domain snapshot lifecycle |
| `test/snapshots/test/fixtures/domain-inline/` | inline domain snapshots |
| `test/snapshots/test/fixtures/domain-poll/` | poll + domain file snapshots |
| `test/snapshots/test/fixtures/domain-poll-inline/` | poll + domain inline snapshots |
| `test/snapshots/test/fixtures/domain-aria/` | ARIA pipeline unit tests |
| `test/snapshots/test/fixtures/domain-aria-inline/` | ARIA inline snapshots |
| `test/snapshots/test/domain*.test.ts` | Integration tests (full lifecycle: create → edit → match → mismatch → update) |
| `test/browser/test/snapshot.test.ts` | Browser Mode: aria file/inline, poll, expect.element, retry |

### Breaking changes

None. All new API surface.

### Open questions

- **Should domain snapshot API be public?** Propose keeping it experimental. The API exists for testability and ARIA is the only current consumer. Document `toMatchAriaSnapshot`/`toMatchAriaInlineSnapshot` as the public API; domain adapters can be documented later with proper use cases.

---

# Documentation changes

## 1. `docs/guide/snapshot.md` — add "Aria Snapshots" section

After the "Visual Snapshots" section (~line 119), before "Custom Serializer". This is the conceptual intro — what aria snapshots are, why they're useful, how they differ from visual snapshots.

```md
## Aria Snapshots

Aria snapshots capture the accessibility tree of a DOM element and compare it against a stored template. Inspired by [Playwright's aria snapshots](https://playwright.dev/docs/aria-snapshots), they provide a semantic alternative to visual regression testing — asserting structure and meaning rather than pixels.

- Works in jsdom, happy-dom, and Browser Mode
- Supports regex patterns in names and text (`/User \d+/`)
- Hand-edited patterns survive `--update`
```

Show basic usage with `toMatchAriaSnapshot()` and `toMatchAriaInlineSnapshot()`, then link to the API reference.

## 2. `docs/api/expect.md` — add matcher reference

After the `toMatchFileSnapshot` section (~line 954), add:

- **`toMatchAriaSnapshot`** — type signature, description, example with `expect(element).toMatchAriaSnapshot()`
- **`toMatchAriaInlineSnapshot`** — type signature, description, example with inline template, note about regex patterns

Keep these concise — follow the style of existing matcher docs in this file.

## 3. `docs/api/browser/assertions.md` — add aria matchers

After `toMatchScreenshot` (~line 1071), add two new sections:

- **`toMatchAriaSnapshot`** — file-backed aria snapshot for browser elements, works with `expect.element` for retry
- **`toMatchAriaInlineSnapshot`** — inline variant, works with `expect.element` and `expect.poll`

Show the `expect.element` + retry pattern prominently since that's the primary browser mode use case:

```ts
await expect.element(page.getByTestId('nav')).toMatchAriaInlineSnapshot(`
  - button: Save
  - button: Cancel
`)
```

Note the WebKit limitation (poll + inline skipped pending upstream fix).

## 4. `docs/guide/snapshot.md` — update `expect.poll` snapshot note

The snapshot guide should mention that aria snapshots work with `expect.poll()` (unlike regular snapshots which are blocked). Brief note in the aria section linking to the browser assertions docs.

## Files that do NOT need changes

- `docs/config/expect.md` — no new config options for aria snapshots
- `docs/config/browser/expect.md` — no browser-level aria config (unlike `toMatchScreenshot` which has threshold/etc)
- `docs/config/snapshotformat.md` — aria snapshots bypass the serializer, not relevant
- `docs/guide/migration.md` — new feature, no migration needed
- `docs/.vitepress/config.ts` — no new pages, just new sections in existing pages
- `docs/guide/browser/visual-regression-testing.md` — could add a brief "see also aria snapshots" but not essential
