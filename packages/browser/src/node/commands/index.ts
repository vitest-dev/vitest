import { click } from './click'
import { type } from './type'
import { clear } from './clear'
import { fill } from './fill'
import {
  readFile,
  removeFile,
  writeFile,
} from './fs'
import { sendKeys } from './keyboard'
import { screenshot } from './screenshot'

export default {
  readFile,
  removeFile,
  writeFile,
  sendKeys,
  __vitest_click: click,
  __vitest_screenshot: screenshot,
  __vitest_type: type,
  __vitest_clear: clear,
  __vitest_fill: fill,
}
