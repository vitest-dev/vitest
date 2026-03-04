---
title: Vitest 4.1 is out!
author:
  name: The Vitest Team
date: 2026-03-01
sidebar: false
head:
  - - meta
    - property: og:type
      content: website
  - - meta
    - property: og:title
      content: Announcing Vitest 4.1
  - - meta
    - property: og:image
      content: https://vitest.dev/og-vitest-4-1.jpg
  - - meta
    - property: og:url
      content: https://vitest.dev/blog/vitest-4-1
  - - meta
    - property: og:description
      content: Vitest 4.1 Release Announcement
  - - meta
    - name: twitter:card
      content: summary_large_image
---

# Vitest 4.1 is out!

_March 1, 2026_

![Vitest 4.1 Announcement Cover Image](/og-vitest-4-1.jpg)

## The next Vitest minor is here

Today, we are thrilled to announce Vitest 4.1 packed with new exciting features!

Quick links:

- [Docs](/)
- Translations: [简体中文](https://cn.vitest.dev/)
- [GitHub Changelog](https://github.com/vitest-dev/vitest/releases/tag/v4.1.0)

If you've not used Vitest before, we suggest reading the [Getting Started](/guide/) and [Features](/guide/features) guides first.

We extend our gratitude to the over [713 contributors to Vitest Core](https://github.com/vitest-dev/vitest/graphs/contributors) and to the maintainers and contributors of Vitest integrations, tools, and translations who have helped us develop this new release. We encourage you to get involved and help us improve Vitest for the entire ecosystem. Learn more at our [Contributing Guide](https://github.com/vitest-dev/vitest/blob/main/CONTRIBUTING.md).

To get started, we suggest helping [triage issues](https://github.com/vitest-dev/vitest/issues), [review PRs](https://github.com/vitest-dev/vitest/pulls), send failing tests PRs based on open issues, and support others in [Discussions](https://github.com/vitest-dev/vitest/discussions) and Vitest Land's [help forum](https://discord.com/channels/917386801235247114/1057959614160851024). If you'd like to talk to us, join our [Discord community](http://chat.vitest.dev/) and say hi on the [#contributing channel](https://discord.com/channels/917386801235247114/1057959614160851024).

For the latest news about the Vitest ecosystem and Vitest core, follow us on [Bluesky](https://bsky.app/profile/vitest.dev) or [Mastodon](https://webtoo.ls/@vitest).

To stay updated, keep an eye on the [VoidZero blog](https://voidzero.dev/blog) and subscribe to the [newsletter](https://voidzero.dev/newsletter).

## Vite 8 Support

This release adds support for the new Vite 8 version. Additionally, Vitest now uses the installed `vite` version instead of downloading a separate dependency, if possible. This makes issues like type inconsistencies in your config file obsolete.

## Test Tags

[Tags](/guide/test-tags) let you label tests to organize them into groups. Once tagged, you can filter tests by tag or apply shared options - like a longer timeout or automatic retries - to every test with a given tag.

To use tags, define them in your configuration file. Each tag requires a `name` and can optionally include test options that apply to every test marked with that tag. For the full list of available options, see [`tags`](/config/tags).

```ts [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    tags: [
      {
        name: 'db',
        description: 'Tests for database queries.',
        timeout: 60_000,
      },
      {
        name: 'flaky',
        description: 'Flaky CI tests.',
        retry: process.env.CI ? 3 : 0,
      },
    ],
  },
})
```

With this configuration, you can apply `flaky` and `db` tags to your tests:

```ts
test('flaky database test', { tags: ['flaky', 'db'] }, () => {
  // ...
})
```

The test has a timeout of 60 seconds and will be retried 3 times on CI because these options were specified in the configuration file for `db` and `flaky` tags.

Inspired by [pytest](https://docs.pytest.org/en/stable/reference/reference.html#cmdoption-m), Vitest supports a custom syntax for filtering tags:

- `and` or `&&` to include both expressions
- `or` or `||` to include at least one expression
- `not` or `!` to exclude the expression
- `*` to match any number of characters (0 or more)
- `()` to group expressions and override precedence

Here are some common filtering patterns:

```shell
# Run only unit tests
vitest --tags-filter="unit"

# Run tests that are both frontend AND fast
vitest --tags-filter="frontend and fast"

# Run frontend tests that are not flaky
vitest --tags-filter="frontend && !flaky"

# Run tests matching a wildcard pattern
vitest --tags-filter="api/*"
```

## Experimental `viteModuleRunner: false`

By default, Vitest runs all code inside Vite's [module runner](https://vite.dev/guide/api-environment-runtimes#modulerunner) — a permissive sandbox that provides `import.meta.env`, `require`, `__dirname`, `__filename`, and applies Vite plugins and aliases. While this makes getting started easy, it can hide real issues: your tests may pass in the sandbox but fail in production because the runtime behavior differs from native Node.js.

Vitest 4.1 introduces [`experimental.viteModuleRunner`](/config/experimental#experimental-vitemodulerunner), which lets you disable the module runner entirely and run tests with native `import` instead:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimental: {
      viteModuleRunner: false,
    },
  },
})
```

With this flag, **no file transforms are applied** — your test files, source code, and setup files are executed by Node.js directly. This means faster startup, closer-to-production behavior, and issues like incorrect `__dirname` injection or silently passing imports of nonexistent exports are caught early.

If you are using Node.js 22.18+ or 23.6+, TypeScript is [stripped natively](https://nodejs.org/en/learn/typescript/run-natively) — no extra configuration needed.

Mocking with `vi.mock` and `vi.hoisted` is supported via the Node.js [Module Loader API](https://nodejs.org/api/module.html#customization-hooks) (requires Node.js 22.15+). Note that `import.meta.env`, Vite plugins, aliases, and the `istanbul` coverage provider are not available in this mode.

Consider this option if you run server-side or script-like tests that don't need Vite transforms. For `jsdom`/`happy-dom` tests, we still recommend the default module runner or [browser mode](/guide/browser/).

Read more in the [`experimental.viteModuleRunner` docs](/config/experimental#experimental-vitemodulerunner).

## Configure UI Browser Window

Vitest 4.1 introduces [`browser.detailsPanelPosition`](/config/browser/detailspanelposition), letting you choose where the details panel appears in Browser UI.

<center>
  <img alt="Vitest UI with details at the bottom" img-light src="/ui/light-ui-details-bottom.png">
  <img alt="Vitest UI with details at the bottom" img-dark src="/ui/dark-ui-details-bottom.png">

  <sup>An example of UI with the details panel at the bottom.</sup>
</center>

This is especially useful on smaller screens, where switching to a bottom panel leaves more horizontal space for your app:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      detailsPanelPosition: 'bottom', // or 'right'
    },
  },
})
```

You can also switch this directly from the UI via the new layout toggle button.

## Custom Marks in Trace View

Trace view now supports custom markers through [`page.mark`](/api/browser/context#mark) and [`locator.mark`](/api/browser/locators#mark).

Vitest already annotates many browser actions automatically, but marks let you highlight important moments in your own test flow:

```ts
import { page } from 'vitest/browser'

await page.mark('before sign in')
await page.getByRole('button', { name: 'Sign in' }).click()
await page.mark('after sign in')
```

You can also group a whole flow under one named entry:

```ts
await page.mark('sign in flow', async () => {
  await page.getByRole('textbox', { name: 'Email' }).fill('john@example.com')
  await page.getByRole('textbox', { name: 'Password' }).fill('secret')
  await page.getByRole('button', { name: 'Sign in' }).click()
})
```

Read more in the [Trace View guide](/guide/browser/trace-view#trace-markers).

## Type-Inference in `test.extend` - New Builder Pattern

Vitest 4.1 introduces a new [`test.extend`](/guide/test-context) pattern that supports type inference. You can return a value from the factory instead of calling the `use` function - TypeScript infers the type of each fixture from its return value, so you don't need to declare types manually.

```ts
import { test as baseTest } from 'vitest'

export const test = baseTest
  // Simple value - type is inferred as { port: number; host: string }
  .extend('config', { port: 3000, host: 'localhost' })
  // Function fixture - type is inferred from return value
  .extend('server', async ({ config }) => {
    // TypeScript knows config is { port: number; host: string }
    return `http://${config.host}:${config.port}`
  })
```

For fixtures that need setup or cleanup logic, use a function. The `onCleanup` callback registers teardown logic that runs after the fixture's scope ends:

```ts
import { test as baseTest } from 'vitest'

export const test = baseTest
  .extend('tempFile', async ({}, { onCleanup }) => {
    const filePath = `/tmp/test-${Date.now()}.txt`
    await fs.writeFile(filePath, 'test data')

    // Register cleanup - runs after test completes
    onCleanup(() => fs.unlink(filePath))

    return filePath
  })
```

In addition to this, Vitest now passes down `file` and `worker` contexts to `beforeAll`, `afterAll` and `aroundAll` hooks:

```ts
import { test as baseTest } from 'vitest'

const test = baseTest
  .extend('config', { scope: 'file' }, () => loadConfig())
  .extend('db', { scope: 'file' }, ({ config }) => createDatabase(config.port))

test.beforeAll(async ({ db }) => {
  await db.migrateUsers()
})

test.afterAll(async ({ db }) => {
  await db.deleteUsers()
})
```

::: warning
This change could be considered breaking - previously Vitest passed down undocumented `Suite` as the first argument. The team decided that the usage was small enough to not disrupt the ecosystem.
:::

## New `aroundAll` and `aroundEach` Hooks

The new `aroundEach` hook registers a callback function that wraps around each test within the current suite. The callback receives a `runTest` function that **must** be called to run the test. The `aroundAll` hook works similarly, but is called for every suite, not every test.

You should use `aroundEach` when your test needs to run **inside a context** that wraps around it, such as:
- Wrapping tests in [AsyncLocalStorage](https://nodejs.org/api/async_context.html#class-asynclocalstorage) context
- Wrapping tests with tracing spans
- Database transactions

```ts
import { test as baseTest } from 'vitest'

const test = baseTest
  .extend('db', async ({}, { onCleanup }) => {
    // db is created before `aroundEach` hook
    const db = await createTestDatabase()
    onCleanup(() => db.close())
    return db
  })

test.aroundEach(async (runTest, { db }) => {
  await db.transaction(runTest)
})

test('insert user', async ({ db }) => {
  // called inside a transaction
  await db.insert({ name: 'Alice' })
})
```

## Helper for Better Stack Traces

When a test fails inside a shared utility function, the stack trace usually points to the line inside that helper - not where it was called. This makes it harder to find which test actually failed, especially when the same helper is used across many tests.

[`vi.defineHelper`](/api/vi#vi-definehelper) wraps a function so that Vitest removes its internals from the stack trace and points the error back to the call site instead:

```ts
import { expect, test, vi } from 'vitest'

const assertPair = vi.defineHelper((a, b) => {
  expect(a).toEqual(b) // 🙅‍♂️ error code block will NOT point to here
})

test('example', () => {
  assertPair('left', 'right') // 🙆 but point to here
})
```

This is especially useful for custom assertion libraries and reusable test utilities where the call site is more meaningful than the implementation.

## `--detect-async-leaks` to Catch Leaks

Leaked timers, handles, and unresolved async resources can make test suites flaky and hard to debug. Vitest 4.1 adds [`detectAsyncLeaks`](/config/detectasyncleaks) to help track these issues.

You can enable it via CLI:

```sh
vitest --detect-async-leaks
```

Or in config:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    detectAsyncLeaks: true,
  },
})
```

When enabled, Vitest uses `node:async_hooks` to report leaked async resources with source locations. Since this adds runtime overhead, it is best used while debugging.

## New `mockThrow` API

Previously, making a mock throw required wrapping the error in a function: `mockImplementation(() => { throw new Error(...) })`. The new [`mockThrow`](/api/mock#mockthrow) and [`mockThrowOnce`](/api/mock#mockthrowonce) methods make this more concise and readable:

```ts
const myMockFn = vi.fn()
myMockFn.mockThrow(new Error('error message'))
myMockFn() // throws Error<'error message'>
```

## Strict Mode in WebdriverIO and Preview

Locating elements is now strict by default in `webdriverio` and `preview`, matching Playwright behavior.

If a locator resolves to multiple elements, Vitest throws a "strict mode violation" instead of silently picking one. This helps catch ambiguous queries early:

```ts
const button = page.getByRole('button')

await button.click() // throws if multiple buttons match
await button.click({ strict: false }) // opt out and return first match
```

## Chai-style Mocking Assertions

Vitest already supports chai-style assertions like `eql`, `throw`, and `be`. This release extends that support to mock assertions, making it easier to migrate from Sinon-based test suites without rewriting every expectation:

```ts
import { expect, vi } from 'vitest'

const fn = vi.fn()

fn('example')

expect(fn).to.have.been.called // expect(fn).toHaveBeenCalled()
expect(fn).to.have.been.calledWith('example') // expect(fn).toHaveBeenCalledWith('example')
expect(fn).to.have.returned // expect(fn).toHaveReturned()
expect(fn).to.have.callCount(1) // expect(fn).toHaveBeenCalledTimes(1)
```

## Coverage `ignore start/stop` Ignore Hints

You can now completely ignore specific lines from code coverage using `ignore start/stop` comments.
In Vitest v3, this was supported by the `v8` provider, but not in v4.0 due to underlying dependency changes.

Due to the community's request, we've now implemented it back ourselves and extended the support to both `v8` and `istanbul` providers.

```ts
/* istanbul ignore start -- @preserve */
if (parameter) { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]
else { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]
/* istanbul ignore stop -- @preserve */

console.log('Included')

/* v8 ignore start -- @preserve */
if (parameter) { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]
else { // [!code error]
  console.log('Ignored') // [!code error]
} // [!code error]
/* v8 ignore stop -- @preserve */

console.log('Included')
```

See [Coverage | Ignoring Code](/guide/coverage.html#ignoring-code) for more examples.

## Coverage For Changed Files Only

If you want to get code coverage only for the modified files, you can use [`coverage.changed`](/config/coverage.html#coverage-changed) to limit the file inclusion.

Compared to the regular [`--changed`](/guide/cli.html#changed) flag, `--coverage.changed` allows you to still run all test files, but limit the coverage reporting only to the changed files.
This allows you to exclude unchanged files from coverage that `--changed` would otherwise include.

## Acknowledgments

Vitest 4.1 is the result of countless hours by the [Vitest team](/team) and our contributors. We appreciate the individuals and companies sponsoring Vitest development. [Vladimir](https://github.com/sheremet-va) and [Hiroshi](https://github.com/hi-ogawa) are part of the [VoidZero](https://voidzero.dev) Team and are able to work on Vite and Vitest full-time, and [Ari](https://github.com/ariperkkio) can invest more time in Vitest thanks to support from [Chromatic](https://www.chromatic.com/). A big shout-out to [Zammad](https://zammad.com), and sponsors on [Vitest's GitHub Sponsors](https://github.com/sponsors/vitest-dev) and [Vitest's Open Collective](https://opencollective.com/vitest).
