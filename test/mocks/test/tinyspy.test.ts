import type * as tinyspyModule from 'tinyspy'

test.skip('tinyspy is not mocked with __mocks__, but automatically mocked', async() => {
  const tinyspy = await vi.requireMock<typeof tinyspyModule>('tinyspy')

  expect(vi.isMockFunction(tinyspy.spyOn)).toBe(true)
  expect(vi.isMockFunction(tinyspy.spy)).toBe(true)
})
