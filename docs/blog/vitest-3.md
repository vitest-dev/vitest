# Vitest 3

We released Vitest 2 half a year ago. We have seen huge adoption, from 4,8M to 7,7M weekly npm downloads. Our ecosystem is growing too, with [Storybook doing cool stuff with our vscode extension and browser mode](https://storybook.js.org/docs/writing-tests/test-addon) and Matt Pocock building [evalite](https://www.evalite.dev/), the first GenAI-powered test tool, on top of Vitest.

Today, we are thrilled to announce Vitest 3! This is a big one!

## Reporter Updates

[@AriPerkkio](https://github.com/ariperkkio) rewrote how Vitest reports the test run. You should see less flicker and more stable output!

<div class="flex align-center justify-center">
  <video controls>
    <source src="/new-reporter.webm" type="video/webm">
  </video>
</div>

Alongside this change, we also redesign the public reporter API (the `reporters` field) making the [lifecycle](/advanced/api/reporter) easier to understand.

You can follow the design process in [#7069](https://github.com/vitest-dev/vitest/pull/7069) PR. It was a hard fight trying to reverse-engineer the previous `onTaskUpdate` API to make this new elegant lifecycle possible.

<div class="flex align-center justify-center">
  <img src="/on-task-update.gif" />
</div>

## Inline Workspace

Rejoice! No more separate files to define your [workspace](/guide/workspace) - specify an array of projects using the `workspace` field in your `vitest.config` file:

```jsx
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    workspace: ['packages/*'],
  },
})
```

## Multi-Browser Configuration

Vitest 3 introduces a more performant way to run your browser tests in different browsers or setups. Instead of using the workspace, you can define an array of [`instances`](/guide/browser/multiple-setups) to run your browser tests in different setups:

```jsx
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      provider: 'playwright',
      instances: [
        {
          browser: 'chromium',
          launch: { devtools: true },
        },
        {
          browser: 'firefox',
          setupFiles: ['./setup.firefox.ts'],
          provide: {
            secret: 'my-secret',
          },
        },
      ],
    }
  }
})
```

The main advantage of `instances` over `workspace` is a better caching strategy - Vitest creates only a single Vite server to serve files, - they are processed only onece independently from how many browsers you test.

This release also improves the documentation of Browser Mode features and introduces separate guides for [Playwright](/guide/browser/playwright) and [WebdriverIO](/guide/browser/webdriverio) hopefully making it easier to configure.

## Filtering by Location

In Vitest 3 you can now filter tests by line number.

```
$ vitest basic/foo.js:10
$ vitest ./basic/foo.js:10
```

A big shutout to [@mzhubail](https://github.com/mzhubail) for implementing this feature.

## Public API

We have redesigned the public API available from `vitest/node` and are planning to remove the experimental tag in the next minor version. This release also includes brand new documentation covering all exposed methods.

<img alt="Vitest API documentation" img-light src="/docs-api-light.png">
<img alt="Vitest API documentation" img-dark src="/docs-api-dark.png">

## Breaking changes

Vitest 3 has a few small breaking changes that should not affect most users, but we advise reviewing the detailed [Migration Guide](/guide/migration.html#vitest-3) before upgrading.

## Acknowledgments

Vitest 3 is the result of uncountable hours by the Vitest team (especial shutout to the work of [Vladimir](https://github.com/sheremet-va), [Ari](https://github.com/ariperkkio), and [Hiroshi](https://github.com/ariperkkio)) and contributors. We also want to thank our main sponsors: <!-- list sponsors -->
