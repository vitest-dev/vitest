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

function getNormalizedHtml(container: HTMLElement | SVGElement, htmlText: string) {
  const div = container.ownerDocument.createElement('div')
  div.innerHTML = htmlText
  return div.innerHTML
}

export default function toContainHTML(
  this: MatcherState,
  actual: Element | Locator,
  htmlText: string,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toContainHTML, this)

  if (typeof htmlText !== 'string') {
    throw new TypeError(`.toContainHTML() expects a string value, got ${htmlText}`)
  }

  return {
    pass: htmlElement.outerHTML.includes(getNormalizedHtml(htmlElement, htmlText)),
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toContainHTML`,
          'element',
          '',
        ),
        'Expected:',
        `  ${this.utils.EXPECTED_COLOR(htmlText)}`,
        'Received:',
        `  ${this.utils.printReceived(htmlElement.cloneNode(true))}`,
      ].join('\n')
    },
  }
}
