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
import { getMessage, getNodeFromUserInput, normalize } from './utils'

export default function toHaveTextContent(
  this: MatcherState,
  actual: Element | Locator,
  matcher: string | number,
  options: { normalizeWhitespace?: boolean } = { normalizeWhitespace: true },
): MatcherResult {
  const node = getNodeFromUserInput(actual, toHaveTextContent, this)

  const textContent = options.normalizeWhitespace
    ? normalize(node.textContent || '')
    : (node.textContent || '').replace(/\u00A0/g, ' ') // Replace &nbsp; with normal spaces

  const expectedText = String(matcher)

  return {
    pass: textContent === expectedText,
    message: () => {
      const to = this.isNot ? 'not to' : 'to'
      return getMessage(
        this,
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toHaveTextContent`,
          'element',
          '',
        ),
        `Expected element ${to} have text content`,
        expectedText,
        'Received',
        textContent,
      )
    },
  }
}
