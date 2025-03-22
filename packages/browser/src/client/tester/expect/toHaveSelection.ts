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
import { arrayAsSetComparison, getElementFromUserInput, getMessage, getTag } from './utils'

export default function toHaveSelection(
  this: MatcherState,
  element: HTMLElement | SVGElement | Locator,
  expectedSelection: string,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(element, toHaveSelection, this)

  const expectsSelection = expectedSelection !== undefined

  if (expectsSelection && typeof expectedSelection !== 'string') {
    throw new Error(`expected selection must be a string or undefined`)
  }

  const receivedSelection = getSelection(htmlElement)

  return {
    pass: expectsSelection
      ? this.equals(receivedSelection, expectedSelection, [arrayAsSetComparison, ...this.customTesters])
      : Boolean(receivedSelection),
    message: () => {
      const to = this.isNot ? 'not to' : 'to'
      const matcher = this.utils.matcherHint(
        `${this.isNot ? '.not' : ''}.toHaveSelection`,
        'element',
        expectedSelection,
      )
      return getMessage(
        this,
        matcher,
        `Expected the element ${to} have selection`,
        expectsSelection ? expectedSelection : '(any)',
        'Received',
        receivedSelection,
      )
    },
  }
}

function getSelection(element: HTMLElement | SVGElement): string {
  const selection = element.ownerDocument.getSelection()

  if (!selection) {
    return ''
  }

  if (['INPUT', 'TEXTAREA'].includes(getTag(element))) {
    const input = element as HTMLInputElement | HTMLTextAreaElement
    if (['radio', 'checkbox'].includes(input.type)) {
      return ''
    }
    if (input.selectionStart == null || input.selectionEnd == null) {
      return ''
    }
    return input.value
      .toString()
      .substring(input.selectionStart, input.selectionEnd)
  }

  if (selection.anchorNode === null || selection.focusNode === null) {
    // No selection
    return ''
  }

  const originalRange = selection.getRangeAt(0)
  const temporaryRange = element.ownerDocument.createRange()

  if (selection.containsNode(element, false)) {
    // Whole element is inside selection
    temporaryRange.selectNodeContents(element)
    selection.removeAllRanges()
    selection.addRange(temporaryRange)
  }
  else if (
    element.contains(selection.anchorNode)
    && element.contains(selection.focusNode)
  ) {
    // Element contains selection, nothing to do
  }
  else {
    // Element is partially selected
    const selectionStartsWithinElement
      = element === originalRange.startContainer
        || element.contains(originalRange.startContainer)
    const selectionEndsWithinElement
      = element === originalRange.endContainer
        || element.contains(originalRange.endContainer)
    selection.removeAllRanges()

    if (selectionStartsWithinElement || selectionEndsWithinElement) {
      temporaryRange.selectNodeContents(element)

      if (selectionStartsWithinElement) {
        temporaryRange.setStart(
          originalRange.startContainer,
          originalRange.startOffset,
        )
      }
      if (selectionEndsWithinElement) {
        temporaryRange.setEnd(
          originalRange.endContainer,
          originalRange.endOffset,
        )
      }

      selection.addRange(temporaryRange)
    }
  }

  const result = selection.toString()

  selection.removeAllRanges()
  selection.addRange(originalRange)

  return result
}
