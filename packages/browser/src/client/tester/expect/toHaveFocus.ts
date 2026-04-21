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
import { getElementFromUserInput } from './utils'

export default function toHaveFocus(
  this: MatcherState,
  actual: Element | Locator,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toHaveFocus, this)

  return {
    pass: htmlElement.ownerDocument.activeElement === htmlElement,
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toHaveFocus`,
          'element',
          '',
        ),
        '',
        ...(this.isNot
          ? [
              'Received element is focused:',
              `  ${this.utils.printReceived(htmlElement)}`,
            ]
          : [
              'Expected element with focus:',
              `  ${this.utils.printExpected(htmlElement)}`,
              'Received element with focus:',
              `  ${this.utils.printReceived(
                htmlElement.ownerDocument.activeElement,
              )}`,
            ]),
      ].join('\n')
    },
  }
}
