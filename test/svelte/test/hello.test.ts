import { cleanup, render, screen, userEvent } from '../utils/test-utils'
import Hello from '../components/Hello.svelte'

describe('Hello.svelte', () => {
  // TODO: @testing-library/svelte claims to add this automatically but it doesn't work without explicit afterEach
  afterEach(() => cleanup())

  it('mounts', () => {
    const { container } = render(Hello, { count: 4 })
    expect(container).toBeTruthy()
    expect(container.innerHTML).toContain('4 x 2 = 8')
    expect(container.innerHTML).toMatchSnapshot()
  })

  /* TODO: From some reason this test breaks if not using async/await, even though it shouldn't be used with userEvent considering it doesn't return a promise. */
  it.only('updates on button click', async() => {
    render(Hello, { count: 4 })
    const btn = screen.getByRole('button')
    const div = screen.getByText('4 x 2 = 8')
    await userEvent.click(btn)
    expect(div.innerHTML).toBe('4 x 3 = 12')
    await userEvent.click(btn)
    expect(div.innerHTML).toBe('4 x 4 = 16')
  })
})

/*
//TODO improvements
    - alternatives to expect with innerHTML
 */
