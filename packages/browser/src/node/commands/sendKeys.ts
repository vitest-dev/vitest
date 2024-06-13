// based on https://github.com/modernweb-dev/web/blob/f7fcf29cb79e82ad5622665d76da3f6b23d0ef43/packages/test-runner-commands/src/sendKeysPlugin.ts

import type { BrowserCommand } from 'vitest/node'
import type {
  BrowserCommands,
  DownPayload,
  PressPayload,
  SendKeysPayload,
  TypePayload,
  UpPayload,
} from '../../../context'
import { PlaywrightBrowserProvider } from '../providers/playwright'
import { WebdriverBrowserProvider } from '../providers/webdriver'

function isObject(payload: unknown): payload is Record<string, unknown> {
  return payload != null && typeof payload === 'object'
}

function isSendKeysPayload(payload: unknown): boolean {
  const validOptions = ['type', 'press', 'down', 'up']

  if (!isObject(payload)) {
    throw new Error('You must provide a `SendKeysPayload` object')
  }

  const numberOfValidOptions = Object.keys(payload).filter(key =>
    validOptions.includes(key),
  ).length
  const unknownOptions = Object.keys(payload).filter(
    key => !validOptions.includes(key),
  )

  if (numberOfValidOptions > 1) {
    throw new Error(
      `You must provide ONLY one of the following properties to pass to the browser runner: ${validOptions.join(
        ', ',
      )}.`,
    )
  }
  if (numberOfValidOptions === 0) {
    throw new Error(
      `You must provide one of the following properties to pass to the browser runner: ${validOptions.join(
        ', ',
      )}.`,
    )
  }
  if (unknownOptions.length > 0) {
    throw new Error(
      `Unknown options \`${unknownOptions.join(', ')}\` present.`,
    )
  }

  return true
}

function isTypePayload(payload: SendKeysPayload): payload is TypePayload {
  return 'type' in payload
}

function isPressPayload(payload: SendKeysPayload): payload is PressPayload {
  return 'press' in payload
}

function isDownPayload(payload: SendKeysPayload): payload is DownPayload {
  return 'down' in payload
}

function isUpPayload(payload: SendKeysPayload): payload is UpPayload {
  return 'up' in payload
}

export const sendKeys: BrowserCommand<
  Parameters<BrowserCommands['sendKeys']>
> = async ({ provider, contextId }, payload) => {
  if (!isSendKeysPayload(payload) || !payload) {
    throw new Error('You must provide a `SendKeysPayload` object')
  }

  if (provider instanceof PlaywrightBrowserProvider) {
    const page = provider.getPage(contextId)
    if (isTypePayload(payload)) {
      await page.keyboard.type(payload.type)
    }
    else if (isPressPayload(payload)) {
      await page.keyboard.press(payload.press)
    }
    else if (isDownPayload(payload)) {
      await page.keyboard.down(payload.down)
    }
    else if (isUpPayload(payload)) {
      await page.keyboard.up(payload.up)
    }
  }
  else if (provider instanceof WebdriverBrowserProvider) {
    const browser = provider.browser!
    if (isTypePayload(payload)) {
      await browser.keys(payload.type.split(''))
    }
    else if (isPressPayload(payload)) {
      await browser.keys([payload.press])
    }
    else {
      throw new Error('Only "press" and "type" are supported by webdriverio.')
    }
  }
  else {
    throw new TypeError(
      `"sendKeys" is not supported for ${provider.name} browser provider.`,
    )
  }
}
