import { beforeEach, test } from 'vitest'
import { page } from 'vitest/browser'

beforeEach(() => {
  document.body.innerHTML = ''
})

// TODO: capture or attach same-origin image bytes so replay does not depend on the original URL.
test('same-origin image remains url dependent', async () => {
  document.body.innerHTML = '<img src="/assets/trace-pixel.svg" alt="local trace asset" width="24" height="24">'
  await page.getByAltText('local trace asset').mark('image rendered from same-origin url')
})

// TODO(test): replace this live external URL with a deterministic loaded cross-origin fixture.
test('external image remains url dependent', async () => {
  document.body.innerHTML = '<img src="https://vitest.dev/logo.svg" alt="external trace asset" width="24" height="24">'
  await page.getByAltText('external trace asset').mark('image rendered from external url')
})
