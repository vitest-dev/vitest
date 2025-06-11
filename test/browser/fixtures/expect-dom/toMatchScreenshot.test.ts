import { afterEach, describe, expect, test } from 'vitest'
import { render } from './utils'
import { page, server } from '@vitest/browser/context'
import { join } from 'pathe'

const blockSize = 19
const blocks = 5
const dataTestId = 'colors-box'

const extractPaths = (errorMessage: string, filename: string): string[] =>
  // `map` on `Iterator` is only available in Node >= 22
  Array.from(
    errorMessage.matchAll(
      new RegExp(`^.*?(/.*?${filename}-[\\w-]+\\.png)`, 'gm'),
    ),
    ([_, path]) => path,
  )

const renderTestCase = (colors: readonly [string, string, string]) =>
  render(`
    <div style="--size: ${blockSize}px; display: flex; justify-content: center; height: var(--size); width: calc(var(--size) * ${blocks});" data-testid="${dataTestId}">
      <div style="background-color: ${colors[0]}; width: var(--size);"></div>
      <div style="background-color: ${colors[1]}; width: var(--size);"></div>
      <div style="background-color: ${colors[2]}; width: var(--size);"></div>
    </div>
  `)

describe('.toMatchScreenshot', () => {
  test('compares screenshots correctly', async ({ onTestFinished }) => {
    const filename = globalThis.crypto.randomUUID()
    const path = join(
      import.meta.dirname,
      '__screenshots__',
      'toMatchScreenshot.test.ts',
      `${filename}-${server.browser}.png`,
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

    await locator.screenshot({
      save: true,
      path,
    })

    await expect(locator).toMatchScreenshot(filename)
  })

  test("throws when screenshots don't match", async ({ onTestFinished }) => {
    const filename = globalThis.crypto.randomUUID()
    const path = join(
      import.meta.dirname,
      '__screenshots__',
      'toMatchScreenshot.test.ts',
      `${filename}-${server.browser}.png`,
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

    await locator.screenshot({
      save: true,
      path,
    })

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

    const [referencePath, actualPath, diffPath] = extractPaths(
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

      Diff screenshot:
        ${diffPath}
    `)
  })

  test('throws when creating a screenshot for the first time', async ({
    onTestFinished,
    task,
  }) => {
    // if running with updates enabled, this test will not work
    if (server.config.snapshotOptions.updateSnapshot === 'all') {
      return
    }

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

    const [referencePath] = extractPaths(errorMessage, filename)

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
  })

  test(
    'throws when not able to capture a stable screenshot',
    // this test un not stable
    { retry: 5 },
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
        const [referencePath] = extractPaths(errorMessage, filename)

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
})
