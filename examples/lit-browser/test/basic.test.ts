import { beforeEach, describe, expect, it, vi } from 'vitest'

import '../src/my-button'

describe('Button with increment', async () => {
  function getInsideButton(idx: number): HTMLElement | null | undefined {
    return document.body.querySelectorAll('my-button')?.[idx]?.shadowRoot?.querySelector('button')
  }

  beforeEach(async () => {
    const element = document.createElement('my-button')
    element.name = 'World'
    document.body.appendChild(element)
  })

  it('should increment the count on each click', () => {
    getInsideButton(0)?.click()
    expect(getInsideButton(0)?.textContent).toContain('1')
  })

  it('should show name props', () => {
    getInsideButton(1)
    expect(document.body.querySelectorAll('my-button')?.[1]?.shadowRoot?.innerHTML).toContain('World')
  })

  it('should dispatch count event on button click', () => {
    const spyClick = vi.fn()

    document.querySelectorAll('my-button')[2].addEventListener('count', spyClick)

    getInsideButton(2)?.click()

    expect(spyClick).toHaveBeenCalled()
  })
})
