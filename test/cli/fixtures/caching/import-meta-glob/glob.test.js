import { test, expect, inject } from 'vitest'

test('replaced variable is the same', () => {
  const files = import.meta.glob('./generated/*')
  expect(Object.keys(files)).toEqual(inject('generated'))
})
