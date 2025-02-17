import { expect, onTestFinished, test, vi } from 'vitest'

test(`node fetch works without fake timers`, async () => {
  const response = Response.json('ok')
  expect(await response.json()).toMatchInlineSnapshot(`"ok"`)
})

test(`node fetch works with fake timers`, async () => {
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })

  const response = Response.json('ok')
  expect(await response.json()).toMatchInlineSnapshot(`"ok"`)
})
