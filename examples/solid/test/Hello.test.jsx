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
    const button = container.querySelector('button')
    const buttonClicked = new Promise((resolve) => {
      const handler = (ev) => {
        button.removeEventListener('click', handler)
        resolve(ev)
      }
      button.addEventListener('click', handler)
    })
    button.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }),
    )
    await buttonClicked
    expect(container.innerHTML).toMatchSnapshot()
    unmount()
    document.body.removeChild(container)
  })
})
