---
title: Vitest 4.0 is out!
author:
  name: The Vitest Team
date: 2025-10-22
sidebar: false
head:
  - - meta
    - property: og:type
      content: website
  - - meta
    - property: og:title
      content: Announcing Vitest 4.0
  - - meta
    - property: og:image
      content: https://vitest.dev/og-vitest-4.jpg
  - - meta
    - property: og:url
      content: https://vitest.dev/blog/vitest-4
  - - meta
    - property: og:description
      content: Vitest 4.0 Release Announcement
  - - meta
    - name: twitter:card
      content: summary_large_image
---

# Vitest 4.0 is out!

_October 22, 2025_

![Vitest 4 Announcement Cover Image](/og-vitest-4.jpg)

## The next Vitest major is here

Today, we are thrilled to announce Vitest 4!

Quick links:

- [Docs](/)
- Translations: [简体中文](https://cn.vitest.dev/)
- [Migration Guide](/guide/migration#vitest-4)
- [GitHub Changelog](https://github.com/vitest-dev/vitest/releases/tag/v4.0.0)

If you've not used Vitest before, we suggest reading the [Getting Started](/guide/) and [Features](/guide/features) guides first.

We extend our gratitude to the over [640 contributors to Vitest Core](https://github.com/vitest-dev/vitest/graphs/contributors) and to the maintainers and contributors of Vitest integrations, tools, and translations who have helped us develop this new major release. We encourage you to get involved and help us improve Vitest for the entire ecosystem. Learn more at our [Contributing Guide](https://github.com/vitest-dev/vitest/blob/main/CONTRIBUTING.md).

To get started, we suggest helping [triage issues](https://github.com/vitest-dev/vitest/issues), [review PRs](https://github.com/vitest-dev/vitest/pulls), send failing tests PRs based on open issues, and support others in [Discussions](https://github.com/vitest-dev/vitest/discussions) and Vitest Land's [help forum](https://discord.com/channels/917386801235247114/1057959614160851024). If you'd like to talk to us, join our [Discord community](http://chat.vitest.dev/) and say hi on the [#contributing channel](https://discord.com/channels/917386801235247114/1057959614160851024).

For the latest news about the Vitest ecosystem and Vitest core, follow us on [Bluesky](https://bsky.app/profile/vitest.dev) or [Mastodon](https://webtoo.ls/@vitest).

To stay updated, keep an eye on the [VoidZero blog](https://voidzero.dev/blog) and subscribe to the [newsletter](https://voidzero.dev/newsletter).

## Browser Mode is Stable

With this release we are removing the `experimental` tag from [Browser Mode](/guide/browser/). To make it possible, we had to introduce some changes to the public API.

To define a provider, you now need to install a separate package: [`@vitest/browser-playwright`](https://www.npmjs.com/package/@vitest/browser-playwright), [`@vitest/browser-webdriverio`](https://www.npmjs.com/package/@vitest/browser-webdriverio), or [`@vitest/browser-preview`](https://www.npmjs.com/package/@vitest/browser-preview). This makes it simpler to work with custom options and doesn't require adding `/// <reference` comments anymore.

::: code-group
```ts [playwright]
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright' // [!code ++]
/// <reference path="@vitest/browser/providers/playwright" /> // [!code --]

export default defineConfig({
  test: {
    browser: {
      provider: 'playwright', // [!code --]
      provider: playwright({ // [!code ++]
        launchOptions: { // [!code ++]
          slowMo: 100, // [!code ++]
        }, // [!code ++]
      }), // [!code ++]
      instances: [
        {
          browser: 'chromium',
          launch: { // [!code --]
            slowMo: 100, // [!code --]
          }, // [!code --]
        },
      ],
    },
  },
})
```
```ts [webdriverio]
import { defineConfig } from 'vitest/config'
import { webdriverio } from '@vitest/browser-webdriverio' // [!code ++]
/// <reference path="@vitest/browser/providers/webdriverio" /> // [!code --]

export default defineConfig({
  test: {
    browser: {
      provider: 'webdriverio', // [!code --]
      provider: webdriverio({ // [!code ++]
        capabilities: { // [!code ++]
          browserVersion: '82', // [!code ++]
        }, // [!code ++]
      }),
      instances: [
        {
          browser: 'chrome',
          capabilities: { // [!code --]
            browserVersion: '82', // [!code --]
          }, // [!code --]
        },
      ],
    },
  },
})
```
```ts [preview]
import { defineConfig } from 'vitest/config'
import { preview } from '@vitest/browser-preview' // [!code ++]

export default defineConfig({
  test: {
    browser: {
      provider: 'preview', // [!code --]
      provider: preview(), // [!code ++]
      instances: [
        { browser: 'chrome' },
      ],
    },
  },
})
```
:::

The context is no longer imported from `@vitest/browser/context` (but it will keep working until the next major version for better compatibility with tools that did not update yet), now just import from `vitest/browser`:

```ts
import { page } from '@vitest/browser/context' // [!code --]
import { page } from 'vitest/browser' // [!code ++]

test('example', async () => {
  await page.getByRole('button').click()
})
```

With these changes, the `@vitest/browser` package can be removed from your dependencies. It is now included in every provider package automatically.

## Visual Regression Testing

Vitest 4 adds support for [Visual Regression testing](/guide/browser/visual-regression-testing.md) in Browser Mode. We will continue to iterate on this feature to improve the experience.

Visual regression testing in Vitest can be done through the
[`toMatchScreenshot` assertion](/api/browser/assertions.html#tomatchscreenshot):

```ts
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('hero section looks correct', async () => {
  // ...the rest of the test

  // capture and compare screenshot
  await expect(page.getByTestId('hero')).toMatchScreenshot('hero-section')
})
```

Vitest captures screenshots of your UI components and pages, then compares them against reference images to detect unintended visual changes.

Alongside this feature, Vitest also introduces a `toBeInViewport` matcher. It allows you to check if an element is currently in viewport with [IntersectionObserver API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).

```ts
// A specific element is in viewport.
await expect.element(page.getByText('Welcome')).toBeInViewport()

// 50% of a specific element should be in viewport
await expect.element(page.getByText('To')).toBeInViewport({ ratio: 0.5 })
```

## Playwright Traces Support

Vitest 4 supports generating [Playwright Traces](/guide/browser/trace-view). To enable tracing, you need to set the [`trace`](/config/browser/trace) option in the `test.browser` configuration or pass down `--browser.trace=on` option (`off`, `on-first-retry`, `on-all-retries`, `retain-on-failure` are also available).

![Playwright Traces interface](/traces.png)

The traces are available in reporters as [annotations](/guide/test-annotations). For example, in the HTML reporter, you can find the link to the trace file in the test details. To open the trace file, you can use the [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer).

## Locator Improvements

The `frameLocator` method returns a `FrameLocator` instance that can be used to find elements inside the iframe.
Vitest now supports a new [`page.frameLocator`](/api/browser/context#framelocator) API (only with `playwright` provider).

```ts
const frame = page.frameLocator(
  page.getByTestId('iframe')
)

await frame.getByText('Hello World').click() // ✅
await frame.click() // ❌ Not available
```

Every locator now exposes a `length` property, allowing them to be used with `toHaveLength` matcher automatically:

```ts
await expect.element(page.getByText('Item')).toHaveLength(3)
```

## Improved Debugging

The [vscode extension](https://vitest.dev/vscode) now supports "Debug Test" button when running browser tests.

If you prefer configuring the debug options yourself, you can start Vitest with the `--inspect` flag (available with `playwright` and `webdriverio`) and connect to [DevTools](chrome://inspect/) manually. In this case Vitest will also disable the new [`trackUnhandledErrors`](/config/browser/trackunhandlederrors) option automatically.

## Type-Aware Hooks

When using `test.extend` with lifecycle hooks like `beforeEach` and `afterEach`, you can now reference them directly on the returned `test` object:

```ts
import { test as baseTest } from 'vitest'

const test = baseTest.extend<{
  todos: number[]
}>({
  todos: async ({}, use) => {
    await use([])
  },
})

// Unlike global hooks, these hooks are aware of the extended context
test.beforeEach(({ todos }) => {
  todos.push(1)
})

test.afterEach(({ todos }) => {
  console.log(todos)
})
```

## `expect.assert`

Vitest has always exported [Chai's `assert`](https://www.chaijs.com/api/assert/), but sometimes using it was inconvenient because many modules have the same export.

Now Vitest exposes the same method on `expect` for an easy access. This is especially useful if you need to narrow down the type, since `expect.to*` methods do not support that:

```ts
interface Cat {
  __type: 'Cat'
  mew(): void
}
interface Dog {
  __type: 'Dog'
  bark(): void
}
type Animal = Cat | Dog

const animal: Animal = { __type: 'Dog', bark: () => {} }

expect.assert(animal.__type === 'Dog')
// does not show a type error!
expect(animal.bark()).toBeUndefined()
```

## `expect.schemaMatching`

Vitest 4 introduces a new asymmetric matcher called `expect.schemaMatching`. It accepts a [Standard Schema v1](https://standardschema.dev/) object and validates values against it, passing the assertion when the value conforms to the schema.

As a reminder, asymmetric matchers can be used in all `expect` matchers that check equality, including `toEqual`, `toStrictEqual`, `toMatchObject`, `toContainEqual`, `toThrow`, `toHaveBeenCalledWith`, `toHaveReturnedWith` and `toHaveBeenResolvedWith`.

```ts
import { expect, test } from 'vitest'
import { z } from 'zod'
import * as v from 'valibot'
import { type } from 'arktype'

test('email validation', () => {
  const user = { email: 'john@example.com' }

  // using Zod
  expect(user).toEqual({
    email: expect.schemaMatching(z.string().email()),
  })

  // using Valibot
  expect(user).toEqual({
    email: expect.schemaMatching(v.pipe(v.string(), v.email()))
  })

  // using ArkType
  expect(user).toEqual({
    email: expect.schemaMatching(type('string.email')),
  })
})
```

## Reporter Updates

The `basic` reporter was removed. You can use the `default` reporter with `summary: false` instead:

```ts
export default defineConfig({
  test: {
    reporters: [
      ['default', { summary: false }],
    ],
  },
})
```

The [`default`](/guide/reporters#default-reporter) reporter now only prints tests in a tree if there is only one test file running. If you want to always see tests printed as a tree, you can use a new [`tree`](/guide/reporters#tree-reporter) reporter.

The [`verbose`](/guide/reporters#verbose-reporter) reporter now always prints tests one by one when they are finished. Previously, this was done only in CI, and locally `verbose` would behave mostly like a `default` reporter. If you prefer to keep the old behaviour, you can conditionally use the `verbose` reporter only in CI by updating the config:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporter: process.env.CI ? 'verbose' : 'default',
  },
})
```

## New API Methods

Vitest 4 comes with new advanced public [API methods](/api/advanced/vitest):

- [`experimental_parseSpecifications`](/api/advanced/vitest#parsespecification) allows you to parse a test file without running it.
- [`watcher`](/api/advanced/vitest#watcher) exposes methods that can be used when you disable the default Vitest watcher.
- [`enableCoverage`](/api/advanced/vitest#enablecoverage) and [`disableCoverage`](/api/advanced/vitest#disablecoverage) allow you to enable and disable coverage dynamically.
- [`getSeed`](/api/advanced/vitest#enablecoverage) returns the seed value, if tests run at random.
- [`getGlobalTestNamePattern`](/api/advanced/vitest#getglobaltestnamepattern) returns the current test name pattern.
- [`waitForTestRunEnd`](/api/advanced/vitest#waitfortestrunend) returns a promise that resolves when all tests have finished running.

## Breaking changes

Vitest 4 has a few breaking changes that could affect you, so we advise reviewing the detailed [Migration Guide](/guide/migration#vitest-4) before upgrading.

The complete list of changes is at the [Vitest 4 Changelog](https://github.com/vitest-dev/vitest/releases/tag/v4.0.0).

## Acknowledgments

Vitest 4 is the result of countless hours by the [Vitest team](/team) and our contributors. We appreciate the individuals and companies sponsoring Vitest development. [Vladimir](https://github.com/sheremet-va) and [Hiroshi](https://github.com/hi-ogawa) are part of the [VoidZero](https://voidzero.dev) Team and are able to work on Vite and Vitest full-time, and [Ari](https://github.com/ariperkkio) can invest more time in Vitest thanks to [StackBlitz](https://stackblitz.com/). A shout-out to [NuxtLabs](https://nuxtlabs.com), [Zammad](https://zammad.com), and sponsors on [Vitest's GitHub Sponsors](https://github.com/sponsors/vitest-dev) and [Vitest's Open Collective](https://opencollective.com/vitest).
