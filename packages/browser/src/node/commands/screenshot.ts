import type { BrowserCommand, BrowserCommandContext, ResolvedConfig } from 'vitest/node'
import type { ScreenshotOptions } from '../../../context'
import { mkdir, rm } from 'node:fs/promises'
import * as nodeos from 'node:os'
import { normalize } from 'node:path'
import { basename, dirname, relative, resolve } from 'pathe'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'

export const screenshot: BrowserCommand<[string, ScreenshotOptions]> = async (
  context,
  name: string,
  options = {},
) => {
  if (!context.testPath) {
    throw new Error(`Cannot take a screenshot without a test path`)
  }

  options.save ??= true

  if (!options.save) {
    options.base64 = true
  }

  const path = options.path
    ? resolve(dirname(context.testPath), options.path)
    : resolveScreenshotPath(
        context.testPath,
        name,
        context.project.config,
      )

  const buffer = await takeScreenshot(context, options, path)
  return returnResult(options, path, buffer)
}

export async function takeScreenshot(context: BrowserCommandContext, options: ScreenshotOptions, path?: string): Promise<Buffer> {
  const savePath = path ? normalize(path) : undefined
  if (path) {
    await mkdir(dirname(path), { recursive: true })
  }
  const { element: selector, ...config } = options
  const selectorWithFallback = selector ? `${selector}` : 'body'

  if (context.provider instanceof PlaywrightBrowserProvider) {
    const element = context.iframe.locator(selectorWithFallback)
    return await element.screenshot({
      ...config,
      path: options.save ? savePath : undefined,
    })
  }

  if (context.provider instanceof WebdriverBrowserProvider) {
    const page = context.provider.browser!
    const element = await page.$(selectorWithFallback)

    // Since WebdriverIO can't generate a screenshot without saving it, we save it in a tmpdir
    return await element.saveScreenshot(savePath || relative(nodeos.tmpdir(), 'screenshot.png'))
  }

  throw new Error(
    `Provider "${context.provider.name}" does not support screenshots`,
  )
}

function resolveScreenshotPath(
  testPath: string,
  name: string,
  config: ResolvedConfig,
) {
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
  options: ScreenshotOptions,
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
