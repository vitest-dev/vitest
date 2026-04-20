import { test } from 'vitest'
import { page } from 'vitest/browser'

// tests for full snaphsot/replay integration.
// partly extracted from artifact metadata tests in
// test/browser/fixtures/trace/*.test.ts

// TODO
// - css link stylesheet
// - image

test('simple', async () => {
  document.body.innerHTML = '<button>Simple</button>'
  await page.getByRole('button').mark('Render simple')
})

test('viewport', async () => {
  const [width, height] = [500, 300]
  await page.viewport(width, height)
  document.body.innerHTML = `
<style>
  html,
  body {
    margin: 0;
    min-height: 100vh;
    margin: 0;
    background: linear-gradient(-45deg, blue, orange);
  }

  .viewport-pass {
    display: none;
  }

  .viewport-fail {
    display: block;
  }

  @media (width: ${width}px) and (height: ${height}px) {
    .viewport-pass {
      display: block;
    }

    .viewport-fail {
      display: none;
    }
  }
</style>
<div class="viewport-pass">
  PASS: Viewport is ${width}x${height}
</div>
<div class="viewport-fail">
  FAIL: Viewport is not ${width}x${height}
</div>
`
  await page.mark('Render viewport')
})

test('pseudo-state', async () => {
  document.body.innerHTML = `
<style>
.trace-pseudo-hover,
.trace-pseudo-focus,
.trace-pseudo-within {
  background: rgb(255, 200, 200);
  display: block;
  margin: 8px;
  padding: 8px;
}
.trace-pseudo-hover:hover {
  background: rgb(253, 224, 71);
}
.trace-pseudo-focus:focus {
  background: rgb(253, 224, 71);
}
.trace-pseudo-within:focus-within {
  background: rgb(253, 224, 71);
}
.trace-pseudo-within input {
  display: block;
}
</style>
<button class="trace-pseudo-hover">First pseudo state</button>
<button class="trace-pseudo-hover">Second pseudo state</button>
<input class="trace-pseudo-focus" aria-label="Focused pseudo state" value="Focused pseudo state">
<label class="trace-pseudo-within">
  Focus within target
  <input aria-label="Focus within pseudo state" value="Focus within pseudo state">
</label>
`
  await page.getByRole('button', { name: 'First pseudo state' }).hover()
  await page.getByRole('button', { name: 'Second pseudo state' }).click()
  await page.getByRole('textbox', { name: 'Focused pseudo state' }).click()
  await page.getByRole('textbox', { name: 'Focused pseudo state' }).fill('Test focus')
  await page.getByRole('textbox', { name: 'Focus within pseudo state' }).fill('Test focus within')
})
