import type { UserEventUploadOptions } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { resolve } from 'pathe'

export const upload: UserEventCommand<(element: string, files: Array<string | {
  name: string
  mimeType: string
  base64: string
}>, options: UserEventUploadOptions) => void> = async (
  context,
  selector,
  files,
  _options,
) => {
  const testPath = context.testPath
  if (!testPath) {
    throw new Error(`Cannot upload files outside of a test`)
  }
  const root = context.project.config.root

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
