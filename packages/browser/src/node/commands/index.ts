import { click, dblClick, tripleClick } from './click'
import { type } from './type'
import { clear } from './clear'
import { fill } from './fill'
import { selectOptions } from './select'
import { tab } from './tab'
import { keyboard, keyboardCleanup } from './keyboard'
import { dragAndDrop } from './dragAndDrop'
import { hover } from './hover'
import { upload } from './upload'
import {
  _fileInfo,
  readFile,
  removeFile,
  writeFile,
} from './fs'
import { screenshot } from './screenshot'

export default {
  readFile,
  removeFile,
  writeFile,
  __vitest_fileInfo: _fileInfo,
  __vitest_upload: upload,
  __vitest_click: click,
  __vitest_dblClick: dblClick,
  __vitest_tripleClick: tripleClick,
  __vitest_screenshot: screenshot,
  __vitest_type: type,
  __vitest_clear: clear,
  __vitest_fill: fill,
  __vitest_tab: tab,
  __vitest_keyboard: keyboard,
  __vitest_selectOptions: selectOptions,
  __vitest_dragAndDrop: dragAndDrop,
  __vitest_hover: hover,
  __vitest_cleanup: keyboardCleanup,
}
