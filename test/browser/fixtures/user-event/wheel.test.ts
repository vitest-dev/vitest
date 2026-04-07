import { describe, test, vi } from 'vitest'
import { userEvent, page } from 'vitest/browser'

describe.for([
  'userEvent',
  'locator'
] as const)('`%s`', (testType) => {
  test.for([
    ['up', { deltaX: 0, deltaY: -100 }],
    ['down', { deltaX: 0, deltaY: 100 }],
    ['left', { deltaX: -100, deltaY: 0 }],
    ['right', { deltaX: 100, deltaY: 0 }]
  ] as const)('scrolls %s with default delta of 100', async ([direction, { deltaX, deltaY }], { expect }) => {
    document.body.innerHTML = `
        <div style="padding: 1rem;">
          <button>Scroll Me</button>
        </div>
      `;

    const wheel = vi.fn<(event: WheelEvent) => void>()
    document.body.querySelector('button').addEventListener('wheel', wheel, { passive: true })

    const options = { direction }
    const selector = page.getByRole("button")

    await (testType === 'userEvent' ? userEvent.wheel(selector, options) : selector.wheel(options))

    await expect.poll(() => wheel).toHaveBeenCalledOnce()
    expect(wheel.mock.calls[0][0].deltaX).toBe(deltaX)
    expect(wheel.mock.calls[0][0].deltaY).toBe(deltaY)
  })

  test.for([
    { deltaX: 0, deltaY: -50 },
    { deltaX: 0, deltaY: 50 },
    { deltaX: -50, deltaY: 0 },
    { deltaX: 50, deltaY: 0 }
  ] as const)('scrolls with custom delta values %o', async ({ deltaX, deltaY }, { expect }) => {
    document.body.innerHTML = `
        <div style="padding: 1rem;">
          <button>Scroll Me</button>
        </div>
      `;

    const wheel = vi.fn<(event: WheelEvent) => void>()
    document.body.querySelector('button').addEventListener('wheel', wheel, { passive: true })

    const options = {
      delta: {
        x: deltaX,
        y: deltaY,
      },
    }
    const selector = page.getByRole("button")

    await (testType === 'userEvent' ? userEvent.wheel(selector, options) : selector.wheel(options))

    expect(wheel).toHaveBeenCalledOnce()
    expect(wheel.mock.calls[0][0].deltaX).toBe(deltaX)
    expect(wheel.mock.calls[0][0].deltaY).toBe(deltaY)
  })

  test("fires wheel event multiple times when `times` option is set", { retry: 5 }, async ({ expect }) => {
    document.body.innerHTML = `
        <div style="padding: 1rem;">
          <button>Scroll Me</button>
        </div>
      `;

    const wheel = vi.fn<(event: WheelEvent) => void>()
    document.body.querySelector('button').addEventListener('wheel', wheel, { passive: true })

    const options = { direction: 'down', times: 5 } as const
    const selector = page.getByRole("button")

    await (testType === 'userEvent' ? userEvent.wheel(selector, options) : selector.wheel(options))

    expect(wheel).toHaveBeenCalledTimes(5)

    for (const call of wheel.mock.calls) {
      expect(call[0].deltaX).toBe(0)
      expect(call[0].deltaY).toBe(100)
    }
  })
})
