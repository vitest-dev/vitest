import { expect, test } from 'vitest'

const resolve = () => Promise.resolve('foo')
const reject = () => Promise.reject(new Error('foo'))

test('resolved inline', async () => {
  await expect(resolve()).resolves.toMatchInlineSnapshot('"foo"')
})

test('rejected inline', async () => {
  await expect(reject()).rejects.toMatchInlineSnapshot('[Error: foo]')
  await expect(reject()).rejects.toThrowErrorMatchingInlineSnapshot('"foo"')
})
