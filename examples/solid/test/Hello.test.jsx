import { describe, expect, test } from 'vitest'
import { fireEvent, render } from '@solidjs/testing-library'
import { Hello } from '../components/Hello'

describe('<Hello />', () => {
  test('renders', () => {
    const { container, unmount } = render(() => <Hello count={4} />)
    expect(container.innerHTML).toMatchSnapshot()
    unmount()
  })

  test('updates', async () => {
    const { container, unmount, queryByText } = render(() => <Hello count={4} />)
    const button = queryByText('x1')
    const buttonClicked = new Promise((resolve) => {
      const handler = (ev) => {
        button.removeEventListener('click', handler)
        resolve(ev)
      }
      button.addEventListener('click', handler)
    })
    fireEvent.click(button)
    await buttonClicked
    expect(container.innerHTML).toMatchSnapshot()
    unmount()
  })
})
