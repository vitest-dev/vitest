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

export default function toContainElement(
  this: MatcherState,
  actual: Element | Locator,
  expectedElement: Element | Locator | null,
): ExpectationResult {
  const containerElement = getElementFromUserInput(actual, toContainElement, this)
  const childElement = expectedElement !== null
    ? getElementFromUserInput(expectedElement, toContainElement, this)
    : null

  return {
    pass: containerElement.contains(childElement),
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toContainElement`,
          'element',
          'element',
        ),
        '',

        this.utils.RECEIVED_COLOR(`${this.utils.stringify(
          containerElement.cloneNode(false),
        )} ${
          this.isNot ? 'contains:' : 'does not contain:'
        } ${this.utils.stringify(childElement ? childElement.cloneNode(false) : null)}
        `),
      ].join('\n')
    },
  }
}
