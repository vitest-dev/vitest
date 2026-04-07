/**
 * The MIT License (MIT)
 * Copyright (c) 2017 Kent C. Dodds
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 */

import type { MatcherState } from '@vitest/expect'
import { Locator } from '../locators'

export function queryElementFromUserInput(
  elementOrLocator: Element | Locator | null,
  // TODO: minifier doesn't keep names, so we need to update this
  matcherFn: (...args: any) => any,
  context: MatcherState,
): HTMLElement | SVGElement | null {
  if (elementOrLocator instanceof Locator) {
    elementOrLocator = elementOrLocator.query()
  }

  if (elementOrLocator == null) {
    return null
  }

  return getElementFromUserInput(elementOrLocator, matcherFn, context)
}

export function getElementFromUserInput(
  elementOrLocator: Element | Locator | null,
  // TODO: minifier doesn't keep names, so we need to update this
  matcherFn: (...args: any) => any,
  context: MatcherState,
): HTMLElement | SVGElement {
  if (elementOrLocator instanceof Locator) {
    elementOrLocator = elementOrLocator.element()
  }

  const defaultView = elementOrLocator?.ownerDocument?.defaultView || window

  if (
    elementOrLocator instanceof defaultView.HTMLElement
    || elementOrLocator instanceof defaultView.SVGElement
  ) {
    return elementOrLocator
  }

  throw new UserInputElementTypeError(
    elementOrLocator,
    matcherFn,
    context,
  )
}

export function getNodeFromUserInput(
  elementOrLocator: Element | Locator,
  matcherFn: (...args: any) => any,
  context: MatcherState,
): Node {
  if (elementOrLocator instanceof Locator) {
    elementOrLocator = elementOrLocator.element()
  }

  const defaultView = elementOrLocator.ownerDocument?.defaultView || window

  if (
    elementOrLocator instanceof defaultView.Node
  ) {
    return elementOrLocator
  }

  throw new UserInputNodeTypeError(
    elementOrLocator,
    matcherFn,
    context,
  )
}

export function getMessage(
  context: MatcherState,
  matcher: string,
  expectedLabel: string,
  expectedValue: unknown,
  receivedLabel: string,
  receivedValue: unknown,
): string {
  return [
    `${matcher}\n`,

    `${expectedLabel}:\n${context.utils.EXPECTED_COLOR(
      redent(display(context, expectedValue), 2),
    )}`,

    `${receivedLabel}:\n${context.utils.RECEIVED_COLOR(
      redent(display(context, receivedValue), 2),
    )}`,
  ].join('\n')
}

export function redent(string: string, count: number): string {
  return indentString(stripIndent(string), count)
}

function indentString(string: string, count: number) {
  const regex = /^(?!\s*$)/gm

  return string.replace(regex, ' '.repeat(count))
}

function minIndent(string: string) {
  const match = string.match(/^[ \t]*(?=\S)/gm)

  if (!match) {
    return 0
  }

  return match.reduce((r, a) => Math.min(r, a.length), Infinity)
}

function stripIndent(string: string) {
  const indent = minIndent(string)

  if (indent === 0) {
    return string
  }

  const regex = new RegExp(`^[ \\t]{${indent}}`, 'gm')

  return string.replace(regex, '')
}

function display(context: MatcherState, value: unknown) {
  return typeof value === 'string' ? value : context.utils.stringify(value)
}

interface ToSentenceOptions {
  wordConnector?: string
  lastWordConnector?: string
}

export function toSentence(
  array: string[],
  { wordConnector = ', ', lastWordConnector = ' and ' }: ToSentenceOptions = {},
): string {
  return [array.slice(0, -1).join(wordConnector), array.at(-1)].join(
    array.length > 1 ? lastWordConnector : '',
  )
}

class GenericTypeError extends Error {
  constructor(expectedString: string, received: unknown, matcherFn: (...args: any) => any, context: MatcherState) {
    super()

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, matcherFn)
    }
    let withType = ''
    try {
      withType = context.utils.printWithType(
        'Received',
        received,
        context.utils.printReceived,
      )
    }
    catch {
      // Can throw for Document:
      // https://github.com/jsdom/jsdom/issues/2304
    }
    this.message = [
      context.utils.matcherHint(
        `${context.isNot ? '.not' : ''}.${matcherFn.name}`,
        'received',
        '',
      ),
      '',

      `${context.utils.RECEIVED_COLOR(
        'received',
      )} value must ${expectedString} or a Locator that returns ${expectedString}.`,
      withType,
    ].join('\n')
  }
}

class UserInputElementTypeError extends GenericTypeError {
  constructor(
    element: unknown,
    matcherFn: (...args: any) => any,
    context: MatcherState,
  ) {
    super('an HTMLElement or an SVGElement', element, matcherFn, context)
  }
}

class UserInputNodeTypeError extends GenericTypeError {
  constructor(
    element: unknown,
    matcherFn: (...args: any) => any,
    context: MatcherState,
  ) {
    super('a Node', element, matcherFn, context)
  }
}

export function getTag(element: Element): string {
  // Named inputs, e.g. <input name=tagName>, will be exposed as fields on the parent <form>
  // and override its properties.
  if (element instanceof HTMLFormElement) {
    return 'FORM'
  }
  // Elements from the svg namespace do not have uppercase tagName right away.
  return element.tagName.toUpperCase()
}

export function isInputElement(element: HTMLElement | SVGElement): element is HTMLInputElement {
  return getTag(element) === 'INPUT'
}

type SimpleInputValue = string | number | boolean | null

export function getSingleElementValue(
  element: Element | undefined,
): SimpleInputValue | string[] | undefined {
  if (!element) {
    return undefined
  }

  switch (getTag(element)) {
    case 'INPUT':
      return getInputValue(element as HTMLInputElement)
    case 'SELECT':
      return getSelectValue(element as HTMLSelectElement)
    default: {
      return (element as any).value ?? getAccessibleValue(element)
    }
  }
}

function getSelectValue({ multiple, options }: HTMLSelectElement) {
  const selectedOptions = [...options].filter(option => option.selected)

  if (multiple) {
    return [...selectedOptions].map(opt => opt.value)
  }
  /* istanbul ignore if */
  if (selectedOptions.length === 0) {
    return undefined // Couldn't make this happen, but just in case
  }
  return selectedOptions[0].value
}

function getInputValue(inputElement: HTMLInputElement) {
  switch (inputElement.type) {
    case 'number':
      return inputElement.value === '' ? null : Number(inputElement.value)
    case 'checkbox':
      return inputElement.checked
    default:
      return inputElement.value
  }
}

const rolesSupportingValues = ['meter', 'progressbar', 'slider', 'spinbutton']
function getAccessibleValue(element: Element) {
  if (!rolesSupportingValues.includes(element.getAttribute('role') || '')) {
    return undefined
  }
  return Number(element.getAttribute('aria-valuenow'))
}

export function normalize(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function matches(textToMatch: string, matcher: string | RegExp): boolean {
  if (matcher instanceof RegExp) {
    return matcher.test(textToMatch)
  }
  else {
    return textToMatch.includes(String(matcher))
  }
}

export function arrayAsSetComparison(a: unknown, b: unknown): boolean | undefined {
  if (Array.isArray(a) && Array.isArray(b)) {
    const setB = new Set(b)
    for (const item of new Set(a)) {
      if (!setB.has(item)) {
        return false
      }
    }
    return true
  }
  return undefined
}
