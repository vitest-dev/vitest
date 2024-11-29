import { page } from '@vitest/browser/context';
import { afterEach, expect, test } from 'vitest';

afterEach(() => {
  document.body.innerHTML = ''
})

test('click', async () => {
  document.body.innerHTML = '<div><span>hello</span></div>'
  await page.getByText('world').click()
})

test('element', async () => {
  document.body.innerHTML = '<div><span>hello</span></div>'
  await expect.element(page.getByText('world')).toBeVisible()
})
