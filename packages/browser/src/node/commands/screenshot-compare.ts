import type { BrowserCommand, BrowserCommandContext, ResolvedConfig } from 'vitest/node'
import type { ScreenshotCompareOptions, ScreenshotOptions } from '../../../context'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { normalize } from 'node:path'
import { basename, dirname, isAbsolute, relative, resolve } from 'pathe'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import { takeScreenshot } from './screenshot'

export const screenshotCompare: BrowserCommand<[ScreenshotCompareOptions]> = async (
  context,
  options,
) => {
  if (!context.testPath) {
    throw new Error(`Cannot take a screenshot without a test path`)
  }

  const baselinePath = isAbsolute(options.baselinePath)
    ? normalize(options.baselinePath)
    : normalize(resolve(dirname(context.testPath), options.baselinePath))

  await mkdir(dirname(baselinePath), { recursive: true })

  const buffer = takeScreenshot(context, { element: options.element })
  return buffer
}
