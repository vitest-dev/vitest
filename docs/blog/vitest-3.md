---
title: Vitest 3.0 is out!
author:
  name: The Vitest Team
date: 2025-01-17
sidebar: false
head:
  - - meta
    - property: og:type
      content: website
  - - meta
    - property: og:title
      content: Announcing Vitest 3.0
  - - meta
    - property: og:image
      content: https://vitest.dev/og-vitest-3.jpg
  - - meta
    - property: og:url
      content: https://vitest.dev/blog/vitest-3
  - - meta
    - property: og:description
      content: Vitest 3.0 Release Announcement
  - - meta
    - name: twitter:card
      content: summary_large_image
---

# Vitest 3.0 is out!

_January 17, 2025_

![Vitest 3 Announcement Cover Image](/og-vitest-3.jpg)

We released Vitest 2 half a year ago. We have seen huge adoption, from 4,8M to 7,7M weekly npm downloads. Our ecosystem is growing rapidly too. Among others, [Storybook new testing capabilities powered by our vscode extension and browser mode](https://storybook.js.org/docs/writing-tests/test-addon) and Matt Pocock is building [Evalite](https://www.evalite.dev/), a tool for evaluating AI-powered apps, on top of Vitest.

## The next Vitest major is here

Today, we are thrilled to announce Vitest 3! This is a big one!

Quick links:

- [Docs](/)
- Translations: [简体中文](https://cn.vitest.dev/)
- [Migration Guide](/guide/migration)
- [GitHub Changelog](https://github.com/vitest-dev/vitest/releases/tag/v3.0.0)

If you've not used Vitest before, we suggest reading the [Getting Started](/guide/) and [Features](/guide/features) guides first.

We extend our gratitude to the over [550 contributors to Vitest Core](https://github.com/vitest-dev/vitest/graphs/contributors) and to the maintainers and contributors of Vitest integrations, tools, and translations who have helped us develop this new major release. We encourage you to get involved and help us improve Vitest for the entire ecosystem. Learn more at our [Contributing Guide](https://github.com/vitest-dev/vitest/blob/main/CONTRIBUTING.md).

To get started, we suggest helping [triage issues](https://github.com/vitest-dev/vitest/issues), [review PRs](https://github.com/vitest-dev/vitest/pulls), send failing tests PRs based on open issues, and support others in [Discussions](https://github.com/vitest-dev/vitest/discussions) and Vitest Land's [help forum](https://discord.com/channels/917386801235247114/1057959614160851024). If you'd like to talk to us, join our [Discord community](http://chat.vitest.dev/) and say hi on the [#contributing channel](https://discord.com/channels/917386801235247114/1057959614160851024).

For the latest news about the Vitest ecosystem and Vitest core, follow us on [Bluesky](https://bsky.app/profile/vitest.dev) or [Mastodon](https://webtoo.ls/@vitest).

## Reporter Updates

[@AriPerkkio](https://github.com/ariperkkio) rewrote how Vitest reports the test run. You should see less flicker and more stable output!

<div class="flex align-center justify-center">
  <video controls>
    <source src="/new-reporter.webm" type="video/webm">
  </video>
</div>

Alongside this change, we also redesign the public reporter API (the `reporters` field) making the [lifecycle](/advanced/api/reporters) easier to understand.

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

The main advantage of `instances` over `workspace` is a better caching strategy - Vitest creates only a single Vite server to serve files, which are processed only once, independent of how many browsers you test.

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

The complete list of changes is at the [Vitest 3 Changelog](https://github.com/vitest-dev/vitest/releases/tag/v3.0.0).

## Acknowledgments

Vitest 3 is the result of countless hours by the [Vitest team](/team) and our contributors. We appreciate the individuals and companies sponsoring Vitest development. [Vladimir](https://github.com/sheremet-va) and [Hiroshi](https://github.com/hi-ogawa) joined [VoidZero](https://voidzero.dev) to work on Vite and Vitest full-time, and [StackBlitz](https://stackblitz.com/) hired [Ari](https://github.com/ariperkkio) to invest more time in Vitest development. A shout-out to [NuxtLabs](https://nuxtlabs.com), [Zammad](https://zammad.com), and sponsors on [Vitest's GitHub Sponsors](https://github.com/sponsors/vitest-dev) and [Vitest's Open Collective](https://opencollective.com/vitest).
