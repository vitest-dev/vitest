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

export default function toBeInViewport(
  this: MatcherState,
  actual: Element | Locator,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toBeInViewport, this)

  const pass = isElementInViewport(htmlElement)

  return {
    pass,
    message: () => {
      const is = pass ? 'is' : 'is not'
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toBeInViewport`,
          'element',
          '',
        ),
        '',
        `Received element ${is} in viewport:`,
        `  ${this.utils.printReceived(htmlElement.cloneNode(false))}`,
      ].join('\n')
    },
  }
}

function isElementInViewport(element: HTMLElement | SVGElement): boolean {
  // First check if element is in the document
  const isInDocument = element.ownerDocument === element.getRootNode({ composed: true })
  if (!isInDocument) {
    return false
  }

  // Check basic visibility properties that would make element invisible
  const style = window.getComputedStyle(element)
  if (
    style.display === 'none'
    || style.visibility === 'hidden'
    || Number.parseFloat(style.opacity) === 0
  ) {
    return false
  }

  // Get bounding rectangle
  const rect = element.getBoundingClientRect()

  // Check if element has dimensions
  if (rect.width === 0 || rect.height === 0) {
    return false
  }

  // Check if element intersects with viewport
  const viewportWidth = window.innerWidth
    || document.documentElement.clientWidth
  const viewportHeight = window.innerHeight
    || document.documentElement.clientHeight

  // Element is in viewport if any part of it is visible
  const isHorizontallyVisible = rect.right > 0 && rect.left < viewportWidth
  const isVerticallyVisible = rect.bottom > 0 && rect.top < viewportHeight

  return isHorizontallyVisible && isVerticallyVisible
}
