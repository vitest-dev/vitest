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
import { beginAriaCaches, endAriaCaches, isElementVisible as ivyaIsVisible } from 'ivya/utils'
import { server } from 'vitest/browser'
import { getElementFromUserInput } from './utils'

export default function toBeVisible(
  this: MatcherState,
  actual: Element | Locator,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toBeVisible, this)
  const isInDocument
    = htmlElement.ownerDocument === htmlElement.getRootNode({ composed: true })
  beginAriaCaches()
  const isVisible = isInDocument && isElementVisible(htmlElement)
  endAriaCaches()
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

function isElementVisible(element: HTMLElement | SVGElement): boolean {
  const isIvyaVisible = ivyaIsVisible(element)
  // if it's visible or not, but we are not in webkit, respect the result
  if (server.browser !== 'webkit') {
    return isIvyaVisible
  }
  // if we are in webkit and it's not visible, fallback to jest-dom check
  // because ivya doesn't use .checkVisibility here
  const detailsElement = element.closest('details')
  if (!detailsElement || element === detailsElement) {
    return isIvyaVisible
  }
  return isElementVisibleInDetails(element as HTMLElement)
}

function isElementVisibleInDetails(targetElement: HTMLElement) {
  let currentElement: HTMLElement | null = targetElement

  while (currentElement) {
    if (currentElement.tagName === 'DETAILS') {
      const isSummary = currentElement.querySelector('summary') === targetElement
      if (!(currentElement as HTMLDetailsElement).open && !isSummary) {
        return false
      }
    }
    currentElement = currentElement.parentElement
  }

  return targetElement.offsetParent !== null
}
