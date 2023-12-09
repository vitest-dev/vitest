import { expect, it } from 'vitest'

// users can achive cross-origin isolation via custom plugin (see "coop-coep-header-middleware-plugin")
// https://developer.mozilla.org/en-US/docs/Web/API/crossOriginIsolated
it('crossOriginIsolated', () => {
  expect(crossOriginIsolated).toBe(true)
})
