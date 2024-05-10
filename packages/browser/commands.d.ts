// we cannot reexport our implementation because it relies on Node.js APIs

export type BufferEncoding =
  | 'ascii'
  | 'utf8'
  | 'utf-8'
  | 'utf16le'
  | 'utf-16le'
  | 'ucs2'
  | 'ucs-2'
  | 'base64'
  | 'base64url'
  | 'latin1'
  | 'binary'
  | 'hex'

export interface FsOptions {
  encoding?: BufferEncoding
  flag?: string | number
}

export declare function readFile(path: string, options?: BufferEncoding | FsOptions): Promise<string>
export declare function writeFile(path: string, content: string, options?: BufferEncoding | FsOptions & { mode?: number | string }): Promise<void>
export declare function removeFile(path: string): Promise<void>

export interface TypePayload { type: string }
export interface PressPayload { press: string }
export interface DownPayload { down: string }
export interface UpPayload { up: string }

export type SendKeysPayload = TypePayload | PressPayload | DownPayload | UpPayload

export declare function sendKeys(payload: SendKeysPayload): Promise<void>
