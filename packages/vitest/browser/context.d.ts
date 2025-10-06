// @ts-ignore -- @vitest/browser-playwright might not be installed
export * from '@vitest/browser-playwright/context'
// @ts-ignore -- @vitest/browser-webdriverio might not be installed
export * from '@vitest/browser-webdriverio/context'
// @ts-ignore -- @vitest/browser-preview might not be installed
export * from '@vitest/browser-preview/context'

export interface BrowserCommands {
  readFile: (
    path: string,
    options?: BufferEncoding | FsOptions
  ) => Promise<string>
  writeFile: (
    path: string,
    content: string,
    options?: BufferEncoding | (FsOptions & { mode?: number | string })
  ) => Promise<void>
  removeFile: (path: string) => Promise<void>
}
