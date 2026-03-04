import type { BrowserProvider } from 'vitest/node'
import type { WebdriverBrowserProvider } from '../webdriverio'
import type { UserEventCommand } from './utils'
import { parseKeyDef } from '@vitest/browser'
import { Key } from 'webdriverio'

export interface KeyboardState {
  unreleased: string[]
}

export const keyboard: UserEventCommand<(
  text: string,
  state: KeyboardState,
) => Promise<{ unreleased: string[] }>> = async (
  context,
  text,
  state,
) => {
  await context.browser.execute(focusIframe)

  const pressed = new Set<string>(state.unreleased)

  await keyboardImplementation(
    pressed,
    context.provider,
    context.sessionId,
    text,
    async () => {
      await context.browser.execute(selectAll)
    },
    true,
  )

  return {
    unreleased: Array.from(pressed),
  }
}

export const keyboardCleanup: UserEventCommand<(state: KeyboardState) => Promise<void>> = async (
  context,
  state,
) => {
  if (!state.unreleased) {
    return
  }
  const keyboard = context.browser.action('key')
  for (const key of state.unreleased) {
    keyboard.up(key)
  }
  await keyboard.perform()
}

export async function keyboardImplementation(
  pressed: Set<string>,
  provider: BrowserProvider,
  _sessionId: string,
  text: string,
  selectAll: () => Promise<void>,
  skipRelease: boolean,
): Promise<{ pressed: Set<string> }> {
  const browser = (provider as WebdriverBrowserProvider).browser!
  const actions = parseKeyDef(text)

  let keyboard = browser.action('key')

  for (const { releasePrevious, releaseSelf, repeat, keyDef } of actions) {
    let key = keyDef.key!
    const special = Key[key as 'Shift']

    if (special) {
      key = special
    }

    if (pressed.has(key)) {
      keyboard.up(key)
      pressed.delete(key)
    }

    if (!releasePrevious) {
      if (key === 'selectall') {
        await keyboard.perform()
        keyboard = browser.action('key')
        await selectAll()
        continue
      }

      for (let i = 1; i <= repeat; i++) {
        keyboard.down(key)
      }

      if (releaseSelf) {
        keyboard.up(key)
      }
      else {
        pressed.add(key)
      }
    }
  }

  // seems like webdriverio doesn't release keys automatically if skipRelease is true and all events are keyUp
  const allRelease = keyboard.toJSON().actions.every(action => action.type === 'keyUp')

  await keyboard.perform(allRelease ? false : skipRelease)

  return {
    pressed,
  }
}

function focusIframe() {
  if (
    !document.activeElement
    || document.activeElement.ownerDocument !== document
    || document.activeElement === document.body
  ) {
    window.focus()
  }
}

function selectAll() {
  const element = document.activeElement as HTMLInputElement
  if (element && typeof element.select === 'function') {
    element.select()
  }
}
