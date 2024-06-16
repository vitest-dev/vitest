import { click } from './click'
import { readFile, removeFile, writeFile } from './fs'
import { sendKeys } from './keyboard'
import { screenshot } from './screenshot'

export default {
  readFile,
  removeFile,
  writeFile,
  sendKeys,
  __vitest_click: click,
  __vitest_screenshot: screenshot,
}
