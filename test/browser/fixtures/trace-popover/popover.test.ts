import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('captures an open popover', async () => {
  document.body.innerHTML = '<div popover="auto">Popover content</div>'
  const popover = document.querySelector<HTMLElement>('[popover]')!
  popover.showPopover()

  await expect.element(page.getByText('Popover content')).toBeVisible()
  await page.mark('popover is open')
})
