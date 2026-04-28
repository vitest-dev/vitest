import { expect, it, vi } from 'vitest'

vi.stubGlobal('process', { badMock: true })

it('should not hang', () => {
  expect(1).toBe(1)
})

it('should not crash (#9173)', async () => {
  await import('./fixtures/increment')
})
