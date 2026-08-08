import type { SerializedLocator } from '@vitest/browser'
import type { Locator, UserEventPointerOptions } from 'vitest/browser'
import type { UserEventCommand } from './utils'
import { parseKeyDef } from '@vitest/browser'
import { click } from './click'
import { hover } from './hover'

type PointerEvent = (
  options: readonly ElementToSerializedLocator<UserEventPointerOptions>[],
) => Promise<void>

type ElementToSerializedLocator<T> = T extends Element | Locator
  ? SerializedLocator
  : {
      [K in keyof T]: ElementToSerializedLocator<T[K]>
    }

export const pointer: UserEventCommand<PointerEvent> = async (
  context,
  options,
) => {
  // @todo: should this throw if keys are not released at the end?
  const pressedKeys = new Set<string>()

  for (const option of options) {
    const keys = option.keys === undefined ? null : parseKeyDef(option.keys)
    const keysToRelease = new Set<string>()

    if (keys) {
      for (const { keyDef, releaseSelf, releasePrevious } of keys) {
        const key = keyDef.key!

        if (!releasePrevious) {
          await context.page.keyboard.down(key)
        }
        else if (pressedKeys.has(key)) {
          keysToRelease.add(key)
          pressedKeys.delete(key)
        }

        if (releaseSelf) {
          keysToRelease.add(key)
        }
        else {
          pressedKeys.add(key)
        }
      }
    }

    // `click` has its own moving logic, no need to move twice
    if (option.action !== 'click') {
      if (option.target) {
        await hover(context, option.target, { position: option.offset })
      }
      else {
        await context.page.mouse.move(option.coordinates.x, option.coordinates.y)
      }
    }

    if (option.action) {
      const mouseOptions = {
        button: option.button,
      }

      switch (option.action) {
        case 'down': {
          await context.page.mouse.down(mouseOptions)
          break
        }
        case 'up': {
          await context.page.mouse.up(mouseOptions)
          break
        }
        case 'click': {
          const clickOptions = {
            ...mouseOptions,
            clickCount: option.times ?? 1,
            position: option.offset,
          } satisfies Parameters<typeof click>[2]

          if (option.target) {
            await click(context, option.target, clickOptions)
          }
          else {
            await context.page.mouse.click(
              option.coordinates.x,
              option.coordinates.y,
              clickOptions,
            )
          }

          break
        }
      }
    }

    for (const key of keysToRelease) {
      await context.page.keyboard.up(key)
    }
  }
}
