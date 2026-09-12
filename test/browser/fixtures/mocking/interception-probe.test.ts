import { expect, test, vi } from 'vitest'
import { server } from 'vitest/browser'

vi.mock(import('./src/mocks_factory'))

test.runIf(server.config.name === 'chromium')('request interception is live once a mock is registered', async () => {
  const response = await fetch('/__vitest_interception_probe__', { cache: 'no-store' })
  expect(response.headers.get('x-vitest-probe')).toBe('1')
})
