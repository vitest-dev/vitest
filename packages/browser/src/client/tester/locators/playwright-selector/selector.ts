import { createRoleEngine } from './roleSelectorEngine'
import { elementMatchesText } from './selectorUtils'

export class PlaywrightSelector {
  private _engines: Map<string, SelectorEngine>

  constructor() {
    this._engines = new Map()
    // this._engines.set('xpath', XPathEngine)
    // this._engines.set('xpath:light', XPathEngine)
    this._engines.set('role', createRoleEngine(false))
    // this._engines.set('text', this._createTextEngine(true, false))
    // this._engines.set('text:light', this._createTextEngine(false, false))
    // this._engines.set('id', this._createAttributeEngine('id', true))
    // this._engines.set('id:light', this._createAttributeEngine('id', false))
    // this._engines.set('data-testid', this._createAttributeEngine('data-testid', true))
    // this._engines.set('data-testid:light', this._createAttributeEngine('data-testid', false))
    // this._engines.set('data-test-id', this._createAttributeEngine('data-test-id', true))
    // this._engines.set('data-test-id:light', this._createAttributeEngine('data-test-id', false))
    // this._engines.set('data-test', this._createAttributeEngine('data-test', true))
    // this._engines.set('data-test:light', this._createAttributeEngine('data-test', false))
    // this._engines.set('css', this._createCSSEngine())
    // this._engines.set('nth', { queryAll: () => [] })
    // this._engines.set('visible', this._createVisibleEngine())
    // this._engines.set('internal:control', this._createControlEngine())
    // this._engines.set('internal:has', this._createHasEngine())
    // this._engines.set('internal:has-not', this._createHasNotEngine())
    // this._engines.set('internal:and', { queryAll: () => [] })
    // this._engines.set('internal:or', { queryAll: () => [] })
    // this._engines.set('internal:chain', this._createInternalChainEngine())
    // this._engines.set('internal:label', this._createInternalLabelEngine())
    // this._engines.set('internal:text', this._createTextEngine(true, true))
    // this._engines.set('internal:has-text', this._createInternalHasTextEngine())
    // this._engines.set('internal:has-not-text', this._createInternalHasNotTextEngine())
    // this._engines.set('internal:attr', this._createNamedAttributeEngine())
    // this._engines.set('internal:testid', this._createNamedAttributeEngine())
    this._engines.set('internal:role', createRoleEngine(true))
  }

  private _createTextEngine(shadow: boolean, internal: boolean): SelectorEngine {
  //   const queryAll = (root: SelectorRoot, selector: string): Element[] => {
  //     const { matcher, kind } = createTextMatcher(selector, internal)
  //     const result: Element[] = []
  //     let lastDidNotMatchSelf: Element | null = null

  //     const appendElement = (element: Element) => {
  //       // TODO: replace contains() with something shadow-dom-aware?
  //       if (kind === 'lax' && lastDidNotMatchSelf && lastDidNotMatchSelf.contains(element)) { return false }
  //       const matches = elementMatchesText(this._evaluator._cacheText, element, matcher)
  //       if (matches === 'none') {
  //         lastDidNotMatchSelf = element
  //       }
  //       if (matches === 'self' || (matches === 'selfAndChildren' && kind === 'strict' && !internal)) {
  //         result.push(element)
  //       }
  //     }

  //     if (root.nodeType === Node.ELEMENT_NODE) {
  //       appendElement(root as Element)
  //     }
  //     const elements = this._evaluator._queryCSS({ scope: root as Document | Element, pierceShadow: shadow }, '*')
  //     for (const element of elements) {
  //       appendElement(element)
  //     }
  //     return result
  //   }
  //   return { queryAll }
  // }
}

export type SelectorRoot = Element | ShadowRoot | Document

export interface SelectorEngine {
  queryAll: (root: SelectorRoot, selector: string | any) => Element[]
}
