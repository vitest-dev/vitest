import { beforeEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import '../src/my-button.js'

describe('Button with increment', async () => {
  beforeEach(async () => {
    document.body.innerHTML = '<my-button name="World"></my-button>'
    await page.getByRole('button').markTrace({ name: 'render' })
    await page.getByRole('heading').markTrace({ name: 'heading' })
  })

  it('should increment the count on each click', async () => {
    await page.markTrace({ name: 'test-start' })
    await page.getByRole('button').click()

    await expect.element(page.getByRole('button')).toHaveTextContent('2')
    if (import.meta.env.VITE_FAIL_TEST) {
      await expect.element(page.getByRole('button'), { timeout: 3000 }).toHaveTextContent('3')
    }
  })

  it('should show name props', async () => {
    await expect.element(page.getByRole('heading')).toHaveTextContent('World')
  })
})
