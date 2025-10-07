import type { ExpectationResult, MatcherState } from '@vitest/expect'
import type { Locator } from '../locators'
import { server } from 'vitest/browser'
import { getElementFromUserInput } from './utils'

const browser = server.config.browser.name

// these values should keep the `style` attribute instead of computing px to be consistent with jsdom
// https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_cascade/used_value#difference_from_computed_value
const usedValuesProps = new Set([
  'backgroundPosition',
  'background-position',
  'bottom',
  'left',
  'right',
  'top',
  'height',
  'width',
  'margin-bottom',
  'marginBottom',
  'margin-left',
  'marginLeft',
  'margin-right',
  'marginRight',
  'margin-top',
  'marginTop',
  'min-height',
  'minHeight',
  'min-width',
  'minWidth',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-indent',
  'paddingBottom',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'textIndent',
])

export default function toHaveStyle(
  this: MatcherState,
  actual: Element | Locator,
  css: string | Record<string, unknown>,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toHaveStyle, this)
  const { getComputedStyle } = htmlElement.ownerDocument.defaultView!

  const expected = typeof css === 'object'
    ? getStyleFromObjectCSS(css)
    : computeCSSStyleDeclaration(css)
  const received = getComputedStyle(htmlElement)
  const receivedCustomKeys = new Set(Array.from(htmlElement.style))

  return {
    pass: isSubset(expected, htmlElement, received, receivedCustomKeys),
    message: () => {
      const matcher = `${this.isNot ? '.not' : ''}.toHaveStyle`
      const expectedKeys = new Set(Object.keys(expected))
      const receivedObject = Array.from(received)
        .filter(prop => expectedKeys.has(prop))
        .reduce(
          (obj, prop) => {
            const styleSheet = receivedCustomKeys.has(prop) && usedValuesProps.has(prop)
              ? htmlElement.style
              : received
            obj[prop] = styleSheet[prop as 'color']
            return obj
          },
          {} as Record<string, unknown>,
        )
      const receivedString = printoutObjectStyles(receivedObject)
      const diff = receivedString === ''
        ? 'Expected styles could not be parsed by the browser. Did you make a typo?'
        : this.utils.diff(
            printoutObjectStyles(expected),
            receivedString,
          )
      return [
        this.utils.matcherHint(matcher, 'element', ''),
        diff,
      ].join('\n\n')
    },
  }
}

function getStyleFromObjectCSS(css: Record<string, unknown>): Record<string, unknown> {
  const doc = browser === 'chrome' || browser === 'chromium'
    ? document
    : document.implementation.createHTMLDocument('')

  const copy = doc.createElement('div')
  doc.body.appendChild(copy)
  const keys = Object.keys(css)

  keys.forEach((property) => {
    copy.style[property as 'color'] = css[property] as string
  })

  const styles: Record<string, unknown> = {}
  // to get normalized colors (blue -> rgb(0, 0, 255))
  const computedStyles = window.getComputedStyle(copy)
  keys.forEach((property) => {
    const styleSheet = usedValuesProps.has(property) ? copy.style : computedStyles
    const value = styleSheet[property as 'color']
    // ignore invalid keys
    if (value != null) {
      styles[property] = value
    }
  })
  copy.remove()

  return styles
}

function computeCSSStyleDeclaration(css: string): Record<string, unknown> {
  // on chromium for styles to be computed, they need to be inserted into the actual document
  // webkit will also not compute _some_ style like transform if it's not in the document
  const doc = browser === 'chrome' || browser === 'chromium' || browser === 'webkit'
    ? document
    : document.implementation.createHTMLDocument('')

  const rootElement = doc.createElement('div')
  rootElement.setAttribute('style', css.replace(/\n/g, ''))
  doc.body.appendChild(rootElement)

  const computedStyle = window.getComputedStyle(rootElement)

  const styleDeclaration = Array.from(rootElement.style).reduce((acc, prop) => {
    acc[prop] = usedValuesProps.has(prop)
      ? rootElement.style.getPropertyValue(prop)
      : computedStyle.getPropertyValue(prop)
    return acc
  }, {} as Record<string, unknown>)
  rootElement.remove()
  return styleDeclaration
}

function printoutObjectStyles(styles: Record<string, unknown>): string {
  return Object.keys(styles)
    .sort()
    .map(prop => `${prop}: ${styles[prop]};`)
    .join('\n')
}

function isSubset(
  styles: Record<string, unknown>,
  element: HTMLElement | SVGElement,
  computedStyle: CSSStyleDeclaration,
  receivedCustomKeys: Set<string>,
): boolean {
  const keys = Object.keys(styles)
  if (!keys.length) {
    return false
  }
  return keys.every((prop) => {
    const value = styles[prop as 'color']
    const isCustomProperty = prop.startsWith('--')
    const spellingVariants = [prop]
    if (!isCustomProperty) {
      spellingVariants.push(prop.toLowerCase())
    }

    const pass = spellingVariants.some(
      (name) => {
        const styleSheet = receivedCustomKeys.has(prop) && usedValuesProps.has(prop)
          ? element.style
          : computedStyle
        return styleSheet[name as 'color'] === value
          || styleSheet.getPropertyValue(name) === value
      },
    )
    return pass
  },
  )
}
