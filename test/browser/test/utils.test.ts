import { commands } from '@vitest/browser/context'
import { prettyDOM } from '@vitest/browser/utils'
import { afterEach, expect, it, test } from 'vitest'

import { inspect } from 'vitest/utils'

afterEach(() => {
  document.body.innerHTML = ''
})

it('utils package correctly uses loupe', async () => {
  expect(inspect({ test: 1 })).toBe('{ test: 1 }')
})

test('prints default document', async () => {
  expect(await commands.stripVTControlCharacters(prettyDOM())).toMatchSnapshot()

  const div = document.createElement('div')
  div.innerHTML = '<span>hello</span>'
  document.body.append(div)

  expect(await commands.stripVTControlCharacters(prettyDOM())).toMatchSnapshot()
})

test('prints the element', async () => {
  const div = document.createElement('div')
  div.innerHTML = '<span>hello</span>'
  document.body.append(div)

  expect(await commands.stripVTControlCharacters(prettyDOM())).toMatchSnapshot()
})

test('prints the element with attributes', async () => {
  const div = document.createElement('div')
  div.innerHTML = '<span class="some-name" data-test-id="33" id="5">hello</span>'
  document.body.append(div)

  expect(await commands.stripVTControlCharacters(prettyDOM())).toMatchSnapshot()
})
