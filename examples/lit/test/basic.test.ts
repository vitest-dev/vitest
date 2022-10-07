import { beforeEach, describe, expect, it, vi } from 'vitest'

import '../src/my-button'

describe('Button with increment', async () => {
  function getInsideButton(): HTMLElement | null | undefined {
    return document.body.querySelector('my-button')?.shadowRoot?.querySelector('button')
  }

  beforeEach(async () => {
    document.body.innerHTML = '<my-button name="World"></my-button>'
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        if (getInsideButton()) {
          clearInterval(interval)
          resolve()
        }
      })
    })
  })

  it('should increment the count on each click', () => {
    getInsideButton()?.click()
    expect(getInsideButton()?.textContent).toContain('1')
  })

  it('should show name props', () => {
    getInsideButton()
    expect(document.body.querySelector('my-button')?.shadowRoot?.innerHTML).toContain('World')
  })

  it('should dispatch count event on button click', () => {
    const spyClick = vi.fn()

    document.querySelector('my-button')!.addEventListener('count', spyClick)

    getInsideButton()?.click()

    expect(spyClick).toHaveBeenCalled()
  })
})
