---
title: Visual Regression Testing
outline: deep
---

# Visual Regression Testing

Since version 3.3, Vitest can run visual regression tests out of the box. It
captures screenshots of your UI components and pages, then compares them
against reference images to detect unintended visual changes.

Unlike functional tests that verify behavior, visual tests catch styling issues,
layout shifts, and rendering problems that might otherwise go unnoticed without
thorough manual testing.

## Why Visual Regression Testing?

Visual bugs don’t throw errors, they just look wrong. That’s where visual
testing comes in.

- That button still submits the form... but why is it hot pink now?
- The text fits perfectly... until someone views it on mobile
- Everything works great... except those two containers are out of viewport
- That careful CSS refactor works... but broke the layout on a page no one tests

Visual regression testing acts as a safety net for your UI, automatically
catching these visual changes before they reach production.

## Getting Started

::: warning Browser Rendering Differences
Visual regression tests are **inherently unstable across different
environments**. Screenshots will look different on different machines because
of:

- Font rendering (the big one. Windows, macOS, Linux, they all render text
differently)
- GPU drivers and hardware acceleration
- Whether you're running headless or not
- Browser settings and versions
- ...and honestly, sometimes just the phase of the moon

That's why Vitest includes the browser and platform in screenshot names (like
`button-chromium-darwin.png`).

For stable tests, use the same environment everywhere. We **strongly recommend**
cloud services like
[Microsoft Playwright Testing](https://azure.microsoft.com/en-us/products/playwright-testing)
or [Docker containers](https://playwright.dev/docs/docker).
:::

Visual regression testing in Vitest can be done through the
[`toMatchScreenshot` assertion](/guide/browser/assertion-api.html#tomatchscreenshot):

```ts
import { expect, test } from 'vitest'
import { page } from '@vitest/browser/context'

test('hero section looks correct', async () => {
  // ...the rest of the test

  // capture and compare screenshot
  await expect(page.getByTestId('hero')).toMatchScreenshot('hero-section')
})
```

### Creating References

When you run a visual test for the first time, Vitest creates a reference (also
called baseline) screenshot and fails the test with the following error message:

```
expect(element).toMatchScreenshot()

No existing reference screenshot found; a new one was created. Review it before running tests again.

Reference screenshot:
  tests/__screenshots__/hero.test.ts/hero-section-chromium-darwin.png
```

This is normal. Check that the screenshot looks right, then run the test again.
Vitest will now compare future runs against this baseline.

::: tip
Reference screenshots live in `__screenshots__` folders next to your tests.
**Don't forget to commit them!**
:::

### Screenshot Organization

By default, screenshots are organized as:

```
.
├── __screenshots__
│   └── test-file.test.ts
│       ├── test-name-chromium-darwin.png
│       ├── test-name-firefox-linux.png
│       └── test-name-webkit-win32.png
└── test-file.test.ts
```

The naming convention includes:
- **Test name**: either the first argument of the `toMatchScreenshot()` call,
or automatically generated from the test's name.
- **Browser name**: `chrome`, `chromium`, `firefox` or `webkit`.
- **Platform**: `aix`, `darwin`, `freebsd`, `linux`, `openbsd`, `sunos`, or
`win32`.

This ensures screenshots from different environments don't overwrite each other.

### Updating References

When you intentionally change your UI, you'll need to update the reference
screenshots:

```bash
$ vitest --update
```

Review updated screenshots before committing to make sure changes are
intentional.

## Configuring Visual Tests

### Global Configuration

Configure visual regression testing defaults in your
[Vitest config](/guide/browser/config#browser-expect-tomatchscreenshot):

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      expect: {
        toMatchScreenshot: {
          comparatorName: 'pixelmatch',
          comparatorOptions: {
            // 0-1, how different can colors be?
            threshold: 0.2,
            // 1% of pixels can differ
            allowedMismatchedPixelRatio: 0.01,
          },
        },
      },
    },
  },
})
```

### Per-Test Configuration

Override global settings for specific tests:

```ts
await expect(element).toMatchScreenshot('button-hover', {
  comparatorName: 'pixelmatch',
  comparatorOptions: {
    // more lax comparison for text-heavy elements
    allowedMismatchedPixelRatio: 0.1,
  },
})
```

## Best Practices

### Test Specific Elements

Unless you explicitly want to test the whole page, prefer capturing specific
components to reduce false positives:

```ts
// ❌ Captures entire page; prone to unrelated changes
await expect(page).toMatchScreenshot()

// ✅ Captures only the component under test
await expect(page.getByTestId('product-card')).toMatchScreenshot()
```

### Handle Dynamic Content

Dynamic content like timestamps, user data, or random values will cause tests
to fail. You can either mock the sources of dynamic content or mask them when
using the Playwright provider by using the
[`mask` option](https://playwright.dev/docs/api/class-page#page-screenshot-option-mask)
in `screenshotOptions`.

```ts
await expect(page.getByTestId('profile')).toMatchScreenshot({
  screenshotOptions: {
    mask: [page.getByTestId('last-seen')],
  },
})
```

### Disable Animations

Animations can cause flaky tests. Disable them during testing by injecting
a custom CSS snippet:

```css
*, *::before, *::after {
  animation-duration: 0s !important;
  animation-delay: 0s !important;
  transition-duration: 0s !important;
  transition-delay: 0s !important;
}
```

::: tip
When using the Playwright provider, animations are automatically disabled
when using the assertion: the `animations` option's value in `screenshotOptions`
is set to `"disabled"` by default.
:::

### Set Appropriate Thresholds

Tuning thresholds is tricky. It depends on the content, test environment,
what's acceptable for your app, and might also change based on the test.

Vitest does not set a default for the mismatching pixels, that's up for the
user to decide based on their needs. The recommendation is to use
`allowedMismatchedPixelRatio`, so that the threshold is computed on the size
of the screenshot and not a fixed number.

When setting both `allowedMismatchedPixelRatio` and
`allowedMismatchedPixels`, Vitest uses whichever limit is stricter.

### Set consistent viewport sizes

As the browser instance might have a different default size, it's best to
set a specific viewport size, either on the test or the instance
configuration:

```ts
// test.spec.ts
await page.viewport(1280, 720)
```

```ts
// vitest.config.ts
export default defineConfig({
  browser: {
    enabled: true,
    provider: 'playwright',
    instances: [
      {
        browser: 'chromium',
        viewport: {
          width: 1280,
          height: 720,
        },
      },
    ],
  },
})
```

### Use Git LFS

Store reference screenshots in
[Git LFS](https://github.com/git-lfs/git-lfs?tab=readme-ov-file) if you plan to
have a large test suite.

## Debugging Failed Tests

When a visual test fails, Vitest provides three images to help debug:

1. **Reference screenshot**: the expected baseline image
1. **Actual screenshot**: what was captured during the test
1. **Diff image**: highlights the differences, but this might not get generated

You'll see something like:

```
expect(element).toMatchScreenshot()

Screenshot does not match the stored reference.
245 pixels (ratio 0.03) differ.

Reference screenshot:
  tests/__screenshots__/button.test.ts/button-chromium-darwin.png

Actual screenshot:
  tests/.vitest-attachments/button.test.ts/button-chromium-darwin-actual.png

Diff image:
  tests/.vitest-attachments/button.test.ts/button-chromium-darwin-diff.png
```

### Understanding the diff image

- **Red pixels** are areas that differ between reference and actual
- **Yellow pixels** are anti-aliasing differences (when anti-alias is not ignored)
- **Transparent/original** are unchanged areas

:::tip
If the diff is mostly red, something's really wrong. If it's speckled with a
few red pixels around text, you probably just need to bump your threshold.
:::

## Common Issues and Solutions

### False Positives from Font Rendering

Font availability and rendering varies significantly between systems. Some
possible solutions might be to:

- Use web fonts and wait for them to load:

  ```ts
  // wait for fonts to load
  await document.fonts.ready

  // continue with your tests
  ```

- Increase comparison threshold for text-heavy areas:

  ```ts
  await expect(page.getByTestId('article-summary')).toMatchScreenshot({
    comparatorName: 'pixelmatch',
    comparatorOptions: {
      // 10% of the pixels are allowed to change
      allowedMismatchedPixelRatio: 0.1,
    },
  })
  ```

- Use a cloud service or containerized environment for consistent font rendering.

### Flaky Tests or Different Screenshot Sizes

If tests pass and fail randomly, or if screenshots have different dimensions
between runs:

- Wait for everything to load, including loading indicators
- Set explicit viewport sizes: `await page.viewport(1920, 1080)`
- Check for responsive behavior at viewport boundaries
- Check for unintended animations or transitions
- Increase test timeout for large screenshots
- Use a cloud service or containerized environment
