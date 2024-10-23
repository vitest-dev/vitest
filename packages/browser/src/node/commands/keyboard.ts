import { parseKeyDef } from '@testing-library/user-event/dist/esm/keyboard/parseKeyDef.js'
import { defaultKeyMap } from '@testing-library/user-event/dist/esm/keyboard/keyMap.js'
import type { BrowserProvider } from 'vitest/node'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export interface KeyboardState {
  unreleased: string[]
}

export const keyboard: UserEventCommand<(text: string, state: KeyboardState) => Promise<{ unreleased: string[] }>> = async (
  context,
  text,
  state,
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const frame = await context.frame()
    await frame.evaluate(focusIframe)
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    await context.browser.execute(focusIframe)
  }

  const pressed = new Set<string>(state.unreleased)

  await keyboardImplementation(
    pressed,
    context.provider,
    context.contextId,
    text,
    async () => {
      if (context.provider instanceof PlaywrightBrowserProvider) {
        const frame = await context.frame()
        await frame.evaluate(selectAll)
      }
      else if (context.provider instanceof WebdriverBrowserProvider) {
        await context.browser.execute(selectAll)
      }
      else {
        throw new TypeError(`Provider "${context.provider.name}" does not support selecting all text`)
      }
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
  const { provider, contextId } = context
  if (provider instanceof PlaywrightBrowserProvider) {
    const page = provider.getPage(contextId)
    for (const key of state.unreleased) {
      await page.keyboard.up(key)
    }
  }
  else if (provider instanceof WebdriverBrowserProvider) {
    const keyboard = provider.browser!.action('key')
    for (const key of state.unreleased) {
      keyboard.up(key)
    }
    await keyboard.perform()
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support keyboard api`)
  }
}

export async function keyboardImplementation(
  pressed: Set<string>,
  provider: BrowserProvider,
  contextId: string,
  text: string,
  selectAll: () => Promise<void>,
  skipRelease: boolean,
) {
  if (provider instanceof PlaywrightBrowserProvider) {
    const page = provider.getPage(contextId)
    const actions = parseKeyDef(defaultKeyMap, text)

    for (const { releasePrevious, releaseSelf, repeat, keyDef } of actions) {
      const key = keyDef.key!

      // TODO: instead of calling down/up for each key, join non special
      // together, and call `type` once for all non special keys,
      // and then `press` for special keys
      if (pressed.has(key)) {
        await page.keyboard.up(key)
        pressed.delete(key)
      }

      if (!releasePrevious) {
        if (key === 'selectall') {
          await selectAll()
          continue
        }

        for (let i = 1; i <= repeat; i++) {
          await page.keyboard.down(key)
        }

        if (releaseSelf) {
          await page.keyboard.up(key)
        }
        else {
          pressed.add(key)
        }
      }
    }

    if (!skipRelease && pressed.size) {
      for (const key of pressed) {
        await page.keyboard.up(key)
      }
    }
  }
  else if (provider instanceof WebdriverBrowserProvider) {
    const { Key } = await import('webdriverio')
    const browser = provider.browser!
    const actions = parseKeyDef(defaultKeyMap, text)

    let keyboard = browser.action('key')

    for (const { releasePrevious, releaseSelf, repeat, keyDef } of actions) {
      let key = keyDef.key!
      // const code = 'location' in keyDef ? keyDef.key! : keyDef.code!
      // const special = Key[code as 'Shift']
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
  }

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
  if (element && element.select) {
    element.select()
  }
}
