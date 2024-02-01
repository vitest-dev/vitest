declare module '$commands' {
  interface FsOptions {
    encoding?: BufferEncoding
    flag?: string | number
  }

  interface TypePayload { type: string }
  interface PressPayload { press: string }
  interface DownPayload { down: string }
  interface UpPayload { up: string }

  type SendKeysPayload = TypePayload | PressPayload | DownPayload | UpPayload

  export const readFile: (path: string, options?: BufferEncoding | FsOptions) => Promise<string | null>
  export const writeFile: (path: string, data: string, options?: BufferEncoding | FsOptions & { mode?: number | string }) => Promise<void>
  export const removeFile: (path: string) => Promise<void>
  export const sendKeys: (keys: SendKeysPayload) => Promise<void>
}
