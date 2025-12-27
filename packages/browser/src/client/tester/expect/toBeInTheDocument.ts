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
import { queryElementFromUserInput } from './utils'

export default function toBeInTheDocument(
  this: MatcherState,
  actual: Element | Locator | null,
): ExpectationResult {
  let htmlElement: null | HTMLElement | SVGElement = null

  if (actual !== null || !this.isNot) {
    htmlElement = queryElementFromUserInput(actual, toBeInTheDocument, this)
  }

  const pass
    = htmlElement === null
      ? false
      : htmlElement.ownerDocument === htmlElement.getRootNode({ composed: true })

  const errorFound = () => {
    return `expected document not to contain element, found ${this.utils.stringify(
      htmlElement?.cloneNode(true),
    )} instead`
  }
  const errorNotFound = () => {
    return `element could not be found in the document`
  }

  return {
    pass,
    message: () => {
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toBeInTheDocument`,
          'element',
          '',
        ),
        '',

        this.utils.RECEIVED_COLOR(this.isNot ? errorFound() : errorNotFound()),
      ].join('\n')
    },
  }
}
