import { test, vi } from 'vitest'
import { userEvent, page } from 'vitest/browser'

type PointerAction = (event: PointerEvent) => void

test('hovers and clicks a button', async ({ expect }) => {
  document.body.innerHTML = `
    <div style="padding: 1rem;">
      <button>Button</button>
    </div>
  `;

  const enter = vi.fn<PointerAction>()
  const leave = vi.fn<PointerAction>()
  const click = vi.fn<PointerAction>()

  const buttonElement = document.body.querySelector('button')

  buttonElement.addEventListener('mouseenter', enter)
  buttonElement.addEventListener('mouseleave', leave)
  buttonElement.addEventListener('click', click)

  const target = page.getByRole("button")

  await userEvent.pointer([
    { target, action: 'click' },
    { target: document.body },
  ])

  expect(enter).toHaveBeenCalledOnce()
  expect(click).toHaveBeenCalledOnce()
  expect(leave).toHaveBeenCalledOnce()

  expect(enter).toHaveBeenCalledBefore(click)
  expect(click).toHaveBeenCalledBefore(leave)
})
