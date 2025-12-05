import { expect, test, vi } from 'vitest'
import { userEvent, page, server } from 'vitest/browser'

test("scrolls the number of times it's called", async () => {
  document.body.innerHTML = `
    <div style="padding: 1rem;">
      <button>Scroll Me</button>
    </div>
  `;

  const wheel = vi.fn((event) => {
    console.log("scroll", event)
  })
  document.body.querySelector('button').addEventListener('wheel', wheel, { passive: true })

  await userEvent.wheel(page.getByRole("button"), 10, 0)
  await userEvent.wheel(page.getByRole("button"), 10, 0)
  await userEvent.wheel(page.getByRole("button"), 10, 0)
  await userEvent.wheel(page.getByRole("button"), 10, 0)
  await userEvent.wheel(page.getByRole("button"), 10, 0)

  expect(wheel).toHaveBeenCalledTimes(5)
})
