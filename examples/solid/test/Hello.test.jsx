import { describe, expect, test } from 'vitest'
import { render } from 'solid-js/web'
import { Hello } from '../components/Hello'

describe('<Hello />', () => {
  test('renders', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const unmount = render(() => <Hello count={4} />, container)
    expect(container.innerHTML).toMatchSnapshot()
    unmount()
    document.body.removeChild(container)
  })

  test('updates', async() => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const unmount = render(() => <Hello count={4} />, container)
    container.querySelector('button').dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }),
    )
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(container.innerHTML).toMatchSnapshot()
    unmount()
    document.body.removeChild(container)
  })
})
