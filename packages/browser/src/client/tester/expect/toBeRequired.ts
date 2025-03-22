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
import { getElementFromUserInput, getTag } from './utils'

// form elements that support 'required'
const FORM_TAGS = ['SELECT', 'TEXTAREA']

const ARIA_FORM_TAGS = ['INPUT', 'SELECT', 'TEXTAREA']

const UNSUPPORTED_INPUT_TYPES = [
  'color',
  'hidden',
  'range',
  'submit',
  'image',
  'reset',
]

const SUPPORTED_ARIA_ROLES = [
  'checkbox',
  'combobox',
  'gridcell',
  'listbox',
  'radiogroup',
  'spinbutton',
  'textbox',
  'tree',
]

function isRequiredOnFormTagsExceptInput(element: HTMLElement | SVGElement) {
  return FORM_TAGS.includes(getTag(element)) && element.hasAttribute('required')
}

function isRequiredOnSupportedInput(element: HTMLElement | SVGElement) {
  return (
    getTag(element) === 'INPUT'
    && element.hasAttribute('required')
    && ((element.hasAttribute('type')
      && !UNSUPPORTED_INPUT_TYPES.includes(element.getAttribute('type') || ''))
    || !element.hasAttribute('type'))
  )
}

function isElementRequiredByARIA(element: HTMLElement | SVGElement) {
  return (
    element.hasAttribute('aria-required')
    && element.getAttribute('aria-required') === 'true'
    && (ARIA_FORM_TAGS.includes(getTag(element))
      || (element.hasAttribute('role')
        && SUPPORTED_ARIA_ROLES.includes(element.getAttribute('role') || '')))
  )
}

export default function toBeRequired(
  this: MatcherState,
  element: HTMLElement | SVGElement | Locator,
): ExpectationResult {
  const htmlElement = getElementFromUserInput(element, toBeRequired, this)

  const isRequired
    = isRequiredOnFormTagsExceptInput(htmlElement)
      || isRequiredOnSupportedInput(htmlElement)
      || isElementRequiredByARIA(htmlElement)

  return {
    pass: isRequired,
    message: () => {
      const is = isRequired ? 'is' : 'is not'
      return [
        this.utils.matcherHint(
          `${this.isNot ? '.not' : ''}.toBeRequired`,
          'element',
          '',
        ),
        '',
        `Received element ${is} required:`,
        `  ${this.utils.printReceived(htmlElement.cloneNode(false))}`,
      ].join('\n')
    },
  }
}
