import type { SerializedConfig, WorkerGlobalState } from 'vitest'

export async function importId(id: string) {
  const name = `/@id/${id}`.replace(/\\/g, '/')
  return getBrowserState().wrapModule(() => import(/* @vite-ignore */ name))
}

export async function importFs(id: string) {
  const name = `/@fs/${id}`.replace(/\\/g, '/')
  return getBrowserState().wrapModule(() => import(/* @vite-ignore */ name))
}

export function getConfig(): SerializedConfig {
  return getBrowserState().config
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
  contextId: string
  testerId: string
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

  const css = getUniqueCssSelector(element)
  if (getBrowserState().provider === 'playwright') {
    return `css=${css}`
  }
  return css
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
      path.push(`#${el.id}`)
    }
    else if (!el.nextElementSibling && !el.previousElementSibling) {
      path.push(tag)
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
        path.push(`${tag}:nth-child(${elementIndex})`)
      }
      else {
        path.push(tag)
      }
    }
    el = parent as Element
  };
  return `${getBrowserState().provider === 'webdriverio' && hasShadowRoot ? '>>>' : ''}${path.reverse().join(' > ')}`.toLowerCase()
}

function getParent(el: Element) {
  const parent = el.parentNode
  if (parent instanceof ShadowRoot) {
    return parent.host
  }
  return parent
}
