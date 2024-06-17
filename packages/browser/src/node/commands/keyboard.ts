import { parseKeyDef } from '@testing-library/user-event/dist/esm/keyboard/parseKeyDef.js'
import { defaultKeyMap } from '@testing-library/user-event/dist/esm/keyboard/keyMap.js'
import type { BrowserProvider } from 'vitest/node'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEvent } from '../../../context'
import type { UserEventCommand } from './utils'

export const keyboard: UserEventCommand<UserEvent['keyboard']> = async (
  context,
  text,
) => {
  function focusIframe() {
    if (
      !document.activeElement
      || document.activeElement.ownerDocument !== document
      || document.activeElement === document.body
    ) {
      window.focus()
    }
  }

  if (context.provider instanceof PlaywrightBrowserProvider) {
    await context.frame.evaluate(focusIframe)
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    await context.browser.execute(focusIframe)
  }

  await keyboardImplementation(
    context.provider,
    context.contextId,
    text,
    async () => {
      function selectAll() {
        const element = document.activeElement as HTMLInputElement
        if (element && element.select) {
          element.select()
        }
      }
      if (context.provider instanceof PlaywrightBrowserProvider) {
        await context.frame.evaluate(selectAll)
      }
      else if (context.provider instanceof WebdriverBrowserProvider) {
        await context.browser.execute(selectAll)
      }
      else {
        throw new TypeError(`Provider "${context.provider.name}" does not support selecting all text`)
      }
    },
  )
}

export async function keyboardImplementation(
  provider: BrowserProvider,
  contextId: string,
  text: string,
  selectAll: () => Promise<void>,
) {
  const pressed = new Set<string>()

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
  }
  else if (provider instanceof WebdriverBrowserProvider) {
    const { Key } = await import('webdriverio')
    const browser = provider.browser!
    const actions = parseKeyDef(defaultKeyMap, text)

    const keys = actions.reduce<string[][]>((acc, { keyDef, repeat, releasePrevious }) => {
      const key = keyDef.key!
      const code = 'location' in keyDef ? keyDef.key! : keyDef.code!
      const special = Key[code as 'Shift']
      if (code === 'Unknown' && key === 'selectall') {
        const specialArray = ['selectall']
        Object.assign(specialArray, { special: true })
        acc.push(specialArray)
        return acc
      }

      if (special) {
        const specialArray = [special]
        Object.assign(specialArray, { special: true })
        acc.push(specialArray)
      }
      else {
        if (releasePrevious) {
          return acc
        }
        const last = acc[acc.length - 1]
        const value = key.repeat(repeat)
        if (last && !('special' in last)) {
          last.push(value)
        }
        else {
          acc.push([value])
        }
      }
      return acc
    }, [])

    for (const key of keys) {
      if (key[0] === 'selectall') {
        await selectAll()
        continue
      }

      await browser.keys(key.join(''))
    }
  }

  return {
    pressed,
  }
}
