import { expect, onTestFinished, test, vi } from 'vitest'

test(`node fetch works without fake timers`, async () => {
  expect(await Response.json('ok').json()).toBe('ok')
})

test(`node fetch works with fake timers`, async () => {
  vi.useFakeTimers()
  onTestFinished(() => {
    vi.useRealTimers()
  })
  expect(await Response.json('ok').json()).toBe('ok')
})

// skipped since this might cause a weird OOM on CI
test.skip(`node fetch timeouts with fake queueMicrotask`, async () => {
  vi.useFakeTimers({ toFake: ['queueMicrotask'] })
  onTestFinished(() => {
    vi.useRealTimers()
  })
  expect(
    await Promise.race([
      new Promise(r => setTimeout(() => r('timeout'), 200)),
      Response.json('ok').json(),
    ]),
  ).toBe('timeout')
})
