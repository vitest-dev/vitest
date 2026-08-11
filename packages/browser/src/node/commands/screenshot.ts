import type { BrowserCommand } from 'vitest/node'
import type { ScreenshotOptions, SerializedLocator } from '../../../context'
import { basename, resolve } from 'pathe'

interface ScreenshotCommandOptions extends Omit<ScreenshotOptions, 'element' | 'mask'> {
  element?: SerializedLocator
  mask?: readonly SerializedLocator[]
  target?: 'element' | 'page'
  /**
   * @internal
   * Marks the screenshot as an internal failure screenshot (taken by
   * `browser.screenshotFailures`). Failure screenshots are transient debug
   * artifacts, so they are stored in the attachments directory instead of the
   * `__screenshots__` visual regression reference directory.
   */
  internal?: 'failure-screenshot'
}

declare module 'vitest/browser' {
  interface BrowserCommands {
    /**
     * @internal
     */
    __vitest_takeScreenshot: (name: string, options: ScreenshotCommandOptions) => Promise<{
      buffer: Buffer
      path: string
    }>
  }
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

  if (options.internal === 'failure-screenshot') {
    // Failure screenshots are transient debug artifacts, not visual regression
    // references. Store them in the attachments directory (gitignorable) instead
    // of mingling them with the committed `__screenshots__` reference set.
    options.path = resolve(context.project.config.attachmentsDir, basename(name))
  }

  const { buffer, path } = await context.triggerCommand('__vitest_takeScreenshot', name, options)

  return returnResult(options, path, buffer)
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
