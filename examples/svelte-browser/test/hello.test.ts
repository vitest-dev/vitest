import { fireEvent, render, screen } from '@testing-library/svelte'
import Hello from '../components/Hello.svelte'

describe('Hello.svelte', () => {
  it('mounts', () => {
    const host1 = document.createElement('div')
    host1.setAttribute('id', 'host1')
    document.body.appendChild(host1)
    const { container } = render(Hello, { count: 4 }, { container: host1 })
    expect(container).toBeTruthy()
    expect(container.innerHTML).toContain('4 x 2 = 8')
    expect(container.innerHTML).toMatchSnapshot()
  })

  it('updates on button click', async () => {
    const host2 = document.createElement('div')
    host2.setAttribute('id', 'host2')
    document.body.appendChild(host2)
    render(Hello, { count: 4 }, { container: host2 })
    const btn = screen.getByRole('button')
    const div = screen.getByText('4 x 2 = 8')
    await fireEvent.click(btn)
    expect(div.innerHTML).toBe('4 x 3 = 12')
    await fireEvent.click(btn)
    expect(div.innerHTML).toBe('4 x 4 = 16')
  })
})

/*
//TODO improvements
    - alternatives to expect with innerHTML
 */
