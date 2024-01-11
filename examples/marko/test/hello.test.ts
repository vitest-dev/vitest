import { fireEvent, render, screen } from '@marko/testing-library'
import Hello from '../components/Hello.marko'

describe('Hello.marko', () => {
  it('mounts', async () => {
    const { container } = await render(Hello, { count: 4 })
    expect(container).toBeTruthy()
    expect(container.innerHTML).toContain('4 x 2 = 8')
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('updates on button click', async () => {
    await render(Hello, { count: 4 })
    const btn = screen.getByRole('button')
    const div = screen.getByText('4 x 2 = 8')
    await fireEvent.click(btn)
    expect(div.innerHTML).toBe('4 x 3 = 12')
    await fireEvent.click(btn)
    expect(div.innerHTML).toBe('4 x 4 = 16')
  })
})
