import { expect, test } from '@playwright/test'

test.describe('Home key in contenteditable after Enter split', () => {
  test('moves caret in a top-level contenteditable', async ({ page }) => {
    await page.setContent('<main></main>')

    await page.evaluate(() => {
      const editor = document.createElement('div')
      editor.contentEditable = 'true'
      editor.innerHTML = '<p>hello world</p>'
      document.querySelector('main')!.appendChild(editor)
    })

    await page.getByText('hello world').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await page.getByText('hello world').click()

    await page.evaluate(() => {
      const sel = document.getSelection()!
      sel.setBaseAndExtent(sel.anchorNode!, 3, sel.anchorNode!, 3)
    })

    await page.keyboard.press('Home')

    await expect.poll(() => page.evaluate(() => document.getSelection()!.anchorOffset)).toBe(0)
  })

  test('moves caret in an iframe contenteditable', async ({ page }) => {
    await page.setContent('<iframe name="vitest-iframe" srcdoc="<main></main>"></iframe>')

    const frame = page.frame({ name: 'vitest-iframe' })
    if (!frame) {
      throw new Error('Cannot find test iframe')
    }

    await frame.evaluate(() => {
      const editor = document.createElement('div')
      editor.contentEditable = 'true'
      editor.innerHTML = '<p>hello world</p>'
      document.querySelector('main')!.appendChild(editor)
    })

    await frame.getByText('hello world').click()
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await frame.getByText('hello world').click()

    await frame.evaluate(() => {
      const sel = document.getSelection()!
      sel.setBaseAndExtent(sel.anchorNode!, 3, sel.anchorNode!, 3)
    })

    await page.keyboard.press('Home')

    await expect.poll(() => frame.evaluate(() => document.getSelection()!.anchorOffset)).toBe(0)
  })
})
