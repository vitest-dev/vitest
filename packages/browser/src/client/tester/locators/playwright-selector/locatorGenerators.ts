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

import { escapeWithQuotes, normalizeEscapedRegexQuotes } from './stringUtils'
import type { NestedSelectorBody, ParsedSelector } from './selectorParser'
import { parseAttributeSelector, parseSelector, stringifySelector } from './selectorParser'

export type Language = 'javascript'
export type LocatorType = 'default' | 'role' | 'text' | 'label' | 'placeholder' | 'alt' | 'title' | 'test-id' | 'nth' | 'first' | 'last' | 'has-text' | 'has-not-text' | 'has' | 'hasNot' | 'frame' | 'and' | 'or' | 'chain'
export type LocatorBase = 'page' | 'locator' | 'frame-locator'
export type Quote = '\'' | '"' | '`'

interface LocatorOptions {
  attrs?: { name: string; value: string | boolean | number }[]
  exact?: boolean
  name?: string | RegExp
  hasText?: string | RegExp
  hasNotText?: string | RegExp
}
export interface LocatorFactory {
  generateLocator: (base: LocatorBase, kind: LocatorType, body: string | RegExp, options?: LocatorOptions) => string
  chainLocators: (locators: string[]) => string
}

export function asLocator(lang: Language, selector: string, isFrameLocator: boolean = false): string {
  return asLocators(lang, selector, isFrameLocator)[0]
}

export function asLocators(lang: Language, selector: string, isFrameLocator: boolean = false, maxOutputSize = 20, preferredQuote?: Quote): string[] {
  try {
    // eslint-disable-next-line ts/no-use-before-define
    return innerAsLocators(new generators[lang](preferredQuote), parseSelector(selector), isFrameLocator, maxOutputSize)
  }
  catch (e) {
    // Tolerate invalid input.
    return [selector]
  }
}

function innerAsLocators(factory: LocatorFactory, parsed: ParsedSelector, isFrameLocator: boolean = false, maxOutputSize = 20): string[] {
  const parts = [...parsed.parts]
  // frameLocator('iframe').first is actually "iframe >> nth=0 >> internal:control=enter-frame"
  // To make it easier to parse, we turn it into "iframe >> internal:control=enter-frame >> nth=0"
  for (let index = 0; index < parts.length - 1; index++) {
    if (parts[index].name === 'nth' && parts[index + 1].name === 'internal:control' && (parts[index + 1].body as string) === 'enter-frame') {
      // Swap nth and enter-frame.
      const [nth] = parts.splice(index, 1)
      parts.splice(index + 1, 0, nth)
    }
  }

  const tokens: string[][] = []
  let nextBase: LocatorBase = isFrameLocator ? 'frame-locator' : 'page'
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index]
    const base = nextBase
    nextBase = 'locator'

    if (part.name === 'nth') {
      if (part.body === '0') {
        tokens.push([factory.generateLocator(base, 'first', ''), factory.generateLocator(base, 'nth', '0')])
      }
      else if (part.body === '-1') {
        tokens.push([factory.generateLocator(base, 'last', ''), factory.generateLocator(base, 'nth', '-1')])
      }
      else {
        tokens.push([factory.generateLocator(base, 'nth', part.body as string)])
      }
      continue
    }
    if (part.name === 'internal:text') {
      const { exact, text } = detectExact(part.body as string)
      tokens.push([factory.generateLocator(base, 'text', text, { exact })])
      continue
    }
    if (part.name === 'internal:has-text') {
      const { exact, text } = detectExact(part.body as string)
      // There is no locator equivalent for strict has-text, leave it as is.
      if (!exact) {
        tokens.push([factory.generateLocator(base, 'has-text', text, { exact })])
        continue
      }
    }
    if (part.name === 'internal:has-not-text') {
      const { exact, text } = detectExact(part.body as string)
      // There is no locator equivalent for strict has-not-text, leave it as is.
      if (!exact) {
        tokens.push([factory.generateLocator(base, 'has-not-text', text, { exact })])
        continue
      }
    }
    if (part.name === 'internal:has') {
      const inners = innerAsLocators(factory, (part.body as NestedSelectorBody).parsed, false, maxOutputSize)
      tokens.push(inners.map(inner => factory.generateLocator(base, 'has', inner)))
      continue
    }
    if (part.name === 'internal:has-not') {
      const inners = innerAsLocators(factory, (part.body as NestedSelectorBody).parsed, false, maxOutputSize)
      tokens.push(inners.map(inner => factory.generateLocator(base, 'hasNot', inner)))
      continue
    }
    if (part.name === 'internal:and') {
      const inners = innerAsLocators(factory, (part.body as NestedSelectorBody).parsed, false, maxOutputSize)
      tokens.push(inners.map(inner => factory.generateLocator(base, 'and', inner)))
      continue
    }
    if (part.name === 'internal:or') {
      const inners = innerAsLocators(factory, (part.body as NestedSelectorBody).parsed, false, maxOutputSize)
      tokens.push(inners.map(inner => factory.generateLocator(base, 'or', inner)))
      continue
    }
    if (part.name === 'internal:chain') {
      const inners = innerAsLocators(factory, (part.body as NestedSelectorBody).parsed, false, maxOutputSize)
      tokens.push(inners.map(inner => factory.generateLocator(base, 'chain', inner)))
      continue
    }
    if (part.name === 'internal:label') {
      const { exact, text } = detectExact(part.body as string)
      tokens.push([factory.generateLocator(base, 'label', text, { exact })])
      continue
    }
    if (part.name === 'internal:role') {
      const attrSelector = parseAttributeSelector(part.body as string, true)
      const options: LocatorOptions = { attrs: [] }
      for (const attr of attrSelector.attributes) {
        if (attr.name === 'name') {
          options.exact = attr.caseSensitive
          options.name = attr.value
        }
        else {
          if (attr.name === 'level' && typeof attr.value === 'string') {
            attr.value = +attr.value
          }
          options.attrs!.push({ name: attr.name === 'include-hidden' ? 'includeHidden' : attr.name, value: attr.value })
        }
      }
      tokens.push([factory.generateLocator(base, 'role', attrSelector.name, options)])
      continue
    }
    if (part.name === 'internal:testid') {
      const attrSelector = parseAttributeSelector(part.body as string, true)
      const { value } = attrSelector.attributes[0]
      tokens.push([factory.generateLocator(base, 'test-id', value)])
      continue
    }
    if (part.name === 'internal:attr') {
      const attrSelector = parseAttributeSelector(part.body as string, true)
      const { name, value, caseSensitive } = attrSelector.attributes[0]
      const text = value as string | RegExp
      const exact = !!caseSensitive
      if (name === 'placeholder') {
        tokens.push([factory.generateLocator(base, 'placeholder', text, { exact })])
        continue
      }
      if (name === 'alt') {
        tokens.push([factory.generateLocator(base, 'alt', text, { exact })])
        continue
      }
      if (name === 'title') {
        tokens.push([factory.generateLocator(base, 'title', text, { exact })])
        continue
      }
    }

    let locatorType: LocatorType = 'default'

    const nextPart = parts[index + 1]
    if (nextPart && nextPart.name === 'internal:control' && (nextPart.body as string) === 'enter-frame') {
      locatorType = 'frame'
      nextBase = 'frame-locator'
      index++
    }

    const selectorPart = stringifySelector({ parts: [part] })
    const locatorPart = factory.generateLocator(base, locatorType, selectorPart)

    if (locatorType === 'default' && nextPart && ['internal:has-text', 'internal:has-not-text'].includes(nextPart.name)) {
      const { exact, text } = detectExact(nextPart.body as string)
      // There is no locator equivalent for strict has-text and has-not-text, leave it as is.
      if (!exact) {
        const nextLocatorPart = factory.generateLocator('locator', nextPart.name === 'internal:has-text' ? 'has-text' : 'has-not-text', text, { exact })
        const options: LocatorOptions = {}
        if (nextPart.name === 'internal:has-text') {
          options.hasText = text
        }
        else { options.hasNotText = text }
        const combinedPart = factory.generateLocator(base, 'default', selectorPart, options)
        // Two options:
        // - locator('div').filter({ hasText: 'foo' })
        // - locator('div', { hasText: 'foo' })
        tokens.push([factory.chainLocators([locatorPart, nextLocatorPart]), combinedPart])
        index++
        continue
      }
    }

    // Selectors can be prefixed with engine name, e.g. xpath=//foo
    let locatorPartWithEngine: string | undefined
    if (['xpath', 'css'].includes(part.name)) {
      const selectorPart = stringifySelector({ parts: [part] }, /* forceEngineName */ true)
      locatorPartWithEngine = factory.generateLocator(base, locatorType, selectorPart)
    }

    tokens.push([locatorPart, locatorPartWithEngine].filter(Boolean) as string[])
  }

  return combineTokens(factory, tokens, maxOutputSize)
}

function combineTokens(factory: LocatorFactory, tokens: string[][], maxOutputSize: number): string[] {
  const currentTokens = tokens.map(() => '')
  const result: string[] = []

  const visit = (index: number) => {
    if (index === tokens.length) {
      result.push(factory.chainLocators(currentTokens))
      return currentTokens.length < maxOutputSize
    }
    for (const taken of tokens[index]) {
      currentTokens[index] = taken
      if (!visit(index + 1)) {
        return false
      }
    }
    return true
  }

  visit(0)
  return result
}

function detectExact(text: string): { exact?: boolean; text: string | RegExp } {
  let exact = false
  const match = text.match(/^\/(.*)\/([igm]*)$/)
  if (match) {
    return { text: new RegExp(match[1], match[2]) }
  }
  if (text.endsWith('"')) {
    text = JSON.parse(text)
    exact = true
  }
  else if (text.endsWith('"s')) {
    text = JSON.parse(text.substring(0, text.length - 1))
    exact = true
  }
  else if (text.endsWith('"i')) {
    text = JSON.parse(text.substring(0, text.length - 1))
    exact = false
  }
  return { exact, text }
}

export class JavaScriptLocatorFactory implements LocatorFactory {
  constructor(private preferredQuote?: Quote) {}

  generateLocator(base: LocatorBase, kind: LocatorType, body: string | RegExp, options: LocatorOptions = {}): string {
    switch (kind) {
      case 'default':
        if (options.hasText !== undefined) {
          return `locator(${this.quote(body as string)}, { hasText: ${this.toHasText(options.hasText)} })`
        }
        if (options.hasNotText !== undefined) {
          return `locator(${this.quote(body as string)}, { hasNotText: ${this.toHasText(options.hasNotText)} })`
        }
        return `locator(${this.quote(body as string)})`
      case 'frame':
        return `frameLocator(${this.quote(body as string)})`
      case 'nth':
        return `nth(${body})`
      case 'first':
        return `first()`
      case 'last':
        return `last()`
      case 'role': {
        const attrs: string[] = []
        if (isRegExp(options.name)) {
          attrs.push(`name: ${this.regexToSourceString(options.name)}`)
        }
        else if (typeof options.name === 'string') {
          attrs.push(`name: ${this.quote(options.name)}`)
          if (options.exact) {
            attrs.push(`exact: true`)
          }
        }
        for (const { name, value } of options.attrs!) {
          attrs.push(`${name}: ${typeof value === 'string' ? this.quote(value) : value}`)
        }
        const attrString = attrs.length ? `, { ${attrs.join(', ')} }` : ''
        return `getByRole(${this.quote(body as string)}${attrString})`
      }
      case 'has-text':
        return `filter({ hasText: ${this.toHasText(body)} })`
      case 'has-not-text':
        return `filter({ hasNotText: ${this.toHasText(body)} })`
      case 'has':
        return `filter({ has: ${body} })`
      case 'hasNot':
        return `filter({ hasNot: ${body} })`
      case 'and':
        return `and(${body})`
      case 'or':
        return `or(${body})`
      case 'chain':
        return `locator(${body})`
      case 'test-id':
        return `getByTestId(${this.toTestIdValue(body)})`
      case 'text':
        return this.toCallWithExact('getByText', body, !!options.exact)
      case 'alt':
        return this.toCallWithExact('getByAltText', body, !!options.exact)
      case 'placeholder':
        return this.toCallWithExact('getByPlaceholder', body, !!options.exact)
      case 'label':
        return this.toCallWithExact('getByLabel', body, !!options.exact)
      case 'title':
        return this.toCallWithExact('getByTitle', body, !!options.exact)
      default:
        throw new Error(`Unknown selector kind ${kind}`)
    }
  }

  chainLocators(locators: string[]): string {
    return locators.join('.')
  }

  private regexToSourceString(re: RegExp) {
    return normalizeEscapedRegexQuotes(String(re))
  }

  private toCallWithExact(method: string, body: string | RegExp, exact?: boolean) {
    if (isRegExp(body)) {
      return `${method}(${this.regexToSourceString(body)})`
    }
    return exact ? `${method}(${this.quote(body)}, { exact: true })` : `${method}(${this.quote(body)})`
  }

  private toHasText(body: string | RegExp) {
    if (isRegExp(body)) {
      return this.regexToSourceString(body)
    }
    return this.quote(body)
  }

  private toTestIdValue(value: string | RegExp): string {
    if (isRegExp(value)) {
      return this.regexToSourceString(value)
    }
    return this.quote(value)
  }

  private quote(text: string) {
    return escapeWithQuotes(text, this.preferredQuote ?? '\'')
  }
}

const generators: Record<Language, new (preferredQuote?: Quote) => LocatorFactory> = {
  javascript: JavaScriptLocatorFactory,
}

function isRegExp(obj: any): obj is RegExp {
  return obj instanceof RegExp
}
