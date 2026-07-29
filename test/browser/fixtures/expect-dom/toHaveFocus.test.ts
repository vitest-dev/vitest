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