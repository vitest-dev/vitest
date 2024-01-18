import { expect, it } from 'vitest'

it('server.headers', async () => {
  const res = await fetch('/')
  expect(res.ok)
  expect(res.headers.get('x-custom')).toBe('hello')
})
