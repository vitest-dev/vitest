---
title: Vitest 3.2 is out!
author:
  name: The Vitest Team
date: 2025-06-02
sidebar: false
head:
  - - meta
    - property: og:type
      content: website
  - - meta
    - property: og:title
      content: Announcing Vitest 3.2
  - - meta
    - property: og:image
      content: https://vitest.dev/og-vitest-3-2.png
  - - meta
    - property: og:url
      content: https://vitest.dev/blog/vitest-3-2
  - - meta
    - property: og:description
      content: Vitest 3.2 Release Announcement
  - - meta
    - name: twitter:card
      content: summary_large_image
---

# Vitest 3.2 is out!

_June 2, 2025_

![Vitest 3.2 Announcement Cover Image](/og-vitest-3-2.png)

Vitest 3.2 focuses on improvements to Browser Mode and TypeScript support. This release also includes some new useful methods, config options and deprecates the `workspace` config in favour of `projects`.

## `workspace` is Deprecated

In an effort to simplify the configuration, the team decided to deprecate the separate `vitest.workspace` file and recommend using only the `projects` option in the root config. This also simplifies how the global options are configured (because you don't need to guess how to add reporters when you have no root config).

We also decided to deprecate the `workspace` name because it clashes with other tools like PNPM that provide monorepo support via this option. Vitest doesn't run these projects with separate `CWD` and treats them more like sub-Vitests. It also gives us more space to come up with a better solution for monorepos without breaking others.

This option will be removed completely in a future major, replaced by `projects`. Until then, Vitest will print a warning if workspace feature is used.

<!--@include: ../guide/examples/projects-workspace.md-->

## Annotation API

The new [annotation API](/guide/test-annotations) allows you to annotate any test with a custom message and attachment. These annotations are visible in the UI, HTML, junit, tap and GitHub Actions reporters. Vitest will also print related annotation in the CLI if the test fails.

<img src="/annotation-api-cute-puppy-example.png" />

## Scoped Fixtures

The `test.extend` fixtures can now specify the `scope` option: either `file` or `worker`.

```ts
const test = baseTest.extend({
  db: [
    async ({}, use) => {
      // ...setup
      await use(db)
      await db.close()
    },
    { scope: 'worker' },
  ],
})
```

The file fixture is similar to using `beforeAll` and `afterAll` at the top level of the file, but it won't be called if the fixture is not used in any test.

The `worker` fixture is initiated once per worker, but note that by default Vitest creates one worker for every test, so you need to disable [isolation](/config/#isolate) to benefit from it.

## Custom Project Name Colors

You can now set a custom [color](/config/#name) when using `projects`:

::: details Config Example
```ts{6-9,14-17}
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: {
            label: 'unit',
            color: 'red',
          },
        },
      },
      {
        test: {
          name: {
            label: 'browser',
            color: 'green',
          },
          browser: {
            enabled: true,
            provider: 'playwright',
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
```
:::

<img src="/v3-2-custom-colors.png" />

## Custom Browser Locators API

Built-in locators might not be enough to express your application’s needs. Instead of falling back to CSS and losing the retry-ability protection that Vitest provides through its locator API, we now recommend extending locators using the new [`locators.extend` API](/guide/browser/locators#custom-locators).

```ts
import { locators } from '@vitest/browser/context'

locators.extend({
  getByCommentsCount(count: number) {
    return `.comments :text("${count} comments")`
  },
})
```

Return a Playwright [locator string](https://playwright.dev/docs/other-locators) to construct a new locator. Note that string returned from this method will be scoped to the parent locator, if there is one.

Now you can call `getByCommentsCount` on the `page` or any other locator directly:

```ts
await expect.element(page.getByCommentsCount(1)).toBeVisible()
await expect.element(
  page.getByRole('article', { name: 'Hello World' })
    .getByCommentsCount(1)
).toBeVisible()
```

If this method returns a string, then the return value will be converted into a locator, so you can keep chaining it:

```ts
page.getByRole('article', { name: 'Hello World' })
  .getByCommentsCount(1)
  .getByText('comments')
```

This method has access to the current locator context, if there is one (if method is called on the `page`, then context will refer to `page`), so you can chain all locator methods inside:

```ts
import { locators } from '@vitest/browser/context'
import type { Locator } from '@vitest/browser/context'

locators.extend({
  getByCommentsCount(this: Locator, count: number) {
    return this.getByRole('comment')
      .and(this.getByText(`${count} comments`))
  },
})
```

Having access to context also allows you to call regular methods of the locator to define a custom user event:

```ts
import { locators, page } from '@vitest/browser/context'
import type { Locator } from '@vitest/browser/context'

locators.extend({
  clickAndFill(this: Locator, text: string) {
    await this.click()
    await this.fill(text)
  },
})

await page.getByRole('textbox').clickAndFill('Hello World')
```

Please, refer to the [`locators.extend` API](/guide/browser/locators#custom-locators) for more information.

## Explicit Resource Management in `vi.spyOn` and `vi.fn`

In environments that support [Explicit Resource Management](https://github.com/tc39/proposal-explicit-resource-management), you can use `using` instead of `const` to automatically call `mockRestore` on any mocked function when the containing block is exited. This is especially useful for spied methods:

```ts
it('calls console.log', () => {
  using spy = vi.spyOn(console, 'log').mockImplementation(() => {})
  debug('message')
  expect(spy).toHaveBeenCalled()
})

// console.log is restored here
```

## Test `signal` API

Vitest now provides an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) object to the test body. You can use it to stop any resource that supports this Web API.

The signal is aborted when test times out, another test fails and [`--bail` flag](/config/#bail) is set to a non-zero value, or the user presses Ctrl+C in the terminal.

For example, you can stop a `fetch` request when tests are interrupted:

```ts
it('stop request when test times out', async ({ signal }) => {
  await fetch('/heavy-resource', { signal })
}, 2000)
```

## Coverage V8 AST-aware remapping

Vitest now uses `ast-v8-to-istanbul` package developed by one of the Vitest maintainers, [AriPerkkio](https://github.com/AriPerkkio). This brings v8 coverage report in line with istanbul, but has a better performance! Enable this feature by setting [`coverage.experimentalAstAwareRemapping`](/config/#coverage-experimentalastawareremapping) to `true`.

We are planning to make this the default remapping mode in the next major. The old `v8-to-istanbul` will be removed completely. Feel free to join discussion at https://github.com/vitest-dev/vitest/issues/7928.

## `watchTriggerPatterns` Option

When you edit a file, Vitest is smart enough to rerun only tests that import this file. Unfortunately, Vitest static analysis respects only static and dynamic `import` statement. If you are reading a file or starting a separate process, Vitest will ignore changes to related files.

With `watchTriggerPatterns` option you can configure which tests to rerun depending on the file that was changed. For example, to always rerun `mailers` tests when a template is changed, add a trigger pattern:

```ts
export default defineConfig({
  test: {
    watchTriggerPatterns: [
      {
        pattern: /^src\/templates\/(.*)\.(ts|html|txt)$/,
        testsToRun: (file, match) => {
          return `api/tests/mailers/${match[2]}.test.ts`
        },
      },
    ],
  },
})
```

## The New Multi-Purpose `Matchers` Type

Vitest now has a `Matchers` type that you can extend to add type support for all your custom matchers in one place. This type affects all these use cases:

- `expect().to*`
- `expect.to*`
- `expect.extend({ to* })`

For example, to have a type-safe `toBeFoo` matcher, you can write something like this:

```ts twoslash
import { expect } from 'vitest'

interface CustomMatchers<R = unknown> {
  toBeFoo: (arg: string) => R
}

declare module 'vitest' {
  interface Matchers<T = any> extends CustomMatchers<T> {}
}

expect.extend({
  toBeFoo(actual, arg) {
    //            ^?
    // ... implementation
    return {
      pass: true,
      message: () => '',
    }
  }
})

expect('foo').toBeFoo('foo')
expect.toBeFoo('foo')
```

## `sequence.groupOrder`

The new [`sequence.groupOrder`](/config/#grouporder) option controls the order in which the project runs its tests when using multiple [projects](/guide/projects).

- Projects with the same group order number will run together, and groups are run from lowest to highest.
- If you don’t set this option, all projects run in parallel.
- If several projects use the same group order, they will run at the same time.

::: details Example
Consider this example:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'slow',
          sequence: {
            groupOrder: 0,
          },
        },
      },
      {
        test: {
          name: 'fast',
          sequence: {
            groupOrder: 0,
          },
        },
      },
      {
        test: {
          name: 'flaky',
          sequence: {
            groupOrder: 1,
          },
        },
      },
    ],
  },
})
```

Tests in these projects will run in this order:

```
 0. slow  |
          |> running together
 0. fast  |

 1. flaky |> runs after slow and fast alone
```
:::

----

The complete list of changes is at the [Vitest 3.2 Changelog](https://github.com/vitest-dev/vitest/releases/tag/v3.2.0).
