import type { SerializedLocator } from '@vitest/browser'
import type { Locator, UserEventPointerInputNormalized } from 'vitest/browser'
import type { BrowserCommandContext } from 'vitest/node'
import type { UserEventCommand } from './utils'
import { parseKeyDef } from '@vitest/browser'
import { click } from './click'
import { hover } from './hover'
import { resolvePageCoordinates } from './utils'

type SerializedPointerInput = ElementToSerializedLocator<UserEventPointerInputNormalized[number]>
interface PointerReturnData extends Pick<SerializedPointerInput, 'coords' | 'target'> {
  unreleased: string[]
}
type PointerEvent = (
  input: readonly SerializedPointerInput[],
  state: Partial<PointerReturnData>,
) => Promise<PointerReturnData>

type ElementToSerializedLocator<T> = T extends Element | Locator
  ? SerializedLocator
  : {
      [K in keyof T]: ElementToSerializedLocator<T[K]>
    }

export const pointer: UserEventCommand<PointerEvent> = async (
  context,
  input,
  state = {},
) => {
  const pressedKeys = new Set<string>(state.unreleased)
  let lastTarget: SerializedPointerInput['target'] = state.target
  let lastCoords: SerializedPointerInput['coords'] = state.coords

  for (const option of input) {
    let target = option.target
    let coords = option.coords

    if (target || coords) {
      lastTarget = target
      lastCoords = coords
    }
    else {
      target = lastTarget
      coords = lastCoords
    }

    const pointerAction = { ...option, target, coords }
    const keys = 'keys' in option
      ? option.keys
      : null
    const parsedKeys = keys === null ? null : groupKeyDefs(parseKeyDef(keys))
    const hasClickAction = parsedKeys?.some(
      ({ keyDef: { keyDef: { code }, releasePrevious, releaseSelf } }) =>
        code === 'MouseLeft' && !releasePrevious && releaseSelf,
    )

    // click has its own moving logic, no need to move twice
    if (!hasClickAction) {
      if (target) {
        await hover(
          context,
          target,
          {
            position: coords
              && await resolvePageCoordinates(
                context,
                { x: coords.x ?? 0, y: coords.y ?? 0 },
                true,
              ),
          },
        )
      }
      else if (coords) {
        const pageCoords = await resolvePageCoordinates(context, coords, false)

        await context.page.mouse.move(pageCoords.x, pageCoords.y)
      }
    }

    if (parsedKeys) {
      for (const key of parsedKeys) {
        await keyDefHandler(key, pointerAction, pressedKeys, context)
      }
    }
  }

  return {
    unreleased: Array.from(pressedKeys),
    target: lastTarget,
    coords: lastCoords,
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
    if (
      last !== undefined
      // for our purpose we can ignore the `repeat` property
      && last.keyDef.releasePrevious === keyDef.releasePrevious
      && last.keyDef.releaseSelf === keyDef.releaseSelf
      && last.keyDef.keyDef.key === keyDef.keyDef.key
      && last.keyDef.keyDef.code === keyDef.keyDef.code
      && last.keyDef.keyDef.location === keyDef.keyDef.location
    ) {
      last.times += keyDef.repeat
    }
    else {
      last = { times: keyDef.repeat, keyDef }
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
      clickCount: times,
    } satisfies Parameters<typeof context['page']['mouse']['up']>[0]

    if (releasePrevious) {
      await context.page.mouse.up(mouseOptions)
    }
    else if (releaseSelf) {
      if (pointerAction.target) {
        await click(context, pointerAction.target, {
          ...mouseOptions,
          position: pointerAction.coords
            && await resolvePageCoordinates(context, {
              x: pointerAction.coords?.x ?? 0,
              y: pointerAction.coords?.y ?? 0,
            }, true),
        })
      }
      else {
        const coords = await resolvePageCoordinates(context, {
          x: pointerAction.coords?.x ?? 0,
          y: pointerAction.coords?.y ?? 0,
        }, false)

        await context.page.mouse.click(coords.x, coords.y, mouseOptions)
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
