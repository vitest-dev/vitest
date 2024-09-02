import { dirname, resolve } from 'pathe'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import type { UserEventCommand } from './utils'

export const upload: UserEventCommand<(element: string, files: Array<string | {
  name: string
  mimeType: string
  base64: string
}>) => void> = async (
  context,
  selector,
  files,
) => {
  const testPath = context.testPath
  if (!testPath) {
    throw new Error(`Cannot upload files outside of a test`)
  }

  if (context.provider instanceof PlaywrightBrowserProvider) {
    const { iframe } = context
    const playwrightFiles = files.map((file) => {
      if (typeof file === 'string') {
        return resolve(dirname(testPath), file)
      }
      return {
        name: file.name,
        mimeType: file.mimeType,
        buffer: Buffer.from(file.base64, 'base64'),
      }
    })
    await iframe.locator(selector).setInputFiles(playwrightFiles as string[])
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support uploading files via userEvent.upload`)
  }
}
