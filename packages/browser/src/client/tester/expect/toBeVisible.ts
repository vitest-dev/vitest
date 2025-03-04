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
import { isElementHiddenForAria } from 'ivya/utils'
import { getElementFromUserInput } from './utils'

export default function toBeVisible(
  this: MatcherState,
  actual: Element | Locator,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toBeVisible, this)
  const isInDocument
    = htmlElement.ownerDocument === htmlElement.getRootNode({ composed: true })
  const isVisible = isInDocument && !isElementHiddenForAria(htmlElement)
  return {
    pass: isVisible,
    message: () => {
      const is = isVisible ? 'is' : 'is not'
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toBeVisible`,
          'element',
          '',
        ),
        '',
        `Received element ${is} visible${
          isInDocument ? '' : ' (element is not in the document)'
        }:`,
        `  ${this.utils.printReceived(htmlElement.cloneNode(false))}`,
      ].join('\n')
    },
  }
}
