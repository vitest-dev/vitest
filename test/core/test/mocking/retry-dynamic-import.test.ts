import { describe, expect, it, vi } from 'vitest'
import { retryDynamicImport } from '../../src/mocks/retry-dynamic-import.js'

vi.mock('../../src/mocks/dynamic-module', () => {
  return { foo: 'bar' }
})

describe('retry-dynamic-import', () => {
  it('should dynamic import module success', async () => {
    expect(await retryDynamicImport()).toEqual({ foo: 'bar' })
  })
  it('should throw when retry over 3 times', async () => {
    vi.doMock('../../src/mocks/dynamic-module', () => {
      throw new Error('foobar')
    })
    await expect(retryDynamicImport()).rejects.toThrowError(new Error('import dynamic module failed.'))
  })
})
