import { parseKeyDef } from '@testing-library/user-event/dist/esm/pointer/parseKeyDef.js'
import { defaultKeyMap } from '@testing-library/user-event/dist/esm/pointer/keyMap.js'

// @ts-expect-error no types
import type { PointerCoords } from '@testing-library/user-event/dist/types/event'
// @ts-expect-error no types
import type { pointerKey } from '@testing-library/user-event/dist/types/system/pointer'

// todo: try to add proper types to avoid duplicating
export type PointerActionInput = string | ({
  keys: string
} & PointerActionPosition) | PointerAction
export type PointerInput = PointerActionInput[]
export type PointerAction = PointerPressAction | PointerMoveAction
export interface PointerActionPosition {
  target?: string
  coords?: PointerCoords
  node?: string
  /**
   * If `node` is set, this is the DOM offset.
   * Otherwise this is the `textContent`/`value` offset on the `target`.
   */
  offset?: number
}
export interface PointerPressAction extends PointerActionPosition {
  keyDef: pointerKey
  releasePrevious: boolean
  releaseSelf: boolean
}
export interface PointerMoveAction extends PointerActionPosition {
  pointerName?: string
}

// https://github.com/testing-library/user-event/blob/main/src/pointer/index.ts
export function* collectActions(input: PointerInput) {
  // collect actions
  for (let i = 0; i < input.length; i++) {
    const actionInput = input[i]
    if (typeof actionInput === 'string') {
      for (const i of parseKeyDef(defaultKeyMap, actionInput)) {
        yield i
      }
    }
    else if ('keys' in actionInput) {
      for (const i of parseKeyDef(defaultKeyMap, actionInput.keys)) {
        yield {
          ...actionInput,
          ...i,
        }
      }
    }
    else {
      yield actionInput
    }
  }
}
