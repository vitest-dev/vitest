import type { Task, WorkerGlobalState } from 'vitest'
import type { BrowserPage, UserEvent, UserEventClickOptions, UserEventTabOptions, UserEventTypeOptions } from '../../../context'
import type { BrowserRunnerState } from '../utils'
import type { BrowserRPC } from '../client'

// this file should not import anything directly, only types

function convertElementToXPath(element: Element) {
  if (!element || !(element instanceof Element)) {
    throw new Error(
      `Expected DOM element to be an instance of Element, received ${typeof element}`,
    )
  }

  return getPathTo(element)
}

function getPathTo(element: Element): string {
  if (element.id !== '') {
    return `id("${element.id}")`
  }

  if (!element.parentNode || element === document.documentElement) {
    return element.tagName
  }

  let ix = 0
  const siblings = element.parentNode.childNodes
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i]
    if (sibling === element) {
      return `${getPathTo(element.parentNode as Element)}/${element.tagName}[${
        ix + 1
      }]`
    }
    if (
      sibling.nodeType === 1
      && (sibling as Element).tagName === element.tagName
    ) {
      ix++
    }
  }
  return 'invalid xpath'
}

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

export const userEvent: UserEvent = {
  // TODO: actually setup userEvent with config options
  setup() {
    return userEvent
  },
  click(element: Element, options: UserEventClickOptions = {}) {
    const xpath = convertElementToXPath(element)
    return triggerCommand('__vitest_click', xpath, options)
  },
  dblClick(element: Element, options: UserEventClickOptions = {}) {
    const xpath = convertElementToXPath(element)
    return triggerCommand('__vitest_dblClick', xpath, options)
  },
  selectOptions(element, value) {
    const values = provider === 'webdriverio'
      ? getWebdriverioSelectOptions(element, value)
      : getSimpleSelectOptions(element, value)
    return triggerCommand('__vitest_selectOptions', convertElementToXPath(element), values)
  },
  type(element: Element, text: string, options: UserEventTypeOptions = {}) {
    const xpath = convertElementToXPath(element)
    return triggerCommand('__vitest_type', xpath, text, options)
  },
  clear(element: Element) {
    const xpath = convertElementToXPath(element)
    return triggerCommand('__vitest_clear', xpath)
  },
  tab(options: UserEventTabOptions = {}) {
    return triggerCommand('__vitest_tab', options)
  },
  keyboard(text: string) {
    return triggerCommand('__vitest_keyboard', text)
  },
  hover(element: Element) {
    const xpath = convertElementToXPath(element)
    return triggerCommand('__vitest_hover', xpath)
  },
  unhover(element: Element) {
    const xpath = convertElementToXPath(element.ownerDocument.body)
    return triggerCommand('__vitest_hover', xpath)
  },

  // non userEvent events, but still useful
  fill(element: Element, text: string, options) {
    const xpath = convertElementToXPath(element)
    return triggerCommand('__vitest_fill', xpath, text, options)
  },
  dragAndDrop(source: Element, target: Element, options = {}) {
    const sourceXpath = convertElementToXPath(source)
    const targetXpath = convertElementToXPath(target)
    return triggerCommand('__vitest_dragAndDrop', sourceXpath, targetXpath, options)
  },
}

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
      throw new Error(`The element ${convertElementToXPath(optionValue)} was not found in the "select" options.`)
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
      return { element: convertElementToXPath(v) }
    }
    return v
  })
}

export function cdp() {
  return runner().cdp!
}

const screenshotIds: Record<string, Record<string, string>> = {}
export const page: BrowserPage = {
  get config() {
    return runner().config
  },
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
      = options.path || `${taskName.replace(/[^a-z0-9]/g, '-')}-${number}.png`

    return triggerCommand('__vitest_screenshot', name, {
      ...options,
      element: options.element
        ? convertElementToXPath(options.element)
        : undefined,
    })
  },
}

function getTaskFullName(task: Task): string {
  return task.suite ? `${getTaskFullName(task.suite)} ${task.name}` : task.name
}
