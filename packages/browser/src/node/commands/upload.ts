import type { UserEventUploadOptions } from '@vitest/browser/context'
import type { UserEventCommand } from './utils'
import { resolve } from 'pathe'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'

export const upload: UserEventCommand<(element: string, files: Array<string | {
  name: string
  mimeType: string
  base64: string
}>, options: UserEventUploadOptions) => void> = async (
  context,
  selector,
  files,
  options,
) => {
  const testPath = context.testPath
  if (!testPath) {
    throw new Error(`Cannot upload files outside of a test`)
  }
  const root = context.project.config.root

  if (context.provider instanceof PlaywrightBrowserProvider) {
    const { iframe } = context
    const playwrightFiles = files.map((file) => {
      if (typeof file === 'string') {
        return resolve(root, file)
      }
      return {
        name: file.name,
        mimeType: file.mimeType,
        buffer: Buffer.from(file.base64, 'base64'),
      }
    })
    await iframe.locator(selector).setInputFiles(playwrightFiles as string[], options)
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    for (const file of files) {
      if (typeof file !== 'string') {
        throw new TypeError(`The "${context.provider.name}" provider doesn't support uploading files objects. Provide a file path instead.`)
      }
    }

    const element = context.browser.$(selector)

    for (const file of files) {
      const filepath = resolve(root, file as string)
      const remoteFilePath = await context.browser.uploadFile(filepath)
      await element.addValue(remoteFilePath)
    }
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support uploading files via userEvent.upload`)
  }
}
