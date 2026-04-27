import { afterAll, beforeAll, describe, test, vi } from 'vitest'

const { setTimeout } = globalThis

function delay(timeout: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeout)
  })
}

function checkExtraTimers(location: string) {
  const count = vi.getTimerCount()
  if (count > 0) {
    throw new Error(`got extra timers (${location}): ${count}`)
  }
}

beforeAll(() => {
  vi.useFakeTimers()
})

afterAll(() => {
  vi.useRealTimers()
})

describe.each([1, 2])('group %d', (group) => {
  test('test', async () => {
    checkExtraTimers(`group ${group}a`)
    vi.advanceTimersByTime(60000 + 1)

    await delay(10)

    checkExtraTimers(`group ${group}b`)
    vi.advanceTimersByTime(60000 + 1)
  })
})
