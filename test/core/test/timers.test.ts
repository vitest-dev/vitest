import { describe, it, vi } from 'vitest'

describe('getMockedSystemTime', () => {
  it('with fake timers', (ctx) => {
    vi.useFakeTimers()
    ctx.onTestFinished(() => {
      vi.useRealTimers()
    })

    // console.log(vi.getMockedSystemTime())
    // console.log(new Date())
  })

  it('without fake timers', () => {
  })
})
