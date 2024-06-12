import { mkdir } from 'node:fs/promises'
import type { BrowserCommand } from 'vitest/node'
import { basename, dirname, relative, resolve } from 'pathe'
import type { ResolvedConfig } from 'vitest'
import type { ScreenshotOptions } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'

// TODO: expose provider specific options in types
export const screenshot: BrowserCommand<[string, ScreenshotOptions]> = async (context, name: string, options = {}) => {
  if (!context.testPath)
    throw new Error(`Cannot take a screenshot without a test path`)

  const path = resolveScreenshotPath(context.testPath, name, context.project.config)
  await mkdir(dirname(path), { recursive: true })

  if (context.provider instanceof PlaywrightBrowserProvider) {
    if (options.element) {
      const { element: elementXpath, ...config } = options
      const iframe = context.tester
      const element = iframe.locator(`xpath=${elementXpath}`)
      await element.screenshot({ ...config, path })
    }
    else {
      await context.body.screenshot({ ...options, path })
    }
    return path
  }

  if (context.provider instanceof WebdriverBrowserProvider) {
    const page = context.provider.browser!
    const frame = await page.findElement('css selector', 'iframe[data-vitest]')
    await page.switchToFrame(frame)
    const element = options.element ? `//${options.element}` : `//body`
    ;(await page.$(element)).saveScreenshot(path)
    return path
  }

  throw new Error(`Provider "${context.provider.name}" does not support screenshots`)
}

function resolveScreenshotPath(testPath: string, name: string, config: ResolvedConfig) {
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
