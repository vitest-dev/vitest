import {
  readFile,
  removeFile,
  writeFile,
} from './fs'
import { sendKeys } from './keyboard'

export default {
  readFile,
  removeFile,
  writeFile,
  sendKeys,
}

export type {
  BufferEncoding,
  FsOptions,
} from './fs'

export type {
  TypePayload,
  PressPayload,
  DownPayload,
  UpPayload,
  SendKeysPayload,
} from './keyboard'
