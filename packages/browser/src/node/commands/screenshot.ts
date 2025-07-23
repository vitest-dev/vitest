import type { BrowserCommand, BrowserCommandContext, ResolvedConfig } from 'vitest/node'
import type { ScreenshotOptions } from '../../../context'
import { mkdir, rm } from 'node:fs/promises'
import { normalize } from 'node:path'
import { basename, dirname, relative, resolve } from 'pathe'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'

interface ScreenshotCommandOptions extends Omit<ScreenshotOptions, 'element'> {
  element?: string
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
  const savePath = normalize(path)
  await mkdir(dirname(path), { recursive: true })

  if (context.provider instanceof PlaywrightBrowserProvider) {
    if (options.element) {
      const { element: selector, ...config } = options
      const element = context.iframe.locator(`${selector}`)
      const buffer = await element.screenshot({
        ...config,
        path: options.save ? savePath : undefined,
      })
      return { buffer, path }
    }

    const buffer = await context.iframe.locator('body').screenshot({
      ...options,
      path: options.save ? savePath : undefined,
    })
    return { buffer, path }
  }

  if (context.provider instanceof WebdriverBrowserProvider) {
    const page = context.provider.browser!
    const element = !options.element
      ? await page.$('body')
      : await page.$(`${options.element}`)

    // webdriverio expects the path to contain the extension and only works with PNG files
    const savePathWithExtension = savePath.endsWith('.png') ? savePath : `${savePath}.png`

    const buffer = await element.saveScreenshot(
      savePathWithExtension,
    )
    if (!options.save) {
      await rm(savePathWithExtension, { force: true })
    }
    return { buffer, path }
  }

  throw new Error(
    `Provider "${context.provider.name}" does not support screenshots`,
  )
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
