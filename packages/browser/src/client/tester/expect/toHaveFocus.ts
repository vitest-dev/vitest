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

import type { MatcherResult, MatcherState } from 'vitest'
import type { Locator } from '../locators'
import { getElementFromUserInput } from './utils'

export default function toHaveFocus(
  this: MatcherState,
  actual: Element | Locator,
): MatcherResult {
  const htmlElement = getElementFromUserInput(actual, toHaveFocus, this)
  const root = htmlElement.getRootNode()
  const defaultView = htmlElement.ownerDocument.defaultView
  const isDocumentOrShadowRoot
    = root === htmlElement.ownerDocument
      || (defaultView && root instanceof defaultView.ShadowRoot)
  const activeElement
    = isDocumentOrShadowRoot
      ? (root as Document | ShadowRoot).activeElement
      : htmlElement.ownerDocument.activeElement

  return {
    pass: activeElement === htmlElement,
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
              `  ${this.utils.printReceived(activeElement)}`,
            ]),
      ].join('\n')
    },
  }
}
