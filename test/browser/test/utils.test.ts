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

test('should handle large nested DOM', async () => {
  const depth = 20000;

  // if we try to manipulate dom to add 20000 divs, we get 
  // max depth exceeded error
  const openingTags = "<div>".repeat(depth);
  const closingTags = "</div>".repeat(depth);
  const domString = `${openingTags}${closingTags}`;

  const parentDiv = document.createElement("div");
  parentDiv.innerHTML = domString;

  document.body.appendChild(parentDiv);
  expect(await commands.stripVTControlCharacters(prettyDOM())).toMatchSnapshot()
});
