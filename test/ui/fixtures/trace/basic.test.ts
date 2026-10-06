import { expect, onTestFinished, test } from 'vitest'
import { commands, page } from 'vitest/browser'

// tests for full snapshot/replay integration.
// partly extracted from artifact metadata tests in
// test/browser/fixtures/trace/*.test.ts

test('simple', async () => {
  document.body.innerHTML = '<button>Simple</button>'
  await page.getByRole('button').mark('Render simple')

  document.body.innerHTML = '<button>Another</button>'
  await page.getByRole('button').mark('Render another')
})

test('switch-target', async () => {
  document.body.innerHTML = '<button>Switch Target</button>'
  await page.getByRole('button').mark('Render switch target')
})

test('multiple-match', async () => {
  document.body.innerHTML = '<button>One</button><button>Two</button><button>Three</button>'
  await page.getByRole('button').mark('Render multiple')
})

test('popover', async () => {
  document.body.innerHTML = '<div popover="auto" style="inset: auto; top: 0; left: 0; margin: 0">Popover content</div>'
  const popover = document.querySelector<HTMLElement>('[popover]')!
  const popoverContent = page.getByText('Popover content')
  await popoverContent.mark('Render closed popover')
  popover.showPopover()
  await popoverContent.mark('Render open popover')
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

test('zoom', async () => {
  await page.viewport(400, 600)
  document.body.innerHTML = `
<style>
  html,
  body {
    margin: 0;
    height: 100vh;
  }

  body {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    border: 4px solid tomato;
    background-color: lightskyblue;
    background-image:
      linear-gradient(to right, rgb(0 0 0 / 0.15) 1px, transparent 1px),
      linear-gradient(to bottom, rgb(0 0 0 / 0.15) 1px, transparent 1px);
    background-size: 50px 50px;
    font-family: monospace;
  }

  .corner {
    position: fixed;
    padding: 6px 8px;
  }
</style>
<span class="corner" style="top: 0; left: 0">0,0</span>
<span class="corner" style="right: 0; bottom: 0">400,600</span>
<button>One</button>
<button>Two</button>
<button>Three</button>
`
  await page.mark('Render zoom')
})
