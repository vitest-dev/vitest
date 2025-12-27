import type { BrowserCommand } from 'vitest/node'
import type { ScreenshotOptions } from '../../../context'

interface ScreenshotCommandOptions extends Omit<ScreenshotOptions, 'element' | 'mask'> {
  element?: string
  mask?: readonly string[]
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
