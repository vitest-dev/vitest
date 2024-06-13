import { parseKeyDef } from '@testing-library/user-event/dist/esm/keyboard/parseKeyDef.js'
import { defaultKeyMap } from '@testing-library/user-event/dist/esm/keyboard/keyMap.js'
import type { UserEvent } from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'
import type { UserEventCommand } from './utils'

export const type: UserEventCommand<UserEvent['type']> = async (
  context,
  xpath,
  text,
  _options = {},
) => {
  if (context.provider instanceof PlaywrightBrowserProvider) {
    const { tester } = context
    const element = tester.locator(`xpath=${xpath}`)
    const actions = parseKeyDef(defaultKeyMap, text)

    for (const { releasePrevious, repeat, keyDef } of actions) {
      const key = keyDef.key!

      if (!releasePrevious) {
        for (let i = 1; i <= repeat; i++) {
          await element.press(key)
        }
      }
    }
  }
  else if (context.provider instanceof WebdriverBrowserProvider) {
    const { Key } = await import('webdriverio')
    const browser = context.browser
    const markedXpath = `//${xpath}`
    const element = await browser.$(markedXpath)
    const actions = parseKeyDef(defaultKeyMap, text)

    if (!await element.isFocused()) {
      await element.click()
    }

    const keys = actions.reduce<string[][]>((acc, { keyDef, repeat, releasePrevious }) => {
      const key = keyDef.key!
      const code = 'location' in keyDef ? keyDef.key! : keyDef.code!
      const special = Key[code as 'Shift']
      if (special) {
        const specialArray = [special]
        Object.assign(specialArray, { special: true })
        acc.push(specialArray)
      }
      else {
        if (releasePrevious)
          return acc
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
      await browser.keys(key.join(''))
    }
  }
  else {
    throw new TypeError(`Provider "${context.provider.name}" does not support typing`)
  }
}
