import { expect, it } from 'vitest'

declare global {
  const testValue: string
}

it('the same file works with different projects', () => {
  expect(testValue).toBe(expect.getState().environment === 'node' ? 'node' : 'jsdom')
})
