import { expect, test } from 'vitest'
import { createTestIframeSrc } from '../../../packages/browser/src/client/utils'

test('iframe src encodes plus signs in file paths', () => {
  const src = createTestIframeSrc(
    'session-123',
    'plus+/basic.test.ts',
    'http://localhost/__vitest_test__/',
  )

  const url = new URL(src)

  expect(url.searchParams.get('sessionId')).toBe('session-123')
  expect(url.searchParams.get('iframeId')).toBe('plus+/basic.test.ts')
  expect(src).toContain('iframeId=plus%2B%2Fbasic.test.ts')
})
