import type { ScreenshotOptions } from 'vitest/browser'
import type { BrowserCommand, BrowserCommandContext, ResolvedConfig } from 'vitest/node'
import { mkdir } from 'node:fs/promises'
import { basename, dirname, normalize, relative, resolve } from 'pathe'

interface ScreenshotCommandOptions extends Omit<ScreenshotOptions, 'element' | 'mask'> {
  element?: string
  mask?: readonly string[]
}

export const screenshot: BrowserCommand<[string, ScreenshotCommandOptions]> = async (
  context,
  name: string,
  options = {},
) => {
  options.save ??= true

  if (!options.save) {
    options.base64 = true
  }

  const { buffer, path } = await takeScreenshot(context, name, options)

  return returnResult(options, path, buffer)
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

function resolveScreenshotPath(
  testPath: string,
  name: string,
  config: ResolvedConfig,
  customPath: string | undefined,
): string {
  if (customPath) {
    return resolve(dirname(testPath), customPath)
  }
  const dir = dirname(testPath)
  const base = basename(testPath)
  if (config.browser.screenshotDirectory) {
    return resolve(
      config.browser.screenshotDirectory,
      relative(config.root, dir),
      base,
      name,
    )
  }
  return resolve(dir, '__screenshots__', base, name)
}

function returnResult(
  options: ScreenshotCommandOptions,
  path: string,
  buffer: Buffer,
) {
  if (!options.save) {
    return buffer.toString('base64')
  }
  if (options.base64) {
    return { path, base64: buffer.toString('base64') }
  }
  return path
}
