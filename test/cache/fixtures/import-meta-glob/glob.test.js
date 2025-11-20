import { test, expect, inject } from 'vitest'

test('replaced variable is the same', () => {
  const files = import.meta.glob('./generated/*')
  console.log(files)
  expect(Object.keys(files)).toEqual(inject('generated'))
})
