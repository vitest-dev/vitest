import type { Task, WorkerGlobalState } from 'vitest'
import type {
  BrowserPage,
  UserEvent,
  UserEventClickOptions,
} from '../../context'
import type { BrowserRPC } from './client'
import type { BrowserRunnerState } from './utils'

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

export const userEvent: UserEvent = {
  click(element: Element, options: UserEventClickOptions = {}) {
    const xpath = convertElementToXPath(element)
    return triggerCommand('__vitest_click', xpath, options)
  },
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
