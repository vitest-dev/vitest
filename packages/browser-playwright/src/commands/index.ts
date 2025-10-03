import { clear } from './clear'
import { click, dblClick, tripleClick } from './click'
import { dragAndDrop } from './dragAndDrop'
import { fill } from './fill'
import { hover } from './hover'
import { keyboard, keyboardCleanup } from './keyboard'
import { takeScreenshot } from './screenshot'
import { selectOptions } from './select'
import { tab } from './tab'
import {
  annotateTraces,
  deleteTracing,
  startChunkTrace,
  startTracing,
  stopChunkTrace,
} from './trace'
import { type } from './type'
import { upload } from './upload'

export default {
  __vitest_upload: upload as typeof upload,
  __vitest_click: click as typeof click,
  __vitest_dblClick: dblClick as typeof dblClick,
  __vitest_tripleClick: tripleClick as typeof tripleClick,
  __vitest_takeScreenshot: takeScreenshot as typeof takeScreenshot,
  __vitest_type: type as typeof type,
  __vitest_clear: clear as typeof clear,
  __vitest_fill: fill as typeof fill,
  __vitest_tab: tab as typeof tab,
  __vitest_keyboard: keyboard as typeof keyboard,
  __vitest_selectOptions: selectOptions as typeof selectOptions,
  __vitest_dragAndDrop: dragAndDrop as typeof dragAndDrop,
  __vitest_hover: hover as typeof hover,
  __vitest_cleanup: keyboardCleanup as typeof keyboardCleanup,
  __vitest_deleteTracing: deleteTracing as typeof deleteTracing,
  __vitest_startChunkTrace: startChunkTrace as typeof startChunkTrace,
  __vitest_startTracing: startTracing as typeof startTracing,
  __vitest_stopChunkTrace: stopChunkTrace as typeof stopChunkTrace,
  __vitest_annotateTraces: annotateTraces as typeof annotateTraces,
}
