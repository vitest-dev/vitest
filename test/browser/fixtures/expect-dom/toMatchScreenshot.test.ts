import { afterEach, describe, expect, test } from 'vitest'
import { extractToMatchScreenshotPaths, render } from './utils'
import { page, server } from 'vitest/browser'
import { join } from 'pathe'

const blockSize = 19
const blocks = 5
const dataTestId = 'colors-box'

const renderTestCase = (colors: readonly [string, string, string]) =>
  render(`
    <div style="--size: ${blockSize}px; display: flex; justify-content: center; height: var(--size); width: calc(var(--size) * ${blocks});" data-testid="${dataTestId}">
      <div data-testid="${dataTestId}-1" style="background-color: ${colors[0]}; width: var(--size);"></div>
      <div data-testid="${dataTestId}-2" style="background-color: ${colors[1]}; width: var(--size);"></div>
      <div data-testid="${dataTestId}-3" style="background-color: ${colors[2]}; width: var(--size);"></div>
    </div>
  `)

declare module 'vitest/browser' {
  interface ScreenshotComparatorRegistry {
    failing: Record<string, never>
  }
}

/**
 * ## Screenshot Testing Strategy
 *
 * Tests create reference screenshots on-the-fly on demand, then compare
 * against them. References are cleaned up after each test.
 *
 * Screenshot references are unstable across environments (headless vs UI mode,
 * different operating systems, different browsers). Storing references for
 * every environment combination would create a maintenance burden.
 */
describe('.toMatchScreenshot', () => {
  test('compares screenshots correctly', async ({ onTestFinished }) => {
    const filename = globalThis.crypto.randomUUID()
    const path = join(
      '__screenshots__',
      'toMatchScreenshot.test.ts',
      `${filename}-${server.browser}-${server.platform}.png`,
    )

    onTestFinished(async () => {
      await server.commands.removeFile(path)
    })

    renderTestCase([
      'oklch(39.6% 0.141 25.723)',
      'oklch(40.5% 0.101 131.063)',
      'oklch(37.9% 0.146 265.522)',
    ])

    const locator = page.getByTestId(dataTestId)

    // Create a reference screenshot by explicitly saving one
    await locator.screenshot({
      save: true,
      path,
    })

    // Test that `toMatchScreenshot()` correctly finds and compares against
    // this reference; since the element hasn't changed, it should match
    await expect(locator).toMatchScreenshot(filename)
  })

  // Only run this test if snapshots aren't being updated
  test.runIf(server.config.snapshotOptions.updateSnapshot !== 'all')(
    "throws when screenshots don't match",
    async ({ onTestFinished }) => {
      const filename = globalThis.crypto.randomUUID()
      const path = join(
        '__screenshots__',
        'toMatchScreenshot.test.ts',
        `${filename}-${server.browser}-${server.platform}.png`,
      )

      onTestFinished(async () => {
        await server.commands.removeFile(path)
      })

      // Create reference with first color set
      renderTestCase([
        'oklch(39.6% 0.141 25.723)',
        'oklch(40.5% 0.101 131.063)',
        'oklch(37.9% 0.146 265.522)',
      ])

      const locator = page.getByTestId(dataTestId)

      await locator.screenshot({
        save: true,
        path,
      })

      // Change to different colors - this should cause comparison to fail
      renderTestCase([
        'oklch(84.1% 0.238 128.85)',
        'oklch(84.1% 0.238 128.85)',
        'oklch(84.1% 0.238 128.85)',
      ])

      let errorMessage: string

      try {
        await expect(locator).toMatchScreenshot(filename)
      } catch (error) {
        errorMessage = error.message
      }

      const [referencePath, actualPath, diffPath] = extractToMatchScreenshotPaths(
        errorMessage,
        filename,
      )

      expect(referencePath).toMatch(new RegExp(`${path}$`))
      expect(typeof actualPath).toBe('string')
      expect(typeof diffPath).toBe('string')

      onTestFinished(async () => {
        await Promise.all([
          server.commands.removeFile(actualPath),
          server.commands.removeFile(diffPath),
        ])
      })

      const { pixels, ratio } =
        /(?<pixels>\d+).*?ratio (?<ratio>[01]\.\d{2})/.exec(errorMessage)
          ?.groups ?? {}

      expect(pixels).toMatch(/\d+/)
      expect(ratio).toMatch(/[01]\.\d{2}/)

      expect(errorMessage).toMatchInlineSnapshot(`
        expect(element).toMatchScreenshot()

        Screenshot does not match the stored reference.
        ${pixels} pixels (ratio ${ratio}) differ.

        Reference screenshot:
          ${referencePath}

        Actual screenshot:
          ${actualPath}

        Diff image:
          ${diffPath}
      `)
    },
  )

  // Only run this test if snapshots aren't being updated
  test.runIf(server.config.snapshotOptions.updateSnapshot !== 'all')(
    'throws when creating a screenshot for the first time',
    async ({
      onTestFinished,
    }) => {
      const { queryByTestId } = renderTestCase([
        'oklch(37.9% 0.146 265.522)',
        'oklch(40.5% 0.101 131.063)',
        'oklch(39.6% 0.141 25.723)',
      ])

      let errorMessage: string

      const filename = globalThis.crypto.randomUUID()

      try {
        await expect(queryByTestId(dataTestId)).toMatchScreenshot(filename)
      } catch (error) {
        errorMessage = error.message
      }

      const [referencePath] = extractToMatchScreenshotPaths(errorMessage, filename)

      expect(typeof referencePath).toBe('string')

      onTestFinished(async () => {
        await server.commands.removeFile(referencePath)
      })

      expect(errorMessage).toMatchInlineSnapshot(`
        expect(element).toMatchScreenshot()

        No existing reference screenshot found${
          server.config.snapshotOptions.updateSnapshot === 'none'
            ? '.'
            : '; a new one was created. Review it before running tests again.'
        }

        Reference screenshot:
          ${referencePath}
      `)
    },
  )

  test(
    'throws when not able to capture a stable screenshot',
    async ({ onTestFailed }) => {
      const filename = globalThis.crypto.randomUUID()

      const { queryByTestId } = render(`
        <div style="--size: 20px; --blocks: 10; height: var(--size); width: calc(var(--size) * var(--blocks));" data-testid="${dataTestId}">
          <div style="height: 100%; aspect-ratio: 1; transform: translateX(calc(var(--size) * (var(--blocks) - 1))); animation: pong 4.5ms linear infinite;"></div>
        </div>
        <style>
          @keyframes pong {
            0% {
              --blocks: 0;
              background-color: oklch(0% 0 0);
            }
            11.11% {
              --blocks: 1;
              background-color: oklch(100% 0 0);
            }
            22.22% {
              --blocks: 2;
              background-color: oklch(0% 0 0);
            }
            33.33% {
              --blocks: 3;
              background-color: oklch(100% 0 0);
            }
            44.44% {
              --blocks: 4;
              background-color: oklch(0% 0 0);
            }
            55.55% {
              --blocks: 5;
              background-color: oklch(100% 0 0);
            }
            66.66% {
              --blocks: 6;
              background-color: oklch(0% 0 0);
            }
            77.77% {
              --blocks: 7;
              background-color: oklch(100% 0 0);
            }
            88.88% {
              --blocks: 8;
              background-color: oklch(0% 0 0);
            }
            100% {
              --blocks: 9;
              background-color: oklch(100% 0 0);
            }
          }
        </style>
      `)

      let errorMessage: string

      try {
        await expect(queryByTestId(dataTestId)).toMatchScreenshot(filename, {
          screenshotOptions: { animations: 'allow' },
          timeout: 1,
        })
      } catch (error) {
        errorMessage = error.message
      }

      onTestFailed(async () => {
        const [referencePath] = extractToMatchScreenshotPaths(errorMessage, filename)

        if (typeof referencePath === 'string') {
          await server.commands.removeFile(referencePath)
        }
      })

      expect(errorMessage).toMatchInlineSnapshot(`
        expect(element).toMatchScreenshot()

        Could not capture a stable screenshot within 1ms.
      `)
    },
  )

  test(
    'creates correct automatic screenshot names',
    async ({ onTestFinished }) => {
      const basename = 'toMatchScreenshot-creates-correct-automatic-screenshot-names'
      const path = join(
        '__screenshots__',
        'toMatchScreenshot.test.ts',
      )

      const firstPath = join(
        path,
        `${basename}-1-${server.browser}-${server.platform}.png`
      )
      const secondPath = join(
        path,
        `${basename}-2-${server.browser}-${server.platform}.png`
      )

      onTestFinished(async () => {
        await Promise.all([
          server.commands.removeFile(firstPath),
          server.commands.removeFile(secondPath),
        ])
      })

      renderTestCase([
        'oklch(39.6% 0.141 25.723)',
        'oklch(40.5% 0.101 131.063)',
        'oklch(37.9% 0.146 265.522)',
      ])

      const locator = page.getByTestId(dataTestId)

      await locator.screenshot({
        save: true,
        path: firstPath,
      })
      await locator.screenshot({
        save: true,
        path: secondPath,
      })

      await expect(locator).toMatchScreenshot()
      await expect(locator).toMatchScreenshot()
    },
  )

  // `mask` is a Playwright-only screenshot feature
  test.runIf(server.provider === 'playwright')(
    "works with masks",
    async ({ onTestFinished }) => {
      const filename = globalThis.crypto.randomUUID()
      const path = join(
        '__screenshots__',
        'toMatchScreenshot.test.ts',
        `${filename}-${server.browser}-${server.platform}.png`,
      )

      onTestFinished(async () => {
        await server.commands.removeFile(path)
      })

      renderTestCase([
        'oklch(39.6% 0.141 25.723)',
        'oklch(40.5% 0.101 131.063)',
        'oklch(37.9% 0.146 265.522)',
      ])

      const locator = page.getByTestId(dataTestId)

      const maskColor = 'oklch(84.1% 0.238 128.85)'
      const mask = [page.getByTestId(`${dataTestId}-3`)]

      // Create reference with the third box masked
      await locator.screenshot({
        save: true,
        path,
        maskColor,
        mask,
      })

      // Change the last box's color so we're sure `mask` works
      // The test would otherwise fail as the screenshots wouldn't match
      renderTestCase([
        'oklch(39.6% 0.141 25.723)',
        'oklch(40.5% 0.101 131.063)',
        'oklch(39.6% 0.141 25.723)',
      ])

      await expect(locator).toMatchScreenshot(
        filename,
        {
          screenshotOptions: {
            maskColor,
            mask,
          },
        },
      )
    },
  )

  test('can use custom comparators', async ({ onTestFinished }) => {
    const filename = globalThis.crypto.randomUUID()
    const path = join(
      '__screenshots__',
      'toMatchScreenshot.test.ts',
      `${filename}-${server.browser}-${server.platform}.png`,
    )

    onTestFinished(async () => {
      await server.commands.removeFile(path)
    })

    renderTestCase([
      'oklch(39.6% 0.141 25.723)',
      'oklch(40.5% 0.101 131.063)',
      'oklch(37.9% 0.146 265.522)',
    ])

    const locator = page.getByTestId(dataTestId)

    // Create a reference screenshot by explicitly saving one
    await locator.screenshot({
      save: true,
      path,
    })

    // Test that `toMatchScreenshot()` correctly uses a custom comparator; since
    //  the element hasn't changed, it should match, but this custom comparator
    //  will always fail
    await expect(locator).toMatchScreenshot(filename)

    let errorMessage: string

    try {
      await expect(locator).toMatchScreenshot(filename, {
        comparatorName: 'failing',
        timeout: 100,
      })
    } catch (error) {
      errorMessage = error.message
    }

    expect(errorMessage).matches(/^Could not capture a stable screenshot within 100ms\.$/m)
  })

  // Only run this test if snapshots aren't being updated
  test.runIf(server.config.snapshotOptions.updateSnapshot !== 'all')(
    'runs only once after resolving the element',
    async ({ onTestFinished }) => {
      const filename = `toMatchScreenshot-runs-only-once-after-resolving-the-element-1`
      const path = join(
        '__screenshots__',
        'toMatchScreenshot.test.ts',
      )

      const screenshotPath = join(
        path,
        `${filename}-${server.browser}-${server.platform}.png`
      )

      // Create baseline screenshot with original colors
      renderTestCase([
        'oklch(39.6% 0.141 25.723)',
        'oklch(40.5% 0.101 131.063)',
        'oklch(37.9% 0.146 265.522)',
      ])
      const locator = page.getByTestId(dataTestId)

      await locator.screenshot({
        save: true,
        path: screenshotPath,
      })

      onTestFinished(async () => {
        await server.commands.removeFile(screenshotPath)
      })

      // Remove element, then re-render with inverted colors after a delay
      document.body.innerHTML = ''

      const renderDelay = 500
      setTimeout(() => {
        renderTestCase([
          'oklch(37.9% 0.146 265.522)',
          'oklch(40.5% 0.101 131.063)',
          'oklch(39.6% 0.141 25.723)',
        ])
      }, renderDelay)

      const start = performance.now()

      // Expected behavior:
      // 1. `expect.element()` polls until element exists (~500ms)
      // 2. `toMatchScreenshot()` runs ONCE and fails (colors don't match baseline)
      //
      // If `toMatchScreenshot()` polled internally, it would retry for 30s.
      // By checking the elapsed time we verify it only ran once.

      let errorMessage: string

      try {
        await expect.element(locator).toMatchScreenshot()
      } catch (error) {
        errorMessage = error.message
      }

      expect(typeof errorMessage).toBe('string')

      const [referencePath, actualPath, diffPath] = extractToMatchScreenshotPaths(
        errorMessage,
        filename,
      )

      expect(typeof referencePath).toBe('string')
      expect(typeof actualPath).toBe('string')
      expect(typeof diffPath).toBe('string')

      expect(referencePath).toMatch(new RegExp(`${screenshotPath}$`))

      onTestFinished(async () => {
        await Promise.all([
          server.commands.removeFile(actualPath),
          server.commands.removeFile(diffPath),
        ])
      })

      expect(
        errorMessage
          .replace(/(?:\d+)(.*?)(?:0\.\d{2})/, '<pixels>$1<ratio>')
          .replace(referencePath, '<reference>')
          .replace(actualPath, '<actual>')
          .replace(diffPath, '<diff>')
      ).toMatchInlineSnapshot(`
        expect(element).toMatchScreenshot()

        Screenshot does not match the stored reference.
        <pixels> pixels (ratio <ratio>) differ.

        Reference screenshot:
          <reference>

        Actual screenshot:
          <actual>

        Diff image:
          <diff>
      `)

      const elapsed = performance.now() - start

      // Elapsed time should be lower than the default `poll`/`element` timeout
      expect(elapsed).toBeLessThan(30_000)
    },
  )
})
