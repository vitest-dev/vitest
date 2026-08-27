---
title: Vitest 5.0 is out!
author:
  name: The Vitest Team
date: 2026-09-04
sidebar: false
head:
  - - meta
    - property: og:type
      content: website
  - - meta
    - property: og:title
      content: Announcing Vitest 5.0
  - - meta
    - property: og:image
      content: https://vitest.dev/og-vitest-5.jpg
  - - meta
    - property: og:url
      content: https://vitest.dev/blog/vitest-5
  - - meta
    - property: og:description
      content: Vitest 5.0 Release Announcement
  - - meta
    - name: twitter:card
      content: summary_large_image
---

# Vitest 5.0 is out!

_September 4th, 2026_

![Vitest 5 Announcement Cover Image](/og-vitest-5.jpg)

## The next Vitest major is here

Today, we are thrilled to announce Vitest 5!

Quick links:

- [Docs](/)
- Translations: [简体中文](https://cn.vitest.dev/)
- [Migration Guide](/guide/migration#vitest-5)
- [GitHub Changelog](https://github.com/vitest-dev/vitest/releases/tag/v5.0.0)

If you've not used Vitest before, we suggest reading the [Getting Started](/guide/) and [Features](/guide/features) guides first.

We extend our gratitude to the over [799 contributors to Vitest Core](https://github.com/vitest-dev/vitest/graphs/contributors) and to the maintainers and contributors of Vitest integrations, tools, and translations who have helped us develop this new major release. We encourage you to get involved and help us improve Vitest for the entire ecosystem. Learn more at our [Contributing Guide](https://github.com/vitest-dev/vitest/blob/main/CONTRIBUTING.md).

To get started, we suggest helping [triage issues](https://github.com/vitest-dev/vitest/issues), [review PRs](https://github.com/vitest-dev/vitest/pulls), send failing tests PRs based on open issues, and support others in [Discussions](https://github.com/vitest-dev/vitest/discussions) and Vitest Land's [help forum](https://discord.com/channels/917386801235247114/1057959614160851024). If you'd like to talk to us, join our [Discord community](http://chat.vitest.dev/) and say hi on the [#contributing channel](https://discord.com/channels/917386801235247114/1057959614160851024).

For the latest news about the Vitest ecosystem and Vitest core, follow us on [Bluesky](https://bsky.app/profile/vitest.dev) or [Mastodon](https://webtoo.ls/@vitest).

To stay updated, keep an eye on the [VoidZero blog](https://voidzero.dev/blog) and subscribe to the [newsletter](https://voidzero.dev/newsletter).

## Performance Improvements

Performance was the main focus of this release. To measure it, we built [vitest-dev/benchmarks](https://github.com/vitest-dev/benchmarks): a set of generated reference apps, from a 5-file utility package to an enterprise monolith with 1,280 modules and a barrel-file-heavy app with 817 modules. Every app runs across pools (`forks`, `threads`, `vmForks`, `vmThreads`), environments (`node`, `jsdom`, `happy-dom`, and Browser Mode), with and without isolation, so we can see how each change behaves on realistic projects instead of micro-benchmarks.

<!-- TODO: replace with the final numbers from `pnpm compare results/vitest-4.1.json results/vitest-5.0.json` -->

| App | Vitest 4.1 | Vitest 5.0 | Change |
| --- | --- | --- | --- |
| micro-utils (5 files, node) | X.XXs | X.XXs | -XX% |
| react-spa (92 modules, jsdom) | X.XXs | X.XXs | -XX% |
| barrel-hell (817 modules) | X.XXs | X.XXs | -XX% |
| enterprise-monolith (1,280 modules) | X.XXs | X.XXs | -XX% |
| long-haul (80 jsdom files) | X.XXs | X.XXs | -XX% |
| design-system (80 components, browser) | X.XXs | X.XXs | -XX% |

Some of the changes behind these numbers:

- **Inline projects share the Vite server.** Projects defined in `test.projects` that don't change the Vite config now reuse the Vite server of the config that declares them, so shared files are transformed once. See [`sharedViteServer`](/config/sharedviteserver).
- **File system module cache is stable.** The [`fsModuleCache`](/config/fsmodulecache) option (previously `experimental.fsModuleCache`) persists transformed modules on disk, so they are reused across reruns and separate Vitest processes. Plugins can participate in the cache key with [`defineCacheKeyGenerator`](/api/advanced/plugin#definecachekeygenerator).
- **Fewer round trips between the main process and workers.** Warm modules are served to workers in one round trip, and the Node compile cache is persisted on teardown.
- **Faster vm pools.** `vmThreads` and `vmForks` reuse compiled code across contexts and prewarm the module graph. They also support `require(esm)` now.
- **Faster Browser Mode.** Vitest prebundles its own runtime, prewarms the browser while the Vite server starts, opens browser sessions adaptively instead of `maxWorkers` sessions upfront, and cuts per-file round trips.
- **Smaller install.** Vitest now bundles its own dependencies, which reduces the number of packages in `node_modules` and the time spent resolving them.

The [duration breakdown](/guide/profiling-test-performance) in the reporter output now shows percentages, so it's easier to see where the time goes:

```
Duration  3.76s (environment 79%, import 13%, transform 6%, tests 1%, setup 1%)
```

## Trace View

Vitest 5 adds a built-in [Trace View](/guide/browser/trace-view) for Browser Mode. When [`browser.traceView`](/config/browser/traceview) is enabled, Vitest records every interaction, assertion, and `page.mark` as a DOM snapshot and lets you replay the test step by step after the browser has already moved on. The viewer is available in the browser UI, in [Vitest UI](/guide/ui), and in the [HTML reporter](/guide/reporters#html-reporter), so it works for local debugging and for CI failures alike.

<div class="flex align-center justify-center">
  <video controls muted>
    <source src="/trace-view.webm" type="video/webm">
  </video>
</div>

Select a step to see the reconstructed page at that moment with the interacted element highlighted, and Vitest opens the source location in the editor panel. Failed actions and assertions are highlighted in red. Trace view also supports keyboard navigation and live updates in watch mode.

::: code-group
```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      traceView: true,
    },
  },
})
```
```bash [CLI]
vitest --browser.traceView
```
:::

Unlike [Playwright Traces](/guide/browser/playwright-traces), trace view does not depend on the provider and does not require a separate viewer.

## Nested Projects and Config Inheritance

Inline projects now [inherit the root config](/guide/projects#configuration) by default, including Vite options like `plugins` and `resolve.alias`. In Vitest 4, you had to set `extends: true` on every project to get this behavior:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    projects: [
      {
        extends: true, // [!code --]
        test: {
          name: 'unit',
          include: ['**/*.unit.test.ts'],
        },
      },
    ],
  },
})
```

A config file referenced in `test.projects` can now declare its own `projects`. Such a config acts as a container, exactly like the root config, and provides [nested projects](/guide/projects#nested-projects) named `app (unit)`, `app (e2e)`, and so on. This makes it possible to reference a package that already defines its own projects without duplicating them at the root:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['./packages/*/vitest.config.ts'],
  },
})
```

The `--project` filter is aware of the hierarchy, and it now has a `-p` shorthand:

```bash
vitest -p app
```

## `vi.when`

Defining different return values for different arguments used to require a manual `mockImplementation` with argument checks. The new [`vi.when`](/api/vi#vi-when) API defines per-argument behaviors on a spy. Arguments are matched with deep equality and support asymmetric matchers like `expect.any()`:

```ts
import { expect, test, vi } from 'vitest'

test('returns user data', async () => {
  const findById = vi.fn()

  vi.when(findById)
    .calledWith(1)
    .thenResolve({ id: 1, name: 'Ella' })
    .calledWith(2)
    .thenResolve({ id: 2, name: 'Gracie' })
    .calledWith(expect.any(Number))
    .thenReject(new Error('not found'))

  await expect(findById(1)).resolves.toEqual({ id: 1, name: 'Ella' })
  await expect(findById(3)).rejects.toThrow('not found')
})
```

Behaviors can be limited with `thenReturnOnce` or a `times` option, and the new [`toHaveBeenExhausted`](/api/expect#tohavebeenexhausted) assertion checks that every registered behavior was consumed. Read more in the [Conditional Mocking](/guide/recipes/conditional-mocking) recipe.

## Benchmarking Rewrite

The benchmarking API was rewritten. `bench` is no longer a top-level import; it is a [test-context fixture](/guide/test-context#bench) available inside regular `test()` calls in benchmark files. This gives benchmarks access to everything the test runner offers: fixtures, lifecycle hooks, retries, filtering, and assertions.

```ts
import { expect, test } from 'vitest'

test('compare parsers', async ({ bench }) => {
  const result = await bench.compare(
    bench('JSON.parse', () => {
      JSON.parse('{"key":"value"}')
    }),
    bench('custom parser', () => {
      customParse('{"key":"value"}')
    }),
  )

  expect(result.get('JSON.parse')).toBeFasterThan(result.get('custom parser'))
})
```

Results can be stored with `writeResult` and replayed with `bench.from()` to compare against a baseline, and the built-in Tinybench provider can be replaced with a custom [benchmark provider](/config/benchmark#benchmark-provider). Benchmark output is now part of the `default` and `json` reporters. See the [Benchmarking guide](/guide/benchmarking) for the full API.

## Locator Errors Show the ARIA Tree

When a locator cannot find an element in Browser Mode, Vitest now prints the [ARIA snapshot](/guide/browser/aria-snapshots) of the searched subtree next to the HTML output. The accessibility tree is usually much shorter than the raw HTML and shows exactly the roles and names that `getByRole` and `getByLabelText` match against. The output is controlled by the new [`browser.locators.errorFormat`](/config/browser/locators#browser-locators-errorformat) option:

```ts
export default defineConfig({
  test: {
    browser: {
      locators: {
        errorFormat: 'aria', // 'html' | 'aria' | 'all'
      },
    },
  },
})
```

Locators are also [strict by default](/guide/migration#locators-are-strict-by-default): `locators.exact` is enabled, so `getByText('Item')` no longer matches `Item 1` by accident.

## Mocking `Temporal`

Fake timers now mock the [`Temporal`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal) API alongside `Date`, thanks to the `@sinonjs/fake-timers` v15.4 update. This applies both to [`vi.useFakeTimers()`](/api/vi#vi-usefaketimers) and to [`vi.setSystemTime()`](/api/vi#vi-setsystemtime) used without fake timers:

```ts
vi.setSystemTime(0)
Temporal.Now.instant().epochMilliseconds // 0
```

`Temporal` is part of the default set of faked APIs. To keep it native, add it to `toNotFake`.

## Stricter Assertions

Asynchronous assertions like `resolves`, `rejects`, and `toMatchFileSnapshot` now fail the test when they are not awaited. Previously, Vitest awaited them at the end of the test and printed a warning, which hid the real problem: the assertion did not run where it was written.

```ts
test('unawaited assertion', async () => {
  expect(promise).resolves.toBe(1) // [!code --]
  await expect(promise).resolves.toBe(1) // [!code ++]
})
```

[`expect.poll`](/api/expect#poll) now rejects when it does not settle within `timeout`, and the callback receives an `AbortSignal` so you can cancel in-flight work:

```ts
await expect.poll(async ({ signal }) => {
  const response = await fetch('/api/status', { signal })
  return response.status
}, { timeout: 1000 }).toBe(200)
```

Assertion types now expose both the return type and the received type. When you [extend matchers](/guide/extending-matchers), the `Matchers` interface now takes the return type as its first parameter:

```ts
import 'vitest'

declare module 'vitest' {
  interface Matchers<T = any> { // [!code --]
    toBeFoo: () => void // [!code --]
  } // [!code --]
  interface Matchers<R, T> { // [!code ++]
    toBeFoo: () => R // [!code ++]
  } // [!code ++]
}
```

`R` reflects how the matcher is used: `void` when called synchronously, `Promise<void>` through `.resolves`, `.rejects`, `expect.poll`, or `expect.element`.

`T` is the type of the received value, so an expected argument can be typed the same as the value under test:

```ts
declare module 'vitest' {
  interface Matchers<R, T> {
    toEqualTyped: (expected: T) => R
  }
}

expect(1).toEqualTyped(2) // ✅
expect(1).toEqualTyped('2') // ❌ type error
```

The same change applies to code that refers to assertion types directly:

```ts
Assertion<string> // [!code --]
Assertion<void, string> // [!code ++]
Assertion<Promise<void>, string> // asynchronous assertion // [!code ++]
```

Custom matchers also get access to the underlying Chai [`assertion`](/guide/extending-matchers#assertion) object.

## `clearMocks` is Enabled by Default

[`clearMocks`](/config/clearmocks) now defaults to `true`. Vitest calls `vi.clearAllMocks()` before every test, so a mock no longer carries call history from one test into the next while the implementations stay intact. This removes one of the most common sources of order-dependent tests. To keep the previous behavior, set `clearMocks: false`.

## The `.vitest` Directory

Reporters and other integrations now write their output into a single `.vitest` directory at the project root: the `html`, `json`, and `junit` reporters, failure screenshots, and Playwright traces all use it by default. This reduces the number of entries you need to add to `.gitignore` to one.

Third-party reporters can use the same convention through the new [`vitest.createReport(scope)`](/api/advanced/vitest#createreport) API, which returns a `Report` limited to its own `.vitest/<scope>` directory.

The HTML reporter can also produce a self-contained report with the [`singleFile`](/guide/reporters#html-reporter) option. Vitest inlines the UI assets, metadata, and test attachments into one `index.html`, which is easy to upload as a CI artifact:

```ts
export default defineConfig({
  test: {
    reporters: [
      ['html', { singleFile: true }],
    ],
  },
})
```

## Other Improvements

- The new [`--repeats`](/config/repeats) CLI option repeats every test a given number of times regardless of the result, which is useful for hunting flaky tests.
- [`injectCjsGlobals`](/config/injectcjsglobals) makes it possible to disable the injection of `module`, `exports`, `require`, `__filename`, and `__dirname` into ES modules.
- [`coverage.autoAttachSubprocess`](/config/coverage#coverage-autoattachsubprocess) tracks the coverage of `node:child_process` and `node:worker_threads` spawned during the test run with the `v8` provider.
- [`coverage.thresholds.perFile`](/config/coverage#coverage-thresholds-perfile) accepts an object, and `thresholds.autoUpdate` receives the previous threshold as an argument.
- The `json` reporter accepts a `filterMeta` option, and the `junit` reporter supports jest-junit-compatible naming options.
- [`TestCase.logs()`](/api/advanced/test-case#logs) exposes the console output recorded during a test to reporters and the advanced API.
- Test titles and inspected values use `pretty-format`, and `test.for`/`test.each` title placeholders support non-ASCII characters.
- `vitest --merge-reports` supports non-sharded runs across multiple environments.
- Coverage switched to the [`@vitest/istanbuljs`](https://github.com/vitest-dev/istanbuljs) packages, a maintained fork of the `istanbul-lib-*` family.

## Breaking Changes

Vitest 5 requires Vite >= 6.4.0 and Node.js >= 22.12.0. Vitest 5 has several breaking changes that could affect you, so we advise reviewing the detailed [Migration Guide](/guide/migration#vitest-5) before upgrading.

The complete list of changes is at the [Vitest 5 Changelog](https://github.com/vitest-dev/vitest/releases/tag/v5.0.0).

## Acknowledgments

Vitest 5 is the result of countless hours of work by the [Vitest team](/team) and our contributors. None of it would be possible without the individuals and companies that sponsor Vitest. [Vladimir](https://github.com/sheremet-va) and [Hiroshi](https://github.com/hi-ogawa) work on Vite and Vitest full-time at [VoidZero](https://voidzero.dev), and [Chromatic](https://www.chromatic.com/) gives [Ari](https://github.com/ariperkkio) the time to keep pushing Vitest forward. A big thank you to everyone supporting us through [GitHub Sponsors](https://github.com/sponsors/vitest-dev) and [Open Collective](https://opencollective.com/vitest).
