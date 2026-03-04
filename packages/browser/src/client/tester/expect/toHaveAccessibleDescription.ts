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
import { getElementAccessibleDescription } from 'ivya/utils'
import { getElementFromUserInput, getMessage } from './utils'

export default function toHaveAccessibleDescription(
  this: MatcherState,
  actual: Element | Locator,
  expectedAccessibleDescription?: string | RegExp,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toHaveAccessibleDescription, this)
  const actualAccessibleDescription = getElementAccessibleDescription(htmlElement, false)
  const defaultView = htmlElement.ownerDocument.defaultView || window

  const missingExpectedValue = arguments.length === 1

  let pass = false
  if (missingExpectedValue) {
    // When called without an expected value we only want to validate that the element has an
    // accessible description, whatever it may be.
    pass = actualAccessibleDescription !== ''
  }
  else {
    pass
      = expectedAccessibleDescription instanceof defaultView.RegExp
        ? expectedAccessibleDescription.test(actualAccessibleDescription)
        : this.equals(
            actualAccessibleDescription,
            expectedAccessibleDescription,
            this.customTesters,
          )
  }

  return {
    pass,

    message: () => {
      const to = this.isNot ? 'not to' : 'to'
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toHaveAccessibleDescription`,
          'element',
          '',
        ),
        `Expected element ${to} have accessible description`,
        expectedAccessibleDescription,
        'Received',
        actualAccessibleDescription,
      )
    },
  }
}
