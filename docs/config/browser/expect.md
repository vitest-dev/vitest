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
            path.resolve('custom-screenshots', testFileName, `${arg}-${browserName}${ext}`),
        },
      },
    },
  },
})
```

[All options available in the `toMatchScreenshot` assertion](/api/browser/assertions#options) can be configured here. Additionally, [`screenshotDirectory`][screenshotDirectory], [`resolveScreenshotPath`][resolveScreenshotPath], [`resolveDiffPath`][resolveDiffPath], and [`io`](#browser-expect-toMatchScreenshot-io) let you customize where and how screenshots are stored.

## browser.expect.toMatchScreenshot.screenshotDirectory

- **Type:** `string | undefined`
- **Default:** `__screenshots__`

The directory name used for storing reference screenshots.

This value is passed as `screenshotDirectory` to [`resolveScreenshotPath`][resolveScreenshotPath] and [`resolveDiffPath`][resolveDiffPath], and used in the default path resolution of [`resolveScreenshotPath`][resolveScreenshotPath].

## browser.expect.toMatchScreenshot.resolveScreenshotPath

- **Type:** `(data: PathResolveData) => string`
- **Default output:** ``path.resolve(root, testFileDirectory, screenshotDirectory, testFileName, `${arg}-${browserName}-${platform}${ext}`)``

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

  The value provided to [`screenshotDirectory`][screenshotDirectory], if none is provided, its default value (`__screenshots__`).

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

- `project: TestProject` <Version type="experimental">4.1.6</Version> <Experimental />

  The [`TestProject`](/api/advanced/test-project) the test belongs to.

For example, to group screenshots by browser:

```ts
resolveScreenshotPath: ({ arg, browserName, ext, root, testFileName }) =>
  path.resolve(root, 'screenshots', browserName, testFileName, `${arg}${ext}`)
```

## browser.expect.toMatchScreenshot.resolveDiffPath

- **Type:** `(data: PathResolveData) => string`
- **Default output:** ``path.resolve(root, attachmentsDir, testFileDirectory, testFileName, `${arg}-${browserName}-${platform}${ext}`)``

A function to customize where diff images are stored when screenshot comparisons fail. Receives the same data object as [`resolveScreenshotPath`][resolveScreenshotPath].

For example, to store diffs in a subdirectory of attachments:

```ts
resolveDiffPath: ({ arg, attachmentsDir, browserName, ext, root, testFileName }) =>
  path.resolve(root, attachmentsDir, 'screenshot-diffs', testFileName, `${arg}-${browserName}${ext}`)
```

## browser.expect.toMatchScreenshot.io <Version type="experimental">5.0.0</Version> <Experimental /> {#browser-expect-toMatchScreenshot-io}

- **Type:** `{ read: Read; write: Write }`
- **Default:** Node's `fs` module, reading/writing at the paths resolved by [`resolveScreenshotPath`][resolveScreenshotPath] and [`resolveDiffPath`][resolveDiffPath].

Overrides the filesystem access used to read and write screenshots, letting you redirect reference, actual, and diff images to a different storage backend (e.g. object storage or a remote service) instead of the local filesystem.

### io.read

- **Type:** `(data: ReadData) => Promise<TypedArray | null>`

Reads image data from `path`. Should return `null` if no data exists at `path` (e.g. no reference screenshot has been captured yet). The function receives an object with the following properties:

- `path: string`

  The path resolved by [`resolveScreenshotPath`][resolveScreenshotPath].

- `project: TestProject`

  The [`TestProject`](/api/advanced/test-project) the test belongs to.

### io.write

- **Type:** `(data: WriteData) => Promise<void>`

Writes image `data` to `path`. The function receives an object with the following properties:

- `path: string`

  The path resolved by [`resolveScreenshotPath`][resolveScreenshotPath] or [`resolveDiffPath`][resolveDiffPath].

- `data: TypedArray`

  The image data to write, as a `Buffer` or `Uint8Array`.

- `kind: 'reference' | 'actual' | 'diff'`

  Indicates which type of image is being written, so implementations can apply different handling (e.g. retention policies) for reference, actual, and diff images.

- `project: TestProject`

  The [`TestProject`](/api/advanced/test-project) the test belongs to.

::: tip
`path` here is whatever [`resolveScreenshotPath`][resolveScreenshotPath] or [`resolveDiffPath`][resolveDiffPath] resolved to. It doesn't have to be a filesystem path.

If you're writing to a non-filesystem backend, you can use those functions to return a key (e.g. an S3 object key) instead of an absolute path.
:::

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

[resolveDiffPath]: #browser-expect-toMatchScreenshot-resolveDiffPath
[resolveScreenshotPath]: #browser-expect-toMatchScreenshot-resolveScreenshotPath
[screenshotDirectory]: #browser-expect-toMatchScreenshot-screenshotDirectory
