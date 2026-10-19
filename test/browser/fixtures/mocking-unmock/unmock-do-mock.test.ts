import { expect, test, vi } from 'vitest'

vi.unmock('./src/setup-factory')

test('vi.doMock applies after vi.unmock', async () => {
  vi.doMock('./src/setup-factory', () => ({ source: () => 'do mock' }))

  const { source } = await import('./src/setup-factory')
  expect(source()).toBe('do mock')
})
