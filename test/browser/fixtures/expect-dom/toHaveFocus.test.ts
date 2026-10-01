import { expect, test } from 'vitest'
import { render } from './utils'

test('.toHaveFocus', () => {
  const {container} = render(`
      <div>
        <label for="focused">test</label>
        <input id="focused" type="text" />
        <button type="submit" id="not-focused">Not Focused</button>
      </div>`)

  const focused = container.querySelector('#focused') as HTMLInputElement
  const notFocused = container.querySelector('#not-focused')

  document.body.appendChild(container)
  focused.focus()

  expect(focused).toHaveFocus()
  expect(notFocused).not.toHaveFocus()

  expect(() => expect(focused).not.toHaveFocus()).toThrow()
  expect(() => expect(notFocused).toHaveFocus()).toThrow()
})

test('.toHaveFocus within nested shadow roots', () => {
  const outerHost = document.createElement('div')
  const outerRoot = outerHost.attachShadow({ mode: 'open' })
  const innerHost = document.createElement('div')
  const innerRoot = innerHost.attachShadow({ mode: 'open' })
  const focused = document.createElement('input')
  const notFocused = document.createElement('button')

  innerRoot.append(focused, notFocused)
  outerRoot.appendChild(innerHost)
  document.body.appendChild(outerHost)
  focused.focus()

  expect(focused).toHaveFocus()
  expect(notFocused).not.toHaveFocus()

  expect(() => expect(focused).not.toHaveFocus()).toThrow()
  expect(() => expect(notFocused).toHaveFocus()).toThrow()
})

test('.toHaveFocus within an iframe shadow root', () => {
  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)

  const iframeDocument = iframe.contentDocument!
  const host = iframeDocument.createElement('div')
  const root = host.attachShadow({ mode: 'open' })
  const focused = iframeDocument.createElement('input')
  const notFocused = iframeDocument.createElement('button')

  root.append(focused, notFocused)
  iframeDocument.body.appendChild(host)
  focused.focus()

  expect(focused).toHaveFocus()
  expect(notFocused).not.toHaveFocus()

  expect(() => expect(focused).not.toHaveFocus()).toThrow()
  expect(() => expect(notFocused).toHaveFocus()).toThrow()
})
