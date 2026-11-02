---
title: Vitest 5.1 is out!
author:
  name: The Vitest Team
date: 2026-11-02
sidebar: false
head:
  - - meta
    - property: og:type
      content: website
  - - meta
    - property: og:title
      content: Announcing Vitest 5.1
  - - meta
    - property: og:image
      content: https://vitest.dev/og-vitest-5-1.jpg
  - - meta
    - property: og:url
      content: https://vitest.dev/blog/vitest-5-1
  - - meta
    - property: og:description
      content: Vitest 5.1 Release Announcement
  - - meta
    - name: twitter:card
      content: summary_large_image
---

# Vitest 5.1 is out!

_November 2, 2026_

![Vitest 5.1 Announcement Cover Image](/og-vitest-5-1.jpg)

## The next Vitest minor is here

Today, we are thrilled to announce Vitest 5.1!

Quick links:

- [Docs](/)
- Translations: [简体中文](https://cn.vitest.dev/)
- [GitHub Changelog](https://github.com/vitest-dev/vitest/releases/tag/v5.1.0)

If you've not used Vitest before, we suggest reading the [Getting Started](/guide/) and [Features](/guide/features) guides first.

We extend our gratitude to the over [840 contributors to Vitest Core](https://github.com/vitest-dev/vitest/graphs/contributors) and to the maintainers and contributors of Vitest integrations, tools, and translations who have helped us develop this new release. We encourage you to get involved and help us improve Vitest for the entire ecosystem. Learn more at our [Contributing Guide](https://github.com/vitest-dev/vitest/blob/main/CONTRIBUTING.md).

To get started, we suggest helping [triage issues](https://github.com/vitest-dev/vitest/issues), [review PRs](https://github.com/vitest-dev/vitest/pulls), send failing tests PRs based on open issues, and support others in [Discussions](https://github.com/vitest-dev/vitest/discussions) and Vitest Land's [help forum](https://discord.com/channels/917386801235247114/1057959614160851024). If you'd like to talk to us, join our [Discord community](http://chat.vitest.dev/) and say hi on the [#contributing channel](https://discord.com/channels/917386801235247114/1057959614160851024).

For the latest news about the Vitest ecosystem and Vitest core, follow us on [Bluesky](https://bsky.app/profile/vitest.dev) or [Mastodon](https://webtoo.ls/@vitest).

To stay updated, keep an eye on the [VoidZero blog](https://voidzero.dev/blog) and subscribe to the [newsletter](https://voidzero.dev/newsletter).

## Run Only Affected Tests with `--since-last-run`

The [`--changed`](/config/changed) flag compares your files with a Git reference. It needs a repository, and a change stops being "changed" as soon as you commit it. The new experimental [`--since-last-run`](/guide/cli#since-last-run) flag compares the files with the last run of each test instead:

```sh
vitest run --since-last-run
```

The first run with the flag runs every test and records the files each test loaded, including dynamic imports, mocks, setup files, and snapshot files. Every later run checks the modification time of those files and runs only the tests whose files changed or were deleted since their last run. A test file that failed in its last run also runs again until it passes.

Each run updates the records, so the next run selects only the tests affected by the edits made in between. Git is not involved, so the flag works the same in a fresh container, in a temporary worktree, or in a directory that is not a repository. This makes it a good fit for AI coding agents that run tests after every edit:

```md [AGENTS.md]
- After a change, run `vitest run --since-last-run` to test only what the change affects.
- Before you finish, run `vitest run` once for the whole suite.
```

The flag is built on [`experimental.recordDependencies`](/config/experimental#experimental-recorddependencies) and the new `mtime` [VCS provider](/config/experimental#experimental-vcsprovider). Custom VCS providers now also receive a `resolver` that returns every file the test files of the run depend on. See [Running Only Affected Tests](/guide/recipes/affected-tests) to choose between `--changed` and `--since-last-run`.

## Interactive Snapshot Review

When snapshots fail in watch mode, the `u` key updates all of them at once. Vitest 5.1 adds an interactive review, inspired by [Insta's `review` command](https://insta.rs/docs/cli/#review), so you can check each change before you accept it. Press `i`, and Vitest shows the failed snapshots one at a time:

<<< ../guide/snippets/snapshot-review.ansi

Press `a` to accept the new snapshot or `r` to keep the old one. After the last snapshot, Vitest writes the accepted snapshots and reruns the test files that contain them. The review covers inline snapshots, `.snap` files, and [file snapshots](/guide/snapshot#file-snapshots), including [ARIA snapshots](/guide/snapshot#aria-snapshots) in Browser Mode.

## Trace View on Failure by Default

[Trace View](/guide/browser/trace-view), introduced in Vitest 5.0 as an experimental feature, is now stable and enabled by default in a new [`'failure-only'`](/config/browser/traceview#traceview-mode) mode. In this mode, Vitest keeps the trace only for tests that fail. A passing test records its steps in the browser, but it never takes a DOM snapshot or sends anything to the server, so the mode adds no measurable cost to passing tests.

When a browser test fails, the error report now ends with the steps that led to the failure:

<<< ../guide/browser/snippets/trace-failure.ansi [Error report]

The same trace, with a snapshot of the page at the moment of failure, is available in the browser UI, in Vitest UI, and in the [HTML reporter](/guide/reporters#html-reporter). To record every test with a snapshot at each step, set the mode to `'on'`:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      traceView: 'on', // 'failure-only' (default) | 'on' | 'off'
    },
  },
})
```

`browser.traceView.enabled` is deprecated in favor of `browser.traceView.mode`.

The trace viewer also captures the [accessibility tree](/guide/browser/trace-view#accessibility-tree) of the page with each snapshot. A selector in the viewer header switches between the **DOM** and **Aria** views. The Aria view shows the roles and accessible names that locators like `getByRole()` match against, in the same format as [ARIA snapshots](/guide/browser/aria-snapshots).

## Trace Timeline in Node Tests

The step timeline is not limited to Browser Mode. With the new experimental [`experimental.traceTimeline`](/config/experimental#experimental-tracetimeline) option, Vitest records the `expect.poll`, `vi.waitFor`, and `vi.waitUntil` steps of each test and prints them under the error when the test fails. This shows what the test waited on and how long each wait took, which helps with flaky tests that wait on servers, queues, or file watchers.

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    experimental: {
      traceTimeline: true,
    },
  },
})
```

<<< ../config/snippets/trace-timeline-failure.ansi [Error report]

Vitest keeps the steps only for failed attempts, so the option adds almost no cost to passing tests.

`vi.waitFor` and `vi.waitUntil` now accept a `message` option, like `expect.poll` already does. Vitest adds the message to the start of the error, and the message names the step in the timeline, as with `user saved (vi.waitUntil)` in the report above:

```ts
await vi.waitFor(() => server.ping(), { message: 'server started' })
// Error: server started: connect ECONNREFUSED
```

## Rerun Failures with `--last-failed`

Watch mode can already rerun failed tests with the `f` key. The new [`--last-failed`](/guide/cli#last-failed) flag does the same across separate processes: it reads the failures of the last run from the [results cache](/config/cache) and runs only those tests.

```sh
vitest run --last-failed

# combine with other filters
vitest run --last-failed -t login
```

Vitest selects the tests by their full names, so adding or moving other tests in the file does not change the selection. If a file failed outside of a test, for example in a `beforeAll` hook or during collection, the whole file runs. Custom integrations can use the same filter through the new [`TestSpecification.testNames`](/api/advanced/test-specification#testnames) property.

## Faster Module Mocking in Browser Mode

To mock a module in Browser Mode, Vitest intercepted the network requests of the page (with Playwright's `page.route`, or a Vite plugin for the other providers) and served the mocked code instead. Every request in the page paid for the interception, and the cost grew with the number of modules a test file imports.

Vitest 5.1 serves mocks through an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) instead. When a test file calls `vi.mock`, Vitest adds an import map rule that points the module URL to its mocked version. The browser loads the mocked module itself, so no request is intercepted, and the HTTP cache stays enabled.

On a [public benchmark](https://github.com/ubugeeei-reproductions/js-test-runner-competition) with 500 test files, 962 modules, and 1,883 mocks per suite (Chromium, 9 workers, median of 3 runs):

| Suite    | Vitest 5.0.3 | Vitest 5.1 | Change |
| -------- | -----------: | ---------: | -----: |
| No mocks |        31.7s |      26.6s |   −16% |
| Mocks    |        56.4s |      27.2s |   −52% |
| Mixed    |        44.0s |      27.1s |   −38% |

The new [`browser.importMapMocks`](/config/browser/importmapmocks) option is experimental. It is enabled when the browser supports multiple import maps per document (Chromium 133+, Safari 18.4+, and Firefox 150+ with the Playwright provider). In other browsers, and when [`isolate`](/config/isolate) is disabled, Vitest intercepts requests as before.

An import map cannot change a module that the page already imported, so Vitest now reports an error when a module was imported before `vi.mock` registered it, instead of silently using the original module. A mock factory can also only provide the exports that the original module declares. If this breaks your tests, set `browser.importMapMocks` to `false` and [let us know](https://github.com/vitest-dev/vitest/issues).

## Pointer API

The new experimental [`userEvent.pointer`](/api/browser/interactivity#userevent-pointer) method performs a sequence of low-level pointer actions. It uses the [user-event `pointer` syntax](https://testing-library.com/docs/user-event/pointer), so you can press, move, and release the pointer separately, for example to drag an element to an exact position:

```ts
import { test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

test('drags the card into the column', async () => {
  const card = page.getByRole('listitem', { name: 'Fix the login form' })
  const column = page.getByRole('list', { name: 'Done' })

  await userEvent.pointer([
    { target: card, keys: '[MouseLeft>]' },
    { target: column, coords: { x: 10, y: 10 }, keys: '[/MouseLeft]' },
  ])
})
```

## Fake Timers for `node:timers`

Fake timers replace the global `setTimeout` and similar functions, but code that imports them from `node:timers` or `node:timers/promises` kept the real timers. With the new [`fakeNodeBuiltins`](/config/faketimers#faketimers-fakenodebuiltins) option, Vitest also fakes these modules, including named imports and `require` calls:

```ts
import { setTimeout as sleep } from 'node:timers/promises'
import { expect, test, vi } from 'vitest'

test('resolves after the delay', async () => {
  vi.useFakeTimers({ fakeNodeBuiltins: true })

  const resolved = vi.fn()
  sleep(1000).then(resolved)

  await vi.advanceTimersByTimeAsync(1000)
  expect(resolved).toHaveBeenCalled()
})
```

::: tip
`fakeNodeBuiltins` is disabled by default. We plan to enable it by default in the next major version. To prepare for it, set [`fakeTimers.fakeNodeBuiltins`](/config/faketimers#faketimers-fakenodebuiltins) to `true` in your config now.
:::

[`vi.setSystemTime`](/api/vi#vi-setsystemtime) now also accepts a `Temporal.Instant` or a `Temporal.ZonedDateTime`. A `ZonedDateTime` sets the mocked time, but it does not change the time zone of the environment:

```ts
vi.setSystemTime(Temporal.Instant.from('2026-11-02T09:00:00Z'))
```

In Browser Mode, locator actions like `click` and `fill`, and `expect.element`, now advance fake timers while they wait for the element, the same way `expect.poll` and `vi.waitFor` do. Before, an action timed out if the element appeared only after a faked `setTimeout`.

## Results of Each Attempt

A test runs more than once when it has [`retry`](/config/retry) or [`repeats`](/api/test#repeats). Until now, `TestCase.result()` reported only the final state and merged the errors of all runs. The new [`TestCase.attempts()`](/api/advanced/test-case#attempts) method returns the state, errors, and timing of each run separately, so a reporter can find tests that passed only after a retry:

```ts [flaky-reporter.ts]
import type { Reporter } from 'vitest/node'

export default {
  onTestCaseResult(testCase) {
    const attempts = testCase.attempts()

    if (testCase.result().state === 'passed' && attempts.length > 1) {
      console.warn(`${testCase.fullName} passed after ${attempts.length} attempts`)
    }
  },
} satisfies Reporter
```

The default reporter also uses this information. A test that fails in several attempts now prints one header with the attempts, instead of one identical header per attempt:

```
 FAIL  basic.test.js > always fails (initial run, 1st retry, 2nd retry)
AssertionError: expected 1 to be 2 // Object.is equality
```

## Coverage Improvements

The HTML coverage report has new light and dark themes that match the Vitest style. The report follows your OS color preference, and the theme picker in the report keeps your choice. Inside Vitest UI, the report uses the theme of the UI. To keep the original Istanbul style, set `theme: 'legacy'` in the [reporter options](/guide/coverage#html-report-theme):

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      reporter: [['html', { theme: 'legacy' }]], // 'light' | 'dark' | 'legacy'
    },
  },
})
```

<center>
  <img alt="HTML coverage report in light theme" img-light src="/coverage-report-theme-light.png">
  <img alt="HTML coverage report in dark theme" img-dark src="/coverage-report-theme-dark.png">

<sup>The HTML coverage report with the new theme.</sup>
</center>

The `istanbul` provider is much faster. The [`@vitest/istanbuljs`](https://github.com/vitest-dev/istanbuljs) packages no longer use Babel: they parse the code with [Oxc](https://oxc.rs) through Rolldown and insert the coverage counters with `magic-string`. This makes instrumentation 5 to 10 times faster and uses less memory. For example, the instrumentation of the 479 source files of the Vitest repository went from 3.7s to 0.38s. The instrumented code also no longer includes the input source maps, which reduces the code sent to the workers by about 26%.

The `v8` provider has a new [`coverage.ignoreNode`](/config/coverage#coverage-ignorenode) option. It ignores code by its AST node, which is useful for code that a compiler or a plugin generates and that cannot have an [ignore hint](/guide/coverage#ignoring-code), like the cache branches that the React Compiler adds to every component:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      ignoreNode: (node, type) =>
        type === 'statement'
        && node.type === 'ExpressionStatement'
        && node.expression.type === 'CallExpression'
        && node.expression.callee.type === 'Identifier'
        && node.expression.callee.name === '__generatedHelper',
    },
  },
})
```

## Performance Improvements

- **Reused workers with `isolate: false`.** Workers now cache the resolution of setup files and their mocks, and they no longer request a new snapshot of warm modules for every test file. On a [benchmark](https://github.com/vitest-dev/benchmarks) with 800 test files, the resolution cache saves about 10%, and the warm modules change saves up to 18% when every test file imports a large shared module tree.
- **Typed arrays in `toEqual`.** Vitest compares typed arrays in one loop. A `toEqual` of two 2 MiB arrays went from about 1.5s to 125ms.
- **Trace View in Firefox.** Vitest resolves only the first usable stack frame of each step. With the `'on'` mode, a test with 200 `expect.element` calls went from 5.7s to 0.33s in Firefox.
- **Browser Mode under load.** The WebSocket server now handles messages of all browsers in turn, so a busy browser no longer delays the actions of other browsers until they time out.

## Other Changes

- The default port in Browser Mode is now `23315` instead of `63315`. Windows can reserve the old port when Hyper-V, WSL2, or Docker Desktop runs, and Vitest then failed to start. If your setup depends on the old port, set [`api.port`](/config/api).
- [`api.port: 0`](/config/api) now lets the OS choose a free port. This requires Vite 8.2.1 or newer.
- If a browser test file cannot connect to the server, the run now fails with an error instead of waiting forever.

The complete list of changes is at the [Vitest 5.1 Changelog](https://github.com/vitest-dev/vitest/releases/tag/v5.1.0).

## Acknowledgments

Vitest 5.1 is the result of countless hours of work by the [Vitest team](/team) and our contributors. None of it would be possible without the individuals and companies that sponsor Vitest. [Vladimir](https://github.com/sheremet-va) and [Hiroshi](https://github.com/hi-ogawa) work on Vite and Vitest full-time at [VoidZero](https://voidzero.dev), and [Chromatic](https://www.chromatic.com/) gives [Ari](https://github.com/ariperkkio) the time to keep pushing Vitest forward. Vitest also sponsors [Raul](https://github.com/macarie)'s work as a member of the Vitest team through the [Cloudflare](https://opencollective.com/cloudflare) fund. A big thank you to everyone supporting us through [GitHub Sponsors](https://github.com/sponsors/vitest-dev) and [Open Collective](https://opencollective.com/vitest).
