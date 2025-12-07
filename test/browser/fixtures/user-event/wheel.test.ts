import { expect, test, vi } from 'vitest'
import { userEvent, page, server } from 'vitest/browser'

test.for([
  ['up', { deltaX: 0, deltaY: -100 }],
  ['down', { deltaX: 0, deltaY: 100 }],
  ['left', { deltaX: -100, deltaY: 0 }],
  ['right', { deltaX: 100, deltaY: 0 }]
] as const)('scrolls %s with default delta of 100', async ([direction, { deltaX, deltaY }]) => {
  document.body.innerHTML = `
    <div style="padding: 1rem;">
      <button>Scroll Me</button>
    </div>
  `;

  const wheel = vi.fn<(event: WheelEvent) => void>()
  document.body.querySelector('button').addEventListener('wheel', wheel, { passive: true })

  await userEvent.wheel(page.getByRole("button"), {
    direction,
  })

  expect(wheel).toHaveBeenCalledOnce()
  expect(wheel.mock.calls[0][0].deltaX).toBe(deltaX)
  expect(wheel.mock.calls[0][0].deltaY).toBe(deltaY)
})

test.for([
  { deltaX: 0, deltaY: -50 },
  { deltaX: 0, deltaY: 50 },
  { deltaX: -50, deltaY: 0 },
  { deltaX: 50, deltaY: 0 }
] as const)('scrolls with custom delta values %o', async ({ deltaX, deltaY }) => {
  document.body.innerHTML = `
    <div style="padding: 1rem;">
      <button>Scroll Me</button>
    </div>
  `;

  const wheel = vi.fn<(event: WheelEvent) => void>()
  document.body.querySelector('button').addEventListener('wheel', wheel, { passive: true })

  await userEvent.wheel(page.getByRole("button"), {
    delta: {
      x: deltaX,
      y: deltaY,
    },
  })

  expect(wheel).toHaveBeenCalledOnce()
  expect(wheel.mock.calls[0][0].deltaX).toBe(deltaX)
  expect(wheel.mock.calls[0][0].deltaY).toBe(deltaY)
})

test("fires wheel event multiple times when `times` option is set", { repeats: 100, timeout: 30_000 }, async () => {
  document.body.innerHTML = `
    <div style="padding: 1rem;">
      <button>Scroll Me</button>
    </div>
  `;

  const wheel = vi.fn<(event: WheelEvent) => void>()
  document.body.querySelector('button').addEventListener('wheel', wheel, { passive: true })

  await userEvent.wheel(page.getByRole("button"), {
    direction: 'down',
    times: 5,
  })

  expect(wheel).toHaveBeenCalledTimes(5)

  for (const call of wheel.mock.calls) {
    expect(call[0].deltaX).toBe(0)
    expect(call[0].deltaY).toBe(100)
  }
})
