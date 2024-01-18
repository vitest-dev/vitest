import { expect, test } from 'vitest'

function resolve() {
  return Promise.resolve('foo')
}
function reject() {
  return Promise.reject(new Error('foo'))
}

test('resolved inline', async () => {
  await expect(resolve()).resolves.toMatchInlineSnapshot('"foo"')
})

test('rejected inline', async () => {
  await expect(reject()).rejects.toMatchInlineSnapshot('[Error: foo]')
  await expect(reject()).rejects.toThrowErrorMatchingInlineSnapshot(`[Error: foo]`)
})
