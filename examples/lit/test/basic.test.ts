import { page } from '@vitest/browser/context'
import { beforeEach, describe, expect, it } from 'vitest'

import '../src/my-button.js'

// TODO: wait until rolldown has https://github.com/oxc-project/oxc/issues/9129
describe.skip('Button with increment', async () => {
  beforeEach(() => {
    document.body.innerHTML = '<my-button name="World"></my-button>'
  })

  it('should increment the count on each click', async () => {
    await page.getByRole('button').click()

    await expect.element(page.getByRole('button')).toHaveTextContent('2')
  })

  it('should show name props', async () => {
    await expect.element(page.getByRole('heading')).toHaveTextContent('World')
  })
})
