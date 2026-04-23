import { expect, onTestFinished, test } from 'vitest'
import { commands, page } from 'vitest/browser'

// tests for full snaphsot/replay integration.
// partly extracted from artifact metadata tests in
// test/browser/fixtures/trace/*.test.ts

test('simple', async () => {
  document.body.innerHTML = '<button>Simple</button>'
  await page.getByRole('button').mark('Render simple')
})

test('pseudo-state', async () => {
  document.body.innerHTML = `
<style>
.test-target {
  background: rgb(255, 200, 200);
}
.test-hover:hover,
.test-focus:focus,
.test-focus-within:focus-within,
.test-active:active,
.test-focus-visible:focus-visible,
.test-none
{
  background: rgb(253, 224, 71);
}
</style>
<button class="test-target test-hover">Test hover 1</button>
<hr />
<button class="test-target test-hover">Test hover 2</button>
<hr />
<label style="display: block; padding: 8px;">
  Test focus
  <input class="test-target test-focus" placeholder="focus-placeholder">
</label>
<hr />
<label class="test-target test-focus-within" style="display: block; padding: 8px;">
  Test focus-within
  <input placeholder="focus-within-placeholder">
</label>
<hr />
<button class="test-target test-active">Test active</button>
<hr />
<label style="display: block; padding: 8px;">
  Test focus-visible
  <input class="test-target test-focus-visible" placeholder="focus-visible-placeholder">
</label>
`
  await page.getByRole('button', { name: 'Test hover 1' }).hover()
  await page.getByRole('button', { name: 'Test hover 2' }).click()
  await page.getByPlaceholder('focus-placeholder').click()
  await page.getByPlaceholder('focus-placeholder').fill('focus-done')
  await page.getByPlaceholder('focus-within-placeholder').fill('focus-within-done')
  await (commands as any).mousedown('.test-active')
  await page.getByRole('button', { name: 'Test active' }).mark('Test active')
  await page.getByPlaceholder('focus-visible-placeholder').fill('focus-visible-done')
})

test('css-link', async () => {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = '/assets/trace-style.css'
  document.head.append(link)
  onTestFinished(() => {
    link.remove()
  })
  document.body.innerHTML = '<button class="trace-linked-css">Linked CSS</button>'
  await expect.element(page.getByRole('button', { name: 'Linked CSS' }))
    .toHaveStyle({ color: 'rgb(50, 100, 255)' })
})

test('image', async () => {
  document.body.innerHTML = '<img src="/assets/trace-pixel.svg" alt="local trace asset" width="24" height="24">'
  await expect.element(page.getByAltText('local trace asset'))
    .not
    .toHaveProperty('naturalWidth', 0)
  await page.getByAltText('local trace asset').mark('Render image')
})
