import { page } from '@vitest/browser/context'
import { expect, it } from 'vitest'
import { throwError } from '../src/error'

it('correctly fails and prints a diff', () => {
  expect(1).toBe(2)
})

it('correctly print error in another file', () => {
  throwError()
})

it('locator method is not awaited', () => {
  page.getByRole('button').click()
})

it('several locator methods are not awaited', async () => {
  page.getByRole('button').dblClick()
  page.getByRole('button').selectOptions([])
  page.getByRole('button').fill('123')
})
