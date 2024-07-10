import type { Task, WorkerGlobalState } from 'vitest'
import type { BrowserRPC } from '@vitest/browser/client'
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
import type { BrowserRunnerState } from '../utils'

// this file should not import anything directly, only types

// @ts-expect-error not typed global
const state = (): WorkerGlobalState => __vitest_worker__
// @ts-expect-error not typed global
const runner = (): BrowserRunnerState => __vitest_browser_runner__
function filepath() {
  return state().filepath || state().current?.file?.filepath || undefined
}
const rpc = () => state().rpc as any as BrowserRPC
const contextId = runner().contextId
const channel = new BroadcastChannel(`vitest:${contextId}`)

function triggerCommand<T>(command: string, ...args: any[]) {
  return rpc().triggerCommand<T>(contextId, command, filepath(), args)
}

const provider = runner().provider

function convertElementToCssSelector(element: Element) {
  if (!element || !(element instanceof Element)) {
    throw new Error(
      `Expected DOM element to be an instance of Element, received ${typeof element}`,
    )
  }

  const css = getUniqueCssSelector(element)
  if (provider === 'playwright') {
    return `css=${css}`
  }
  return css
}

function escapeIdForCSSSelector(id: string) {
  return id
    .split('')
    .map((char) => {
      const code = char.charCodeAt(0)

      if (char === ' ' || char === '#' || char === '.' || char === ':' || char === '[' || char === ']' || char === '>' || char === '+' || char === '~' || char === '\\') {
        // Escape common special characters with backslashes
        return `\\${char}`
      }
      else if (code >= 0x10000) {
        // Unicode escape for characters outside the BMP
        return `\\${code.toString(16).toUpperCase().padStart(6, '0')} `
      }
      else if (code < 0x20 || code === 0x7F) {
        // Non-printable ASCII characters (0x00-0x1F and 0x7F) are escaped
        return `\\${code.toString(16).toUpperCase().padStart(2, '0')} `
      }
      else if (code >= 0x80) {
        // Non-ASCII characters (0x80 and above) are escaped
        return `\\${code.toString(16).toUpperCase().padStart(2, '0')} `
      }
      else {
        // Allowable characters are used directly
        return char
      }
    })
    .join('')
}

function getUniqueCssSelector(el: Element) {
  const path = []
  let parent: null | ParentNode
  let hasShadowRoot = false
  // eslint-disable-next-line no-cond-assign
  while (parent = getParent(el)) {
    if ((parent as Element).shadowRoot) {
      hasShadowRoot = true
    }

    const tag = el.tagName
    if (el.id) {
      path.push(`#${escapeIdForCSSSelector(el.id)}`)
    }
    else if (!el.nextElementSibling && !el.previousElementSibling) {
      path.push(tag.toLowerCase())
    }
    else {
      let index = 0
      let sameTagSiblings = 0
      let elementIndex = 0

      for (const sibling of parent.children) {
        index++
        if (sibling.tagName === tag) {
          sameTagSiblings++
        }
        if (sibling === el) {
          elementIndex = index
        }
      }

      if (sameTagSiblings > 1) {
        path.push(`${tag.toLowerCase()}:nth-child(${elementIndex})`)
      }
      else {
        path.push(tag.toLowerCase())
      }
    }
    el = parent as Element
  };
  return `${provider === 'webdriverio' && hasShadowRoot ? '>>>' : ''}${path.reverse().join(' > ')}`
}

function getParent(el: Element) {
  const parent = el.parentNode
  if (parent instanceof ShadowRoot) {
    return parent.host
  }
  return parent
}

function createUserEvent(): UserEvent {
  const keyboard = {
    unreleased: [] as string[],
  }

  return {
    setup() {
      return createUserEvent()
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
      const values = provider === 'webdriverio'
        ? getWebdriverioSelectOptions(element, value)
        : getSimpleSelectOptions(element, value)
      const css = convertElementToCssSelector(element)
      return triggerCommand('__vitest_selectOptions', css, values)
    },
    async type(element: Element | Locator, text: string, options: UserEventTypeOptions = {}) {
      const css = convertToLocator(element).selector
      const { unreleased } = await triggerCommand<{ unreleased: string[] }>(
        '__vitest_type',
        css,
        text,
        { ...options, unreleased: keyboard.unreleased },
      )
      keyboard.unreleased = unreleased
    },
    clear(element: Element | Locator) {
      return convertToLocator(element).clear()
    },
    tab(options: UserEventTabOptions = {}) {
      return triggerCommand('__vitest_tab', options)
    },
    async keyboard(text: string) {
      const { unreleased } = await triggerCommand<{ unreleased: string[] }>(
        '__vitest_keyboard',
        text,
        keyboard,
      )
      keyboard.unreleased = unreleased
    },
    hover(element: Element | Locator, options: UserEventHoverOptions = {}) {
      return convertToLocator(element).hover(processHoverOptions(options))
    },
    unhover(element: Element | Locator, options: UserEventHoverOptions = {}) {
      return convertToLocator(element).unhover(options)
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
  }
}

export const userEvent: UserEvent = createUserEvent()

function getWebdriverioSelectOptions(element: Element, value: string | string[] | HTMLElement[] | HTMLElement) {
  const options = [...element.querySelectorAll('option')] as HTMLOptionElement[]

  const arrayValues = Array.isArray(value) ? value : [value]

  if (!arrayValues.length) {
    return []
  }

  if (arrayValues.length > 1) {
    throw new Error('Provider "webdriverio" doesn\'t support selecting multiple values at once')
  }

  const optionValue = arrayValues[0]

  if (typeof optionValue !== 'string') {
    const index = options.indexOf(optionValue as HTMLOptionElement)
    if (index === -1) {
      throw new Error(`The element ${convertElementToCssSelector(optionValue)} was not found in the "select" options.`)
    }

    return [{ index }]
  }

  const valueIndex = options.findIndex(option => option.value === optionValue)
  if (valueIndex !== -1) {
    return [{ index: valueIndex }]
  }

  const labelIndex = options.findIndex(option =>
    option.textContent?.trim() === optionValue || option.ariaLabel === optionValue,
  )

  if (labelIndex === -1) {
    throw new Error(`The option "${optionValue}" was not found in the "select" options.`)
  }

  return [{ index: labelIndex }]
}

function getSimpleSelectOptions(element: Element, value: string | string[] | HTMLElement[] | HTMLElement) {
  return (Array.isArray(value) ? value : [value]).map((v) => {
    if (typeof v !== 'string') {
      return { element: convertElementToCssSelector(v) }
    }
    return v
  })
}

export function cdp() {
  return runner().cdp!
}

const screenshotIds: Record<string, Record<string, string>> = {}
export const page: BrowserPage = {
  viewport(width, height) {
    const id = runner().iframeId
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
    const currentTest = state().current
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

    return triggerCommand('__vitest_screenshot', name, {
      ...options,
      element: options.element
        ? convertToSelector(options.element)
        : undefined,
    })
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
    return elementOrLocator.selector
  }
  throw new Error('Expected element or locator to be an instance of Element or Locator.')
}

function getTaskFullName(task: Task): string {
  return task.suite ? `${getTaskFullName(task.suite)} ${task.name}` : task.name
}

function processClickOptions(options_?: UserEventClickOptions) {
  // only ui scales the iframe, so we need to adjust the position
  if (!options_ || !state().config.browser.ui) {
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
  // only ui scales the iframe, so we need to adjust the position
  if (!options_ || !state().config.browser.ui) {
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
  // only ui scales the iframe, so we need to adjust the position
  if (!options_ || !state().config.browser.ui) {
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
  const testerUi = window.parent.document.querySelector('#tester-ui') as HTMLElement | null
  if (!testerUi) {
    throw new Error(`Cannot find Tester element. This is a bug in Vitest. Please, open a new issue with reproduction.`)
  }
  const scaleAttribute = testerUi.getAttribute('data-scale')
  const scale = Number(scaleAttribute)
  if (Number.isNaN(scale)) {
    throw new TypeError(`Cannot parse scale value from Tester element (${scaleAttribute}). This is a bug in Vitest. Please, open a new issue with reproduction.`)
  }
  return scale
}
