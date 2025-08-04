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
import { getElementFromUserInput, getMessage } from './utils'

export default function toHaveClass(
  this: MatcherState,
  actual: Element | Locator,
  ...params: (string | RegExp)[] | [string, options?: { exact: boolean }]
): ExpectationResult {
  const htmlElement = getElementFromUserInput(actual, toHaveClass, this)
  const { expectedClassNames, options } = getExpectedClassNamesAndOptions(params)

  const received = splitClassNames(htmlElement.getAttribute('class'))
  const expected = expectedClassNames.reduce(
    (acc, className) => {
      return acc.concat(
        typeof className === 'string' || !className
          ? splitClassNames(className)
          : className,
      )
    },
    [] as (string | RegExp)[],
  )

  const hasRegExp = expected.some(className => className instanceof RegExp)
  if (options.exact && hasRegExp) {
    throw new Error('Exact option does not support RegExp expected class names')
  }

  if (options.exact) {
    return {
      pass: isSubset(expected, received) && expected.length === received.length,
      message: () => {
        const to = this.isNot ? 'not to' : 'to'
        return getMessage(
          this,
          this.utils.matcherHint(
            `${this.isNot ? '.not' : ''}.toHaveClass`,
            'element',
            this.utils.printExpected(expected.join(' ')),
          ),
          `Expected the element ${to} have EXACTLY defined classes`,
          expected.join(' '),
          'Received',
          received.join(' '),
        )
      },
    }
  }

  return expected.length > 0
    ? {
        pass: isSubset(expected, received),
        message: () => {
          const to = this.isNot ? 'not to' : 'to'
          return getMessage(
            this,
            this.utils.matcherHint(
              `${this.isNot ? '.not' : ''}.toHaveClass`,
              'element',
              this.utils.printExpected(expected.join(' ')),
            ),
            `Expected the element ${to} have class`,
            expected.join(' '),
            'Received',
            received.join(' '),
          )
        },
      }
    : {
        pass: this.isNot ? received.length > 0 : false,
        message: () =>
          this.isNot
            ? getMessage(
                this,
                this.utils.matcherHint('.not.toHaveClass', 'element', ''),
                'Expected the element to have classes',
                '(none)',
                'Received',
                received.join(' '),
              )
            : [
                this.utils.matcherHint(`.toHaveClass`, 'element'),
                'At least one expected class must be provided.',
              ].join('\n'),
      }
}

function getExpectedClassNamesAndOptions(
  params: (string | RegExp)[] | [string, options?: { exact: boolean }],
): {
  expectedClassNames: (string | RegExp)[]
  options: { exact: boolean }
} {
  const lastParam = params.pop()
  let expectedClassNames, options

  if (typeof lastParam === 'object' && !(lastParam instanceof RegExp)) {
    expectedClassNames = params
    options = lastParam
  }
  else {
    expectedClassNames = params.concat(lastParam)
    options = { exact: false }
  }
  return { expectedClassNames: expectedClassNames as string[], options }
}

function splitClassNames(str: string | undefined | null): string[] {
  if (!str) {
    return []
  }
  return str.split(/\s+/).filter(s => s.length > 0)
}

function isSubset(subset: (string | RegExp)[], superset: string[]) {
  return subset.every(strOrRegexp =>
    typeof strOrRegexp === 'string'
      ? superset.includes(strOrRegexp)
      : superset.some(className => strOrRegexp.test(className)),
  )
}
