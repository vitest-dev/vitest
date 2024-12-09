import type { Options as TestingLibraryOptions, UserEvent as TestingLibraryUserEvent } from '@testing-library/user-event'
import type { BrowserRPC } from '@vitest/browser/client'
import type { RunnerTask } from 'vitest'
import type {
  BrowserPage,
  Locator,
  UserEvent,
  UserEventClickOptions,
  UserEventDragAndDropOptions,
  UserEventHoverOptions,
  UserEventTabOptions,
  UserEventTypeOptions,
} from '../../../context'
import { convertElementToCssSelector, ensureAwaited, getBrowserState, getWorkerState } from '../utils'

// this file should not import anything directly, only types and utils

// @ts-expect-error not typed global
const provider = __vitest_browser_runner__.provider
function filepath() {
  return getWorkerState().filepath || getWorkerState().current?.file?.filepath || undefined
}
const rpc = () => getWorkerState().rpc as any as BrowserRPC
const contextId = getBrowserState().contextId
const channel = new BroadcastChannel(`vitest:${contextId}`)

function triggerCommand<T>(command: string, ...args: any[]) {
  return rpc().triggerCommand<T>(contextId, command, filepath(), args)
}

export function createUserEvent(__tl_user_event_base__?: TestingLibraryUserEvent, options?: TestingLibraryOptions): UserEvent {
  if (__tl_user_event_base__) {
    return createPreviewUserEvent(__tl_user_event_base__, options ?? {})
  }

  const keyboard = {
    unreleased: [] as string[],
  }

  return {
    setup() {
      return createUserEvent()
    },
    async cleanup() {
      return ensureAwaited(async () => {
        await triggerCommand('__vitest_cleanup', keyboard)
        keyboard.unreleased = []
      })
    },
    click(element: Element | Locator, options: UserEventClickOptions = {}) {
      return convertToLocator(element).click(processClickOptions(options))
    },
    dblClick(element: Element | Locator, options: UserEventClickOptions = {}) {
      return convertToLocator(element).dblClick(processClickOptions(options))
    },
    tripleClick(element: Element | Locator, options: UserEventClickOptions = {}) {
      return convertToLocator(element).tripleClick(processClickOptions(options))
    },
    selectOptions(element, value) {
      return convertToLocator(element).selectOptions(value)
    },
    clear(element: Element | Locator) {
      return convertToLocator(element).clear()
    },
    hover(element: Element | Locator, options: UserEventHoverOptions = {}) {
      return convertToLocator(element).hover(processHoverOptions(options))
    },
    unhover(element: Element | Locator, options: UserEventHoverOptions = {}) {
      return convertToLocator(element).unhover(options)
    },
    upload(element: Element | Locator, files: string | string[] | File | File[]) {
      return convertToLocator(element).upload(files)
    },

    // non userEvent events, but still useful
    fill(element: Element | Locator, text: string, options) {
      return convertToLocator(element).fill(text, options)
    },
    dragAndDrop(source: Element | Locator, target: Element | Locator, options = {}) {
      const sourceLocator = convertToLocator(source)
      const targetLocator = convertToLocator(target)
      return sourceLocator.dropTo(targetLocator, processDragAndDropOptions(options))
    },

    // testing-library user-event
    async type(element: Element | Locator, text: string, options: UserEventTypeOptions = {}) {
      return ensureAwaited(async () => {
        const selector = convertToSelector(element)
        const { unreleased } = await triggerCommand<{ unreleased: string[] }>(
          '__vitest_type',
          selector,
          text,
          { ...options, unreleased: keyboard.unreleased },
        )
        keyboard.unreleased = unreleased
      })
    },
    tab(options: UserEventTabOptions = {}) {
      return ensureAwaited(() => {
        return triggerCommand('__vitest_tab', options)
      })
    },
    async keyboard(text: string) {
      return ensureAwaited(async () => {
        const { unreleased } = await triggerCommand<{ unreleased: string[] }>(
          '__vitest_keyboard',
          text,
          keyboard,
        )
        keyboard.unreleased = unreleased
      })
    },
  }
}

function createPreviewUserEvent(userEventBase: TestingLibraryUserEvent, options: TestingLibraryOptions): UserEvent {
  let userEvent = userEventBase.setup(options)

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
    async upload(element: Element | Locator, files: string | string[] | File | File[]) {
      const uploadPromise = (Array.isArray(files) ? files : [files]).map(async (file) => {
        if (typeof file !== 'string') {
          return file
        }

        const { content: base64, basename, mime } = await triggerCommand<{
          content: string
          basename: string
          mime: string
        }>('__vitest_fileInfo', file, 'base64')

        const fileInstance = fetch(`data:${mime};base64,${base64}`)
          .then(r => r.blob())
          .then(blob => new File([blob], basename, { type: mime }))
        return fileInstance
      })
      const uploadFiles = await Promise.all(uploadPromise)
      return userEvent.upload(toElement(element) as HTMLElement, uploadFiles)
    },

    async fill(element: Element | Locator, text: string) {
      await userEvent.clear(toElement(element))
      return userEvent.type(toElement(element), text)
    },
    async dragAndDrop() {
      throw new Error(`The "preview" provider doesn't support 'userEvent.dragAndDrop'`)
    },

    async type(element: Element | Locator, text: string, options: UserEventTypeOptions = {}) {
      await userEvent.type(toElement(element), text, options)
    },
    async tab(options: UserEventTabOptions = {}) {
      await userEvent.tab(options)
    },
    async keyboard(text: string) {
      await userEvent.keyboard(text)
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

export function cdp() {
  return getBrowserState().cdp!
}

const screenshotIds: Record<string, Record<string, string>> = {}
export const page: BrowserPage = {
  viewport(width, height) {
    const id = getBrowserState().iframeId
    channel.postMessage({ type: 'viewport', width, height, id })
    return new Promise((resolve, reject) => {
      channel.addEventListener('message', function handler(e) {
        if (e.data.type === 'viewport:done' && e.data.id === id) {
          channel.removeEventListener('message', handler)
          resolve()
        }
        if (e.data.type === 'viewport:fail' && e.data.id === id) {
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

    return ensureAwaited(() => triggerCommand('__vitest_screenshot', name, {
      ...options,
      element: options.element
        ? convertToSelector(options.element)
        : undefined,
    }))
  },
  getByRole() {
    throw new Error('Method "getByRole" is not implemented in the current provider.')
  },
  getByLabelText() {
    throw new Error('Method "getByLabelText" is not implemented in the current provider.')
  },
  getByTestId() {
    throw new Error('Method "getByTestId" is not implemented in the current provider.')
  },
  getByAltText() {
    throw new Error('Method "getByAltText" is not implemented in the current provider.')
  },
  getByPlaceholder() {
    throw new Error('Method "getByPlaceholder" is not implemented in the current provider.')
  },
  getByText() {
    throw new Error('Method "getByText" is not implemented in the current provider.')
  },
  getByTitle() {
    throw new Error('Method "getByTitle" is not implemented in the current provider.')
  },
  elementLocator() {
    throw new Error('Method "elementLocator" is not implemented in the current provider.')
  },
  extend(methods) {
    for (const key in methods) {
      (page as any)[key] = (methods as any)[key]
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

function convertToSelector(elementOrLocator: Element | Locator): string {
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

function processClickOptions(options_?: UserEventClickOptions) {
  if (!options_) {
    return options_
  }
  if (provider === 'playwright') {
    const options = options_ as NonNullable<
      Parameters<import('playwright').Page['click']>[1]
    >
    if (options.position) {
      options.position = processPlaywrightPosition(options.position)
    }
  }
  if (provider === 'webdriverio') {
    const options = options_ as import('webdriverio').ClickOptions
    if (options.x != null || options.y != null) {
      const cache = {}
      if (options.x != null) {
        options.x = scaleCoordinate(options.x, cache)
      }
      if (options.y != null) {
        options.y = scaleCoordinate(options.y, cache)
      }
    }
  }
  return options_
}

function processHoverOptions(options_?: UserEventHoverOptions) {
  if (!options_) {
    return options_
  }

  if (provider === 'playwright') {
    const options = options_ as NonNullable<
      Parameters<import('playwright').Page['hover']>[1]
    >
    if (options.position) {
      options.position = processPlaywrightPosition(options.position)
    }
  }
  if (provider === 'webdriverio') {
    const options = options_ as import('webdriverio').MoveToOptions
    const cache = {}
    if (options.xOffset != null) {
      options.xOffset = scaleCoordinate(options.xOffset, cache)
    }
    if (options.yOffset != null) {
      options.yOffset = scaleCoordinate(options.yOffset, cache)
    }
  }
  return options_
}

function processDragAndDropOptions(options_?: UserEventDragAndDropOptions) {
  if (!options_) {
    return options_
  }
  if (provider === 'playwright') {
    const options = options_ as NonNullable<
      Parameters<import('playwright').Page['dragAndDrop']>[2]
    >
    if (options.sourcePosition) {
      options.sourcePosition = processPlaywrightPosition(options.sourcePosition)
    }
    if (options.targetPosition) {
      options.targetPosition = processPlaywrightPosition(options.targetPosition)
    }
  }
  if (provider === 'webdriverio') {
    const cache = {}
    const options = options_ as import('webdriverio').DragAndDropOptions & {
      targetX?: number
      targetY?: number
      sourceX?: number
      sourceY?: number
    }
    if (options.sourceX != null) {
      options.sourceX = scaleCoordinate(options.sourceX, cache)
    }
    if (options.sourceY != null) {
      options.sourceY = scaleCoordinate(options.sourceY, cache)
    }
    if (options.targetX != null) {
      options.targetX = scaleCoordinate(options.targetX, cache)
    }
    if (options.targetY != null) {
      options.targetY = scaleCoordinate(options.targetY, cache)
    }
  }
  return options_
}

function scaleCoordinate(coordinate: number, cache: any) {
  return Math.round(coordinate * getCachedScale(cache))
}

function getCachedScale(cache: { scale: number | undefined }) {
  return cache.scale ??= getIframeScale()
}

function processPlaywrightPosition(position: { x: number; y: number }) {
  const scale = getIframeScale()
  if (position.x != null) {
    position.x *= scale
  }
  if (position.y != null) {
    position.y *= scale
  }
  return position
}

function getIframeScale() {
  const testerUi = window.parent.document.querySelector(`iframe[data-vitest]`)?.parentElement
  if (!testerUi) {
    throw new Error(`Cannot find Tester element. This is a bug in Vitest. Please, open a new issue with reproduction.`)
  }
  const scaleAttribute = testerUi.getAttribute('data-scale')
  if (scaleAttribute === null) {
    return 1
  }
  const scale = Number(scaleAttribute)
  if (Number.isNaN(scale)) {
    throw new TypeError(`Cannot parse scale value from Tester element (${scaleAttribute}). This is a bug in Vitest. Please, open a new issue with reproduction.`)
  }
  return scale
}
