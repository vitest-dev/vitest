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
  options?: { ratio?: number },
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toBeInViewport, this)

  const expectedRatio = options?.ratio ?? 0
  return getViewportIntersection(htmlElement, expectedRatio).then(({ pass, ratio }) => {
    return {
      pass,
      message: () => {
        const is = pass ? 'is' : 'is not'
        const ratioText = expectedRatio > 0 ? ` with ratio ${expectedRatio}` : ''
        const actualRatioText = ratio !== undefined ? ` (actual ratio: ${ratio.toFixed(3)})` : ''
        return [
          this.utils.matcherHint(
            `${this.isNot ? '.not' : ''}.toBeInViewport`,
            'element',
            '',
          ),
          '',
          `Received element ${is} in viewport${ratioText}${actualRatioText}:`,
          `  ${this.utils.printReceived(htmlElement.cloneNode(false))}`,
        ].join('\n')
      },
    }
  })
}

/**
 * Get viewport intersection ratio using IntersectionObserver API
 * This implementation follows Playwright's approach using IntersectionObserver as the primary mechanism
 */
async function getViewportIntersection(element: HTMLElement | SVGElement, expectedRatio: number): Promise<{ pass: boolean; ratio?: number }> {
  // Use IntersectionObserver API to get the intersection ratio
  // Following Playwright's exact pattern from viewportRatio function
  const intersectionRatio = await new Promise<number>((resolve) => {
    // This mimics Playwright's Promise-based implementation in a synchronous context
    const observer = new IntersectionObserver((entries) => {
      if (entries.length > 0) {
        resolve(entries[0].intersectionRatio)
      }
      else {
        resolve(0)
      }
      observer.disconnect()
    })

    observer.observe(element)

    // Firefox workaround: requestAnimationFrame to ensure observer callback fires
    // This is exactly how Playwright handles it
    requestAnimationFrame(() => {})
  })

  // Apply the same logic as Playwright:
  // ratio > 0 && ratio > (expectedRatio - 1e-9)
  const pass = intersectionRatio > 0 && intersectionRatio > (expectedRatio - 1e-9)

  return { pass, ratio: intersectionRatio }
}
