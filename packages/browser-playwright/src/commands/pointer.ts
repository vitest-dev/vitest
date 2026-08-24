import type { SerializedLocator } from '@vitest/browser'
import type { Locator, PointerInputNormalized } from 'vitest/browser'
import type { BrowserCommandContext } from 'vitest/node'
import type { UserEventCommand } from './utils'
import { deepEqual } from 'node:assert/strict'
import { parseKeyDef } from '@vitest/browser'
import { click } from './click'
import { hover } from './hover'

// @todo remove this abomination
function equals(a: object, b: object): boolean {
  try {
    deepEqual(a, b)

    return true
  }
  catch {
    return false
  }
}

type SerializedPointerInput = ElementToSerializedLocator<PointerInputNormalized[number]>
type PointerEvent = (
  input: readonly SerializedPointerInput[],
) => Promise<void>

type ElementToSerializedLocator<T> = T extends Element | Locator
  ? SerializedLocator
  : {
      [K in keyof T]: ElementToSerializedLocator<T[K]>
    }

export const pointer: UserEventCommand<PointerEvent> = async (
  context,
  input,
) => {
  // @todo: should this throw if keys are not released at the end?
  const pressedKeys = new Set<string>()

  // @todo save lastTarget or lastCoords for clicking when there's no target or coords otherwise we can't perform the action
  for (const option of input) {
    const keys = 'keys' in option
      ? option.keys
      : null
    const parsedKeys = keys === null ? null : groupKeyDefs(parseKeyDef(keys))
    const hasMouseButtonAction = parsedKeys?.some(
      ({ keyDef: { keyDef: { code }, releasePrevious, releaseSelf } }) => code === 'MouseLeft' && !releasePrevious && releaseSelf,
    )

    // mouse buttons have their own moving logic, no need to move twice
    if (!hasMouseButtonAction) {
      const x = option.coords?.x ?? 0
      const y = option.coords?.y ?? 0

      if (option.target) {
        await hover(
          context,
          option.target,
          { position: option.coords ? { x, y } : undefined },
        )
      }
      else if (option.coords) {
        await context.page.mouse.move(x, y)
      }
    }

    // console.log('parsedKeys', parsedKeys)

    if (parsedKeys) {
      for (const key of parsedKeys) {
        await keyDefHandler(key, option, pressedKeys, context)
      }
    }
  }
}

type KeyDefOutput = ReturnType<typeof parseKeyDef>[number]
interface GroupedKeyDef {
  times: number
  keyDef: KeyDefOutput
}

function groupKeyDefs(keyDefs: readonly KeyDefOutput[]): GroupedKeyDef[] {
  const output: GroupedKeyDef[] = []
  let last: GroupedKeyDef | undefined

  for (const keyDef of keyDefs) {
    if (last !== undefined && equals(last.keyDef, keyDef)) {
      last.times += keyDef.repeat
    }
    else {
      last = { times: 1, keyDef }
      output.push(last)
    }
  }

  return output
}

const MOUSE_KEYS = ['MouseLeft', 'MouseRight', 'MouseMiddle']

async function keyDefHandler(
  { keyDef: { keyDef, releasePrevious, releaseSelf }, times }: GroupedKeyDef,
  pointerAction: Omit<SerializedPointerInput, 'keys'>,
  pressedKeys: Set<string>,
  context: BrowserCommandContext,
) {
  const key = keyDef.key!
  const code = keyDef.code!

  if (MOUSE_KEYS.includes(code)) {
    const button = code.replace('Mouse', '').toLowerCase() as 'left' | 'right' | 'middle'
    const mouseOptions = {
      button,
    }

    if (releasePrevious) {
      await context.page.mouse.up(mouseOptions)
    }
    else if (releaseSelf) {
      const clickOptions = {
        ...mouseOptions,
        clickCount: times,
        position: pointerAction.coords
          ? {
              x: pointerAction.coords?.x ?? 0,
              y: pointerAction.coords?.y ?? 0,
            }
          : undefined,
      } satisfies Parameters<typeof click>[2]

      if (pointerAction.target) {
        await click(context, pointerAction.target, clickOptions)
      }
      else {
        await context.page.mouse.click(
          pointerAction.coords?.x ?? 0,
          pointerAction.coords?.y ?? 0,
          clickOptions,
        )
      }
    }
    else {
      await context.page.mouse.down(mouseOptions)
    }

    return
  }

  if (key === 'Unknown') {
    return
  }

  if (!releasePrevious) {
    if (releaseSelf) {
      for (let count = 0; count < times; count += 1) {
        await context.page.keyboard.press(key)
      }
    }
    else {
      await context.page.keyboard.down(key)
      pressedKeys.add(key)
    }
  }
  else if (pressedKeys.has(key)) {
    await context.page.keyboard.up(key)
    pressedKeys.delete(key)
  }
}
