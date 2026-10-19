import { expect, test, vi } from 'vitest'

test('vi.doUnmock restores modules mocked in the setup file', async () => {
  vi.doUnmock('./src/setup-automock')
  vi.doUnmock('./src/setup-factory')

  const { source: automocked } = await import('./src/setup-automock')
  const { source: factory } = await import('./src/setup-factory')
  expect(automocked()).toBe('original')
  expect(factory()).toBe('original')
})
