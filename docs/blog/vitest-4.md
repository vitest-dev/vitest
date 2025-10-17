---
title: Vitest 4.0 is out!
author:
  name: The Vitest Team
date: 2025-12-31
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

_January 1, 2025_

![Vitest 4 Announcement Cover Image](/og-vitest-4.jpg)

<!-- placeholder -->

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

## Browser Mode is Stable

With this release we are removing the `experimental` tag from [Browser Mode](/guide/browser). To make it possible, we had to introduce some changes to the public API.

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
import { playwright } from '@vitest/browser-webdriverio' // [!code ++]
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
import { playwright } from '@vitest/browser-preview' // [!code ++]

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

The context is no longer imported from `@vitest/browser/context` (but it will keep working for better compatibility with tools that did not update yet), now just import from `vitest/browser`:

```ts
import { page } from '@vitest/browser/context' // [!code --]
import { page } from 'vitest/browser' // [!code ++]

test('example', async () => {
  await page.getByRole('button').click()
})
```

With these changes, the `@vitest/browser` package is no longer needed, and you can remove it from your dependencies.

## Visual Regression Testing

Vitest 4 adds support for [Visual Regression testing](/guide/browser/visual-regression-testing.md) in Browser Mode. We will continue to iterate over this feature to improve the feel of it.

Visual regression testing in Vitest can be done through the
[`toMatchScreenshot` assertion](/guide/browser/assertion-api.html#tomatchscreenshot):

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

## Breaking changes

Vitest 4 has a few breaking changes that could affect you, so we advise reviewing the detailed [Migration Guide](/guide/migration#vitest-4) before upgrading.

The complete list of changes is at the [Vitest 4 Changelog](https://github.com/vitest-dev/vitest/releases/tag/v4.0.0).

## Acknowledgments

Vitest 4 is the result of countless hours by the [Vitest team](/team) and our contributors. We appreciate the individuals and companies sponsoring Vitest development. [Vladimir](https://github.com/sheremet-va) and [Hiroshi](https://github.com/hi-ogawa) are part of the [VoidZero](https://voidzero.dev) Team and are able to work on Vite and Vitest full-time, and [Ari](https://github.com/ariperkkio) can invest more time in Vitest thanks to [StackBlitz](https://stackblitz.com/). A shout-out to [NuxtLabs](https://nuxtlabs.com), [Zammad](https://zammad.com), and sponsors on [Vitest's GitHub Sponsors](https://github.com/sponsors/vitest-dev) and [Vitest's Open Collective](https://opencollective.com/vitest).
