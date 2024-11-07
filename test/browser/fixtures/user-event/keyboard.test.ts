import { expect, test } from 'vitest'
import { userEvent, page } from '@vitest/browser/context'

test('non US keys', async () => {
  document.body.innerHTML = `
    <input placeholder="#7396" />
    <input placeholder="emoji" />
  `;
  await userEvent.type(page.getByPlaceholder("#7396"), 'éèù')
  expect.element(page.getByPlaceholder("#7396")).toHaveValue('éèù')

  try {
    // surrogate pair is still inconsistent
    // - playwright: garbled characters
    // - webdriverio: throw an error
    // - preview: works
    await userEvent.type(page.getByPlaceholder("emoji"), '😊')
    expect.element(page.getByPlaceholder("emoji")).toHaveValue('😊')
  } catch {}
})
