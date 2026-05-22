import { expect, test } from 'vitest'

test('ssr dynamic import', async () => {
  const res = await fetch('/api/ssr-dep')
  const text = await res.json()
  expect(text).toBe('ssr-dep')
})
