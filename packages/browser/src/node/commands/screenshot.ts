import type { BrowserCommand, ResolvedConfig } from 'vitest/node'
import type { ScreenshotOptions } from '../../../context'
import { mkdir } from 'node:fs/promises'
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

  const path = options.path
    ? resolve(dirname(context.testPath), options.path)
    : resolveScreenshotPath(
        context.testPath,
        name,
        context.project.config,
      )
  const savePath = normalize(path)
  await mkdir(dirname(path), { recursive: true })

  if (context.provider instanceof PlaywrightBrowserProvider) {
    if (options.element) {
      const { element: selector, ...config } = options
      const element = context.iframe.locator(`${selector}`)
      const buffer = await element.screenshot({
        ...config,
        path: savePath,
      })
      return returnResult(options, path, buffer)
    }

    const buffer = await context.iframe.locator('body').screenshot({
      ...options,
      path: savePath,
    })
    return returnResult(options, path, buffer)
  }

  if (context.provider instanceof WebdriverBrowserProvider) {
    const page = context.provider.browser!
    if (!options.element) {
      const body = await page.$('body')
      const buffer = await body.saveScreenshot(savePath)
      return returnResult(options, path, buffer)
    }

    const element = await page.$(`${options.element}`)
    const buffer = await element.saveScreenshot(savePath)
    return returnResult(options, path, buffer)
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
  if (options.base64) {
    return { path, base64: buffer.toString('base64') }
  }
  return path
}
