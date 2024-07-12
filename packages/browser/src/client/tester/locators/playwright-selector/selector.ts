/* eslint-disable ts/no-use-before-define */
/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// based on https://github.com/microsoft/playwright/blob/4554372e456154d7365b6902ef9f3e1e7de76e94/packages/playwright-core/src/server/injected/injectedScript.ts

import { server } from '@vitest/browser/context'
import { createRoleEngine } from './roleSelectorEngine'
import type { NestedSelectorBody, ParsedSelector, ParsedSelectorPart } from './selectorParser'
import { parseAttributeSelector, parseSelector, stringifySelector, visitAllSelectorParts } from './selectorParser'
import { asLocator } from './locatorGenerators'
import type { GenerateSelectorOptions } from './selectorGenerator'
import { generateSelector } from './selectorGenerator'
import { normalizeWhiteSpace, trimStringWithEllipsis } from './stringUtils'
import type { LayoutSelectorName } from './layoutSelectorUtils'
import { kLayoutSelectorNames, layoutSelectorScore } from './layoutSelectorUtils'
import { SelectorEvaluatorImpl, sortInDOMOrder } from './selectorEvaluator'
import type { ElementText, TextMatcher } from './selectorUtils'
import { elementMatchesText, elementText, getElementLabels } from './selectorUtils'
import type { CSSComplexSelectorList } from './cssParser'
import { isElementVisible } from './domUtils'

export class PlaywrightSelector {
  _engines: Map<string, SelectorEngine>
  _evaluator: SelectorEvaluatorImpl

  constructor() {
    this._evaluator = new SelectorEvaluatorImpl(new Map())
    this._engines = new Map()
    // this._engines.set('xpath', XPathEngine)
    // this._engines.set('xpath:light', XPathEngine)
    this._engines.set('role', createRoleEngine(false))
    this._engines.set('text', this._createTextEngine(true, false))
    this._engines.set('text:light', this._createTextEngine(false, false))
    this._engines.set('id', this._createAttributeEngine('id', true))
    this._engines.set('id:light', this._createAttributeEngine('id', false))
    this._engines.set('data-testid', this._createAttributeEngine('data-testid', true))
    this._engines.set('data-testid:light', this._createAttributeEngine('data-testid', false))
    this._engines.set('data-test-id', this._createAttributeEngine('data-test-id', true))
    this._engines.set('data-test-id:light', this._createAttributeEngine('data-test-id', false))
    this._engines.set('data-test', this._createAttributeEngine('data-test', true))
    this._engines.set('data-test:light', this._createAttributeEngine('data-test', false))
    this._engines.set('css', this._createCSSEngine())
    this._engines.set('nth', { queryAll: () => [] })
    this._engines.set('visible', this._createVisibleEngine())
    this._engines.set('internal:control', { queryAll: () => [] })
    this._engines.set('internal:has', this._createHasEngine())
    this._engines.set('internal:has-not', this._createHasNotEngine())
    this._engines.set('internal:and', { queryAll: () => [] })
    this._engines.set('internal:or', { queryAll: () => [] })
    this._engines.set('internal:chain', this._createInternalChainEngine())
    this._engines.set('internal:label', this._createInternalLabelEngine())
    this._engines.set('internal:text', this._createTextEngine(true, true))
    this._engines.set('internal:has-text', this._createInternalHasTextEngine())
    this._engines.set('internal:has-not-text', this._createInternalHasNotTextEngine())
    this._engines.set('internal:attr', this._createNamedAttributeEngine())
    this._engines.set('internal:testid', this._createNamedAttributeEngine())
    this._engines.set('internal:role', createRoleEngine(true))
  }

  querySelector(selector: ParsedSelector, root: Node, strict: boolean): Element | null {
    const result = this.querySelectorAll(selector, root)
    if (strict && result.length > 1) {
      throw this.strictModeViolationError(selector, result)
    }
    return result[0] || null
  }

  strictModeViolationError(selector: ParsedSelector, matches: Element[]): Error {
    const infos = matches.slice(0, 10).map(m => ({
      preview: this.previewNode(m),
      selector: this.generateSelectorSimple(m),
    }))
    const lines = infos.map((info, i) => `\n    ${i + 1}) ${info.preview} aka ${asLocator('javascript', info.selector)}`)
    if (infos.length < matches.length) {
      lines.push('\n    ...')
    }
    return this.createStacklessError(`strict mode violation: ${asLocator('javascript', stringifySelector(selector))} resolved to ${matches.length} elements:${lines.join('')}\n`)
  }

  generateSelectorSimple(targetElement: Element, options?: GenerateSelectorOptions): string {
    return generateSelector(this, targetElement, { ...options, testIdAttributeName: 'data-testid' })
  }

  parseSelector(selector: string): ParsedSelector {
    const result = parseSelector(selector)
    visitAllSelectorParts(result, (part) => {
      if (!this._engines.has(part.name)) {
        throw this.createStacklessError(`Unknown engine "${part.name}" while parsing selector ${selector}`)
      }
    })
    return result
  }

  previewNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return oneLine(`#text=${node.nodeValue || ''}`)
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return oneLine(`<${node.nodeName.toLowerCase()} />`)
    }
    const element = node as Element

    const attrs = []
    for (let i = 0; i < element.attributes.length; i++) {
      const { name, value } = element.attributes[i]
      if (name === 'style') {
        continue
      }
      if (!value && booleanAttributes.has(name)) {
        attrs.push(` ${name}`)
      }
      else { attrs.push(` ${name}="${value}"`) }
    }
    attrs.sort((a, b) => a.length - b.length)
    const attrText = trimStringWithEllipsis(attrs.join(''), 500)
    if (autoClosingTags.has(element.nodeName)) {
      return oneLine(`<${element.nodeName.toLowerCase()}${attrText}/>`)
    }

    const children = element.childNodes
    let onlyText = false
    if (children.length <= 5) {
      onlyText = true
      for (let i = 0; i < children.length; i++) {
        onlyText = onlyText && children[i].nodeType === Node.TEXT_NODE
      }
    }
    const text = onlyText ? (element.textContent || '') : (children.length ? '\u2026' : '')
    return oneLine(`<${element.nodeName.toLowerCase()}${attrText}>${trimStringWithEllipsis(text, 50)}</${element.nodeName.toLowerCase()}>`)
  }

  querySelectorAll(selector: ParsedSelector, root: Node): Element[] {
    if (selector.capture !== undefined) {
      if (selector.parts.some(part => part.name === 'nth')) {
        throw this.createStacklessError(`Can't query n-th element in a request with the capture.`)
      }
      const withHas: ParsedSelector = { parts: selector.parts.slice(0, selector.capture + 1) }
      if (selector.capture < selector.parts.length - 1) {
        const parsed: ParsedSelector = { parts: selector.parts.slice(selector.capture + 1) }
        const has: ParsedSelectorPart = { name: 'internal:has', body: { parsed }, source: stringifySelector(parsed) }
        withHas.parts.push(has)
      }
      return this.querySelectorAll(withHas, root)
    }

    if (!(root as any).querySelectorAll) {
      throw this.createStacklessError('Node is not queryable.')
    }

    if (selector.capture !== undefined) {
      // We should have handled the capture above.
      throw this.createStacklessError('Internal error: there should not be a capture in the selector.')
    }

    // Workaround so that ":scope" matches the ShadowRoot.
    // This is, unfortunately, because an ElementHandle can point to any Node (including ShadowRoot/Document/etc),
    // and not just to an Element, and we support various APIs on ElementHandle like "textContent()".
    if (root.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ && selector.parts.length === 1 && selector.parts[0].name === 'css' && selector.parts[0].source === ':scope') {
      return [root as Element]
    }

    this._evaluator.begin()
    try {
      let roots = new Set<Element>([root as Element])
      for (const part of selector.parts) {
        if (part.name === 'nth') {
          roots = this._queryNth(roots, part)
        }
        else if (part.name === 'internal:and') {
          const andElements = this.querySelectorAll((part.body as NestedSelectorBody).parsed, root)
          roots = new Set(andElements.filter(e => roots.has(e)))
        }
        else if (part.name === 'internal:or') {
          const orElements = this.querySelectorAll((part.body as NestedSelectorBody).parsed, root)
          roots = new Set(sortInDOMOrder(new Set([...roots, ...orElements])))
        }
        else if (kLayoutSelectorNames.includes(part.name as LayoutSelectorName)) {
          roots = this._queryLayoutSelector(roots, part, root)
        }
        else {
          const next = new Set<Element>()
          for (const root of roots) {
            const all = this._queryEngineAll(part, root)
            for (const one of all) {
              next.add(one)
            }
          }
          roots = next
        }
      }
      return [...roots]
    }
    finally {
      this._evaluator.end()
    }
  }

  private _queryEngineAll(part: ParsedSelectorPart, root: SelectorRoot): Element[] {
    const result = this._engines.get(part.name)!.queryAll(root, part.body)
    for (const element of result) {
      if (!('nodeName' in element)) {
        throw this.createStacklessError(`Expected a Node but got ${Object.prototype.toString.call(element)}`)
      }
    }
    return result
  }

  private _queryNth(elements: Set<Element>, part: ParsedSelectorPart): Set<Element> {
    const list = [...elements]
    let nth = +part.body
    if (nth === -1) {
      nth = list.length - 1
    }
    return new Set<Element>(list.slice(nth, nth + 1))
  }

  private _queryLayoutSelector(elements: Set<Element>, part: ParsedSelectorPart, originalRoot: Node): Set<Element> {
    const name = part.name as LayoutSelectorName
    const body = part.body as NestedSelectorBody
    const result: { element: Element; score: number }[] = []
    const inner = this.querySelectorAll(body.parsed, originalRoot)
    for (const element of elements) {
      const score = layoutSelectorScore(name, element, inner, body.distance)
      if (score !== undefined) {
        result.push({ element, score })
      }
    }
    result.sort((a, b) => a.score - b.score)
    return new Set<Element>(result.map(r => r.element))
  }

  createStacklessError(message: string): Error {
    if (server.browser === 'firefox') {
      const error = new Error(`Error: ${message}`)
      // Firefox cannot delete the stack, so assign to an empty string.
      error.stack = ''
      return error
    }
    const error = new Error(message)
    // Chromium/WebKit should delete the stack instead.
    delete error.stack
    return error
  }

  private _createTextEngine(shadow: boolean, internal: boolean): SelectorEngine {
    const queryAll = (root: SelectorRoot, selector: string): Element[] => {
      const { matcher, kind } = createTextMatcher(selector, internal)
      const result: Element[] = []
      let lastDidNotMatchSelf: Element | null = null

      const appendElement = (element: Element) => {
        // TODO: replace contains() with something shadow-dom-aware?
        if (kind === 'lax' && lastDidNotMatchSelf && lastDidNotMatchSelf.contains(element)) {
          return false
        }
        const matches = elementMatchesText(this._evaluator._cacheText, element, matcher)
        if (matches === 'none') {
          lastDidNotMatchSelf = element
        }
        if (matches === 'self' || (matches === 'selfAndChildren' && kind === 'strict' && !internal)) {
          result.push(element)
        }
      }

      if (root.nodeType === Node.ELEMENT_NODE) {
        appendElement(root as Element)
      }
      const elements = this._evaluator._queryCSS({ scope: root as Document | Element, pierceShadow: shadow }, '*')
      for (const element of elements) {
        appendElement(element)
      }
      return result
    }
    return { queryAll }
  }

  private _createAttributeEngine(attribute: string, shadow: boolean): SelectorEngine {
    const toCSS = (selector: string): CSSComplexSelectorList => {
      const css = `[${attribute}=${JSON.stringify(selector)}]`
      return [{ simples: [{ selector: { css, functions: [] }, combinator: '' }] }]
    }
    return {
      queryAll: (root: SelectorRoot, selector: string): Element[] => {
        return this._evaluator.query({ scope: root as Document | Element, pierceShadow: shadow }, toCSS(selector))
      },
    }
  }

  private _createCSSEngine(): SelectorEngine {
    return {
      queryAll: (root: SelectorRoot, body: any) => {
        return this._evaluator.query({ scope: root as Document | Element, pierceShadow: true }, body)
      },
    }
  }

  private _createNamedAttributeEngine(): SelectorEngine {
    const queryAll = (root: SelectorRoot, selector: string): Element[] => {
      const parsed = parseAttributeSelector(selector, true)
      if (parsed.name || parsed.attributes.length !== 1) {
        throw new Error(`Malformed attribute selector: ${selector}`)
      }
      const { name, value, caseSensitive } = parsed.attributes[0]
      const lowerCaseValue = caseSensitive ? null : value.toLowerCase()
      let matcher: (s: string) => boolean
      if (value instanceof RegExp) {
        matcher = s => !!s.match(value)
      }
      else if (caseSensitive) {
        matcher = s => s === value
      }
      else {
        matcher = s => s.toLowerCase().includes(lowerCaseValue!)
      }
      const elements = this._evaluator._queryCSS({ scope: root as Document | Element, pierceShadow: true }, `[${name}]`)
      return elements.filter(e => matcher(e.getAttribute(name)!))
    }
    return { queryAll }
  }

  private _createVisibleEngine(): SelectorEngine {
    const queryAll = (root: SelectorRoot, body: string) => {
      if (root.nodeType !== 1 /* Node.ELEMENT_NODE */) {
        return []
      }
      return isElementVisible(root as Element) === Boolean(body) ? [root as Element] : []
    }
    return { queryAll }
  }

  private _createHasEngine(): SelectorEngine {
    const queryAll = (root: SelectorRoot, body: NestedSelectorBody) => {
      if (root.nodeType !== 1 /* Node.ELEMENT_NODE */) {
        return []
      }
      const has = !!this.querySelector(body.parsed, root, false)
      return has ? [root as Element] : []
    }
    return { queryAll }
  }

  private _createHasNotEngine(): SelectorEngine {
    const queryAll = (root: SelectorRoot, body: NestedSelectorBody) => {
      if (root.nodeType !== 1 /* Node.ELEMENT_NODE */) {
        return []
      }
      const has = !!this.querySelector(body.parsed, root, false)
      return has ? [] : [root as Element]
    }
    return { queryAll }
  }

  private _createInternalChainEngine(): SelectorEngine {
    const queryAll = (root: SelectorRoot, body: NestedSelectorBody) => {
      return this.querySelectorAll(body.parsed, root)
    }
    return { queryAll }
  }

  private _createInternalLabelEngine(): SelectorEngine {
    return {
      queryAll: (root: SelectorRoot, selector: string): Element[] => {
        const { matcher } = createTextMatcher(selector, true)
        const allElements = this._evaluator._queryCSS({ scope: root as Document | Element, pierceShadow: true }, '*')
        return allElements.filter((element) => {
          return getElementLabels(this._evaluator._cacheText, element).some(label => matcher(label))
        })
      },
    }
  }

  private _createInternalHasTextEngine(): SelectorEngine {
    return {
      queryAll: (root: SelectorRoot, selector: string): Element[] => {
        if (root.nodeType !== 1 /* Node.ELEMENT_NODE */) {
          return []
        }
        const element = root as Element
        const text = elementText(this._evaluator._cacheText, element)
        const { matcher } = createTextMatcher(selector, true)
        return matcher(text) ? [element] : []
      },
    }
  }

  private _createInternalHasNotTextEngine(): SelectorEngine {
    return {
      queryAll: (root: SelectorRoot, selector: string): Element[] => {
        if (root.nodeType !== 1 /* Node.ELEMENT_NODE */) {
          return []
        }
        const element = root as Element
        const text = elementText(this._evaluator._cacheText, element)
        const { matcher } = createTextMatcher(selector, true)
        return matcher(text) ? [] : [element]
      },
    }
  }
}

export type SelectorRoot = Element | ShadowRoot | Document

export interface SelectorEngine {
  queryAll: (root: SelectorRoot, selector: string | any) => Element[]
}

function oneLine(s: string): string {
  return s.replace(/\n/g, '↵').replace(/\t/g, '⇆')
}

const booleanAttributes = new Set(['checked', 'selected', 'disabled', 'readonly', 'multiple'])
const autoClosingTags = new Set(['AREA', 'BASE', 'BR', 'COL', 'COMMAND', 'EMBED', 'HR', 'IMG', 'INPUT', 'KEYGEN', 'LINK', 'MENUITEM', 'META', 'PARAM', 'SOURCE', 'TRACK', 'WBR'])

function cssUnquote(s: string): string {
  // Trim quotes.
  s = s.substring(1, s.length - 1)
  if (!s.includes('\\')) {
    return s
  }
  const r: string[] = []
  let i = 0
  while (i < s.length) {
    if (s[i] === '\\' && i + 1 < s.length) {
      i++
    }
    r.push(s[i++])
  }
  return r.join('')
}

function createTextMatcher(selector: string, internal: boolean): { matcher: TextMatcher; kind: 'regex' | 'strict' | 'lax' } {
  if (selector[0] === '/' && selector.lastIndexOf('/') > 0) {
    const lastSlash = selector.lastIndexOf('/')
    const re = new RegExp(selector.substring(1, lastSlash), selector.substring(lastSlash + 1))
    return { matcher: (elementText: ElementText) => re.test(elementText.full), kind: 'regex' }
  }
  const unquote = internal ? JSON.parse.bind(JSON) : cssUnquote
  let strict = false
  if (selector.length > 1 && selector[0] === '"' && selector[selector.length - 1] === '"') {
    selector = unquote(selector)
    strict = true
  }
  else if (internal && selector.length > 1 && selector[0] === '"' && selector[selector.length - 2] === '"' && selector[selector.length - 1] === 'i') {
    selector = unquote(selector.substring(0, selector.length - 1))
    strict = false
  }
  else if (internal && selector.length > 1 && selector[0] === '"' && selector[selector.length - 2] === '"' && selector[selector.length - 1] === 's') {
    selector = unquote(selector.substring(0, selector.length - 1))
    strict = true
  }
  else if (selector.length > 1 && selector[0] === '\'' && selector[selector.length - 1] === '\'') {
    selector = unquote(selector)
    strict = true
  }
  selector = normalizeWhiteSpace(selector)
  if (strict) {
    if (internal) {
      return { kind: 'strict', matcher: (elementText: ElementText) => elementText.normalized === selector }
    }

    const strictTextNodeMatcher = (elementText: ElementText) => {
      if (!selector && !elementText.immediate.length) {
        return true
      }
      return elementText.immediate.some(s => normalizeWhiteSpace(s) === selector)
    }
    return { matcher: strictTextNodeMatcher, kind: 'strict' }
  }
  selector = selector.toLowerCase()
  return { kind: 'lax', matcher: (elementText: ElementText) => elementText.normalized.toLowerCase().includes(selector) }
}
