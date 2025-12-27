import {
  _fileInfo,
  readFile,
  removeFile,
  writeFile,
} from './fs'
import { screenshot } from './screenshot'
import { screenshotMatcher } from './screenshotMatcher'

export default {
  readFile: readFile as typeof readFile,
  removeFile: removeFile as typeof removeFile,
  writeFile: writeFile as typeof writeFile,
  // private commands
  __vitest_fileInfo: _fileInfo as typeof _fileInfo,
  __vitest_screenshot: screenshot as typeof screenshot,
  __vitest_screenshotMatcher: screenshotMatcher as typeof screenshotMatcher,
}
