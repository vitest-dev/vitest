import { expect, test, vi } from 'vitest'
import { server } from 'vitest/browser'
import { calculator } from './src/mocks_factory'

vi.mock(import('./src/mocks_factory'), () => ({
  calculator: () => 42,
  mocked: true,
}))

test.runIf(server.config.name === 'chromium')('request interception is live once a mock is registered', async () => {
  expect(calculator('plus', 1, 2)).toBe(42)

  const response = await fetch('/__vitest_interception_probe__', { cache: 'no-store' })
  expect(response.status).toBe(204)
  expect(response.headers.get('x-vitest-probe')).toMatch(/^[0-9a-f-]{36}$/)
})
