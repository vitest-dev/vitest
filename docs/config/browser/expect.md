---
title: browser.expect | Config
outline: deep
---

# browser.expect

- **Type:** `ExpectOptions`

## browser.expect.toMatchScreenshot

Default options for the
[`toMatchScreenshot` assertion](/api/browser/assertions.html#tomatchscreenshot).
These options will be applied to all screenshot assertions.

::: tip
Setting global defaults for screenshot assertions helps maintain consistency
across your test suite and reduces repetition in individual tests. You can still
override these defaults at the assertion level when needed for specific test cases.
:::

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      expect: {
        toMatchScreenshot: {
          comparatorName: 'pixelmatch',
          comparatorOptions: {
            threshold: 0.2,
            allowedMismatchedPixels: 100,
          },
          resolveScreenshotPath: ({ arg, browserName, ext, testFileName }) =>
            `custom-screenshots/${testFileName}/${arg}-${browserName}${ext}`,
        },
      },
    },
  },
})
```

[All options available in the `toMatchScreenshot` assertion](/api/browser/assertions#options)
can be configured here. Additionally, two path resolution functions are
available: `resolveScreenshotPath` and `resolveDiffPath`.

## browser.expect.toMatchScreenshot.resolveScreenshotPath

- **Type:** `(data: PathResolveData) => string`
- **Default output:** `` `${root}/${testFileDirectory}/${screenshotDirectory}/${testFileName}/${arg}-${browserName}-${platform}${ext}` ``

A function to customize where reference screenshots are stored. The function
receives an object with the following properties:

- `arg: string`

  Path **without** extension, sanitized and relative to the test file.

  This comes from the arguments passed to `toMatchScreenshot`; if called
  without arguments this will be the auto-generated name.

  ```ts
  test('calls `onClick`', () => {
    expect(locator).toMatchScreenshot()
    // arg = "calls-onclick-1"
  })

  expect(locator).toMatchScreenshot('foo/bar/baz.png')
  // arg = "foo/bar/baz"

  expect(locator).toMatchScreenshot('../foo/bar/baz.png')
  // arg = "foo/bar/baz"
  ```

- `ext: string`

  Screenshot extension, with leading dot.

  This can be set through the arguments passed to `toMatchScreenshot`, but
  the value will fall back to `'.png'` if an unsupported extension is used.

- `browserName: string`

  The instance's browser name.

- `platform: NodeJS.Platform`

  The value of
  [`process.platform`](https://nodejs.org/docs/v22.16.0/api/process.html#processplatform).

- `screenshotDirectory: string`

  The value provided to
  [`browser.screenshotDirectory`](/config/browser/screenshotdirectory),
  if none is provided, its default value.

- `root: string`

  Absolute path to the project's [`root`](/config/root).

- `testFileDirectory: string`

  Path to the test file, relative to the project's [`root`](/config/root).

- `testFileName: string`

  The test's filename.

- `testName: string`

  The [`test`](/api/test)'s name, including parent
  [`describe`](/api/describe), sanitized.

- `attachmentsDir: string`

  The value provided to [`attachmentsDir`](/config/attachmentsdir), if none is
  provided, its default value.

For example, to group screenshots by browser:

```ts
resolveScreenshotPath: ({ arg, browserName, ext, root, testFileName }) =>
  `${root}/screenshots/${browserName}/${testFileName}/${arg}${ext}`
```

## browser.expect.toMatchScreenshot.resolveDiffPath

- **Type:** `(data: PathResolveData) => string`
- **Default output:** `` `${root}/${attachmentsDir}/${testFileDirectory}/${testFileName}/${arg}-${browserName}-${platform}${ext}` ``

A function to customize where diff images are stored when screenshot comparisons
fail. Receives the same data object as
[`resolveScreenshotPath`](#browser-expect-tomatchscreenshot-resolvescreenshotpath).

For example, to store diffs in a subdirectory of attachments:

```ts
resolveDiffPath: ({ arg, attachmentsDir, browserName, ext, root, testFileName }) =>
  `${root}/${attachmentsDir}/screenshot-diffs/${testFileName}/${arg}-${browserName}${ext}`
```

## browser.expect.toMatchScreenshot.comparators

- **Type:** `Record<string, Comparator>`

Register custom screenshot comparison algorithms, like [SSIM](https://en.wikipedia.org/wiki/Structural_similarity_index_measure) or other perceptual similarity metrics.

To create a custom comparator, you need to register it in your config. If using TypeScript, declare its options in the `ScreenshotComparatorRegistry` interface.

```ts
import { defineConfig } from 'vitest/config'

// 1. Declare the comparator's options type
declare module 'vitest/browser' {
  interface ScreenshotComparatorRegistry {
    myCustomComparator: {
      sensitivity?: number
      ignoreColors?: boolean
    }
  }
}

// 2. Implement the comparator
export default defineConfig({
  test: {
    browser: {
      expect: {
        toMatchScreenshot: {
          comparators: {
            myCustomComparator: async (
              reference,
              actual,
              {
                createDiff, // always provided by Vitest
                sensitivity = 0.01,
                ignoreColors = false,
              }
            ) => {
              // ...algorithm implementation
              return { pass, diff, message }
            },
          },
        },
      },
    },
  },
})
```

Then use it in your tests:

```ts
await expect(locator).toMatchScreenshot({
  comparatorName: 'myCustomComparator',
  comparatorOptions: {
    sensitivity: 0.08,
    ignoreColors: true,
  },
})
```

**Comparator Function Signature:**

```ts
type Comparator<Options> = (
  reference: {
    metadata: { height: number; width: number }
    data: TypedArray
  },
  actual: {
    metadata: { height: number; width: number }
    data: TypedArray
  },
  options: {
    createDiff: boolean
  } & Options
) => Promise<{
  pass: boolean
  diff: TypedArray | null
  message: string | null
}> | {
  pass: boolean
  diff: TypedArray | null
  message: string | null
}
```

The `reference` and `actual` images are decoded using the appropriate codec (currently only PNG). The `data` property is a flat `TypedArray` (`Buffer`, `Uint8Array`, or `Uint8ClampedArray`) containing pixel data in RGBA format:

- **4 bytes per pixel**: red, green, blue, alpha (from `0` to `255` each)
- **Row-major order**: pixels are stored left-to-right, top-to-bottom
- **Total length**: `width × height × 4` bytes
- **Alpha channel**: always present. Images without transparency have alpha values set to `255` (fully opaque)

::: tip Performance Considerations
The `createDiff` option indicates whether a diff image is needed. During [stable screenshot detection](/guide/browser/visual-regression-testing#how-visual-tests-work), Vitest calls comparators with `createDiff: false` to avoid unnecessary work.

**Respect this flag to keep your tests fast**.
:::

::: warning Handle Missing Options
The `options` parameter in `toMatchScreenshot()` is optional, so users might not provide all your comparator options. Always make them optional with default values:

```ts
myCustomComparator: (
  reference,
  actual,
  { createDiff, threshold = 0.1, maxDiff = 100 },
) => {
  // ...comparison logic
}
```
:::
