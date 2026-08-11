import type { BrowserCommand } from 'vitest/node'
import type { ScreenshotOptions, SerializedLocator } from '../../../context'
import { basename, resolve } from 'pathe'

interface ScreenshotCommandOptions extends Omit<ScreenshotOptions, 'element' | 'mask'> {
  element?: SerializedLocator
  mask?: readonly SerializedLocator[]
  target?: 'element' | 'page'
  /**
   * Marks this screenshot for internal use, changing how it's stored and handled.
   *
   * Allowed values:
   * - `'failure-screenshot'`: taken automatically on test failure, stored in the attachments directory.
   *
   * @internal
   */
  reason?: 'failure-screenshot'
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

  if (options.reason === 'failure-screenshot' && context.testPath) {
    // Failure screenshots are transient debug artifacts
    options.path = resolve(
      context.project.config.attachmentsDir,
      basename(context.testPath),
      basename(name),
    )
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
