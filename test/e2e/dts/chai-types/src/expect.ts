import { assert, expect, test } from 'vitest'

test('chai api', async () => {
  expect('a').not.toBe('b')
  expect(1).to.equal(1)
  expect([1, 2]).to.not.include(3)
  expect({ a: 1 }).to.have.property('a').that.is.a('number')
  expect.soft(1).not.toBe(2)
  await expect(Promise.resolve(1)).resolves.not.toBe(2)
  assert.strictEqual(1, 1)
})
