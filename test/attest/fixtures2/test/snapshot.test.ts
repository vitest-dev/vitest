import { expect, test } from 'vitest'

// test('inline', () => {
//   expect(attest(1 + 2)).toMatchTypeSnapshot()
//   expect(attest((1 + 2).toFixed)).toMatchTypeSnapshot()
// })

test('file', () => {
  expect(1 + 2).toMatchTypeSnapshot()
  expect((1 + 2).toFixed).toMatchTypeSnapshot()
})
