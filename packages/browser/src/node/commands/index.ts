import { click } from './click'
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
  __vitest_click: click,
}
