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
import { getElementFromUserInput, getMessage, getTag, isInputElement } from './utils'

export default function toHaveDisplayValue(
  this: MatcherState,
  actual: Element | Locator,
  expectedValue: string | RegExp | Array<string | RegExp>,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toHaveDisplayValue, this)
  const tagName = getTag(htmlElement)

  if (!['SELECT', 'INPUT', 'TEXTAREA'].includes(tagName)) {
    throw new Error(
      '.toHaveDisplayValue() currently supports only input, textarea or select elements, try with another matcher instead.',
    )
  }

  if (isInputElement(htmlElement) && ['radio', 'checkbox'].includes(htmlElement.type)) {
    throw new Error(
      `.toHaveDisplayValue() currently does not support input[type="${htmlElement.type}"], try with another matcher instead.`,
    )
  }

  const values = getValues(tagName, htmlElement)
  const expectedValues = getExpectedValues(expectedValue)
  const numberOfMatchesWithValues = expectedValues.filter(expected =>
    values.some(value =>
      expected instanceof RegExp
        ? expected.test(value)
        : this.equals(value, String(expected), this.customTesters),
    ),
  ).length

  const matchedWithAllValues = numberOfMatchesWithValues === values.length
  const matchedWithAllExpectedValues
    = numberOfMatchesWithValues === expectedValues.length

  return {
    pass: matchedWithAllValues && matchedWithAllExpectedValues,
    message: () =>
      getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toHaveDisplayValue`,
          'element',
          '',
        ),
        `Expected element ${this.isNot ? 'not ' : ''}to have display value`,
        expectedValue,
        'Received',
        values,
      ),
  }
}

function getValues(tagName: string, htmlElement: HTMLElement | SVGElement) {
  return tagName === 'SELECT'
    ? Array.from(htmlElement as HTMLSelectElement)
        .filter(option => (option as HTMLOptionElement).selected)
        .map(option => option.textContent || '')
    : [(htmlElement as HTMLInputElement).value]
}

function getExpectedValues(expectedValue: string | RegExp | Array<string | RegExp>): Array<string | RegExp> {
  return Array.isArray(expectedValue) ? expectedValue : [expectedValue]
}
