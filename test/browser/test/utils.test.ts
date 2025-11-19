import { afterEach, expect, it, test } from 'vitest'
import { commands, utils } from 'vitest/browser'

import { inspect } from 'vitest/internal/browser'

afterEach(() => {
  document.body.innerHTML = ''
})

it('utils package correctly uses loupe', async () => {
  expect(inspect({ test: 1 })).toBe('{ test: 1 }')
})

test('prints default document', async () => {
  expect(await commands.stripVTControlCharacters(utils.prettyDOM())).toMatchSnapshot()

  const div = document.createElement('div')
  div.innerHTML = '<span>hello</span>'
  document.body.append(div)

  expect(await commands.stripVTControlCharacters(utils.prettyDOM())).toMatchSnapshot()
})

test('prints the element', async () => {
  const div = document.createElement('div')
  div.innerHTML = '<span>hello</span>'
  document.body.append(div)

  expect(await commands.stripVTControlCharacters(utils.prettyDOM())).toMatchSnapshot()
})

test('prints the element with attributes', async () => {
  const div = document.createElement('div')
  div.innerHTML = '<span class="some-name" data-test-id="33" id="5">hello</span>'
  document.body.append(div)

  expect(await commands.stripVTControlCharacters(utils.prettyDOM())).toMatchSnapshot()
})

test('should handle DOM content bigger than maxLength', async () => {
  const depth = 100
  const maxContent = 150

  const openingTags = '<div>'.repeat(depth)
  const closingTags = '</div>'.repeat(depth)
  const domString = `${openingTags}${closingTags}`

  const parentDiv = document.createElement('div')
  parentDiv.innerHTML = domString

  document.body.appendChild(parentDiv)
  expect(await commands.stripVTControlCharacters(utils.prettyDOM(undefined, maxContent))).toMatchSnapshot()
})

test('should handle shadow DOM content', async () => {
  class CustomElement extends HTMLElement {
    connectedCallback() {
      const shadowRoot = this.attachShadow({ mode: 'open' })
      const span = document.createElement('span')
      span.classList.add('some-name')
      span.setAttribute('data-test-id', '33')
      span.setAttribute('id', '5')
      span.textContent = 'hello'
      shadowRoot.appendChild(span)
    }
  }
  customElements.define('custom-element', CustomElement)

  const div = document.createElement('div')
  div.innerHTML = '<custom-element></custom-element>'
  document.body.append(div)

  expect(await commands.stripVTControlCharacters(utils.prettyDOM())).toMatchSnapshot()
})

test('should be able to opt out of shadow DOM content', async () => {
  class CustomElement extends HTMLElement {
    connectedCallback() {
      const shadowRoot = this.attachShadow({ mode: 'open' })
      const span = document.createElement('span')
      span.classList.add('some-name')
      span.setAttribute('data-test-id', '33')
      span.setAttribute('id', '5')
      span.textContent = 'hello'
      shadowRoot.appendChild(span)
    }
  }
  customElements.define('no-shadow-root', CustomElement)

  const div = document.createElement('div')
  div.innerHTML = '<no-shadow-root></no-shadow-root>'
  document.body.append(div)

  expect(await commands.stripVTControlCharacters(utils.prettyDOM(undefined, undefined, { printShadowRoot: false }))).toMatchSnapshot()
})
