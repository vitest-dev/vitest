import type { Locator, SelectorOptions, UserEventWheelDeltaOptions, UserEventWheelOptions } from 'vitest/browser'
import type { BrowserRPC } from '../client'
import { getBrowserState, getWorkerState } from '../utils'

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
    const { sessionId, traces } = getBrowserState()
    const filepath = state.filepath || state.current?.file?.filepath
    args = args.filter(arg => arg !== undefined) // remove optional fields
    if (this._listeners.length) {
      await Promise.all(this._listeners.map(listener => listener(command, args)))
    }
    return traces.$(
      'vitest.browser.tester.command',
      {
        attributes: {
          'vitest.browser.command': command,
          'code.file.path': filepath,
        },
      },
      () =>
        rpc.triggerCommand<T>(sessionId, command, filepath, args).catch((err) => {
          // rethrow an error to keep the stack trace in browser
          clientError.message = err.message
          clientError.name = err.name
          clientError.stack = clientError.stack?.replace(clientError.message, err.message)
          throw clientError
        }),
    )
  }
}

const now = Date.now

export function processTimeoutOptions<T extends { timeout?: number }>(options_: T | undefined): T | undefined {
  if (
    // if timeout is set, keep it
    (options_ && options_.timeout != null)
  ) {
    return options_
  }
  // if there is a default action timeout, use it
  if (getWorkerState().config.browser.providerOptions.actionTimeout != null) {
    return options_
  }
  const runner = getBrowserState().runner
  const startTime = runner._currentTaskStartTime
  // ignore timeout if this is called outside of a test
  if (!startTime) {
    return options_
  }
  const timeout = runner._currentTaskTimeout
  if (timeout === 0 || timeout == null || timeout === Number.POSITIVE_INFINITY) {
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
  const testerUi = window.parent.document.querySelector(`iframe[data-vitest]`)?.parentElement
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

function escapeRegexForSelector(re: RegExp): string {
  // Unicode mode does not allow "identity character escapes", so we do not escape and
  // hope that it does not contain quotes and/or >> signs.
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Character_escape
  // TODO: rework RE usages in internal selectors away from literal representation to json, e.g. {source,flags}.
  if (re.unicode || (re as any).unicodeSets) {
    return String(re)
  }
  // Even number of backslashes followed by the quote -> insert a backslash.
  return String(re).replace(/(^|[^\\])(\\\\)*(["'`])/g, '$1$2\\$3').replace(/>>/g, '\\>\\>')
}

export function escapeForTextSelector(text: string | RegExp, exact: boolean): string {
  if (typeof text !== 'string') {
    return escapeRegexForSelector(text)
  }
  return `${JSON.stringify(text)}${exact ? 's' : 'i'}`
}

const provider = getBrowserState().provider
const kElementLocator = Symbol.for('$$vitest:locator-resolved')

export async function convertToSelector(elementOrLocator: Element | Locator, options?: SelectorOptions): Promise<string> {
  if (!elementOrLocator) {
    throw new Error('Expected element or locator to be defined.')
  }
  if (elementOrLocator instanceof Element) {
    return convertElementToCssSelector(elementOrLocator)
  }
  if (isLocator(elementOrLocator)) {
    if (provider === 'playwright' || kElementLocator in elementOrLocator) {
      return elementOrLocator.selector
    }
    const element = await elementOrLocator.findElement(options)
    return convertElementToCssSelector(element)
  }
  throw new Error('Expected element or locator to be an instance of Element or Locator.')
}

const kLocator = Symbol.for('$$vitest:locator')

export function isLocator(element: unknown): element is Locator {
  return (!!element && typeof element === 'object' && kLocator in element)
}

const DEFAULT_WHEEL_DELTA = 100

export function resolveUserEventWheelOptions(options: UserEventWheelOptions): UserEventWheelDeltaOptions {
  let delta: UserEventWheelDeltaOptions['delta']

  if (options.delta) {
    delta = options.delta
  }
  else {
    switch (options.direction) {
      case 'up': {
        delta = { y: -DEFAULT_WHEEL_DELTA }
        break
      }

      case 'down': {
        delta = { y: DEFAULT_WHEEL_DELTA }
        break
      }

      case 'left': {
        delta = { x: -DEFAULT_WHEEL_DELTA }
        break
      }

      case 'right': {
        delta = { x: DEFAULT_WHEEL_DELTA }
        break
      }
    }
  }

  return {
    delta,
    times: options.times,
  }
}
