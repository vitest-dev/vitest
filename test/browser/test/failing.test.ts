import { page } from '@vitest/browser/context'
import { expect, it } from 'vitest'
import { throwError } from '../src/error'

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
})
