import type { Options as TestingLibraryOptions, UserEvent as TestingLibraryUserEvent } from '@testing-library/user-event'
import type { RunnerTask } from 'vitest'
import type {
  BrowserLocators,
  BrowserPage,
  Locator,
  UserEvent,
} from '../../../context'
import type { IframeViewportEvent } from '../client'
import type { BrowserRunnerState } from '../utils'
import type { Locator as LocatorAPI } from './locators/index'
import { getElementLocatorSelectors } from '@vitest/browser/utils'
import { ensureAwaited, getBrowserState, getWorkerState } from '../utils'
import { convertElementToCssSelector, processTimeoutOptions } from './utils'

// this file should not import anything directly, only types and utils

// @ts-expect-error not typed global
const provider = __vitest_browser_runner__.provider
const sessionId = getBrowserState().sessionId
const channel = new BroadcastChannel(`vitest:${sessionId}`)

function triggerCommand<T>(command: string, args: any[], error?: Error) {
  return getBrowserState().commands.triggerCommand<T>(command, args, error)
}

export function createUserEvent(__tl_user_event_base__?: TestingLibraryUserEvent, options?: TestingLibraryOptions): UserEvent {
  if (__tl_user_event_base__) {
    return createPreviewUserEvent(__tl_user_event_base__, options ?? {})
  }

  const keyboard = {
    unreleased: [] as string[],
  }

  // https://playwright.dev/docs/api/class-keyboard
  // https://webdriver.io/docs/api/browser/keys/
  const modifier = provider === `playwright`
    ? 'ControlOrMeta'
    : provider === 'webdriverio'
      ? 'Ctrl'
      : 'Control'

  const userEvent: UserEvent = {
    setup() {
      return createUserEvent()
    },
    async cleanup() {
      // avoid cleanup rpc call if there is nothing to cleanup
      if (!keyboard.unreleased.length) {
        return
      }
      return ensureAwaited(async (error) => {
        await triggerCommand('__vitest_cleanup', [keyboard], error)
        keyboard.unreleased = []
      })
    },
    click(element, options) {
      return convertToLocator(element).click(options)
    },
    dblClick(element, options) {
      return convertToLocator(element).dblClick(options)
    },
    tripleClick(element, options) {
      return convertToLocator(element).tripleClick(options)
    },
    selectOptions(element, value, options) {
      return convertToLocator(element).selectOptions(value, options)
    },
    clear(element, options) {
      return convertToLocator(element).clear(options)
    },
    hover(element, options) {
      return convertToLocator(element).hover(options)
    },
    unhover(element, options) {
      return convertToLocator(element).unhover(options)
    },
    upload(element, files: string | string[] | File | File[], options) {
      return convertToLocator(element).upload(files, options)
    },

    // non userEvent events, but still useful
    fill(element, text, options) {
      return convertToLocator(element).fill(text, options)
    },
    dragAndDrop(source, target, options) {
      const sourceLocator = convertToLocator(source)
      const targetLocator = convertToLocator(target)
      return sourceLocator.dropTo(targetLocator, options)
    },

    // testing-library user-event
    async type(element, text, options) {
      return ensureAwaited(async (error) => {
        const selector = convertToSelector(element)
        const { unreleased } = await triggerCommand<{ unreleased: string[] }>(
          '__vitest_type',
          [
            selector,
            text,
            { ...options, unreleased: keyboard.unreleased },
          ],
          error,
        )
        keyboard.unreleased = unreleased
      })
    },
    tab(options = {}) {
      return ensureAwaited(error => triggerCommand('__vitest_tab', [options], error))
    },
    async keyboard(text) {
      return ensureAwaited(async (error) => {
        const { unreleased } = await triggerCommand<{ unreleased: string[] }>(
          '__vitest_keyboard',
          [text, keyboard],
          error,
        )
        keyboard.unreleased = unreleased
      })
    },
    async copy() {
      await userEvent.keyboard(`{${modifier}>}{c}{/${modifier}}`)
    },
    async cut() {
      await userEvent.keyboard(`{${modifier}>}{x}{/${modifier}}`)
    },
    async paste() {
      await userEvent.keyboard(`{${modifier}>}{v}{/${modifier}}`)
    },
  }
  return userEvent
}

function createPreviewUserEvent(userEventBase: TestingLibraryUserEvent, options: TestingLibraryOptions): UserEvent {
  let userEvent = userEventBase.setup(options)
  let clipboardData: DataTransfer | undefined

  function toElement(element: Element | Locator) {
    return element instanceof Element ? element : element.element()
  }

  const vitestUserEvent: UserEvent = {
    setup(options?: any) {
      return createPreviewUserEvent(userEventBase, options)
    },
    async cleanup() {
      userEvent = userEventBase.setup(options ?? {})
    },
    async click(element) {
      await userEvent.click(toElement(element))
    },
    async dblClick(element) {
      await userEvent.dblClick(toElement(element))
    },
    async tripleClick(element) {
      await userEvent.tripleClick(toElement(element))
    },
    async selectOptions(element, value) {
      const options = (Array.isArray(value) ? value : [value]).map((option) => {
        if (typeof option !== 'string') {
          return toElement(option)
        }
        return option
      })
      await userEvent.selectOptions(
        element,
        options as string[] | HTMLElement[],
      )
    },
    async clear(element) {
      await userEvent.clear(toElement(element))
    },
    async hover(element: Element | Locator) {
      await userEvent.hover(toElement(element))
    },
    async unhover(element: Element | Locator) {
      await userEvent.unhover(toElement(element))
    },
    async upload(element, files: string | string[] | File | File[]) {
      const uploadPromise = (Array.isArray(files) ? files : [files]).map(async (file) => {
        if (typeof file !== 'string') {
          return file
        }

        const { content: base64, basename, mime } = await triggerCommand<{
          content: string
          basename: string
          mime: string
        }>('__vitest_fileInfo', [file, 'base64'])

        const fileInstance = fetch(`data:${mime};base64,${base64}`)
          .then(r => r.blob())
          .then(blob => new File([blob], basename, { type: mime }))
        return fileInstance
      })
      const uploadFiles = await Promise.all(uploadPromise)
      return userEvent.upload(toElement(element) as HTMLElement, uploadFiles)
    },

    async fill(element, text) {
      await userEvent.clear(toElement(element))
      return userEvent.type(toElement(element), text)
    },
    async dragAndDrop() {
      throw new Error(`The "preview" provider doesn't support 'userEvent.dragAndDrop'`)
    },

    async type(element, text, options) {
      await userEvent.type(toElement(element), text, options)
    },
    async tab(options) {
      await userEvent.tab(options)
    },
    async keyboard(text: string) {
      await userEvent.keyboard(text)
    },

    async copy() {
      clipboardData = await userEvent.copy()
    },
    async cut() {
      clipboardData = await userEvent.cut()
    },
    async paste() {
      await userEvent.paste(clipboardData)
    },
  }

  for (const [name, fn] of Object.entries(vitestUserEvent)) {
    if (name !== 'setup') {
      (vitestUserEvent as any)[name] = function (this: any, ...args: any[]) {
        return ensureAwaited(() => fn.apply(this, args))
      }
    }
  }

  return vitestUserEvent
}

export function cdp(): BrowserRunnerState['cdp'] {
  return getBrowserState().cdp!
}

const screenshotIds: Record<string, Record<string, string>> = {}
export const page: BrowserPage = {
  viewport(width, height) {
    const id = getBrowserState().iframeId!
    channel.postMessage({
      event: 'viewport',
      width,
      height,
      iframeId: id,
    } satisfies IframeViewportEvent)
    return new Promise((resolve, reject) => {
      channel.addEventListener('message', function handler(e) {
        if (e.data.event === 'viewport:done' && e.data.iframeId === id) {
          channel.removeEventListener('message', handler)
          resolve()
        }
        if (e.data.event === 'viewport:fail' && e.data.iframeId === id) {
          channel.removeEventListener('message', handler)
          reject(new Error(e.data.error))
        }
      })
    })
  },
  async screenshot(options = {}) {
    const currentTest = getWorkerState().current
    if (!currentTest) {
      throw new Error('Cannot take a screenshot outside of a test.')
    }

    if (currentTest.concurrent) {
      throw new Error(
        'Cannot take a screenshot in a concurrent test because '
        + 'concurrent tests run at the same time in the same iframe and affect each other\'s environment. '
        + 'Use a non-concurrent test to take a screenshot.',
      )
    }

    const repeatCount = currentTest.result?.repeatCount ?? 0
    const taskName = getTaskFullName(currentTest)
    const number = screenshotIds[repeatCount]?.[taskName] ?? 1

    screenshotIds[repeatCount] ??= {}
    screenshotIds[repeatCount][taskName] = number + 1

    const name
      = options.path || `${taskName.replace(/[^a-z0-9]/gi, '-')}-${number}.png`

    return ensureAwaited(error => triggerCommand('__vitest_screenshot', [name, processTimeoutOptions({
      ...options,
      element: options.element
        ? convertToSelector(options.element)
        : undefined,
    })], error))
  },
  getByRole() {
    throw new Error(`Method "getByRole" is not implemented in the "${provider}" provider.`)
  },
  getByLabelText() {
    throw new Error(`Method "getByLabelText" is not implemented in the "${provider}" provider.`)
  },
  getByTestId() {
    throw new Error(`Method "getByTestId" is not implemented in the "${provider}" provider.`)
  },
  getByAltText() {
    throw new Error(`Method "getByAltText" is not implemented in the "${provider}" provider.`)
  },
  getByPlaceholder() {
    throw new Error(`Method "getByPlaceholder" is not implemented in the "${provider}" provider.`)
  },
  getByText() {
    throw new Error(`Method "getByText" is not implemented in the "${provider}" provider.`)
  },
  getByTitle() {
    throw new Error(`Method "getByTitle" is not implemented in the "${provider}" provider.`)
  },
  elementLocator() {
    throw new Error(`Method "elementLocator" is not implemented in the "${provider}" provider.`)
  },
  _createLocator() {
    throw new Error(`Method "_createLocator" is not implemented in the "${provider}" provider.`)
  },
  extend(methods) {
    for (const key in methods) {
      (page as any)[key] = (methods as any)[key].bind(page)
    }
    return page
  },
}

function convertToLocator(element: Element | Locator): Locator {
  if (element instanceof Element) {
    return page.elementLocator(element)
  }
  return element
}

export function convertToSelector(elementOrLocator: Element | Locator): string {
  if (!elementOrLocator) {
    throw new Error('Expected element or locator to be defined.')
  }
  if (elementOrLocator instanceof Element) {
    return convertElementToCssSelector(elementOrLocator)
  }
  if ('selector' in elementOrLocator) {
    return (elementOrLocator as any).selector
  }
  throw new Error('Expected element or locator to be an instance of Element or Locator.')
}

function getTaskFullName(task: RunnerTask): string {
  return task.suite ? `${getTaskFullName(task.suite)} ${task.name}` : task.name
}

export const locators: BrowserLocators = {
  createElementLocators: getElementLocatorSelectors,
  extend(methods) {
    const Locator = page._createLocator('css=body').constructor as typeof LocatorAPI
    for (const method in methods) {
      const cb = (methods as any)[method] as (...args: any[]) => string | Locator
      // @ts-expect-error types are hard to make work
      Locator.prototype[method] = function (...args: any[]) {
        const selectorOrLocator = cb.call(this, ...args)
        if (typeof selectorOrLocator === 'string') {
          return this.locator(selectorOrLocator)
        }
        return selectorOrLocator
      }
      page[method as 'getByRole'] = function (...args: any[]) {
        const selectorOrLocator = cb.call(this, ...args)
        if (typeof selectorOrLocator === 'string') {
          return page._createLocator(selectorOrLocator)
        }
        return selectorOrLocator
      }
    }
  },
}

declare module '@vitest/browser/context' {
  interface BrowserPage {
    /** @internal */
    _createLocator: (selector: string) => Locator
  }
}
