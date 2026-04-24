---
title: Snapshot | Guide
---

# Snapshot

::: tip
For a beginner-friendly introduction to snapshot testing, see the [Snapshot Testing](/guide/learn/snapshots) tutorial.
:::

<CourseLink href="https://vueschool.io/lessons/snapshots-in-vitest?friend=vueuse">Learn Snapshot by video from Vue School</CourseLink>

Snapshot tests are a very useful tool whenever you want to make sure the output of your functions does not change unexpectedly.

When using snapshot, Vitest will take a snapshot of the given value, then compare it to a reference snapshot file stored alongside the test. The test will fail if the two snapshots do not match: either the change is unexpected, or the reference snapshot needs to be updated to the new version of the result.

## Use Snapshots

To snapshot a value, you can use the [`toMatchSnapshot()`](/api/expect#tomatchsnapshot) from `expect()` API:

```ts
import { expect, it } from 'vitest'

it('toUpperCase', () => {
  const result = toUpperCase('foobar')
  expect(result).toMatchSnapshot()
})
```

The first time this test is run, Vitest creates a snapshot file that looks like this:

```js
// Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html

exports['toUpperCase 1'] = '"FOOBAR"'
```

The snapshot artifact should be committed alongside code changes, and reviewed as part of your code review process. On subsequent test runs, Vitest will compare the rendered output with the previous snapshot. If they match, the test will pass. If they don't match, either the test runner found a bug in your code that should be fixed, or the implementation has changed and the snapshot needs to be updated.

Vitest stores a serialized representation of the received value. Snapshot rendering is powered by [`@vitest/pretty-format`](https://npmx.dev/package/@vitest/pretty-format). [`snapshotFormat`](/config/snapshotformat) allows configuring general snapshot formatting behavior in Vitest. For further customization, you can implement your own [custom serializers](#custom-serializer) or [custom snapshot matchers](#custom-snapshot-matchers).

::: warning
When using Snapshots with async concurrent tests, `expect` from the local [Test Context](/guide/test-context) must be used to ensure the right test is detected.
:::

## Inline Snapshots

Similarly, you can use the [`toMatchInlineSnapshot()`](/api/expect#tomatchinlinesnapshot) to store the snapshot inline within the test file.

```ts
import { expect, it } from 'vitest'

it('toUpperCase', () => {
  const result = toUpperCase('foobar')
  expect(result).toMatchInlineSnapshot()
})
```

Instead of creating a snapshot file, Vitest will modify the test file directly to update the snapshot as a string:

```ts
import { expect, it } from 'vitest'

it('toUpperCase', () => {
  const result = toUpperCase('foobar')
  expect(result).toMatchInlineSnapshot('"FOOBAR"')
})
```

This allows you to see the expected output directly without jumping across different files.

::: warning
When using Snapshots with async concurrent tests, `expect` from the local [Test Context](/guide/test-context) must be used to ensure the right test is detected.
:::

## Updating Snapshots

When the received value doesn't match the snapshot, the test fails and shows you the difference between them. When the snapshot change is expected, you may want to update the snapshot from the current state.

In watch mode, you can press the `u` key in the terminal to update the failed snapshot directly.

Or you can use the `--update` or `-u` flag in the CLI to make Vitest update snapshots.

```bash
vitest -u
```

### CI behavior

By default, Vitest does not write snapshots in CI (`process.env.CI` is truthy) and any snapshot mismatches, missing snapshots, and obsolete snapshots fail the run. See [`update`](/config/update) for the details.

An **obsolete snapshot** is a snapshot entry (or snapshot file) that no longer matches any collected test. This usually happens after removing or renaming tests.

## File Snapshots

When calling `toMatchSnapshot()`, we store all snapshots in a formatted snap file. That means we need to escape some characters (namely the double-quote `"` and backtick `` ` ``) in the snapshot string. Meanwhile, you might lose the syntax highlighting for the snapshot content (if they are in some language).

In light of this, we introduced [`toMatchFileSnapshot()`](/api/expect#tomatchfilesnapshot) to explicitly match against a file. This allows you to assign any file extension to the snapshot file, and makes them more readable.

```ts
import { expect, it } from 'vitest'

it('render basic', async () => {
  const result = renderHTML(h('div', { class: 'foo' }))
  await expect(result).toMatchFileSnapshot('./test/basic.output.html')
})
```

It will compare with the content of `./test/basic.output.html`. And can be written back with the `--update` flag.

## Visual Snapshots

For visual regression testing of UI components and pages, Vitest provides built-in support through [browser mode](/guide/browser/) with the [`toMatchScreenshot()`](/api/browser/assertions#tomatchscreenshot) assertion:

```ts
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('button looks correct', async () => {
  const button = page.getByRole('button')
  await expect(button).toMatchScreenshot('primary-button')
})
```

This captures screenshots and compares them against reference images to detect unintended visual changes. Learn more in the [Visual Regression Testing guide](/guide/browser/visual-regression-testing).

## ARIA Snapshots <Badge type="warning">experimental</Badge> <Version>4.1.4</Version>

ARIA snapshots capture the accessibility tree of a DOM element and compare it against a stored template. Based on [Playwright's ARIA snapshots](https://playwright.dev/docs/aria-snapshots), they provide a semantic alternative to visual regression testing — asserting structure and meaning rather than pixels.

For example, given this HTML:

```html
<nav aria-label="Main">
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>
```

You can assert its accessibility tree:

```ts
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('navigation structure', async () => {
  await expect.element(page.getByRole('navigation')).toMatchAriaInlineSnapshot(`
    - navigation "Main":
      - link "Home":
        - /url: /
      - link "About":
        - /url: /about
  `)
})
```

See the dedicated [ARIA Snapshots guide](/guide/browser/aria-snapshots) for syntax details, retry behavior in Browser Mode, and file vs. inline snapshot examples. See [`toMatchAriaSnapshot`](/api/expect#tomatcharisnapshot) and [`toMatchAriaInlineSnapshot`](/api/expect#tomatchariainlinesnapshot) for the full API reference.

## Custom Serializer

You can add your own logic to alter how your snapshots are serialized. Like Jest, Vitest has default serializers for built-in JavaScript types, HTML elements, ImmutableJS and for React elements.

You can explicitly add custom serializer by using [`expect.addSnapshotSerializer`](/api/expect#expect-addsnapshotserializer) API.

```ts
expect.addSnapshotSerializer({
  serialize(val, config, indentation, depth, refs, printer) {
    // `printer` is a function that serializes a value using existing plugins.
    return `Pretty foo: ${printer(
      val.foo,
      config,
      indentation,
      depth,
      refs,
    )}`
  },
  test(val) {
    return val && Object.prototype.hasOwnProperty.call(val, 'foo')
  },
})
```

We also support [snapshotSerializers](/config/snapshotserializers) option to implicitly add custom serializers.

```ts [path/to/custom-serializer.ts]
import { SnapshotSerializer } from 'vitest'

export default {
  serialize(val, config, indentation, depth, refs, printer) {
    // `printer` is a function that serializes a value using existing plugins.
    return `Pretty foo: ${printer(
      val.foo,
      config,
      indentation,
      depth,
      refs,
    )}`
  },
  test(val) {
    return val && Object.prototype.hasOwnProperty.call(val, 'foo')
  },
} satisfies SnapshotSerializer
```

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    snapshotSerializers: ['path/to/custom-serializer.ts'],
  },
})
```

After adding a test like this:

```ts
test('foo snapshot test', () => {
  const bar = {
    foo: {
      x: 1,
      y: 2,
    },
  }

  expect(bar).toMatchSnapshot()
})
```

You will get the following snapshot:

```
Pretty foo: Object {
  "x": 1,
  "y": 2,
}
```

## Custom Snapshot Matchers <Badge type="warning">experimental</Badge> <Version>4.1.3</Version> {#custom-snapshot-matchers}

You can build custom snapshot matchers using the composable functions exposed on `Snapshots` from `vitest`. These let you transform values before snapshotting while preserving full snapshot lifecycle support (creation, update, inline rewriting).

```ts
import { expect, test, Snapshots } from 'vitest'

const { toMatchFileSnapshot, toMatchInlineSnapshot, toMatchSnapshot } = Snapshots

expect.extend({
  toMatchTrimmedSnapshot(received: string) {
    return toMatchSnapshot.call(this, received.slice(0, 10))
  },
  toMatchTrimmedInlineSnapshot(received: string, inlineSnapshot?: string) {
    return toMatchInlineSnapshot.call(this, received.slice(0, 10), inlineSnapshot)
  },
  async toMatchTrimmedFileSnapshot(received: string, file: string) {
    return toMatchFileSnapshot.call(this, received.slice(0, 10), file)
  },
})

test('file snapshot', () => {
  // create __snapshots__/demo.test.ts with
  // > exports[`file snapshot 1`] = `"extra long"`
  expect('extra long string oh my gerd').toMatchTrimmedSnapshot(10)
})

test('inline snapshot', () => {
  expect('super long string oh my gerd').toMatchTrimmedInlineSnapshot(`"super long"`)
})

test('raw file snapshot', async () => {
  // create raw-file.txt with:
  // > crazy long
  await expect('crazy long string oh my gerd').toMatchTrimmedFileSnapshot('./raw-file.txt')
})
```

The composables return `{ pass, message }` so you can further customize the error:

```ts
import { Snapshots } from 'vitest'

const { toMatchSnapshot } = Snapshots

expect.extend({
  toMatchTrimmedSnapshot(received: string, length: number) {
    const result = toMatchSnapshot.call(this, received.slice(0, length))
    return { ...result, message: () => `Trimmed snapshot failed: ${result.message()}` }
  },
})
```

::: warning
For inline snapshot matchers, the snapshot argument must be the last parameter (or second-to-last when using property matchers). Vitest rewrites the last string argument in the source code, so custom arguments before the snapshot work, but custom arguments after it are not supported.
:::

::: tip
File snapshot matchers must be `async` — `toMatchFileSnapshot` returns a `Promise`. Remember to `await` the result in the matcher and in your test.
:::

::: warning
When custom inline snapshot matcher is aynchronous, Vitest cannot automatically infer the call location for inline snapshot rewriting. You must capture the call site by setting the `'error'` flag on the chai assertion object:

```ts
import { expect, chai, Snapshots } from 'vitest'

const { toMatchInlineSnapshot } = Snapshots

expect.extend({
  async toMatchTransformedInlineSnapshot(received: string, inlineSnapshot?: string) {
    // capture call site synchronously at the top of matcher implementation
    chai.util.flag(this.assertion, 'error', new Error())
    const transformed = await transform(received)
    return toMatchInlineSnapshot.call(this, transformed, inlineSnapshot)
  },
})
```

:::

For TypeScript, extend the `Assertion` interface:

```ts
import 'vitest'

declare module 'vitest' {
  interface Assertion<T = any> {
    toMatchTrimmedSnapshot: (length: number) => T
    toMatchTrimmedInlineSnapshot: (inlineSnapshot?: string) => T
    toMatchTrimmedFileSnapshot: (file: string) => Promise<T>
  }
}
```

::: tip
See [Extending Matchers](/guide/extending-matchers) for more on `expect.extend` and custom matcher conventions.
:::

## Custom Snapshot Domain <Badge type="warning">experimental</Badge> <Version>4.1.4</Version> {#custom-snapshot-domain}

Custom serializers control how values are _rendered_ into snapshot strings, but comparison is still string equality. A **domain snapshot adapter** goes further: it owns the entire comparison pipeline for a custom matcher, including how to capture a value, render it, parse a stored snapshot, and match them semantically.

### The adapter interface

A domain adapter implements four methods and is generic over two types — `Captured` (what the value actually is) and `Expected` (what the stored snapshot parses into):

```ts
import type { DomainMatchResult, DomainSnapshotAdapter } from '@vitest/snapshot'

const myAdapter: DomainSnapshotAdapter<Captured, Expected> = {
  name: 'my-domain',

  // Extract structured data from the received value
  capture(received: unknown): Captured { /* ... */ },

  // Render captured data as the snapshot string (what gets stored)
  render(captured: Captured): string { /* ... */ },

  // Parse a stored snapshot string into a structured expected value
  parseExpected(input: string): Expected { /* ... */ },

  // Compare captured vs expected, return pass/fail and resolved output
  match(captured: Captured, expected: Expected): DomainMatchResult { /* ... */ },
}
```

#### `DomainMatchResult`

The `match` method returns a `DomainMatchResult` with two optional string fields beyond `pass`:

- **`resolved`** — the captured value viewed through the template's lens. Where the template uses patterns (e.g. regexes) or omits details, the resolved string adopts those patterns. Where the template doesn't match, it uses literal captured values. This serves as both the actual side of diffs and the value written on `--update`. When omitted, falls back to `render(capture(received))`.

- **`expected`** — the stored template re-rendered as a string. Used as the expected side of diffs. When omitted, falls back to the raw snapshot string from the snap file or inline snapshot.

:::details Why are `Captured` and `Expected` separate types?

When a snapshot is first generated, `render(captured)` produces a plain string that gets stored. But once stored, the user can **hand-edit** it — replacing literals with regex patterns, relaxing assertions, or adding domain-specific query syntax. After editing, `parseExpected(input)` parses this modified string into a type that is _richer_ than what `capture` produces.

For example, in the [key-value adapter](#example-key-value-adapter) below, `Captured` values are always `string`, but `Expected` values can be `string | RegExp`:

```ts
type KVCaptured = Record<string, string>
type KVExpected = Record<string, string | RegExp>
```

This asymmetry is what makes `--update` work correctly: `match` returns a `resolved` string that updates changed literal parts while **preserving** the user's hand-edited patterns. If both sides were the same type, there would be no way to distinguish "what the value actually is" from "what the user chose to assert" — and every update would overwrite the user's patterns.

:::

### Build a matcher from the adapter

Register a custom matcher with `expect.extend(...)` and call the snapshot composables from `vitest`:

```ts [setup.ts]
import { expect, Snaphsots } from 'vitest'

expect.extend({
  toMatchMyDomainSnapshot(received: unknown) {
    return Snaphsots.toMatchDomainSnapshot.call(this, myAdapter, received)
  },
  toMatchMyDomainInlineSnapshot(received: unknown, inlineSnapshot?: string) {
    return Snaphsots.toMatchDomainInlineSnapshot.call(
      this,
      myAdapter,
      received,
      inlineSnapshot,
    )
  },
})
```

Then use your matcher in tests:

```ts
expect(value).toMatchMyDomainSnapshot()
expect(value).toMatchMyDomainInlineSnapshot(`key=value`)
```

### Example: key-value adapter

A minimal adapter that stores objects as `key=value` lines, with regex pattern and subset key match support ([full source](https://github.com/vitest-dev/vitest/blob/main/test/snapshots/test/fixtures/domain/basic.ts)):

```ts [kv-adapter.ts]
import type { DomainMatchResult, DomainSnapshotAdapter } from '@vitest/snapshot'

type KVCaptured = Record<string, string>
type KVExpected = Record<string, string | RegExp>

function renderKV(obj: Record<string, unknown>) {
  return `\n${Object.entries(obj).map(([k, v]) => `${k}=${v}`).join('\n')}\n`
}

export const kvAdapter: DomainSnapshotAdapter<KVCaptured, KVExpected> = {
  name: 'kv',

  capture(received: unknown): KVCaptured {
    if (received && typeof received === 'object') {
      return Object.fromEntries(
        Object.entries(received).map(([k, v]) => [k, String(v)]),
      )
    }
    throw new TypeError('kv adapter expects a plain object')
  },

  render(captured: KVCaptured): string {
    return renderKV(captured)
  },

  parseExpected(input: string): KVExpected {
    const entries = input.trim().split('\n').map((line) => {
      const eq = line.indexOf('=')
      const key = line.slice(0, eq)
      const raw = line.slice(eq + 1)
      const value = (raw.startsWith('/') && raw.endsWith('/') && raw.length > 1)
        ? new RegExp(raw.slice(1, -1))
        : raw
      return [key, value]
    })
    return Object.fromEntries(entries)
  },

  match(captured: KVCaptured, expected: KVExpected): DomainMatchResult {
    const resolvedLines: string[] = []
    let pass = true

    for (const [key, actualValue] of Object.entries(captured)) {
      const expectedValue = expected[key]

      // non-asserted keys are skipped (works as subset match)
      if (typeof expectedValue === 'undefined') {
        continue
      }

      // preserve matched pattern for normalized diff and partial update
      if (expectedValue instanceof RegExp && expectedValue.test(actualValue)) {
        resolvedLines.push(`${key}=/${expectedValue.source}/`)
        continue
      }

      resolvedLines.push(`${key}=${actualValue}`)
      pass &&= actualValue === expectedValue
    }

    return {
      pass,
      message: pass ? undefined : 'KV entries do not match',
      resolved: `\n${resolvedLines.join('\n')}\n`,
      expected: `\n${renderKV(expected)}\n`,
    }
  },
}
```

```ts [setup.ts]
import { expect, Snapshots } from 'vitest'
import { kvAdapter } from './kv-adapter'

expect.extend({
  toMatchKvSnapshot(received: unknown) {
    return Snapshots.toMatchDomainSnapshot.call(this, kvAdapter, received)
  },
  toMatchKvInlineSnapshot(received: unknown, inlineSnapshot?: string) {
    return Snapshots.toMatchDomainInlineSnapshot.call(this, kvAdapter, received, inlineSnapshot)
  },
})
```

```ts [example.test.ts]
import { expect, test } from 'vitest'

test('user data', () => {
  const user = { name: 'Alice', score: '42' }
  expect(user).toMatchKvSnapshot()
})

test('user data inline', () => {
  const user = { name: 'Alice', age: 100, score: '42' }
  expect(user).toMatchKvInlineSnapshot(`
    name=Alice
    score=/\\d+/
  `)
})
```

## Difference from Jest

Vitest provides an almost compatible Snapshot feature with [Jest's](https://jestjs.io/docs/snapshot-testing) with a few exceptions:

#### 1. Comment header in the snapshot file is different

```diff
- // Jest Snapshot v1, https://goo.gl/fbAQLP
+ // Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html
```

This does not really affect the functionality but might affect your commit diff when migrating from Jest.

#### 2. `printBasicPrototype` is default to `false`

Both Jest and Vitest snapshots are powered by `pretty-format`, but Vitest applies its own snapshot defaults on top of [`@vitest/pretty-format`](https://npmx.dev/package/@vitest/pretty-format). In particular, Vitest sets `printBasicPrototype` to `false` to provide a cleaner snapshot output, while in Jest <29.0.0 it is `true` by default.

```ts
import { expect, test } from 'vitest'

test('snapshot', () => {
  const bar = [
    {
      foo: 'bar',
    },
  ]

  // in Jest
  expect(bar).toMatchInlineSnapshot(`
    Array [
      Object {
        "foo": "bar",
      },
    ]
  `)

  // in Vitest
  expect(bar).toMatchInlineSnapshot(`
    [
      {
        "foo": "bar",
      },
    ]
  `)
})
```

We believe this is a more reasonable default for readability and overall DX. If you still prefer Jest's behavior, you can change your config:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    snapshotFormat: {
      printBasicPrototype: true,
    },
  },
})
```

#### 3. Chevron `>` is used as a separator instead of colon `:` for custom messages

Vitest uses chevron `>` as a separator instead of colon `:` for readability, when a custom message is passed during creation of a snapshot file.

For the following example test code:
```js
test('toThrowErrorMatchingSnapshot', () => {
  expect(() => {
    throw new Error('error')
  }).toThrowErrorMatchingSnapshot('hint')
})
```

In Jest, the snapshot will be:
```console
exports[`toThrowErrorMatchingSnapshot: hint 1`] = `"error"`;
```

In Vitest, the equivalent snapshot will be:
```console
exports[`toThrowErrorMatchingSnapshot > hint 1`] = `[Error: error]`;
```

#### 4. default `Error` snapshot is different for `toThrowErrorMatchingSnapshot` and `toThrowErrorMatchingInlineSnapshot`

```js
import { expect, test } from 'vitest'

test('snapshot', () => {
  // in Jest and Vitest
  expect(new Error('error')).toMatchInlineSnapshot(`[Error: error]`)

  // Jest snapshots `Error.message` for `Error` instance
  // Vitest prints the same value as toMatchInlineSnapshot
  expect(() => {
    throw new Error('error')
  }).toThrowErrorMatchingInlineSnapshot(`"error"`) // [!code --]
  }).toThrowErrorMatchingInlineSnapshot(`[Error: error]`) // [!code ++]
})
```
