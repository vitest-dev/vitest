import type { BrowserProvider } from 'vitest/node'
import type { UserEventCommand } from './utils'
import { defaultKeyMap } from '@testing-library/user-event/dist/esm/keyboard/keyMap.js'
import { parseKeyDef } from '@testing-library/user-event/dist/esm/keyboard/parseKeyDef.js'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'

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
    context.sessionId,
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
  const { provider, sessionId } = context
  if (provider instanceof PlaywrightBrowserProvider) {
    const page = provider.getPage(sessionId)
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

// fallback to insertText for non US key
// https://github.com/microsoft/playwright/blob/50775698ae13642742f2a1e8983d1d686d7f192d/packages/playwright-core/src/server/input.ts#L95
const VALID_KEYS = new Set(['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Backquote', '`', '~', 'Digit1', '1', '!', 'Digit2', '2', '@', 'Digit3', '3', '#', 'Digit4', '4', '$', 'Digit5', '5', '%', 'Digit6', '6', '^', 'Digit7', '7', '&', 'Digit8', '8', '*', 'Digit9', '9', '(', 'Digit0', '0', ')', 'Minus', '-', '_', 'Equal', '=', '+', 'Backslash', '\\', '|', 'Backspace', 'Tab', 'KeyQ', 'q', 'Q', 'KeyW', 'w', 'W', 'KeyE', 'e', 'E', 'KeyR', 'r', 'R', 'KeyT', 't', 'T', 'KeyY', 'y', 'Y', 'KeyU', 'u', 'U', 'KeyI', 'i', 'I', 'KeyO', 'o', 'O', 'KeyP', 'p', 'P', 'BracketLeft', '[', '{', 'BracketRight', ']', '}', 'CapsLock', 'KeyA', 'a', 'A', 'KeyS', 's', 'S', 'KeyD', 'd', 'D', 'KeyF', 'f', 'F', 'KeyG', 'g', 'G', 'KeyH', 'h', 'H', 'KeyJ', 'j', 'J', 'KeyK', 'k', 'K', 'KeyL', 'l', 'L', 'Semicolon', ';', ':', 'Quote', '\'', '"', 'Enter', '\n', '\r', 'ShiftLeft', 'Shift', 'KeyZ', 'z', 'Z', 'KeyX', 'x', 'X', 'KeyC', 'c', 'C', 'KeyV', 'v', 'V', 'KeyB', 'b', 'B', 'KeyN', 'n', 'N', 'KeyM', 'm', 'M', 'Comma', ',', '<', 'Period', '.', '>', 'Slash', '/', '?', 'ShiftRight', 'ControlLeft', 'Control', 'MetaLeft', 'Meta', 'AltLeft', 'Alt', 'Space', ' ', 'AltRight', 'AltGraph', 'MetaRight', 'ContextMenu', 'ControlRight', 'PrintScreen', 'ScrollLock', 'Pause', 'PageUp', 'PageDown', 'Insert', 'Delete', 'Home', 'End', 'ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown', 'NumLock', 'NumpadDivide', 'NumpadMultiply', 'NumpadSubtract', 'Numpad7', 'Numpad8', 'Numpad9', 'Numpad4', 'Numpad5', 'Numpad6', 'NumpadAdd', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad0', 'NumpadDecimal', 'NumpadEnter', 'ControlOrMeta'])

export async function keyboardImplementation(
  pressed: Set<string>,
  provider: BrowserProvider,
  sessionId: string,
  text: string,
  selectAll: () => Promise<void>,
  skipRelease: boolean,
) {
  if (provider instanceof PlaywrightBrowserProvider) {
    const page = provider.getPage(sessionId)
    const actions = parseKeyDef(defaultKeyMap, text)

    for (const { releasePrevious, releaseSelf, repeat, keyDef } of actions) {
      const key = keyDef.key!

      // TODO: instead of calling down/up for each key, join non special
      // together, and call `type` once for all non special keys,
      // and then `press` for special keys
      if (pressed.has(key)) {
        if (VALID_KEYS.has(key)) {
          await page.keyboard.up(key)
        }
        pressed.delete(key)
      }

      if (!releasePrevious) {
        if (key === 'selectall') {
          await selectAll()
          continue
        }

        for (let i = 1; i <= repeat; i++) {
          if (VALID_KEYS.has(key)) {
            await page.keyboard.down(key)
          }
          else {
            await page.keyboard.insertText(key)
          }
        }

        if (releaseSelf) {
          if (VALID_KEYS.has(key)) {
            await page.keyboard.up(key)
          }
        }
        else {
          pressed.add(key)
        }
      }
    }

    if (!skipRelease && pressed.size) {
      for (const key of pressed) {
        if (VALID_KEYS.has(key)) {
          await page.keyboard.up(key)
        }
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
