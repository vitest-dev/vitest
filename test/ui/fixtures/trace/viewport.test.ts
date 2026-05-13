import { test } from 'vitest'
import { page } from 'vitest/browser'

test('viewport', async () => {
  const [width, height] = [500, 300]
  await page.viewport(width, height)
  document.body.innerHTML = `
<style>
  html,
  body {
    margin: 0;
    height: 100vh;
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
