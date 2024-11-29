import { page } from '@vitest/browser/context';
import { afterEach, expect, test } from 'vitest';

afterEach(() => {
  document.body.innerHTML = ''
})

test('click default', async () => {
  document.body.innerHTML = '<div><span>hello</span></div>'
  await page.getByText('world').click()
})

test('click override', async () => {
  document.body.innerHTML = '<div><span>hello</span></div>'
  await page.getByText('world').click({ timeout: 345 })
})

test('element', async () => {
  document.body.innerHTML = '<div><span>hello</span></div>'
  await expect.element(page.getByText('world')).toBeVisible()
})
