import { expect, test } from 'vitest'

test('server headers from inline project config', async () => {
  const res = await fetch('/')
  expect(res.headers.get('x-inline-project')).toBe('from-inline-config')
})
