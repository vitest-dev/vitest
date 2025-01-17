import type { SerializedConfig, WorkerGlobalState } from 'vitest'

export async function importId(id: string) {
  const name = `/@id/${id}`.replace(/\\/g, '/')
  return getBrowserState().wrapModule(() => import(/* @vite-ignore */ name))
}

export async function importFs(id: string) {
  const name = `/@fs/${id}`.replace(/\\/g, '/')
  return getBrowserState().wrapModule(() => import(/* @vite-ignore */ name))
}

export const executor = {
  isBrowser: true,

  executeId: (id: string) => {
    if (id[0] === '/' || id[1] === ':') {
      return importFs(id)
    }
    return importId(id)
  },
}

export function getConfig(): SerializedConfig {
  return getBrowserState().config
}

export function ensureAwaited<T>(promise: () => Promise<T>): Promise<T> {
  const test = getWorkerState().current
  if (!test || test.type !== 'test') {
    return promise()
  }
  let awaited = false
  const sourceError = new Error('STACK_TRACE_ERROR')
  test.onFinished ??= []
  test.onFinished.push(() => {
    if (!awaited) {
      const error = new Error(
        `The call was not awaited. This method is asynchronous and must be awaited; otherwise, the call will not start to avoid unhandled rejections.`,
      )
      error.stack = sourceError.stack?.replace(sourceError.message, error.message)
      throw error
    }
  })
  // don't even start the promise if it's not awaited to not cause any unhanded promise rejections
  let promiseResult: Promise<T> | undefined
  return {
    then(onFulfilled, onRejected) {
      awaited = true
      return (promiseResult ||= promise()).then(onFulfilled, onRejected)
    },
    catch(onRejected) {
      return (promiseResult ||= promise()).catch(onRejected)
    },
    finally(onFinally) {
      return (promiseResult ||= promise()).finally(onFinally)
    },
    [Symbol.toStringTag]: 'Promise',
  } satisfies Promise<T>
}

export interface BrowserRunnerState {
  files: string[]
  runningFiles: string[]
  moduleCache: WorkerGlobalState['moduleCache']
  config: SerializedConfig
  provider: string
  viteConfig: {
    root: string
  }
  providedContext: string
  type: 'tester' | 'orchestrator'
  wrapModule: <T>(module: () => T) => T
  iframeId?: string
  sessionId: string
  testerId: string
  method: 'run' | 'collect'
  runTests?: (tests: string[]) => Promise<void>
  createTesters?: (files: string[]) => Promise<void>
  cdp?: {
    on: (event: string, listener: (payload: any) => void) => void
    once: (event: string, listener: (payload: any) => void) => void
    off: (event: string, listener: (payload: any) => void) => void
    send: (method: string, params?: Record<string, unknown>) => Promise<unknown>
    emit: (event: string, payload: unknown) => void
  }
}

/* @__NO_SIDE_EFFECTS__ */
export function getBrowserState(): BrowserRunnerState {
  // @ts-expect-error not typed global
  return window.__vitest_browser_runner__
}

/* @__NO_SIDE_EFFECTS__ */
export function getWorkerState(): WorkerGlobalState {
  // @ts-expect-error not typed global
  const state = window.__vitest_worker__
  if (!state) {
    throw new Error('Worker state is not found. This is an issue with Vitest. Please, open an issue.')
  }
  return state
}

/* @__NO_SIDE_EFFECTS__ */
export function convertElementToCssSelector(element: Element) {
  if (!element || !(element instanceof Element)) {
    throw new Error(
      `Expected DOM element to be an instance of Element, received ${typeof element}`,
    )
  }

  return getUniqueCssSelector(element)
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
  return `${getBrowserState().provider === 'webdriverio' && hasShadowRoot ? '>>>' : ''}${path.reverse().join(' > ')}`
}

function getParent(el: Element) {
  const parent = el.parentNode
  if (parent instanceof ShadowRoot) {
    return parent.host
  }
  return parent
}
