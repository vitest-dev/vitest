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
import { getElementFromUserInput, getMessage } from './utils'

export default function toHaveAttribute(
  this: MatcherState,
  actual: Element | Locator,
  attribute: string,
  expectedValue?: string,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toHaveAttribute, this)
  const isExpectedValuePresent = expectedValue !== undefined
  const hasAttribute = htmlElement.hasAttribute(attribute)
  const receivedValue = htmlElement.getAttribute(attribute)
  return {
    pass: isExpectedValuePresent
      ? hasAttribute && this.equals(receivedValue, expectedValue, this.customTesters)
      : hasAttribute,
    message: () => {
      const to = this.isNot ? 'not to' : 'to'
      const receivedAttribute = hasAttribute
        ? printAttribute(this.utils.stringify, attribute, receivedValue)
        : null
      const matcher = this.utils.matcherHint(
        `${this.isNot ? '.not' : ''}.toHaveAttribute`,
        'element',
        this.utils.printExpected(attribute),
        {
          secondArgument: isExpectedValuePresent
            ? this.utils.printExpected(expectedValue)
            : undefined,
          comment: getAttributeComment(
            this.utils.stringify,
            attribute,
            expectedValue,
          ),
        },
      )
      return getMessage(
        this,
        matcher,
        `Expected the element ${to} have attribute`,
        printAttribute(this.utils.stringify, attribute, expectedValue),
        'Received',
        receivedAttribute,
      )
    },
  }
}

function printAttribute(stringify: (obj: unknown) => string, name: string, value: unknown) {
  return value === undefined ? name : `${name}=${stringify(value)}`
}

function getAttributeComment(stringify: (obj: unknown) => string, name: string, value: unknown) {
  return value === undefined
    ? `element.hasAttribute(${stringify(name)})`
    : `element.getAttribute(${stringify(name)}) === ${stringify(value)}`
}
