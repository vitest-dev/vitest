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

import type { ExpectationResult, MatcherState } from '@vitest/expect'
import type { Locator } from '../locators'
import { getElementFromUserInput, getTag } from './utils'

const FORM_TAGS = ['FORM', 'INPUT', 'SELECT', 'TEXTAREA']

function isElementHavingAriaInvalid(element: HTMLElement | SVGElement) {
  return (
    element.hasAttribute('aria-invalid')
    && element.getAttribute('aria-invalid') !== 'false'
  )
}

function isSupportsValidityMethod(element: HTMLElement | SVGElement): element is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLFormElement {
  return FORM_TAGS.includes(getTag(element))
}

function isElementInvalid(element: HTMLElement | SVGElement) {
  const isHaveAriaInvalid = isElementHavingAriaInvalid(element)
  if (isSupportsValidityMethod(element)) {
    return isHaveAriaInvalid || !element.checkValidity()
  }
  else {
    return isHaveAriaInvalid
  }
}

export function toBeInvalid(
  this: MatcherState,
  element: HTMLElement | SVGElement | Locator,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(element, toBeInvalid, this)

  const isInvalid = isElementInvalid(htmlElement)

  return {
    pass: isInvalid,
    message: () => {
      const is = isInvalid ? 'is' : 'is not'
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toBeInvalid`,
          'element',
          '',
        ),
        '',
        `Received element ${is} currently invalid:`,
        `  ${this.utils.printReceived(htmlElement.cloneNode(false))}`,
      ].join('\n')
    },
  }
}

export function toBeValid(
  this: MatcherState,
  element: HTMLElement | SVGElement | Locator,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(element, toBeInvalid, this)

  const isValid = !isElementInvalid(htmlElement)

  return {
    pass: isValid,
    message: () => {
      const is = isValid ? 'is' : 'is not'
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toBeValid`,
          'element',
          '',
        ),
        '',
        `Received element ${is} currently valid:`,
        `  ${this.utils.printReceived(htmlElement.cloneNode(false))}`,
      ].join('\n')
    },
  }
}
