import { page, server } from '@vitest/browser/context'
import { index } from '@vitest/bundled-lib'
import { describe, expect, it } from 'vitest'
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

describe.runIf(server.provider === 'playwright')('timeouts are failing correctly', () => {
  it('click on non-existing element fails', async () => {
    await new Promise(r => setTimeout(r, 100))
    await page.getByRole('code').click()
  }, 1000)

  it('expect.element on non-existing element fails', async () => {
    await expect.element(page.getByRole('code')).toBeVisible()
  }, 1000)
})

it('correctly prints error from a bundled file', () => {
  index()
})
