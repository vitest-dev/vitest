import { expect, test } from 'vitest'
import { userEvent, page, server } from '@vitest/browser/context'

test('non US keys', async () => {
  document.body.innerHTML = `
    <input placeholder="type-#7396" />
    <input placeholder="fill-#7396" />
    <input placeholder="type-emoji" />
    <input placeholder="fill-emoji" />
  `;

  await userEvent.type(page.getByPlaceholder("type-#7396"), 'éèù')
  await expect.element(page.getByPlaceholder("type-#7396")).toHaveValue('éèù')
  await userEvent.fill(page.getByPlaceholder("fill-#7396"), 'éèù')
  await expect.element(page.getByPlaceholder("fill-#7396")).toHaveValue('éèù')

  // playwright: garbled characters
  // webdriverio: error: invalid argument: missing command parameters
  // preview: ok
  try {
    await userEvent.type(page.getByPlaceholder("type-emoji"), '😊😍')
    await expect.element(page.getByPlaceholder("type-emoji")).toHaveValue('😊😍')
  } catch (e) {
    console.error(e)
  }

  // playwright: ok
  // webdriverio: error: ChromeDriver only supports characters in the BMP
  // preview: ok
  try {
    await userEvent.fill(page.getByPlaceholder("fill-emoji"), '😊😍')
    await expect.element(page.getByPlaceholder("fill-emoji")).toHaveValue('😊😍')
  } catch (e) {
    console.error(e)
  }
})
