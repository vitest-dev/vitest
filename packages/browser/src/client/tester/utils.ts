import type { BrowserRPC } from '../client'
import { getBrowserState, getWorkerState } from '../utils'

const provider = getBrowserState().provider

/* @__NO_SIDE_EFFECTS__ */
export function convertElementToCssSelector(element: Element): string {
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

export class CommandsManager {
  private _listeners: ((command: string, args: any[]) => void)[] = []

  public onCommand(listener: (command: string, args: any[]) => void): void {
    this._listeners.push(listener)
  }

  public async triggerCommand<T>(
    command: string,
    args: any[],
    // error makes sure the stack trace is correct on webkit,
    // if we make the error here, it looses the context
    clientError: Error = new Error('empty'),
  ): Promise<T> {
    const state = getWorkerState()
    const rpc = state.rpc as any as BrowserRPC
    const { sessionId } = getBrowserState()
    const filepath = state.filepath || state.current?.file?.filepath
    args = args.filter(arg => arg !== undefined) // remove optional fields
    if (this._listeners.length) {
      await Promise.all(this._listeners.map(listener => listener(command, args)))
    }
    return rpc.triggerCommand<T>(sessionId, command, filepath, args).catch((err) => {
      // rethrow an error to keep the stack trace in browser
      // const clientError = new Error(err.message)
      clientError.message = err.message
      clientError.name = err.name
      clientError.stack = clientError.stack?.replace(clientError.message, err.message)
      throw clientError
    })
  }
}

const now = Date.now

export function processTimeoutOptions<T extends { timeout?: number }>(options_?: T): T | undefined {
  if (
    // if timeout is set, keep it
    (options_ && options_.timeout != null)
    // timeout can only be set for playwright commands
    || provider !== 'playwright'
  ) {
    return options_
  }
  // if there is a default action timeout, use it
  if (getWorkerState().config.browser.providerOptions.actionTimeout != null) {
    return options_
  }
  const currentTest = getWorkerState().current
  const startTime = currentTest?.result?.startTime
  // ignore timeout if this is called outside of a test
  if (!currentTest || currentTest.type === 'suite' || !startTime) {
    return options_
  }
  const timeout = currentTest.timeout
  if (timeout === 0 || timeout === Number.POSITIVE_INFINITY) {
    return options_
  }
  options_ = options_ || {} as T
  const currentTime = now()
  const endTime = startTime + timeout
  const remainingTime = endTime - currentTime
  if (remainingTime <= 0) {
    return options_
  }
  // give us some time to process the timeout
  options_.timeout = remainingTime - 100
  return options_
}

export function getIframeScale(): number {
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
