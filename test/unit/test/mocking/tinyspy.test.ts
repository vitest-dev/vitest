import type * as tinyspyModule from 'tinyspy'
import { expect, test, vi } from 'vitest'

test('tinyspy is not mocked with __mocks__, but automatically mocked', async () => {
  const tinyspy = await vi.importMock<typeof tinyspyModule>('tinyspy')

  expect(vi.isMockFunction(tinyspy.spyOn)).toBe(true)
  expect(vi.isMockFunction(tinyspy.spy)).toBe(true)
})
