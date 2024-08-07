import { inspect } from 'vitest/utils'
import { afterEach, expect, it, test } from 'vitest'
import stripAnsi from 'strip-ansi'

import { prettyDOM } from '@vitest/browser/utils'

afterEach(() => {
  document.body.innerHTML = ''
})

it('utils package correctly uses loupe', async () => {
  expect(inspect({ test: 1 })).toBe('{ test: 1 }')
})

test('prints default document', () => {
  expect(prettyDOM()).toMatchSnapshot()

  const div = document.createElement('div')
  div.innerHTML = '<span>hello</span>'
  document.body.append(div)

  expect(stripAnsi(prettyDOM())).toMatchSnapshot()
})

test('prints the element', () => {
  const div = document.createElement('div')
  div.innerHTML = '<span>hello</span>'
  document.body.append(div)

  expect(stripAnsi(prettyDOM())).toMatchSnapshot()
})

test('prints the element with attributes', () => {
  const div = document.createElement('div')
  div.innerHTML = '<span class="some-name" data-test-id="33" id="5">hello</span>'
  document.body.append(div)

  expect(stripAnsi(prettyDOM())).toMatchSnapshot()
})
