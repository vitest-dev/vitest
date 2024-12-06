import { clear } from './clear'
import { click, dblClick, tripleClick } from './click'
import { dragAndDrop } from './dragAndDrop'
import { fill } from './fill'
import {
  _fileInfo,
  readFile,
  removeFile,
  writeFile,
} from './fs'
import { hover } from './hover'
import { keyboard, keyboardCleanup } from './keyboard'
import { screenshot } from './screenshot'
import { selectOptions } from './select'
import { tab } from './tab'
import { type } from './type'
import { upload } from './upload'

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
