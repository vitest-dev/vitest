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

export default function toBeEmptyDOMElement(
  this: MatcherState,
  actual: Element | Locator,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toBeEmptyDOMElement, this)

  return {
    pass: isEmptyElement(htmlElement),
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toBeEmptyDOMElement`,
          'element',
          '',
        ),
        '',
        'Received:',
        `  ${this.utils.printReceived(htmlElement.innerHTML)}`,
      ].join('\n')
    },
  }
}

/**
 * Identifies if an element doesn't contain child nodes (excluding comments)
 */
function isEmptyElement(element: HTMLElement | SVGElement): boolean {
  const nonCommentChildNodes = [...element.childNodes].filter(node => node.nodeType !== Node.COMMENT_NODE)
  return nonCommentChildNodes.length === 0
}
