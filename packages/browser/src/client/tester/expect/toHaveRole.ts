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
import { beginAriaCaches, endAriaCaches, getAriaRole } from 'ivya/utils'
import { getElementFromUserInput, getMessage } from './utils'

export default function toHaveRole(
  this: MatcherState,
  actual: Element | Locator,
  expectedRole: string,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toHaveRole, this)
  beginAriaCaches()
  const actualRole = getAriaRole(htmlElement)
  endAriaCaches()
  return {
    pass: actualRole === expectedRole,
    message: () => {
      const to = this.isNot ? 'not to' : 'to'
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toHaveRole`,
          'element',
          '',
        ),
        `Expected element ${to} have role`,
        expectedRole,
        'Received',
        actualRole,
      )
    },
  }
}
