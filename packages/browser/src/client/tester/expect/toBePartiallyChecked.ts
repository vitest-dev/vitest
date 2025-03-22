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
import { getAriaChecked as ivyaGetAriaChecked } from 'ivya/utils'
import { getElementFromUserInput, isInputElement } from './utils'

export default function toBePartiallyChecked(
  this: MatcherState,
  actual: Element | Locator,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toBePartiallyChecked, this)

  const isValidInput = () => {
    return (
      isInputElement(htmlElement) && htmlElement.type === 'checkbox'
    )
  }

  const isValidAriaElement = () => {
    return htmlElement.getAttribute('role') === 'checkbox'
  }

  if (!isValidInput() && !isValidAriaElement()) {
    return {
      pass: false,
      message: () =>
        'only inputs with type="checkbox" or elements with role="checkbox" and a valid aria-checked attribute can be used with .toBePartiallyChecked(). Use .toHaveValue() instead',
    }
  }

  const isPartiallyChecked = isAriaMixed(htmlElement)

  return {
    pass: isPartiallyChecked,
    message: () => {
      const is = isPartiallyChecked ? 'is' : 'is not'
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toBePartiallyChecked`,
          'element',
          '',
        ),
        '',
        `Received element ${is} partially checked:`,
        `  ${this.utils.printReceived(htmlElement.cloneNode(false))}`,
      ].join('\n')
    },
  }
}

function isAriaMixed(element: HTMLElement | SVGElement): boolean {
  const isMixed = ivyaGetAriaChecked(element) === 'mixed'
  if (!isMixed) {
    // playwright only looks at aria-checked if element is not a checkbox/radio
    if (
      isInputElement(element)
      && ['checkbox', 'radio'].includes((element as HTMLInputElement).type)
    ) {
      const ariaValue = element.getAttribute('aria-checked')
      if (ariaValue === 'mixed') {
        return true
      }
    }
  }
  return isMixed
}
