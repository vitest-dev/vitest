import type { BrowserCommand, ResolvedConfig } from 'vitest/node'
import type { ScreenshotOptions } from '../../../context'
import { mkdir, rm } from 'node:fs/promises'
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
      return returnResult(options, path, buffer)
    }

    const buffer = await context.iframe.locator('body').screenshot({
      ...options,
      path: options.save ? savePath : undefined,
    })
    return returnResult(options, path, buffer)
  }

  if (context.provider instanceof WebdriverBrowserProvider) {
    const page = context.provider.browser!
    const element = !options.element
      ? await page.$('body')
      : await page.$(`${options.element}`)

    const buffer = await element.saveScreenshot(savePath)
    if (!options.save) {
      await rm(savePath, { force: true })
    }
    return returnResult(options, path, buffer)
  }

  throw new Error(
    `Provider "${context.provider.name}" does not support screenshots`,
  )
}

export function resolveScreenshotPath(
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
