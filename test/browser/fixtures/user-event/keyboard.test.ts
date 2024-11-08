import { expect, test } from 'vitest'
import { userEvent, page, server } from '@vitest/browser/context'

test('non US keys', async () => {
  document.body.innerHTML = `
    <input placeholder="#7396" />
    <input placeholder="emoji" />
  `;
  await userEvent.type(page.getByPlaceholder("#7396"), 'éèù')
  await expect.element(page.getByPlaceholder("#7396")).toHaveValue('éèù')

  if (server.provider !== 'webdriverio') {
    await userEvent.type(page.getByPlaceholder("emoji"), '😊')
    await expect.element(page.getByPlaceholder("emoji")).toHaveValue('😊')
  }
})
