import { page, userEvent } from 'vitest/browser'
import { index } from '@vitest/bundled-lib'
import { expect, it } from 'vitest'
import { throwError } from './src/error'

document.body.innerHTML = `
  <button>Click me!</button>
`

it('correctly fails and prints a diff', () => {
  expect(1).toBe(2)
})

it('correctly print error in another file', () => {
  throwError()
})

it('several locator methods are not awaited', () => {
  page.getByRole('button').dblClick()
  page.getByRole('button').click()
  page.getByRole('button').tripleClick()
  userEvent.type(page.getByRole('textbox'), '123')
  userEvent.keyboard('123')
  userEvent.copy()
  userEvent.cut()
  userEvent.paste()
  userEvent.tab()
  userEvent.dragAndDrop(page.getByRole('button'), page.getByRole('button'))
  userEvent.fill(page.getByRole('textbox'), '123')
  userEvent.upload(page.getByRole('textbox'), './file.js')
  userEvent.unhover(page.getByRole('button'))
  userEvent.hover(page.getByRole('button'))
  userEvent.clear(page.getByRole('button'))
  userEvent.selectOptions(page.getByRole('button'), '123')
  userEvent.wheel(page.getByRole('button'), { direction: 'down' })
})

it('correctly prints error from a bundled file', () => {
  index()
})
