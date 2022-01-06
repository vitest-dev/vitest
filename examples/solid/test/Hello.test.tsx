import { afterAll, describe, expect, test } from 'vitest'
import { render } from 'solid-js/web'
import { Hello } from '../components/Hello'

describe('Solid.js Hello.tsx', () => {
  const unmount: (() => void)[] = []
  afterAll(() => {
    unmount.forEach(u => u())
    document.body.innerHTML = ''
  })

  test('mounts and unmounts', () => {
    const container = document.createElement('main')
    document.body.appendChild(container)
    unmount.push(render(() => <Hello count={4} />, container))
    expect(container).toBeTruthy()
    expect(container.innerHTML).toContain('4 x 2 = 8')
  })

  test('updates on button click', async() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    unmount.push(render(() => <Hello count={4} />, container))
    const button = container.querySelector('button')
    expect(button).toBeTruthy()
    expect(button).toBeInstanceOf(HTMLButtonElement)
    button?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, button: 0, composed: true }),
    )
    await new Promise<void>(resolve => setTimeout(() => resolve(), 17))
    expect(container.innerHTML).toContain('4 x 3 = 12')
  })
})
