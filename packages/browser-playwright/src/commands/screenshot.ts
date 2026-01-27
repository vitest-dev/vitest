import type { ScreenshotOptions } from 'vitest/browser'
import type { BrowserCommandContext } from 'vitest/node'
import { mkdir } from 'node:fs/promises'
import { resolveScreenshotPath } from '@vitest/browser'
import { dirname, normalize } from 'pathe'

interface ScreenshotCommandOptions extends Omit<ScreenshotOptions, 'element' | 'mask'> {
  element?: string
  mask?: readonly string[]
}
/**
 * Takes a screenshot using the provided browser context and returns a buffer and the expected screenshot path.
 *
 * **Note**: the returned `path` indicates where the screenshot *might* be found.
 * It is not guaranteed to exist, especially if `options.save` is `false`.
 *
 * @throws {Error} If the function is not called within a test or if the browser provider does not support screenshots.
 */
export async function takeScreenshot(
  context: BrowserCommandContext,
  name: string,
  options: Omit<ScreenshotCommandOptions, 'base64'>,
): Promise<{ buffer: Buffer<ArrayBufferLike>; path: string }> {
  if (!context.testPath) {
    throw new Error(`Cannot take a screenshot without a test path`)
  }

  const path = resolveScreenshotPath(
    context.testPath,
    name,
    context.project.config,
    options.path,
  )

  // playwright does not need a screenshot path if we don't intend to save it
  let savePath: string | undefined

  if (options.save) {
    savePath = normalize(path)

    await mkdir(dirname(savePath), { recursive: true })
  }

  const mask = options.mask?.map(selector => context.iframe.locator(selector))

  if (options.element) {
    const { element: selector, ...config } = options
    const element = context.iframe.locator(selector)
    const buffer = await element.screenshot({
      ...config,
      mask,
      path: savePath,
    })
    return { buffer, path }
  }

  const buffer = await context.iframe.locator('body').screenshot({
    ...options,
    mask,
    path: savePath,
  })
  return { buffer, path }
}
