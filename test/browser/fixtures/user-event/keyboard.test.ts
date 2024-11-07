import { expect, test } from 'vitest'
import { userEvent, page } from '@vitest/browser/context'

test('non US keys', async () => {
  document.body.innerHTML = `
    <input placeholder="#7396" />
    <input placeholder="emoji" />
  `;
  await userEvent.type(page.getByPlaceholder("#7396"), 'éèù')
  // TODO: surrogate pair doesn't work since `parseKeyDef` doesn't support it.
  await userEvent.type(page.getByPlaceholder("emoji"), '😊')

  expect.element(page.getByPlaceholder("#7396")).toHaveValue('éèù')
  expect.element(page.getByPlaceholder("emoji")).not.toHaveValue('😊')
})
