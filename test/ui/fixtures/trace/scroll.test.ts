import { test } from 'vitest'
import { page } from 'vitest/browser'

test('scroll', async () => {
  const [width, height] = [300, 300]
  await page.viewport(width, height)
  document.body.innerHTML = `
<style>
  html,
  body {
    margin: 0;
    height: 100vh;
    width: 100vw;
    background: linear-gradient(-45deg, purple, yellow);
  }
  .marker {
    position: absolute;
    width: 100px;
    background: white;
    border: 1px solid black;
    text-align: center;
  }
</style>
<main style="height: 600px; width: 600px;">
  <div class="marker" style="top: 0; left: 0;">(0, 0)</div>
  <div class="marker" style="top: 0; left: 300px;">(300, 0)</div>
  <div class="marker" style="top: 300px; left: 0;">(0, 300)</div>
  <div class="marker" style="top: 300px; left: 300px;">(300, 300)</div>
</main>
`
  // scroll to make (300, 300) visible and (0, 0) not visible
  window.scrollTo(250, 200)
  await page.getByRole('button').mark('Render scroll')
})
