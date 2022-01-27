
test('something has been added to global by setupFiles entry', async() => {
  // @ts-expect-error
  const result = something
  expect(result).toBe('something')
})
