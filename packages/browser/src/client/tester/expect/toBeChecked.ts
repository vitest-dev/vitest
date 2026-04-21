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
import { getAriaChecked, getAriaCheckedRoles, getAriaRole } from 'ivya/utils'
import { getElementFromUserInput, isInputElement, toSentence } from './utils'

const supportedRoles = getAriaCheckedRoles()

export default function toBeChecked(
  this: MatcherState,
  actual: Element | Locator,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toBeChecked, this)

  const isValidInput = () => {
    return (
      isInputElement(htmlElement)
      && ['checkbox', 'radio'].includes(htmlElement.type)
    )
  }

  const isValidAriaElement = () => {
    return (
      supportedRoles.includes(getAriaRole(htmlElement) || '')
      && ['true', 'false'].includes(htmlElement.getAttribute('aria-checked') || '')
    )
  }

  if (!isValidInput() && !isValidAriaElement()) {
    return {
      pass: false,
      message: () =>
        `only inputs with type="checkbox" or type="radio" or elements with ${supportedRolesSentence()} and a valid aria-checked attribute can be used with .toBeChecked(). Use .toHaveValue() instead`,
    }
  }

  const checkedValue = getAriaChecked(htmlElement)
  const isChecked = checkedValue === true // don't tolerate "mixed", see toBePartiallyChecked

  return {
    pass: isChecked,
    message: () => {
      const is = isChecked ? 'is' : 'is not'
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toBeChecked`,
          'element',
          '',
        ),
        '',
        `Received element ${is} checked:`,
        `  ${this.utils.printReceived(htmlElement.cloneNode(false))}`,
      ].join('\n')
    },
  }
}

function supportedRolesSentence() {
  return toSentence(
    supportedRoles.map(role => `role="${role}"`),
    { lastWordConnector: ' or ' },
  )
}
