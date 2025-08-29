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
import { getElementAccessibleName } from 'ivya/utils'
import { getElementFromUserInput, getMessage } from './utils'

export default function toHaveAccessibleName(
  this: MatcherState,
  actual: Element | Locator,
  expectedAccessibleName?: string | RegExp,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toHaveAccessibleName, this)
  const actualAccessibleName = getElementAccessibleName(htmlElement, false)
  const missingExpectedValue = arguments.length === 1
  const defaultView = htmlElement.ownerDocument.defaultView || window

  let pass = false
  if (missingExpectedValue) {
    // When called without an expected value we only want to validate that the element has an
    // accessible name, whatever it may be.
    pass = actualAccessibleName !== ''
  }
  else {
    pass
      = expectedAccessibleName instanceof defaultView.RegExp
        ? expectedAccessibleName.test(actualAccessibleName)
        : this.equals(actualAccessibleName, expectedAccessibleName, this.customTesters)
  }

  return {
    pass,

    message: () => {
      const to = this.isNot ? 'not to' : 'to'
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.${toHaveAccessibleName.name}`,
          'element',
          '',
        ),
        `Expected element ${to} have accessible name`,
        expectedAccessibleName,
        'Received',
        actualAccessibleName,
      )
    },
  }
}
