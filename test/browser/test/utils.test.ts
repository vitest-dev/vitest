import { afterEach, beforeEach, expect, it, test } from 'vitest'
import { commands, utils } from 'vitest/browser'

import { inspect } from 'vitest/internal/browser'

afterEach(() => {
  document.body.innerHTML = ''
})

beforeEach(() => {
  utils.configurePrettyDOM({})
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

test('changing the defaults works', async () => {
  utils.configurePrettyDOM({
    maxDepth: 1,
  })

  const div = document.createElement('div')
  div.innerHTML = '<div><div><div><div></div></div></div></div>'
  document.body.append(div)

  expect(await commands.stripVTControlCharacters(utils.prettyDOM(div))).toMatchInlineSnapshot(`
    "<div>
      <div … />
    </div>"
  `)
})

test('filterNode option filters out matching elements', async () => {
  const div = document.createElement('div')
  div.innerHTML = `
    <div>
      <script>console.log('test')</script>
      <style>.test { color: red; }</style>
      <span data-test-hide="true">hidden content</span>
      <span>visible content</span>
    </div>
  `
  document.body.append(div)

  const result = await commands.stripVTControlCharacters(utils.prettyDOM(div, undefined, { filterNode: 'script, style, [data-test-hide]' }))

  expect(result).not.toContain('console.log')
  expect(result).not.toContain('color: red')
  expect(result).not.toContain('hidden content')
  expect(result).toContain('visible content')
  expect(result).toMatchInlineSnapshot(`
    "<div>
      <div>
        <span>
          visible content
        </span>
      </div>
    </div>"
  `)
})

test('filterNode with configurePrettyDOM affects default behavior', async () => {
  utils.configurePrettyDOM({ filterNode: 'script, style, [data-test-hide]' })

  const div = document.createElement('div')
  div.innerHTML = `
    <div>
      <script>console.log('test')</script>
      <style>.test { color: red; }</style>
      <span data-test-hide="true">hidden content</span>
      <span>visible content</span>
    </div>
  `
  document.body.append(div)

  const result = await commands.stripVTControlCharacters(utils.prettyDOM(div))

  expect(result).not.toContain('console.log')
  expect(result).not.toContain('color: red')
  expect(result).not.toContain('hidden content')
  expect(result).toContain('visible content')
  expect(result).toMatchInlineSnapshot(`
    "<div>
      <div>
        <span>
          visible content
        </span>
      </div>
    </div>"
  `)
})

test('filterNode with wildcard selector filters nested content', async () => {
  const div = document.createElement('div')
  div.innerHTML = `
    <div>
      <div data-test-hide-content>
        <span>nested hidden</span>
        <div>deeply nested hidden</div>
      </div>
      <span>visible</span>
    </div>
  `
  document.body.append(div)

  const result = await commands.stripVTControlCharacters(utils.prettyDOM(div, undefined, { filterNode: '[data-test-hide-content] *' }))

  expect(result).not.toContain('nested hidden')
  expect(result).not.toContain('deeply nested hidden')
  expect(result).toContain('visible')
  expect(result).toContain('data-test-hide-content')
  expect(result).toMatchInlineSnapshot(`
    "<div>
      <div>
        <div
          data-test-hide-content=\"\"
        />
        <span>
          visible
        </span>
      </div>
    </div>"
  `)
})
