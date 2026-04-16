import { beforeEach, test } from 'vitest'
import { page } from 'vitest/browser'

beforeEach(() => {
  document.body.innerHTML = ''
})

// With traceView.inlineImages enabled, this is self-contained in the HTML reporter.
test('same-origin image is inlined for offline replay', async () => {
  document.body.innerHTML = '<img src="/assets/trace-pixel.svg" alt="local trace asset" width="24" height="24">'
  await document.querySelector<HTMLImageElement>('img')!.decode()
  await page.getByAltText('local trace asset').mark('image rendered from same-origin url')
})

// TODO(test): replace this live URL with deterministic CORS and non-CORS cross-origin fixtures.
// This renders because the browser can load the external image, but rrweb cannot inline it without CORS-readable pixels.
test('external image remains url dependent', async () => {
  document.body.innerHTML = '<img src="https://vitest.dev/logo.svg" alt="external trace asset" width="24" height="24">'
  await document.querySelector<HTMLImageElement>('img')!.decode()
  await page.getByAltText('external trace asset').mark('image rendered from external url')
})
