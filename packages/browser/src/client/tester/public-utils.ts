import { type Locator, type LocatorSelectors, page } from '@vitest/browser/context'
import { asLocator } from 'ivya'
import { stringify, type StringifyOptions } from 'vitest/utils'

export function getElementLocatorSelectors(element: Element): LocatorSelectors {
  const locator = page.elementLocator(element)
  return {
    getByAltText: (altText, options) => locator.getByAltText(altText, options),
    getByLabelText: (labelText, options) => locator.getByLabelText(labelText, options),
    getByPlaceholder: (placeholderText, options) => locator.getByPlaceholder(placeholderText, options),
    getByRole: (role, options) => locator.getByRole(role, options),
    getByTestId: testId => locator.getByTestId(testId),
    getByText: (text, options) => locator.getByText(text, options),
    getByTitle: (title, options) => locator.getByTitle(title, options),
  }
}

type PrettyDOMOptions = Omit<StringifyOptions, 'maxLength'>

export function debug(
  el?: Element | Locator | null | (Element | Locator)[],
  maxLength?: number,
  options?: PrettyDOMOptions,
): void {
  if (Array.isArray(el)) {
    // eslint-disable-next-line no-console
    el.forEach(e => console.log(prettyDOM(e, maxLength, options)))
  }
  else {
    // eslint-disable-next-line no-console
    console.log(prettyDOM(el, maxLength, options))
  }
}

export function prettyDOM(
  dom?: Element | Locator | undefined | null,
  maxLength: number = Number(import.meta.env.DEBUG_PRINT_LIMIT ?? 7000),
  prettyFormatOptions: PrettyDOMOptions = {},
): string {
  if (maxLength === 0) {
    return ''
  }

  if (!dom) {
    dom = document.body
  }

  if ('element' in dom && 'all' in dom) {
    dom = dom.element()
  }

  const type = typeof dom
  if (type !== 'object' || !dom.outerHTML) {
    const typeName = type === 'object' ? dom.constructor.name : type
    throw new TypeError(`Expecting a valid DOM element, but got ${typeName}.`)
  }

  const pretty = stringify(dom, Number.POSITIVE_INFINITY, {
    maxLength,
    highlight: true,
    ...prettyFormatOptions,
  })
  return dom.outerHTML.length > maxLength
    ? `${pretty.slice(0, maxLength)}...`
    : pretty
}

export function getElementError(selector: string, container: Element): Error {
  const error = new Error(`Cannot find element with locator: ${asLocator('javascript', selector)}\n\n${prettyDOM(container)}`)
  error.name = 'VitestBrowserElementError'
  return error
}
