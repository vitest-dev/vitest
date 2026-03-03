import {
  _fileInfo,
  readFile,
  removeFile,
  writeFile,
} from './fs'
import { screenshot } from './screenshot'
import { screenshotMatcher } from './screenshotMatcher'
import { _groupTraceEnd, _groupTraceStart, _markTrace } from './trace'

export default {
  readFile: readFile as typeof readFile,
  removeFile: removeFile as typeof removeFile,
  writeFile: writeFile as typeof writeFile,
  // private commands
  __vitest_markTrace: _markTrace as typeof _markTrace,
  __vitest_groupTraceStart: _groupTraceStart as typeof _groupTraceStart,
  __vitest_groupTraceEnd: _groupTraceEnd as typeof _groupTraceEnd,
  __vitest_fileInfo: _fileInfo as typeof _fileInfo,
  __vitest_screenshot: screenshot as typeof screenshot,
  __vitest_screenshotMatcher: screenshotMatcher as typeof screenshotMatcher,
}
