import { describe, expect, test } from 'vitest'
import { render } from 'solid-js/web'
import { Hello } from '../components/Hello'

describe('Solid.js Hello.tsx', () => {
  test('mounts and unmounts', () => {
    const container = document.createElement('main')
    document.body.appendChild(container)
    const unmount = render(() => <Hello count={4} />, container)
    expect(container).toBeTruthy()
    expect(container.innerHTML).toContain('4 x 2 = 8')
    expect(container.innerHTML).toMatchSnapshot()
    unmount()
    expect(container.innerHTML).toBe('')
    document.body.removeChild(container)
  })

  test.todo('updates on button click')
})
