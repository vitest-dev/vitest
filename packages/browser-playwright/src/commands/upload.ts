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
  options,
) => {
  const testPath = context.testPath
  if (!testPath) {
    throw new Error(`Cannot upload files outside of a test`)
  }
  const root = context.project.config.root

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
