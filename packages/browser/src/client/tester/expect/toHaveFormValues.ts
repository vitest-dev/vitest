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
import { cssEscape } from 'ivya/utils'
import { arrayAsSetComparison, getElementFromUserInput, getSingleElementValue, getTag } from './utils'

export default function toHaveFormValues(
  this: MatcherState,
  actual: Element | Locator,
  expectedValues: Record<string, unknown>,
): ExpectationResult {
  const formElement = getElementFromUserInput(actual, toHaveFormValues, this)

  const defaultView = formElement.ownerDocument.defaultView || window

  if (!(formElement instanceof defaultView.HTMLFieldSetElement) && !(formElement instanceof defaultView.HTMLFormElement)) {
    throw new TypeError(`toHaveFormValues must be called on a form or a fieldset, instead got ${getTag(formElement)}`)
  }

  if (!expectedValues || typeof expectedValues !== 'object') {
    throw new TypeError(
      `toHaveFormValues must be called with an object of expected form values. Got ${expectedValues}`,
    )
  }

  const formValues = getAllFormValues(formElement)
  return {
    pass: Object.entries(expectedValues).every(([name, expectedValue]) =>
      this.equals(formValues[name], expectedValue, [arrayAsSetComparison, ...this.customTesters]),
    ),
    message: () => {
      const to = this.isNot ? 'not to' : 'to'
      const matcher = `${this.isNot ? '.not' : ''}.toHaveFormValues`

      const commonKeyValues: Record<string, unknown> = {}
      for (const key in formValues) {
        if (!Object.hasOwn(expectedValues, key)) {
          continue
        }
        commonKeyValues[key] = formValues[key]
      }

      return [
        this.utils.matcherHint(matcher, 'element', ''),
        `Expected the element ${to} have form values`,
        this.utils.diff(expectedValues, commonKeyValues),
      ].join('\n\n')
    },
  }
}

// Returns the combined value of several elements that have the same name
// e.g. radio buttons or groups of checkboxes
function getMultiElementValue(elements: HTMLInputElement[]) {
  let type = ''
  for (const element of elements) {
    if (type && type !== element.type) {
      throw new Error(
        'Multiple form elements with the same name must be of the same type',
      )
    }
    type = element.type
  }
  switch (type) {
    case 'radio': {
      const selected = elements.find(radio => radio.checked)
      return selected ? selected.value : undefined
    }
    case 'checkbox':
      return elements
        .filter(checkbox => checkbox.checked)
        .map(checkbox => checkbox.value)
    default:
      // NOTE: Not even sure this is a valid use case, but just in case...
      return elements.map(element => element.value)
  }
}

function getFormValue(container: HTMLFormElement | HTMLFieldSetElement, name: string) {
  const elements = [...container.querySelectorAll(`[name="${cssEscape(name)}"]`)]
  /* istanbul ignore if */
  if (elements.length === 0) {
    return undefined // shouldn't happen, but just in case
  }
  switch (elements.length) {
    case 1:
      return getSingleElementValue(elements[0])
    default:
      return getMultiElementValue(elements as HTMLInputElement[])
  }
}

// Strips the `[]` suffix off a form value name
function getPureName(name: string) {
  return /\[\]$/.test(name) ? name.slice(0, -2) : name
}

function getAllFormValues(container: HTMLFormElement | HTMLFieldSetElement) {
  const values: Record<string, unknown> = {}

  for (const element of container.elements) {
    if (!('name' in element)) {
      continue
    }
    const name = element.name as string
    values[getPureName(name)] = getFormValue(container, name)
  }

  return values
}
