import { describe, expect, test } from 'vitest'

describe('importmap injected', () => {
  // importmap is set in ../vitest.config.mts
  test('resolve resource', async () => {
    const s = import.meta.resolve('embed-lib')
    await expect(s).to.include('embed-lib.html')
  })

  test('resolve resource', async () => {
    const s = import.meta.resolve('lib-root/test.js')
    await expect(s).to.include('/demo/lib-dir/test.js')
  })
})
