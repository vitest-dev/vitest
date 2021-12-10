import { render, fireEvent, cleanup } from '@testing-library/svelte'
import Hello from '../components/Hello.svelte'

const { click } = fireEvent

describe('Hello.svelte', () => {
  // TODO @testing-library/svelte claims to add this automatically but it doesn't work without explicit afterEach
  afterEach(() => cleanup())

  it('mounts', async() => {
    const { container } = render(Hello, { count: 4 })
    expect(container).toBeTruthy()
    expect(container.innerHTML).toContain('4 x 2 = 8')
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('updates on button click', async() => {
    const { getByText, getByRole } = render(Hello, { count: 4 })
    const btn = getByRole('button')
    const div = getByText('4 x 2 = 8')
    await click(btn)
    expect(div.innerHTML).toBe('4 x 3 = 12')
    await click(btn)
    expect(div.innerHTML).toBe('4 x 4 = 16')
  })
})

/*
//TODO improvements
    - alternatives to expect with innerHTML
 */
