import { beforeEach, describe, expect, it } from 'vitest'
import { commands, page } from 'vitest/browser'

import '../src/my-button.js'

describe('Button with increment', async () => {
  beforeEach(async (ctx) => {
    document.body.innerHTML = '<my-button name="World"></my-button>'
    await commands.markTrace('beforeEach / render')
    ctx.onTestFinished(async (ctx) => {
      await commands.markTrace(`onTestFinished / ${ctx.task.result.state}`)
    })
  })

  it('should increment the count on each click', async () => {
    await page.getByRole('button').click()

    await expect.element(page.getByRole('button')).toHaveTextContent('2')
  })

  it('should show name props', async () => {
    await expect.element(page.getByRole('heading')).toHaveTextContent('World')
  })
})
